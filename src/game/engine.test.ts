import { describe, expect, it, vi } from 'vitest';
import { ACTIONS } from '@/data/catalogue';
import { addDays, weekKey } from '@/lib/dates';
import { createRng, randomInt } from '@/lib/rng';
import { claimQuest } from './quests';
import { addPost } from './community';
import {
  clearBaseline,
  devGrantGp,
  devGrantXp,
  devUnlockBadge,
  dismissNotice,
  markCoachMarksSeen,
  markRecapSeen,
  normalizeFocus,
  plantTree,
  setActionHidden,
  setBaseline,
  setOnboardingStep,
  tick,
  transact,
  updateProfile,
  updateSettings,
  water,
} from './engine';
import { createEventBus, worldPulsesFor, type GameEvent } from './events';
import { growthOf } from './growth';
import { replayLegacy, scanLegacy } from './legacy';
import { completeLesson } from './lessons';
import { levelOf } from './levels';
import { logAction, removeLog } from './logging';
import { gpEarnedOn, quietWeekCopy, recapToShow, recapWeeks, weekRecap } from './recap';
import { validateState } from './schema';
import { checkInvariants, createInitialState, isOnboarded } from './state';
import { GameSession, TEST_SEED, localTime, plantedSession } from './testkit';
import { finishBreak, signalBreak, startBreak } from './touchGrass';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);

const UK = {
  diet: 'medium-meat',
  transportMode: 'car-alone',
  weeklyDistance: '150-300',
  flights: 'short-1-2',
  homeEnergy: 'gas-typical',
  shopping: 'regular',
};

describe('transactions', () => {
  it('returns the very same state when nothing changed', () => {
    const session = plantedSession(noon(0));
    const state = session.state;
    expect(tick(state, noon(0) + 5000).state).toBe(state);
    expect(transact(state, noon(0) + 5000, (ctx) => water(ctx)).state).toBe(state);
    expect(
      transact(state, noon(0) + 5000, (ctx) => updateSettings(ctx, { sound: true })).state,
    ).toBe(state);
  });

  it('shares every slice an operation did not touch', () => {
    const session = plantedSession(noon(0));
    const before = session.state;
    session.at(noon(0) + 1000, (ctx) => updateSettings(ctx, { sound: false }));
    const after = session.state;
    expect(after).not.toBe(before);
    expect(after.settings).not.toBe(before.settings);
    for (const key of [
      'profile',
      'tree',
      'streak',
      'rain',
      'logs',
      'marks',
      'days',
      'quests',
      'badges',
      'learn',
    ] as const) {
      expect(after[key]).toBe(before[key]);
    }
    expect(after.clock.lastEventTs).toBe(noon(0) + 1000);
  });

  it('never mutates the state it was given', () => {
    const session = plantedSession(noon(0));
    const frozen = structuredClone(session.state);
    const deepFreeze = (value: unknown): void => {
      if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
      Object.freeze(value);
      Object.values(value).forEach(deepFreeze);
    };
    deepFreeze(session.state);
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }));
    session.at(noon(0) + 2000, (ctx) =>
      addPost(ctx, { text: 'A note that is certainly long enough.' }),
    );
    deepFreeze(session.state);
    session.at(noon(3), (ctx) => logAction(ctx, { actionId: 'bus-instead-of-car' }));
    session.at(noon(3) + 1000, (ctx) => removeLog(ctx, session.state.logs[0]?.id ?? ''));
    expect(structuredClone(plantedSession(noon(0)).state)).toEqual(frozen);
  });

  it('is deterministic: the same events give the same state', () => {
    const play = () => {
      const session = plantedSession(noon(0));
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 2 }));
      session.at(noon(1), (ctx) => completeLesson(ctx, 'the-blanket', 3));
      session.at(noon(4), (ctx) =>
        logAction(ctx, { actionId: 'carpool', qty: 12, inputs: { people: 4 } }),
      );
      session.at(noon(4) + 1000, (ctx) =>
        claimQuest(ctx, session.state.quests.daily?.slots[0] ?? ''),
      );
      return session.state;
    };
    expect(play()).toEqual(play());
  });

  it('holds every invariant through a year of random play', { timeout: 60_000 }, () => {
    const rng = createRng('engine-fuzz', 7);
    const session = plantedSession(noon(0));
    for (let offset = 0; offset < 365; offset += 1) {
      if (rng() < 0.25) continue;
      const count = randomInt(rng, 0, 9);
      for (let index = 0; index < count; index += 1) {
        const action = ACTIONS[randomInt(rng, 0, ACTIONS.length - 1)];
        if (!action) continue;
        session.at(noon(offset) + index * 3000, (ctx) =>
          logAction(ctx, {
            actionId: action.id,
            qty: action.presets[randomInt(rng, 0, action.presets.length - 1)],
          }),
        );
        if (rng() < 0.15) {
          const last = session.state.logs[randomInt(rng, 0, session.state.logs.length - 1)];
          if (last) session.at(noon(offset) + index * 3000 + 500, (ctx) => removeLog(ctx, last.id));
        }
      }
      if (rng() < 0.5) session.at(noon(offset) + 40_000, water);
      for (const id of session.state.quests.daily?.slots ?? []) {
        session.at(noon(offset) + 50_000, (ctx) => claimQuest(ctx, id));
      }
      for (const id of session.state.quests.weekly?.slots ?? []) {
        session.at(noon(offset) + 51_000, (ctx) => claimQuest(ctx, id));
      }
      if (rng() < 0.1) {
        session.at(noon(offset) + 60_000, (ctx) => startBreak(ctx, 10));
        session.at(noon(offset) + 61_000, (ctx) => signalBreak(ctx, 'hidden'));
        session.at(noon(offset) + 60_000 + 11 * 60_000, (ctx) => finishBreak(ctx, 'outside'));
      }
      expect(checkInvariants(session.state), `day ${offset}`).toEqual([]);
    }
    // Whatever a year of play produces must still be a save the app accepts.
    expect(validateState(JSON.parse(JSON.stringify(session.state)))).toMatchObject({ ok: true });
    expect(session.state.notices.length).toBeLessThanOrEqual(12);
    expect(session.state.xp).toBeGreaterThan(5000);
    expect(session.state.logs.length).toBeGreaterThan(500);
    for (const entry of Object.keys(session.state.days)) {
      expect(gpEarnedOn(session.state, entry)).toBeLessThanOrEqual(30);
    }
  });

  it('never lets growth fall through absence, only through removing logs', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }));
    let previous = growthOf(session.state.tree.gp);
    for (const offset of [1, 2, 9, 30, 31, 200, 800]) {
      session.tick(noon(offset));
      expect(growthOf(session.state.tree.gp)).toBe(previous);
      session.at(noon(offset) + 1000, water);
      expect(growthOf(session.state.tree.gp)).toBeGreaterThan(previous);
      previous = growthOf(session.state.tree.gp);
    }
  });
});

describe('profile and settings', () => {
  it('validates before changing anything', () => {
    const session = plantedSession(noon(0));
    const before = session.state;
    const bad: [Parameters<typeof updateProfile>[1], string][] = [
      [{ treeName: '   ' }, 'tree-name-required'],
      [{ species: 'baobab' as 'oak' }, 'unknown-species'],
      [{ region: 'ATLANTIS' }, 'unknown-region'],
      [{ heat: 'coal' as 'gas' }, 'invalid-heat'],
      [{ units: 'cubits' as 'metric' }, 'invalid-units'],
      [{ focus: [] }, 'invalid-focus'],
      [{ name: 'Okay', focus: ['nope' as 'eat'] }, 'invalid-focus'],
    ];
    for (const [patch, reason] of bad) {
      expect(session.at(noon(0) + 1000, (ctx) => updateProfile(ctx, patch))).toMatchObject({
        ok: false,
        reason,
      });
      expect(session.state).toBe(before);
    }
  });

  it('cleans names and keeps growth, rings and the seed when re-planting', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) =>
      updateProfile(ctx, {
        name: '   ',
        treeName: '  Juniper   the   Magnificent Tree ',
        species: 'pine',
        region: 'IN',
        heat: 'electric',
        units: 'imperial',
        focus: ['water', 'water', 'power', 'stuff', 'move'],
      }),
    );
    expect(session.state.profile).toMatchObject({
      name: 'Friend',
      treeName: 'Juniper the Magn',
      species: 'pine',
      region: 'IN',
      heat: 'electric',
      units: 'imperial',
      focus: ['water', 'power', 'stuff'],
      userSeed: TEST_SEED,
      plantedDay: MON,
    });
    expect(session.state.tree).toMatchObject({ gp: 8, rings: 1 });
    expect(session.eventsOf('focus-changed')).toEqual([
      { type: 'focus-changed', focus: ['water', 'power', 'stuff'] },
    ]);
    expect(normalizeFocus(['eat', 'eat', 7, 'nope'])).toEqual(['eat']);
    expect(normalizeFocus([])).toBeNull();
  });

  it('applies settings instantly and ignores unknown values', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) =>
      updateSettings(ctx, {
        sound: false,
        haptics: false,
        motion: 'reduced',
        graphics: 'off',
        sky: 'day',
        celebrations: 'subtle',
        shareStatsWithCoach: false,
      }),
    );
    expect(session.state.settings).toMatchObject({
      sound: false,
      haptics: false,
      motion: 'reduced',
      graphics: 'off',
      sky: 'day',
      celebrations: 'subtle',
      shareStatsWithCoach: false,
    });
    const settings = session.state.settings;
    session.at(noon(0) + 2000, (ctx) =>
      updateSettings(ctx, {
        motion: 'wobbly',
        graphics: 'ultra',
        sky: 'night',
      } as unknown as Parameters<typeof updateSettings>[1]),
    );
    expect(session.state.settings).toBe(settings);
  });

  it('hides and shows actions', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => setActionHidden(ctx, 'thermostat-down-1c', true));
    session.at(noon(0) + 2000, (ctx) => setActionHidden(ctx, 'thermostat-down-1c', true));
    expect(session.state.settings.hiddenActions).toEqual(['thermostat-down-1c']);
    session.at(noon(0) + 3000, (ctx) => setActionHidden(ctx, 'thermostat-down-1c', false));
    expect(session.state.settings.hiddenActions).toEqual([]);
    session.at(noon(0) + 4000, (ctx) => updateSettings(ctx, { hiddenActions: ['a', 'a', 'b'] }));
    expect(session.state.settings.hiddenActions).toEqual(['a', 'b']);
  });
});

describe('onboarding', () => {
  it('saves progress per step and plants exactly once', () => {
    const session = new GameSession(createInitialState(noon(0)));
    session.at(noon(0), (ctx) => setOnboardingStep(ctx, 3));
    session.at(noon(0), (ctx) => updateProfile(ctx, { name: 'Priya', region: 'GB' }));
    expect(session.state.onboarding.step).toBe(3);
    expect(isOnboarded(session.state)).toBe(false);
    expect(session.at(noon(0), water)).toBe(false);
    expect(
      session.at(noon(0), (ctx) => plantTree(ctx, { treeName: '', species: 'oak', userSeed: 5 })),
    ).toMatchObject({
      ok: false,
      reason: 'tree-name-required',
    });
    expect(isOnboarded(session.state)).toBe(false);

    const planted = session.at(noon(0) + 1000, (ctx) =>
      plantTree(ctx, {
        treeName: 'Sol',
        species: 'cherry',
        userSeed: 4_294_967_295,
        baselineAnswers: UK,
        focus: ['power'],
      }),
    );
    expect(planted).toEqual({ ok: true });
    expect(session.state.profile).toMatchObject({
      name: 'Priya',
      treeName: 'Sol',
      species: 'cherry',
      region: 'GB',
      userSeed: 4_294_967_295,
      focus: ['power'],
      heat: 'gas',
    });
    expect(session.state.onboarding).toMatchObject({ step: 8, completedAt: noon(0) + 1000 });
    expect(session.state.baseline.current?.tonnes.total).toBeCloseTo(7.76, 1);
    expect(session.state.xp).toBe(35 + 20);
    expect(session.state.badges.rooted?.tier).toBe(1);
    expect(session.eventsOf('stage-up')[0]).toMatchObject({ stage: 'Sprout', first: true });
    expect(worldPulsesFor(session.last)).toEqual([
      { kind: 'plant' },
      { kind: 'badge' },
      { kind: 'celebrate' },
    ]);

    const again = session.at(noon(0) + 2000, (ctx) =>
      plantTree(ctx, { treeName: 'Other', species: 'oak', userSeed: 1 }),
    );
    expect(again).toMatchObject({ ok: false, reason: 'already-onboarded' });
    expect(session.state.profile.treeName).toBe('Sol');
    expect(session.state.xp).toBe(55);
    session.at(noon(0) + 3000, markCoachMarksSeen);
    expect(session.state.onboarding.coachMarksSeen).toBe(true);
  });

  it('applies rest days at once before the tree exists', () => {
    const session = new GameSession(createInitialState(noon(0)));
    session.at(noon(0), (ctx) => updateSettings(ctx, { restDays: [6, 0] }));
    expect(session.state.settings).toMatchObject({ restDays: [0, 6], restDaysPending: null });
  });
});

describe('baseline', () => {
  it('keeps retakes as a dated history and never rewrites old logs', () => {
    const session = plantedSession(noon(0));
    const first = session.at(noon(0) + 1000, (ctx) => setBaseline(ctx, UK, { useAsFocus: true }));
    expect(first).toMatchObject({ ok: true, suggestedFocus: ['eat', 'move'] });
    const log = session.at(noon(0) + 2000, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal' }),
    );
    session.at(noon(5), (ctx) => setBaseline(ctx, { ...UK, diet: 'vegan' }));
    expect(session.eventsOf('baseline-set')[0]).toMatchObject({ first: false });
    expect(session.state.baseline.history).toHaveLength(1);
    expect(session.state.baseline.history[0]?.answers.diet).toBe('medium-meat');
    expect(session.state.baseline.current?.takenDay).toBe(day(5));
    expect(log.ok && session.state.logs[0]?.kind).toBe('swap');
    expect(session.at(noon(5), (ctx) => setBaseline(ctx, { diet: 'vegan' }))).toEqual({
      ok: false,
      reason: 'incomplete-answers',
    });
    session.at(noon(6), clearBaseline);
    expect(session.state.baseline).toEqual({ current: null, history: [] });
    expect(session.state.badges.rooted?.tier).toBe(1);
  });
});

describe('notices and recap', () => {
  it('shows a notice once and never again', () => {
    const session = plantedSession(noon(0));
    session.tick(noon(2));
    const notice = session.state.notices[0];
    expect(notice?.kind).toBe('rain-return');
    expect(session.eventsOf('notice')).toHaveLength(1);
    session.at(noon(2) + 1000, (ctx) => dismissNotice(ctx, notice?.id ?? ''));
    expect(session.state.notices).toEqual([]);
    expect(session.state.seen.messages).toContain(notice?.id);
    session.at(noon(2) + 2000, (ctx) => dismissNotice(ctx, 'never-existed'));
    expect(session.state.seen.messages).toHaveLength(1);
  });

  it('merges unread auto-claim summaries instead of stacking them', () => {
    const session = plantedSession(noon(0));
    for (let offset = 0; offset < 30; offset += 1) {
      session.at(noon(offset) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }),
      );
      session.at(noon(offset) + 5000, (ctx) =>
        logAction(ctx, { actionId: 'bus-instead-of-car', qty: 5 }),
      );
    }
    session.tick(noon(30));
    const summaries = session.state.notices.filter((notice) => notice.kind === 'auto-claimed');
    expect(summaries).toHaveLength(1);
    const autoClaims = session.state.quests.claims.filter((claim) => claim.auto);
    expect(autoClaims.length).toBeGreaterThan(10);
    expect(summaries[0]?.data).toEqual({
      count: autoClaims.length,
      xp: autoClaims.reduce((sum, claim) => sum + claim.xp, 0),
    });
    expect(session.state.notices.length).toBeLessThanOrEqual(12);
  });

  it('summarises a week from stored events', () => {
    const session = plantedSession(noon(0));
    for (const offset of [0, 1, 3]) {
      session.at(noon(offset) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }),
      );
      session.at(noon(offset) + 5000, (ctx) =>
        logAction(ctx, { actionId: 'bus-instead-of-car', qty: 5 }),
      );
    }
    session.at(noon(4), water);
    session.tick(noon(8));
    const recap = weekRecap(session.state, weekKey(MON), day(8));
    expect(recap).toMatchObject({
      week: 'W2026-10-05',
      monday: MON,
      sunday: day(6),
      rings: 4,
      fullRings: 3,
      logs: 6,
      acts: 12,
      topCategory: 'eat',
      previousKg: null,
      minutesOutside: 0,
      empty: false,
      stageBefore: 'Seed',
      stageAfter: 'Seedling',
    });
    expect(recap.kg).toBeCloseTo(3 * (3 * 1.52 + 5 * 0.0819), 8);
    expect(recap.gpGained).toBe(session.state.tree.gp);
    expect(recap.strip.map((entry) => entry.mark)).toEqual([
      'full',
      'full',
      'rain',
      'full',
      'ring',
      'missed',
      'missed',
    ]);
    const next = weekRecap(session.state, weekKey(day(7)), day(8));
    expect(next).toMatchObject({ empty: true, gpGained: 0 });
    expect(next.previousKg).toBeCloseTo(recap.kg, 8);
    expect(quietWeekCopy('Fern')).toBe(
      'Quiet week. Fern waited. Here are three easy ways back in.',
    );
  });

  it('offers last week once, never a week before planting', () => {
    const session = plantedSession(noon(0));
    expect(recapToShow(session.state, day(3))).toBeNull();
    expect(recapToShow(session.state, day(7))).toBe('W2026-10-05');
    session.at(noon(7), (ctx) => markRecapSeen(ctx, 'W2026-10-05'));
    expect(recapToShow(session.state, day(8))).toBeNull();
    expect(recapToShow(session.state, day(14))).toBe('W2026-10-12');
    expect(recapWeeks(session.state, day(15))).toEqual(['W2026-10-12', 'W2026-10-05']);
    expect(recapToShow(createInitialState(noon(0)), day(7))).toBeNull();
  });
});

describe('legacy import', () => {
  const NOW = noon(0);
  const ts = (offset: number, hour = 10) => localTime(addDays(MON, offset), hour);
  const seeded = [
    { id: '1', type: 'Recycled Glass', co2Impact: 0.5, xpReward: 50, date: 'Oct 24', icon: '♻️' },
    { id: '2', type: 'Biked to Work', co2Impact: 2.4, xpReward: 120, date: 'Oct 23', icon: '🚲' },
    { id: '3', type: 'Meat-free Meal', co2Impact: 1.2, xpReward: 80, date: 'Oct 22', icon: '🥗' },
  ];
  const stats = JSON.stringify({
    xp: 4250,
    level: 5,
    co2Saved: 45.2,
    streak: 12,
    badges: ['Eco-Warrior'],
  });
  const storage = (logs: unknown) => (key: string) =>
    key === 'userStats'
      ? stats
      : key === 'actionLogs'
        ? typeof logs === 'string'
          ? logs
          : JSON.stringify(logs)
        : null;

  it('finds nothing when the old keys are absent', () => {
    expect(scanLegacy(() => null, NOW)).toEqual({ status: 'none', logs: [], skipped: 0, raw: {} });
  });

  it('treats the three seeded logs as placeholders', () => {
    const scan = scanLegacy(storage(seeded), NOW);
    expect(scan.status).toBe('seed-only');
    expect(scan.logs).toEqual([]);
    expect(scan.skipped).toBe(3);
    expect(Object.keys(scan.raw).sort()).toEqual(['actionLogs', 'userStats']);
  });

  it('keeps only real, plausible entries and survives broken data', () => {
    const scan = scanLegacy(
      storage([
        ...seeded,
        { id: String(ts(-3)), type: 'Veggie Meal', co2Impact: 1.5, xpReward: 30 },
        { id: String(ts(-9)), type: 'Recycled' },
        { id: String(ts(5)), type: 'From the future' },
        { id: String(new Date(2023, 5, 1).getTime()), type: 'Too old' },
        { id: 'abc', type: 'Veggie Meal' },
        { id: String(ts(-2)), type: '' },
        null,
        'nonsense',
      ]),
      NOW,
    );
    expect(scan.status).toBe('real');
    expect(scan.logs.map((log) => log.type)).toEqual(['Recycled', 'Veggie Meal']);
    expect(scan.skipped).toBe(9);
    expect(scanLegacy(storage('{not json'), NOW).status).toBe('seed-only');
    expect(scanLegacy(storage('{"a":1}'), NOW).status).toBe('seed-only');
    const throwing = scanLegacy(() => {
      throw new Error('blocked');
    }, NOW);
    expect(throwing.status).toBe('none');
  });

  it('replays real logs through today’s rules without importing a single old number', () => {
    const logs = [
      { id: String(ts(-9, 9)), type: 'Recycled' },
      { id: String(ts(-9, 10)), type: 'Veggie Meal' },
      { id: String(ts(-9, 11)), type: 'Public Transport' },
      { id: String(ts(-8)), type: 'Cold Wash' },
      { id: String(ts(-3)), type: 'Planted basil on the balcony' },
      { id: String(ts(-3, 11)), type: 'Thrifting' },
      ...Array.from({ length: 6 }, (_, index) => ({
        id: String(ts(-1, 8) + index * 60_000),
        type: 'Refill Bottle',
      })),
    ];
    const scan = scanLegacy(storage([...seeded, ...logs]), NOW);
    const replayed = replayLegacy(createInitialState(NOW), scan, NOW);
    const session = new GameSession(replayed);
    const planted = session.at(NOW + 1000, (ctx) =>
      plantTree(ctx, { treeName: 'Fern', species: 'oak', userSeed: 9 }),
    );
    expect(planted.ok).toBe(true);
    const state = session.state;

    expect(state.onboarding.legacy).toBe('imported');
    expect(state.profile.plantedDay).toBe(day(-9));
    expect(state.logs).toHaveLength(12);
    for (const log of state.logs) {
      expect(log).toMatchObject({
        co2eKg: null,
        kgLow: null,
        kgHigh: null,
        estimate: 'none',
        source: 'legacy',
        kind: 'unrated',
        qty: 1,
      });
    }
    expect(state.logs.map((log) => log.actionId).slice(0, 6)).toEqual([
      'recycle-plastic-bottle',
      'plant-based-meal',
      'bus-instead-of-car',
      'wash-cold-instead-of-40',
      'custom',
      'second-hand-tshirt',
    ]);
    expect(state.logs[4]).toMatchObject({
      title: 'Planted basil on the balcony',
      xp: 10,
      effort: 2,
    });
    expect(state.logs.slice(6).map((log) => log.rewardedActs)).toEqual([1, 1, 1, 0, 0, 0]);

    expect(state.tree.rings).toBe(5);
    expect(Object.keys(state.days).sort()).toEqual([day(-9), day(-8), day(-3), day(-1), day(0)]);
    expect(state.marks[day(-7)]).toBe('missed');
    expect(state.marks[day(-2)]).toBe('rain');
    expect(state.streak).toMatchObject({ current: 3, best: 3 });
    expect(state.xp).not.toBe(4250);
    expect(state.xp).toBeLessThan(600);
    expect(state.badges['old-growth']?.tier).toBe(1);
    expect(state.quests.claims).toEqual([]);
    expect(state.seen.maxLevel).toBe(levelOf(state.xp));
    expect(state.notices.map((notice) => notice.kind)).toEqual(['legacy-imported']);
    expect(state.notices[0]?.data).toMatchObject({ logs: 12, skipped: 3 });
    expect(session.eventsOf('planted')).toHaveLength(1);
    expect(session.eventsOf('xp-gained').some((event) => event.reason === 'ceremony')).toBe(true);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('still pays the ceremony when an old log already drew today’s ring', () => {
    const scan = scanLegacy(storage([{ id: String(NOW - 3_600_000), type: 'Veggie Meal' }]), NOW);
    const session = new GameSession(replayLegacy(createInitialState(NOW), scan, NOW));
    const before = session.state.xp;
    session.at(NOW + 1000, (ctx) =>
      plantTree(ctx, { treeName: 'Fern', species: 'oak', userSeed: 9 }),
    );
    expect(session.state.xp).toBe(before + 25);
    expect(session.state.tree.rings).toBe(1);
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('leaves a state untouched when there is nothing real to bring', () => {
    const fresh = createInitialState(NOW);
    expect(replayLegacy(fresh, scanLegacy(storage(seeded), NOW), NOW)).toBe(fresh);
  });
});

describe('events', () => {
  it('delivers typed events, batches and survives a throwing listener', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const offLevel = bus.on('level-up', (event) => seen.push(`level:${event.level}`));
    bus.on('xp-gained', () => {
      throw new Error('boom');
    });
    bus.onAny((event) => seen.push(event.type));
    const batches: number[] = [];
    bus.onBatch((events) => batches.push(events.length));
    const events: GameEvent[] = [
      { type: 'xp-gained', amount: 10, reason: 'check-in', total: 70 },
      { type: 'level-up', level: 2, from: 1, title: 'Seed Sower', first: true },
    ];
    bus.emit(events);
    bus.emit([]);
    expect(seen).toEqual(['xp-gained', 'level:2', 'level-up']);
    expect(batches).toEqual([2]);
    expect(error).toHaveBeenCalledTimes(1);
    offLevel();
    bus.emit(events);
    expect(seen.filter((entry) => entry === 'level:2')).toHaveLength(1);
    bus.clear();
    bus.emit(events);
    expect(batches).toEqual([2, 2]);
  });

  it('maps a first log to the pulses the world should play', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }));
    expect(worldPulsesFor(session.last)).toEqual([
      { kind: 'celebrate' },
      { kind: 'grow', strength: 1 },
      { kind: 'badge' },
      { kind: 'level-up', level: 2 },
    ]);
    expect(session.last.map((event) => event.type)).toContain('growth');
  });

  it('plays water before ring when the check-in revives the tree', () => {
    const session = plantedSession(noon(0));
    session.at(noon(5), water);
    expect(worldPulsesFor(session.last).slice(0, 2)).toEqual([{ kind: 'water' }, { kind: 'ring' }]);
    session.at(noon(6), water);
    expect(worldPulsesFor(session.last)[0]).toEqual({ kind: 'ring' });
  });

  it('stays silent when a level or stage is only regained', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => devGrantXp(ctx, 400));
    expect(session.eventsOf('level-up')[0]).toMatchObject({ level: 4, from: 1, first: true });
    session.at(noon(0) + 2000, (ctx) => devGrantXp(ctx, -400));
    expect(session.eventsOf('level-up')).toEqual([]);
    session.at(noon(0) + 3000, (ctx) => devGrantXp(ctx, 400));
    expect(session.eventsOf('level-up')[0]).toMatchObject({ level: 4, first: false });
    expect(worldPulsesFor(session.last)).toEqual([]);

    session.at(noon(0) + 4000, (ctx) => devGrantGp(ctx, 200));
    expect(session.eventsOf('stage-up')[0]).toMatchObject({ stage: 'Sapling', first: true });
    expect(session.state.activity[0]?.text).toBe('Day 1 · Fern became a sapling.');
    session.at(noon(0) + 5000, (ctx) => devGrantGp(ctx, -200));
    session.at(noon(0) + 6000, (ctx) => devGrantGp(ctx, 200));
    expect(session.eventsOf('stage-up')[0]).toMatchObject({ first: false });
    expect(session.at(noon(0) + 7000, (ctx) => devUnlockBadge(ctx, 'bookworm', 3))).toBe(true);
    expect(session.state.badges.bookworm?.tier).toBe(3);
    expect(session.state.xp).toBeGreaterThanOrEqual(0);
  });
});
