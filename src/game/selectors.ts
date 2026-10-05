/**
 * Read models for the UI. Every selector is a pure function of the persisted state and
 * the clock, and is memoised on exactly the slices it reads: called again with nothing
 * relevant changed, it returns the very same object. That makes each one safe to pass
 * straight to the store hook, with no shallow comparison and no render loop.
 */
import { BADGES, type BadgeDef } from '@/data/badges';
import {
  ACTIONS,
  ACTION_BY_ID,
  CATEGORIES,
  CATEGORY_IDS,
  GRID_BY_ID,
  type ActionDef,
  type CategoryId,
} from '@/data/catalogue';
import { DAILY_QUEST_BY_ID, WEEKLY_QUEST_BY_ID, type QuestDef } from '@/data/quests';
import {
  addDays,
  diffDays,
  hourOfDay,
  msUntilTomorrow,
  startOfWeek,
  weekKey,
  type DayKey,
} from '@/lib/dates';
import { formatCo2Estimate, formatNumber, formatTonnes, pluralize } from '@/lib/format';
import type { IslandPropId, WorldSnapshot } from '@/world/contract';
import { allBadgeStatuses, unlockedProps, type BadgeStatus } from './badges';
import {
  baselineSegments,
  biggestLevers,
  isLowFootprint,
  type BaselineSegmentShare,
} from './baseline';
import {
  activeDaysIn,
  effectiveDay,
  isClockSkewed,
  restDaysOn,
  weekStrip,
  type WeekStripDay,
} from './calendar';
import { kgPerUnit } from './co2';
import { challengeInviteText, challengeProgress, type ChallengeProgress } from './community';
import {
  DAILY_GOAL,
  GP_DAILY_CAP,
  LOG_XP_DAILY_CAP,
  RAIN_CAP,
  RAIN_FULL_RINGS_PER_CLOUD,
  STREAK_MILESTONES,
  XP_CHECK_IN,
  XP_RING_CLOSED,
} from './economy';
import { pickEquivalences, type Equivalence } from './equivalences';
import { growthInfo, growthOf, stageProgressLabel, type GrowthInfo } from './growth';
import { breaksOn, lifetimeLogStats, logsOn } from './indexes';
import {
  LESSONS,
  LESSON_SLUGS,
  dailyFact,
  lessonProgress,
  lessonStatus,
  recommendedLesson,
  type DailyFactRef,
  type LessonStatus,
} from './lessons';
import { levelInfo, type LevelInfo } from './levels';
import {
  actionAvailability,
  customActsLeft,
  lastUsedQty,
  type ActionAvailability,
} from './logging';
import {
  computePace,
  habitsHeld,
  habitsHeldCopy,
  paceHeadline,
  type HabitsHeld,
  type PaceResult,
} from './pace';
import {
  allEpicStatuses,
  conditionActions,
  dailyProgress,
  hiddenActionSet,
  isClaimed,
  isCleanSweepDay,
  weeklyProgress,
  type EpicStatus,
  type QuestProgress,
} from './quests';
import { gpEarnedOn, recapToShow, recapWeeks, weekRecap, type WeekRecap } from './recap';
import { scoreDay } from './scoring';
import { isOnboarded } from './state';
import {
  awayMsAt,
  breakCooldownMin,
  breakStats,
  judgeBreak,
  suggestedBreakMin,
  type BreakStats,
  type BreakVerdict,
} from './touchGrass';
import type {
  ActivityEntry,
  ChallengeState,
  DayMark,
  GameState,
  JournalNote,
  LessonProgress,
  LogEntry,
  Notice,
  SavedCustomAction,
  VitalityState,
  WeekKey,
} from './types';
import { vitalityCopy, vitalityLabel, vitalityValue } from './vitality';

export type GameSelector<T> = (game: GameState, now: number) => T;

/**
 * Builds a memoised selector. `inputs` lists what the result depends on; while every
 * input is identical to last time, the previous result is returned as is.
 */
export function createGameSelector<T>(
  inputs: (game: GameState, now: number) => readonly unknown[],
  compute: (game: GameState, now: number) => T,
): GameSelector<T> {
  let lastInputs: readonly unknown[] | null = null;
  let lastResult: T;
  return (game, now) => {
    const next = inputs(game, now);
    if (
      lastInputs !== null &&
      lastInputs.length === next.length &&
      next.every((value, index) => Object.is(value, (lastInputs as readonly unknown[])[index]))
    ) {
      return lastResult;
    }
    lastInputs = next;
    lastResult = compute(game, now);
    return lastResult;
  };
}

/** The day the user is in: never earlier than the last settled day. */
export const selectToday: GameSelector<DayKey> = (game, now) => effectiveDay(game, now);

export const selectIsOnboarded = (game: GameState): boolean => isOnboarded(game);

// ── Level ───────────────────────────────────────────────────────────────────

export const selectLevelInfo: GameSelector<LevelInfo> = createGameSelector(
  (game) => [game.xp],
  (game) => levelInfo(game.xp),
);

// ── Tree ────────────────────────────────────────────────────────────────────

export interface TreeStatus extends GrowthInfo {
  name: string;
  species: GameState['profile']['species'];
  /** "Sapling → Young tree 43.2%". */
  stageLabel: string;
  rings: number;
  fullRings: number;
  vitality: VitalityState;
  vitalityLabel: string;
  /** The 0..1 value the world draws. */
  vitalityValue: number;
  missed: number;
  plantedDay: DayKey;
  /** Calendar days since planting, counting the planting day as day 1. */
  dayNumber: number;
  checkedInToday: boolean;
  ringClosedToday: boolean;
  /** Rewarded acts still needed to close today's ring. */
  actsToRing: number;
  /** One line under the tree: the tree's state, then the next smallest step. */
  statusLine: string;
  /** Text alternative for the scene: "Fern, a 12-ring oak sapling, thriving". */
  sceneLabel: string;
}

const SPECIES_LABEL: Record<GameState['profile']['species'], string> = {
  oak: 'oak',
  cherry: 'cherry blossom',
  pine: 'pine',
};

function todaysActs(game: GameState, today: DayKey): number {
  let acts = 0;
  for (const log of logsOn(game.logs, today)) acts += log.rewardedActs;
  return acts;
}

export const selectTreeStatus: GameSelector<TreeStatus> = createGameSelector(
  (game, now) => [game.tree, game.profile, game.days, game.logs, effectiveDay(game, now)],
  (game, now) => {
    const today = effectiveDay(game, now);
    const info = growthInfo(game.tree.gp);
    const record = game.days[today];
    const checkedInToday = record !== undefined;
    const ringClosedToday = record?.ringClosed === true;
    const actsToRing = Math.max(0, DAILY_GOAL - todaysActs(game, today));
    const name = game.profile.treeName || 'Your tree';
    const { vitality, missed } = game.tree;
    let statusLine = vitalityCopy(vitality, name, checkedInToday);
    if (vitality === 'thriving' && checkedInToday) {
      if (ringClosedToday) statusLine = 'Ring closed. See you tomorrow?';
      else if (game.tree.rings === 1 && actsToRing === DAILY_GOAL) {
        statusLine = `Log one action to give ${name} its first leaf.`;
      } else {
        statusLine = `${pluralize(actsToRing, 'more action')} ${actsToRing === 1 ? 'closes' : 'close'} today's ring.`;
      }
    }
    return {
      ...info,
      name,
      species: game.profile.species,
      stageLabel: stageProgressLabel(game.tree.gp),
      rings: game.tree.rings,
      fullRings: game.tree.fullRings,
      vitality,
      vitalityLabel: vitalityLabel(vitality),
      vitalityValue: vitalityValue(vitality, missed),
      missed,
      plantedDay: game.profile.plantedDay,
      dayNumber: Math.max(1, diffDays(game.profile.plantedDay, today) + 1),
      checkedInToday,
      ringClosedToday,
      actsToRing,
      statusLine,
      sceneLabel: `${name}, a ${formatNumber(game.tree.rings)}-ring ${SPECIES_LABEL[game.profile.species]} ${info.stage.toLowerCase()}, ${vitalityLabel(vitality).toLowerCase()}`,
    };
  },
);

/** End-of-day-1 line: the first stage-up is always waiting on day 2. */
export function dayOneCopy(game: GameState): string | null {
  if (game.tree.rings !== 1) return null;
  return game.tree.gp >= 24
    ? 'Your sprout is one drink away from becoming a seedling.'
    : 'Come back tomorrow — one full ring turns your sprout into a seedling.';
}

// ── Streak and rain ─────────────────────────────────────────────────────────

export interface StreakStatus {
  current: number;
  best: number;
  rainBank: number;
  rainCap: number;
  /** Full rings counted toward the next cloud, out of five. */
  rainProgress: number;
  rainGoal: number;
  /** The next streak length that pays a bonus; `null` after the last one. */
  nextMilestone: { days: number; xp: number } | null;
  week: WeekStripDay[];
  /** "3 of 7 this week". */
  activeThisWeek: number;
  restDays: readonly number[];
  restDaysPending: readonly number[] | null;
  restDaysFrom: DayKey | null;
}

export const selectStreak: GameSelector<StreakStatus> = createGameSelector(
  (game, now) => [game.streak, game.rain, game.marks, game.settings, effectiveDay(game, now)],
  (game, now) => {
    const today = effectiveDay(game, now);
    const week = weekStrip(game, today, today);
    const next = STREAK_MILESTONES.find(([days]) => !game.streak.milestones.includes(days));
    return {
      current: game.streak.current,
      best: game.streak.best,
      rainBank: game.rain.bank,
      rainCap: RAIN_CAP,
      rainProgress: game.rain.progress,
      rainGoal: RAIN_FULL_RINGS_PER_CLOUD,
      nextMilestone: next ? { days: next[0], xp: next[1] } : null,
      week,
      activeThisWeek: activeDaysIn(week),
      restDays: restDaysOn(game.settings, today),
      restDaysPending: game.settings.restDaysPending,
      restDaysFrom: game.settings.restDaysFrom,
    };
  },
);

// ── Today ───────────────────────────────────────────────────────────────────

export interface TodaySummary {
  day: DayKey;
  checkedIn: boolean;
  /** Today's logs, newest first. */
  logs: LogEntry[];
  /** Estimated kg CO2e avoided today, from sourced factors. */
  kg: number;
  aiKg: number;
  rewardedActs: number;
  ringGoal: number;
  ringClosed: boolean;
  actsToRing: number;
  /** XP earned from logging today, and what the daily cap still allows. */
  logXp: number;
  logXpLeft: number;
  /** All XP earned today that can be attributed to the day: check-in, logs, ring. */
  xp: number;
  gp: number;
  gpLeft: number;
  cleanSweep: boolean;
  /** Rewarded custom actions still available today. */
  customLeft: number;
  /** Shown once a day after the check-in; `null` before it. */
  fact: DailyFactRef | null;
  dayOneCopy: string | null;
}

export const selectTodaySummary: GameSelector<TodaySummary> = createGameSelector(
  (game, now) => [
    game.logs,
    game.days,
    game.breaks,
    game.quests.claims,
    game.tree.rings,
    game.tree.gp,
    game.profile.userSeed,
    effectiveDay(game, now),
  ],
  (game, now) => {
    const day = effectiveDay(game, now);
    const logs = logsOn(game.logs, day);
    const record = game.days[day];
    let kg = 0;
    let aiKg = 0;
    let logXp = 0;
    let rewardedActs = 0;
    for (const log of logs) {
      if (log.estimate === 'factor') kg += log.co2eKg ?? 0;
      else if (log.estimate === 'ai') aiKg += log.co2eKg ?? 0;
      logXp += log.xp;
      rewardedActs += log.rewardedActs;
    }
    let breakXp = 0;
    for (const entry of breaksOn(game.breaks, day)) breakXp += entry.xp;
    const gp = gpEarnedOn(game, day);
    return {
      day,
      checkedIn: record !== undefined,
      logs: [...logs].reverse(),
      kg,
      aiKg,
      rewardedActs,
      ringGoal: DAILY_GOAL,
      ringClosed: record?.ringClosed === true,
      actsToRing: Math.max(0, DAILY_GOAL - rewardedActs),
      logXp,
      logXpLeft: Math.max(0, LOG_XP_DAILY_CAP - logXp),
      xp: logXp + breakXp + (record ? XP_CHECK_IN : 0) + (record?.ringClosed ? XP_RING_CLOSED : 0),
      gp,
      gpLeft: Math.max(0, GP_DAILY_CAP - gp),
      cleanSweep: isCleanSweepDay(game.quests.claims, day),
      customLeft: customActsLeft(game, day),
      fact: record ? dailyFact(day, game.profile.userSeed) : null,
      dayOneCopy: dayOneCopy(game),
    };
  },
);

// ── Actions (the Log page and the quick-log row) ────────────────────────────

export interface ActionState extends ActionAvailability {
  action: ActionDef;
  /** Hidden by "Not for me", or a heat action in a home without heating. */
  hidden: boolean;
  /** The quantity a one-tap log would use. */
  quickQty: number;
  /** Estimated kg CO2e per unit for this user; `null` when not quantified. */
  kgPerUnit: number | null;
  /** Logs of this action in the last 14 days. */
  recentLogs: number;
  inFocus: boolean;
}

const RECENT_DAYS = 14;

function recentCounts(game: GameState, today: DayKey): Map<string, number> {
  const from = addDays(today, -(RECENT_DAYS - 1));
  const counts = new Map<string, number>();
  for (let index = game.logs.length - 1; index >= 0; index -= 1) {
    const log = game.logs[index] as LogEntry;
    if (log.day < from) break;
    if (log.source !== 'legacy') counts.set(log.actionId, (counts.get(log.actionId) ?? 0) + 1);
  }
  return counts;
}

/** All 51 actions with today's caps, in catalogue order. */
export const selectActionStates: GameSelector<ActionState[]> = createGameSelector(
  (game, now) => [
    game.logs,
    game.profile.region,
    game.profile.heat,
    game.profile.focus,
    game.settings.hiddenActions,
    effectiveDay(game, now),
  ],
  (game, now) => {
    const today = effectiveDay(game, now);
    const hidden = hiddenActionSet(game);
    const recent = recentCounts(game, today);
    return ACTIONS.map((action) => ({
      ...actionAvailability(game, action, today),
      action,
      hidden: hidden.has(action.id),
      quickQty: lastUsedQty(game, action),
      kgPerUnit: kgPerUnit(action, game.profile),
      recentLogs: recent.get(action.id) ?? 0,
      inFocus: game.profile.focus.includes(action.category),
    }));
  },
);

export const selectActionStatesById: GameSelector<ReadonlyMap<string, ActionState>> =
  createGameSelector(
    (game, now) => [selectActionStates(game, now)],
    (game, now) => new Map(selectActionStates(game, now).map((state) => [state.action.id, state])),
  );

/** Easy first actions per category, used to pad the quick-log row and for the first log. */
const STARTERS: Readonly<Record<CategoryId, readonly string[]>> = {
  move: ['walk-cycle-instead-of-car', 'bus-instead-of-car', 'car-free-day'],
  eat: ['plant-based-meal', 'meal-saved-from-waste', 'plant-milk-instead-of-dairy'],
  power: ['standby-off', 'line-dry-instead-of-tumble', 'thermostat-down-1c'],
  water: ['shorter-shower', 'wash-cold-instead-of-40', 'tap-off-while-brushing'],
  stuff: ['pass-it-on', 'borrow-instead-of-buy', 'repair-instead-of-replace'],
  waste: ['refuse-single-use-bottle', 'refuse-single-use-bag', 'compost-food-waste'],
  nature: ['tend-plants', 'climate-conversation', 'litter-pick'],
};
const QUICK_LOG_SIZE = 6;

/** Today's six one-tap tiles: your most-used of the last 14 days, padded from your focus areas. */
export const selectQuickLog: GameSelector<ActionState[]> = createGameSelector(
  (game, now) => [selectActionStates(game, now), game.profile.focus],
  (game, now) => {
    const states = selectActionStatesById(game, now);
    const usable = (state: ActionState | undefined): state is ActionState =>
      state !== undefined && !state.hidden;
    const picked: ActionState[] = [...states.values()]
      .filter((state) => usable(state) && state.recentLogs > 0)
      .sort((a, b) => b.recentLogs - a.recentLogs)
      .slice(0, QUICK_LOG_SIZE);
    const categories = [
      ...game.profile.focus,
      ...CATEGORY_IDS.filter((id) => !game.profile.focus.includes(id)),
    ];
    for (let round = 0; round < 3 && picked.length < QUICK_LOG_SIZE; round += 1) {
      for (const category of categories) {
        const state = states.get(STARTERS[category][round] ?? '');
        if (usable(state) && !picked.includes(state) && picked.length < QUICK_LOG_SIZE) {
          picked.push(state);
        }
      }
    }
    // Tiles that are maxed today sink to the end.
    return [...picked.filter((state) => !state.maxed), ...picked.filter((state) => state.maxed)];
  },
);

export const selectCustomActions = (game: GameState): readonly SavedCustomAction[] =>
  game.customActions;

// ── Quests ──────────────────────────────────────────────────────────────────

export interface QuestView {
  id: string;
  kind: 'daily' | 'weekly';
  slot: number;
  title: string;
  copy: string;
  xp: number;
  pool: string;
  progress: QuestProgress;
  /** "1 / 3". */
  progressText: string;
  /** 0..1. */
  ratio: number;
  claimed: boolean;
  claimable: boolean;
  /** "Not today → swap" is available for this quest. */
  canSwap: boolean;
  /** Catalogue actions that advance it, for "open Log filtered to these". */
  actions: string[];
}

export interface QuestBoard {
  daily: QuestView[];
  weekly: QuestView[];
  epics: EpicStatus[];
  pinnedEpic: EpicStatus | null;
  /** All three dailies are claimed today. */
  cleanSweep: boolean;
  /** Quests waiting for a tap on "Claim". */
  claimableCount: number;
  /** "resets at midnight": the moment the dailies rotate, as epoch milliseconds. */
  dailyResetsAt: number;
  /** Days left in the week, today included. */
  weeklyDaysLeft: number;
  allEpicsClaimed: boolean;
}

function questView(
  kind: 'daily' | 'weekly',
  quest: QuestDef,
  slot: number,
  progress: QuestProgress,
  claimed: boolean,
  swapsLeft: boolean,
): QuestView {
  return {
    id: quest.id,
    kind,
    slot,
    title: quest.title,
    copy: quest.copy,
    xp: quest.xp,
    pool: quest.pool,
    progress,
    progressText: `${formatNumber(Math.floor(progress.current))} / ${formatNumber(progress.target)}`,
    ratio: progress.target > 0 ? Math.min(1, progress.current / progress.target) : 0,
    claimed,
    claimable: progress.done && !claimed,
    canSwap: swapsLeft && !claimed && progress.current === 0,
    actions: conditionActions(quest.condition),
  };
}

const selectQuestViews: GameSelector<{ daily: QuestView[]; weekly: QuestView[] }> =
  createGameSelector(
    (game) => [
      game.quests.daily,
      game.quests.weekly,
      game.quests.claims,
      game.logs,
      game.days,
      game.breaks,
      game.journal,
      game.learn.opens,
    ],
    (game) => {
      const { daily, weekly, claims } = game.quests;
      const dailyViews = (daily?.slots ?? []).flatMap((id, slot) => {
        const quest = DAILY_QUEST_BY_ID.get(id);
        if (!quest || !daily) return [];
        return [
          questView(
            'daily',
            quest,
            slot,
            dailyProgress(game, id, daily.key),
            isClaimed(claims, 'daily', daily.key, id),
            daily.swapsUsed < 1,
          ),
        ];
      });
      const weeklyViews = (weekly?.slots ?? []).flatMap((id, slot) => {
        const quest = WEEKLY_QUEST_BY_ID.get(id);
        if (!quest || !weekly) return [];
        return [
          questView(
            'weekly',
            quest,
            slot,
            weeklyProgress(game, id, weekly.key),
            isClaimed(claims, 'weekly', weekly.key, id),
            weekly.swapsUsed < 1,
          ),
        ];
      });
      return { daily: dailyViews, weekly: weeklyViews };
    },
  );

export const selectEpics: GameSelector<EpicStatus[]> = createGameSelector(
  (game, now) => [
    game.logs,
    game.tree.rings,
    game.learn.lessons,
    game.quests.epics,
    game.quests.pinnedEpic,
    game.quests.lastSelfAttestedTs,
    effectiveDay(game, now),
  ],
  (game, now) => allEpicStatuses(game, effectiveDay(game, now)),
);

export const selectQuests: GameSelector<QuestBoard> = createGameSelector(
  (game, now) => [selectQuestViews(game, now), selectEpics(game, now), effectiveDay(game, now)],
  (game, now) => {
    const today = effectiveDay(game, now);
    const { daily, weekly } = selectQuestViews(game, now);
    const epics = selectEpics(game, now);
    const claimable = [...daily, ...weekly].filter((quest) => quest.claimable).length;
    return {
      daily,
      weekly,
      epics,
      pinnedEpic: epics.find((epic) => epic.pinned && !epic.claimed) ?? null,
      cleanSweep: isCleanSweepDay(game.quests.claims, today),
      claimableCount: claimable + epics.filter((epic) => epic.claimable).length,
      dailyResetsAt: now + msUntilTomorrow(now),
      weeklyDaysLeft: 7 - diffDays(startOfWeek(today), today),
      allEpicsClaimed: epics.every((epic) => epic.claimed),
    };
  },
);

// ── Badges and the island ───────────────────────────────────────────────────

export interface BadgeBoard {
  all: BadgeStatus[];
  /** Badge tiers earned, the number the passport shows. */
  tiersEarned: number;
  tiersTotal: number;
  badgesEarned: number;
  /** Unlocked island props, in the world contract's order. */
  props: IslandPropId[];
  /** The locked badge closest to its next tier, as a nudge. */
  nearest: BadgeStatus | null;
  /** The most recently earned tiers, newest first. */
  recent: { badge: BadgeDef; tier: number; ts: number }[];
}

export const selectBadges: GameSelector<BadgeBoard> = createGameSelector(
  (game) => [
    game.badges,
    game.logs,
    game.tree,
    game.streak,
    game.quests.claims,
    game.learn,
    game.breaks,
    game.journal,
    game.baseline,
    game.days,
    game.marks,
    game.challenge,
    game.seen,
    game.onboarding,
  ],
  (game) => {
    const all = allBadgeStatuses(game);
    const open = all.filter((status) => status.nextThreshold !== null && !status.hidden);
    const recent = all
      .flatMap((status) => status.earned.map((entry) => ({ badge: status.badge, ...entry })))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 6);
    return {
      all,
      tiersEarned: all.reduce((sum, status) => sum + status.tier, 0),
      tiersTotal: BADGES.reduce((sum, badge) => sum + badge.thresholds.length, 0),
      badgesEarned: all.filter((status) => status.tier > 0).length,
      props: unlockedProps(game.badges),
      nearest: open.sort((a, b) => b.progress - a.progress)[0] ?? null,
      recent,
    };
  },
);

// ── Impact ──────────────────────────────────────────────────────────────────

export interface CategoryImpact {
  category: CategoryId;
  label: string;
  emoji: string;
  kg: number;
  acts: number;
  /** 0..1 of the factor-based total. */
  share: number;
}

export interface DayImpact {
  day: DayKey;
  kg: number;
  acts: number;
  logs: number;
  mark: DayMark | 'none';
}

export interface WeekImpact {
  week: WeekKey;
  monday: DayKey;
  kg: number;
  acts: number;
  rings: number;
}

export interface Impact {
  /** "≈ 61 kg estimated CO2e avoided": sourced factors only. */
  kg: number;
  /** "+ ≈ 1.2 kg from AI estimates", reported apart and never added to the headline. */
  aiKg: number;
  logs: number;
  acts: number;
  rings: number;
  fullRings: number;
  minutesOutside: number;
  byCategory: CategoryImpact[];
  topCategory: CategoryId | null;
  /** The last 12 weeks, oldest first. */
  weeks: WeekImpact[];
  /** One entry per day since planting (at most the last 371), oldest first: the heatmap. */
  heatmap: DayImpact[];
  equivalences: Equivalence[];
  pace: PaceResult;
  paceHeadline: string;
  habits: HabitsHeld;
  habitsCopy: string;
  /** No log yet: "No data yet. Log one action and this page wakes up." */
  empty: boolean;
}

const HEATMAP_DAYS = 371;
const TREND_WEEKS = 12;

export const selectImpact: GameSelector<Impact> = createGameSelector(
  (game, now) => [
    game.logs,
    game.marks,
    game.days,
    game.breaks,
    game.baseline.current,
    game.tree.rings,
    game.tree.fullRings,
    game.profile.region,
    game.profile.plantedDay,
    effectiveDay(game, now),
  ],
  (game, now) => {
    const today = effectiveDay(game, now);
    const stats = lifetimeLogStats(game.logs);
    const byCategory = CATEGORIES.map((category) => ({
      category: category.id,
      label: category.label,
      emoji: category.emoji,
      kg: stats.kgByCategory[category.id],
      acts: stats.actsByCategory[category.id],
      share: stats.factorKg > 0 ? stats.kgByCategory[category.id] / stats.factorKg : 0,
    }));
    const top = [...byCategory].sort((a, b) => b.acts - a.acts)[0];

    const first = addDays(today, -(HEATMAP_DAYS - 1));
    const start = game.profile.plantedDay > first ? game.profile.plantedDay : first;
    const heatmap: DayImpact[] = [];
    for (let day = start; day <= today; day = addDays(day, 1)) {
      let kg = 0;
      let acts = 0;
      const logs = logsOn(game.logs, day);
      for (const log of logs) {
        if (log.estimate === 'factor') kg += log.co2eKg ?? 0;
        acts += log.rewardedActs;
      }
      heatmap.push({ day, kg, acts, logs: logs.length, mark: game.marks[day] ?? 'none' });
    }

    const thisMonday = startOfWeek(today);
    const weeks: WeekImpact[] = [];
    for (let index = TREND_WEEKS - 1; index >= 0; index -= 1) {
      const monday = addDays(thisMonday, -7 * index);
      const sunday = addDays(monday, 6);
      const days = heatmap.filter((entry) => entry.day >= monday && entry.day <= sunday);
      weeks.push({
        week: weekKey(monday),
        monday,
        kg: days.reduce((sum, entry) => sum + entry.kg, 0),
        acts: days.reduce((sum, entry) => sum + entry.acts, 0),
        rings: days.filter((entry) => entry.mark === 'ring' || entry.mark === 'full').length,
      });
    }

    const pace = computePace(
      { baseline: game.baseline.current, logs: game.logs, days: game.days },
      today,
    );
    const habits = habitsHeld(game.logs, today);
    return {
      kg: stats.factorKg,
      aiKg: stats.aiKg,
      logs: stats.logs,
      acts: stats.rewardedActs,
      rings: game.tree.rings,
      fullRings: game.tree.fullRings,
      minutesOutside: breakStats(game, []).minutesTotal,
      byCategory,
      topCategory: top && top.acts > 0 ? top.category : null,
      weeks,
      heatmap,
      equivalences: pickEquivalences(stats.factorKg, game.profile.region),
      pace,
      paceHeadline: paceHeadline(pace),
      habits,
      habitsCopy: habitsHeldCopy(habits),
      empty: stats.logs === 0,
    };
  },
);

/** "≈ 48 kg estimated CO2e avoided", plus the AI line when there is one. */
export function impactHeadline(impact: Pick<Impact, 'kg' | 'aiKg'>): {
  total: string;
  ai: string | null;
} {
  return {
    total: `≈ ${formatCo2Estimate(impact.kg)} estimated CO2e avoided`,
    ai: impact.aiKg > 0 ? `＋ ≈ ${formatCo2Estimate(impact.aiKg)} from AI estimates` : null,
  };
}

/** Every log, newest first, for Impact → History. */
export const selectHistory: GameSelector<LogEntry[]> = createGameSelector(
  (game) => [game.logs],
  (game) => [...game.logs].reverse(),
);

export interface BaselineView {
  result: NonNullable<GameState['baseline']['current']>;
  /** "≈ 7.8 t". */
  totalLabel: string;
  segments: BaselineSegmentShare[];
  levers: BaselineSegmentShare[];
  low: boolean;
  regionName: string;
  retakes: number;
}

export const selectBaseline: GameSelector<BaselineView | null> = createGameSelector(
  (game) => [game.baseline],
  (game) => {
    const result = game.baseline.current;
    if (!result) return null;
    return {
      result,
      totalLabel: `≈ ${formatTonnes(result.tonnes.total)}`,
      segments: baselineSegments(result.tonnes),
      levers: biggestLevers(result.tonnes),
      low: isLowFootprint(result.tonnes),
      regionName: GRID_BY_ID.get(result.region)?.name ?? result.region,
      retakes: game.baseline.history.length,
    };
  },
);

// ── The world seam ──────────────────────────────────────────────────────────

/** The sky moves a little every minute; rounding keeps the snapshot stable in between. */
function skyHour(game: GameState, now: number): number {
  return game.settings.sky === 'day' ? 12 : Math.round(hourOfDay(now) * 60) / 60;
}

/** Everything the Grove draws, derived from state: nothing here is stored. */
export const selectWorldSnapshot: GameSelector<WorldSnapshot> = createGameSelector(
  (game, now) => [
    game.profile.userSeed,
    game.profile.species,
    game.tree.gp,
    game.tree.vitality,
    game.tree.missed,
    game.tree.rings,
    game.badges,
    skyHour(game, now),
  ],
  (game, now) => ({
    seed: game.profile.userSeed,
    species: game.profile.species,
    growth: growthOf(game.tree.gp),
    vitality: vitalityValue(game.tree.vitality, game.tree.missed),
    ageDays: game.tree.rings,
    props: unlockedProps(game.badges),
    hour: skyHour(game, now),
  }),
);

// ── HUD ─────────────────────────────────────────────────────────────────────

export interface Hud {
  level: number;
  title: string;
  xp: number;
  xpIntoLevel: number;
  xpToNext: number;
  levelProgress: number;
  streak: number;
  rainBank: number;
  /** "≈ 48 kg". */
  kgLabel: string;
  kg: number;
  rings: number;
  treeName: string;
}

export const selectHud: GameSelector<Hud> = createGameSelector(
  (game) => [
    game.xp,
    game.streak.current,
    game.rain.bank,
    game.logs,
    game.tree.rings,
    game.profile.treeName,
  ],
  (game) => {
    const level = levelInfo(game.xp);
    const kg = lifetimeLogStats(game.logs).factorKg;
    return {
      level: level.level,
      title: level.title,
      xp: level.xp,
      xpIntoLevel: level.xpIntoLevel,
      xpToNext: level.xpToNext,
      levelProgress: level.progress,
      streak: game.streak.current,
      rainBank: game.rain.bank,
      kgLabel: `≈ ${formatCo2Estimate(kg)}`,
      kg,
      rings: game.tree.rings,
      treeName: game.profile.treeName,
    };
  },
);

// ── Learn ───────────────────────────────────────────────────────────────────

export interface LessonView {
  slug: string;
  status: LessonStatus;
  progress: LessonProgress;
  recommended: boolean;
}

export interface LearnBoard {
  lessons: LessonView[];
  recommended: string | null;
  passed: number;
  total: number;
  mythsFlipped: readonly number[];
}

export const selectLearn: GameSelector<LearnBoard> = createGameSelector(
  (game) => [game.learn.lessons, game.learn.mythsFlipped, game.profile.focus],
  (game) => {
    const recommended = recommendedLesson(game);
    const lessons = LESSON_SLUGS.map((slug) => {
      const progress = lessonProgress(game, slug);
      return { slug, status: lessonStatus(progress), progress, recommended: slug === recommended };
    });
    return {
      lessons,
      recommended,
      passed: lessons.filter((lesson) => lesson.status === 'passed').length,
      total: lessons.length,
      mythsFlipped: game.learn.mythsFlipped,
    };
  },
);

// ── Touch Grass ─────────────────────────────────────────────────────────────

export interface TouchGrassStatus {
  /** The running break, with where it stands right now. */
  active: {
    startTs: number;
    plannedMin: number;
    /** "Back at 15:40": when the planned time is up. */
    endsAt: number;
    remainingMs: number;
    awayMs: number;
    verdict: BreakVerdict;
  } | null;
  /** Minutes until another break may start; 0 when one can start now. */
  cooldownMin: number;
  suggestedMin: number;
  /** Today's rewarded break has been used; another one is recorded without XP. */
  rewardedToday: boolean;
  stats: BreakStats;
}

/**
 * While a break runs this follows the store's clock (one tick a minute, and every
 * action); a screen that shows time passing derives it from `endsAt` with its own timer.
 */
export const selectTouchGrass: GameSelector<TouchGrassStatus> = createGameSelector(
  (game, now) => [
    game.activeBreak,
    game.breaks,
    game.days,
    effectiveDay(game, now),
    // The cooldown and a running break depend on the time itself, not only on the day.
    game.activeBreak || breakCooldownMin(game, now) > 0 ? now : 0,
  ],
  (game, now) => {
    const today = effectiveDay(game, now);
    const active = game.activeBreak;
    const monday = startOfWeek(today);
    const weekDays = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
    return {
      active: active
        ? {
            startTs: active.startTs,
            plannedMin: active.plannedMin,
            endsAt: active.startTs + active.plannedMin * 60_000,
            remainingMs: Math.max(0, active.startTs + active.plannedMin * 60_000 - now),
            awayMs: awayMsAt(active, now),
            verdict: judgeBreak(active, now),
          }
        : null,
      cooldownMin: breakCooldownMin(game, now),
      suggestedMin: suggestedBreakMin(game),
      rewardedToday: game.days[today]?.breakRewarded === true,
      stats: breakStats(game, weekDays),
    };
  },
);

// ── Community ───────────────────────────────────────────────────────────────

/** Journal notes, newest first. */
export const selectJournal: GameSelector<JournalNote[]> = createGameSelector(
  (game) => [game.journal],
  (game) => [...game.journal].sort((a, b) => b.ts - a.ts),
);

export interface ChallengeView {
  state: ChallengeState;
  progress: ChallengeProgress;
  /** "2 / 5 full rings". */
  progressText: string;
  finished: boolean;
  /** "Maya and Juniper dare you: …" for a friend's challenge; `null` for one you created. */
  invite: string | null;
}

export const selectChallenge: GameSelector<ChallengeView | null> = createGameSelector(
  (game, now) => [
    game.challenge.active,
    game.logs,
    game.days,
    game.breaks,
    effectiveDay(game, now),
  ],
  (game, now) => {
    const state = game.challenge.active;
    if (!state) return null;
    const progress = challengeProgress(game, state, effectiveDay(game, now));
    if (!progress) return null;
    return {
      state,
      progress,
      progressText: `${formatNumber(progress.current)} / ${formatNumber(progress.target)} ${progress.template.unit}`,
      finished: state.completedTs !== null,
      invite:
        state.role === 'friend'
          ? challengeInviteText({
              v: 1,
              k: state.templateId,
              s: state.startDay,
              d: 7,
              ...(state.category ? { c: state.category } : {}),
              ...(state.from ? { n: state.from } : {}),
              ...(state.fromTree ? { t: state.fromTree } : {}),
            })
          : null,
    };
  },
);

// ── Notices, recap, activity ────────────────────────────────────────────────

export interface NoticeView extends Notice {
  text: string;
}

/** The final copy of a one-time notice. */
export function noticeText(notice: Notice, treeName: string): string {
  const data = notice.data;
  const count = (key: string) => formatNumber(Number(data[key] ?? 0));
  switch (notice.kind) {
    case 'rain-return':
      return `It rained while you were away. ${treeName} is fine, and so is your ${count('streak')}-day streak.`;
    case 'streak-rested':
      return `Your streak rested at ${count('streak')} days — your best is safe. Today is day 1, and ${treeName} kept everything.`;
    case 'auto-claimed':
      return `While you were away: ${pluralize(Number(data.count ?? 0), 'finished quest')} claimed for you, +${count('xp')} XP.`;
    case 'challenge-ended':
      return `Time's up — ${count('done')} of ${count('of')}. Rematch?`;
    case 'legacy-imported':
      return `${pluralize(Number(data.logs ?? 0), 'action')} came along from the earlier version. The old starting numbers were placeholders, so they stayed behind.`;
    case 'woke-up':
      return `${treeName} is waking up.`;
  }
}

export const selectNotices: GameSelector<NoticeView[]> = createGameSelector(
  (game) => [game.notices, game.profile.treeName],
  (game) =>
    game.notices.map((notice) => ({
      ...notice,
      text: noticeText(notice, game.profile.treeName || 'Your tree'),
    })),
);

export interface RecapView {
  /** The week to offer now; `null` when there is none or it was dismissed. */
  pending: WeekRecap | null;
  /** Finished weeks since planting, newest first. */
  weeks: WeekKey[];
}

export const selectRecap: GameSelector<RecapView> = createGameSelector(
  (game, now) => [
    game.seen.recapWeek,
    game.logs,
    game.marks,
    game.days,
    game.breaks,
    game.quests.claims,
    game.profile.plantedDay,
    game.onboarding.completedAt,
    effectiveDay(game, now),
  ],
  (game, now) => {
    const today = effectiveDay(game, now);
    const week = recapToShow(game, today);
    return {
      pending: week ? weekRecap(game, week, today) : null,
      weeks: isOnboarded(game) ? recapWeeks(game, today) : [],
    };
  },
);

/** One recap by week key, for Impact → Weeks. */
export function selectWeekRecap(game: GameState, week: WeekKey, now: number): WeekRecap {
  return weekRecap(game, week, effectiveDay(game, now));
}

/** The Island log: plantings, props and stage-ups, newest first. */
export const selectIslandLog: GameSelector<ActivityEntry[]> = createGameSelector(
  (game) => [game.activity],
  (game) => game.activity.filter((entry) => ['island', 'planted', 'stage'].includes(entry.kind)),
);

export const selectActivity = (game: GameState): readonly ActivityEntry[] => game.activity;

// ── Passport ────────────────────────────────────────────────────────────────

export interface Passport {
  treeName: string;
  species: GameState['profile']['species'];
  speciesLabel: string;
  plantedDay: DayKey;
  dayNumber: number;
  stage: string;
  stageLabel: string;
  rings: number;
  fullRings: number;
  /** One entry per ring from the pith outward: thick for a full ring, thin otherwise. */
  ringSequence: ('full' | 'ring')[];
  /** "12 rings: 5 thick, 7 thin." */
  ringSummary: string;
  bestStreak: number;
  minutesOutside: number;
  level: number;
  levelTitle: string;
}

export const selectPassport: GameSelector<Passport> = createGameSelector(
  (game, now) => [
    game.profile,
    game.tree,
    game.marks,
    game.breaks,
    game.streak.best,
    game.xp,
    effectiveDay(game, now),
  ],
  (game, now) => {
    const today = effectiveDay(game, now);
    const ringSequence = Object.keys(game.marks)
      .sort()
      .flatMap((day) => {
        const mark = game.marks[day];
        return mark === 'full' || mark === 'ring' ? [mark] : [];
      });
    const info = growthInfo(game.tree.gp);
    const level = levelInfo(game.xp);
    const thin = game.tree.rings - game.tree.fullRings;
    return {
      treeName: game.profile.treeName,
      species: game.profile.species,
      speciesLabel: SPECIES_LABEL[game.profile.species],
      plantedDay: game.profile.plantedDay,
      dayNumber: Math.max(1, diffDays(game.profile.plantedDay, today) + 1),
      stage: info.stage,
      stageLabel: stageProgressLabel(game.tree.gp),
      rings: game.tree.rings,
      fullRings: game.tree.fullRings,
      ringSequence,
      ringSummary: `${pluralize(game.tree.rings, 'ring')}: ${formatNumber(game.tree.fullRings)} thick, ${formatNumber(thin)} thin.`,
      bestStreak: game.streak.best,
      minutesOutside: breakStats(game, []).minutesTotal,
      level: level.level,
      levelTitle: level.title,
    };
  },
);

// ── Clock ───────────────────────────────────────────────────────────────────

export interface ClockStatus {
  today: DayKey;
  /** The device clock was set back: "Your clock looks off. Today will catch up." */
  skewed: boolean;
  /** The next local midnight, as epoch milliseconds. */
  nextMidnight: number;
}

export const selectClock: GameSelector<ClockStatus> = createGameSelector(
  (game, now) => [effectiveDay(game, now), isClockSkewed(game, now)],
  (game, now) => ({
    today: effectiveDay(game, now),
    skewed: isClockSkewed(game, now),
    nextMidnight: now + msUntilTomorrow(now),
  }),
);

// ── The coach seam ──────────────────────────────────────────────────────────

/**
 * What the coach may know. Structurally compatible with `CoachContext` in
 * `src/ai/contract.ts` (the game may not import from the AI module, so the shape is
 * repeated here and a test asserts the two stay assignable).
 */
export interface CoachContextShape {
  displayName?: string;
  region?: string;
  partOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  tree?: { name?: string; species?: string; stage?: string; vitality?: string };
  level?: number;
  levelTitle?: string;
  streak?: number;
  rain?: number;
  rings?: number;
  focus?: string[];
  totals?: { kgTotal?: number; kgLast7?: number; actionsTotal?: number };
  topCategories?: { category: string; count?: number; kg?: number }[];
  recentActions?: { title: string; quantity?: number; unit?: string; daysAgo?: number }[];
  quests?: { id: string; line: string; progress?: number }[];
  baseline?: string;
  actions?: { id: string; title: string; unit: string; category?: string; doneToday?: boolean }[];
  lessonSlugs?: string[];
  ringLeft?: number;
  nextLesson?: { slug: string; title: string };
}

export interface CoachContextOptions {
  /** Lesson titles by slug, from the content module; a readable slug is used otherwise. */
  lessonTitles?: Readonly<Record<string, string>>;
}

export function partOfDay(now: number): NonNullable<CoachContextShape['partOfDay']> {
  const hour = hourOfDay(now);
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return hour < 22 ? 'evening' : 'night';
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function readableSlug(slug: string): string {
  const text = slug.replaceAll('-', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Builds the coach's context for one request. Never included: journal text, timestamps,
 * raw quiz answers, custom-action text. With "Share my stats with the coach" off, only
 * the region and the catalogue the chips may reference are passed on. `displayName`
 * stays on the device: the AI client substitutes it locally and strips it before sending.
 */
export function selectCoachContext(
  game: GameState,
  now: number,
  options: CoachContextOptions = {},
): CoachContextShape {
  const today = effectiveDay(game, now);
  const hidden = hiddenActionSet(game);
  const score = scoreDay(logsOn(game.logs, today));
  const actions = ACTIONS.filter((action) => !hidden.has(action.id)).map((action) => {
    const state = actionAvailability(game, action, today);
    return {
      id: action.id,
      title: action.title,
      unit: action.unit,
      category: action.category,
      doneToday: state.maxed || state.blocked !== null,
    };
  });
  const base: CoachContextShape = {
    displayName: game.profile.name,
    region: game.profile.region,
    lessonSlugs: [...LESSON_SLUGS],
  };
  if (!game.settings.shareStatsWithCoach || !isOnboarded(game)) {
    return { ...base, actions: actions.map(({ doneToday: _doneToday, ...action }) => action) };
  }

  const stats = lifetimeLogStats(game.logs);
  const weekAgo = addDays(today, -6);
  let kgLast7 = 0;
  const lastSeven = new Map<CategoryId, { count: number; kg: number }>();
  const recentActions: NonNullable<CoachContextShape['recentActions']> = [];
  for (let index = game.logs.length - 1; index >= 0; index -= 1) {
    const log = game.logs[index] as LogEntry;
    if (log.day < weekAgo) break;
    const entry = lastSeven.get(log.category) ?? { count: 0, kg: 0 };
    entry.count += Math.max(1, log.rewardedActs);
    if (log.estimate === 'factor') {
      entry.kg += log.co2eKg ?? 0;
      kgLast7 += log.co2eKg ?? 0;
    }
    lastSeven.set(log.category, entry);
    // Custom-action text is the user's own words: only catalogue titles are passed on.
    // Each action is listed once, at its latest use, which keeps the block small.
    if (
      recentActions.length < 5 &&
      ACTION_BY_ID.has(log.actionId) &&
      !recentActions.some((recent) => recent.title === log.title)
    ) {
      recentActions.push({
        title: log.title,
        quantity: log.qty,
        unit: log.unit,
        daysAgo: diffDays(log.day, today),
      });
    }
  }
  const topCategories = [...lastSeven.entries()]
    // Ties go to the catalogue's category order, so the result never depends on log order.
    .sort(
      (a, b) => b[1].count - a[1].count || CATEGORY_IDS.indexOf(a[0]) - CATEGORY_IDS.indexOf(b[0]),
    )
    .slice(0, 3)
    .map(([category, entry]) => ({ category, count: entry.count, kg: round2(entry.kg) }));

  const board = selectQuestViews(game, now);
  const quests = [...board.daily, ...board.weekly]
    .filter((quest) => !quest.claimed)
    .map((quest) => ({
      id: quest.id,
      line: `${quest.title}: ${quest.copy} (${quest.progressText})`,
      progress: round2(quest.ratio),
    }));

  const levers = game.baseline.current ? biggestLevers(game.baseline.current.tonnes) : [];
  const info = levelInfo(game.xp);
  const topCategory = topCategories[0]?.category as CategoryId | undefined;
  const unpassed = LESSONS.filter((lesson) => game.learn.lessons[lesson.slug]?.passedTs == null);
  const next =
    unpassed.find(
      (lesson) => topCategory !== undefined && lesson.categories.includes(topCategory),
    ) ?? unpassed.find((lesson) => lesson.slug === recommendedLesson(game));

  return {
    ...base,
    partOfDay: partOfDay(now),
    tree: {
      name: game.profile.treeName,
      species: game.profile.species,
      stage: growthInfo(game.tree.gp).stage,
      vitality: game.tree.vitality,
    },
    level: info.level,
    levelTitle: info.title,
    streak: game.streak.current,
    rain: game.rain.bank,
    rings: game.tree.rings,
    focus: [...game.profile.focus],
    totals: {
      kgTotal: round2(stats.factorKg),
      kgLast7: round2(kgLast7),
      actionsTotal: stats.rewardedActs,
    },
    topCategories,
    recentActions,
    quests,
    ...(game.baseline.current
      ? {
          baseline: `${formatTonnes(game.baseline.current.tonnes.total)} a year, mostly ${levers
            .map((lever) => lever.label.toLowerCase())
            .join(' and ')}`,
        }
      : {}),
    actions,
    ringLeft: Math.max(0, DAILY_GOAL - score.rewardedActs),
    ...(next
      ? {
          nextLesson: {
            slug: next.slug,
            title: options.lessonTitles?.[next.slug] ?? readableSlug(next.slug),
          },
        }
      : {}),
  };
}
