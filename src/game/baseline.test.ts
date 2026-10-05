import { describe, expect, it } from 'vitest';
import { BASELINE_WORKED_EXAMPLES, GROUP_BY_ID } from '@/data/catalogue';
import { addDays } from '@/lib/dates';
import {
  baselineReferences,
  baselineSegments,
  biggestLevers,
  buildBaselineResult,
  classifyLog,
  computeBaseline,
  heatFromAnswers,
  isLowFootprint,
  keptActions,
  parseBaselineAnswers,
  suggestFocus,
} from './baseline';
import { allEquivalences, equivalenceFor, pickEquivalences } from './equivalences';
import { computePace, habitsHeld, habitsHeldCopy, paceHeadline, pacePercentLabel } from './pace';
import type { BaselineAnswers, BaselineResult, DayRecord, LogEntry } from './types';

const UK: BaselineAnswers = {
  diet: 'medium-meat',
  transportMode: 'car-alone',
  weeklyDistance: '150-300',
  flights: 'short-1-2',
  homeEnergy: 'gas-typical',
  shopping: 'regular',
};

describe('baseline', () => {
  it('reproduces the four worked examples within 0.05 t', () => {
    expect(BASELINE_WORKED_EXAMPLES.map((example) => example.result.total)).toEqual([
      7.8, 2.9, 15.7, 1.2,
    ]);
    for (const example of BASELINE_WORKED_EXAMPLES) {
      const tonnes = computeBaseline(example.answers, example.region);
      for (const key of ['food', 'transport', 'flights', 'home', 'stuff', 'total'] as const) {
        expect(
          Math.abs(tonnes[key] - example.result[key]),
          `${example.region} ${key}`,
        ).toBeLessThan(0.05);
      }
    }
  });

  it('sums its five segments', () => {
    const tonnes = computeBaseline(UK, 'GB');
    expect(tonnes.total).toBeCloseTo(
      tonnes.food + tonnes.transport + tonnes.flights + tonnes.home + tonnes.stuff,
      12,
    );
    expect(tonnes.transport).toBeCloseTo((220 * 52 * 0.2099) / 1000, 10);
  });

  it('uses regional vehicles and the grid for electric modes', () => {
    const us = computeBaseline({ ...UK, transportMode: 'car-alone' }, 'US');
    expect(us.transport).toBeCloseTo((220 * 52 * 0.2442) / 1000, 10);
    const ev = computeBaseline({ ...UK, transportMode: 'car-electric' }, 'FR');
    expect(ev.transport).toBeCloseTo((220 * 52 * 0.20358 * 0.04145) / 1000, 10);
    const scooter = computeBaseline({ ...UK, transportMode: 'motorbike' }, 'IN');
    expect(scooter.transport).toBeCloseTo((220 * 52 * 0.0368) / 1000, 10);
  });

  it('rejects incomplete or unknown answers', () => {
    expect(parseBaselineAnswers(UK)).toEqual(UK);
    expect(parseBaselineAnswers({ ...UK, diet: 'carnivore' })).toBeNull();
    expect(parseBaselineAnswers({ diet: 'vegan' })).toBeNull();
    expect(parseBaselineAnswers(null)).toBeNull();
    expect(parseBaselineAnswers('vegan')).toBeNull();
  });

  it('orders segments and names the two biggest levers', () => {
    const tonnes = computeBaseline(UK, 'GB');
    expect(baselineSegments(tonnes).map((item) => item.segment)).toEqual([
      'food',
      'transport',
      'home',
      'stuff',
      'flights',
    ]);
    expect(biggestLevers(tonnes).map((item) => item.label)).toEqual(['Food', 'Getting around']);
    const shares = baselineSegments(tonnes).reduce((sum, item) => sum + item.share, 0);
    expect(shares).toBeCloseTo(1, 12);
  });

  it('suggests focus areas from the ranking', () => {
    expect(suggestFocus(null)).toEqual(['eat', 'move']);
    expect(suggestFocus(computeBaseline(UK, 'GB'))).toEqual(['eat', 'move']);
    const homeHeavy = computeBaseline({ ...UK, diet: 'vegan', homeEnergy: 'very-high' }, 'IN');
    expect(suggestFocus(homeHeavy)).toEqual(['power', 'water']);
    const flyer = computeBaseline({ ...UK, flights: 'long-3-plus' }, 'GB');
    expect(suggestFocus(flyer)).toEqual(['move', 'eat']);
    const light = computeBaseline(
      {
        diet: 'vegan',
        transportMode: 'walk-cycle',
        weeklyDistance: 'under-25',
        flights: 'none',
        homeEnergy: 'minimal',
        shopping: 'minimal',
      },
      'WORLD',
    );
    expect(isLowFootprint(light)).toBe(true);
    expect(suggestFocus(light)).toEqual(['eat', 'power', 'nature']);
    for (const focus of [suggestFocus(homeHeavy), suggestFocus(light), suggestFocus(flyer)]) {
      expect(new Set(focus).size).toBe(focus.length);
      expect(focus.length).toBeLessThanOrEqual(3);
    }
  });

  it('prefills the heat source from the home answer', () => {
    expect(heatFromAnswers(UK)).toBe('gas');
    expect(heatFromAnswers({ ...UK, homeEnergy: 'electric-typical' })).toBe('electric');
    expect(heatFromAnswers({ ...UK, homeEnergy: 'minimal' })).toBe('unknown');
  });

  it('tags habits the quiz already knows about as keeps', () => {
    const result = (answers: BaselineAnswers): BaselineResult =>
      buildBaselineResult(answers, 'GB', '2026-10-06');
    expect(classifyLog('plant-based-meal', true, null)).toBe('unrated');
    expect(classifyLog('plant-based-meal', true, result(UK))).toBe('swap');
    expect(classifyLog('litter-pick', false, result(UK))).toBe('unrated');
    const vegan = result({ ...UK, diet: 'vegan' });
    for (const id of GROUP_BY_ID.get('plate')?.actions ?? []) {
      expect(classifyLog(id, true, vegan)).toBe('keep');
    }
    expect(classifyLog('plant-milk-instead-of-dairy', true, vegan)).toBe('keep');
    expect(
      classifyLog('plant-milk-instead-of-dairy', true, result({ ...UK, diet: 'vegetarian' })),
    ).toBe('swap');
    const pescatarian = keptActions({ ...UK, diet: 'pescatarian' });
    expect(pescatarian.has('chicken-instead-of-beef')).toBe(true);
    expect(pescatarian.has('plant-based-meal')).toBe(false);
    const cyclist = keptActions({ ...UK, transportMode: 'walk-cycle', flights: 'none' });
    expect(cyclist.has('bus-instead-of-car')).toBe(true);
    expect(cyclist.has('work-from-home-day')).toBe(true);
    expect(cyclist.has('train-instead-of-short-flight-trip')).toBe(true);
    expect(cyclist.has('ev-instead-of-petrol-car')).toBe(false);
    expect(keptActions({ ...UK, transportMode: 'car-shared' }).has('carpool')).toBe(true);
    expect(keptActions({ ...UK, transportMode: 'car-electric' })).toContain(
      'ev-instead-of-petrol-car',
    );
    expect(keptActions({ ...UK, shopping: 'minimal' })).toContain('repair-instead-of-replace');
    expect(keptActions(UK).size).toBe(0);
  });

  it('offers a country tick only where a comparable figure exists', () => {
    expect(baselineReferences('GB', 'United Kingdom')).toHaveLength(2);
    expect(baselineReferences('GB', 'United Kingdom')[1]?.tonnes).toBe(8.5);
    expect(baselineReferences('US', 'United States')).toHaveLength(1);
    expect(baselineReferences('WORLD', 'World')[0]?.tonnes).toBe(2.5);
  });
});

// ── Pace ────────────────────────────────────────────────────────────────────
const TODAY = '2026-10-06';
const day = (offset: number) => addDays(TODAY, offset);

function makeLog(offset: number, over: Partial<LogEntry> = {}): LogEntry {
  return {
    id: `l${offset}-${over.actionId ?? 'meal'}`,
    ts: 0,
    day: day(offset),
    tzOffsetMin: 0,
    actionId: 'plant-based-meal',
    variant: null,
    title: 'Plant-based meal',
    emoji: '🌱',
    category: 'eat',
    qty: 1,
    unit: 'meal',
    co2eKg: 1.52,
    kgLow: 0.97,
    kgHigh: 2.6,
    estimate: 'factor',
    factorsVersion: '2026.10',
    kind: 'swap',
    cadence: 'recurring',
    rewardedActs: 1,
    xp: 15,
    gp: 5,
    source: 'log',
    effort: null,
    ...over,
  };
}

const dayRecord: DayRecord = {
  checkInTs: 0,
  ringClosed: false,
  cleanSweep: false,
  breakRewarded: false,
  journalRewarded: false,
  returnedFrom: null,
  ringCelebrated: false,
  ringRain: 'none',
};

function activeDays(offsets: number[]): Record<string, DayRecord> {
  return Object.fromEntries(offsets.map((offset) => [day(offset), dayRecord]));
}

const baseline = buildBaselineResult(UK, 'GB', day(-40));
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('pace', () => {
  it('needs a baseline', () => {
    expect(computePace({ baseline: null, logs: [], days: {} }, TODAY)).toEqual({
      status: 'no-baseline',
    });
    expect(paceHeadline({ status: 'no-baseline' })).toMatch(/starting-line quiz/);
  });

  it('waits for two weeks and seven active days', () => {
    const young = computePace(
      { baseline, logs: range(-9, 0).map((o) => makeLog(o)), days: activeDays(range(-9, 0)) },
      TODAY,
    );
    expect(young).toMatchObject({ status: 'not-enough-data', spanDays: 10 });
    const sparse = computePace(
      { baseline, logs: [makeLog(-20), makeLog(0)], days: activeDays([-20, -10, 0]) },
      TODAY,
    );
    expect(sparse).toMatchObject({ status: 'not-enough-data', activeDays: 3 });
    expect(paceHeadline(sparse)).toBe(
      'Two weeks of logs and this card wakes up. 3 of 7 active days so far.',
    );
  });

  it('annualises recurring swaps over the window', () => {
    const offsets = range(-27, 0);
    const result = computePace(
      { baseline, logs: offsets.map((o) => makeLog(o)), days: activeDays(offsets) },
      TODAY,
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.windowDays).toBe(28);
    expect(result.recurringKg).toBeCloseTo(28 * 1.52, 10);
    expect(result.paceKg).toBeCloseTo(365 * 1.52, 8);
    expect(result.pacePct).toBeCloseTo((365 * 1.52) / (baseline.tonnes.total * 1000), 10);
    expect(paceHeadline(result)).toBe(
      "At your last 4 weeks' pace, the actions you log would avoid ≈ 550 kg CO2e a year — about 7% of your starting line (≈ 7.8 t).",
    );
  });

  it('never annualises an occasional log', () => {
    const offsets = range(-20, 0);
    const flight = makeLog(-3, {
      actionId: 'train-instead-of-short-flight-trip',
      co2eKg: 54.2,
      cadence: 'occasional',
    });
    const old = makeLog(-200, {
      actionId: 'repair-instead-of-replace',
      co2eKg: 7,
      cadence: 'occasional',
    });
    const ancient = makeLog(-400, {
      actionId: 'second-hand-jeans',
      co2eKg: 12.9,
      cadence: 'occasional',
    });
    const result = computePace(
      { baseline, logs: [ancient, old, flight], days: activeDays(offsets) },
      TODAY,
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.recurringKg).toBe(0);
    expect(result.occasionalKg).toBeCloseTo(61.2, 10);
    expect(result.paceKg).toBeCloseTo(61.2, 10);
  });

  it('counts only factor-based swaps', () => {
    const offsets = range(-27, 0);
    const logs = [
      makeLog(-27),
      makeLog(-5, { kind: 'keep' }),
      makeLog(-4, { kind: 'unrated' }),
      makeLog(-3, { estimate: 'ai', co2eKg: 2 }),
      makeLog(-2, { estimate: 'none', co2eKg: null }),
      makeLog(-40),
    ].sort((a, b) => (a.day < b.day ? -1 : 1));
    const result = computePace({ baseline, logs, days: activeDays(offsets) }, TODAY);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.recurringKg).toBeCloseTo(1.52, 10);
  });

  it('words the percentage honestly', () => {
    expect(pacePercentLabel(0.004)).toBe('under 1%');
    expect(pacePercentLabel(0.064)).toBe('6%');
    expect(pacePercentLabel(0.5)).toBe('50%');
    expect(pacePercentLabel(0.51)).toBeNull();
    const big = paceHeadline({
      status: 'ok',
      paceKg: 5000,
      pacePct: 0.64,
      windowDays: 28,
      recurringKg: 0,
      occasionalKg: 0,
      baselineTonnes: 7.8,
    });
    expect(big).toMatch(/more than half/);
    expect(big).not.toMatch(/5,000|64%/);
  });

  it('reports habits held separately from new cuts', () => {
    const logs = [
      makeLog(-30, { kind: 'keep' }),
      makeLog(-10, { kind: 'keep', rewardedActs: 2, co2eKg: 3.04 }),
      makeLog(-1, { kind: 'keep', rewardedActs: 0 }),
      makeLog(0),
    ];
    const held = habitsHeld(logs, TODAY);
    expect(held.acts).toBe(3);
    expect(held.kg).toBeCloseTo(4.56, 10);
    expect(habitsHeldCopy(held)).toMatch(/^Habits you're holding: 3 acts this month, ≈ 4.6 kg/);
  });
});

describe('equivalences', () => {
  it('compares a mass with everyday things, scaled by the grid where it applies', () => {
    expect(equivalenceFor('car-km', 10, 'WORLD')?.amount).toBeCloseTo(10 / 0.2099, 8);
    expect(equivalenceFor('smartphone-charges', 1, 'WORLD')?.amount).toBeCloseTo(
      1 / (0.019 * 0.45849),
      6,
    );
    expect(equivalenceFor('smartphone-charges', 1, 'FR')?.amount).toBeGreaterThan(1000);
    expect(equivalenceFor('daily-1p5-budget', 3.4245, 'WORLD')?.amount).toBeCloseTo(50, 6);
    expect(equivalenceFor('daily-1p5-budget', 3.4245, 'WORLD')?.short).toBe(
      "≈ 50% of one day's 1.5 °C lifestyle budget",
    );
    expect(equivalenceFor('daily-1p5-budget', 20.547, 'WORLD')?.text).toBe(
      'That is roughly 3 days of a 1.5 °C lifestyle budget (≈ 6.85 kg a day).',
    );
    expect(equivalenceFor('beef-grams', 250, 'WORLD')?.short).toBe('≈ 3.8 kg of beef');
    expect(equivalenceFor('tree-seedling-years', 10, 'WORLD')).toBeNull();
    expect(equivalenceFor('car-km', 0, 'WORLD')).toBeNull();
  });

  it('phrases every one as a comparison, never an outcome', () => {
    const all = allEquivalences(48, 'WORLD');
    expect(all).toHaveLength(8);
    for (const item of all) {
      expect(item.text).toMatch(/^That is roughly /);
      expect(item.short).toMatch(/^≈ /);
      expect(item.text).not.toMatch(/you (saved|planted|offset)/i);
    }
    expect(equivalenceFor('car-km', 48, 'WORLD')?.text).toBe(
      'That is roughly the CO2 from 229 km driven in an average car.',
    );
  });

  it('picks two whose amount lands between 1 and 999', () => {
    expect(pickEquivalences(0.05, 'WORLD')[0]?.id).toBe('smartphone-charges');
    for (const kg of [0.4, 2, 11, 48, 250, 616, 2290]) {
      const picked = pickEquivalences(kg, 'WORLD');
      expect(picked).toHaveLength(2);
      for (const item of picked) {
        expect(item.amount, `${kg} kg ${item.id}`).toBeGreaterThanOrEqual(1);
        expect(item.amount, `${kg} kg ${item.id}`).toBeLessThanOrEqual(999);
      }
    }
    expect(pickEquivalences(0, 'WORLD')).toEqual([]);
    expect(pickEquivalences(1e9, 'WORLD')).toHaveLength(2);
  });
});
