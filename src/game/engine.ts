/**
 * The one path every mutation takes. `transact` settles the calendar, runs an operation
 * on a draft, reconciles everything derived from it (voided claims, challenge, badges,
 * levels, stages) and returns the next state with the events that describe the change.
 * Pure: the same state, time and operation always give the same result.
 */
import { CATEGORY_IDS, type CategoryId } from '@/data/catalogue';
import { DAILY_QUEST_BY_ID, EPICS, WEEKLY_QUEST_BY_ID } from '@/data/quests';
import type { Species, WorldMotion, WorldPreference } from '@/world/contract';
import { awardEarnedBadges, forceBadge } from './badges';
import {
  buildBaselineResult,
  heatFromAnswers,
  parseBaselineAnswers,
  suggestFocus,
} from './baseline';
import { checkIn, normalizeRestDays, restDaysEffectiveFrom, settleDays } from './calendar';
import { isKnownRegion } from './co2';
import { reconcileChallenge } from './community';
import {
  beginCtx,
  grantGp,
  grantXp,
  sealState,
  writeActivity,
  type Ctx,
  type EngineOptions,
} from './ctx';
import { FOCUS_MAX, NAME_MAX, TREE_NAME_MAX, XP_CEREMONY } from './economy';
import type { GameEvent } from './events';
import { growthOf, stageIndexOf, stageName, stageProgressLabel } from './growth';
import { levelOf, levelTitle } from './levels';
import {
  dailyProgress,
  ensureQuestPeriods,
  epicStatus,
  isClaimed,
  settleQuestPeriods,
  voidBrokenClaims,
  weeklyProgress,
} from './quests';
import { isOnboarded } from './state';
import type {
  BadgeTier,
  BaselineAnswers,
  GameState,
  HeatSource,
  Profile,
  RegionId,
  Settings,
  Units,
} from './types';

export interface TransactResult<T> {
  state: GameState;
  events: GameEvent[];
  result: T;
}

/** Reports quest progress that moved, and quests that just became claimable. */
function emitQuestChanges(ctx: Ctx): void {
  const { s, before } = ctx;
  if (ctx.options.quests === false) return;
  const untouched =
    s.logs === before.logs &&
    s.days === before.days &&
    s.breaks === before.breaks &&
    s.journal === before.journal &&
    s.learn.opens === before.learn.opens &&
    s.learn.lessons === before.learn.lessons &&
    s.quests.claims === before.quests.claims &&
    s.quests.daily === before.quests.daily &&
    s.quests.weekly === before.quests.weekly &&
    s.quests.epics === before.quests.epics;
  if (untouched) return;

  const daily = s.quests.daily;
  if (daily) {
    for (const questId of daily.slots) {
      const quest = DAILY_QUEST_BY_ID.get(questId);
      if (!quest) continue;
      const now = dailyProgress(s, questId, daily.key);
      const was =
        before.quests.daily?.key === daily.key ? dailyProgress(before, questId, daily.key) : null;
      if (was && was.current === now.current && was.done === now.done) continue;
      if (!was && now.current === 0) continue;
      ctx.events.push({
        type: 'quest-progress',
        questId,
        kind: 'daily',
        current: now.current,
        target: now.target,
      });
      if (now.done && !was?.done && !isClaimed(s.quests.claims, 'daily', daily.key, questId)) {
        ctx.events.push({ type: 'quest-claimable', questId, kind: 'daily', title: quest.title });
      }
    }
  }
  const weekly = s.quests.weekly;
  if (weekly) {
    for (const questId of weekly.slots) {
      const quest = WEEKLY_QUEST_BY_ID.get(questId);
      if (!quest) continue;
      const now = weeklyProgress(s, questId, weekly.key);
      const was =
        before.quests.weekly?.key === weekly.key
          ? weeklyProgress(before, questId, weekly.key)
          : null;
      if (was && was.current === now.current && was.done === now.done) continue;
      if (!was && now.current === 0) continue;
      ctx.events.push({
        type: 'quest-progress',
        questId,
        kind: 'weekly',
        current: now.current,
        target: now.target,
      });
      if (now.done && !was?.done && !isClaimed(s.quests.claims, 'weekly', weekly.key, questId)) {
        ctx.events.push({ type: 'quest-claimable', questId, kind: 'weekly', title: quest.title });
      }
    }
  }
  if (!isOnboarded(before)) return;
  // Epic requirements read only these slices; anything else cannot move their progress.
  const epicsUntouched =
    s.logs === before.logs &&
    s.tree.rings === before.tree.rings &&
    s.learn.lessons === before.learn.lessons &&
    s.quests.epics === before.quests.epics;
  if (epicsUntouched) return;
  for (const epic of EPICS) {
    const now = epicStatus(s, epic, ctx.today);
    if (now.claimed) continue;
    const was = epicStatus(before, epic, before.clock.today);
    if (now.progress.current !== was.progress.current) {
      ctx.events.push({
        type: 'quest-progress',
        questId: epic.id,
        kind: 'epic',
        current: now.progress.current,
        target: now.progress.target,
      });
    }
    if (now.claimable && !was.claimable && epic.attestation === null) {
      ctx.events.push({
        type: 'quest-claimable',
        questId: epic.id,
        kind: 'epic',
        title: epic.title,
      });
    }
  }
}

/** Growth, stage and level changes, reported once per transaction. */
function emitProgression(ctx: Ctx): void {
  const { s, before } = ctx;
  if (s.tree.gp !== before.tree.gp) {
    ctx.events.push({
      type: 'growth',
      gp: s.tree.gp,
      delta: s.tree.gp - before.tree.gp,
      growth: growthOf(s.tree.gp),
      previousGrowth: growthOf(before.tree.gp),
      stage: stageName(stageIndexOf(s.tree.gp)),
      label: stageProgressLabel(s.tree.gp),
    });
    const stage = stageIndexOf(s.tree.gp);
    if (stage > stageIndexOf(before.tree.gp)) {
      const first = stage > s.seen.maxStage;
      if (first) {
        s.seen.maxStage = stage;
        // The sprout rising is the planting ceremony itself, not a second celebration.
        if (stage > 1) writeActivity(ctx, 'stage', `{Tree} became ${article(stageName(stage))}.`);
      }
      ctx.events.push({ type: 'stage-up', stage: stageName(stage), stageIndex: stage, first });
    }
  }
  if (s.xp !== before.xp) {
    const level = levelOf(s.xp);
    const from = levelOf(before.xp);
    if (level > from) {
      const first = level > s.seen.maxLevel;
      if (first) {
        s.seen.maxLevel = level;
        writeActivity(ctx, 'level', `Level ${level} — ${levelTitle(level)}.`);
      }
      ctx.events.push({ type: 'level-up', level, from, title: levelTitle(level), first });
    }
  }
}

function article(stage: string): string {
  const lower = stage.toLowerCase();
  return `${/^[aeiou]/.test(lower) ? 'an' : 'a'} ${lower}`;
}

/**
 * Runs one operation as a transaction. The calendar is settled first, so an operation
 * always sees today; everything derived is reconciled afterwards.
 */
export function transact<T>(
  state: GameState,
  now: number,
  run: (ctx: Ctx) => T,
  options: EngineOptions = {},
): TransactResult<T> {
  const ctx = beginCtx(state, now, options);
  settleDays(ctx);
  settleQuestPeriods(ctx);
  ensureQuestPeriods(ctx);
  const result = run(ctx);
  // Periods may have been missing while the operation ran (onboarding, import).
  ensureQuestPeriods(ctx);
  voidBrokenClaims(ctx);
  reconcileChallenge(ctx);
  awardEarnedBadges(ctx);
  emitQuestChanges(ctx);
  emitProgression(ctx);

  const sealed = sealState(ctx);
  if (sealed === state) return { state, events: ctx.events, result };
  // Nobody did anything in a passive tick, so it is not the newest event.
  if (options.passive) return { state: sealed, events: ctx.events, result };
  const lastEventTs = Math.max(sealed.clock.lastEventTs, now);
  const next =
    lastEventTs === sealed.clock.lastEventTs
      ? sealed
      : { ...sealed, clock: { ...sealed.clock, lastEventTs } };
  return { state: next, events: ctx.events, result };
}

/**
 * Settles the calendar and nothing else: app open, resume and the midnight timer. Passive:
 * a clock that jumped far ahead changes nothing until a real action confirms the day.
 */
export function tick(
  state: GameState,
  now: number,
  options: EngineOptions = {},
): TransactResult<void> {
  return transact(state, now, () => undefined, { ...options, passive: true });
}

/**
 * Settles the calendar as an action would, however far the clock moved: an import, QA
 * time travel, the fixture generator. Never called on a timer.
 */
export function settle(
  state: GameState,
  now: number,
  options: EngineOptions = {},
): TransactResult<void> {
  return transact(state, now, () => undefined, { ...options, passive: false });
}

// ── Operations ──────────────────────────────────────────────────────────────

const SPECIES = ['oak', 'cherry', 'pine'] as const satisfies readonly Species[];
const HEAT: readonly HeatSource[] = ['unknown', 'gas', 'electric', 'heat-pump', 'none'];
const UNITS: readonly Units[] = ['metric', 'imperial'];
const MOTION: readonly WorldMotion[] = ['system', 'reduced', 'full'];
const GRAPHICS: readonly WorldPreference[] = ['auto', 'low', 'medium', 'high', 'off'];

export function isSpecies(value: unknown): value is Species {
  return (SPECIES as readonly unknown[]).includes(value);
}

function cleanName(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Cleans a focus choice: known categories, unique, at most three; `null` when none is left. */
export function normalizeFocus(input: readonly unknown[]): CategoryId[] | null {
  const focus: CategoryId[] = [];
  for (const item of input) {
    const category = CATEGORY_IDS.find((id) => id === item);
    if (category && !focus.includes(category)) focus.push(category);
  }
  return focus.length >= 1 ? focus.slice(0, FOCUS_MAX) : null;
}

export type ProfilePatch = Partial<
  Pick<Profile, 'name' | 'treeName' | 'species' | 'region' | 'heat' | 'units' | 'focus'>
>;

export type ProfileRefusal =
  | 'tree-name-required'
  | 'unknown-species'
  | 'unknown-region'
  | 'invalid-heat'
  | 'invalid-units'
  | 'invalid-focus';

export type ProfileResult = { ok: true } | { ok: false; reason: ProfileRefusal; message: string };

const PROFILE_MESSAGES: Record<ProfileRefusal, string> = {
  'tree-name-required': 'Give your tree a name.',
  'unknown-species': 'Pick oak, cherry blossom or pine.',
  'unknown-region': "That region isn't in our list.",
  'invalid-heat': 'Pick how your heating and hot water are powered.',
  'invalid-units': 'Pick metric or imperial.',
  'invalid-focus': 'Choose one to three focus areas.',
};

/**
 * Changes the profile. Everything is validated first, so a refused patch changes
 * nothing. Re-planting as another species keeps growth, rings and the seed.
 */
export function updateProfile(ctx: Ctx, patch: ProfilePatch): ProfileResult {
  const no = (reason: ProfileRefusal): ProfileResult => ({
    ok: false,
    reason,
    message: PROFILE_MESSAGES[reason],
  });
  const next: Profile = { ...ctx.s.profile };
  if (patch.name !== undefined) next.name = cleanName(patch.name, NAME_MAX) || 'Friend';
  if (patch.treeName !== undefined) {
    const treeName = cleanName(patch.treeName, TREE_NAME_MAX);
    if (!treeName) return no('tree-name-required');
    next.treeName = treeName;
  }
  if (patch.species !== undefined) {
    if (!isSpecies(patch.species)) return no('unknown-species');
    next.species = patch.species;
  }
  if (patch.region !== undefined) {
    if (!isKnownRegion(patch.region)) return no('unknown-region');
    next.region = patch.region;
  }
  if (patch.heat !== undefined) {
    if (!HEAT.includes(patch.heat)) return no('invalid-heat');
    next.heat = patch.heat;
  }
  if (patch.units !== undefined) {
    if (!UNITS.includes(patch.units)) return no('invalid-units');
    next.units = patch.units;
  }
  let focusChanged = false;
  if (patch.focus !== undefined) {
    const focus = normalizeFocus(patch.focus);
    if (!focus) return no('invalid-focus');
    focusChanged = focus.join() !== ctx.s.profile.focus.join();
    if (focusChanged) next.focus = focus;
  }
  Object.assign(ctx.s.profile, next);
  if (focusChanged) ctx.events.push({ type: 'focus-changed', focus: next.focus });
  return { ok: true };
}

export type SettingsPatch = Partial<
  Pick<
    Settings,
    | 'restDays'
    | 'hiddenActions'
    | 'sound'
    | 'haptics'
    | 'motion'
    | 'graphics'
    | 'sky'
    | 'celebrations'
    | 'shareStatsWithCoach'
  >
>;

/**
 * Changes settings. Unknown values are ignored. Rest days are not applied at once: they
 * take effect from the following Monday, so a missed day cannot be rescued afterwards.
 */
export function updateSettings(ctx: Ctx, patch: SettingsPatch): void {
  const settings = ctx.s.settings;
  if (typeof patch.sound === 'boolean') settings.sound = patch.sound;
  if (typeof patch.haptics === 'boolean') settings.haptics = patch.haptics;
  if (typeof patch.shareStatsWithCoach === 'boolean') {
    settings.shareStatsWithCoach = patch.shareStatsWithCoach;
  }
  if (patch.motion !== undefined && MOTION.includes(patch.motion)) settings.motion = patch.motion;
  if (patch.graphics !== undefined && GRAPHICS.includes(patch.graphics)) {
    settings.graphics = patch.graphics;
  }
  if (patch.sky === 'local' || patch.sky === 'day') settings.sky = patch.sky;
  if (patch.celebrations === 'full' || patch.celebrations === 'subtle') {
    settings.celebrations = patch.celebrations;
  }
  if (Array.isArray(patch.hiddenActions)) {
    const hidden = [
      ...new Set(patch.hiddenActions.filter((id) => typeof id === 'string' && id.length <= 80)),
    ].slice(0, 200);
    if (hidden.join() !== settings.hiddenActions.join()) settings.hiddenActions = hidden;
  }
  if (Array.isArray(patch.restDays)) {
    const restDays = normalizeRestDays(patch.restDays);
    if (restDays.join() === settings.restDays.join()) {
      settings.restDaysPending = null;
      settings.restDaysFrom = null;
    } else if (!isOnboarded(ctx.s)) {
      // Nothing can be rescued before the tree exists: apply immediately.
      settings.restDays = restDays;
      settings.restDaysPending = null;
      settings.restDaysFrom = null;
    } else {
      settings.restDaysPending = restDays;
      settings.restDaysFrom = restDaysEffectiveFrom(ctx.today);
    }
  }
}

/** "Not for me": hides or shows one action. */
export function setActionHidden(ctx: Ctx, actionId: string, hidden: boolean): void {
  const current = ctx.s.settings.hiddenActions;
  if (hidden === current.includes(actionId)) return;
  ctx.s.settings.hiddenActions = hidden
    ? [...current, actionId]
    : current.filter((id) => id !== actionId);
}

export type BaselineOpResult =
  | { ok: true; totalTonnes: number; suggestedFocus: CategoryId[] }
  | { ok: false; reason: 'incomplete-answers' };

/**
 * Stores a finished starting-line quiz. Earlier results move to the history; old logs
 * are never rewritten. `useAsFocus` adopts the suggested focus areas.
 */
export function setBaseline(
  ctx: Ctx,
  rawAnswers: unknown,
  options: { useAsFocus?: boolean } = {},
): BaselineOpResult {
  const answers: BaselineAnswers | null = parseBaselineAnswers(rawAnswers);
  if (!answers) return { ok: false, reason: 'incomplete-answers' };
  const s = ctx.s;
  const result = buildBaselineResult(answers, s.profile.region, ctx.today);
  const first = s.baseline.current === null;
  s.baseline.history = s.baseline.current
    ? [s.baseline.current, ...s.baseline.history].slice(0, 24)
    : s.baseline.history;
  s.baseline.current = result;
  if (s.profile.heat === 'unknown') s.profile.heat = heatFromAnswers(answers);
  const suggestedFocus = suggestFocus(result.tonnes);
  if (options.useAsFocus && suggestedFocus.join() !== s.profile.focus.join()) {
    s.profile.focus = suggestedFocus;
    ctx.events.push({ type: 'focus-changed', focus: suggestedFocus });
  }
  ctx.events.push({ type: 'baseline-set', totalTonnes: result.tonnes.total, first });
  return { ok: true, totalTonnes: result.tonnes.total, suggestedFocus };
}

export function clearBaseline(ctx: Ctx): void {
  if (!ctx.s.baseline.current && ctx.s.baseline.history.length === 0) return;
  ctx.s.baseline.current = null;
  ctx.s.baseline.history = [];
}

export interface OnboardInput {
  name?: string;
  treeName: string;
  species: Species;
  /** A fresh uint32 for this tree, from `randomSeed()`; fixed for good. */
  userSeed: number;
  region?: RegionId;
  focus?: readonly CategoryId[];
  heat?: HeatSource;
  units?: Units;
  /** Answers of the starting-line quiz, when it was taken during onboarding. */
  baselineAnswers?: unknown;
}

export type OnboardResult =
  { ok: true } | { ok: false; reason: 'already-onboarded' | ProfileRefusal; message: string };

/**
 * The seed-planting ceremony: creates the profile, fixes the seed, draws ring 1 and pays
 * 25 XP on top of the day's check-in. Happens exactly once.
 */
export function plantTree(ctx: Ctx, input: OnboardInput): OnboardResult {
  const s = ctx.s;
  if (isOnboarded(s) && s.tree.rings > 0 && s.onboarding.step >= 8) {
    return { ok: false, reason: 'already-onboarded', message: 'Your tree is already planted.' };
  }
  const profile = updateProfile(ctx, {
    name: input.name ?? s.profile.name,
    treeName: input.treeName,
    species: input.species,
    region: input.region ?? s.profile.region,
    heat: input.heat ?? s.profile.heat,
    units: input.units ?? s.profile.units,
    focus: input.focus ? [...input.focus] : s.profile.focus,
  });
  if (!profile.ok) return profile;

  s.profile.userSeed = input.userSeed >>> 0;
  if (!isOnboarded(s)) s.profile.plantedDay = ctx.today;
  s.onboarding.completedAt = ctx.now;
  s.onboarding.step = 8;
  if (input.baselineAnswers !== undefined && input.baselineAnswers !== null) {
    setBaseline(ctx, input.baselineAnswers);
  }
  // A legacy log replayed onto today has already drawn today's ring.
  if (!checkIn(ctx, 'ceremony')) grantXp(ctx, XP_CEREMONY, 'ceremony');
  ctx.events.push({
    type: 'planted',
    treeName: s.profile.treeName,
    species: s.profile.species,
    day: ctx.today,
  });
  return { ok: true };
}

/** The Water button: today's check-in. Returns false when today was already watered. */
export function water(ctx: Ctx): boolean {
  return isOnboarded(ctx.s) ? checkIn(ctx, 'water') : false;
}

export function setOnboardingStep(ctx: Ctx, step: number): void {
  if (isOnboarded(ctx.s) || !Number.isFinite(step)) return;
  ctx.s.onboarding.step = Math.min(7, Math.max(0, Math.round(step)));
}

export function markCoachMarksSeen(ctx: Ctx): void {
  ctx.s.onboarding.coachMarksSeen = true;
}

export function markCoachPrivacyNoticeSeen(ctx: Ctx): void {
  ctx.s.seen.coachPrivacyNotice = true;
}

/** A one-time message was shown: it never comes back. */
export function dismissNotice(ctx: Ctx, noticeId: string): void {
  const s = ctx.s;
  if (!s.notices.some((notice) => notice.id === noticeId)) return;
  s.notices = s.notices.filter((notice) => notice.id !== noticeId);
  if (!s.seen.messages.includes(noticeId)) {
    s.seen.messages = [...s.seen.messages, noticeId].slice(-300);
  }
}

export function markRecapSeen(ctx: Ctx, week: string): void {
  if (ctx.s.seen.recapWeek === null || week > ctx.s.seen.recapWeek) ctx.s.seen.recapWeek = week;
}

/** A share card was exported; the first one earns Show & Tell. */
export function recordShareExport(ctx: Ctx): void {
  if (isOnboarded(ctx.s)) ctx.s.seen.shareExports += 1;
}

// ── QA helpers (reached only through the DEV-only window helper) ────────────

export function devGrantXp(ctx: Ctx, amount: number): void {
  grantXp(ctx, amount, 'dev');
}

export function devGrantGp(ctx: Ctx, amount: number): void {
  grantGp(ctx, amount);
}

export function devUnlockBadge(ctx: Ctx, badgeId: string, tier: BadgeTier = 1): boolean {
  return forceBadge(ctx, badgeId, tier);
}
