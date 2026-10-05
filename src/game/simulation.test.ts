import { describe, expect, it } from 'vitest';
import { xpForLevel } from './levels';
import { gpEarnedOn } from './recap';
import {
  dayOfLevel,
  simulate,
  type PersonaId,
  type SimulationMark,
  type SimulationResult,
} from './simulate';
import { validateState } from './schema';
import { checkInvariants } from './state';

/**
 * Appendix F of the product spec, as printed by the reference script. XP, level, growth
 * points, stage, rings, full rings, streak, rain bank and badge tiers must match exactly;
 * growth within 0.0005; kilograms within 1% (the engine computes from unrounded regional
 * formulas, the reference script from the evidence base's stored per-unit values).
 */
const EXPECTED: Record<PersonaId, Record<number, SimulationMark>> = {
  lazy: {
    1: {
      xp: 70,
      level: 2,
      gp: 13,
      growth: 0.0383,
      stage: 'Sprout',
      rings: 1,
      fullRings: 0,
      streak: 1,
      bestStreak: 1,
      rain: 1,
      kg: 1.5,
      badges: 1,
    },
    7: {
      xp: 128,
      level: 2,
      gp: 39,
      growth: 0.073,
      stage: 'Seedling',
      rings: 3,
      fullRings: 0,
      streak: 1,
      bestStreak: 2,
      rain: 0,
      kg: 2,
      badges: 1,
    },
    30: {
      xp: 472,
      level: 4,
      gp: 169,
      growth: 0.1297,
      stage: 'Sapling',
      rings: 13,
      fullRings: 0,
      streak: 1,
      bestStreak: 2,
      rain: 1,
      kg: 9.6,
      badges: 3,
    },
    365: {
      xp: 4876,
      level: 12,
      gp: 2041,
      growth: 0.6525,
      stage: 'Mature tree',
      rings: 157,
      fullRings: 0,
      streak: 1,
      bestStreak: 2,
      rain: 1,
      kg: 106.4,
      badges: 15,
    },
  },
  typical: {
    1: {
      xp: 120,
      level: 2,
      gp: 24,
      growth: 0.0567,
      stage: 'Sprout',
      rings: 1,
      fullRings: 1,
      streak: 1,
      bestStreak: 1,
      rain: 1,
      kg: 2,
      badges: 1,
    },
    7: {
      xp: 631,
      level: 4,
      gp: 125,
      growth: 0.1094,
      stage: 'Seedling',
      rings: 6,
      fullRings: 3,
      streak: 6,
      bestStreak: 6,
      rain: 1,
      kg: 11.8,
      badges: 4,
    },
    30: {
      xp: 2606,
      level: 9,
      gp: 541,
      growth: 0.3198,
      stage: 'Sapling',
      rings: 26,
      fullRings: 13,
      streak: 26,
      bestStreak: 26,
      rain: 1,
      kg: 51.2,
      badges: 12,
    },
    365: {
      xp: 27947,
      level: 31,
      gp: 6524,
      growth: 0.845,
      stage: 'Grand tree',
      rings: 313,
      fullRings: 157,
      streak: 313,
      bestStreak: 313,
      rain: 1,
      kg: 616.1,
      badges: 30,
    },
  },
  power: {
    1: {
      xp: 385,
      level: 3,
      gp: 30,
      growth: 0.0667,
      stage: 'Sprout',
      rings: 1,
      fullRings: 1,
      streak: 1,
      bestStreak: 1,
      rain: 1,
      kg: 6.3,
      badges: 4,
    },
    7: {
      xp: 2230,
      level: 8,
      gp: 210,
      growth: 0.1507,
      stage: 'Sapling',
      rings: 7,
      fullRings: 7,
      streak: 7,
      bestStreak: 7,
      rain: 2,
      kg: 43.9,
      badges: 12,
    },
    30: {
      xp: 8960,
      level: 17,
      gp: 900,
      growth: 0.4143,
      stage: 'Young tree',
      rings: 30,
      fullRings: 30,
      streak: 30,
      bestStreak: 30,
      rain: 2,
      kg: 188.2,
      badges: 25,
    },
    365: {
      xp: 97090,
      level: 61,
      gp: 10950,
      growth: 0.913,
      stage: 'Elder',
      rings: 365,
      fullRings: 365,
      streak: 365,
      bestStreak: 365,
      rain: 2,
      kg: 2290.1,
      badges: 38,
    },
  },
};

/** "Levels first reached" and "Stages first reached", from the same appendix. */
const FIRST_REACHED: Record<
  PersonaId,
  { levels: Record<number, number | null>; stages: Record<string, number> }
> = {
  lazy: {
    levels: { 2: 1, 5: 50, 10: 244, 15: null },
    stages: { Sprout: 1, Seedling: 6, Sapling: 27, 'Young tree': 108, 'Mature tree': 358 },
  },
  typical: {
    levels: { 2: 1, 5: 8, 10: 34, 15: 82, 20: 149, 25: 233, 30: 333 },
    stages: {
      Sprout: 1,
      Seedling: 2,
      Sapling: 9,
      'Young tree': 33,
      'Mature tree': 111,
      'Grand tree': 251,
    },
  },
  power: {
    levels: { 2: 1, 5: 3, 10: 11, 15: 24, 20: 42, 25: 66, 30: 94 },
    stages: {
      Sprout: 1,
      Seedling: 2,
      Sapling: 5,
      'Young tree': 20,
      'Mature tree': 67,
      'Grand tree': 150,
      Elder: 300,
    },
  },
};

/** "Over 365 days", from the same appendix. */
const YEAR: Record<
  PersonaId,
  { rain: number; missed: number; claims: number; lessons: number; breaks: number }
> = {
  lazy: { rain: 52, missed: 156, claims: 52, lessons: 1, breaks: 0 },
  typical: { rain: 52, missed: 0, claims: 365, lessons: 10, breaks: 52 },
  power: { rain: 0, missed: 0, claims: 1251, lessons: 10, breaks: 365 },
};

const results = new Map<PersonaId, SimulationResult>();
function run(persona: PersonaId): SimulationResult {
  let result = results.get(persona);
  if (!result) {
    result = simulate(persona, 365);
    results.set(persona, result);
  }
  return result;
}

describe.each(['lazy', 'typical', 'power'] as const)('simulation: the %s user', (persona) => {
  it('reproduces the published table at days 1, 7, 30 and 365', { timeout: 120_000 }, () => {
    const { marks } = run(persona);
    for (const [day, expected] of Object.entries(EXPECTED[persona])) {
      const actual = marks[Number(day)];
      const where = `${persona} day ${day}`;
      expect(actual, where).toBeDefined();
      if (!actual) continue;
      const { growth, kg, ...exact } = actual;
      const { growth: expectedGrowth, kg: expectedKg, ...expectedExact } = expected;
      expect(exact, where).toEqual(expectedExact);
      expect(Math.abs(growth - expectedGrowth), `${where} growth`).toBeLessThanOrEqual(0.0005);
      expect(Math.abs(kg - expectedKg) / expectedKg, `${where} kg`).toBeLessThanOrEqual(
        0.01 + 0.05 / expectedKg,
      );
    }
  });

  it('reaches levels and stages on the published days', { timeout: 120_000 }, () => {
    const result = run(persona);
    for (const [level, day] of Object.entries(FIRST_REACHED[persona].levels)) {
      expect(dayOfLevel(result, Number(level)), `${persona} level ${level}`).toBe(day);
    }
    expect(result.stageDays).toEqual(FIRST_REACHED[persona].stages);
  });

  it('matches the year in review and keeps every invariant', { timeout: 120_000 }, () => {
    const { session } = run(persona);
    const { state } = session;
    const marks = Object.values(state.marks);
    expect(marks.filter((mark) => mark === 'rain')).toHaveLength(YEAR[persona].rain);
    expect(marks.filter((mark) => mark === 'missed')).toHaveLength(YEAR[persona].missed);
    expect(state.quests.claims).toHaveLength(YEAR[persona].claims);
    expect(
      Object.values(state.learn.lessons).filter((lesson) => lesson.passedTs !== null),
    ).toHaveLength(YEAR[persona].lessons);
    expect(state.breaks.filter((entry) => entry.kept)).toHaveLength(YEAR[persona].breaks);
    expect(checkInvariants(state)).toEqual([]);
    expect(validateState(JSON.parse(JSON.stringify(state)))).toMatchObject({ ok: true });
    for (const day of Object.keys(state.days))
      expect(gpEarnedOn(state, day)).toBeLessThanOrEqual(30);
  });
});

describe('what the tables say', () => {
  it(
    'never tells the lazy user a streak ended, and keeps the typical streak all year',
    { timeout: 120_000 },
    () => {
      const lazy = run('lazy');
      const rested = lazy.session.eventsOf('streak-rested', lazy.session.all);
      expect(rested).toHaveLength(104);
      expect(rested.filter((event) => event.announced)).toHaveLength(0);
      expect(
        run('typical').session.eventsOf('streak-rested', run('typical').session.all),
      ).toHaveLength(0);
    },
  );

  it('always levels up in the first session and never buys more than one extra level', () => {
    expect(EXPECTED.lazy[1]?.level).toBe(2);
    expect(EXPECTED.power[1]?.xp).toBeLessThan(xpForLevel(4));
  });

  it(
    'leaves every tree unfinished after a year, two stages apart at most',
    { timeout: 120_000 },
    () => {
      for (const persona of ['lazy', 'typical', 'power'] as const) {
        expect(run(persona).marks[365]?.growth).toBeLessThan(0.92);
      }
      const stages = ['Mature tree', 'Grand tree', 'Elder'];
      expect(
        [run('lazy'), run('typical'), run('power')].map((result) => result.marks[365]?.stage),
      ).toEqual(stages);
    },
  );

  it('never lets growth shrink on any day of any year', { timeout: 120_000 }, () => {
    for (const persona of ['lazy', 'typical', 'power'] as const) {
      const growthEvents = run(persona).session.eventsOf('growth', run(persona).session.all);
      expect(growthEvents.length).toBeGreaterThan(100);
      expect(
        growthEvents.every((event) => event.delta > 0 && event.growth > event.previousGrowth),
      ).toBe(true);
    }
  });
});
