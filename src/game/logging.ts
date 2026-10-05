/**
 * Logging an action (product spec sections 3.3 to 3.6): quantity validation, the
 * honest "≈ kg" with the regional adjustment, hard daily caps, the double-counting
 * rules, undo and delete. Today is live: it is re-scored from its logs after every
 * change. The past is settled: deleting an old log subtracts exactly what it stored.
 */
import {
  ACTION_BY_ID,
  CATEGORY_IDS,
  EVIDENCE_META,
  GROUP_BY_ID,
  type ActionDef,
  type CategoryId,
} from '@/data/catalogue';
import { addDays, type DayKey } from '@/lib/dates';
import { classifyLog } from './baseline';
import { checkIn, syncRing } from './calendar';
import { encodeVariant, estimateKg, type KgEstimate, type LogInputs } from './co2';
import { grantGp, grantXp, type Ctx } from './ctx';
import {
  CUSTOM_AI_KG_PER_DAY_MAX,
  CUSTOM_AI_KG_PER_LOG_MAX,
  CUSTOM_TITLE_MAX,
  CUSTOM_TITLE_MIN,
  DOUBLE_TAP_MS,
  FLIGHT_SWAPS_PER_30_DAYS,
  KEEP_PHONE_COOLDOWN_DAYS,
  SAVED_CUSTOM_ACTIONS_MAX,
  UNDO_WINDOW_MS,
} from './economy';
import { growPulseStrength } from './growth';
import { logsOn } from './indexes';
import {
  CUSTOM_ACTION_ID,
  CUSTOM_GROUP_ID,
  actsOf,
  previewLog,
  roomFor,
  scoreDay,
  scoringRuleFor,
  type ScoredLog,
} from './scoring';
import { isOnboarded } from './state';
import type { GameState, LogEntry, LogSource, SavedCustomAction } from './types';

export type LogRefusalReason =
  | 'not-onboarded'
  | 'unknown-action'
  | 'invalid-quantity'
  | 'too-precise'
  | 'over-cap'
  | 'duplicate'
  | 'covered-by-day'
  | 'meals-logged'
  | 'cooldown'
  | 'invalid-custom';

export interface LogRefusal {
  ok: false;
  reason: LogRefusalReason;
  /** Final UI copy for the refusal. */
  message: string;
}

export interface LogActionInput {
  actionId: string;
  /** Defaults to the last-used quantity, then the action's default preset. */
  qty?: number;
  source?: LogSource;
  inputs?: LogInputs;
}

export interface LogCustomInput {
  title: string;
  emoji?: string;
  category: CategoryId;
  effort: 1 | 2 | 3 | 4;
  qty?: number;
  unit?: string;
  /** A conservative AI estimate in kg, or `null` for "impact not quantified". */
  co2eKg?: number | null;
  /** Keep in "My actions" for one-tap reuse. */
  save?: boolean;
}

export type LogResult = { ok: true; log: LogEntry } | LogRefusal;

type LogState = Pick<GameState, 'logs' | 'profile' | 'baseline' | 'settings'>;

const refuse = (reason: LogRefusalReason, message: string): LogRefusal => ({
  ok: false,
  reason,
  message,
});

const OVER_CAP = "That's more than a day can hold. Typo?";
const DAY_TILES = new Set(['vegetarian-day', 'vegan-day']);
const FLIGHT_GROUP = 'flight-swap';
const PLATE_GROUP = 'plate';

function sumQty(logs: readonly LogEntry[], match: (log: LogEntry) => boolean): number {
  let total = 0;
  for (const log of logs) if (match(log)) total += log.qty;
  return total;
}

function hasDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(Math.round(value * factor) - value * factor) > 1e-6;
}

/** Quantity still loggable today for an action, after its own cap and its group's. */
export function remainingUnits(
  state: Pick<GameState, 'logs'>,
  action: ActionDef,
  day: DayKey,
): number {
  const today = logsOn(state.logs, day);
  let room = action.dailyCap - sumQty(today, (log) => log.actionId === action.id);
  const group = action.group ? GROUP_BY_ID.get(action.group) : undefined;
  if (group?.unitCap != null) {
    const used = sumQty(today, (log) => group.actions.includes(log.actionId));
    room = Math.min(room, group.unitCap - used);
  }
  return Math.max(0, Number(room.toFixed(2)));
}

/** The quantity a one-tap log uses: the last one logged for the action, else its default. */
export function lastUsedQty(state: Pick<GameState, 'logs'>, action: ActionDef): number {
  for (let index = state.logs.length - 1; index >= 0; index -= 1) {
    const log = state.logs[index];
    if (log?.actionId === action.id && log.source !== 'legacy') return log.qty;
  }
  return action.defaultQty;
}

function lastLogOf(state: Pick<GameState, 'logs'>, actionId: string): LogEntry | undefined {
  for (let index = state.logs.length - 1; index >= 0; index -= 1) {
    if (state.logs[index]?.actionId === actionId) return state.logs[index];
  }
  return undefined;
}

/** Why an action cannot be logged at all right now, or `null` when it can. */
export function actionBlock(
  state: Pick<GameState, 'logs'>,
  action: ActionDef,
  day: DayKey,
): LogRefusal | null {
  const today = logsOn(state.logs, day);
  if (action.group === PLATE_GROUP) {
    const dayTile = today.find((log) => DAY_TILES.has(log.actionId));
    if (dayTile) {
      return refuse('covered-by-day', `Covered by your ${dayTile.title.toLowerCase()}.`);
    }
    const hasMeals = today.some(
      (log) =>
        !DAY_TILES.has(log.actionId) && ACTION_BY_ID.get(log.actionId)?.group === PLATE_GROUP,
    );
    if (DAY_TILES.has(action.id) && hasMeals) {
      return refuse(
        'meals-logged',
        "You've logged meals today — a day tile would count them twice.",
      );
    }
  }
  if (action.group === FLIGHT_GROUP) {
    const from = addDays(day, -29);
    const members = GROUP_BY_ID.get(FLIGHT_GROUP)?.actions ?? [];
    const recent = state.logs.filter((log) => log.day >= from && members.includes(log.actionId));
    if (recent.length >= FLIGHT_SWAPS_PER_30_DAYS) {
      return refuse(
        'cooldown',
        'Four flight swaps in 30 days is the limit. More can wait a little.',
      );
    }
  }
  if (action.id === 'keep-phone-one-more-year') {
    const last = lastLogOf(state, action.id);
    if (last && last.day > addDays(day, -KEEP_PHONE_COOLDOWN_DAYS)) {
      return refuse(
        'cooldown',
        'Already counted for this year. It comes round again in twelve months.',
      );
    }
  }
  return null;
}

export interface LogPreview {
  ok: boolean;
  refusal: LogRefusal | null;
  qty: number;
  /** `null` when the action is not quantified or context only. */
  kg: KgEstimate | null;
  rewardedActs: number;
  xp: number;
  gp: number;
  /** No rewarded acts left for the action or its group: kilograms only. */
  maxed: boolean;
  remainingUnits: number;
}

/** What saving this log would do, for the sheet's honest preview. Changes nothing. */
export function previewAction(state: LogState, input: LogActionInput, day: DayKey): LogPreview {
  const action = ACTION_BY_ID.get(input.actionId);
  const empty: LogPreview = {
    ok: false,
    refusal: refuse('unknown-action', "That action isn't in the catalogue any more."),
    qty: 0,
    kg: null,
    rewardedActs: 0,
    xp: 0,
    gp: 0,
    maxed: false,
    remainingUnits: 0,
  };
  if (!action) return empty;
  const qty = input.qty ?? lastUsedQty(state, action);
  const refusal = validateAction(state, action, qty, day);
  const scored = previewLog(logsOn(state.logs, day), { actionId: action.id, qty });
  return {
    ok: refusal === null,
    refusal,
    qty,
    kg: estimateKg(action, qty, state.profile, input.inputs),
    rewardedActs: scored.rewardedActs,
    xp: scored.xp,
    gp: scored.gp,
    maxed: scored.rewardedActs === 0,
    remainingUnits: remainingUnits(state, action, day),
  };
}

function validateAction(
  state: Pick<GameState, 'logs'>,
  action: ActionDef,
  qty: number,
  day: DayKey,
): LogRefusal | null {
  if (!Number.isFinite(qty) || qty <= 0) {
    return refuse('invalid-quantity', 'Enter an amount above zero.');
  }
  if (hasDecimals(qty, action.decimals)) {
    return refuse(
      'too-precise',
      action.decimals === 0
        ? 'Whole numbers only for this one.'
        : 'That is more precise than we can use.',
    );
  }
  const blocked = actionBlock(state, action, day);
  if (blocked) return blocked;
  if (qty > remainingUnits(state, action, day) + 1e-9) return refuse('over-cap', OVER_CAP);
  return null;
}

function isDoubleTap(
  ctx: Ctx,
  candidate: Pick<LogEntry, 'actionId' | 'qty' | 'variant' | 'title'>,
): boolean {
  const last = ctx.s.logs[ctx.s.logs.length - 1];
  return (
    last !== undefined &&
    Math.abs(ctx.now - last.ts) < DOUBLE_TAP_MS &&
    last.actionId === candidate.actionId &&
    last.qty === candidate.qty &&
    last.variant === candidate.variant &&
    last.title === candidate.title
  );
}

function newLogId(ctx: Ctx): string {
  const base = `l${ctx.now.toString(36)}`;
  let suffix = ctx.s.logs.length;
  let id = `${base}${suffix.toString(36)}`;
  while (ctx.s.logs.some((log) => log.id === id)) {
    suffix += 1;
    id = `${base}${suffix.toString(36)}`;
  }
  return id;
}

/** Inserts keeping `logs` sorted by timestamp; a log is normally the newest. */
function insertLog(logs: readonly LogEntry[], log: LogEntry): LogEntry[] {
  let index = logs.length;
  while (index > 0 && (logs[index - 1] as LogEntry).ts > log.ts) index -= 1;
  return [...logs.slice(0, index), log, ...logs.slice(index)];
}

/**
 * Re-scores one day from its logs and applies the difference: per-log rewards, XP,
 * growth points and the ring. Called after every add, undo and delete on today.
 */
export function rescoreDay(ctx: Ctx, day: DayKey): void {
  const s = ctx.s;
  const dayLogs = logsOn(s.logs, day);
  const score = scoreDay(dayLogs);
  let xpDelta = 0;
  let gpDelta = 0;
  const updated = new Map<string, ScoredLog>();
  dayLogs.forEach((log, index) => {
    const next = score.logs[index];
    if (!next) return;
    xpDelta += next.xp - log.xp;
    gpDelta += next.gp - log.gp;
    if (next.xp !== log.xp || next.gp !== log.gp || next.rewardedActs !== log.rewardedActs) {
      updated.set(log.id, next);
    }
  });
  if (updated.size > 0) {
    s.logs = s.logs.map((log) => {
      const next = updated.get(log.id);
      return next ? { ...log, ...next } : log;
    });
  }
  grantXp(ctx, xpDelta, 'log');
  grantGp(ctx, gpDelta);
  if (day === ctx.today) syncRing(ctx, score.ringClosed);
}

/** Stores a finished log entry: check-in, insert, re-score, event. Shared with the legacy import. */
export function saveLog(
  ctx: Ctx,
  draft: Omit<LogEntry, 'id' | 'rewardedActs' | 'xp' | 'gp'>,
): LogEntry {
  const firstActToday = checkIn(ctx, 'log');
  const id = newLogId(ctx);
  ctx.s.logs = insertLog(ctx.s.logs, { ...draft, id, rewardedActs: 0, xp: 0, gp: 0 });
  rescoreDay(ctx, ctx.today);
  const saved = ctx.s.logs.find((log) => log.id === id) as LogEntry;
  ctx.events.push({
    type: 'action-logged',
    log: saved,
    rewarded: saved.rewardedActs > 0,
    strength: growPulseStrength(saved.gp),
    firstActToday,
  });
  return saved;
}

/** Saves a catalogue action. The first log of a day also performs the check-in. */
export function logAction(ctx: Ctx, input: LogActionInput): LogResult {
  const s = ctx.s;
  if (!isOnboarded(s)) return refuse('not-onboarded', 'Plant your tree first.');
  const action = ACTION_BY_ID.get(input.actionId);
  if (!action) return refuse('unknown-action', "That action isn't in the catalogue any more.");
  const qty = input.qty ?? lastUsedQty(s, action);
  const refusal = validateAction(s, action, qty, ctx.today);
  if (refusal) return refusal;

  const variant = encodeVariant(action, input.inputs);
  if (isDoubleTap(ctx, { actionId: action.id, qty, variant, title: action.title })) {
    return refuse('duplicate', 'Already logged a moment ago.');
  }
  const estimate = estimateKg(action, qty, s.profile, input.inputs);
  const log = saveLog(ctx, {
    ts: ctx.now,
    day: ctx.today,
    tzOffsetMin: new Date(ctx.now).getTimezoneOffset(),
    actionId: action.id,
    variant,
    title: action.title,
    emoji: action.emoji,
    category: action.category,
    qty,
    unit: action.unit,
    co2eKg: estimate ? estimate.kg : null,
    kgLow: estimate ? estimate.low : null,
    kgHigh: estimate ? estimate.high : null,
    estimate: estimate ? 'factor' : 'none',
    factorsVersion: EVIDENCE_META.factorsVersion,
    kind: classifyLog(action.id, estimate !== null, s.baseline.current),
    cadence: action.cadence,
    source: input.source ?? 'log',
    effort: null,
  });
  return { ok: true, log };
}

function clampAiKg(ctx: Ctx, kg: number | null | undefined): number | null {
  if (kg === null || kg === undefined || !Number.isFinite(kg) || kg <= 0) return null;
  let usedToday = 0;
  for (const log of logsOn(ctx.s.logs, ctx.today)) {
    if (log.estimate === 'ai') usedToday += log.co2eKg ?? 0;
  }
  const room = Math.max(0, CUSTOM_AI_KG_PER_DAY_MAX - usedToday);
  const clamped = Math.min(kg, CUSTOM_AI_KG_PER_LOG_MAX, room);
  return clamped > 0 ? clamped : null;
}

function cleanTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_TITLE_MAX);
}

/**
 * Saves a custom action. Its XP comes from the effort tier, two are rewarded per day,
 * and an AI estimate is clamped and always kept out of the headline total.
 */
export function logCustom(
  ctx: Ctx,
  input: LogCustomInput,
  source: LogSource = 'custom',
): LogResult {
  const s = ctx.s;
  if (!isOnboarded(s)) return refuse('not-onboarded', 'Plant your tree first.');
  const title = cleanTitle(input.title);
  if (title.length < CUSTOM_TITLE_MIN) {
    return refuse('invalid-custom', 'Describe it in at least three characters.');
  }
  if (!CATEGORY_IDS.includes(input.category) || ![1, 2, 3, 4].includes(input.effort)) {
    return refuse('invalid-custom', 'Pick a category and an effort level.');
  }
  const qty = input.qty ?? 1;
  if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) {
    return refuse('invalid-quantity', 'Enter an amount above zero.');
  }
  if (isDoubleTap(ctx, { actionId: CUSTOM_ACTION_ID, qty, variant: null, title })) {
    return refuse('duplicate', 'Already logged a moment ago.');
  }
  const kg = clampAiKg(ctx, input.co2eKg);
  const emoji = (input.emoji ?? '').trim().slice(0, 8) || '✨';
  const unit = (input.unit ?? '').trim().slice(0, 16) || 'time';

  if (input.save)
    saveCustomAction(ctx, {
      title,
      emoji,
      category: input.category,
      effort: input.effort,
      co2eKg: kg,
      qty,
      unit,
    });

  const log = saveLog(ctx, {
    ts: ctx.now,
    day: ctx.today,
    tzOffsetMin: new Date(ctx.now).getTimezoneOffset(),
    actionId: CUSTOM_ACTION_ID,
    variant: null,
    title,
    emoji,
    category: input.category,
    qty,
    unit,
    co2eKg: kg,
    kgLow: kg === null ? null : 0,
    kgHigh: kg,
    estimate: kg === null ? 'none' : 'ai',
    factorsVersion: EVIDENCE_META.factorsVersion,
    kind: 'unrated',
    cadence: 'occasional',
    source,
    effort: input.effort,
  });
  return { ok: true, log };
}

function saveCustomAction(ctx: Ctx, entry: Omit<SavedCustomAction, 'id' | 'estimate'>): void {
  const s = ctx.s;
  const existing = s.customActions.find(
    (item) => item.title.toLowerCase() === entry.title.toLowerCase(),
  );
  const saved: SavedCustomAction = {
    ...entry,
    id: existing?.id ?? `c${ctx.now.toString(36)}${s.customActions.length.toString(36)}`,
    estimate: entry.co2eKg === null ? 'none' : 'ai',
  };
  const others = s.customActions.filter((item) => item.id !== saved.id);
  s.customActions = [saved, ...others].slice(0, SAVED_CUSTOM_ACTIONS_MAX);
}

/** Logs one of "My actions" again with the estimate it was saved with. */
export function logSavedCustom(ctx: Ctx, savedId: string): LogResult {
  const saved = ctx.s.customActions.find((item) => item.id === savedId);
  if (!saved) return refuse('unknown-action', "That action isn't in My actions any more.");
  return logCustom(ctx, {
    title: saved.title,
    emoji: saved.emoji,
    category: saved.category,
    effort: saved.effort,
    qty: saved.qty,
    unit: saved.unit,
    co2eKg: saved.co2eKg,
  });
}

export function removeSavedCustom(ctx: Ctx, savedId: string): boolean {
  const next = ctx.s.customActions.filter((item) => item.id !== savedId);
  if (next.length === ctx.s.customActions.length) return false;
  ctx.s.customActions = next;
  return true;
}

export function canUndo(log: Pick<LogEntry, 'ts'>, now: number): boolean {
  return now - log.ts <= UNDO_WINDOW_MS && now >= log.ts;
}

export type RemoveResult =
  { ok: true; log: LogEntry; live: boolean } | { ok: false; reason: 'not-found' | 'expired' };

/**
 * Peels a log off again. A log of today is removed and the day is re-scored; a log of a
 * settled day subtracts exactly its stored XP and growth points and nothing else.
 */
export function removeLog(ctx: Ctx, logId: string): RemoveResult {
  const s = ctx.s;
  const log = s.logs.find((entry) => entry.id === logId);
  if (!log) return { ok: false, reason: 'not-found' };
  s.logs = s.logs.filter((entry) => entry.id !== logId);
  const live = log.day === ctx.today;
  if (live) {
    // The removed log's own rewards leave with it; the rest of the day is re-scored.
    grantXp(ctx, -log.xp, 'log');
    grantGp(ctx, -log.gp);
    rescoreDay(ctx, ctx.today);
  } else {
    grantXp(ctx, -log.xp, 'log');
    grantGp(ctx, -log.gp);
  }
  ctx.events.push({ type: 'action-undone', log, live });
  return { ok: true, log, live };
}

/** The undo behind the 8-second toast: refuses once the window has passed. */
export function undoLog(ctx: Ctx, logId: string): RemoveResult {
  const log = ctx.s.logs.find((entry) => entry.id === logId);
  if (!log) return { ok: false, reason: 'not-found' };
  if (!canUndo(log, ctx.now)) return { ok: false, reason: 'expired' };
  return removeLog(ctx, logId);
}

export interface ActionAvailability {
  /** Rewarded acts still available today for this action. */
  actsLeft: number;
  unitsLeft: number;
  /** No rewarded acts left: a log adds kilograms only. */
  maxed: boolean;
  /** Not loggable at all right now (hard cap reached, covered, cooling down). */
  blocked: LogRefusal | null;
}

/** Caps remaining today for an action: what the tile and the quick-log row show. */
export function actionAvailability(
  state: Pick<GameState, 'logs'>,
  action: ActionDef,
  day: DayKey,
): ActionAvailability {
  const score = scoreDay(logsOn(state.logs, day));
  const actsLeft = roomFor(action, score.usedByAction, score.usedByGroup, score.rewardedActs);
  const unitsLeft = remainingUnits(state, action, day);
  const blocked =
    actionBlock(state, action, day) ??
    (unitsLeft <= 0 ? refuse('over-cap', 'Maxed for today ✓') : null);
  return { actsLeft, unitsLeft, maxed: actsLeft === 0, blocked };
}

/** Rewarded custom logs still available today. */
export function customActsLeft(state: Pick<GameState, 'logs'>, day: DayKey): number {
  const score = scoreDay(logsOn(state.logs, day));
  const rule = scoringRuleFor({ actionId: CUSTOM_ACTION_ID, qty: 1 });
  return roomFor(rule, score.usedByAction, score.usedByGroup, score.rewardedActs);
}

export { CUSTOM_ACTION_ID, CUSTOM_GROUP_ID, actsOf };
