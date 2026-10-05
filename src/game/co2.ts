/**
 * From a factor to "≈ kg": the regional computation of product spec section 3.5.
 * Electricity actions use the user's grid, car trips the regional average car, heat
 * actions the way the home is heated. A result is never negative and never above the
 * published high value.
 */
import {
  ACTION_BY_ID,
  DEFAULT_REGION,
  GRID_BY_ID,
  REFERENCE_FACTORS,
  type ActionDef,
} from '@/data/catalogue';
import { clamp } from '@/lib/math';
import type { HeatSource, RegionId } from './types';

export interface KgContext {
  region: RegionId;
  heat: HeatSource;
}

/** What the log sheet asks beyond the quantity, for the actions that need it. */
export interface LogInputs {
  /** Evidence variant id for repairs and borrowed things. */
  variant?: string | null;
  /** People in a shared car, driver included (2 to 4). */
  people?: number;
  /** Round-trip car commute a home-working day replaced, in km. */
  commuteKm?: number;
  /** Heating or cooling was on at home during a home-working day. */
  heatingOn?: boolean;
}

export interface KgEstimate {
  perUnit: number;
  kg: number;
  low: number;
  high: number;
}

export const CARPOOL_PEOPLE = [2, 3, 4] as const;
export const DEFAULT_CARPOOL_PEOPLE = 2;
export const COMMUTE_PRESETS_KM = [10, 20, 30, 60] as const;
export const DEFAULT_COMMUTE_KM = 30;
export const COMMUTE_MAX_KM = 300;

type Regional = { default: number; byRegion: Readonly<Record<string, number>> };

function regional(table: Regional, region: RegionId): number {
  return table.byRegion[region] ?? table.default;
}

/** Lifecycle carbon intensity of the user's electricity, kg CO2e per kWh. */
export function gridIntensity(region: RegionId): number {
  const entry = GRID_BY_ID.get(region) ?? GRID_BY_ID.get(DEFAULT_REGION);
  return entry ? entry.kgCO2ePerKWh : 0;
}

export function isKnownRegion(region: string): boolean {
  return GRID_BY_ID.has(region);
}

/** An average car including fuel production, kg CO2e per km. */
export function carKgPerKm(region: RegionId): number {
  return regional(REFERENCE_FACTORS.carKgPerKm, region);
}

export function busKgPerPassengerKm(region: RegionId): number {
  return regional(REFERENCE_FACTORS.busKgPerPassengerKm, region);
}

export function railKgPerPassengerKm(region: RegionId): number {
  return regional(REFERENCE_FACTORS.railKgPerPassengerKm, region);
}

/** Kilograms for one unit of saved heat, by how the home makes its heat. */
function byHeat(context: KgContext, gasKg: number, electricKWh: number): number {
  switch (context.heat) {
    case 'gas':
    case 'unknown':
      return gasKg;
    case 'electric':
      return electricKWh * gridIntensity(context.region);
    case 'heat-pump':
      return (electricKWh * gridIntensity(context.region)) / REFERENCE_FACTORS.heatPumpCop;
    case 'none':
      return 0;
  }
}

/** True for the actions whose saving is heat; they are hidden when a home has no heating. */
export function isHeatAction(action: Pick<ActionDef, 'factor'>): boolean {
  return action.factor?.regionalisation === 'heat';
}

export function carpoolPeople(inputs: LogInputs | undefined): number {
  const people = Math.round(inputs?.people ?? DEFAULT_CARPOOL_PEOPLE);
  return clamp(people, CARPOOL_PEOPLE[0], CARPOOL_PEOPLE[CARPOOL_PEOPLE.length - 1] ?? 4);
}

export function commuteKm(inputs: LogInputs | undefined): number {
  const km = inputs?.commuteKm ?? DEFAULT_COMMUTE_KM;
  return clamp(Number.isFinite(km) ? km : DEFAULT_COMMUTE_KM, 0, COMMUTE_MAX_KM);
}

/** The raw home-working saving before clamping: the commute minus the energy used at home. */
export function homeWorkingKg(context: KgContext, inputs: LogInputs | undefined): number {
  const perHour =
    inputs?.heatingOn === false
      ? REFERENCE_FACTORS.homeworkingKgPerHour.equipmentOnly
      : REFERENCE_FACTORS.homeworkingKgPerHour.heatingOrCooling;
  return (
    commuteKm(inputs) * carKgPerKm(context.region) - REFERENCE_FACTORS.homeworkingHours * perHour
  );
}

/** The variant a log uses: the requested one when the action has it, else the action's default. */
export function resolveVariant(
  action: ActionDef,
  requested: string | null | undefined,
): string | null {
  if (action.variants.length === 0) return null;
  if (requested && action.variants.some((variant) => variant.id === requested)) return requested;
  return action.defaultVariant;
}

/**
 * Estimated kg CO2e avoided per unit of an action for this user, or `null` when the
 * action has no factor or its figure is context only (it is then never added to a total).
 */
export function kgPerUnit(
  action: ActionDef,
  context: KgContext,
  inputs?: LogInputs,
): number | null {
  const factor = action.factor;
  if (!factor || action.credit !== 'log') return null;
  const grid = gridIntensity(context.region);
  const car = carKgPerKm(context.region);
  const gas = REFERENCE_FACTORS.gasKgPerKWh;
  const boiler = REFERENCE_FACTORS.boilerEfficiency;
  let value: number;

  switch (action.id) {
    case 'walk-cycle-instead-of-car':
      value = car;
      break;
    case 'ebike-escooter-instead-of-car':
      value = car + (factor.kWhPerUnit ?? 0) * grid;
      break;
    case 'bus-instead-of-car':
      value = car - busKgPerPassengerKm(context.region);
      break;
    case 'train-metro-instead-of-car':
      value = car - railKgPerPassengerKm(context.region);
      break;
    case 'carpool': {
      const people = carpoolPeople(inputs);
      value = (car * (people - 1)) / people;
      break;
    }
    case 'work-from-home-day':
      value = homeWorkingKg(context, inputs);
      break;
    case 'ev-instead-of-petrol-car':
      value = REFERENCE_FACTORS.petrolCarKgPerKm - REFERENCE_FACTORS.electricCarKWhPerKm * grid;
      break;
    case 'thermostat-down-1c': {
      // The evidence gives this one in kWh of gas, not of useful heat: no boiler loss to add.
      const kWh = factor.heatKWhPerUnit ?? 0;
      value = byHeat(context, kWh * gas, kWh);
      break;
    }
    case 'shorter-shower': {
      const kWh = factor.heatKWhPerUnit ?? 0;
      value = byHeat(context, (kWh / boiler) * gas, kWh);
      break;
    }
    case 'hot-water-saved': {
      const kWh = factor.heatKWhPerUnit ?? 0;
      value = byHeat(context, (kWh / boiler) * gas, kWh) + REFERENCE_FACTORS.waterSupplyKgPerLitre;
      break;
    }
    default: {
      const variantId = resolveVariant(action, inputs?.variant);
      const variant = action.variants.find((item) => item.id === variantId);
      if (variant) value = variant.kgPerUnit;
      else if (factor.regionalisation === 'grid') value = (factor.kWhPerUnit ?? 0) * grid;
      else value = factor.nonGridKgPerUnit;
    }
  }

  // Heat actions in a home without heating save nothing, the water supply share included.
  if (isHeatAction(action) && context.heat === 'none') value = 0;
  return clamp(value, 0, factor.high);
}

/** The estimate for a whole log, or `null` when the action carries no creditable figure. */
export function estimateKg(
  action: ActionDef,
  qty: number,
  context: KgContext,
  inputs?: LogInputs,
): KgEstimate | null {
  const perUnit = kgPerUnit(action, context, inputs);
  if (perUnit === null || !action.factor) return null;
  const kg = perUnit * qty;
  return {
    perUnit,
    kg,
    low: Math.max(0, Math.min(action.factor.low * qty, kg)),
    high: Math.max(action.factor.high * qty, kg),
  };
}

/** The figure shown as context for an action that is never credited (a planted tree). */
export function contextKgPerUnit(action: ActionDef): number | null {
  return action.credit === 'context' && action.factor ? action.factor.central : null;
}

/** "≈ {kg} a year" each LED keeps saving while it replaces an old bulb; context, never a total. */
export function ledYearlyKgPerBulb(region: RegionId): number {
  return REFERENCE_FACTORS.ledKWhPerBulbYear * gridIntensity(region);
}

/** Encodes sheet inputs into the log's `variant` string so a log explains its own number. */
export function encodeVariant(action: ActionDef, inputs: LogInputs | undefined): string | null {
  if (action.id === 'carpool') return `people:${carpoolPeople(inputs)}`;
  if (action.id === 'work-from-home-day') {
    return `commute:${commuteKm(inputs)}:${inputs?.heatingOn === false ? 'off' : 'on'}`;
  }
  return resolveVariant(action, inputs?.variant);
}

/** The inverse of `encodeVariant`, for prefilling the sheet from the last log. */
export function decodeVariant(actionId: string, variant: string | null): LogInputs {
  if (!variant) return {};
  if (actionId === 'carpool' && variant.startsWith('people:')) {
    return { people: Number(variant.slice(7)) };
  }
  if (actionId === 'work-from-home-day' && variant.startsWith('commute:')) {
    const [, km, heat] = variant.split(':');
    return { commuteKm: Number(km), heatingOn: heat !== 'off' };
  }
  return ACTION_BY_ID.get(actionId)?.variants.length ? { variant } : {};
}
