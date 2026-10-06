/**
 * The Quests page's view logic, kept pure so it can be tested without rendering: the order
 * of the deck, what a countdown says, which actions move a quest forward, what was claimed
 * while the user was away, and the small helpers the epic cards need. Rules (progress,
 * claiming, rotation, the weekly limit) live in the engine; nothing here decides them.
 */
import { PARAMS, ROUTES, TOUCH_GRASS_LINK, logLink } from '@/app/routes';
import { ACTION_BY_ID, CATEGORY_BY_ID, type CategoryId } from '@/data/catalogue';
import {
  DAILY_QUEST_BY_ID,
  EPIC_BY_ID,
  WEEKLY_QUEST_BY_ID,
  type ActionSet,
  type EpicDef,
  type QuestCondition,
} from '@/data/quests';
import { type EpicStatus, type QuestBoard, type QuestClaim, type QuestView } from '@/game';
import { addDays, dayKey, parseDayKey, startOfWeek, type DayKey } from '@/lib/dates';
import { formatNumber, pluralize } from '@/lib/format';
import { xpReward } from './copy';

// ── Tabs ────────────────────────────────────────────────────────────────────

export const QUEST_TABS = ['daily', 'weekly', 'epics'] as const;
export type QuestTab = (typeof QUEST_TABS)[number];

/** `/quests?tab=weekly`: the open board lives in the URL so reload, Back and deep links work. */
export const TAB_PARAM = 'tab';

export function parseTab(value: string | null | undefined): QuestTab {
  return (QUEST_TABS as readonly string[]).includes(value ?? '') ? (value as QuestTab) : 'daily';
}

/** The page's URL for a tab. Daily is the default and keeps the bare path. */
export function tabHref(tab: QuestTab, current?: URLSearchParams | string): string {
  const query = new URLSearchParams(current);
  // The shell's own parameters are not ours to carry along.
  query.delete(PARAMS.coach);
  if (tab === 'daily') query.delete(TAB_PARAM);
  else query.set(TAB_PARAM, tab);
  const text = query.toString();
  return text ? `${ROUTES.quests}?${text}` : ROUTES.quests;
}

/** Quests still to be claimed on each board: the number printed on its tab. */
export function tabCounts(board: QuestBoard): Record<QuestTab, number> {
  const open = (quests: readonly { claimed: boolean }[]) =>
    quests.filter((quest) => !quest.claimed).length;
  return { daily: open(board.daily), weekly: open(board.weekly), epics: open(board.epics) };
}

// ── The deck ────────────────────────────────────────────────────────────────

export type TicketState = 'active' | 'claimable' | 'claimed' | 'expired';

/** What a ticket shows. A finished quest stays claimable until its period is settled. */
export function ticketState(
  quest: Pick<QuestView, 'claimed' | 'claimable'>,
  periodOver: boolean,
): TicketState {
  if (quest.claimed) return 'claimed';
  if (quest.claimable) return 'claimable';
  return periodOver ? 'expired' : 'active';
}

const RANK: Record<TicketState, number> = { claimable: 0, active: 1, expired: 1, claimed: 2 };

/** Claimable first, then in progress, then claimed; the drawn order breaks ties. */
export function deckOrder(quests: readonly QuestView[]): QuestView[] {
  return [...quests].sort(
    (a, b) => RANK[ticketState(a, false)] - RANK[ticketState(b, false)] || a.slot - b.slot,
  );
}

/** A quest's pool is a category for the themed pools; `easy`, `any` and `consistency` have none. */
export function questCategory(pool: string): CategoryId | undefined {
  return pool in CATEGORY_BY_ID ? (pool as CategoryId) : undefined;
}

/** Whole units for the ticket's "2 / 5": a half-walked kilometre does not round up. */
export function ticketProgress(quest: Pick<QuestView, 'progress'>): { value: number; max: number } {
  return { value: Math.floor(quest.progress.current), max: quest.progress.target };
}

// ── Time ────────────────────────────────────────────────────────────────────

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** "9 h 28 min", "28 min", "42 sec": the live countdown. Seconds only in the last minute. */
export function countdownText(ms: number): string {
  if (ms <= 0) return 'now';
  if (ms < MINUTE) return `${formatNumber(Math.ceil(ms / SECOND))} sec`;
  const minutes = Math.floor(ms / MINUTE);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${formatNumber(rest)} min`;
  return rest === 0
    ? `${formatNumber(hours)} h`
    : `${formatNumber(hours)} h ${formatNumber(rest)} min`;
}

/** "9 h left" on a daily ticket: coarse on purpose, the heading carries the exact countdown. */
export function dailyLeft(ms: number): string {
  if (ms <= 0) return 'Time is up';
  if (ms < HOUR) return `${formatNumber(Math.max(1, Math.floor(ms / MINUTE)))} min left`;
  return `${formatNumber(Math.floor(ms / HOUR))} h left`;
}

/** "4 days left" (today included), and "Ends tonight" on Sunday. */
export function weeklyLeft(daysLeft: number): string {
  return daysLeft > 1 ? `${pluralize(daysLeft, 'day')} left` : 'Ends tonight';
}

/** The first moment of next Monday, local time: when the weeklies rotate. */
export function weekEndsAt(now: number): number {
  const monday = parseDayKey(addDays(startOfWeek(dayKey(now)), 7));
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

/** The page slug: "Resets at midnight · 4 days left this week". */
export function headerSlug(daysLeft: number): string {
  const week = daysLeft > 1 ? `${pluralize(daysLeft, 'day')} left this week` : 'week ends tonight';
  return `Resets at midnight · ${week}`;
}

// ── What moves a quest forward ──────────────────────────────────────────────

/** Short captions for the actions quests name; a catalogue title is a whole sentence. */
const SHORT_ACTION: Readonly<Record<string, string>> = {
  'walk-cycle-instead-of-car': 'Walked or cycled',
  'ebike-escooter-instead-of-car': 'E-bike or scooter',
  'bus-instead-of-car': 'Took the bus',
  'train-metro-instead-of-car': 'Train or metro',
  carpool: 'Shared the ride',
  'car-free-day': 'Car-free day',
  'work-from-home-day': 'Worked from home',
  'train-instead-of-short-flight-km': 'Train, not plane',
  'train-instead-of-short-flight-trip': 'Train, not plane',
  'plant-based-meal': 'Plant-based meal',
  'plant-based-instead-of-beef': 'Plants, not beef',
  'chicken-instead-of-beef': 'Chicken, not beef',
  'vegetarian-day': 'Vegetarian day',
  'vegan-day': 'Plant-based day',
  'food-waste-avoided': 'Saved food',
  'meal-saved-from-waste': 'Rescued a meal',
  'thermostat-down-1c': 'Heating down 1 °C',
  'ac-up-1c': 'AC up 1 °C',
  'line-dry-instead-of-tumble': 'Air-dried a load',
  'standby-off': 'Standby off',
  'shorter-shower': 'Shorter shower',
  'hot-water-saved': 'Saved hot water',
  'tap-off-while-brushing': 'Tap off',
  'wash-30-instead-of-40': 'Washed at 30 °C',
  'wash-cold-instead-of-40': 'Washed cold',
  'second-hand-tshirt': 'Second-hand top',
  'second-hand-jeans': 'Second-hand jeans',
  'repair-instead-of-replace': 'Repaired it',
  'borrow-instead-of-buy': 'Borrowed it',
  'pass-it-on': 'Passed it on',
  'recycle-aluminium-can': 'Recycled cans',
  'recycle-glass-bottle': 'Recycled glass',
  'recycle-plastic-bottle': 'Recycled plastic',
  'recycle-paper': 'Recycled paper',
  'compost-food-waste': 'Composted scraps',
  'refuse-single-use-bag': 'Own bag',
  'refuse-single-use-cup': 'Own cup',
  'refuse-single-use-bottle': 'Refilled bottle',
  'plant-a-tree': 'Planted a tree',
  'tend-plants': 'Tended plants',
  'help-wildlife': 'Helped wildlife',
  'litter-pick': 'Picked up litter',
  'habitat-volunteering': 'Volunteered',
  'climate-conversation': 'Climate chat',
  'civic-action': 'Civic action',
};

export interface ActionLink {
  id: string;
  /** Short caption for the chip. */
  label: string;
  /** The catalogue's full sentence, for the accessible name. */
  title: string;
  category: CategoryId;
  /** Opens the Log sheet prefilled; it never logs by itself. */
  href: string;
}

/** One next step for a quest that no single catalogue action advances. */
export type QuestStep =
  { kind: 'link'; label: string; href: string } | { kind: 'tab'; label: string; tab: QuestTab };

export interface QuestHint {
  actions: ActionLink[];
  step: QuestStep | null;
  /** A kind sentence when today can no longer finish it. */
  note: string | null;
}

export interface HintContext {
  /** Actions the user hid ("Not for me"): never suggested. */
  hidden: ReadonlySet<string>;
  checkedInToday: boolean;
  /** Local hour of day, 0–24. */
  hour: number;
  treeName: string;
}

function actionLinks(
  ids: readonly string[],
  hidden: ReadonlySet<string>,
  qty?: number,
): ActionLink[] {
  return ids.flatMap((id) => {
    const action = ACTION_BY_ID.get(id);
    if (!action || hidden.has(id)) return [];
    return [
      {
        id,
        label: SHORT_ACTION[id] ?? action.title,
        title: action.title,
        category: action.category,
        href: logLink(id, qty, 'quest'),
      },
    ];
  });
}

const LOG_STEP: QuestStep = { kind: 'link', label: 'Log an action', href: ROUTES.log };

function stepFor(condition: QuestCondition, context: HintContext): QuestStep | null {
  switch (condition.kind) {
    case 'acts':
    case 'units':
      return condition.actions === '*' ? LOG_STEP : null;
    case 'categoryActs':
      return null;
    case 'categories':
    case 'ring':
      return LOG_STEP;
    case 'checkIn':
    case 'checkInBefore':
      return context.checkedInToday
        ? null
        : { kind: 'link', label: `Water ${context.treeName}`, href: ROUTES.today };
    case 'break':
      return { kind: 'link', label: 'Start a break', href: TOUCH_GRASS_LINK };
    case 'learnOpen':
      return { kind: 'link', label: 'Open Learn', href: ROUTES.learn };
    case 'post':
      return { kind: 'link', label: 'Write a note', href: ROUTES.community };
    case 'coach':
      return { kind: 'link', label: 'Ask Moss', href: ROUTES.coach };
    case 'cleanSweep':
      return { kind: 'tab', label: "See today's three", tab: 'daily' };
    case 'days':
      return stepFor(condition.of, context);
    case 'all':
    case 'any': {
      for (const part of condition.of) {
        const step = stepFor(part, context);
        if (step) return step;
      }
      return null;
    }
  }
}

/** The condition's morning window has closed for today (Early bird after 10:00). */
function closedWindow(condition: QuestCondition, context: HintContext): number | null {
  if (condition.kind === 'checkInBefore') {
    return context.checkedInToday || context.hour >= condition.hour ? condition.hour : null;
  }
  if (condition.kind === 'all') {
    for (const part of condition.of) {
      const hour = closedWindow(part, context);
      if (hour !== null) return hour;
    }
  }
  return null;
}

const questCondition = (quest: Pick<QuestView, 'id' | 'kind'>): QuestCondition | undefined =>
  (quest.kind === 'daily' ? DAILY_QUEST_BY_ID : WEEKLY_QUEST_BY_ID).get(quest.id)?.condition;

/** What to tap to move an unfinished quest forward: the qualifying actions, or one next step. */
export function questHint(quest: QuestView, context: HintContext): QuestHint {
  const condition = questCondition(quest);
  if (!condition || quest.claimed || quest.progress.done) {
    return { actions: [], step: null, note: null };
  }
  // A distance quest prefills what is still missing, so one log can finish it.
  const remaining =
    condition.kind === 'units'
      ? Math.max(1, Math.ceil(quest.progress.target - quest.progress.current))
      : undefined;
  const actions = actionLinks(quest.actions, context.hidden, remaining);
  const window = quest.kind === 'daily' ? closedWindow(condition, context) : null;
  const note =
    window === null
      ? null
      : `That window closed at ${String(window).padStart(2, '0')}:00. Swap it, or catch it tomorrow.`;
  return {
    actions,
    step: note === null && actions.length === 0 ? stepFor(condition, context) : null,
    note,
  };
}

// ── Claimed while away ──────────────────────────────────────────────────────

export interface AutoClaim {
  questId: string;
  title: string;
  xp: number;
}

/** Quests of an ended period that were finished but not claimed, and settled today. */
export function autoClaimsToday(
  claims: readonly QuestClaim[],
  kind: 'daily' | 'weekly',
  today: DayKey,
): AutoClaim[] {
  const titles = kind === 'daily' ? DAILY_QUEST_BY_ID : WEEKLY_QUEST_BY_ID;
  return claims
    .filter((claim) => claim.auto && claim.kind === kind && dayKey(claim.ts) === today)
    .map((claim) => ({
      questId: claim.questId,
      title: titles.get(claim.questId)?.title ?? 'A finished quest',
      xp: claim.xp,
    }));
}

const AUTO_CLAIM_LIMIT = 3;

/** "Claimed for you while you were away: Cold snap, +40 XP." */
export function autoClaimSentence(items: readonly AutoClaim[]): string {
  if (items.length === 0) return '';
  const shown = items
    .slice(0, AUTO_CLAIM_LIMIT)
    .map((item) => `${item.title}, ${xpReward(item.xp)}`);
  const rest = items.length - shown.length;
  const total = items.reduce((sum, item) => sum + item.xp, 0);
  const tail = rest > 0 ? ` · and ${formatNumber(rest)} more. ${xpReward(total)} in all.` : '.';
  return `Claimed for you while you were away: ${shown.join(' · ')}${tail}`;
}

// ── Epics ───────────────────────────────────────────────────────────────────

/** Upgrades whose effect lasts for years: XP only, their kilograms are never added to a total. */
const XP_ONLY_EPICS: ReadonlySet<string> = new Set(['e_energy_checkup', 'e_green_power']);

export const isXpOnlyEpic = (epicId: string): boolean => XP_ONLY_EPICS.has(epicId);

const requirementActions = (epic: EpicDef): ActionSet =>
  epic.requirement && 'actions' in epic.requirement ? epic.requirement.actions : [];

/** The catalogue actions that feed an epic's automatic requirement. */
export function epicActionLinks(epic: EpicDef, hidden: ReadonlySet<string>): ActionLink[] {
  const actions = requirementActions(epic);
  return actions === '*' ? [] : actionLinks(actions, hidden);
}

/** The user has begun: a logged step, a ticked job or a written line. */
export function epicStarted(status: EpicStatus): boolean {
  return (
    (status.epic.requirement !== null && status.progress.current > 0) ||
    status.saved.checklist.some(Boolean) ||
    status.saved.note.trim().length > 0
  );
}

export type EpicGap = 'requirement' | 'checklist' | 'note' | 'form' | 'cooldown';

/** What still stands between a self-attested epic and its confirmation; `null` when nothing does. */
export function epicGap(status: EpicStatus, note = status.saved.note): EpicGap | null {
  if (!status.selfAttested || status.claimed) return null;
  if (!status.progress.done) return 'requirement';
  const attestation = status.epic.attestation;
  if (
    attestation?.kind === 'checklist' &&
    !attestation.items.every((_, index) => status.saved.checklist[index] === true)
  ) {
    return 'checklist';
  }
  if (attestation?.kind === 'note' && !note.trim()) return 'note';
  if (
    attestation?.kind === 'form' &&
    formLines(note, attestation.fields.length).some((line) => !line.trim())
  ) {
    return 'form';
  }
  return status.cooldownDays > 0 ? 'cooldown' : null;
}

/**
 * The jobs a self-attested epic asks for before the hold: its logged requirement (one step)
 * plus every checklist item, form line or required note. `total` 0 = nothing but your word.
 */
export function epicSteps(
  status: EpicStatus,
  note = status.saved.note,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  if (status.epic.requirement) {
    total += 1;
    if (status.progress.done) done += 1;
  }
  const attestation = status.epic.attestation;
  if (attestation?.kind === 'checklist') {
    total += attestation.items.length;
    done += attestation.items.filter((_, index) => status.saved.checklist[index] === true).length;
  } else if (attestation?.kind === 'form') {
    total += attestation.fields.length;
    done += formLines(note, attestation.fields.length).filter((line) => line.trim()).length;
  } else if (attestation?.kind === 'note') {
    total += 1;
    if (note.trim()) done += 1;
  }
  return { done, total };
}

export interface EpicGroups {
  /** Tracked from logs and finished: one tear away. */
  ready: EpicStatus[];
  /** Run on the user's word: checklist, note, hold-to-confirm. */
  onYourWord: EpicStatus[];
  /** Tracked from logs, still filling. */
  fromLogs: EpicStatus[];
  /** Claimed, newest first. */
  finished: EpicStatus[];
}

const openRank = (status: EpicStatus): number => {
  if (status.pinned) return 0;
  if (status.claimable || status.claimed) return 1;
  if (epicStarted(status)) return 2;
  return 3;
};

const byRelevance = (epics: readonly EpicStatus[]): EpicStatus[] =>
  epics
    .map((status, index) => ({ status, index }))
    .sort((a, b) => openRank(a.status) - openRank(b.status) || a.index - b.index)
    .map((entry) => entry.status);

/**
 * Sorts the epics into the page's sections. An epic claimed during this visit (`claimedHere`)
 * stays where it was, stamped, instead of jumping to the bottom of the page under the
 * user's thumb; it joins "Finished" on the next visit.
 */
export function groupEpics(
  epics: readonly EpicStatus[],
  claimedHere: ReadonlySet<string> = new Set(),
): EpicGroups {
  const settled = (status: EpicStatus) => status.claimed && !claimedHere.has(status.epic.id);
  const live = epics.filter((status) => !settled(status));
  const isReady = (status: EpicStatus) =>
    !status.selfAttested && (status.claimable || status.claimed);
  return {
    ready: live.filter(isReady),
    onYourWord: byRelevance(live.filter((status) => status.selfAttested)),
    fromLogs: byRelevance(live.filter((status) => !status.selfAttested && !isReady(status))),
    finished: epics
      .filter(settled)
      .sort((a, b) => (b.saved.claimedTs ?? 0) - (a.saved.claimedTs ?? 0)),
  };
}

/** One next step for an automatic epic that no catalogue action feeds. */
export function epicStep(epic: EpicDef): QuestStep | null {
  if (epic.requirement?.kind === 'lessonsPassed') {
    return { kind: 'link', label: 'Open Learn', href: ROUTES.learn };
  }
  if (epic.requirement?.kind === 'rings') {
    return { kind: 'link', label: 'See today', href: ROUTES.today };
  }
  return null;
}

/** The lines of a form epic ("top item and its swap" × 3), stored as one note, one line each. */
export function formLines(note: string, count: number): string[] {
  const lines = note.split('\n');
  return Array.from({ length: count }, (_, index) => lines[index] ?? '');
}

export function withFormLine(note: string, count: number, index: number, value: string): string {
  const lines = formLines(note, count);
  lines[index] = value.replace(/\r?\n/g, ' ');
  return lines.join('\n');
}

/** An epic's anchor on the page, e.g. for the pinned epic's link from Today. */
export const epicAnchor = (epicId: string): string => `epic-${epicId}`;

/** Whether an id names an epic: guards the `#epic-…` deep link. */
export const isEpicId = (epicId: string): boolean => EPIC_BY_ID.has(epicId);
