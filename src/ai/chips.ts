/**
 * The coach's "log this" chip protocol (product spec 8.5). The model ends a
 * message with tokens such as `[[log:eat_veg_meal]]`, `[[log:move_bike_trip?qty=5]]`,
 * `[[learn:the-blanket]]`, `[[break:10]]` or `[[quest:d_plant_day]]`.
 *
 * `parseCoachText` turns text into segments the UI can render: plain text and
 * validated chips. While a message is still streaming, a half-received token
 * is hidden, never shown as raw syntax. Nothing here logs anything: a chip only
 * opens the normal Log sheet, prefilled.
 */

export type ChipSegment =
  | { type: 'chip'; kind: 'log'; actionId: string; quantity: number | null }
  | { type: 'chip'; kind: 'learn'; slug: string }
  | { type: 'chip'; kind: 'break'; minutes: number }
  | { type: 'chip'; kind: 'quest'; questId: string };

export type TextSegment = { type: 'text'; text: string };
export type CoachSegment = TextSegment | ChipSegment;

export interface ChipOptions {
  /** Loggable action ids. A log chip whose id is not here is dropped. */
  actions?: Iterable<string>;
  /** When given, learn chips must name one of these slugs. */
  lessonSlugs?: Iterable<string>;
  /** When given, quest chips must name one of these ids. */
  questIds?: Iterable<string>;
  /** Largest allowed quantity per action; a chip above it is dropped. */
  quantityLimit?: (actionId: string) => number | undefined;
  /** True while the message is still arriving: hide an unfinished token. */
  streaming?: boolean;
  /** Chips kept per message. The spec allows three. */
  maxChips?: number;
}

const ID = '[A-Za-z0-9][A-Za-z0-9_.:-]{0,47}';
const LOG = new RegExp(`^log:(${ID})(?:\\?qty=(\\d+(?:\\.\\d+)?))?$`);
const LEARN = new RegExp(`^learn:(${ID})$`);
const QUEST = new RegExp(`^quest:(${ID})$`);
const BREAK = /^break:(\d{1,3})$/;

/** A token longer than this is prose that happens to contain brackets, not a chip. */
const MAX_TOKEN_CHARS = 120;
const CHIP_PREFIX = /^\[\[(log|learn|break|quest)\b/;
const CHIP_ATTEMPT = /^\s*(log|learn|break|quest)\s*:/i;

function toSet(values: Iterable<string> | undefined): ReadonlySet<string> | null {
  return values === undefined ? null : new Set(values);
}

function parseToken(inner: string, options: ChipOptions, sets: Sets): ChipSegment | null {
  const token = inner.trim();
  const log = LOG.exec(token);
  if (log) {
    const actionId = log[1] ?? '';
    if (!sets.actions.has(actionId)) return null;
    let quantity: number | null = null;
    if (log[2] !== undefined) {
      quantity = Number(log[2]);
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      const limit = options.quantityLimit?.(actionId);
      if (limit !== undefined && quantity > limit) return null;
    }
    return { type: 'chip', kind: 'log', actionId, quantity };
  }
  const learn = LEARN.exec(token);
  if (learn) {
    const slug = learn[1] ?? '';
    return sets.lessons && !sets.lessons.has(slug) ? null : { type: 'chip', kind: 'learn', slug };
  }
  const quest = QUEST.exec(token);
  if (quest) {
    const questId = quest[1] ?? '';
    return sets.quests && !sets.quests.has(questId)
      ? null
      : { type: 'chip', kind: 'quest', questId };
  }
  const rest = BREAK.exec(token);
  if (rest) {
    const minutes = Number(rest[1]);
    return minutes >= 1 && minutes <= 60 ? { type: 'chip', kind: 'break', minutes } : null;
  }
  return null;
}

interface Sets {
  actions: ReadonlySet<string>;
  lessons: ReadonlySet<string> | null;
  quests: ReadonlySet<string> | null;
}

function sameChip(a: ChipSegment, b: ChipSegment): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function parseCoachText(text: string, options: ChipOptions = {}): CoachSegment[] {
  const sets: Sets = {
    actions: toSet(options.actions) ?? new Set(),
    lessons: toSet(options.lessonSlugs),
    quests: toSet(options.questIds),
  };
  const maxChips = options.maxChips ?? 3;
  const segments: CoachSegment[] = [];
  let chips = 0;
  let plain = '';

  const flushPlain = (): void => {
    if (plain !== '') segments.push({ type: 'text', text: plain });
    plain = '';
  };

  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('[[', i);
    if (open < 0) {
      plain += text.slice(i);
      break;
    }
    plain += text.slice(i, open);
    const close = text.indexOf(']]', open + 2);
    const tooLong =
      close < 0 ? text.length - open > MAX_TOKEN_CHARS : close - open > MAX_TOKEN_CHARS;
    if (close < 0 || tooLong) {
      if (close < 0 && !tooLong) {
        // Unfinished: hide it while streaming. Once final, drop it only if it was a chip attempt.
        if (options.streaming || CHIP_PREFIX.test(text.slice(open))) {
          break;
        }
      }
      plain += '[[';
      i = open + 2;
      continue;
    }
    const inner = text.slice(open + 2, close);
    const chip = parseToken(inner, options, sets);
    i = close + 2;
    if (!chip) {
      // A rejected chip attempt vanishes; ordinary double brackets stay as written.
      if (!CHIP_ATTEMPT.test(inner)) plain += `[[${inner}]]`;
      continue;
    }
    const duplicate = segments.some((s) => s.type === 'chip' && sameChip(s, chip));
    if (duplicate || chips >= maxChips) continue;
    flushPlain();
    segments.push(chip);
    chips += 1;
  }
  // A lone "[" at the very end may be the first half of "[[".
  if (options.streaming && plain.endsWith('[') && !plain.endsWith('[[')) plain = plain.slice(0, -1);
  flushPlain();
  return tidy(segments);
}

/** Removes the blank space chips leave behind and drops empty text. */
function tidy(segments: CoachSegment[]): CoachSegment[] {
  const out: CoachSegment[] = [];
  segments.forEach((segment, index) => {
    if (segment.type === 'chip') {
      out.push(segment);
      return;
    }
    let text = segment.text;
    if (segments[index + 1]?.type === 'chip') text = text.trimEnd();
    if (segments[index - 1]?.type === 'chip') text = text.trimStart();
    if (index === 0) text = text.trimStart();
    if (index === segments.length - 1) text = text.trimEnd();
    if (text.trim() !== '') out.push({ type: 'text', text });
  });
  return out;
}

/** The message with every chip token removed, for copying or reading aloud. */
export function stripChips(text: string): string {
  return parseCoachText(text, { actions: [], maxChips: 0 })
    .map((segment) => (segment.type === 'text' ? segment.text : ''))
    .join('')
    .trim();
}

export function chipKey(chip: ChipSegment): string {
  switch (chip.kind) {
    case 'log':
      return `log:${chip.actionId}:${chip.quantity ?? ''}`;
    case 'learn':
      return `learn:${chip.slug}`;
    case 'break':
      return `break:${chip.minutes}`;
    case 'quest':
      return `quest:${chip.questId}`;
  }
}

/**
 * The route a chip opens. Log chips use the shared deep-link form from the
 * spec (`/log?a=&q=&src=coach`) so the Log page can prefill the sheet and tag
 * the entry. The route map lives in `app`, which `ai` may not import, so the
 * paths are repeated here.
 */
export function chipHref(chip: ChipSegment): string {
  switch (chip.kind) {
    case 'log': {
      const query = new URLSearchParams({ a: chip.actionId, src: 'coach' });
      if (chip.quantity !== null) query.set('q', String(chip.quantity));
      return `/log?${query.toString()}`;
    }
    case 'learn':
      return `/learn/${encodeURIComponent(chip.slug)}`;
    case 'quest':
      return '/quests';
    case 'break':
      // The break timer is a Today feature; the page that renders chips should start it directly.
      return '/today';
  }
}
