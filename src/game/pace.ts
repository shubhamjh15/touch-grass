/**
 * Pace against the starting line (product spec section 6.6): what the logged actions
 * would add up to over a year, as a share of the baseline. A projection, never a
 * measurement. Recurring actions are annualised; one-offs are added once and never scaled.
 */
import { addDays, diffDays, type DayKey } from '@/lib/dates';
import { formatCo2Estimate, formatNumber, formatTonnes } from '@/lib/format';
import { PACE_MIN_ACTIVE_DAYS, PACE_MIN_SPAN_DAYS, PACE_WINDOW_DAYS } from './economy';
import type { BaselineResult, DayRecord, LogEntry } from './types';

export interface PaceInput {
  baseline: BaselineResult | null;
  logs: readonly LogEntry[];
  days: Readonly<Record<DayKey, DayRecord>>;
}

export type PaceResult =
  | { status: 'no-baseline' }
  | { status: 'not-enough-data'; activeDays: number; neededActiveDays: number; spanDays: number }
  | {
      status: 'ok';
      paceKg: number;
      /** Fraction of the baseline, e.g. 0.06 for 6%. */
      pacePct: number;
      windowDays: number;
      recurringKg: number;
      occasionalKg: number;
      baselineTonnes: number;
    };

const countsAsNewCut = (log: LogEntry): boolean =>
  log.kind === 'swap' && log.estimate === 'factor' && log.co2eKg !== null;

function activeDaysBetween(
  days: Readonly<Record<DayKey, DayRecord>>,
  from: DayKey,
  to: DayKey,
): number {
  let count = 0;
  for (const key of Object.keys(days)) if (key >= from && key <= to) count += 1;
  return count;
}

export function computePace(input: PaceInput, today: DayKey): PaceResult {
  if (!input.baseline) return { status: 'no-baseline' };
  const first = input.logs[0]?.day;
  const spanDays = first ? diffDays(first, today) + 1 : 0;
  const windowDays = Math.max(1, Math.min(PACE_WINDOW_DAYS, spanDays));
  const windowStart = addDays(today, -(windowDays - 1));
  const activeDays = activeDaysBetween(input.days, windowStart, today);
  if (spanDays < PACE_MIN_SPAN_DAYS || activeDays < PACE_MIN_ACTIVE_DAYS) {
    return {
      status: 'not-enough-data',
      activeDays,
      neededActiveDays: PACE_MIN_ACTIVE_DAYS,
      spanDays,
    };
  }
  const yearStart = addDays(today, -364);
  let recurringKg = 0;
  let occasionalKg = 0;
  for (const log of input.logs) {
    if (!countsAsNewCut(log) || log.day > today) continue;
    if (log.cadence === 'recurring') {
      if (log.day >= windowStart) recurringKg += log.co2eKg ?? 0;
    } else if (log.day >= yearStart) {
      occasionalKg += log.co2eKg ?? 0;
    }
  }
  const paceKg = (recurringKg * 365) / windowDays + occasionalKg;
  const baselineKg = input.baseline.tonnes.total * 1000;
  return {
    status: 'ok',
    paceKg,
    pacePct: baselineKg > 0 ? paceKg / baselineKg : 0,
    windowDays,
    recurringKg,
    occasionalKg,
    baselineTonnes: input.baseline.tonnes.total,
  };
}

/** "6%", "under 1%", or `null` above 50% where the card shows no number. */
export function pacePercentLabel(pacePct: number): string | null {
  if (pacePct > 0.5) return null;
  if (pacePct < 0.01) return 'under 1%';
  return `${Math.round(pacePct * 100)}%`;
}

/** The headline sentence of the pace card, in the spec's own wording. */
export function paceHeadline(result: PaceResult): string {
  switch (result.status) {
    case 'no-baseline':
      return 'See your pace: take the starting-line quiz (about a minute).';
    case 'not-enough-data':
      return `Two weeks of logs and this card wakes up. ${formatNumber(Math.min(result.activeDays, result.neededActiveDays))} of ${formatNumber(result.neededActiveDays)} active days so far.`;
    case 'ok': {
      const percent = pacePercentLabel(result.pacePct);
      const weeks = Math.max(1, Math.round(result.windowDays / 7));
      const span = weeks === 1 ? "last week's" : `last ${formatNumber(weeks)} weeks'`;
      const start = `≈ ${formatTonnes(result.baselineTonnes)}`;
      if (percent === null) {
        return `At your ${span} pace, the actions you log would avoid more than half of your starting line (${start}) — worth a second look at your logs.`;
      }
      return `At your ${span} pace, the actions you log would avoid ≈ ${formatCo2Estimate(result.paceKg)} CO2e a year — about ${percent} of your starting line (${start}).`;
    }
  }
}

export const PACE_INFO =
  "This is a projection, not a measurement. It counts only actions you logged that go beyond the habits you told us about, each compared with a typical alternative nobody observed. The quiz and the action log use different methods, so this is an indication — it is not your new footprint. If you log less it falls: that's information, not a verdict.";

export interface HabitsHeld {
  acts: number;
  kg: number;
  windowDays: number;
}

/** Logs tagged `keep` in the pace window: habits already inside the starting line. */
export function habitsHeld(logs: readonly LogEntry[], today: DayKey): HabitsHeld {
  const from = addDays(today, -(PACE_WINDOW_DAYS - 1));
  let acts = 0;
  let kg = 0;
  for (const log of logs) {
    if (log.kind !== 'keep' || log.day < from || log.day > today) continue;
    acts += Math.max(1, log.rewardedActs);
    if (log.estimate === 'factor') kg += log.co2eKg ?? 0;
  }
  return { acts, kg, windowDays: PACE_WINDOW_DAYS };
}

export function habitsHeldCopy(held: HabitsHeld): string {
  return `Habits you're holding: ${formatNumber(held.acts)} ${held.acts === 1 ? 'act' : 'acts'} this month, ≈ ${formatCo2Estimate(held.kg)} vs. the typical alternative. They're already in your starting line, so they don't count as new cuts — they're why your starting line is low.`;
}
