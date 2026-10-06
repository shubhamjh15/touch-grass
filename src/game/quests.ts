/**
 * Quests (product spec section 4): conditions evaluated from what the user really
 * logged, a deterministic rotation from date + seed + focus areas, one swap per period,
 * claims that pay exactly once, and long-term epics.
 */
import { ACTION_BY_ID, type CategoryId } from '@/data/catalogue';
import {
  DAILY_QUESTS,
  DAILY_QUEST_BY_ID,
  EPICS,
  EPIC_BY_ID,
  WEEKLY_QUESTS,
  WEEKLY_QUEST_BY_ID,
  type ActionSet,
  type EpicDef,
  type EpicRequirement,
  type QuestCondition,
  type QuestDef,
} from '@/data/quests';
import {
  addDays,
  dayKey,
  dayRange,
  diffDays,
  hourOfDay,
  startOfWeek,
  weekKey,
  type DayKey,
} from '@/lib/dates';
import { createRng, shuffle } from '@/lib/rng';
import { isHeatAction } from './co2';
import { grantXp, queueNotice, writeActivity, type Ctx } from './ctx';
import {
  BREAKS_COUNTED_PER_DAY,
  JOURNAL_REWARD_MIN_CHARS,
  QUEST_EPOCH_DAY,
  QUEST_EPOCH_WEEK,
  SELF_ATTESTED_EPIC_COOLDOWN_DAYS,
  XP_CLEAN_SWEEP,
} from './economy';
import { breaksOn, lifetimeLogStats, logsOn, memoize, notesOn, opensOn } from './indexes';
import { isOnboarded } from './state';
import type {
  EpicProgress,
  GameState,
  LogEntry,
  QuestClaim,
  QuestKind,
  QuestPeriod,
  WeekKey,
} from './types';

// ── Condition evaluation ────────────────────────────────────────────────────

export interface QuestProgress {
  current: number;
  target: number;
  done: boolean;
}

type FactsState = Pick<GameState, 'logs' | 'days' | 'breaks' | 'learn' | 'journal' | 'quests'>;

const inSet = (set: ActionSet, actionId: string): boolean =>
  set === '*' || (set as readonly string[]).includes(actionId);

const progress = (current: number, target: number): QuestProgress => ({
  current: Math.min(current, target),
  target,
  done: current >= target,
});

/** All three dailies of `day` were claimed. Derived from the claims, the day flag being a cache. */
export function isCleanSweepDay(claims: readonly QuestClaim[], day: DayKey): boolean {
  let count = 0;
  for (const claim of claims) if (claim.kind === 'daily' && claim.period === day) count += 1;
  return count >= 3;
}

function sumLogs(
  state: FactsState,
  days: readonly DayKey[],
  pick: (log: LogEntry) => number,
): number {
  let total = 0;
  for (const day of days) for (const log of logsOn(state.logs, day)) total += pick(log);
  return total;
}

/** Evaluates a condition over a period given as its days (one day for a daily quest). */
export function evaluateCondition(
  condition: QuestCondition,
  state: FactsState,
  days: readonly DayKey[],
): QuestProgress {
  switch (condition.kind) {
    case 'acts':
      return progress(
        sumLogs(state, days, (log) =>
          inSet(condition.actions, log.actionId) ? log.rewardedActs : 0,
        ),
        condition.min,
      );
    case 'categoryActs':
      return progress(
        sumLogs(state, days, (log) => (log.category === condition.category ? log.rewardedActs : 0)),
        condition.min,
      );
    case 'units':
      return progress(
        sumLogs(state, days, (log) =>
          inSet(condition.actions, log.actionId) && log.rewardedActs > 0 ? log.qty : 0,
        ),
        condition.min,
      );
    case 'categories': {
      const seen = new Set<CategoryId>();
      for (const day of days) {
        for (const log of logsOn(state.logs, day)) if (log.rewardedActs > 0) seen.add(log.category);
      }
      return progress(seen.size, condition.min);
    }
    case 'ring':
      return progress(days.some((day) => state.days[day]?.ringClosed) ? 1 : 0, 1);
    case 'checkIn':
      return progress(days.some((day) => state.days[day]) ? 1 : 0, 1);
    case 'checkInBefore':
      return progress(
        days.some((day) => {
          const record = state.days[day];
          return record !== undefined && hourOfDay(record.checkInTs) < condition.hour;
        })
          ? 1
          : 0,
        1,
      );
    case 'break': {
      let count = 0;
      for (const day of days) {
        const kept = breaksOn(state.breaks, day).filter(
          (entry) => entry.kept && entry.keptMin >= condition.minutes,
        ).length;
        count += Math.min(BREAKS_COUNTED_PER_DAY, kept);
      }
      return progress(count, condition.min);
    }
    case 'learnOpen': {
      let count = 0;
      for (const day of days) {
        for (const open of opensOn(state.learn.opens, day)) {
          if (!condition.lessonsOnly || open.kind === 'lesson') count += 1;
        }
      }
      return progress(count, condition.min);
    }
    case 'post': {
      let count = 0;
      for (const day of days) {
        for (const note of notesOn(state.journal, day)) {
          if (note.text.trim().length >= JOURNAL_REWARD_MIN_CHARS) count += 1;
        }
      }
      return progress(count, condition.min);
    }
    case 'cleanSweep':
      return progress(days.some((day) => isCleanSweepDay(state.quests.claims, day)) ? 1 : 0, 1);
    case 'coach':
      return progress(
        sumLogs(state, days, (log) => (log.source === 'coach' ? log.rewardedActs : 0)),
        condition.min,
      );
    case 'days': {
      let count = 0;
      for (const day of days) if (evaluateCondition(condition.of, state, [day]).done) count += 1;
      return progress(count, condition.min);
    }
    case 'all': {
      const parts = condition.of.map((part) => evaluateCondition(part, state, days));
      return {
        current: parts.reduce((sum, part) => sum + part.current, 0),
        target: parts.reduce((sum, part) => sum + part.target, 0),
        done: parts.every((part) => part.done),
      };
    }
    case 'any': {
      const parts = condition.of.map((part) => evaluateCondition(part, state, days));
      const best = parts.reduce(
        (top, part) => (part.current / part.target > top.current / top.target ? part : top),
        parts[0] ?? progress(0, 1),
      );
      return { ...best, done: parts.some((part) => part.done) };
    }
  }
}

/** The catalogue actions that advance a condition, for "tap to open Log filtered to these". */
export function conditionActions(condition: QuestCondition): string[] {
  switch (condition.kind) {
    case 'acts':
    case 'units':
      return condition.actions === '*' ? [] : [...condition.actions];
    case 'categoryActs':
      return [...ACTION_BY_ID.values()]
        .filter((action) => action.category === condition.category)
        .map((action) => action.id);
    case 'days':
      return conditionActions(condition.of);
    case 'all':
    case 'any':
      return [...new Set(condition.of.flatMap(conditionActions))];
    default:
      return [];
  }
}

/** Whether a condition can still be met when the given actions are hidden ("Not for me"). */
export function isSatisfiable(condition: QuestCondition, hidden: ReadonlySet<string>): boolean {
  switch (condition.kind) {
    case 'acts':
    case 'units':
      return condition.actions === '*' || condition.actions.some((id) => !hidden.has(id));
    case 'categoryActs':
      return conditionActions(condition).some((id) => !hidden.has(id));
    case 'days':
      return isSatisfiable(condition.of, hidden);
    case 'all':
      return condition.of.every((part) => isSatisfiable(part, hidden));
    case 'any':
      return condition.of.some((part) => isSatisfiable(part, hidden));
    default:
      return true;
  }
}

/** Actions the user cannot do: hidden by hand, plus the heat actions of a home without heating. */
export function hiddenActionSet(state: Pick<GameState, 'settings' | 'profile'>): Set<string> {
  const hidden = new Set(state.settings.hiddenActions);
  if (state.profile.heat === 'none') {
    for (const action of ACTION_BY_ID.values()) if (isHeatAction(action)) hidden.add(action.id);
  }
  return hidden;
}

// ── Rotation ────────────────────────────────────────────────────────────────

export interface RotationInput {
  userSeed: number;
  focus: readonly CategoryId[];
  hidden: ReadonlySet<string>;
}

type Slots = [string, string, string];
type Offsets = [number, number, number];
const NO_OFFSETS: Offsets = [0, 0, 0];

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function eligible<T extends QuestDef>(pool: readonly T[], hidden: ReadonlySet<string>): T[] {
  return pool.filter((quest) => isSatisfiable(quest.condition, hidden)).sort(byId);
}

/** The quest at position `index` of a slot's endless, repeat-free bag. */
export function bag<T>(pool: readonly T[], userSeed: number, slot: string, index: number): T {
  const size = pool.length;
  if (size === 0) throw new Error(`quest pool for slot ${slot} is empty`);
  const cycle = Math.floor(index / size);
  const order = shuffle(createRng(userSeed, slot, cycle), pool);
  if (size > 1) {
    const previous = shuffle(createRng(userSeed, slot, cycle - 1), pool);
    // No back-to-back repeat when one cycle hands over to the next.
    if (order[0] === previous[size - 1]) [order[0], order[1]] = [order[1] as T, order[0] as T];
  }
  return order[((index % size) + size) % size] as T;
}

interface SlotPlan<T> {
  name: string;
  pool: readonly T[];
}

function slotPlans<T extends QuestDef>(
  kind: 'daily' | 'weekly',
  all: readonly T[],
  basePool: string,
  focusThreshold: number,
  input: RotationInput,
): [SlotPlan<T>, SlotPlan<T>, SlotPlan<T>] {
  const prefix = kind === 'daily' ? 'd' : 'w';
  const focus = new Set<string>(input.focus);
  const base = eligible(
    all.filter((quest) => quest.pool === basePool),
    input.hidden,
  );
  const rest = eligible(
    all.filter((quest) => quest.pool !== basePool),
    input.hidden,
  );
  const focused = rest.filter((quest) => focus.has(quest.pool));
  const others = rest.filter((quest) => !focus.has(quest.pool));
  // A pool that hiding has emptied falls back to everything, so a slot is never left blank.
  const everything = [...all].sort(byId);
  const orAll = (pool: T[]) => (pool.length > 0 ? pool : everything);
  return [
    { name: `${prefix}A`, pool: orAll(base) },
    { name: `${prefix}B`, pool: orAll(focused.length >= focusThreshold ? focused : rest) },
    { name: `${prefix}C`, pool: orAll(others.length >= focusThreshold ? others : rest) },
  ];
}

/** Draws from a slot's bag, advancing past anything already on the board. */
function drawFrom<T extends QuestDef>(
  plan: SlotPlan<T>,
  userSeed: number,
  index: number,
  taken: readonly string[],
): { quest: T; advanced: number } {
  let advanced = 0;
  let quest = bag(plan.pool, userSeed, plan.name, index);
  while (taken.includes(quest.id) && advanced < plan.pool.length * 2) {
    advanced += 1;
    quest = bag(plan.pool, userSeed, plan.name, index + advanced);
  }
  return { quest, advanced };
}

function drawSlots<T extends QuestDef>(
  plans: readonly [SlotPlan<T>, SlotPlan<T>, SlotPlan<T>],
  userSeed: number,
  index: number,
  offsets: Offsets,
): Slots {
  const slots: string[] = [];
  plans.forEach((plan, slot) => {
    slots.push(drawFrom(plan, userSeed, index + (offsets[slot] ?? 0), slots).quest.id);
  });
  return slots as Slots;
}

export function dailyIndex(day: DayKey): number {
  return diffDays(QUEST_EPOCH_DAY, day);
}

export function weeklyIndex(day: DayKey): number {
  return Math.round(diffDays(QUEST_EPOCH_WEEK, startOfWeek(day)) / 7);
}

const dailyPlans = (input: RotationInput) => slotPlans('daily', DAILY_QUESTS, 'easy', 3, input);
const weeklyPlans = (input: RotationInput) =>
  slotPlans('weekly', WEEKLY_QUESTS, 'consistency', 2, input);

/** The three dailies for a day. Same date, seed, focus and hidden actions: same quests. */
export function drawDaily(day: DayKey, input: RotationInput, offsets: Offsets = NO_OFFSETS): Slots {
  return drawSlots(dailyPlans(input), input.userSeed, dailyIndex(day), offsets);
}

/** The three weeklies for the week containing `day`. */
export function drawWeekly(
  day: DayKey,
  input: RotationInput,
  offsets: Offsets = NO_OFFSETS,
): Slots {
  return drawSlots(weeklyPlans(input), input.userSeed, weeklyIndex(day), offsets);
}

export function rotationInput(state: Pick<GameState, 'profile' | 'settings'>): RotationInput {
  return {
    userSeed: state.profile.userSeed,
    focus: state.profile.focus,
    hidden: hiddenActionSet(state),
  };
}

/** The Monday-to-Sunday days of a week key such as `W2026-10-05`. */
export function daysOfWeek(week: WeekKey): DayKey[] {
  const monday = week.slice(1);
  return dayRange(monday, addDays(monday, 6));
}

export function isClaimed(
  claims: readonly QuestClaim[],
  kind: QuestKind,
  period: string,
  questId: string,
): boolean {
  return claims.some(
    (claim) => claim.kind === kind && claim.period === period && claim.questId === questId,
  );
}

export function dailyProgress(state: FactsState, questId: string, day: DayKey): QuestProgress {
  const quest = DAILY_QUEST_BY_ID.get(questId);
  return quest ? evaluateCondition(quest.condition, state, [day]) : progress(0, 1);
}

export function weeklyProgress(state: FactsState, questId: string, week: WeekKey): QuestProgress {
  const quest = WEEKLY_QUEST_BY_ID.get(questId);
  return quest ? evaluateCondition(quest.condition, state, daysOfWeek(week)) : progress(0, 1);
}

/** Draws today's and this week's quests when the saved ones are missing, stale or unknown. */
export function ensureQuestPeriods(ctx: Ctx): void {
  const s = ctx.s;
  if (ctx.options.quests === false || !isOnboarded(s)) return;
  const input = rotationInput(s);
  const today = ctx.today;

  const daily = s.quests.daily;
  if (!daily || daily.key !== today) {
    const slots = drawDaily(today, input);
    s.quests.daily = { key: today, slots, swapsUsed: 0, swapOffsets: [0, 0, 0] };
    ctx.events.push({ type: 'quests-rotated', kind: 'daily', slots });
  } else if (daily.slots.some((id) => !DAILY_QUEST_BY_ID.has(id))) {
    s.quests.daily = redrawUnknown(
      daily,
      dailyPlans(input),
      input.userSeed,
      dailyIndex(today),
      (id) => DAILY_QUEST_BY_ID.has(id),
    );
  }

  const week = weekKey(today);
  const weekly = s.quests.weekly;
  if (!weekly || weekly.key !== week) {
    const slots = drawWeekly(today, input);
    s.quests.weekly = { key: week, slots, swapsUsed: 0, swapOffsets: [0, 0, 0] };
    ctx.events.push({ type: 'quests-rotated', kind: 'weekly', slots });
  } else if (weekly.slots.some((id) => !WEEKLY_QUEST_BY_ID.has(id))) {
    s.quests.weekly = redrawUnknown(
      weekly,
      weeklyPlans(input),
      input.userSeed,
      weeklyIndex(today),
      (id) => WEEKLY_QUEST_BY_ID.has(id),
    );
  }
}

/** A saved quest id that no longer exists (content update) is redrawn for that slot only. */
function redrawUnknown<K extends string, T extends QuestDef>(
  period: QuestPeriod<K>,
  plans: readonly [SlotPlan<T>, SlotPlan<T>, SlotPlan<T>],
  userSeed: number,
  index: number,
  exists: (id: string) => boolean,
): QuestPeriod<K> {
  const slots = [...period.slots] as Slots;
  plans.forEach((plan, slot) => {
    if (exists(slots[slot] as string)) return;
    const taken = slots.filter((id, other) => other !== slot && exists(id));
    slots[slot] = drawFrom(plan, userSeed, index + (period.swapOffsets[slot] ?? 0), taken).quest.id;
  });
  return { ...period, slots };
}

function payClaim(
  ctx: Ctx,
  kind: QuestKind,
  period: string,
  quest: { id: string; title: string; xp: number },
  auto: boolean,
): void {
  const s = ctx.s;
  const claim: QuestClaim = { questId: quest.id, kind, period, ts: ctx.now, xp: quest.xp, auto };
  s.quests.claims = [...s.quests.claims, claim];
  grantXp(ctx, quest.xp, kind === 'epic' ? 'epic' : 'quest');
  ctx.events.push({
    type: 'quest-claimed',
    questId: quest.id,
    kind,
    title: quest.title,
    xp: quest.xp,
    auto,
  });
  if (kind === 'daily' && isCleanSweepDay(s.quests.claims, period)) {
    const record = s.days[period];
    if (!record?.cleanSweep) {
      grantXp(ctx, XP_CLEAN_SWEEP, 'clean-sweep');
      if (record) s.days = { ...s.days, [period]: { ...record, cleanSweep: true } };
      ctx.events.push({ type: 'clean-sweep', day: period, xp: XP_CLEAN_SWEEP });
    }
  }
}

/**
 * Records a quest claim without checking a condition. The store never calls this
 * directly; it exists for the simulation harness, which injects claims as events.
 */
export function injectClaim(ctx: Ctx, kind: 'daily' | 'weekly', questId: string, xp: number): void {
  const period = kind === 'daily' ? ctx.today : weekKey(ctx.today);
  payClaim(ctx, kind, period, { id: questId, title: questId, xp }, false);
}

export type ClaimRefusal =
  | 'unknown-quest'
  | 'not-on-board'
  | 'already-claimed'
  | 'not-complete'
  | 'not-attested'
  | 'cooldown';

export type ClaimResult = { ok: true; xp: number } | { ok: false; reason: ClaimRefusal };

/** Claims a daily or weekly quest on the board. Idempotent: a second claim changes nothing. */
export function claimQuest(ctx: Ctx, questId: string): ClaimResult {
  const s = ctx.s;
  const daily = s.quests.daily;
  const weekly = s.quests.weekly;
  if (daily?.slots.includes(questId)) {
    const quest = DAILY_QUEST_BY_ID.get(questId);
    if (!quest) return { ok: false, reason: 'unknown-quest' };
    if (isClaimed(s.quests.claims, 'daily', daily.key, questId)) {
      return { ok: false, reason: 'already-claimed' };
    }
    if (!dailyProgress(s, questId, daily.key).done) return { ok: false, reason: 'not-complete' };
    payClaim(ctx, 'daily', daily.key, quest, false);
    return { ok: true, xp: quest.xp };
  }
  if (weekly?.slots.includes(questId)) {
    const quest = WEEKLY_QUEST_BY_ID.get(questId);
    if (!quest) return { ok: false, reason: 'unknown-quest' };
    if (isClaimed(s.quests.claims, 'weekly', weekly.key, questId)) {
      return { ok: false, reason: 'already-claimed' };
    }
    if (!weeklyProgress(s, questId, weekly.key).done) return { ok: false, reason: 'not-complete' };
    payClaim(ctx, 'weekly', weekly.key, quest, false);
    return { ok: true, xp: quest.xp };
  }
  return {
    ok: false,
    reason:
      DAILY_QUEST_BY_ID.has(questId) || WEEKLY_QUEST_BY_ID.has(questId)
        ? 'not-on-board'
        : 'unknown-quest',
  };
}

/**
 * Settles quest periods that have ended: a completed but unclaimed quest is claimed
 * automatically (an earned reward is never lost), the rest rotate out silently.
 */
export function settleQuestPeriods(ctx: Ctx): void {
  const s = ctx.s;
  if (ctx.options.quests === false || !isOnboarded(s)) return;
  let count = 0;
  let xp = 0;

  const daily = s.quests.daily;
  if (daily && daily.key < ctx.today) {
    for (const questId of daily.slots) {
      const quest = DAILY_QUEST_BY_ID.get(questId);
      if (!quest || isClaimed(s.quests.claims, 'daily', daily.key, questId)) continue;
      if (!dailyProgress(s, questId, daily.key).done) continue;
      payClaim(ctx, 'daily', daily.key, quest, true);
      count += 1;
      xp += quest.xp;
    }
    s.quests.daily = null;
  }

  const weekly = s.quests.weekly;
  if (weekly && weekly.key !== weekKey(ctx.today) && weekly.key < weekKey(ctx.today)) {
    for (const questId of weekly.slots) {
      const quest = WEEKLY_QUEST_BY_ID.get(questId);
      if (!quest || isClaimed(s.quests.claims, 'weekly', weekly.key, questId)) continue;
      if (!weeklyProgress(s, questId, weekly.key).done) continue;
      payClaim(ctx, 'weekly', weekly.key, quest, true);
      count += 1;
      xp += quest.xp;
    }
    s.quests.weekly = null;
  }

  if (count > 0) queueNotice(ctx, 'auto-claimed', ctx.today, { count, xp });
}

/**
 * Takes back claims of the open periods whose condition no longer holds after an undo.
 * Their XP is removed and they become claimable again once the condition holds.
 */
export function voidBrokenClaims(ctx: Ctx): void {
  const s = ctx.s;
  if (ctx.options.quests === false) return;
  // Only removing a log or a note can break a condition that already held.
  if (s.logs === ctx.before.logs && s.journal === ctx.before.journal) return;
  const daily = s.quests.daily;
  const weekly = s.quests.weekly;
  const broken = (claim: QuestClaim): boolean => {
    if (claim.auto) return false;
    if (claim.kind === 'daily') {
      return (
        daily?.key === claim.period &&
        DAILY_QUEST_BY_ID.has(claim.questId) &&
        !dailyProgress(s, claim.questId, claim.period).done
      );
    }
    if (claim.kind === 'weekly') {
      return (
        weekly?.key === claim.period &&
        WEEKLY_QUEST_BY_ID.has(claim.questId) &&
        !weeklyProgress(s, claim.questId, claim.period).done
      );
    }
    // An epic claimed today is still live; once the day is torn off it is settled.
    const epic = EPIC_BY_ID.get(claim.questId);
    return (
      epic !== undefined &&
      epic.attestation === null &&
      dayKey(claim.ts) === ctx.today &&
      !epicRequirementProgress(s, epic).done
    );
  };
  const voided = s.quests.claims.filter(broken);
  if (voided.length === 0) return;

  s.quests.claims = s.quests.claims.filter((claim) => !voided.includes(claim));
  for (const claim of voided) {
    grantXp(ctx, -claim.xp, claim.kind === 'epic' ? 'epic' : 'quest');
    if (claim.kind === 'epic') {
      const saved = s.quests.epics[claim.questId];
      if (saved)
        s.quests.epics = { ...s.quests.epics, [claim.questId]: { ...saved, claimedTs: null } };
    }
    ctx.events.push({
      type: 'quest-voided',
      questId: claim.questId,
      kind: claim.kind,
      xp: claim.xp,
    });
  }
  if (daily) {
    const record = s.days[daily.key];
    if (record?.cleanSweep && !isCleanSweepDay(s.quests.claims, daily.key)) {
      grantXp(ctx, -XP_CLEAN_SWEEP, 'clean-sweep');
      s.days = { ...s.days, [daily.key]: { ...record, cleanSweep: false } };
    }
  }
}

export type SwapRefusal = 'no-period' | 'no-swaps-left' | 'has-progress' | 'claimed' | 'bad-slot';
export type SwapResult = { ok: true; questId: string } | { ok: false; reason: SwapRefusal };

/** "Not today → swap": one per day and one per week, only on a quest with zero progress. */
export function swapQuest(ctx: Ctx, kind: 'daily' | 'weekly', slot: number): SwapResult {
  const s = ctx.s;
  const period = kind === 'daily' ? s.quests.daily : s.quests.weekly;
  if (!period) return { ok: false, reason: 'no-period' };
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) return { ok: false, reason: 'bad-slot' };
  if (period.swapsUsed >= 1) return { ok: false, reason: 'no-swaps-left' };
  const current = period.slots[slot] as string;
  if (isClaimed(s.quests.claims, kind, period.key, current))
    return { ok: false, reason: 'claimed' };
  const state =
    kind === 'daily'
      ? dailyProgress(s, current, period.key)
      : weeklyProgress(s, current, period.key);
  if (state.current > 0) return { ok: false, reason: 'has-progress' };

  const input = rotationInput(s);
  const plans = kind === 'daily' ? dailyPlans(input) : weeklyPlans(input);
  const plan = plans[slot] as SlotPlan<QuestDef>;
  const index = kind === 'daily' ? dailyIndex(ctx.today) : weeklyIndex(ctx.today);
  const offset = (period.swapOffsets[slot] ?? 0) + 1;
  const { quest, advanced } = drawFrom(plan, input.userSeed, index + offset, period.slots);
  if (period.slots.includes(quest.id)) return { ok: false, reason: 'no-swaps-left' };

  const slots = [...period.slots] as Slots;
  const offsets = [...period.swapOffsets] as Offsets;
  slots[slot] = quest.id;
  offsets[slot] = offset + advanced;
  const next = { ...period, slots, swapOffsets: offsets, swapsUsed: period.swapsUsed + 1 };
  if (kind === 'daily') s.quests.daily = next as QuestPeriod<DayKey>;
  else s.quests.weekly = next as QuestPeriod<WeekKey>;
  ctx.events.push({ type: 'quest-swapped', kind, slot, from: current, to: quest.id });
  return { ok: true, questId: quest.id };
}

// ── Epics ───────────────────────────────────────────────────────────────────

const EMPTY_EPIC: EpicProgress = { checklist: [], note: '', claimedTs: null };

/** Window results per log list, so an unchanged list is never scanned twice. */
const windowCache = memoize((_logs: readonly LogEntry[]) => new Map<string, number>());

function bestWindowActs(logs: readonly LogEntry[], actions: ActionSet, windowDays: number): number {
  const cache = windowCache(logs);
  const key = `${actions === '*' ? '*' : actions.join()}|${windowDays}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const best = scanWindows(logs, actions, windowDays);
  cache.set(key, best);
  return best;
}

function scanWindows(logs: readonly LogEntry[], actions: ActionSet, windowDays: number): number {
  const perDay = new Map<DayKey, number>();
  for (const log of logs) {
    if (log.rewardedActs > 0 && inSet(actions, log.actionId)) {
      perDay.set(log.day, (perDay.get(log.day) ?? 0) + log.rewardedActs);
    }
  }
  const days = [...perDay.keys()].sort();
  let best = 0;
  let sum = 0;
  let start = 0;
  for (let end = 0; end < days.length; end += 1) {
    sum += perDay.get(days[end] as DayKey) ?? 0;
    while (diffDays(days[start] as DayKey, days[end] as DayKey) >= windowDays) {
      sum -= perDay.get(days[start] as DayKey) ?? 0;
      start += 1;
    }
    best = Math.max(best, sum);
  }
  return best;
}

type EpicState = Pick<GameState, 'logs' | 'tree' | 'learn'>;

function requirementValue(state: EpicState, requirement: EpicRequirement): number {
  switch (requirement.kind) {
    case 'lifetimeActs': {
      if (requirement.actions === '*') return lifetimeLogStats(state.logs).rewardedActs;
      const byAction = lifetimeLogStats(state.logs).actsByAction;
      return requirement.actions.reduce((sum, id) => sum + (byAction.get(id) ?? 0), 0);
    }
    case 'windowActs':
      return bestWindowActs(state.logs, requirement.actions, requirement.windowDays);
    case 'rings':
      return state.tree.rings;
    case 'lessonsPassed':
      return Object.values(state.learn.lessons).filter((lesson) => lesson.passedTs !== null).length;
  }
}

/** Progress of an epic's automatic requirement; an epic without one counts as met. */
export function epicRequirementProgress(state: EpicState, epic: EpicDef): QuestProgress {
  if (!epic.requirement) return { current: 1, target: 1, done: true };
  return progress(requirementValue(state, epic.requirement), epic.requirement.min);
}

function attestationFilled(epic: EpicDef, saved: EpicProgress): boolean {
  const attestation = epic.attestation;
  if (!attestation) return true;
  switch (attestation.kind) {
    case 'confirm':
      return true;
    case 'checklist':
      return attestation.items.every((_, index) => saved.checklist[index] === true);
    case 'note':
      return saved.note.trim().length > 0;
    case 'form': {
      const lines = saved.note.split('\n');
      return attestation.fields.every((_, index) => (lines[index] ?? '').trim().length > 0);
    }
  }
}

export interface EpicStatus {
  epic: EpicDef;
  progress: QuestProgress;
  saved: EpicProgress;
  selfAttested: boolean;
  /** Checklist, note or form is complete (always true for automatic epics). */
  attestationFilled: boolean;
  claimed: boolean;
  claimable: boolean;
  /** Days until another self-attested epic can be claimed; 0 when it can be now. */
  cooldownDays: number;
  pinned: boolean;
}

export function epicCooldownDays(state: Pick<GameState, 'quests'>, today: DayKey): number {
  const last = state.quests.lastSelfAttestedTs;
  if (last === null) return 0;
  return Math.max(0, SELF_ATTESTED_EPIC_COOLDOWN_DAYS - diffDays(dayKey(last), today));
}

export function epicStatus(
  state: Pick<GameState, 'logs' | 'tree' | 'learn' | 'quests'>,
  epic: EpicDef,
  today: DayKey,
): EpicStatus {
  const saved = state.quests.epics[epic.id] ?? EMPTY_EPIC;
  const requirement = epicRequirementProgress(state, epic);
  const selfAttested = epic.attestation !== null;
  const filled = attestationFilled(epic, saved);
  const claimed = saved.claimedTs !== null;
  const cooldownDays = selfAttested && !claimed ? epicCooldownDays(state, today) : 0;
  return {
    epic,
    progress: requirement,
    saved,
    selfAttested,
    attestationFilled: filled,
    claimed,
    claimable: !claimed && requirement.done && filled && cooldownDays === 0,
    cooldownDays,
    pinned: state.quests.pinnedEpic === epic.id,
  };
}

export function allEpicStatuses(
  state: Pick<GameState, 'logs' | 'tree' | 'learn' | 'quests'>,
  today: DayKey,
): EpicStatus[] {
  return EPICS.map((epic) => epicStatus(state, epic, today));
}

/** Saves checklist ticks and the note or form of a self-attested epic. */
export function updateEpic(
  ctx: Ctx,
  epicId: string,
  patch: { checklist?: readonly boolean[]; note?: string },
): boolean {
  const epic = EPIC_BY_ID.get(epicId);
  if (!epic) return false;
  const saved = ctx.s.quests.epics[epicId] ?? EMPTY_EPIC;
  if (saved.claimedTs !== null) return false;
  const size = epic.attestation?.kind === 'checklist' ? epic.attestation.items.length : 0;
  const checklist = patch.checklist
    ? Array.from({ length: size }, (_, index) => patch.checklist?.[index] === true)
    : saved.checklist;
  const note = patch.note !== undefined ? patch.note.slice(0, 600) : saved.note;
  ctx.s.quests.epics = { ...ctx.s.quests.epics, [epicId]: { ...saved, checklist, note } };
  return true;
}

/**
 * Claims an epic, once. A self-attested epic needs `confirmed: true` (the hold-to-confirm
 * or its plain button) and respects the one-per-seven-days limit.
 */
export function claimEpic(ctx: Ctx, epicId: string, confirmed: boolean): ClaimResult {
  const s = ctx.s;
  const epic = EPIC_BY_ID.get(epicId);
  if (!epic) return { ok: false, reason: 'unknown-quest' };
  const status = epicStatus(s, epic, ctx.today);
  if (status.claimed) return { ok: false, reason: 'already-claimed' };
  if (!status.progress.done) return { ok: false, reason: 'not-complete' };
  if (status.selfAttested && (!confirmed || !status.attestationFilled)) {
    return { ok: false, reason: 'not-attested' };
  }
  if (status.cooldownDays > 0) return { ok: false, reason: 'cooldown' };

  s.quests.epics = { ...s.quests.epics, [epicId]: { ...status.saved, claimedTs: ctx.now } };
  if (status.selfAttested) s.quests.lastSelfAttestedTs = ctx.now;
  if (s.quests.pinnedEpic === epicId) s.quests.pinnedEpic = null;
  payClaim(ctx, 'epic', 'epic', epic, false);
  writeActivity(ctx, 'epic', `Epic finished: ${epic.title}.`);
  return { ok: true, xp: epic.xp };
}

export function pinEpic(ctx: Ctx, epicId: string | null): boolean {
  if (epicId !== null && !EPIC_BY_ID.has(epicId)) return false;
  ctx.s.quests.pinnedEpic = epicId;
  return true;
}
