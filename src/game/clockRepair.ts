/**
 * A day lived under a clock that ran ahead. Someone waters and logs while the device says
 * next month, then puts the date right. That one day is brought home: its ring, logs and
 * notes land on the real day, so nobody waits weeks for "today" to catch up.
 *
 * It cannot be farmed, because nothing is created: the ring that existed still exists once,
 * on a day that had none, and every reward was already paid. It only happens when everything
 * recorded after the device's day sits on a single day (one sitting); with two or more such
 * days the calendar keeps waiting, because spreading them over real days would hand out
 * days that were never lived.
 */
import { addDays, diffDays, startOfWeek, weekKey, type DayKey } from '@/lib/dates';
import { dayNumber, queueNotice, type Ctx } from './ctx';
import {
  BACKWARD_TOLERANCE_DAYS,
  CLOCK_FLOOR_DAY,
  DORMANT_AFTER_MISSED,
  DOUBLE_TAP_MS,
  RAIN_CAP,
} from './economy';
import type { DayMark, NoticeKind, ReturnedFrom } from './types';

/** Messages a bogus jump produced about an absence that never happened. */
const ABSENCE_NOTICES: readonly NoticeKind[] = ['rain-return', 'streak-rested', 'woke-up'];

/** The one day after `today` that holds a ring, or `null` when there is none or several. */
function soleDayAhead(ctx: Ctx, today: DayKey): DayKey | null {
  const s = ctx.s;
  let ahead: DayKey | null = null;
  for (const day of Object.keys(s.days)) {
    if (day <= today) continue;
    if (ahead !== null) return null;
    ahead = day;
  }
  if (ahead === null) return null;
  for (const log of s.logs) if (log.day > today && log.day !== ahead) return null;
  for (const entry of s.breaks) if (entry.day > today && entry.day !== ahead) return null;
  return ahead;
}

/**
 * Moves the single day recorded ahead of the device's clock onto the device's day.
 * Returns true when it did; false leaves the state untouched and the calendar waiting.
 */
export function bringDayHome(ctx: Ctx, today: DayKey): boolean {
  const s = ctx.s;
  // A device date from before this app existed is the wrong one of the two.
  if (today < CLOCK_FLOOR_DAY) return false;
  const ahead = soleDayAhead(ctx, today);
  const record = ahead === null ? undefined : s.days[ahead];
  if (ahead === null || !record) return false;
  if (diffDays(today, ahead) <= BACKWARD_TOLERANCE_DAYS) return false;
  // The real day must be empty, and the tree must not be older than the day it lands on.
  if (s.days[today]) return false;
  if (s.logs.some((log) => log.day === today)) return false;
  if (s.breaks.some((entry) => entry.day === today)) return false;
  if (s.profile.plantedDay > today && s.profile.plantedDay !== ahead) return false;

  const week = weekKey(today);
  // Kept clear of "now", so the next identical log is not mistaken for a double tap.
  const latest = ctx.now - DOUBLE_TAP_MS - 1;
  const homeDay = (day: DayKey): DayKey => (day > today ? today : day);
  const homeWeek = (key: string): string => (key > week ? week : key);
  const homeTs = (ts: number): number => Math.min(ts, latest);
  const homeTsOrNull = (ts: number | null): number | null => (ts === null ? null : homeTs(ts));

  // Marks: the ring moves; whatever the clock alone closed from today onwards re-opens.
  const marks: Record<DayKey, DayMark> = {};
  let rain = 0;
  for (const [day, mark] of Object.entries(s.marks)) {
    if (day === ahead) continue;
    if (day >= today && !s.days[day]) {
      if (mark === 'rain') rain += 1;
      continue;
    }
    marks[day] = mark;
  }
  marks[today] = record.ringClosed ? 'full' : 'ring';
  s.marks = marks;
  if (rain > 0) s.rain.bank = Math.min(RAIN_CAP, s.rain.bank + rain);
  if (s.rain.lastRefillWeek) s.rain.lastRefillWeek = homeWeek(s.rain.lastRefillWeek);

  if (s.profile.plantedDay > today) s.profile.plantedDay = today;
  if (s.onboarding.completedAt !== null) {
    s.onboarding.completedAt = homeTs(s.onboarding.completedAt);
  }

  // The streak and what the day came back from, read from the marks as they now stand.
  const planted = s.profile.plantedDay;
  let streak = 0;
  for (let cursor = today, guard = 0; guard < 4000 && cursor >= planted; guard += 1) {
    const mark = marks[cursor];
    if (mark === 'ring' || mark === 'full') streak += 1;
    else if (mark !== 'rest' && mark !== 'rain') break;
    cursor = addDays(cursor, -1);
  }
  let missed = 0;
  let previous: DayMark | undefined;
  for (let cursor = addDays(today, -1), guard = 0; guard < 4000 && cursor >= planted; guard += 1) {
    const mark = marks[cursor];
    cursor = addDays(cursor, -1);
    if (mark === 'rest') continue;
    previous ??= mark;
    if (mark !== 'missed') break;
    missed += 1;
  }
  // A streak is never lowered here: the marks of an imported history can be incomplete.
  s.streak.current = Math.max(s.streak.current, streak);
  s.streak.best = Math.max(s.streak.best, s.streak.current);
  const returnedFrom: ReturnedFrom =
    missed >= DORMANT_AFTER_MISSED ? 'dormant' : missed >= 1 ? 'missed' : previous === 'rain' ? 'rain' : null;
  s.tree.missed = 0;
  s.tree.vitality = returnedFrom === 'dormant' && !record.ringClosed ? 'waking' : 'thriving';

  const days = { ...s.days };
  delete days[ahead];
  days[today] = { ...record, checkInTs: homeTs(record.checkInTs), returnedFrom };
  s.days = days;

  s.logs = s.logs
    .map((log) =>
      log.day > today || log.ts > latest ? { ...log, day: homeDay(log.day), ts: homeTs(log.ts) } : log,
    )
    .sort((a, b) => a.ts - b.ts);
  s.breaks = s.breaks.map((entry) =>
    entry.day > today
      ? { ...entry, day: today, startTs: homeTs(entry.startTs), endTs: homeTs(entry.endTs) }
      : entry,
  );
  if (s.activeBreak) {
    s.activeBreak = {
      ...s.activeBreak,
      startTs: homeTs(s.activeBreak.startTs),
      lastVisibleTs: homeTsOrNull(s.activeBreak.lastVisibleTs),
      hiddenSinceTs: homeTsOrNull(s.activeBreak.hiddenSinceTs),
    };
  }
  s.journal = s.journal.map((note) =>
    note.day > today || note.ts > latest
      ? { ...note, day: homeDay(note.day), ts: homeTs(note.ts), editedTs: homeTsOrNull(note.editedTs) }
      : note,
  );
  s.learn.opens = s.learn.opens.map((open) =>
    open.day > today ? { ...open, day: today, ts: homeTs(open.ts) } : open,
  );
  s.learn.lessons = Object.fromEntries(
    Object.entries(s.learn.lessons).map(([id, lesson]) => [
      id,
      {
        ...lesson,
        openedTs: homeTsOrNull(lesson.openedTs),
        readTs: homeTsOrNull(lesson.readTs),
        passedTs: homeTsOrNull(lesson.passedTs),
      },
    ]),
  );

  // Quests: today's three stay as they are; a week that has not begun is drawn again.
  if (s.quests.daily && s.quests.daily.key > today) {
    s.quests.daily = { ...s.quests.daily, key: today };
  }
  if (s.quests.weekly && s.quests.weekly.key > week) s.quests.weekly = null;
  s.quests.claims = s.quests.claims.map((claim) => {
    const period =
      claim.kind === 'daily' ? homeDay(claim.period) : claim.kind === 'weekly' ? homeWeek(claim.period) : claim.period;
    return period === claim.period && claim.ts <= latest ? claim : { ...claim, period, ts: homeTs(claim.ts) };
  });
  s.quests.epics = Object.fromEntries(
    Object.entries(s.quests.epics).map(([id, epic]) => [
      id,
      { ...epic, claimedTs: homeTsOrNull(epic.claimedTs) },
    ]),
  );
  s.quests.lastSelfAttestedTs = homeTsOrNull(s.quests.lastSelfAttestedTs);
  s.badges = Object.fromEntries(
    Object.entries(s.badges).map(([id, badge]) => [
      id,
      { ...badge, earned: badge.earned.map((entry) => ({ ...entry, ts: homeTs(entry.ts) })) },
    ]),
  );

  if (s.baseline.current && s.baseline.current.takenDay > today) {
    s.baseline.current = { ...s.baseline.current, takenDay: today };
  }
  s.baseline.history = s.baseline.history.map((result) =>
    result.takenDay > today ? { ...result, takenDay: today } : result,
  );
  if (s.challenge.active) {
    s.challenge.active = {
      ...s.challenge.active,
      startDay: homeDay(s.challenge.active.startDay),
      completedTs: homeTsOrNull(s.challenge.active.completedTs),
    };
  }
  if (s.challenge.lastRewardWeek) {
    s.challenge.lastRewardWeek = homeWeek(s.challenge.lastRewardWeek);
  }
  s.challenge.history = s.challenge.history.map((entry) =>
    entry.startDay > today ? { ...entry, startDay: today } : entry,
  );
  if (s.settings.restDaysFrom && s.settings.restDaysPending) {
    const from = addDays(startOfWeek(today), 7);
    if (s.settings.restDaysFrom > from) s.settings.restDaysFrom = from;
  }

  const label = `Day ${dayNumber(s, today)} · `;
  s.activity = s.activity.map((entry) =>
    entry.day > today
      ? { ...entry, day: today, ts: homeTs(entry.ts), text: entry.text.replace(/^Day \d+ · /, label) }
      : entry,
  );
  s.notices = s.notices
    .filter((notice) => !(notice.ts > latest && ABSENCE_NOTICES.includes(notice.kind)))
    .map((notice) =>
      notice.day > today || notice.ts > latest
        ? { ...notice, day: homeDay(notice.day), ts: homeTs(notice.ts) }
        : notice,
    );
  // Once-only flags written for that day ("journal-xp:<day>") must hold on the real one.
  const suffix = `:${ahead}`;
  s.seen.messages = s.seen.messages.map((id) =>
    id.endsWith(suffix) ? `${id.slice(0, -ahead.length)}${today}` : id,
  );
  if (s.seen.recapWeek !== null && s.seen.recapWeek >= week) {
    s.seen.recapWeek = weekKey(addDays(today, -7));
  }

  const from = s.clock.today;
  s.clock.today = today;
  s.clock.lastEventTs = Math.min(s.clock.lastEventTs, latest);
  ctx.today = today;
  ctx.events.push({ type: 'day-rolled', from, to: today, rain: 0, rest: 0, missed: 0 });
  queueNotice(ctx, 'clock-corrected', today, {});
  return true;
}
