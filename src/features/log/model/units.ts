/**
 * How a quantity is worded and typed. Storage is metric; miles exist only at the display
 * edge, for people who chose imperial units (spec 3.4).
 */
import type { ActionDef } from '@/data/catalogue';
import { formatDecimal } from '@/lib/format';
import { roundTo } from '@/lib/math';

export type UnitSystem = 'metric' | 'imperial';

interface UnitCopy {
  one: string;
  many: string;
  /** What the unit cell of an input reads. */
  suffix: string;
}

const UNIT_COPY: Readonly<Record<string, UnitCopy>> = {
  km: { one: 'km', many: 'km', suffix: 'km' },
  mi: { one: 'mi', many: 'mi', suffix: 'mi' },
  meal: { one: 'meal', many: 'meals', suffix: 'meals' },
  serving: { one: 'serving', many: 'servings', suffix: 'servings' },
  day: { one: 'day', many: 'days', suffix: 'days' },
  litre: { one: 'litre', many: 'litres', suffix: 'litres' },
  kg: { one: 'kg', many: 'kg', suffix: 'kg' },
  load: { one: 'load', many: 'loads', suffix: 'loads' },
  'bulb-day': { one: 'bulb', many: 'bulbs', suffix: 'bulbs' },
  minute: { one: 'min', many: 'min', suffix: 'min' },
  item: { one: 'item', many: 'items', suffix: 'items' },
  year: { one: 'year', many: 'years', suffix: 'years' },
  'tree-year': { one: 'tree', many: 'trees', suffix: 'trees' },
  session: { one: 'session', many: 'sessions', suffix: 'sessions' },
  hour: { one: 'hour', many: 'hours', suffix: 'hours' },
  conversation: { one: 'chat', many: 'chats', suffix: 'chats' },
  action: { one: 'action', many: 'actions', suffix: 'actions' },
  trip: { one: 'trip', many: 'trips', suffix: 'trips' },
  time: { one: 'time', many: 'times', suffix: 'times' },
};

const KM_PER_MILE = 1.609344;

function copyFor(unit: string): UnitCopy {
  return UNIT_COPY[unit] ?? { one: unit, many: unit, suffix: unit };
}

/** The unit a person sees for an action: miles for distances when they chose imperial. */
export function displayUnit(unit: string, system: UnitSystem): string {
  return unit === 'km' && system === 'imperial' ? 'mi' : unit;
}

/** A stored (metric) quantity in the unit the person sees. */
export function toDisplayQty(qty: number, unit: string, system: UnitSystem): number {
  return unit === 'km' && system === 'imperial' ? roundTo(qty / KM_PER_MILE, 1) : qty;
}

/** What the person typed, as the metric quantity that is stored. */
export function toStoredQty(
  shown: number,
  unit: string,
  system: UnitSystem,
  decimals: number,
): number {
  if (unit === 'km' && system === 'imperial') return roundTo(shown * KM_PER_MILE, decimals);
  return shown;
}

export function unitSuffix(unit: string, system: UnitSystem): string {
  return copyFor(displayUnit(unit, system)).suffix;
}

/** "5 km", "2 meals", "0.5 kg", "3.1 mi". */
export function formatQty(qty: number, unit: string, system: UnitSystem = 'metric'): string {
  const shown = toDisplayQty(qty, unit, system);
  const copy = copyFor(displayUnit(unit, system));
  return `${formatDecimal(shown, 2)} ${shown === 1 ? copy.one : copy.many}`;
}

/** The step of the − / + buttons: the power of ten that fits the action's presets. */
export function stepFor(action: Pick<ActionDef, 'presets' | 'decimals'>): number {
  const presets = [...action.presets].sort((a, b) => a - b);
  let smallest = presets[0] ?? 1;
  for (let index = 1; index < presets.length; index += 1) {
    const gap = (presets[index] as number) - (presets[index - 1] as number);
    if (gap > 0) smallest = Math.min(smallest, gap);
  }
  const step = 10 ** Math.floor(Math.log10(Math.max(smallest, 10 ** -action.decimals)));
  return Math.max(step, 10 ** -action.decimals);
}

/**
 * Reads a typed amount. Accepts a comma as the decimal mark; anything that is not a plain
 * positive number is `null`, so the sheet can say so instead of guessing.
 */
export function parseQty(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Snaps a stepped value to the action's precision, so 0.1 + 0.2 never reads 0.30000000000000004. */
export function snapQty(value: number, decimals: number): number {
  return roundTo(value, decimals);
}

export interface QtyOption {
  /** Stable key for a segmented control. */
  value: string;
  /** "5 km", "2 meals". */
  label: string;
  /** The metric quantity that is stored. */
  qty: number;
}

/**
 * An action's presets as the person sees them. Someone on miles gets the same round numbers
 * in miles ("2 mi"), stored as their kilometres.
 */
export function presetOptions(
  action: Pick<ActionDef, 'presets' | 'unit' | 'decimals'>,
  system: UnitSystem,
): QtyOption[] {
  return action.presets.map((preset) => {
    const qty = toStoredQty(preset, action.unit, system, action.decimals);
    return { value: String(preset), label: formatQty(qty, action.unit, system), qty };
  });
}

/** The preset a stored quantity corresponds to, or `null` when it is a custom amount. */
export function presetFor(qty: number, options: readonly QtyOption[]): QtyOption | null {
  return options.find((option) => Math.abs(option.qty - qty) < 1e-6) ?? null;
}

/** Whether the sheet needs a quantity control at all: "1 day, once a day" does not. */
export function hasQuantityChoice(action: Pick<ActionDef, 'presets' | 'dailyCap'>): boolean {
  const only = action.presets[0] ?? 1;
  return action.presets.length > 1 || action.dailyCap > only;
}

/** The text an amount field shows for a stored quantity. */
export function qtyFieldText(qty: number, unit: string, system: UnitSystem): string {
  return String(toDisplayQty(qty, unit, system));
}
