import { describe, expect, it } from 'vitest';
import { ACTIONS, ACTION_BY_ID, GRID, type ActionDef } from '@/data/catalogue';
import {
  carKgPerKm,
  contextKgPerUnit,
  decodeVariant,
  encodeVariant,
  estimateKg,
  gridIntensity,
  homeWorkingKg,
  isHeatAction,
  kgPerUnit,
  ledYearlyKgPerBulb,
  resolveVariant,
  type KgContext,
} from './co2';
import type { HeatSource } from './types';

const WORLD: KgContext = { region: 'WORLD', heat: 'unknown' };
const HEATS: HeatSource[] = ['unknown', 'gas', 'electric', 'heat-pump', 'none'];

function action(id: string): ActionDef {
  const found = ACTION_BY_ID.get(id);
  if (!found) throw new Error(`no action ${id}`);
  return found;
}

describe('regional kg computation', () => {
  it('falls back to the world grid for an unknown region', () => {
    expect(gridIntensity('WORLD')).toBe(0.45849);
    expect(gridIntensity('ATLANTIS')).toBe(0.45849);
    expect(gridIntensity('FR')).toBe(0.04145);
  });

  it('uses the regional average car', () => {
    expect(carKgPerKm('US')).toBe(0.2442);
    expect(carKgPerKm('IN')).toBe(0.14);
    expect(carKgPerKm('DE')).toBe(0.2099);
  });

  it('stays within 5% of the published central value on the world grid', () => {
    const sheetDriven = new Set(['carpool', 'work-from-home-day']);
    const checked = ACTIONS.filter((item) => item.credit === 'log' && !sheetDriven.has(item.id));
    expect(checked).toHaveLength(38);
    for (const item of checked) {
      const value = kgPerUnit(item, WORLD);
      const central = item.factor?.central ?? 0;
      expect(value, item.id).not.toBeNull();
      expect(Math.abs((value ?? 0) - central) / central, item.id).toBeLessThanOrEqual(0.05);
    }
  });

  it('is never negative and never above the published high, anywhere', () => {
    for (const item of ACTIONS) {
      for (const region of GRID) {
        for (const heat of HEATS) {
          const value = kgPerUnit(item, { region: region.id, heat }, { commuteKm: 300, people: 4 });
          if (item.credit !== 'log') {
            expect(value).toBeNull();
            continue;
          }
          expect(value).not.toBeNull();
          expect(value ?? -1).toBeGreaterThanOrEqual(0);
          expect(value ?? Infinity).toBeLessThanOrEqual(item.factor?.high ?? 0);
        }
      }
    }
  });

  it('never gives a figure to unquantified or context-only actions', () => {
    expect(kgPerUnit(action('litter-pick'), WORLD)).toBeNull();
    expect(kgPerUnit(action('car-free-day'), WORLD)).toBeNull();
    expect(kgPerUnit(action('plant-a-tree'), WORLD)).toBeNull();
    expect(estimateKg(action('plant-a-tree'), 1, WORLD)).toBeNull();
    expect(contextKgPerUnit(action('plant-a-tree'))).toBe(6);
    expect(contextKgPerUnit(action('plant-based-meal'))).toBeNull();
  });

  it('scales electricity actions with the grid', () => {
    const dry = action('line-dry-instead-of-tumble');
    expect(kgPerUnit(dry, { region: 'FR', heat: 'unknown' })).toBeCloseTo(1.52 * 0.04145, 10);
    expect(kgPerUnit(dry, { region: 'IN', heat: 'unknown' })).toBeCloseTo(1.52 * 0.67055, 10);
    const ev = action('ev-instead-of-petrol-car');
    expect(kgPerUnit(ev, WORLD)).toBeCloseTo(0.2075 - 0.20358 * 0.45849, 10);
    expect(kgPerUnit(ev, { region: 'FR', heat: 'unknown' })).toBeCloseTo(0.199, 3);
    const ebike = action('ebike-escooter-instead-of-car');
    expect(kgPerUnit(ebike, WORLD)).toBeCloseTo(0.2099 - 0.01 * 0.45849, 10);
  });

  it('subtracts the bus and the train in each region', () => {
    const bus = action('bus-instead-of-car');
    const rail = action('train-metro-instead-of-car');
    expect(kgPerUnit(bus, WORLD)).toBeCloseTo(0.0819, 10);
    expect(kgPerUnit(bus, { region: 'IN', heat: 'unknown' })).toBeCloseTo(0.14 - 0.0152, 10);
    expect(kgPerUnit(rail, { region: 'US', heat: 'unknown' })).toBeCloseTo(0.2442 - 0.0826, 10);
    // A US bus trip avoids more than the published high for the action: it is clamped.
    expect(kgPerUnit(bus, { region: 'US', heat: 'unknown' })).toBe(0.16);
  });

  it('follows how the home is heated', () => {
    const shower = action('shorter-shower');
    const gas = (0.22 / 0.9) * 0.21252;
    expect(kgPerUnit(shower, { region: 'GB', heat: 'gas' })).toBeCloseTo(gas, 10);
    expect(kgPerUnit(shower, { region: 'GB', heat: 'unknown' })).toBeCloseTo(gas, 10);
    expect(kgPerUnit(shower, { region: 'GB', heat: 'electric' })).toBeCloseTo(0.22 * 0.21741, 10);
    expect(kgPerUnit(shower, { region: 'GB', heat: 'heat-pump' })).toBeCloseTo(
      (0.22 * 0.21741) / 3,
      10,
    );
    expect(kgPerUnit(shower, { region: 'GB', heat: 'none' })).toBe(0);
    expect(kgPerUnit(action('hot-water-saved'), { region: 'GB', heat: 'none' })).toBe(0);
    expect(kgPerUnit(action('thermostat-down-1c'), WORLD)).toBeCloseTo(3.63 * 0.21252, 10);
    expect(kgPerUnit(action('hot-water-saved'), WORLD)).toBeCloseTo(
      (0.0291 / 0.9) * 0.21252 + 0.00036,
      10,
    );
    expect(ACTIONS.filter(isHeatAction).map((item) => item.id)).toEqual([
      'thermostat-down-1c',
      'shorter-shower',
      'hot-water-saved',
    ]);
  });

  it('shares a carpool between the riders', () => {
    const carpool = action('carpool');
    expect(kgPerUnit(carpool, WORLD, { people: 2 })).toBeCloseTo(0.2099 / 2, 10);
    expect(kgPerUnit(carpool, WORLD, { people: 3 })).toBeCloseTo((0.2099 * 2) / 3, 10);
    expect(kgPerUnit(carpool, WORLD)).toBeCloseTo(0.2099 / 2, 10);
    expect(kgPerUnit(carpool, WORLD, { people: 9 })).toBeCloseTo((0.2099 * 3) / 4, 10);
    expect(encodeVariant(carpool, { people: 3 })).toBe('people:3');
    expect(decodeVariant('carpool', 'people:3')).toEqual({ people: 3 });
  });

  it('lets a short home-working day be worth nothing, never less', () => {
    const wfh = action('work-from-home-day');
    expect(homeWorkingKg(WORLD, { commuteKm: 30, heatingOn: true })).toBeCloseTo(
      30 * 0.2099 - 8 * 0.324,
      10,
    );
    expect(kgPerUnit(wfh, WORLD, { commuteKm: 30, heatingOn: true })).toBeCloseTo(3.705, 3);
    expect(kgPerUnit(wfh, WORLD, { commuteKm: 30, heatingOn: false })).toBeCloseTo(
      30 * 0.2099 - 8 * 0.022,
      10,
    );
    expect(homeWorkingKg(WORLD, { commuteKm: 10, heatingOn: true })).toBeLessThan(0);
    expect(kgPerUnit(wfh, WORLD, { commuteKm: 10, heatingOn: true })).toBe(0);
    expect(kgPerUnit(wfh, WORLD, { commuteKm: 300, heatingOn: false })).toBe(12);
    expect(encodeVariant(wfh, { commuteKm: 20, heatingOn: false })).toBe('commute:20:off');
    expect(decodeVariant('work-from-home-day', 'commute:20:off')).toEqual({
      commuteKm: 20,
      heatingOn: false,
    });
  });

  it('uses the chosen variant for repairs and borrowed things', () => {
    const repair = action('repair-instead-of-replace');
    expect(kgPerUnit(repair, WORLD)).toBe(7);
    expect(kgPerUnit(repair, WORLD, { variant: 'laptop' })).toBe(22);
    expect(kgPerUnit(repair, WORLD, { variant: 'nonsense' })).toBe(7);
    expect(resolveVariant(repair, 'jeans')).toBe('jeans');
    expect(resolveVariant(repair, null)).toBe('small-appliance');
    expect(kgPerUnit(action('borrow-instead-of-buy'), WORLD, { variant: 'book' })).toBe(0.36);
    expect(encodeVariant(action('plant-based-meal'), {})).toBeNull();
    expect(decodeVariant('repair-instead-of-replace', 'laptop')).toEqual({ variant: 'laptop' });
  });

  it('builds a log estimate whose range contains the value', () => {
    const estimate = estimateKg(action('plant-based-meal'), 2, WORLD);
    expect(estimate).toEqual({ perUnit: 1.52, kg: 3.04, low: 1.94, high: 5.2 });
    for (const item of ACTIONS) {
      const result = estimateKg(item, item.defaultQty, { region: 'IN', heat: 'electric' });
      if (!result) continue;
      expect(result.low).toBeLessThanOrEqual(result.kg);
      expect(result.high).toBeGreaterThanOrEqual(result.kg);
    }
  });

  it('credits an LED on day one only and shows the yearly saving as context', () => {
    expect(kgPerUnit(action('led-bulb-swap'), WORLD)).toBeCloseTo(0.072 * 0.45849, 10);
    expect(ledYearlyKgPerBulb('WORLD')).toBeCloseTo(26 * 0.45849, 10);
  });
});
