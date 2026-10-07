/**
 * Days, streaks, rain and rest (product spec sections 2.6 to 2.8). A day is the local
 * calendar day. Missing one costs nothing permanent: rain or a planned rest day covers
 * it, otherwise the streak rests and the tree gets thirsty. All day arithmetic goes
 * through `@/lib/dates`, so daylight-saving changes cannot shift a day.
 */
import {
  addDays,
  dayKey,
  dayRange,
  diffDays,
  parseDayKey,
  startOfWeek,
  weekKey,
  type DayKey,
} from '@/lib/dates';
import { grantGp, grantXp, queueNotice, writeActivity, type Ctx } from './ctx';
import {
  BACKWARD_TOLERANCE_DAYS,
  DORMANT_AFTER_MISSED,
  FUTURE_GUARD_MS,
  GP_CHECK_IN,
  GP_RING_CLOSED,
  LEARN_OPENS_KEEP_DAYS,
  RAIN_CAP,
  RAIN_FULL_RINGS_PER_CLOUD,
  RAIN_STREAK_GIFTS,
  RAIN_WEEKLY_REFILL_TO,
  REST_DAYS_MAX,
  STREAK_MILESTONES,
  STREAK_REST_MESSAGE_MIN,
  SUSPECT_JUMP_DAYS,
  XP_CEREMONY,
  XP_CHECK_IN,
  XP_RING_CLOSED,
} from './economy';
import type { CheckInVia } from './events';
import { isOnboarded } from './state';
import type { DayMark, DayRecord, GameState, ReturnedFrom, Settings } from './types';
import { vitalityAfterMissed } from './vitality';

/** Weekday of a day, 0 (Sunday) to 6. */
export function weekdayOf(day: DayKey): number {
  return parseDayKey(day).getDay();
}

/** True when the newest stored event lies in the future: the device clock was set back. */
export function isClockSkewed(state: Pick<GameState, 'clock'>, now: number): boolean {
  return state.clock.lastEventTs > now + FUTURE_GUARD_MS;
}

/**
 * True when the clock reads so far past the last settled day that it is not believed on
 * its own. Nothing is closed, rested or made dormant until a real action confirms the day;
 * if the clock is corrected first, nothing ever happened.
 */
export function isClockSuspect(
  state: Pick<GameState, 'clock' | 'onboarding'>,
  now: number,
): boolean {
  if (!isOnboarded(state)) return false;
  return diffDays(state.clock.today, dayKey(now)) > SUSPECT_JUMP_DAYS;
}

/**
 * A clock that was put right. When it reads well before the stored day, further than any
 * trip can move a date, and nothing was done on or after the days in between, the stored
 * future came from the clock alone: the calendar goes back to the device's day, so the
 * next log lands on the real day and nobody waits weeks for "today" to catch up. Days
 * closed on the strength of that clock are re-opened; rings and logs are never touched.
 * Returns true when the calendar moved back.
 */
function rewindToCorrectedClock(ctx: Ctx, today: DayKey): boolean {
  const s = ctx.s;
  if (ctx.options.passive || today >= s.clock.today) return false;
  if (!isOnboarded(s)) {
    s.clock.today = today;
    s.clock.lastEventTs = Math.min(s.clock.lastEventTs, ctx.now);
    return true;
  }
  if (diffDays(today, s.clock.today) <= BACKWARD_TOLERANCE_DAYS) return false;
  if (today < s.profile.plantedDay) return false;
  // Anything recorded after the device's day means the two clocks cannot be told apart.
  for (const day of Object.keys(s.days)) if (day > today) return false;
  if (s.logs.some((log) => log.day > today)) return false;

  const marks: Record<DayKey, DayMark> = {};
  let missed = 0;
  let rain = 0;
  for (const [day, mark] of Object.entries(s.marks)) {
    if (day >= today && !s.days[day]) {
      if (mark === 'missed') missed += 1;
      if (mark === 'rain') rain += 1;
    } else {
      marks[day] = mark;
    }
  }
  s.marks = marks;
  if (rain > 0) s.rain.bank = Math.min(RAIN_CAP, s.rain.bank + rain);
  if (missed > 0) {
    s.tree.missed = Math.max(0, s.tree.missed - missed);
    s.tree.vitality = vitalityAfterMissed(s.tree.missed);
  }
  const from = s.clock.today;
  s.clock.today = today;
  s.clock.lastEventTs = Math.min(s.clock.lastEventTs, ctx.now);
  ctx.events.push({ type: 'day-rolled', from, to: today, rain: 0, rest: 0, missed: 0 });
  return true;
}

/**
 * The day an event at `now` belongs to. Never earlier than the last settled day
 * (travelling west cannot earn a day twice) and frozen while the clock is skewed.
 */
export function effectiveDay(state: Pick<GameState, 'clock'>, now: number): DayKey {
  if (isClockSkewed(state, now)) return state.clock.today;
  const computed = dayKey(now);
  return computed > state.clock.today ? computed : state.clock.today;
}

/** The rest days in force on a given day: a pending change applies from its Monday. */
export function restDaysOn(settings: Settings, day: DayKey): readonly number[] {
  if (settings.restDaysPending && settings.restDaysFrom && day >= settings.restDaysFrom) {
    return settings.restDaysPending;
  }
  return settings.restDays;
}

/** Cleans a rest-day choice: valid weekdays, unique, sorted, at most three. */
export function normalizeRestDays(input: readonly number[]): number[] {
  const unique = [...new Set(input.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return unique.sort((a, b) => a - b).slice(0, REST_DAYS_MAX);
}

/** The Monday a rest-day change made on `today` takes effect: never retroactive. */
export function restDaysEffectiveFrom(today: DayKey): DayKey {
  return addDays(startOfWeek(today), 7);
}

/** The most recent mark before `day` that is not a rest day. */
function previousActiveMark(state: GameState, day: DayKey): DayMark | undefined {
  let cursor = addDays(day, -1);
  for (let guard = 0; guard < 400 && cursor >= state.profile.plantedDay; guard += 1) {
    const mark = state.marks[cursor];
    if (mark !== 'rest') return mark;
    cursor = addDays(cursor, -1);
  }
  return undefined;
}

/**
 * Closes every day between the last settled day and yesterday. Runs at the start of each
 * transaction, on app open, on resume and by a timer at midnight; it is a no-op within a day.
 */
export function settleDays(ctx: Ctx): void {
  const s = ctx.s;
  const today = dayKey(ctx.now);
  if (rewindToCorrectedClock(ctx, today)) {
    ctx.today = today;
    return;
  }
  if (isClockSkewed(s, ctx.now)) {
    ctx.today = s.clock.today;
    return;
  }
  if (today <= s.clock.today) {
    ctx.today = s.clock.today;
    return;
  }
  // A passive tick does not believe a clock that jumped far ahead: see isClockSuspect.
  if (ctx.options.passive && isClockSuspect(s, ctx.now)) {
    ctx.today = s.clock.today;
    return;
  }
  const from = s.clock.today;
  if (!isOnboarded(s)) {
    s.clock.today = today;
    ctx.today = today;
    return;
  }

  const open = dayRange(from, addDays(today, -1)).filter(
    (day) => day >= s.profile.plantedDay && !s.days[day] && !s.marks[day],
  );
  const marks: Record<DayKey, DayMark> = {};
  const gap: DayKey[] = [];
  let rest = 0;
  for (const day of open) {
    if (restDaysOn(s.settings, day).includes(weekdayOf(day))) {
      marks[day] = 'rest';
      rest += 1;
    } else {
      gap.push(day);
    }
  }

  let rain = 0;
  let missed = 0;
  if (gap.length > 0) {
    if (s.streak.current >= 1 && gap.length <= s.rain.bank) {
      for (const day of gap) marks[day] = 'rain';
      s.rain.bank -= gap.length;
      rain = gap.length;
      ctx.events.push({
        type: 'freeze-used',
        days: gap,
        bank: s.rain.bank,
        streak: s.streak.current,
      });
      queueNotice(ctx, 'rain-return', gap[gap.length - 1] ?? today, {
        days: gap.length,
        streak: s.streak.current,
      });
    } else {
      for (const day of gap) marks[day] = 'missed';
      missed = gap.length;
      const ended = s.streak.current;
      if (ended >= 1) {
        const announced = ended >= STREAK_REST_MESSAGE_MIN;
        ctx.events.push({ type: 'streak-rested', days: ended, announced });
        if (announced) {
          queueNotice(ctx, 'streak-rested', gap[0] ?? today, {
            streak: ended,
            best: s.streak.best,
          });
        }
      }
      s.streak.current = 0;
      const previous = s.tree.vitality;
      s.tree.missed += gap.length;
      s.tree.vitality = vitalityAfterMissed(s.tree.missed);
      if (previous !== s.tree.vitality) {
        ctx.events.push({
          type: 'vitality-changed',
          from: previous,
          to: s.tree.vitality,
          missed: s.tree.missed,
        });
      }
    }
  }
  if (Object.keys(marks).length > 0) s.marks = { ...s.marks, ...marks };

  if (s.settings.restDaysFrom && today >= s.settings.restDaysFrom) {
    s.settings.restDays = s.settings.restDaysPending ?? s.settings.restDays;
    s.settings.restDaysPending = null;
    s.settings.restDaysFrom = null;
  }
  const keepFrom = addDays(today, -LEARN_OPENS_KEEP_DAYS);
  if (s.learn.opens.some((entry) => entry.day < keepFrom)) {
    s.learn.opens = s.learn.opens.filter((entry) => entry.day >= keepFrom);
  }

  s.clock.today = today;
  ctx.today = today;
  ctx.events.push({ type: 'day-rolled', from, to: today, rain, rest, missed });
}

function returnedFrom(state: GameState, today: DayKey): ReturnedFrom {
  if (state.tree.missed >= DORMANT_AFTER_MISSED) return 'dormant';
  if (state.tree.missed >= 1) return 'missed';
  return previousActiveMark(state, today) === 'rain' ? 'rain' : null;
}

/**
 * The first qualifying act of a day: tapping Water, saving a log, keeping a break or
 * passing a lesson quiz. Fires once per day and is never undone. Returns false when
 * today already has its check-in.
 */
export function checkIn(ctx: Ctx, via: CheckInVia): boolean {
  const s = ctx.s;
  const today = ctx.today;
  if (s.days[today]) return false;

  const week = weekKey(today);
  if (s.rain.lastRefillWeek !== week) {
    s.rain.lastRefillWeek = week;
    if (s.rain.bank < RAIN_WEEKLY_REFILL_TO) {
      s.rain.bank = RAIN_WEEKLY_REFILL_TO;
      ctx.events.push({ type: 'rain-earned', reason: 'weekly', bank: s.rain.bank });
    }
  }

  const cameFrom = returnedFrom(s, today);
  const previousVitality = s.tree.vitality;
  s.tree.vitality = s.tree.missed >= DORMANT_AFTER_MISSED ? 'waking' : 'thriving';
  s.tree.missed = 0;
  if (previousVitality === 'thirsty' || previousVitality === 'dormant') {
    ctx.events.push({ type: 'vitality-restored', from: previousVitality, to: s.tree.vitality });
  }

  const previousStreak = s.streak.current;
  s.streak.current += 1;
  s.streak.best = Math.max(s.streak.best, s.streak.current);
  s.tree.rings += 1;

  const record: DayRecord = {
    checkInTs: ctx.now,
    ringClosed: false,
    cleanSweep: false,
    breakRewarded: false,
    // A note written before the check-in has already been paid for today.
    journalRewarded: s.seen.messages.includes(`journal-xp:${today}`),
    returnedFrom: cameFrom,
    ringCelebrated: false,
    ringRain: 'none',
  };
  s.days = { ...s.days, [today]: record };
  s.marks = { ...s.marks, [today]: 'ring' };

  ctx.events.push({
    type: 'checked-in',
    day: today,
    via,
    implicit: via !== 'water' && via !== 'ceremony',
    ringNumber: s.tree.rings,
    returnedFrom: cameFrom,
  });
  ctx.events.push({
    type: 'ring',
    day: today,
    state: 'drawn',
    rings: s.tree.rings,
    fullRings: s.tree.fullRings,
    first: true,
  });
  if (via === 'ceremony') grantXp(ctx, XP_CEREMONY, 'ceremony');
  grantXp(ctx, XP_CHECK_IN, 'check-in');
  grantGp(ctx, GP_CHECK_IN);
  ctx.events.push({
    type: 'streak',
    current: s.streak.current,
    previous: previousStreak,
    best: s.streak.best,
  });

  for (const [days, bonus] of STREAK_MILESTONES) {
    if (s.streak.current >= days && !s.streak.milestones.includes(days)) {
      s.streak.milestones = [...s.streak.milestones, days];
      grantXp(ctx, bonus, 'streak-milestone');
      ctx.events.push({ type: 'streak-milestone', days, xp: bonus });
      writeActivity(ctx, 'streak', `A ${days}-day streak.`);
    }
  }
  for (const days of RAIN_STREAK_GIFTS) {
    if (s.streak.current >= days && !s.rain.gifts.includes(days)) {
      s.rain.gifts = [...s.rain.gifts, days];
      if (s.rain.bank < RAIN_CAP) {
        s.rain.bank += 1;
        ctx.events.push({ type: 'rain-earned', reason: 'streak', bank: s.rain.bank });
      }
    }
  }
  if (via === 'ceremony') writeActivity(ctx, 'planted', '{Tree} planted');
  return true;
}

function updateDay(ctx: Ctx, patch: Partial<DayRecord>): void {
  const record = ctx.s.days[ctx.today];
  if (!record) return;
  ctx.s.days = { ...ctx.s.days, [ctx.today]: { ...record, ...patch } };
}

/**
 * Brings today's ring in line with the day's rewarded acts: the third act closes it, and
 * an undo that takes the day below three re-opens it and steps every reward back.
 */
export function syncRing(ctx: Ctx, shouldBeClosed: boolean): void {
  const s = ctx.s;
  const record = s.days[ctx.today];
  if (!record || record.ringClosed === shouldBeClosed) return;

  if (shouldBeClosed) {
    grantXp(ctx, XP_RING_CLOSED, 'ring');
    grantGp(ctx, GP_RING_CLOSED);
    s.tree.fullRings += 1;
    s.marks = { ...s.marks, [ctx.today]: 'full' };
    if (s.tree.vitality === 'waking') s.tree.vitality = 'thriving';
    let ringRain: DayRecord['ringRain'] = 'none';
    if (s.rain.bank < RAIN_CAP) {
      s.rain.progress += 1;
      ringRain = 'progress';
      if (s.rain.progress >= RAIN_FULL_RINGS_PER_CLOUD) {
        s.rain.progress = 0;
        s.rain.bank += 1;
        ringRain = 'cloud';
        ctx.events.push({ type: 'rain-earned', reason: 'rings', bank: s.rain.bank });
      }
    }
    const first = !record.ringCelebrated;
    updateDay(ctx, { ringClosed: true, ringCelebrated: true, ringRain });
    ctx.events.push({
      type: 'ring',
      day: ctx.today,
      state: 'closed',
      rings: s.tree.rings,
      fullRings: s.tree.fullRings,
      first,
    });
    return;
  }

  grantXp(ctx, -XP_RING_CLOSED, 'ring');
  grantGp(ctx, -GP_RING_CLOSED);
  s.tree.fullRings = Math.max(0, s.tree.fullRings - 1);
  s.marks = { ...s.marks, [ctx.today]: 'ring' };
  if (record.returnedFrom === 'dormant') s.tree.vitality = 'waking';
  if (record.ringRain === 'progress') {
    s.rain.progress = Math.max(0, s.rain.progress - 1);
  } else if (record.ringRain === 'cloud') {
    // The cloud that fifth ring granted goes back only if it is still in the bank.
    if (s.rain.bank > 0) s.rain.bank -= 1;
    s.rain.progress = RAIN_FULL_RINGS_PER_CLOUD - 1;
  }
  updateDay(ctx, { ringClosed: false, ringRain: 'none' });
  ctx.events.push({
    type: 'ring',
    day: ctx.today,
    state: 'reopened',
    rings: s.tree.rings,
    fullRings: s.tree.fullRings,
    first: false,
  });
}

export interface WeekStripDay {
  day: DayKey;
  /** 0 (Monday) to 6 (Sunday). */
  index: number;
  mark: DayMark | 'today' | 'none';
  label: string;
  isToday: boolean;
  isFuture: boolean;
}

const MARK_LABELS: Record<WeekStripDay['mark'], string> = {
  full: 'Full ring',
  ring: 'Ring',
  rain: 'Rain day',
  rest: 'Rest day',
  missed: 'No ring',
  today: 'Today, not watered yet',
  none: 'Not yet',
};

export function markLabel(mark: WeekStripDay['mark']): string {
  return MARK_LABELS[mark];
}

/** The seven days of the week containing `day`, Monday first, with their marks as text. */
export function weekStrip(
  state: Pick<GameState, 'marks' | 'profile'>,
  day: DayKey,
  today: DayKey,
): WeekStripDay[] {
  const monday = startOfWeek(day);
  return Array.from({ length: 7 }, (_, index) => {
    const key = addDays(monday, index);
    const stored = state.marks[key];
    const mark: WeekStripDay['mark'] =
      stored ?? (key === today && key >= state.profile.plantedDay ? 'today' : 'none');
    return {
      day: key,
      index,
      mark,
      label: MARK_LABELS[mark],
      isToday: key === today,
      isFuture: key > today,
    };
  });
}

/** Active days (ring or full) among a week strip: "3 of 7 this week". */
export function activeDaysIn(strip: readonly WeekStripDay[]): number {
  return strip.filter((entry) => entry.mark === 'ring' || entry.mark === 'full').length;
}
