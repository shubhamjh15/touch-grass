/**
 * The Touch Grass break (product spec section 10): a timer that pays you to leave the
 * screen. Wall-clock timestamps, so locking the phone never pauses it. Anti-cheat is
 * deliberately light and needs no permissions: time counts as "away" while the page is
 * hidden, or visible without any input for a minute.
 */
import { checkIn } from './calendar';
import { grantGp, grantXp, writeActivity, type Ctx } from './ctx';
import {
  BREAK_AWAY_SHARE,
  BREAK_DURATIONS_MIN,
  BREAK_IDLE_MS,
  BREAK_LONG_MIN,
  BREAK_MIN_GAP_MIN,
  BREAK_MIN_KEPT_MIN,
  GP_SUNLIGHT,
  XP_BREAK_LONG,
  XP_BREAK_SHORT,
} from './economy';
import { breaksOn } from './indexes';
import { isOnboarded } from './state';
import type { ActiveBreak, BreakEntry, GameState } from './types';

const MINUTE = 60_000;

export type BreakSignal = 'hidden' | 'visible' | 'input';
export type BreakOutcome = 'outside' | 'rested' | 'none';

/** Folds one presence signal into a running break. Pure. */
export function trackBreak(active: ActiveBreak, signal: BreakSignal, now: number): ActiveBreak {
  const at = Math.max(now, active.startTs);
  if (active.hiddenSinceTs !== null) {
    if (signal === 'hidden') return active;
    // Hidden time counts in full, however short.
    return {
      ...active,
      awayMs: active.awayMs + Math.max(0, at - active.hiddenSinceTs),
      hiddenSinceTs: null,
      lastVisibleTs: at,
    };
  }
  const since = active.lastVisibleTs ?? active.startTs;
  const idle = Math.max(0, at - since);
  // Visible but untouched for a minute or more: the user was not at the screen.
  const awayMs = active.awayMs + (idle >= BREAK_IDLE_MS ? idle : 0);
  if (signal === 'hidden') return { ...active, awayMs, hiddenSinceTs: at, lastVisibleTs: null };
  return { ...active, awayMs, lastVisibleTs: at };
}

/** Time away so far, including the stretch that is still running. */
export function awayMsAt(active: ActiveBreak, now: number): number {
  const settled = trackBreak(active, 'visible', now);
  return Math.min(settled.awayMs, Math.max(0, now - active.startTs));
}

export interface BreakVerdict {
  elapsedMin: number;
  awayMs: number;
  /** Minutes that count: the planned duration, or 10 when a longer break ended early. */
  keptMin: number;
  kept: boolean;
  /** The planned time is up. */
  complete: boolean;
  why: 'kept' | 'too-short' | 'not-away';
}

/** Whether a break counts if it ended at `now`. */
export function judgeBreak(active: ActiveBreak, now: number): BreakVerdict {
  const elapsedMs = Math.max(0, now - active.startTs);
  const elapsedMin = elapsedMs / MINUTE;
  const awayMs = awayMsAt(active, now);
  const complete = elapsedMin >= active.plannedMin;
  const countedMin = complete
    ? active.plannedMin
    : elapsedMin >= BREAK_MIN_KEPT_MIN
      ? BREAK_MIN_KEPT_MIN
      : 0;
  if (countedMin === 0) {
    return { elapsedMin, awayMs, keptMin: 0, kept: false, complete, why: 'too-short' };
  }
  const kept = awayMs >= BREAK_AWAY_SHARE * countedMin * MINUTE;
  return {
    elapsedMin,
    awayMs,
    keptMin: kept ? countedMin : 0,
    kept,
    complete,
    why: kept ? 'kept' : 'not-away',
  };
}

export function breakXp(keptMin: number): number {
  if (keptMin >= BREAK_LONG_MIN) return XP_BREAK_LONG;
  return keptMin >= BREAK_MIN_KEPT_MIN ? XP_BREAK_SHORT : 0;
}

/** Minutes until another break may start; 0 when one can start now. */
export function breakCooldownMin(state: Pick<GameState, 'breaks'>, now: number): number {
  // Only a kept break starts the wait: an attempt that did not count may be retried at once.
  let last: BreakEntry | undefined;
  for (let index = state.breaks.length - 1; index >= 0 && !last; index -= 1) {
    if (state.breaks[index]?.kept) last = state.breaks[index];
  }
  if (!last) return 0;
  const sinceMin = (now - last.endTs) / MINUTE;
  return sinceMin >= BREAK_MIN_GAP_MIN ? 0 : Math.ceil(BREAK_MIN_GAP_MIN - sinceMin);
}

/** The duration preselected on the start screen: 10 the first time, then the last one used. */
export function suggestedBreakMin(state: Pick<GameState, 'breaks'>): number {
  const last = state.breaks[state.breaks.length - 1]?.plannedMin;
  return last !== undefined && (BREAK_DURATIONS_MIN as readonly number[]).includes(last)
    ? last
    : BREAK_DURATIONS_MIN[0];
}

export type BreakStartResult =
  | { ok: true; endsAt: number }
  | {
      ok: false;
      reason: 'not-onboarded' | 'already-running' | 'invalid-duration' | 'cooldown';
      waitMin?: number;
    };

export function startBreak(ctx: Ctx, plannedMin: number): BreakStartResult {
  const s = ctx.s;
  if (!isOnboarded(s)) return { ok: false, reason: 'not-onboarded' };
  if (s.activeBreak) return { ok: false, reason: 'already-running' };
  if (!Number.isFinite(plannedMin) || plannedMin < BREAK_MIN_KEPT_MIN || plannedMin > 180) {
    return { ok: false, reason: 'invalid-duration' };
  }
  const waitMin = breakCooldownMin(s, ctx.now);
  if (waitMin > 0) return { ok: false, reason: 'cooldown', waitMin };
  const minutes = Math.round(plannedMin);
  s.activeBreak = {
    startTs: ctx.now,
    plannedMin: minutes,
    awayMs: 0,
    lastVisibleTs: ctx.now,
    hiddenSinceTs: null,
  };
  const endsAt = ctx.now + minutes * MINUTE;
  ctx.events.push({ type: 'break-started', plannedMin: minutes, endsAt });
  return { ok: true, endsAt };
}

/** Records that the page was hidden, shown again, or touched during a break. */
export function signalBreak(ctx: Ctx, signal: BreakSignal): void {
  if (ctx.s.activeBreak) ctx.s.activeBreak = trackBreak(ctx.s.activeBreak, signal, ctx.now);
}

export type BreakFinishResult =
  | { ok: true; entry: BreakEntry | null; verdict: BreakVerdict; rewarded: boolean }
  | { ok: false; reason: 'no-break' };

/**
 * Ends the running break. "Went outside" and "rested off-screen" are rewarded equally;
 * "didn't really take a break" records nothing. The first kept break of a day pays XP and
 * sunlight, and is the check-in when it is the day's first act.
 */
export function finishBreak(ctx: Ctx, outcome: BreakOutcome): BreakFinishResult {
  const s = ctx.s;
  const active = s.activeBreak;
  if (!active) return { ok: false, reason: 'no-break' };
  const verdict = judgeBreak(active, ctx.now);
  s.activeBreak = null;

  if (outcome === 'none') {
    ctx.events.push({ type: 'break-cancelled' });
    return { ok: true, entry: null, verdict, rewarded: false };
  }

  const kept = verdict.kept;
  let xp = 0;
  let gp = 0;
  let rewarded = false;
  if (kept) {
    checkIn(ctx, 'break');
    const record = s.days[ctx.today];
    if (record && !record.breakRewarded) {
      xp = breakXp(verdict.keptMin);
      gp = GP_SUNLIGHT;
      rewarded = true;
      s.days = { ...s.days, [ctx.today]: { ...record, breakRewarded: true } };
      grantXp(ctx, xp, 'break');
      grantGp(ctx, gp);
    }
  }
  const entry: BreakEntry = {
    id: `b${ctx.now.toString(36)}${s.breaks.length.toString(36)}`,
    startTs: active.startTs,
    endTs: ctx.now,
    day: ctx.today,
    plannedMin: active.plannedMin,
    keptMin: verdict.keptMin,
    awayMs: Math.round(verdict.awayMs),
    kept,
    outcome,
    xp,
    gp,
  };
  s.breaks = [...s.breaks, entry];
  if (kept && breaksOn(s.breaks, ctx.today).filter((item) => item.kept).length === 1) {
    writeActivity(ctx, 'break', `A ${verdict.keptMin}-minute break outside the screen.`);
  }
  ctx.events.push({
    type: 'break-finished',
    kept,
    keptMin: verdict.keptMin,
    outcome,
    rewarded,
    xp,
    gp,
  });
  return { ok: true, entry, verdict, rewarded };
}

export interface BreakStats {
  /** Kept minutes, lifetime. */
  minutesTotal: number;
  minutesThisWeek: number;
  breaksKept: number;
}

export function breakStats(
  state: Pick<GameState, 'breaks'>,
  weekDays: readonly string[],
): BreakStats {
  let minutesTotal = 0;
  let minutesThisWeek = 0;
  let breaksKept = 0;
  for (const entry of state.breaks) {
    if (!entry.kept) continue;
    breaksKept += 1;
    minutesTotal += entry.keptMin;
    if (weekDays.includes(entry.day)) minutesThisWeek += entry.keptMin;
  }
  return { minutesTotal, minutesThisWeek, breaksKept };
}
