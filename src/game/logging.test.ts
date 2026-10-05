import { describe, expect, it } from 'vitest';
import { ACTIONS, ACTION_BY_ID, type ActionDef } from '@/data/catalogue';
import { addDays } from '@/lib/dates';
import { setBaseline, updateProfile, water } from './engine';
import {
  actionAvailability,
  canUndo,
  customActsLeft,
  lastUsedQty,
  logAction,
  logCustom,
  logSavedCustom,
  previewAction,
  remainingUnits,
  removeLog,
  removeSavedCustom,
  undoLog,
  type LogResult,
} from './logging';
import { checkInvariants, createInitialState } from './state';
import { GameSession, localTime, plantedSession } from './testkit';
import type { GameState, LogEntry } from './types';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);

function action(id: string): ActionDef {
  const found = ACTION_BY_ID.get(id);
  if (!found) throw new Error(`no action ${id}`);
  return found;
}

function mustLog(result: LogResult): LogEntry {
  if (!result.ok) throw new Error(`log refused: ${result.reason}`);
  return result.log;
}

/** Everything an undo must restore; the newest-event clock is allowed to move. */
function withoutClock(state: GameState): Omit<GameState, 'clock'> {
  const { clock: _clock, ...rest } = state;
  return rest;
}

describe('logging an action', () => {
  it('stores a frozen, honest record', () => {
    const session = plantedSession(noon(0));
    const log = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 2 })),
    );
    expect(log).toMatchObject({
      day: MON,
      actionId: 'plant-based-meal',
      title: 'Plant-based meal',
      emoji: '🌱',
      category: 'eat',
      qty: 2,
      unit: 'meal',
      estimate: 'factor',
      kind: 'unrated',
      cadence: 'recurring',
      rewardedActs: 2,
      xp: 30,
      gp: 9,
      source: 'log',
      factorsVersion: '2026.10',
    });
    expect(log.co2eKg).toBeCloseTo(3.04, 10);
    expect(log.kgLow).toBeCloseTo(1.94, 10);
    expect(log.kgHigh).toBeCloseTo(5.2, 10);
    expect(session.state.xp).toBe(35 + 30 + 20);
    expect(session.state.tree.gp).toBe(8 + 9);
    expect(session.eventsOf('action-logged')[0]).toMatchObject({ rewarded: true, strength: 1 });
    expect(session.state.badges['first-leaf']?.tier).toBe(1);
  });

  it('reaches level 2 on the very first log, with or without the quiz', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'tap-off-while-brushing' }));
    expect(session.state.xp).toBe(35 + 8 + 20);
    expect(session.eventsOf('level-up')[0]).toMatchObject({ level: 2, from: 1, first: true });
  });

  it('uses the regional grid and the heating system', () => {
    const session = plantedSession(noon(0), { region: 'FR', heat: 'heat-pump' });
    const dry = mustLog(
      session.at(noon(0) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'line-dry-instead-of-tumble', qty: 1 }),
      ),
    );
    expect(dry.co2eKg).toBeCloseTo(1.52 * 0.04145, 10);
    const shower = mustLog(
      session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'shorter-shower', qty: 2 })),
    );
    expect(shower.co2eKg).toBeCloseTo((2 * 0.22 * 0.04145) / 3, 10);
  });

  it('records sheet inputs in the variant', () => {
    const session = plantedSession(noon(0));
    const carpool = mustLog(
      session.at(noon(0) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'carpool', qty: 10, inputs: { people: 3 } }),
      ),
    );
    expect(carpool.variant).toBe('people:3');
    expect(carpool.co2eKg).toBeCloseTo((10 * 0.2099 * 2) / 3, 10);
    const repair = mustLog(
      session.at(noon(0) + 5000, (ctx) =>
        logAction(ctx, {
          actionId: 'repair-instead-of-replace',
          qty: 1,
          inputs: { variant: 'laptop' },
        }),
      ),
    );
    expect(repair).toMatchObject({ variant: 'laptop', co2eKg: 22, cadence: 'occasional' });
    const wfh = mustLog(
      session.at(noon(0) + 9000, (ctx) =>
        logAction(ctx, {
          actionId: 'work-from-home-day',
          inputs: { commuteKm: 10, heatingOn: true },
        }),
      ),
    );
    expect(wfh).toMatchObject({ variant: 'commute:10:on', co2eKg: 0, xp: 10 });
  });

  it('never claims kilograms for unquantified or context-only actions', () => {
    const session = plantedSession(noon(0));
    const tree = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-a-tree' })),
    );
    expect(tree).toMatchObject({
      co2eKg: null,
      kgLow: null,
      kgHigh: null,
      estimate: 'none',
      xp: 20,
    });
    const litter = mustLog(
      session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'litter-pick' })),
    );
    expect(litter).toMatchObject({ co2eKg: null, estimate: 'none', kind: 'unrated' });
  });

  it('tags swaps and keeps from the starting-line quiz', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0), (ctx) =>
      setBaseline(ctx, {
        diet: 'vegan',
        transportMode: 'car-alone',
        weeklyDistance: '75-150',
        flights: 'short-1-2',
        homeEnergy: 'gas-typical',
        shopping: 'regular',
      }),
    );
    const meal = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal' })),
    );
    const bus = mustLog(
      session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'bus-instead-of-car' })),
    );
    const civic = mustLog(
      session.at(noon(0) + 9000, (ctx) => logAction(ctx, { actionId: 'civic-action' })),
    );
    expect([meal.kind, bus.kind, civic.kind]).toEqual(['keep', 'swap', 'unrated']);
    expect(meal.xp).toBe(15);
  });

  it('defaults to the last-used quantity, then the default preset', () => {
    const session = plantedSession(noon(0));
    const walk = action('walk-cycle-instead-of-car');
    expect(lastUsedQty(session.state, walk)).toBe(2);
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: walk.id, qty: 7.5 }));
    expect(lastUsedQty(session.state, walk)).toBe(7.5);
    const quick = mustLog(
      session.at(noon(1), (ctx) => logAction(ctx, { actionId: walk.id, source: 'quick' })),
    );
    expect(quick).toMatchObject({ qty: 7.5, source: 'quick' });
  });
});

describe('validation', () => {
  it('refuses bad quantities without changing anything', () => {
    const session = plantedSession(noon(0));
    const before = session.state;
    const tries: [string, number, string][] = [
      ['plant-based-meal', 0, 'invalid-quantity'],
      ['plant-based-meal', -1, 'invalid-quantity'],
      ['plant-based-meal', Number.NaN, 'invalid-quantity'],
      ['plant-based-meal', 1.5, 'too-precise'],
      ['walk-cycle-instead-of-car', 2.55, 'too-precise'],
      ['plant-milk-instead-of-dairy', 0.255, 'too-precise'],
      ['plant-based-meal', 4, 'over-cap'],
      ['walk-cycle-instead-of-car', 61, 'over-cap'],
      ['no-such-action', 1, 'unknown-action'],
    ];
    for (const [actionId, qty, reason] of tries) {
      const result = session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId, qty }));
      expect(result).toMatchObject({ ok: false, reason });
      expect(session.state).toBe(before);
    }
    const tooMuch = session.at(noon(0) + 1000, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal', qty: 4 }),
    );
    expect(!tooMuch.ok && tooMuch.message).toBe("That's more than a day can hold. Typo?");
  });

  it('accepts the decimals each unit allows', () => {
    const session = plantedSession(noon(0));
    expect(
      session.at(noon(0) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'walk-cycle-instead-of-car', qty: 2.5 }),
      ).ok,
    ).toBe(true);
    expect(
      session.at(noon(0) + 5000, (ctx) =>
        logAction(ctx, { actionId: 'plant-milk-instead-of-dairy', qty: 0.25 }),
      ).ok,
    ).toBe(true);
    expect(
      session.at(noon(0) + 9000, (ctx) =>
        logAction(ctx, { actionId: 'food-waste-avoided', qty: 0.25 }),
      ).ok,
    ).toBe(true);
  });

  it('holds the hard daily unit cap across logs', () => {
    const session = plantedSession(noon(0));
    const meal = action('plant-based-meal');
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: meal.id, qty: 2 }));
    expect(remainingUnits(session.state, meal, MON)).toBe(1);
    expect(
      session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: meal.id, qty: 2 })),
    ).toMatchObject({
      ok: false,
      reason: 'over-cap',
    });
    expect(
      session.at(noon(0) + 9000, (ctx) => logAction(ctx, { actionId: meal.id, qty: 1 })).ok,
    ).toBe(true);
    expect(remainingUnits(session.state, meal, MON)).toBe(0);
    expect(remainingUnits(session.state, meal, day(1))).toBe(3);
  });

  it('shares the laundry cap of three loads between both temperatures', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) =>
      logAction(ctx, { actionId: 'wash-30-instead-of-40', qty: 2 }),
    );
    expect(remainingUnits(session.state, action('wash-cold-instead-of-40'), MON)).toBe(1);
    expect(
      session.at(noon(0) + 5000, (ctx) =>
        logAction(ctx, { actionId: 'wash-cold-instead-of-40', qty: 2 }),
      ),
    ).toMatchObject({ ok: false, reason: 'over-cap' });
    expect(
      session.at(noon(0) + 9000, (ctx) =>
        logAction(ctx, { actionId: 'line-dry-instead-of-tumble', qty: 2 }),
      ).ok,
    ).toBe(true);
  });

  it('treats an identical log within two seconds as a double tap', () => {
    const session = plantedSession(noon(0));
    const input = { actionId: 'refuse-single-use-bottle', qty: 1 };
    expect(session.at(noon(0) + 1000, (ctx) => logAction(ctx, input)).ok).toBe(true);
    const logs = session.state.logs;
    expect(session.at(noon(0) + 1500, (ctx) => logAction(ctx, input))).toMatchObject({
      ok: false,
      reason: 'duplicate',
    });
    expect(session.state.logs).toBe(logs);
    expect(session.at(noon(0) + 1600, (ctx) => logAction(ctx, { ...input, qty: 2 })).ok).toBe(true);
    expect(session.at(noon(0) + 4000, (ctx) => logAction(ctx, input)).ok).toBe(true);
  });

  it('cannot be bypassed by a burst of rapid calls', () => {
    const session = plantedSession(noon(0));
    for (let index = 0; index < 60; index += 1) {
      const id = ACTIONS[index % ACTIONS.length]?.id ?? 'plant-based-meal';
      session.at(noon(0) + 3000 + index * 2500, (ctx) => logAction(ctx, { actionId: id }));
      session.at(noon(0) + 3000 + index * 2500 + 1, (ctx) => logAction(ctx, { actionId: id }));
    }
    const today = session.state.logs.filter((log) => log.day === MON);
    expect(today.reduce((sum, log) => sum + log.xp, 0)).toBeLessThanOrEqual(150);
    expect(today.reduce((sum, log) => sum + log.rewardedActs, 0)).toBeLessThanOrEqual(12);
    expect(session.state.tree.gp).toBeLessThanOrEqual(8 + 16 + 4);
    for (const item of ACTIONS) {
      const units = today
        .filter((log) => log.actionId === item.id)
        .reduce((sum, log) => sum + log.qty, 0);
      expect(units).toBeLessThanOrEqual(item.dailyCap);
    }
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('needs a planted tree', () => {
    const session = new GameSession(createInitialState(noon(0)));
    expect(
      session.at(noon(0), (ctx) => logAction(ctx, { actionId: 'plant-based-meal' })),
    ).toMatchObject({
      ok: false,
      reason: 'not-onboarded',
    });
  });
});

describe('double-counting rules', () => {
  it('lets a diet-day tile replace meal tiles, and the other way round', () => {
    const veggie = plantedSession(noon(0));
    const dayLog = mustLog(
      veggie.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'vegetarian-day' })),
    );
    expect(dayLog).toMatchObject({ rewardedActs: 3, xp: 36, gp: 12 });
    expect(veggie.state.days[MON]?.ringClosed).toBe(true);
    const covered = veggie.at(noon(0) + 5000, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal' }),
    );
    expect(covered).toMatchObject({ ok: false, reason: 'covered-by-day' });
    expect(!covered.ok && covered.message).toBe('Covered by your vegetarian day.');
    expect(
      veggie.at(noon(0) + 6000, (ctx) => logAction(ctx, { actionId: 'vegan-day' })),
    ).toMatchObject({
      ok: false,
      reason: 'covered-by-day',
    });

    const meals = plantedSession(noon(0));
    meals.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'chicken-instead-of-beef' }));
    expect(
      meals.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'vegan-day' })),
    ).toMatchObject({
      ok: false,
      reason: 'meals-logged',
    });
    expect(meals.at(noon(1), (ctx) => logAction(ctx, { actionId: 'vegan-day' })).ok).toBe(true);
  });

  it('allows four flight swaps per rolling 30 days', () => {
    const session = plantedSession(noon(0));
    for (let index = 0; index < 4; index += 1) {
      const result = session.at(noon(index * 2), (ctx) =>
        logAction(ctx, {
          actionId:
            index % 2 ? 'train-instead-of-short-flight-trip' : 'train-instead-of-short-flight-km',
        }),
      );
      expect(result.ok).toBe(true);
    }
    expect(
      session.at(noon(10), (ctx) =>
        logAction(ctx, { actionId: 'train-instead-of-short-flight-km' }),
      ),
    ).toMatchObject({ ok: false, reason: 'cooldown' });
    expect(
      session.at(noon(30), (ctx) =>
        logAction(ctx, { actionId: 'train-instead-of-short-flight-km' }),
      ).ok,
    ).toBe(true);
  });

  it('counts a kept phone once per rolling year', () => {
    const session = plantedSession(noon(0));
    expect(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'keep-phone-one-more-year' }))
        .ok,
    ).toBe(true);
    expect(
      session.at(noon(200), (ctx) => logAction(ctx, { actionId: 'keep-phone-one-more-year' })),
    ).toMatchObject({
      ok: false,
      reason: 'cooldown',
    });
    expect(
      session.at(noon(365), (ctx) => logAction(ctx, { actionId: 'keep-phone-one-more-year' })).ok,
    ).toBe(true);
  });
});

describe('caps and availability', () => {
  it('still logs a maxed action, for kilograms only', () => {
    const session = plantedSession(noon(0));
    const walk = action('walk-cycle-instead-of-car');
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: walk.id, qty: 2 }));
    session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: walk.id, qty: 3 }));
    expect(actionAvailability(session.state, walk, MON)).toMatchObject({
      actsLeft: 0,
      maxed: true,
      unitsLeft: 55,
    });
    const preview = previewAction(session.state, { actionId: walk.id, qty: 4 }, MON);
    expect(preview).toMatchObject({ ok: true, maxed: true, xp: 0, gp: 0 });
    expect(preview.kg?.kg).toBeCloseTo(4 * 0.2099, 10);
    const xp = session.state.xp;
    const third = mustLog(
      session.at(noon(0) + 9000, (ctx) => logAction(ctx, { actionId: walk.id, qty: 4 })),
    );
    expect(third).toMatchObject({ rewardedActs: 0, xp: 0, gp: 0 });
    expect(third.co2eKg).toBeCloseTo(4 * 0.2099, 10);
    expect(session.state.xp).toBe(xp);
    expect(session.eventsOf('action-logged')[0]?.rewarded).toBe(false);
  });

  it('previews exactly what saving would do', () => {
    const session = plantedSession(noon(0));
    const preview = previewAction(session.state, { actionId: 'plant-based-meal', qty: 2 }, MON);
    expect(preview).toMatchObject({
      ok: true,
      rewardedActs: 2,
      xp: 30,
      gp: 9,
      maxed: false,
      remainingUnits: 3,
    });
    const log = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 2 })),
    );
    expect([log.xp, log.gp, log.co2eKg]).toEqual([preview.xp, preview.gp, preview.kg?.kg]);
    expect(previewAction(session.state, { actionId: 'nope' }, MON).refusal?.reason).toBe(
      'unknown-action',
    );
    expect(
      previewAction(session.state, { actionId: 'plant-based-meal', qty: 9 }, MON).refusal?.reason,
    ).toBe('over-cap');
  });

  it('reports group caps on every member tile', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) =>
      logAction(ctx, { actionId: 'recycle-aluminium-can', qty: 2 }),
    );
    session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'recycle-paper', qty: 0.5 }));
    expect(actionAvailability(session.state, action('recycle-glass-bottle'), MON)).toMatchObject({
      actsLeft: 0,
      maxed: true,
      blocked: null,
    });
    expect(actionAvailability(session.state, action('plant-based-meal'), MON).actsLeft).toBe(3);
  });
});

describe('custom actions', () => {
  it('pays by effort, twice a day, and clamps AI kilograms', () => {
    const session = plantedSession(noon(0));
    const first = mustLog(
      session.at(noon(0) + 1000, (ctx) =>
        logCustom(ctx, {
          title: "  Fixed my   neighbour's bike ",
          category: 'stuff',
          effort: 3,
          co2eKg: 9,
        }),
      ),
    );
    expect(first).toMatchObject({
      actionId: 'custom',
      title: "Fixed my neighbour's bike",
      xp: 12,
      estimate: 'ai',
      co2eKg: 2,
      kind: 'unrated',
      effort: 3,
    });
    expect(customActsLeft(session.state, MON)).toBe(1);
    const second = mustLog(
      session.at(noon(0) + 5000, (ctx) =>
        logCustom(ctx, { title: 'Shared tools', category: 'stuff', effort: 4, co2eKg: 2 }),
      ),
    );
    const third = mustLog(
      session.at(noon(0) + 9000, (ctx) =>
        logCustom(ctx, { title: 'Mended socks', category: 'stuff', effort: 1, co2eKg: 2 }),
      ),
    );
    expect([second.xp, third.xp]).toEqual([15, 0]);
    expect([second.co2eKg, third.co2eKg]).toEqual([2, 1]);
    const fourth = mustLog(
      session.at(noon(0) + 13000, (ctx) =>
        logCustom(ctx, { title: 'Darned a jumper', category: 'stuff', effort: 1, co2eKg: 2 }),
      ),
    );
    expect(fourth).toMatchObject({ co2eKg: null, estimate: 'none' });
    expect(customActsLeft(session.state, MON)).toBe(0);
  });

  it('rejects an unusable description, category or effort', () => {
    const session = plantedSession(noon(0));
    const bad = [
      { title: 'ab', category: 'stuff', effort: 2 },
      { title: 'A fine deed', category: 'transport', effort: 2 },
      { title: 'A fine deed', category: 'stuff', effort: 5 },
    ] as unknown as Parameters<typeof logCustom>[1][];
    for (const input of bad) {
      expect(session.at(noon(0) + 1000, (ctx) => logCustom(ctx, input))).toMatchObject({
        ok: false,
        reason: 'invalid-custom',
      });
    }
    expect(session.state.logs).toHaveLength(0);
  });

  it('keeps up to twelve saved actions for one-tap reuse', () => {
    const session = plantedSession(noon(0));
    for (let index = 0; index < 14; index += 1) {
      session.at(noon(index), (ctx) =>
        logCustom(ctx, {
          title: `Deed number ${index}`,
          category: 'nature',
          effort: 2,
          save: true,
        }),
      );
    }
    expect(session.state.customActions).toHaveLength(12);
    expect(session.state.customActions[0]?.title).toBe('Deed number 13');
    const saved = session.state.customActions[0];
    if (!saved) throw new Error('nothing saved');
    const again = mustLog(session.at(noon(20), (ctx) => logSavedCustom(ctx, saved.id)));
    expect(again).toMatchObject({ title: 'Deed number 13', xp: 10 });
    expect(session.at(noon(20), (ctx) => removeSavedCustom(ctx, saved.id))).toBe(true);
    expect(session.state.customActions).toHaveLength(11);
    expect(session.at(noon(20) + 5000, (ctx) => logSavedCustom(ctx, saved.id)).ok).toBe(false);
  });
});

describe('undo and delete', () => {
  it('restores the exact previous state for today', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 1 }));
    session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'bus-instead-of-car', qty: 5 }));
    const before = session.state;
    const log = mustLog(
      session.at(noon(0) + 9000, (ctx) => logAction(ctx, { actionId: 'shorter-shower', qty: 2 })),
    );
    expect(session.state.days[MON]?.ringClosed).toBe(true);
    expect(canUndo(log, noon(0) + 9000 + 7999)).toBe(true);
    const undone = session.at(noon(0) + 12000, (ctx) => undoLog(ctx, log.id));
    expect(undone).toMatchObject({ ok: true, live: true });
    const { days: daysAfter, ...after } = withoutClock(session.state);
    const { days: daysBefore, ...expected } = withoutClock(before);
    expect(after).toEqual(expected);
    // The only trace: the ring-closed celebration has played and will not replay.
    expect(daysAfter[MON]).toEqual({ ...daysBefore[MON], ringCelebrated: true });
    expect(session.eventsOf('action-undone')[0]?.log.id).toBe(log.id);
  });

  it('re-scores the rest of today when an early log is removed', () => {
    const session = plantedSession(noon(0));
    const first = mustLog(
      session.at(noon(0) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'walk-cycle-instead-of-car' }),
      ),
    );
    session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'walk-cycle-instead-of-car' }));
    const third = mustLog(
      session.at(noon(0) + 9000, (ctx) =>
        logAction(ctx, { actionId: 'walk-cycle-instead-of-car' }),
      ),
    );
    expect(third.rewardedActs).toBe(0);
    const xp = session.state.xp;
    session.at(noon(0) + 60_000, (ctx) => removeLog(ctx, first.id));
    expect(session.state.logs.map((log) => log.rewardedActs)).toEqual([1, 1]);
    expect(session.state.logs.map((log) => log.gp)).toEqual([5, 4]);
    expect(session.state.xp).toBe(xp);
  });

  it('expires after eight seconds, while delete keeps working', () => {
    const session = plantedSession(noon(0));
    const log = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal' })),
    );
    expect(session.at(noon(0) + 1000 + 8001, (ctx) => undoLog(ctx, log.id))).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(session.at(noon(0) + 20_000, (ctx) => undoLog(ctx, 'nope'))).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(session.at(noon(0) + 20_000, (ctx) => removeLog(ctx, log.id)).ok).toBe(true);
    expect(session.state.logs).toHaveLength(0);
    expect(session.state.days[MON]).toBeDefined();
    expect(session.state.tree.rings).toBe(1);
  });

  it('subtracts only the stored values when a settled log is deleted', () => {
    const session = plantedSession(noon(0));
    const old = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 })),
    );
    session.at(noon(1), water);
    const before = session.state;
    const result = session.at(noon(1) + 1000, (ctx) => removeLog(ctx, old.id));
    expect(result).toMatchObject({ ok: true, live: false });
    expect(session.state.xp).toBe(before.xp - old.xp);
    expect(session.state.tree.gp).toBe(before.tree.gp - old.gp);
    expect(session.state.marks).toBe(before.marks);
    expect(session.state.days).toBe(before.days);
    expect(session.state.tree.fullRings).toBe(1);
    expect(session.state.streak).toBe(before.streak);
    expect(session.state.rain).toBe(before.rain);
    expect(session.state.badges).toBe(before.badges);
  });

  it('never lets XP or growth fall below zero', () => {
    const session = plantedSession(noon(0));
    const log = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 })),
    );
    session.state = { ...session.state, xp: 5, tree: { ...session.state.tree, gp: 3 } };
    session.at(noon(0) + 2000, (ctx) => removeLog(ctx, log.id));
    expect(session.state.xp).toBe(0);
    expect(session.state.tree.gp).toBe(0);
  });

  it('keeps earned badges and their XP after an undo', () => {
    const session = plantedSession(noon(0));
    const log = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal' })),
    );
    session.at(noon(0) + 2000, (ctx) => undoLog(ctx, log.id));
    expect(session.state.badges['first-leaf']?.tier).toBe(1);
    expect(session.state.xp).toBe(35 + 20);
    session.at(noon(0) + 9000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal' }));
    expect(session.eventsOf('badge-unlocked')).toEqual([]);
    expect(session.eventsOf('level-up')[0]).toMatchObject({ level: 2, first: false });
  });
});

describe('profile changes and logging', () => {
  it('freezes the estimate at log time', () => {
    const session = plantedSession(noon(0));
    const first = mustLog(
      session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'standby-off' })),
    );
    session.at(noon(0) + 2000, (ctx) => updateProfile(ctx, { region: 'FR' }));
    const second = mustLog(
      session.at(noon(1), (ctx) => logAction(ctx, { actionId: 'standby-off' })),
    );
    expect(session.state.logs[0]?.co2eKg).toBe(first.co2eKg);
    expect(first.co2eKg).toBeCloseTo(0.499 * 0.45849, 10);
    expect(second.co2eKg).toBeCloseTo(0.499 * 0.04145, 10);
  });
});
