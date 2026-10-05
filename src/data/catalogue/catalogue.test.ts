import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  ACTION_BY_ID,
  BASELINE_MODEL,
  BASELINE_QUESTIONS,
  BASELINE_WORKED_EXAMPLES,
  CATEGORIES,
  CATEGORY_IDS,
  DEFAULT_REGION,
  EQUIVALENCES,
  EVIDENCE_META,
  GRID,
  GRID_BY_ID,
  GROUPS,
  GROUP_BY_ID,
  REFERENCE_FACTORS,
  SOURCES,
} from './index';

describe('catalogue data', () => {
  it('holds 51 actions in the seven categories with the published split', () => {
    expect(ACTIONS).toHaveLength(51);
    const count = (category: string) => ACTIONS.filter((a) => a.category === category).length;
    expect(CATEGORY_IDS.map(count)).toEqual([10, 9, 5, 5, 6, 9, 7]);
    expect(CATEGORIES.map((category) => category.id)).toEqual([...CATEGORY_IDS]);
    expect(ACTIONS.filter((action) => action.factor !== null)).toHaveLength(41);
    expect(ACTIONS.filter((action) => action.credit === 'log')).toHaveLength(40);
    expect(ACTIONS.filter((action) => action.credit === 'context').map((a) => a.id)).toEqual([
      'plant-a-tree',
    ]);
  });

  it('never gives a number to an action without evidence', () => {
    const unquantified = ACTIONS.filter((action) => action.confidence === 'not_quantified');
    expect(unquantified.map((action) => action.id).sort()).toEqual(
      [
        'ac-up-1c',
        'car-free-day',
        'civic-action',
        'climate-conversation',
        'ewaste-dropoff',
        'habitat-volunteering',
        'help-wildlife',
        'litter-pick',
        'pass-it-on',
        'tend-plants',
      ].sort(),
    );
    for (const action of unquantified) {
      expect(action.factor).toBeNull();
      expect(action.credit).toBe('none');
      expect(action.sources).toEqual([]);
    }
  });

  it('keeps every action internally consistent', () => {
    for (const action of ACTIONS) {
      expect(action.presets).toContain(action.defaultQty);
      expect(Math.max(...action.presets)).toBeLessThanOrEqual(action.dailyCap);
      expect(action.xp).toBeGreaterThanOrEqual(8);
      expect(action.xp).toBeLessThanOrEqual(40);
      expect(action.maxActs).toBeGreaterThanOrEqual(1);
      if (action.group) expect(GROUP_BY_ID.get(action.group)?.actions).toContain(action.id);
      if (action.factor) {
        expect(action.factor.low).toBeLessThanOrEqual(action.factor.central);
        expect(action.factor.high).toBeGreaterThanOrEqual(action.factor.central);
        expect(action.sources.length).toBeGreaterThan(0);
      }
      for (const key of action.sources) expect(SOURCES[key]).toBeDefined();
      if (action.variants.length > 0) {
        expect(action.variants.map((variant) => variant.id)).toContain(action.defaultVariant);
      }
      for (const preset of action.presets) {
        expect(Number(preset.toFixed(action.decimals))).toBe(preset);
      }
    }
  });

  it('applies the two caps the spec tightens', () => {
    expect(ACTION_BY_ID.get('chicken-instead-of-beef')?.dailyCap).toBe(3);
    expect(ACTION_BY_ID.get('led-bulb-swap')?.dailyCap).toBe(10);
  });

  it('defines the overlap groups with their shared caps', () => {
    const caps = Object.fromEntries(GROUPS.map((group) => [group.id, group.maxActs]));
    expect(caps).toEqual({
      plate: 3,
      'food-rescue': 2,
      laundry: 2,
      'hot-water': 2,
      recycling: 2,
      'single-use': 3,
      'flight-swap': 1,
      secondhand: 2,
      custom: 2,
    });
    expect(GROUP_BY_ID.get('plate')?.actions).toHaveLength(5);
    expect(GROUP_BY_ID.get('recycling')?.actions).toHaveLength(4);
    expect(GROUP_BY_ID.get('laundry')?.unitCap).toBe(3);
  });

  it('ships 45 grid regions with the world average first', () => {
    expect(GRID).toHaveLength(45);
    expect(GRID[0]?.id).toBe('WORLD');
    expect(DEFAULT_REGION).toBe('WORLD');
    expect(GRID_BY_ID.get('WORLD')?.kgCO2ePerKWh).toBe(0.45849);
    for (const region of GRID) {
      expect(region.kgCO2ePerKWh).toBeGreaterThan(0);
      expect(region.kgCO2ePerKWh).toBeLessThan(1);
    }
    expect(new Set(GRID.map((region) => region.id)).size).toBe(45);
  });

  it('carries the reference factors the regional computation quotes', () => {
    expect(REFERENCE_FACTORS.carKgPerKm.default).toBe(0.2099);
    expect(REFERENCE_FACTORS.gasKgPerKWh).toBe(0.21252);
    expect(EVIDENCE_META.factorsVersion).toMatch(/^\d{4}\.\d{2}$/);
  });

  it('ships the baseline model verbatim', () => {
    expect(BASELINE_QUESTIONS.map((question) => question.id)).toEqual([
      'diet',
      'transportMode',
      'weeklyDistance',
      'flights',
      'homeEnergy',
      'shopping',
    ]);
    expect(BASELINE_QUESTIONS.map((question) => question.options.length)).toEqual([
      6, 9, 6, 5, 5, 4,
    ]);
    expect(BASELINE_MODEL.version).toBe(1);
    expect(BASELINE_MODEL.target2030.tonnes).toBe(2.5);
    expect(BASELINE_WORKED_EXAMPLES).toHaveLength(4);
    expect(Object.keys(BASELINE_MODEL.lifestyleFootprints2019)).toHaveLength(10);
  });

  it('ships eight equivalences and never the tree one', () => {
    expect(EQUIVALENCES).toHaveLength(8);
    expect(EQUIVALENCES.map((item) => item.id)).not.toContain('tree-seedling-years');
    for (const item of EQUIVALENCES) {
      expect(item.kgCO2ePerUnit).toBeGreaterThan(0);
      for (const key of item.sources) expect(SOURCES[key]).toBeDefined();
    }
  });

  it('registers every source with a title, a URL and a year', () => {
    expect(Object.keys(SOURCES)).toHaveLength(55);
    for (const source of Object.values(SOURCES)) {
      expect(source.title.length).toBeGreaterThan(5);
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.year).toBeGreaterThan(1990);
    }
  });
});
