import { describe, expect, it } from 'vitest';
import type { CategoryId } from '@/data/catalogue';
import {
  DAILY_QUESTS,
  DAILY_QUEST_BY_ID,
  EPICS,
  WEEKLY_QUESTS,
  WEEKLY_QUEST_BY_ID,
} from '@/data/quests';
import { addDays, weekKey } from '@/lib/dates';
import { addPost } from './community';
import { setActionHidden, updateProfile, water } from './engine';
import { completeLesson, flipMyth, openLesson, LESSON_SLUGS } from './lessons';
import { logAction, removeLog } from './logging';
import {
  allEpicStatuses,
  bag,
  claimEpic,
  claimQuest,
  conditionActions,
  dailyProgress,
  drawDaily,
  drawWeekly,
  epicStatus,
  evaluateCondition,
  hiddenActionSet,
  isSatisfiable,
  pinEpic,
  swapQuest,
  updateEpic,
  weeklyProgress,
  type RotationInput,
} from './quests';
import { checkInvariants } from './state';
import { type GameSession, localTime, plantedSession, TEST_SEED } from './testkit';
import type { GameState } from './types';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);

const input = (over: Partial<RotationInput> = {}): RotationInput => ({
  userSeed: TEST_SEED,
  focus: ['eat', 'move'],
  hidden: new Set(),
  ...over,
});

/** Puts chosen quests on the board, so a test does not depend on what the rotation drew. */
function withBoard(session: GameSession, daily: string[], weekly: string[] = []): void {
  const quests = session.state.quests;
  session.state = {
    ...session.state,
    quests: {
      ...quests,
      daily:
        quests.daily && daily.length === 3
          ? { ...quests.daily, slots: daily as [string, string, string] }
          : quests.daily,
      weekly:
        quests.weekly && weekly.length === 3
          ? { ...quests.weekly, slots: weekly as [string, string, string] }
          : quests.weekly,
    },
  };
}

describe('rotation', () => {
  it('is deterministic for the same date, seed, focus and hidden actions', () => {
    for (let offset = 0; offset < 40; offset += 1) {
      expect(drawDaily(day(offset), input())).toEqual(drawDaily(day(offset), input()));
      expect(drawWeekly(day(offset), input())).toEqual(drawWeekly(day(offset), input()));
    }
    expect(drawDaily(MON, input())).not.toEqual(drawDaily(MON, input({ userSeed: 7 })));
  });

  it('never shows a duplicate and always starts with an easy quest', () => {
    for (const seed of [1, 42, TEST_SEED, 4_000_000_000]) {
      for (const focus of [
        ['eat', 'move'],
        ['nature'],
        ['power', 'water', 'stuff'],
      ] as CategoryId[][]) {
        for (let offset = -30; offset < 400; offset += 1) {
          const slots = drawDaily(day(offset), input({ userSeed: seed, focus }));
          expect(new Set(slots).size).toBe(3);
          expect(DAILY_QUEST_BY_ID.get(slots[0])?.pool).toBe('easy');
          expect(DAILY_QUEST_BY_ID.get(slots[1])?.pool).not.toBe('easy');
          expect(DAILY_QUEST_BY_ID.get(slots[2])?.pool).not.toBe('easy');
        }
        for (let week = 0; week < 60; week += 1) {
          const slots = drawWeekly(day(week * 7), input({ userSeed: seed, focus }));
          expect(new Set(slots).size).toBe(3);
          expect(WEEKLY_QUEST_BY_ID.get(slots[0])?.pool).toBe('consistency');
        }
      }
    }
  });

  it('tilts one slot toward the focus areas and one away from them', () => {
    const focus: CategoryId[] = ['eat', 'move'];
    for (let offset = 0; offset < 120; offset += 1) {
      const [, focused, other] = drawDaily(day(offset), input({ focus }));
      expect(focus).toContain(DAILY_QUEST_BY_ID.get(focused)?.pool);
      expect(focus).not.toContain(DAILY_QUEST_BY_ID.get(other)?.pool);
    }
    const single = drawDaily(MON, input({ focus: ['nature'] }));
    expect(DAILY_QUEST_BY_ID.get(single[1])?.pool).toBe('nature');
  });

  it('keeps the same quests all week and changes them on Monday', () => {
    const monday = drawWeekly(MON, input());
    for (let offset = 1; offset < 7; offset += 1)
      expect(drawWeekly(day(offset), input())).toEqual(monday);
    expect(drawWeekly(day(7), input())).not.toEqual(monday);
  });

  it('shows every quest of a bag once before any repeats', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    for (let cycle = -2; cycle < 6; cycle += 1) {
      const seen = pool.map((_, index) => bag(pool, 99, 'dA', cycle * pool.length + index));
      expect([...seen].sort()).toEqual(pool);
    }
    for (let index = 0; index < 200; index += 1) {
      expect(bag(pool, 99, 'dA', index)).not.toBe(bag(pool, 99, 'dA', index + 1));
    }
    expect(bag(['only'], 1, 'dA', 12)).toBe('only');
  });

  it('never draws a quest that needs only hidden actions', () => {
    const hidden = new Set([
      'standby-off',
      'thermostat-down-1c',
      'ac-up-1c',
      'line-dry-instead-of-tumble',
    ]);
    const blocked = DAILY_QUESTS.filter((quest) => !isSatisfiable(quest.condition, hidden)).map(
      (q) => q.id,
    );
    expect(blocked.sort()).toEqual(['d_one_degree', 'd_sun_dried', 'd_vampire_slayer']);
    for (let offset = 0; offset < 200; offset += 1) {
      for (const id of drawDaily(day(offset), input({ focus: ['power'], hidden }))) {
        expect(blocked).not.toContain(id);
      }
    }
    const partly = new Set(['thermostat-down-1c']);
    expect(isSatisfiable(DAILY_QUEST_BY_ID.get('d_one_degree')!.condition, partly)).toBe(true);
    expect(
      isSatisfiable(
        WEEKLY_QUEST_BY_ID.get('w_use_your_voice')!.condition,
        new Set(['civic-action']),
      ),
    ).toBe(true);
    expect(
      isSatisfiable(
        WEEKLY_QUEST_BY_ID.get('w_use_your_voice')!.condition,
        new Set(['civic-action', 'climate-conversation']),
      ),
    ).toBe(false);
  });

  it('treats heat actions as hidden in a home without heating', () => {
    const session = plantedSession(noon(0), { heat: 'none' });
    const hidden = hiddenActionSet(session.state);
    expect([...hidden].sort()).toEqual(['hot-water-saved', 'shorter-shower', 'thermostat-down-1c']);
  });

  it('survives everything being hidden', () => {
    const everything = new Set(DAILY_QUESTS.flatMap((quest) => conditionActions(quest.condition)));
    const slots = drawDaily(MON, input({ hidden: everything }));
    expect(new Set(slots).size).toBe(3);
  });
});

describe('the board', () => {
  it('persists the drawn quests so a change of focus does not reshuffle today', () => {
    const session = plantedSession(noon(0));
    const board = session.state.quests.daily;
    expect(board?.slots).toEqual(drawDaily(MON, input()));
    session.at(noon(0) + 1000, (ctx) => updateProfile(ctx, { focus: ['nature'] }));
    session.at(noon(0) + 2000, (ctx) => setActionHidden(ctx, 'plant-based-meal', true));
    expect(session.state.quests.daily).toBe(board);
    session.at(noon(1), water);
    expect(session.state.quests.daily?.slots).toEqual(
      drawDaily(day(1), {
        userSeed: TEST_SEED,
        focus: ['nature'],
        hidden: new Set(['plant-based-meal']),
      }),
    );
    expect(session.eventsOf('quests-rotated').map((event) => event.kind)).toEqual(['daily']);
  });

  it('redraws only the slot whose quest no longer exists', () => {
    const session = plantedSession(noon(0));
    const board = session.state.quests.daily!;
    withBoard(session, [board.slots[0], 'd_removed_in_an_update', board.slots[2]]);
    session.tick(noon(0) + 1000);
    const next = session.state.quests.daily!;
    expect(next.slots[0]).toBe(board.slots[0]);
    expect(next.slots[2]).toBe(board.slots[2]);
    expect(DAILY_QUEST_BY_ID.has(next.slots[1])).toBe(true);
    expect(new Set(next.slots).size).toBe(3);
  });
});

describe('conditions', () => {
  it('track progress from rewarded acts, live', () => {
    const session = plantedSession(noon(0));
    withBoard(session, ['d_double_up', 'd_plant_day', 'd_five_k']);
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 2 }));
    expect(dailyProgress(session.state, 'd_plant_day', MON)).toEqual({
      current: 2,
      target: 3,
      done: false,
    });
    expect(dailyProgress(session.state, 'd_double_up', MON)).toEqual({
      current: 2,
      target: 2,
      done: true,
    });
    expect(session.eventsOf('quest-claimable').map((event) => event.questId)).toEqual([
      'd_double_up',
    ]);
    expect(
      session
        .eventsOf('quest-progress')
        .filter((event) => event.kind === 'daily')
        .map((event) => event.questId)
        .sort(),
    ).toEqual(['d_double_up', 'd_plant_day']);

    const walk = session.at(noon(0) + 5000, (ctx) =>
      logAction(ctx, { actionId: 'walk-cycle-instead-of-car', qty: 5 }),
    );
    expect(dailyProgress(session.state, 'd_five_k', MON).done).toBe(true);
    if (!walk.ok) throw new Error('refused');
    session.at(noon(0) + 6000, (ctx) => removeLog(ctx, walk.log.id));
    expect(dailyProgress(session.state, 'd_five_k', MON)).toEqual({
      current: 0,
      target: 5,
      done: false,
    });
  });

  it('count units only from logs with a rewarded act', () => {
    const session = plantedSession(noon(0));
    for (const [index, km] of [2, 2, 30].entries()) {
      session.at(noon(0) + 1000 + index * 4000, (ctx) =>
        logAction(ctx, { actionId: 'walk-cycle-instead-of-car', qty: km }),
      );
    }
    expect(dailyProgress(session.state, 'd_five_k', MON)).toEqual({
      current: 4,
      target: 5,
      done: false,
    });
  });

  it('cover check-ins, rings, categories, lessons, notes and coach picks', () => {
    const session = plantedSession(localTime(MON, 9, 30));
    const state = () => session.state;
    expect(dailyProgress(state(), 'd_early_bird', MON).done).toBe(true);
    expect(dailyProgress(state(), 'd_first_light', MON)).toEqual({
      current: 1,
      target: 2,
      done: false,
    });
    session.at(noon(0), (ctx) => logAction(ctx, { actionId: 'plant-based-meal', source: 'coach' }));
    expect(dailyProgress(state(), 'd_first_light', MON).done).toBe(true);
    expect(dailyProgress(state(), 'd_coach_pick', MON).done).toBe(true);
    expect(dailyProgress(state(), 'd_mix_it_up', MON).done).toBe(false);
    session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'bus-instead-of-car' }));
    expect(dailyProgress(state(), 'd_mix_it_up', MON).done).toBe(true);
    expect(dailyProgress(state(), 'd_full_ring', MON).done).toBe(false);
    session.at(noon(0) + 9000, (ctx) => logAction(ctx, { actionId: 'standby-off' }));
    expect(dailyProgress(state(), 'd_full_ring', MON).done).toBe(true);

    expect(dailyProgress(state(), 'd_brain_food', MON).done).toBe(false);
    session.at(noon(0) + 10_000, (ctx) => flipMyth(ctx, 3));
    expect(dailyProgress(state(), 'd_brain_food', MON).done).toBe(true);
    session.at(noon(0) + 11_000, (ctx) => addPost(ctx, { text: 'too short' }));
    expect(dailyProgress(state(), 'd_dear_diary', MON).done).toBe(false);
    session.at(noon(0) + 12_000, (ctx) =>
      addPost(ctx, { text: 'The bus was faster than I expected today.' }),
    );
    expect(dailyProgress(state(), 'd_dear_diary', MON).done).toBe(true);

    const late = plantedSession(localTime(MON, 10, 0));
    expect(dailyProgress(late.state, 'd_early_bird', MON).done).toBe(false);
  });

  it('aggregate a week and count distinct days', () => {
    const session = plantedSession(noon(0));
    for (let offset = 0; offset < 5; offset += 1) {
      session.at(noon(offset) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'plant-based-meal', qty: offset < 2 ? 3 : 1 }),
      );
      session.at(noon(offset) + 5000, (ctx) => logAction(ctx, { actionId: 'bus-instead-of-car' }));
    }
    const week = weekKey(MON);
    const progressOf = (id: string) => weeklyProgress(session.state, id, week);
    expect(progressOf('w_five_alive')).toEqual({ current: 5, target: 5, done: true });
    expect(progressOf('w_four_rings')).toEqual({ current: 2, target: 4, done: false });
    expect(progressOf('w_ten_plates')).toEqual({ current: 9, target: 10, done: false });
    expect(progressOf('w_two_plant_days')).toEqual({ current: 2, target: 2, done: true });
    expect(progressOf('w_commuter')).toEqual({ current: 3, target: 3, done: true });
    expect(progressOf('w_sampler')).toEqual({ current: 2, target: 4, done: false });
    expect(progressOf('w_fifteen')).toEqual({ current: 14, target: 15, done: false });
    expect(progressOf('w_use_your_voice')).toEqual({ current: 0, target: 1, done: false });
    session.at(noon(5), (ctx) => logAction(ctx, { actionId: 'climate-conversation' }));
    session.at(noon(6), (ctx) => logAction(ctx, { actionId: 'climate-conversation' }));
    expect(progressOf('w_use_your_voice').done).toBe(true);
    expect(weeklyProgress(session.state, 'w_five_alive', weekKey(day(7))).current).toBe(0);
  });

  it('evaluate "study buddy" from lesson opens only', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => flipMyth(ctx, 1));
    session.at(noon(0) + 2000, (ctx) => openLesson(ctx, 'the-blanket'));
    const week = weekKey(MON);
    expect(weeklyProgress(session.state, 'w_study_buddy', week).current).toBe(1);
    session.at(noon(1), (ctx) => openLesson(ctx, 'the-blanket'));
    expect(weeklyProgress(session.state, 'w_study_buddy', week).done).toBe(true);
  });

  it('handle an empty period and an unknown quest id', () => {
    const session = plantedSession(noon(0));
    expect(dailyProgress(session.state, 'nope', MON)).toEqual({
      current: 0,
      target: 1,
      done: false,
    });
    expect(evaluateCondition({ kind: 'acts', actions: '*', min: 1 }, session.state, [])).toEqual({
      current: 0,
      target: 1,
      done: false,
    });
  });
});

describe('claiming', () => {
  function completedBoard(): GameSession {
    const session = plantedSession(noon(0));
    withBoard(
      session,
      ['d_double_up', 'd_plant_plate', 'd_sorted'],
      ['w_fifteen', 'w_ten_plates', 'w_sampler'],
    );
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 2 }));
    session.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'recycle-paper' }));
    return session;
  }

  it('pays exactly once: a second claim is a no-op', () => {
    const session = completedBoard();
    const xp = session.state.xp;
    expect(session.at(noon(0) + 9000, (ctx) => claimQuest(ctx, 'd_double_up'))).toEqual({
      ok: true,
      xp: 15,
    });
    expect(session.state.xp).toBe(xp + 15);
    expect(session.eventsOf('quest-claimed')[0]).toMatchObject({
      questId: 'd_double_up',
      auto: false,
      xp: 15,
    });
    const after = session.state;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        session.at(noon(0) + 10_000 + attempt, (ctx) => claimQuest(ctx, 'd_double_up')),
      ).toEqual({
        ok: false,
        reason: 'already-claimed',
      });
      expect(session.state).toBe(after);
    }
    expect(session.state.quests.claims).toHaveLength(1);
  });

  it('refuses an incomplete, unknown or off-board quest', () => {
    const session = completedBoard();
    expect(session.at(noon(0) + 9000, (ctx) => claimQuest(ctx, 'w_fifteen'))).toEqual({
      ok: false,
      reason: 'not-complete',
    });
    expect(session.at(noon(0) + 9000, (ctx) => claimQuest(ctx, 'd_five_k'))).toEqual({
      ok: false,
      reason: 'not-on-board',
    });
    expect(session.at(noon(0) + 9000, (ctx) => claimQuest(ctx, 'd_nonsense'))).toEqual({
      ok: false,
      reason: 'unknown-quest',
    });
  });

  it('adds the clean sweep when all three dailies are claimed', () => {
    const session = completedBoard();
    const xp = session.state.xp;
    for (const id of ['d_double_up', 'd_plant_plate', 'd_sorted']) {
      expect(session.at(noon(0) + 9000, (ctx) => claimQuest(ctx, id)).ok).toBe(true);
    }
    expect(session.eventsOf('clean-sweep')).toEqual([{ type: 'clean-sweep', day: MON, xp: 15 }]);
    expect(session.state.days[MON]?.cleanSweep).toBe(true);
    expect(session.state.badges['clean-sweep']?.tier).toBe(1);
    expect(session.state.xp).toBe(xp + 15 + 15 + 15 + 15 + 40);
  });

  it('voids a claim whose condition an undo broke, and lets it be claimed again', () => {
    const session = completedBoard();
    for (const id of ['d_double_up', 'd_plant_plate', 'd_sorted'])
      session.at(noon(0) + 9000, (ctx) => claimQuest(ctx, id));
    const xp = session.state.xp;
    const recycle = session.state.logs.find((log) => log.actionId === 'recycle-paper')!;
    session.at(noon(0) + 20_000, (ctx) => removeLog(ctx, recycle.id));
    expect(session.eventsOf('quest-voided').map((event) => event.questId)).toEqual(['d_sorted']);
    expect(session.state.quests.claims.map((claim) => claim.questId)).toEqual([
      'd_double_up',
      'd_plant_plate',
    ]);
    expect(session.state.days[MON]?.cleanSweep).toBe(false);
    // The log, the claim, the clean sweep and the ring it had closed all step back.
    expect(session.state.xp).toBe(xp - recycle.xp - 15 - 15 - 10);
    expect(session.state.badges['clean-sweep']?.tier).toBe(1);

    session.at(noon(0) + 30_000, (ctx) => logAction(ctx, { actionId: 'recycle-paper' }));
    expect(session.at(noon(0) + 31_000, (ctx) => claimQuest(ctx, 'd_sorted')).ok).toBe(true);
    expect(session.state.days[MON]?.cleanSweep).toBe(true);
    expect(session.state.xp).toBe(xp);
    expect(checkInvariants(session.state)).toEqual([]);
  });

  it('auto-claims a finished quest when its period is settled, and drops the rest', () => {
    const session = completedBoard();
    session.at(noon(0) + 9000, (ctx) => claimQuest(ctx, 'd_double_up'));
    const xp = session.state.xp;
    session.tick(noon(1));
    const claims = session.state.quests.claims;
    expect(claims.map((claim) => [claim.questId, claim.auto])).toEqual([
      ['d_double_up', false],
      ['d_plant_plate', true],
      ['d_sorted', true],
    ]);
    expect(session.state.xp).toBe(xp + 15 + 15 + 15 + 40);
    expect(session.state.days[MON]?.cleanSweep).toBe(true);
    expect(session.state.notices.find((notice) => notice.kind === 'auto-claimed')?.data).toEqual({
      count: 2,
      xp: 30,
    });
    expect(session.state.quests.daily?.key).toBe(day(1));

    const idle = plantedSession(noon(0));
    const before = idle.state.xp;
    idle.tick(noon(3));
    expect(idle.state.xp).toBe(before);
    expect(idle.state.quests.claims).toEqual([]);
  });

  it('settles the week on Monday and auto-claims its finished quests', () => {
    const session = plantedSession(noon(0));
    withBoard(session, [], ['w_five_alive', 'w_ten_plates', 'w_sampler']);
    for (let offset = 0; offset < 5; offset += 1) session.at(noon(offset) + 1000, water);
    const before = session.state.quests.claims.filter((claim) => claim.kind === 'weekly');
    expect(before).toEqual([]);
    session.tick(noon(7));
    const weekly = session.state.quests.claims.filter((claim) => claim.kind === 'weekly');
    expect(weekly).toMatchObject([
      { questId: 'w_five_alive', period: 'W2026-10-05', auto: true, xp: 60 },
    ]);
    expect(session.state.quests.weekly?.key).toBe('W2026-10-12');
  });

  it('awards the hat trick for three weeklies in one week', () => {
    const session = plantedSession(noon(0));
    withBoard(session, [], ['w_five_alive', 'w_sampler', 'w_use_your_voice']);
    const acts = [
      'plant-based-meal',
      'bus-instead-of-car',
      'standby-off',
      'civic-action',
      'litter-pick',
    ];
    acts.forEach((actionId, offset) =>
      session.at(noon(offset) + 1000, (ctx) => logAction(ctx, { actionId })),
    );
    for (const id of ['w_five_alive', 'w_sampler', 'w_use_your_voice']) {
      expect(session.at(noon(4) + 5000, (ctx) => claimQuest(ctx, id)).ok).toBe(true);
    }
    expect(session.state.badges['hat-trick']?.tier).toBe(1);
  });
});

describe('swapping', () => {
  it('replaces a quest without progress, once per period, skipping the board', () => {
    const session = plantedSession(noon(0));
    const before = session.state.quests.daily!;
    const result = session.at(noon(0) + 1000, (ctx) => swapQuest(ctx, 'daily', 1));
    expect(result.ok).toBe(true);
    const after = session.state.quests.daily!;
    expect(after.slots[0]).toBe(before.slots[0]);
    expect(after.slots[2]).toBe(before.slots[2]);
    expect(after.slots[1]).not.toBe(before.slots[1]);
    expect(new Set(after.slots).size).toBe(3);
    expect(after.swapsUsed).toBe(1);
    expect(after.swapOffsets[1]).toBeGreaterThanOrEqual(1);
    expect(['eat', 'move']).toContain(DAILY_QUEST_BY_ID.get(after.slots[1])?.pool);
    expect(session.at(noon(0) + 2000, (ctx) => swapQuest(ctx, 'daily', 2))).toEqual({
      ok: false,
      reason: 'no-swaps-left',
    });
    expect(session.at(noon(0) + 3000, (ctx) => swapQuest(ctx, 'weekly', 0)).ok).toBe(true);
    session.at(noon(1), water);
    expect(session.state.quests.daily?.swapsUsed).toBe(0);
    expect(session.state.quests.weekly?.swapsUsed).toBe(1);
  });

  it('is deterministic', () => {
    const one = plantedSession(noon(0));
    const two = plantedSession(noon(0));
    one.at(noon(0) + 1000, (ctx) => swapQuest(ctx, 'daily', 2));
    two.at(noon(0) + 1000, (ctx) => swapQuest(ctx, 'daily', 2));
    expect(one.state.quests.daily).toEqual(two.state.quests.daily);
  });

  it('refuses a quest that already has progress or a bad slot', () => {
    const session = plantedSession(noon(0));
    withBoard(session, ['d_first_light', 'd_plant_plate', 'd_sorted']);
    expect(session.at(noon(0) + 1000, (ctx) => swapQuest(ctx, 'daily', 0))).toEqual({
      ok: false,
      reason: 'has-progress',
    });
    expect(session.at(noon(0) + 1000, (ctx) => swapQuest(ctx, 'daily', 3))).toEqual({
      ok: false,
      reason: 'bad-slot',
    });
    expect(session.at(noon(0) + 1000, (ctx) => swapQuest(ctx, 'daily', 1)).ok).toBe(true);
  });
});

describe('epics', () => {
  const statusOf = (state: GameState, id: string, today = MON) =>
    epicStatus(
      state,
      EPICS.find((epic) => epic.id === id)!,
      today,
    );

  it('tracks automatic epics from logs and claims them once', () => {
    const session = plantedSession(noon(0));
    expect(statusOf(session.state, 'e_grounded')).toMatchObject({
      claimable: false,
      selfAttested: false,
    });
    session.at(noon(0) + 1000, (ctx) =>
      logAction(ctx, { actionId: 'train-instead-of-short-flight-trip' }),
    );
    expect(session.eventsOf('quest-claimable').map((event) => event.questId)).toContain(
      'e_grounded',
    );
    expect(statusOf(session.state, 'e_grounded').claimable).toBe(true);
    const xp = session.state.xp;
    expect(session.at(noon(0) + 2000, (ctx) => claimEpic(ctx, 'e_grounded', false))).toEqual({
      ok: true,
      xp: 400,
    });
    expect(session.state.xp).toBe(xp + 400 + 40);
    expect(session.state.badges['epic-tale']?.tier).toBe(1);
    expect(session.at(noon(0) + 3000, (ctx) => claimEpic(ctx, 'e_grounded', false))).toEqual({
      ok: false,
      reason: 'already-claimed',
    });
    expect(session.at(noon(0) + 3000, (ctx) => claimEpic(ctx, 'e_nope', true))).toEqual({
      ok: false,
      reason: 'unknown-quest',
    });
  });

  it('voids an automatic epic claimed today when its log is undone', () => {
    const session = plantedSession(noon(0));
    const log = session.at(noon(0) + 1000, (ctx) =>
      logAction(ctx, { actionId: 'train-instead-of-short-flight-trip' }),
    );
    session.at(noon(0) + 2000, (ctx) => claimEpic(ctx, 'e_grounded', false));
    if (!log.ok) throw new Error('refused');
    session.at(noon(0) + 3000, (ctx) => removeLog(ctx, log.log.id));
    expect(statusOf(session.state, 'e_grounded')).toMatchObject({
      claimed: false,
      claimable: false,
    });
    expect(session.state.quests.claims).toEqual([]);
  });

  it('needs the checklist and a confirmation for a self-attested epic', () => {
    const session = plantedSession(noon(0));
    expect(session.at(noon(0) + 1000, (ctx) => claimEpic(ctx, 'e_energy_checkup', true))).toEqual({
      ok: false,
      reason: 'not-attested',
    });
    session.at(noon(0) + 2000, (ctx) =>
      updateEpic(ctx, 'e_energy_checkup', { checklist: [true, true, true, true, false] }),
    );
    expect(statusOf(session.state, 'e_energy_checkup').claimable).toBe(false);
    session.at(noon(0) + 3000, (ctx) =>
      updateEpic(ctx, 'e_energy_checkup', { checklist: [true, true, true, true, true] }),
    );
    expect(statusOf(session.state, 'e_energy_checkup').claimable).toBe(true);
    expect(session.at(noon(0) + 4000, (ctx) => claimEpic(ctx, 'e_energy_checkup', false))).toEqual({
      ok: false,
      reason: 'not-attested',
    });
    expect(session.at(noon(0) + 5000, (ctx) => claimEpic(ctx, 'e_energy_checkup', true))).toEqual({
      ok: true,
      xp: 300,
    });
  });

  it('allows one self-attested epic per seven days', () => {
    const session = plantedSession(noon(0));
    expect(session.at(noon(0) + 1000, (ctx) => claimEpic(ctx, 'e_green_power', true)).ok).toBe(
      true,
    );
    session.at(noon(1), (ctx) =>
      updateEpic(ctx, 'e_bin_audit', { note: 'crisp bags → bulk\ncans → refill\nwrap → box' }),
    );
    expect(statusOf(session.state, 'e_bin_audit', day(1))).toMatchObject({
      attestationFilled: true,
      cooldownDays: 6,
      claimable: false,
    });
    expect(session.at(noon(6), (ctx) => claimEpic(ctx, 'e_bin_audit', true))).toEqual({
      ok: false,
      reason: 'cooldown',
    });
    expect(session.at(noon(7), (ctx) => claimEpic(ctx, 'e_bin_audit', true))).toEqual({
      ok: true,
      xp: 200,
    });
    expect(statusOf(session.state, 'e_grounded', day(7)).cooldownDays).toBe(0);
  });

  it('needs every field of a form and the note of an advocate', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => updateEpic(ctx, 'e_bin_audit', { note: 'one\n\nthree' }));
    expect(statusOf(session.state, 'e_bin_audit').attestationFilled).toBe(false);
    expect(statusOf(session.state, 'e_advocate')).toMatchObject({
      attestationFilled: false,
      claimable: false,
    });
    session.at(noon(0) + 2000, (ctx) => logAction(ctx, { actionId: 'civic-action' }));
    session.at(noon(0) + 3000, (ctx) =>
      updateEpic(ctx, 'e_advocate', { note: 'Safe cycle lanes on the high street' }),
    );
    expect(statusOf(session.state, 'e_advocate').claimable).toBe(true);
  });

  it('finds the best 30-day window and counts rings and lessons', () => {
    const session = plantedSession(noon(0));
    for (let offset = 0; offset < 14; offset += 1) {
      session.at(noon(offset * 3) + 1000, (ctx) => logAction(ctx, { actionId: 'car-free-day' }));
    }
    expect(statusOf(session.state, 'e_car_light_month', day(42)).progress).toEqual({
      current: 10,
      target: 12,
      done: false,
    });
    for (let offset = 40; offset < 44; offset += 1) {
      session.at(noon(offset) + 1000, (ctx) => logAction(ctx, { actionId: 'car-free-day' }));
    }
    expect(statusOf(session.state, 'e_car_light_month', day(46)).progress.done).toBe(true);
    expect(statusOf(session.state, 'e_thirty_rings', day(46)).progress).toEqual({
      current: 18,
      target: 30,
      done: false,
    });

    LESSON_SLUGS.forEach((slug, index) =>
      session.at(noon(50 + index), (ctx) => completeLesson(ctx, slug, 2)),
    );
    expect(statusOf(session.state, 'e_climate_literate', day(60)).claimable).toBe(true);
    expect(allEpicStatuses(session.state, day(60))).toHaveLength(12);
  });

  it('pins one epic and unpins it when claimed', () => {
    const session = plantedSession(noon(0));
    expect(session.at(noon(0) + 1000, (ctx) => pinEpic(ctx, 'e_green_power'))).toBe(true);
    expect(session.at(noon(0) + 1000, (ctx) => pinEpic(ctx, 'e_nope'))).toBe(false);
    expect(statusOf(session.state, 'e_green_power').pinned).toBe(true);
    session.at(noon(0) + 2000, (ctx) => claimEpic(ctx, 'e_green_power', true));
    expect(session.state.quests.pinnedEpic).toBeNull();
  });

  it('offers every weekly quest somewhere in a year', () => {
    const seen = new Set<string>();
    for (let week = 0; week < 60; week += 1) {
      for (const focus of [
        ['eat', 'move'],
        ['power', 'water'],
        ['stuff', 'waste', 'nature'],
      ] as CategoryId[][]) {
        for (const id of drawWeekly(day(week * 7), input({ focus }))) seen.add(id);
      }
    }
    expect(seen.size).toBe(WEEKLY_QUESTS.length);
  });
});
