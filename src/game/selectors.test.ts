import { describe, expect, it } from 'vitest';
import type { CoachContext } from '@/ai/contract';
import { LESSON_IDS } from '@/data/lessons';
import { addDays } from '@/lib/dates';
import { ISLAND_PROPS } from '@/world/contract';
import { addPost, createChallenge } from './community';
import { setActionHidden, setBaseline, updateSettings, water } from './engine';
import { LESSON_SLUGS, completeLesson } from './lessons';
import { logAction, logCustom } from './logging';
import { claimQuest } from './quests';
import {
  createGameSelector,
  dayOneCopy,
  impactHeadline,
  noticeText,
  partOfDay,
  selectActionStates,
  selectBadges,
  selectBaseline,
  selectChallenge,
  selectClock,
  selectCoachContext,
  selectHud,
  selectImpact,
  selectIslandLog,
  selectJournal,
  selectLearn,
  selectLevelInfo,
  selectNotices,
  selectPassport,
  selectQuests,
  selectQuickLog,
  selectRecap,
  selectStreak,
  selectTodaySummary,
  selectTouchGrass,
  selectTreeStatus,
  selectWorldSnapshot,
  type GameSelector,
} from './selectors';
import { createInitialState } from './state';
import { GameSession, localTime, plantedSession } from './testkit';
import { startBreak } from './touchGrass';
import type { GameState } from './types';

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

/** Twelve days of the "typical" routine: the state the Today mock-ups show. */
function twelveDays(): GameSession {
  const session = plantedSession(localTime(MON, 8));
  session.at(localTime(MON, 8) + 500, (ctx) => setBaseline(ctx, UK));
  for (let offset = 0; offset < 12; offset += 1) {
    const base = localTime(day(offset), 8, 30);
    session.at(base, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 1 }));
    session.at(base + 5000, (ctx) => logAction(ctx, { actionId: 'bus-instead-of-car', qty: 5 }));
    if (offset % 2 === 0)
      session.at(base + 9000, (ctx) => logAction(ctx, { actionId: 'refuse-single-use-bottle' }));
  }
  return session;
}

/** Estimated kg of the scenario above: a meal and a bus trip a day, a bottle every other day. */
const TWELVE_DAYS_KG = 12 * (1.52 + 5 * 0.0819) + 6 * 0.0772;

describe('selector memoisation', () => {
  it('returns the same object until an input changes', () => {
    let runs = 0;
    const selector = createGameSelector(
      (game) => [game.xp, game.tree],
      (game) => {
        runs += 1;
        return { xp: game.xp };
      },
    );
    const state = createInitialState(noon(0));
    const first = selector(state, 1);
    expect(selector(state, 2)).toBe(first);
    expect(selector({ ...state, logs: [] }, 3)).toBe(first);
    expect(runs).toBe(1);
    expect(selector({ ...state, xp: 5 }, 4)).not.toBe(first);
    expect(runs).toBe(2);
  });

  it('keeps every read model stable across clock ticks within a day', () => {
    const session = twelveDays();
    const now = localTime(day(11), 14);
    const selectors: GameSelector<unknown>[] = [
      selectLevelInfo,
      selectTreeStatus,
      selectStreak,
      selectTodaySummary,
      selectActionStates,
      selectQuickLog,
      selectQuests,
      selectBadges,
      selectImpact,
      selectBaseline,
      selectLearn,
      selectTouchGrass,
      selectJournal,
      selectChallenge,
      selectNotices,
      selectRecap,
      selectPassport,
      selectHud,
      selectClock,
      selectIslandLog,
    ];
    for (const selector of selectors) {
      const first = selector(session.state, now);
      expect(selector(session.state, now + 1)).toBe(first);
      expect(selector(session.state, now + 3_600_000)).toBe(first);
      expect(selector({ ...session.state }, now + 60_000)).toBe(first);
    }
    const world = selectWorldSnapshot(session.state, now);
    expect(selectWorldSnapshot(session.state, now + 10_000)).toBe(world);
    expect(selectWorldSnapshot(session.state, now + 3_600_000)).not.toBe(world);
  });

  it('recomputes when the day rolls over', () => {
    const session = twelveDays();
    const today = selectTodaySummary(session.state, localTime(day(11), 14));
    const tomorrow = selectTodaySummary(session.state, localTime(day(12), 0, 1));
    expect(today.day).toBe(day(11));
    expect(tomorrow).toMatchObject({ day: day(12), checkedIn: false, logs: [], actsToRing: 3 });
  });
});

describe('the Today read models', () => {
  const session = twelveDays();
  const now = localTime(day(11), 14);

  it('describes the tree in words', () => {
    const tree = selectTreeStatus(session.state, now);
    expect(tree).toMatchObject({
      name: 'Fern',
      species: 'oak',
      stage: 'Sapling',
      nextStage: 'Young tree',
      rings: 12,
      vitality: 'thriving',
      vitalityLabel: 'Thriving',
      vitalityValue: 1,
      dayNumber: 12,
      checkedInToday: true,
      ringClosedToday: false,
      actsToRing: 1,
      statusLine: "1 more action closes today's ring.",
    });
    expect(tree.stageLabel).toMatch(/^Sapling → Young tree \d+\.\d%$/);
    expect(tree.sceneLabel).toBe('Fern, a 12-ring oak sapling, thriving');
    expect(tree.growth).toBeGreaterThan(0.12);
    expect(tree.growth).toBeLessThan(0.35);
  });

  it('walks the status line through a day', () => {
    const fresh = plantedSession(noon(0));
    expect(selectTreeStatus(fresh.state, noon(0)).statusLine).toBe(
      'Log one action to give Fern its first leaf.',
    );
    expect(dayOneCopy(fresh.state)).toBe(
      'Come back tomorrow — one full ring turns your sprout into a seedling.',
    );
    fresh.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal' }));
    expect(selectTreeStatus(fresh.state, noon(0) + 1000).statusLine).toBe(
      "2 more actions close today's ring.",
    );
    fresh.at(noon(0) + 5000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 2 }));
    expect(selectTreeStatus(fresh.state, noon(0) + 5000).statusLine).toBe(
      'Ring closed. See you tomorrow?',
    );
    expect(dayOneCopy(fresh.state)).toBe('Your sprout is one drink away from becoming a seedling.');
    expect(selectTreeStatus(fresh.state, noon(1)).statusLine).toBe('Fern could use a drink.');
    fresh.tick(noon(4));
    expect(selectTreeStatus(fresh.state, noon(4))).toMatchObject({
      vitality: 'thirsty',
      statusLine: 'Fern is thirsty. One tap fixes that.',
    });
    fresh.tick(noon(12));
    expect(selectTreeStatus(fresh.state, noon(12)).statusLine).toBe(
      'Fern is resting. It kept every ring. Wake it up?',
    );
    fresh.at(noon(12), water);
    expect(selectTreeStatus(fresh.state, noon(12)).statusLine).toBe(
      "Waking up. Close today's ring and it's thriving again.",
    );
    expect(dayOneCopy(fresh.state)).toBeNull();
  });

  it('sums today and reports what is left', () => {
    const today = selectTodaySummary(session.state, now);
    expect(today).toMatchObject({
      day: day(11),
      checkedIn: true,
      rewardedActs: 2,
      ringGoal: 3,
      ringClosed: false,
      actsToRing: 1,
      logXp: 27,
      logXpLeft: 123,
      xp: 37,
      gp: 17,
      gpLeft: 13,
      cleanSweep: false,
      customLeft: 2,
      dayOneCopy: null,
    });
    expect(today.logs.map((log) => log.actionId)).toEqual([
      'bus-instead-of-car',
      'plant-based-meal',
    ]);
    expect(today.kg).toBeCloseTo(1.52 + 5 * 0.0819, 8);
    expect(today.fact?.number).toBeGreaterThanOrEqual(1);
    expect(selectTodaySummary(session.state, localTime(day(12), 9)).fact).toBeNull();
  });

  it('shows streak, rain and the week strip', () => {
    const streak = selectStreak(session.state, now);
    expect(streak).toMatchObject({
      current: 12,
      best: 12,
      rainCap: 2,
      rainGoal: 5,
      nextMilestone: { days: 14, xp: 50 },
      restDays: [],
    });
    expect(streak.week).toHaveLength(7);
    expect(streak.week.map((entry) => entry.mark)).toEqual([
      'ring',
      'full',
      'ring',
      'full',
      'ring',
      'none',
      'none',
    ]);
    expect(streak.activeThisWeek).toBe(5);
  });

  it('feeds the HUD', () => {
    const hud = selectHud(session.state, now);
    expect(hud).toMatchObject({ streak: 12, rings: 12, treeName: 'Fern' });
    expect(hud.level).toBe(selectLevelInfo(session.state, now).level);
    expect(hud.kgLabel).toMatch(/^≈ \d+ kg$/);
    expect(hud.kg).toBeCloseTo(TWELVE_DAYS_KG, 6);
  });
});

describe('actions and quick-log', () => {
  it('lists all 51 actions with caps, estimates and one-tap quantities', () => {
    const session = twelveDays();
    const now = localTime(day(11), 14);
    const states = selectActionStates(session.state, now);
    expect(states).toHaveLength(51);
    const byId = new Map(states.map((state) => [state.action.id, state]));
    expect(byId.get('plant-based-meal')).toMatchObject({
      actsLeft: 2,
      unitsLeft: 2,
      maxed: false,
      quickQty: 1,
      inFocus: true,
      hidden: false,
    });
    expect(byId.get('plant-based-meal')?.kgPerUnit).toBe(1.52);
    expect(byId.get('plant-based-meal')?.recentLogs).toBe(12);
    expect(byId.get('litter-pick')).toMatchObject({
      kgPerUnit: null,
      recentLogs: 0,
      inFocus: false,
    });
    expect(byId.get('vegan-day')?.blocked?.reason).toBe('meals-logged');
    expect(byId.get('bus-instead-of-car')).toMatchObject({ actsLeft: 1, quickQty: 5 });
  });

  it('builds six one-tap tiles from use, padded from the focus areas', () => {
    const session = twelveDays();
    const tiles = selectQuickLog(session.state, localTime(day(11), 14));
    expect(tiles).toHaveLength(6);
    expect(tiles.slice(0, 3).map((tile) => tile.action.id)).toEqual([
      'bus-instead-of-car',
      'plant-based-meal',
      'refuse-single-use-bottle',
    ]);
    expect(new Set(tiles.map((tile) => tile.action.id)).size).toBe(6);

    const fresh = plantedSession(noon(0), { focus: ['water'] });
    const starters = selectQuickLog(fresh.state, noon(0)).map((tile) => tile.action.id);
    expect(starters).toHaveLength(6);
    expect(starters[0]).toBe('shorter-shower');
    fresh.at(noon(0) + 1000, (ctx) => setActionHidden(ctx, 'shorter-shower', true));
    expect(selectQuickLog(fresh.state, noon(0) + 1000).map((tile) => tile.action.id)).not.toContain(
      'shorter-shower',
    );
  });

  it('sinks maxed tiles to the end', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }));
    const tiles = selectQuickLog(session.state, noon(0) + 1000);
    expect(tiles[tiles.length - 1]?.action.id).toBe('plant-based-meal');
    expect(tiles[tiles.length - 1]?.maxed).toBe(true);
  });
});

describe('quests and badges', () => {
  it('presents the board with progress, claims and time left', () => {
    const session = plantedSession(noon(0));
    const now = noon(0) + 5000;
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }));
    const board = selectQuests(session.state, now);
    expect(board.daily).toHaveLength(3);
    expect(board.weekly).toHaveLength(3);
    expect(board.epics).toHaveLength(12);
    expect(board.weeklyDaysLeft).toBe(7);
    expect(board.dailyResetsAt).toBe(localTime(day(1), 0));
    expect(board.allEpicsClaimed).toBe(false);
    for (const quest of [...board.daily, ...board.weekly]) {
      expect(quest.progressText).toMatch(/^\d+ \/ \d+$/);
      expect(quest.ratio).toBeGreaterThanOrEqual(0);
      expect(quest.ratio).toBeLessThanOrEqual(1);
      expect(quest.claimable).toBe(quest.progress.done);
    }
    const claimable = board.daily.find((quest) => quest.claimable);
    if (claimable) {
      session.at(now, (ctx) => claimQuest(ctx, claimable.id));
      const after = selectQuests(session.state, now).daily.find(
        (quest) => quest.id === claimable.id,
      );
      expect(after).toMatchObject({ claimed: true, claimable: false, canSwap: false });
    }
    expect(selectQuests(session.state, localTime(day(3), 9)).weeklyDaysLeft).toBe(4);
  });

  it('summarises badges and derives the island props', () => {
    const session = twelveDays();
    const board = selectBadges(session.state, localTime(day(11), 14));
    expect(board.all).toHaveLength(33);
    expect(board.tiersTotal).toBe(15 * 3 + 18);
    expect(board.tiersEarned).toBeGreaterThanOrEqual(5);
    expect(board.props).toEqual(['flowers', 'veggie-patch', 'birdhouse', 'fireflies', 'signpost']);
    for (const prop of board.props) expect(ISLAND_PROPS).toContain(prop);
    expect(board.nearest?.hidden).toBe(false);
    expect(board.recent.length).toBeGreaterThan(0);
    expect(board.recent[0]?.ts).toBeGreaterThanOrEqual(board.recent[1]?.ts ?? 0);
  });
});

describe('impact', () => {
  it('starts empty and honest', () => {
    const fresh = plantedSession(noon(0));
    const impact = selectImpact(fresh.state, noon(0));
    expect(impact).toMatchObject({
      empty: true,
      kg: 0,
      aiKg: 0,
      logs: 0,
      topCategory: null,
      equivalences: [],
    });
    expect(impact.pace).toEqual({ status: 'no-baseline' });
    expect(impact.heatmap).toHaveLength(1);
    expect(impact.weeks).toHaveLength(12);
  });

  it('totals, categories, weeks, heatmap, equivalences and pace', () => {
    const session = twelveDays();
    session.at(localTime(day(11), 13), (ctx) =>
      logCustom(ctx, { title: 'Fixed a bike', category: 'stuff', effort: 3, co2eKg: 1.2 }),
    );
    const now = localTime(day(11), 14);
    const impact = selectImpact(session.state, now);
    const expected = TWELVE_DAYS_KG;
    expect(impact.kg).toBeCloseTo(expected, 6);
    expect(impact.aiKg).toBe(1.2);
    expect(impact.logs).toBe(31);
    expect(impact.rings).toBe(12);
    expect(impact.topCategory).toBe('move');
    expect(impact.byCategory.map((entry) => entry.category)).toEqual([
      'move',
      'eat',
      'power',
      'water',
      'stuff',
      'waste',
      'nature',
    ]);
    expect(impact.byCategory.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1, 10);
    expect(impact.byCategory.find((entry) => entry.category === 'stuff')?.kg).toBe(0);
    expect(impact.heatmap).toHaveLength(12);
    expect(impact.heatmap[0]).toMatchObject({ day: MON, mark: 'full', acts: 3, logs: 3 });
    expect(impact.heatmap[1]).toMatchObject({ mark: 'ring', acts: 2 });
    expect(impact.weeks.slice(-2).map((week) => week.rings)).toEqual([7, 5]);
    expect(impact.weeks.reduce((sum, week) => sum + week.kg, 0)).toBeCloseTo(expected, 6);
    expect(impact.equivalences).toHaveLength(2);
    expect(impact.pace.status).toBe('not-enough-data');
    expect(impact.paceHeadline).toBe(
      'Two weeks of logs and this card wakes up. 7 of 7 active days so far.',
    );
    expect(impactHeadline(impact)).toEqual({
      total: '≈ 24 kg estimated CO2e avoided',
      ai: '＋ ≈ 1.2 kg from AI estimates',
    });
    expect(impactHeadline({ kg: 3, aiKg: 0 }).ai).toBeNull();

    for (let offset = 12; offset < 16; offset += 1) {
      session.at(localTime(day(offset), 9), (ctx) =>
        logAction(ctx, { actionId: 'plant-based-meal', qty: 2 }),
      );
    }
    const later = selectImpact(session.state, localTime(day(15), 14));
    expect(later.pace.status).toBe('ok');
    expect(later.paceHeadline).toMatch(
      /^At your last 2 weeks' pace, the actions you log would avoid ≈ .+ CO2e a year — about \d+% of your starting line \(≈ 8\.0 t\)\.$/,
    );
    expect(later.habits.acts).toBe(0);
  });

  it('caps the heatmap at 371 days', () => {
    const session = plantedSession(noon(0));
    session.tick(noon(500));
    expect(selectImpact(session.state, noon(500)).heatmap).toHaveLength(371);
  });

  it('presents the baseline', () => {
    const session = twelveDays();
    const view = selectBaseline(session.state, noon(11));
    expect(view).toMatchObject({
      totalLabel: '≈ 8.0 t',
      low: false,
      regionName: 'World',
      retakes: 0,
    });
    expect(view?.levers.map((lever) => lever.label)).toEqual(['Food', 'Getting around']);
    expect(selectBaseline(plantedSession(noon(0)).state, noon(0))).toBeNull();
  });
});

describe('the world seam', () => {
  it('hands the world exactly the contract, derived from state', () => {
    const session = twelveDays();
    const snapshot = selectWorldSnapshot(session.state, localTime(day(11), 14, 30));
    expect(Object.keys(snapshot).sort()).toEqual([
      'ageDays',
      'growth',
      'hour',
      'props',
      'seed',
      'species',
      'vitality',
    ]);
    expect(snapshot).toMatchObject({ species: 'oak', ageDays: 12, vitality: 1, hour: 14.5 });
    expect(snapshot.seed).toBe(session.state.profile.userSeed);
    expect(snapshot.growth).toBeGreaterThan(0.12);
    expect(snapshot.props).toEqual([
      'flowers',
      'veggie-patch',
      'birdhouse',
      'fireflies',
      'signpost',
    ]);
  });

  it('follows vitality and the "always day" setting', () => {
    const session = plantedSession(noon(0));
    session.tick(noon(3));
    expect(selectWorldSnapshot(session.state, localTime(day(3), 23)).vitality).toBe(0.62);
    expect(selectWorldSnapshot(session.state, localTime(day(3), 23)).hour).toBe(23);
    session.tick(noon(9));
    expect(selectWorldSnapshot(session.state, noon(9)).vitality).toBe(0);
    session.at(noon(9), (ctx) => updateSettings(ctx, { sky: 'day' }));
    expect(selectWorldSnapshot(session.state, localTime(day(9), 23)).hour).toBe(12);
    const fresh = selectWorldSnapshot(createInitialState(noon(0)), noon(0));
    expect(fresh).toMatchObject({ growth: 0, ageDays: 0, props: [], vitality: 1 });
  });

  it('never lets growth fall as the clock moves', () => {
    const session = twelveDays();
    const growth = selectWorldSnapshot(session.state, noon(11)).growth;
    for (const offset of [12, 20, 100, 400]) {
      session.tick(noon(offset));
      expect(selectWorldSnapshot(session.state, noon(offset)).growth).toBe(growth);
    }
  });
});

describe('the coach seam', () => {
  it('builds a compact context the AI contract accepts', () => {
    const session = twelveDays();
    session.at(localTime(day(11), 13), (ctx) =>
      addPost(ctx, { text: 'A private thought the coach must never see.' }),
    );
    session.at(localTime(day(11), 13) + 1, (ctx) =>
      logCustom(ctx, { title: 'Secret custom thing', category: 'stuff', effort: 2 }),
    );
    const now = localTime(day(11), 19);
    const context = selectCoachContext(session.state, now, {
      lessonTitles: { 'big-levers': 'Big levers vs. small gestures' },
    });
    const accepted: CoachContext = context;
    expect(accepted).toBe(context);
    expect(context).toMatchObject({
      displayName: 'Maya',
      region: 'WORLD',
      partOfDay: 'evening',
      tree: { name: 'Fern', species: 'oak', stage: 'Sapling', vitality: 'thriving' },
      streak: 12,
      rings: 12,
      focus: ['eat', 'move'],
      ringLeft: 0,
      baseline: '8.0 t a year, mostly food and getting around',
      nextLesson: { slug: 'big-levers', title: 'Big levers vs. small gestures' },
    });
    expect(context.totals?.kgTotal).toBeCloseTo(TWELVE_DAYS_KG, 1);
    // A tie between Move and Eat goes to the catalogue's order.
    expect(context.topCategories?.slice(0, 2)).toMatchObject([
      { category: 'move', count: 7 },
      { category: 'eat', count: 7 },
    ]);
    expect(selectCoachContext(session.state, now).nextLesson?.title).toBe('Big levers');
    expect(context.actions).toHaveLength(51);
    expect(context.actions?.find((action) => action.id === 'vegan-day')?.doneToday).toBe(true);
    expect(context.lessonSlugs).toEqual([...LESSON_SLUGS]);
    expect(context.quests?.length).toBeGreaterThan(0);
    expect(context.quests?.[0]?.line).toMatch(/\(\d+ \/ \d+\)$/);
    expect(context.recentActions?.map((recent) => recent.title)).toEqual([
      'Took the bus instead of driving',
      'Plant-based meal',
      'Refilled my bottle',
    ]);

    const json = JSON.stringify(context);
    expect(json).not.toContain('private thought');
    expect(json).not.toContain('Secret custom thing');
    expect(json).not.toMatch(/"ts"|checkInTs|userSeed|medium-meat/);
    const withoutCatalogue = JSON.stringify({
      ...context,
      actions: undefined,
      lessonSlugs: undefined,
    });
    expect(withoutCatalogue.length).toBeLessThan(1500);
  });

  it('shrinks to the region and the catalogue when sharing is off', () => {
    const session = twelveDays();
    session.at(noon(11), (ctx) => setActionHidden(ctx, 'thermostat-down-1c', true));
    session.at(noon(11) + 1, (ctx) => updateSettings(ctx, { shareStatsWithCoach: false }));
    const context = selectCoachContext(session.state, noon(11) + 2);
    expect(Object.keys(context).sort()).toEqual([
      'actions',
      'displayName',
      'lessonSlugs',
      'region',
    ]);
    expect(context.actions).toHaveLength(50);
    expect(context.actions?.every((action) => !('doneToday' in action))).toBe(true);
    const visitor = selectCoachContext(createInitialState(noon(0)), noon(0));
    expect(Object.keys(visitor).sort()).toEqual([
      'actions',
      'displayName',
      'lessonSlugs',
      'region',
    ]);
  });

  it('names the part of the day without a timestamp', () => {
    expect(
      [3, 5, 11, 12, 17, 18, 21, 22, 23].map((hour) => partOfDay(localTime(MON, hour))),
    ).toEqual([
      'night',
      'morning',
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
      'night',
      'night',
    ]);
  });

  it('uses the same lesson ids as the content module', () => {
    expect([...LESSON_SLUGS]).toEqual([...LESSON_IDS]);
  });
});

describe('learn, breaks, community, notices, recap, passport', () => {
  it('lists the lessons with their state', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => completeLesson(ctx, 'the-blanket', 3));
    const learn = selectLearn(session.state, noon(0) + 1000);
    expect(learn).toMatchObject({
      passed: 1,
      total: 10,
      recommended: 'big-levers',
      mythsFlipped: [],
    });
    expect(learn.lessons[0]).toMatchObject({
      slug: 'the-blanket',
      status: 'passed',
      recommended: false,
    });
    expect(learn.lessons.find((lesson) => lesson.recommended)?.slug).toBe('big-levers');
  });

  it('follows a running break', () => {
    const session = plantedSession(noon(0));
    expect(selectTouchGrass(session.state, noon(0))).toMatchObject({
      active: null,
      cooldownMin: 0,
      suggestedMin: 10,
      rewardedToday: false,
    });
    session.at(noon(0) + 1000, (ctx) => startBreak(ctx, 20));
    const status = selectTouchGrass(session.state, noon(0) + 1000 + 5 * 60_000);
    expect(status.active).toMatchObject({
      plannedMin: 20,
      endsAt: noon(0) + 1000 + 20 * 60_000,
      remainingMs: 15 * 60_000,
    });
    expect(status.active?.verdict.kept).toBe(false);
    expect(selectTouchGrass(session.state, noon(0) + 1000 + 25 * 60_000).active?.verdict.kept).toBe(
      true,
    );
  });

  it('orders the journal and describes a challenge', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => addPost(ctx, { text: 'first' }));
    session.at(noon(0) + 2000, (ctx) => addPost(ctx, { text: 'second' }));
    expect(selectJournal(session.state, noon(0)).map((note) => note.text)).toEqual([
      'second',
      'first',
    ]);
    expect(selectChallenge(session.state, noon(0))).toBeNull();
    session.at(noon(0) + 3000, (ctx) => createChallenge(ctx, { templateId: 'rings_5' }));
    expect(selectChallenge(session.state, noon(0) + 3000)).toMatchObject({
      progressText: '0 / 5 full rings',
      finished: false,
      invite: null,
    });
  });

  it('words every notice', () => {
    const session = plantedSession(noon(0));
    session.tick(noon(2));
    expect(selectNotices(session.state, noon(2))[0]?.text).toBe(
      'It rained while you were away. Fern is fine, and so is your 1-day streak.',
    );
    const notice = (kind: Parameters<typeof noticeText>[0]['kind'], data: Record<string, number>) =>
      noticeText({ id: 'x', kind, ts: 0, day: MON, data }, 'Fern');
    expect(notice('streak-rested', { streak: 9 })).toBe(
      'Your streak rested at 9 days — your best is safe. Today is day 1, and Fern kept everything.',
    );
    expect(notice('auto-claimed', { count: 2, xp: 35 })).toBe(
      'While you were away: 2 finished quests claimed for you, +35 XP.',
    );
    expect(notice('challenge-ended', { done: 3, of: 5 })).toBe("Time's up — 3 of 5. Rematch?");
    expect(notice('legacy-imported', { logs: 1 })).toMatch(/^1 action came along/);
    const banned = /died|dead|lost|failed|broke/i;
    for (const kind of [
      'rain-return',
      'streak-rested',
      'auto-claimed',
      'challenge-ended',
      'legacy-imported',
      'woke-up',
    ] as const) {
      expect(notice(kind, { streak: 3, count: 1, xp: 1, done: 1, of: 2, logs: 2 })).not.toMatch(
        banned,
      );
    }
  });

  it('offers the recap on the first open of a new week', () => {
    const firstWeek = plantedSession(noon(0));
    expect(selectRecap(firstWeek.state, localTime(day(6), 9)).pending).toBeNull();
    const session = twelveDays();
    const view = selectRecap(session.state, localTime(day(11), 15));
    expect(view.pending).toMatchObject({ week: 'W2026-10-05', rings: 7, empty: false });
    expect(view.weeks).toEqual(['W2026-10-05']);
  });

  it('fills the passport and the island log', () => {
    const session = twelveDays();
    const passport = selectPassport(session.state, localTime(day(11), 14));
    expect(passport).toMatchObject({
      treeName: 'Fern',
      speciesLabel: 'oak',
      plantedDay: MON,
      dayNumber: 12,
      stage: 'Sapling',
      rings: 12,
      fullRings: 6,
      ringSummary: '12 rings: 6 thick, 6 thin.',
      bestStreak: 12,
      minutesOutside: 0,
    });
    expect(passport.ringSequence).toHaveLength(12);
    expect(passport.ringSequence.slice(0, 2)).toEqual(['full', 'ring']);
    const log = selectIslandLog(session.state, 0).map((entry) => entry.text);
    expect(log[log.length - 1]).toBe('Day 1 · Fern planted');
    expect(log).toContain('Day 1 · The first flowers opened beside Fern.');
    expect(log.some((line) => line.endsWith('Fern became a sapling.'))).toBe(true);
  });

  it('flags a clock that was set back', () => {
    const session = twelveDays();
    expect(selectClock(session.state, localTime(day(11), 14))).toMatchObject({
      today: day(11),
      skewed: false,
    });
    expect(selectClock(session.state, noon(2))).toMatchObject({ today: day(11), skewed: true });
  });

  it('copes with a state that has no tree yet', () => {
    const blank: GameState = createInitialState(noon(0));
    expect(selectTreeStatus(blank, noon(0))).toMatchObject({
      name: 'Your tree',
      stage: 'Seed',
      rings: 0,
    });
    expect(selectQuests(blank, noon(0))).toMatchObject({ daily: [], weekly: [] });
    expect(selectRecap(blank, noon(0))).toEqual({ pending: null, weeks: [] });
    expect(selectImpact(blank, noon(0)).empty).toBe(true);
    expect(selectQuickLog(blank, noon(0))).toHaveLength(6);
    expect(new GameSession(blank).state).toBe(blank);
  });
});
