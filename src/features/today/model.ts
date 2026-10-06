/**
 * Pure helpers for the Today page: the words and small derivations that sit between the
 * game's read models and the screen. Nothing here touches the store or the DOM.
 */
import { ROUTES } from '@/app/routes';
import { ACTION_BY_ID } from '@/data/catalogue';
import { FACTORS_VERSION } from '@/data/content';
import {
  BREAK_DURATIONS_MIN,
  GP_SUNLIGHT,
  breakXp,
  type BreakFinishResult,
  type LogEntry,
  type QuestBoard,
  type QuestView,
  type StreakStatus,
  type TodaySummary,
  type TreeStatus,
  type WeekRecap,
  type WeekStripDay,
} from '@/game';
import { hourOfDay, parseDayKey, type DayKey } from '@/lib/dates';
import {
  formatCo2,
  formatDecimal,
  formatDuration,
  formatNumber,
  formatPercent,
  formatTime,
  pluralize,
} from '@/lib/format';
import { clamp } from '@/lib/math';
import { CATEGORY_IDS, type CategoryId, type EstimateSource } from '@/ui';
import type { LandmarkId } from '@/world';
import { BREAK_COPY } from './copy';

const LOCALE = 'en-US';
const weekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const monthLong = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
const monthShort = new Intl.DateTimeFormat(LOCALE, { month: 'short' });

const twoDigits = (value: number) => String(value).padStart(2, '0');

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** Morning from 05:00, afternoon from 12:00, evening from 17:00, night from 22:00. */
export function partOfDay(now: number): PartOfDay {
  const hour = hourOfDay(now);
  if (hour < 5 || hour >= 22) return 'night';
  if (hour < 12) return 'morning';
  return hour < 17 ? 'afternoon' : 'evening';
}

/** "Afternoon, Sam." Late at night it becomes a question; without a name it is just the hour. */
export function greeting(now: number, name: string): string {
  const who = name.trim();
  switch (partOfDay(now)) {
    case 'morning':
      return who ? `Morning, ${who}.` : 'Morning.';
    case 'afternoon':
      return who ? `Afternoon, ${who}.` : 'Afternoon.';
    case 'evening':
      return who ? `Evening, ${who}.` : 'Evening.';
    case 'night':
      return who ? `Up late, ${who}?` : 'Up late?';
  }
}

/** "Tuesday 06 October": the date line above the greeting. */
export function printDate(day: DayKey): string {
  const date = parseDayKey(day);
  return `${weekdayLong.format(date)} ${twoDigits(date.getDate())} ${monthLong.format(date)}`;
}

/** "Tue 06 Oct 2026": label-maker style, for slugs and stamps. */
export function stampDate(day: DayKey): string {
  const date = parseDayKey(day);
  return `${weekdayShort.format(date)} ${twoDigits(date.getDate())} ${monthShort.format(date)} ${date.getFullYear()}`;
}

/** "0012": the grove's print number is the number of rings, zero-padded like an edition. */
export function serial(count: number): string {
  return String(Math.max(0, Math.floor(count))).padStart(4, '0');
}

/** "Grove Nº 0012 · Tue 06 Oct 2026 · 2:32 PM": the print slug in the corner of the stage. */
export function printSlug(rings: number, day: DayKey, now: number): string {
  return `Grove Nº ${serial(rings)} · ${stampDate(day)} · ${formatTime(now)}`;
}

const SPECIES_NAME: Record<TreeStatus['species'], string> = {
  oak: 'Oak',
  cherry: 'Cherry blossom',
  pine: 'Pine',
};

export function speciesName(species: TreeStatus['species']): string {
  return SPECIES_NAME[species];
}

/** The two halves of the hang tag: what it is, then how it is doing. */
export function specimenLines(
  tree: Pick<TreeStatus, 'species' | 'stage' | 'dayNumber' | 'vitalityLabel'>,
): { kind: string; state: string } {
  return {
    kind: `${speciesName(tree.species)} · ${tree.stage}`,
    state: `Day ${formatNumber(tree.dayNumber)} · ${tree.vitalityLabel}`,
  };
}

const SKY_WORDS: Record<PartOfDay, string> = {
  morning: 'in the morning light',
  afternoon: 'on a bright afternoon',
  evening: 'in the evening light',
  night: 'under the night sky',
};

/** The stage's text alternative: everything the scene shows, as one sentence. */
export function sceneLabel(tree: Pick<TreeStatus, 'sceneLabel'>, now: number): string {
  return `${tree.sceneLabel}, ${SKY_WORDS[partOfDay(now)]}`;
}

/** Short status printed after a landmark's label on the island. */
export function landmarkMeta(
  quests: Pick<QuestBoard, 'daily'>,
  tree: Pick<TreeStatus, 'rings'>,
): Partial<Record<LandmarkId, string>> {
  const done = quests.daily.filter((quest) => quest.claimed).length;
  return {
    quests: `${formatNumber(done)}/${formatNumber(quests.daily.length)}`,
    impact: pluralize(tree.rings, 'ring'),
  };
}

/** Where each landmark leads. The coach is a drawer, so the page opens it instead. */
export const LANDMARK_ROUTE: Record<LandmarkId, string> = {
  log: ROUTES.log,
  quests: ROUTES.quests,
  learn: ROUTES.learn,
  impact: ROUTES.impact,
  community: ROUTES.community,
  coach: ROUTES.coach,
  me: ROUTES.me,
};

/** "2 km", "1 meal", "0.5 kg": a quantity with its catalogue unit. */
export function quantityLabel(qty: number, unit: string): string {
  const amount = formatDecimal(qty, 2);
  if (unit === 'km' || unit === 'kg') return `${amount} ${unit}`;
  if (unit === 'minute') return `${amount} min`;
  if (unit === 'litre') return `${amount} L`;
  if (unit === 'bulb-day' || unit === 'tree-year') return `${amount} ×`;
  return `${amount} ${qty === 1 ? unit : `${unit}s`}`;
}

const COMPARED_WITH =
  'Each action is compared with what it replaced: the drive not taken, the tumble dryer left off. Self-reported, so treat it as a careful estimate.';

/** How today's headline figure was made: opened by the honesty mark next to it. */
export function todayEstimateSource(
  today: Pick<TodaySummary, 'logs' | 'kg' | 'aiKg'>,
): EstimateSource {
  const counted = today.logs.filter(
    (log) => log.estimate === 'factor' && (log.co2eKg ?? 0) > 0,
  ).length;
  const formula =
    counted === 0
      ? 'Nothing with a sourced estimate has been logged yet today.'
      : `${formatNumber(counted)} logged ${counted === 1 ? 'action' : 'actions'} today, each quantity × its factor = ${formatCo2(today.kg)}`;
  const aiNote =
    today.aiKg > 0
      ? ` Custom actions with an AI estimate (${formatCo2(today.aiKg)} today) are kept out of this total.`
      : '';
  return {
    code: `Factors ${FACTORS_VERSION}`,
    kind: 'factor',
    formula,
    comparedWith: `${COMPARED_WITH}${aiNote}`,
    sourceLabel: 'Our factor table',
    href: ROUTES.methodology,
  };
}

/** The same explanation for a whole week: the total on the recap. */
export function weekEstimateSource(week: Pick<WeekRecap, 'logs' | 'kg' | 'aiKg'>): EstimateSource {
  const aiNote =
    week.aiKg > 0
      ? ` Custom actions with an AI estimate (${formatCo2(week.aiKg)} that week) are kept out of this total.`
      : '';
  return {
    code: `Factors ${FACTORS_VERSION}`,
    kind: 'factor',
    formula: `${formatNumber(week.logs)} logged ${week.logs === 1 ? 'action' : 'actions'} that week, each quantity × its factor = ${formatCo2(week.kg)}`,
    comparedWith: `${COMPARED_WITH}${aiNote}`,
    sourceLabel: 'Our factor table',
    href: ROUTES.methodology,
  };
}

/** A quest's category, when its pool is one of the seven; `undefined` for mixed pools. */
export function questCategory(quest: Pick<QuestView, 'pool'>): CategoryId | undefined {
  return (CATEGORY_IDS as readonly string[]).includes(quest.pool)
    ? (quest.pool as CategoryId)
    : undefined;
}

/** Claimable quests first, then the ones in progress, then the claimed ones; ties keep their slot. */
export function questOrder(quests: readonly QuestView[]): string[] {
  const rank = (quest: QuestView) => (quest.claimable ? 0 : quest.claimed ? 2 : 1);
  return [...quests].sort((a, b) => rank(a) - rank(b) || a.slot - b.slot).map((quest) => quest.id);
}

/** "Resets in 9 h 28 min". */
export function resetsIn(resetsAt: number, now: number): string {
  return `Resets in ${formatDuration(Math.max(60, (resetsAt - now) / 1000))}`;
}

// ── The log moment ─────────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

/**
 * The sticker's flight, in milliseconds from the press: peeled by `peel`, on the tree at
 * `land` (the log is saved then), pressed flat and gone by `press`. `back` is the whole
 * return trip of an undo.
 */
export const FLIGHT = { peel: 110, land: 440, press: 520, back: 360 } as const;

/** How far above the straight line the flight's control point sits. */
const FLIGHT_LIFT = 90;
const FLIGHT_STEPS = 8;

/** `steps + 1` points on a quadratic curve whose control point is `lift` above the midpoint. */
export function arcPoints(from: Point, to: Point, lift: number, steps: number): Point[] {
  const control = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - lift };
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return {
      x: a * from.x + b * control.x + c * to.x,
      y: a * from.y + b * control.y + c * to.y,
    };
  });
}

export interface FlightFrames {
  /** Seconds. */
  duration: number;
  /** 0..1, one entry per keyframe. */
  times: number[];
  x: number[];
  y: number[];
  scale: number[];
  rotate: number[];
  opacity: number[];
}

/**
 * Keyframes of one flight. Forward: lift off the slot, ride the arc, press onto the tree
 * and fade into it. Back (an undo): ride the arc home and settle at full size.
 */
export function flightFrames(from: Point, to: Point, back = false): FlightFrames {
  const arc = arcPoints(from, to, FLIGHT_LIFT, FLIGHT_STEPS);
  if (back) {
    const last = arc.length - 1;
    return {
      duration: FLIGHT.back / 1000,
      times: arc.map((_, index) => index / last),
      x: arc.map((point) => point.x),
      y: arc.map((point) => point.y),
      scale: arc.map((_, index) => 0.7 + 0.3 * (index / last)),
      rotate: arc.map((_, index) => -10 * (1 - index / last)),
      opacity: arc.map(() => 1),
    };
  }
  const peel = FLIGHT.peel / FLIGHT.press;
  const land = FLIGHT.land / FLIGHT.press;
  const carried = arc.slice(1);
  const share = (index: number) => (index + 1) / carried.length;
  return {
    duration: FLIGHT.press / 1000,
    times: [0, peel, ...carried.map((_, index) => peel + (land - peel) * share(index)), 1],
    x: [from.x, from.x, ...carried.map((point) => point.x), to.x],
    y: [from.y, from.y - 6, ...carried.map((point) => point.y), to.y],
    scale: [1, 1.15, ...carried.map((_, index) => 1.15 - 0.4 * share(index)), 0.6],
    rotate: [0, -8, ...carried.map((_, index) => -8 + 14 * share(index)), 6],
    opacity: [1, 1, ...carried.map(() => 1), 0],
  };
}

/** A grow pulse of strength 0.2 to 1 reads as three to eight new leaves. */
export function leavesFor(strength: number): number {
  return Math.round(3 + 5 * clamp((strength - 0.2) / 0.8, 0, 1));
}

// ── The day and the week ───────────────────────────────────────────────────────────────

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** 0 is Monday. */
export function weekdayLabel(index: number): string {
  return WEEKDAYS[clamp(Math.floor(index), 0, 6)] ?? '';
}

/** The one word printed under a day's mark; days with nothing to say stay quiet. */
export function markWord(mark: WeekStripDay['mark']): string {
  switch (mark) {
    case 'full':
      return 'Full';
    case 'ring':
      return 'Ring';
    case 'rain':
      return 'Rain';
    case 'rest':
      return 'Rest';
    case 'missed':
    case 'today':
    case 'none':
      return '';
  }
}

/** "3 of 7 this week · 12-day streak · 2 rain days banked · 12 rings". */
export function rhythmLine(
  streak: Pick<StreakStatus, 'activeThisWeek' | 'current' | 'rainBank'>,
  rings: number,
): string {
  return [
    `${formatNumber(streak.activeThisWeek)} of 7 this week`,
    `${formatNumber(streak.current)}-day streak`,
    `${formatNumber(streak.rainBank)} rain ${streak.rainBank === 1 ? 'day' : 'days'} banked`,
    pluralize(rings, 'ring'),
  ].join(' · ');
}

// ── The Touch grass break ──────────────────────────────────────────────────────────────

/** `?break=1` opens the sheet; `?break=20` also picks a length, when the engine offers it. */
export function breakParam(value: string | null): { open: boolean; minutes: number | null } {
  if (value === null) return { open: false, minutes: null };
  const minutes = Number(value);
  return {
    open: true,
    minutes: (BREAK_DURATIONS_MIN as readonly number[]).includes(minutes) ? minutes : null,
  };
}

/** What a break of this length pays, before it starts. Only the day's first kept break pays. */
export function breakRewardPreview(minutes: number, rewardedToday: boolean): string {
  if (rewardedToday) return BREAK_COPY.alreadyRewarded;
  return `+${formatNumber(breakXp(minutes))} XP · +${formatNumber(GP_SUNLIGHT)} sunlight for the first kept break of the day`;
}

export interface BreakSummary {
  /** `reward`: kept and paid. `recorded`: kept, the day's XP was already in. `kind`: not counted. */
  tone: 'reward' | 'recorded' | 'kind';
  minutes: number;
  xp: number;
  line: string;
}

/** The engine's verdict on a finished break, in the page's words. */
export function breakSummary(
  result: Extract<BreakFinishResult, { ok: true }>,
  treeName: string,
): BreakSummary {
  const { entry, verdict } = result;
  if (!entry) return { tone: 'kind', minutes: 0, xp: 0, line: BREAK_COPY.noneReply };
  if (!entry.kept) {
    return {
      tone: 'kind',
      minutes: 0,
      xp: 0,
      line: verdict.why === 'too-short' ? BREAK_COPY.tooShort : BREAK_COPY.notAway,
    };
  }
  if (result.rewarded) {
    return {
      tone: 'reward',
      minutes: entry.keptMin,
      xp: entry.xp,
      line: BREAK_COPY.rewarded(entry.xp, treeName),
    };
  }
  return {
    tone: 'recorded',
    minutes: entry.keptMin,
    xp: 0,
    line: BREAK_COPY.recorded(entry.keptMin),
  };
}

// ── The weekly recap ───────────────────────────────────────────────────────────────────

const shortDay = (day: DayKey) => {
  const date = parseDayKey(day);
  return `${twoDigits(date.getDate())} ${monthShort.format(date)}`;
};

/** "28 Sep – 04 Oct". */
export function recapRange(week: Pick<WeekRecap, 'monday' | 'sunday'>): string {
  return `${shortDay(week.monday)} – ${shortDay(week.sunday)}`;
}

/** Differences smaller than this are noise in a self-reported estimate. */
const FLAT_KG = 0.05;

/** The change from the week before, or `null` when there is no week before. */
export function recapDelta(
  week: Pick<WeekRecap, 'kg' | 'previousKg'>,
): { dir: 'up' | 'down' | 'flat'; text: string } | null {
  if (week.previousKg === null) return null;
  const diff = week.kg - week.previousKg;
  if (Math.abs(diff) < FLAT_KG) return { dir: 'flat', text: 'About the same as the week before' };
  return diff > 0
    ? { dir: 'up', text: `${formatCo2(diff)} more than the week before` }
    : { dir: 'down', text: `${formatCo2(-diff)} less than the week before` };
}

/** "Sapling, 12% → 43%" inside one stage; "Sapling 90% → Young tree 4%" across two. */
export function recapGrowth(
  week: Pick<
    WeekRecap,
    'stageBefore' | 'stageAfter' | 'stageProgressBefore' | 'stageProgressAfter'
  >,
): string {
  const before = formatPercent(week.stageProgressBefore);
  const after = formatPercent(week.stageProgressAfter);
  return week.stageBefore === week.stageAfter
    ? `${week.stageAfter}, ${before} → ${after}`
    : `${week.stageBefore} ${before} → ${week.stageAfter} ${after}`;
}

// ── Recent activity ────────────────────────────────────────────────────────────────────

/** "2:32 PM · 5 km": when a log was stuck on, and how much of it. */
export function logMeta(log: Pick<LogEntry, 'ts' | 'qty' | 'unit'>): string {
  return `${formatTime(log.ts)} · ${quantityLabel(log.qty, log.unit)}`;
}

/** How one log's figure was made: opened by the honesty mark on its row. */
export function logEstimateSource(log: LogEntry): EstimateSource {
  const kg = log.co2eKg ?? 0;
  if (log.estimate === 'ai') {
    return {
      code: 'CUSTOM',
      kind: 'ai',
      formula: `Estimated from your description = ${formatCo2(kg)}`,
      comparedWith:
        'A low-confidence AI estimate for a custom action. It is kept out of your headline total.',
      sourceLabel: 'AI estimate',
      href: ROUTES.methodology,
    };
  }
  const action = ACTION_BY_ID.get(log.actionId);
  const perUnit = log.qty > 0 ? kg / log.qty : kg;
  return {
    code: `Factors ${log.factorsVersion}`,
    kind: log.estimate === 'factor' && kg > 0 ? 'factor' : 'none',
    formula: `${quantityLabel(log.qty, log.unit)} × ${formatCo2(perUnit)} each = ${formatCo2(kg)}`,
    comparedWith: action
      ? `Compared with ${action.counterfactual}. Self-reported, so treat it as a careful estimate.`
      : COMPARED_WITH,
    range:
      log.kgLow !== null && log.kgHigh !== null
        ? `${formatCo2(log.kgLow)} to ${formatCo2(log.kgHigh)}`
        : undefined,
    sourceLabel: 'Our factor table',
    href: ROUTES.methodology,
  };
}
