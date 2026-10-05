/**
 * The weekly recap (product spec section 2.9), computed from stored events only. It is
 * shown once on the first open of a new week and kept under Impact → Weeks.
 */
import { CATEGORY_IDS, type CategoryId } from '@/data/catalogue';
import { addDays, startOfWeek, weekKey, type DayKey } from '@/lib/dates';
import { activeDaysIn, weekStrip, type WeekStripDay } from './calendar';
import { GP_CHECK_IN, GP_RING_CLOSED } from './economy';
import { growthInfo } from './growth';
import { breaksOn, logsOn } from './indexes';
import { daysOfWeek } from './quests';
import { isOnboarded } from './state';
import type { GameState, WeekKey } from './types';

type RecapState = Pick<
  GameState,
  'logs' | 'days' | 'marks' | 'breaks' | 'quests' | 'profile' | 'tree' | 'streak' | 'rain'
>;

export interface WeekRecap {
  week: WeekKey;
  monday: DayKey;
  sunday: DayKey;
  strip: WeekStripDay[];
  /** Active days, out of seven. */
  rings: number;
  fullRings: number;
  logs: number;
  acts: number;
  /** Estimated kg CO2e avoided from sourced factors. */
  kg: number;
  /** The same for the week before; `null` when that week predates the tree. */
  previousKg: number | null;
  aiKg: number;
  topCategory: CategoryId | null;
  questsClaimed: number;
  minutesOutside: number;
  gpGained: number;
  /** Stage and progress at the start and the end of the week. */
  stageBefore: string;
  stageAfter: string;
  stageProgressBefore: number;
  stageProgressAfter: number;
  /** Nothing happened: the card shows only the "quiet week" line. */
  empty: boolean;
}

/** Growth points earned on one day, rebuilt from what the day stored. */
export function gpEarnedOn(
  state: Pick<GameState, 'logs' | 'days' | 'breaks'>,
  day: DayKey,
): number {
  const record = state.days[day];
  let gp = record ? GP_CHECK_IN + (record.ringClosed ? GP_RING_CLOSED : 0) : 0;
  for (const log of logsOn(state.logs, day)) gp += log.gp;
  for (const entry of breaksOn(state.breaks, day)) gp += entry.gp;
  return gp;
}

function gpEarnedFrom(state: RecapState, from: DayKey): number {
  let gp = 0;
  const days = new Set<DayKey>(Object.keys(state.days).filter((day) => day >= from));
  for (const log of state.logs) if (log.day >= from) days.add(log.day);
  for (const entry of state.breaks) if (entry.day >= from) days.add(entry.day);
  for (const day of days) gp += gpEarnedOn(state, day);
  return gp;
}

function weekKg(state: RecapState, days: readonly DayKey[]): { kg: number; aiKg: number } {
  let kg = 0;
  let aiKg = 0;
  for (const day of days) {
    for (const log of logsOn(state.logs, day)) {
      if (log.estimate === 'factor') kg += log.co2eKg ?? 0;
      else if (log.estimate === 'ai') aiKg += log.co2eKg ?? 0;
    }
  }
  return { kg, aiKg };
}

export function weekRecap(state: RecapState, week: WeekKey, today: DayKey): WeekRecap {
  const days = daysOfWeek(week);
  const monday = days[0] as DayKey;
  const sunday = days[6] as DayKey;
  const strip = weekStrip(state, monday, today);
  const actsByCategory = new Map<CategoryId, number>();
  let logs = 0;
  let acts = 0;
  let minutesOutside = 0;
  for (const day of days) {
    for (const log of logsOn(state.logs, day)) {
      logs += 1;
      acts += log.rewardedActs;
      if (log.rewardedActs > 0) {
        actsByCategory.set(
          log.category,
          (actsByCategory.get(log.category) ?? 0) + log.rewardedActs,
        );
      }
    }
    for (const entry of breaksOn(state.breaks, day))
      if (entry.kept) minutesOutside += entry.keptMin;
  }
  let topCategory: CategoryId | null = null;
  for (const category of CATEGORY_IDS) {
    const count = actsByCategory.get(category) ?? 0;
    if (count > 0 && count > (topCategory ? (actsByCategory.get(topCategory) ?? 0) : 0)) {
      topCategory = category;
    }
  }
  const { kg, aiKg } = weekKg(state, days);
  const previousMonday = addDays(monday, -7);
  const previousKg =
    addDays(previousMonday, 6) >= state.profile.plantedDay
      ? weekKg(state, daysOfWeek(`W${previousMonday}`)).kg
      : null;
  const questsClaimed = state.quests.claims.filter(
    (claim) =>
      (claim.kind === 'weekly' && claim.period === week) ||
      (claim.kind === 'daily' && claim.period >= monday && claim.period <= sunday),
  ).length;

  const gpAtEnd = Math.max(0, state.tree.gp - gpEarnedFrom(state, addDays(sunday, 1)));
  const gpAtStart = Math.max(0, state.tree.gp - gpEarnedFrom(state, monday));
  const before = growthInfo(gpAtStart);
  const after = growthInfo(gpAtEnd);
  const rings = activeDaysIn(strip);
  return {
    week,
    monday,
    sunday,
    strip,
    rings,
    fullRings: strip.filter((entry) => entry.mark === 'full').length,
    logs,
    acts,
    kg,
    previousKg,
    aiKg,
    topCategory,
    questsClaimed,
    minutesOutside,
    gpGained: gpAtEnd - gpAtStart,
    stageBefore: before.stage,
    stageAfter: after.stage,
    stageProgressBefore: before.stageProgress,
    stageProgressAfter: after.stageProgress,
    empty: rings === 0 && logs === 0 && minutesOutside === 0,
  };
}

/**
 * The week whose recap should be offered now: last week, once, on the first open of a
 * new week. Never a week that ended before the tree was planted.
 */
export function recapToShow(
  state: Pick<GameState, 'seen' | 'profile' | 'onboarding'>,
  today: DayKey,
): WeekKey | null {
  if (!isOnboarded(state)) return null;
  const lastMonday = addDays(startOfWeek(today), -7);
  const lastSunday = addDays(lastMonday, 6);
  if (lastSunday < state.profile.plantedDay) return null;
  const week = weekKey(lastMonday);
  return state.seen.recapWeek !== null && state.seen.recapWeek >= week ? null : week;
}

/** Every finished week since planting, newest first, for Impact → Weeks. */
export function recapWeeks(state: Pick<GameState, 'profile'>, today: DayKey): WeekKey[] {
  const weeks: WeekKey[] = [];
  let monday = addDays(startOfWeek(today), -7);
  for (let guard = 0; guard < 520 && addDays(monday, 6) >= state.profile.plantedDay; guard += 1) {
    weeks.push(weekKey(monday));
    monday = addDays(monday, -7);
  }
  return weeks;
}

export function quietWeekCopy(treeName: string): string {
  return `Quiet week. ${treeName} waited. Here are three easy ways back in.`;
}
