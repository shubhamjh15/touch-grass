/**
 * Community in local mode (product spec section 9): a private journal, marks the user
 * leaves on this device, and stateless challenge links. Nothing here imitates other
 * people: there are no counters, and a challenge lives entirely in a URL fragment that
 * each side tracks for itself.
 */
import { CATEGORY_BY_ID, CATEGORY_IDS, type CategoryId } from '@/data/catalogue';
import { ACTIVE, PLANT, SHARED, type QuestCondition } from '@/data/quests';
import { crc32, fromBase64Url, toBase64Url } from '@/lib/codec';
import {
  addDays,
  dayRange,
  diffDays,
  parseDayKey,
  dayKey,
  weekKey,
  type DayKey,
} from '@/lib/dates';
import { formatCo2Estimate, formatDecimal } from '@/lib/format';
import { grantXp, queueNotice, writeActivity, type Ctx } from './ctx';
import {
  CHALLENGE_ACCEPT_DAYS,
  CHALLENGE_DAYS,
  CHALLENGE_LINK_MAX_CHARS,
  JOURNAL_MAX_CHARS,
  JOURNAL_REWARD_MIN_CHARS,
  NAME_MAX,
  TREE_NAME_MAX,
  XP_CHALLENGE,
  XP_JOURNAL_NOTE,
} from './economy';
import { logsOn } from './indexes';
import { evaluateCondition, type QuestProgress } from './quests';
import { isOnboarded } from './state';
import type { ChallengeState, GameState, JournalNote, Species } from './types';

// ── Journal ─────────────────────────────────────────────────────────────────

export const JOURNAL_TAGS = ['win', 'wobble', 'idea', 'question', 'touch-grass'] as const;
export const JOURNAL_PROMPT_COUNT = 12;

const ALLOWED_TAGS = new Set<string>([...JOURNAL_TAGS, ...CATEGORY_IDS]);

export function journalTagLabel(tag: string): string {
  if (tag in CATEGORY_BY_ID) return CATEGORY_BY_ID[tag as CategoryId].label;
  if (tag === 'touch-grass') return 'Touch Grass';
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

/** Which of the twelve weekly prompts seeds the composer this week. */
export function journalPromptIndex(day: DayKey): number {
  const weeks = Math.floor(diffDays('2025-12-29', day) / 7);
  return ((weeks % JOURNAL_PROMPT_COUNT) + JOURNAL_PROMPT_COUNT) % JOURNAL_PROMPT_COUNT;
}

const LINE_FEED = 10;

/** Drops control characters. With `keepLines` line breaks survive as line feeds; otherwise as spaces. */
function stripControl(text: string, keepLines: boolean): string {
  let out = '';
  for (const char of text.replace(/\r\n?/g, '\n')) {
    const code = char.codePointAt(0) ?? 0;
    if (code === LINE_FEED) out += keepLines ? '\n' : ' ';
    else if (code < 32 || code === 127) out += keepLines ? '' : ' ';
    else out += char;
  }
  return out;
}

function cleanText(text: string, max: number): string {
  return stripControl(text, true).trim().slice(0, max);
}

function cleanTag(tag: string | null | undefined): string | null {
  return tag && ALLOWED_TAGS.has(tag) ? tag : null;
}

/** "Today: 🥗 ×2 · 🚲 5 km · ≈ 2.1 kg", generated from the day's logs; `null` on an empty day. */
export function todayAttachment(state: Pick<GameState, 'logs'>, day: DayKey): string | null {
  const logs = logsOn(state.logs, day);
  if (logs.length === 0) return null;
  const byAction = new Map<
    string,
    { emoji: string; qty: number; unit: string; counted: boolean }
  >();
  let kg = 0;
  for (const log of logs) {
    const key = `${log.actionId}:${log.title}`;
    const entry = byAction.get(key) ?? {
      emoji: log.emoji,
      qty: 0,
      unit: log.unit,
      counted: ['km', 'kg', 'litre', 'minute', 'hour'].includes(log.unit),
    };
    entry.qty += log.qty;
    byAction.set(key, entry);
    if (log.estimate === 'factor') kg += log.co2eKg ?? 0;
  }
  const parts = [...byAction.values()].slice(0, 5).map((entry) => {
    const amount = formatDecimal(entry.qty, 2);
    return entry.counted ? `${entry.emoji} ${amount} ${entry.unit}` : `${entry.emoji} ×${amount}`;
  });
  if (kg > 0) parts.push(`≈ ${formatCo2Estimate(kg)}`);
  return `Today: ${parts.join(' · ')}`;
}

function journalRewardId(day: DayKey): string {
  return `journal-xp:${day}`;
}

export type PostResult =
  { ok: true; note: JournalNote; rewarded: boolean } | { ok: false; reason: 'empty' | 'not-found' };

export interface PostInput {
  text: string;
  tag?: string | null;
  /** Attach the generated "Today: …" line. */
  attachToday?: boolean;
}

/** Writes a journal note. The first note of 20 or more characters in a day pays 5 XP. */
export function addPost(ctx: Ctx, input: PostInput): PostResult {
  const s = ctx.s;
  const text = cleanText(input.text, JOURNAL_MAX_CHARS);
  if (text.length === 0) return { ok: false, reason: 'empty' };
  const note: JournalNote = {
    id: `n${ctx.now.toString(36)}${s.journal.length.toString(36)}`,
    ts: ctx.now,
    day: ctx.today,
    text,
    tag: cleanTag(input.tag),
    attachment: input.attachToday ? todayAttachment(s, ctx.today) : null,
    editedTs: null,
  };
  s.journal = [...s.journal, note];

  const record = s.days[ctx.today];
  const marker = journalRewardId(ctx.today);
  const alreadyPaid = record?.journalRewarded === true || s.seen.messages.includes(marker);
  const rewarded = isOnboarded(s) && !alreadyPaid && text.length >= JOURNAL_REWARD_MIN_CHARS;
  if (rewarded) {
    grantXp(ctx, XP_JOURNAL_NOTE, 'journal');
    if (record) s.days = { ...s.days, [ctx.today]: { ...record, journalRewarded: true } };
    // A note can come before the day's check-in; the marker keeps the reward to one a day.
    s.seen.messages = [...s.seen.messages, marker].slice(-300);
  }
  ctx.events.push({ type: 'post-added', noteId: note.id, rewarded });
  return { ok: true, note, rewarded };
}

export function editPost(
  ctx: Ctx,
  noteId: string,
  patch: { text?: string; tag?: string | null },
): PostResult {
  const s = ctx.s;
  const current = s.journal.find((note) => note.id === noteId);
  if (!current) return { ok: false, reason: 'not-found' };
  const text = patch.text === undefined ? current.text : cleanText(patch.text, JOURNAL_MAX_CHARS);
  if (text.length === 0) return { ok: false, reason: 'empty' };
  const note: JournalNote = {
    ...current,
    text,
    tag: patch.tag === undefined ? current.tag : cleanTag(patch.tag),
    editedTs: ctx.now,
  };
  s.journal = s.journal.map((entry) => (entry.id === noteId ? note : entry));
  ctx.events.push({ type: 'post-edited', noteId });
  return { ok: true, note, rewarded: false };
}

export function deletePost(ctx: Ctx, noteId: string): boolean {
  const next = ctx.s.journal.filter((note) => note.id !== noteId);
  if (next.length === ctx.s.journal.length) return false;
  ctx.s.journal = next;
  ctx.events.push({ type: 'post-deleted', noteId });
  return true;
}

export function clearJournal(ctx: Ctx): number {
  const count = ctx.s.journal.length;
  if (count > 0) ctx.s.journal = [];
  return count;
}

/** Notes matching a search text and a tag, newest first. */
export function searchJournal(
  notes: readonly JournalNote[],
  query: string,
  tag: string | null = null,
): JournalNote[] {
  const needle = query.trim().toLowerCase();
  return notes
    .filter(
      (note) =>
        (tag === null || note.tag === tag) &&
        (needle === '' ||
          note.text.toLowerCase().includes(needle) ||
          (note.attachment ?? '').toLowerCase().includes(needle)),
    )
    .sort((a, b) => b.ts - a.ts);
}

/**
 * Toggles a mark the user leaves on something on this device, e.g. saving an editorial
 * post. Returns whether the mark is now set. These are never counts of other people.
 */
export function toggleReaction(ctx: Ctx, targetId: string, reaction: string): boolean {
  const target = targetId.trim().slice(0, 80);
  const kind = reaction.trim().slice(0, 24);
  if (!target || !kind) return false;
  const current = ctx.s.reactions[target] ?? [];
  const has = current.includes(kind);
  const next = has ? current.filter((item) => item !== kind) : [...current, kind].slice(-20);
  const reactions = { ...ctx.s.reactions };
  if (next.length === 0) delete reactions[target];
  else reactions[target] = next;
  ctx.s.reactions = reactions;
  return !has;
}

export function hasReaction(
  state: Pick<GameState, 'reactions'>,
  targetId: string,
  reaction: string,
): boolean {
  return state.reactions[targetId]?.includes(reaction) ?? false;
}

// ── Challenges ──────────────────────────────────────────────────────────────

export interface ChallengeTemplate {
  id: string;
  title: string;
  /** What the dare asks, completing "… dare you: ". */
  dare: (category: CategoryId | null) => string;
  target: number;
  unit: string;
  needsCategory: boolean;
  condition: (category: CategoryId | null) => QuestCondition;
}

export const CHALLENGE_TEMPLATES: readonly ChallengeTemplate[] = [
  {
    id: 'show_up_7',
    title: 'Show up 7 days running',
    dare: () => 'show up 7 days running',
    target: 7,
    unit: 'days',
    needsCategory: false,
    condition: () => ({ kind: 'days', of: { kind: 'checkIn' }, min: 7 }),
  },
  {
    id: 'rings_5',
    title: 'Five full rings',
    dare: () => 'five full rings in 7 days',
    target: 5,
    unit: 'full rings',
    needsCategory: false,
    condition: () => ({ kind: 'days', of: { kind: 'ring' }, min: 5 }),
  },
  {
    id: 'plates_10',
    title: 'Ten plant plates',
    dare: () => 'ten plant plates in 7 days',
    target: 10,
    unit: 'plant plates',
    needsCategory: false,
    condition: () => ({ kind: 'acts', actions: PLANT, min: 10 }),
  },
  {
    id: 'car_light_3',
    title: 'Three low-carbon travel days',
    dare: () => 'low-carbon trips on 3 of 7 days',
    target: 3,
    unit: 'days',
    needsCategory: false,
    condition: () => ({
      kind: 'days',
      of: { kind: 'acts', actions: [...ACTIVE, ...SHARED], min: 1 },
      min: 3,
    }),
  },
  {
    id: 'grass_3',
    title: 'Three Touch Grass breaks',
    dare: () => 'three Touch Grass breaks in 7 days',
    target: 3,
    unit: 'breaks',
    needsCategory: false,
    condition: () => ({ kind: 'break', minutes: 10, min: 3 }),
  },
  {
    id: 'cat_15',
    title: 'Fifteen in one category',
    dare: (category) =>
      `fifteen ${category ? CATEGORY_BY_ID[category].label : 'category'} actions in 7 days`,
    target: 15,
    unit: 'actions',
    needsCategory: true,
    condition: (category) => ({ kind: 'categoryActs', category: category ?? 'eat', min: 15 }),
  },
];

const TEMPLATE_BY_ID = new Map(CHALLENGE_TEMPLATES.map((template) => [template.id, template]));
const SPECIES_LIST = ['oak', 'cherry', 'pine'] as const satisfies readonly Species[];
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function challengeTemplate(id: string): ChallengeTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}

/** Payload v1 of a challenge link. Short keys keep the link compact. */
export interface ChallengePayload {
  v: 1;
  /** Template id. */
  k: string;
  /** The creator's start day. */
  s: DayKey;
  d: 7;
  /** Category, for the template that needs one. */
  c?: CategoryId;
  /** Creator's display name, only if they chose to include it. */
  n?: string;
  /** Creator's tree name. */
  t?: string;
  sp?: Species;
  /** Optional message, at most 80 characters. */
  m?: string;
}

export interface ChallengeResultPayload {
  v: 1;
  k: string;
  n?: string;
  done: number;
  of: number;
  /** The day the result was produced. */
  on: DayKey;
}

export type LinkError = 'damaged' | 'unknown-template' | 'too-long' | 'expired';

export const LINK_ERROR_COPY: Readonly<Record<LinkError, string>> = {
  damaged: 'This link looks damaged. Ask for a fresh one.',
  'unknown-template': 'This link looks damaged. Ask for a fresh one.',
  'too-long': 'This link looks damaged. Ask for a fresh one.',
  expired: 'This challenge has ended. Start your own?',
};

function isRealDay(value: unknown): value is DayKey {
  return (
    typeof value === 'string' && DAY_PATTERN.test(value) && dayKey(parseDayKey(value)) === value
  );
}

function cleanLine(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = stripControl(value, false).replace(/\s+/g, ' ').trim();
  return text.length > 0 && text.length <= max ? text : undefined;
}

/** Field order is fixed so both sides compute the same checksum. */
function canonicalChallenge(payload: ChallengePayload): Record<string, unknown> {
  const out: Record<string, unknown> = { v: 1, k: payload.k, s: payload.s, d: 7 };
  if (payload.c) out.c = payload.c;
  if (payload.n) out.n = payload.n;
  if (payload.t) out.t = payload.t;
  if (payload.sp) out.sp = payload.sp;
  if (payload.m) out.m = payload.m;
  return out;
}

function seal(fields: Record<string, unknown>): string {
  return toBase64Url(JSON.stringify({ ...fields, x: crc32(JSON.stringify(fields)) }));
}

function unseal(encoded: string): Record<string, unknown> | LinkError {
  if (encoded.length === 0 || encoded.length > CHALLENGE_LINK_MAX_CHARS) return 'too-long';
  const json = fromBase64Url(encoded);
  if (json === null) return 'damaged';
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return 'damaged';
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return 'damaged';
  const { x, ...fields } = parsed as Record<string, unknown>;
  if (typeof x !== 'number' || crc32(JSON.stringify(fields)) !== x) return 'damaged';
  return fields;
}

/** Encodes a challenge for the URL fragment. Returns `null` when it cannot fit in 300 characters. */
export function encodeChallenge(payload: ChallengePayload): string | null {
  const encoded = seal(canonicalChallenge(payload));
  return encoded.length <= CHALLENGE_LINK_MAX_CHARS ? encoded : null;
}

/** Validates and decodes a challenge link. Free-text fields come back as plain, cleaned text. */
export function decodeChallenge(
  encoded: string,
): { ok: true; payload: ChallengePayload } | { ok: false; error: LinkError } {
  const fields = unseal(encoded);
  if (typeof fields === 'string') return { ok: false, error: fields };
  if (fields.v !== 1 || fields.d !== 7 || !isRealDay(fields.s))
    return { ok: false, error: 'damaged' };
  if (typeof fields.k !== 'string') return { ok: false, error: 'damaged' };
  const template = TEMPLATE_BY_ID.get(fields.k);
  if (!template) return { ok: false, error: 'unknown-template' };
  const category = CATEGORY_IDS.find((id) => id === fields.c);
  if (template.needsCategory && !category) return { ok: false, error: 'damaged' };
  for (const [key, max] of [
    ['n', NAME_MAX],
    ['t', TREE_NAME_MAX],
    ['m', 80],
  ] as const) {
    if (fields[key] !== undefined && cleanLine(fields[key], max) === undefined) {
      return { ok: false, error: 'damaged' };
    }
  }
  const species = SPECIES_LIST.find((id) => id === fields.sp);
  if (fields.sp !== undefined && !species) return { ok: false, error: 'damaged' };
  const payload: ChallengePayload = { v: 1, k: template.id, s: fields.s, d: 7 };
  if (template.needsCategory && category) payload.c = category;
  const name = cleanLine(fields.n, NAME_MAX);
  const tree = cleanLine(fields.t, TREE_NAME_MAX);
  const message = cleanLine(fields.m, 80);
  if (name) payload.n = name;
  if (tree) payload.t = tree;
  if (species) payload.sp = species;
  if (message) payload.m = message;
  return { ok: true, payload };
}

export function encodeChallengeResult(payload: ChallengeResultPayload): string {
  const fields: Record<string, unknown> = { v: 1, k: payload.k };
  if (payload.n) fields.n = payload.n;
  fields.done = payload.done;
  fields.of = payload.of;
  fields.on = payload.on;
  return seal(fields);
}

export function decodeChallengeResult(
  encoded: string,
): { ok: true; payload: ChallengeResultPayload } | { ok: false; error: LinkError } {
  const fields = unseal(encoded);
  if (typeof fields === 'string') return { ok: false, error: fields };
  const { k, done, of, on } = fields;
  if (fields.v !== 1 || typeof k !== 'string' || !isRealDay(on))
    return { ok: false, error: 'damaged' };
  const template = TEMPLATE_BY_ID.get(k);
  if (!template) return { ok: false, error: 'unknown-template' };
  if (
    typeof done !== 'number' ||
    typeof of !== 'number' ||
    !Number.isInteger(done) ||
    !Number.isInteger(of) ||
    of !== template.target ||
    done < 0 ||
    done > of
  ) {
    return { ok: false, error: 'damaged' };
  }
  if (fields.n !== undefined && cleanLine(fields.n, NAME_MAX) === undefined) {
    return { ok: false, error: 'damaged' };
  }
  const payload: ChallengeResultPayload = { v: 1, k, done, of, on };
  const name = cleanLine(fields.n, NAME_MAX);
  if (name) payload.n = name;
  return { ok: true, payload };
}

/** The fragment of a challenge link: `#c=<payload>` for an invite, `#r=<payload>` for a result. */
export function parseChallengeHash(
  hash: string,
): { kind: 'invite' | 'result'; encoded: string } | null {
  const match = /^#?([cr])=([A-Za-z0-9_-]+)$/.exec(hash.trim());
  if (!match) return null;
  return { kind: match[1] === 'c' ? 'invite' : 'result', encoded: match[2] as string };
}

export function challengeLink(
  origin: string,
  encoded: string,
  kind: 'invite' | 'result' = 'invite',
): string {
  return `${origin.replace(/\/+$/, '')}/community#${kind === 'invite' ? 'c' : 'r'}=${encoded}`;
}

/** A link can be accepted until 14 days after its start day. */
export function isChallengeExpired(payload: ChallengePayload, today: DayKey): boolean {
  return today > addDays(payload.s, CHALLENGE_ACCEPT_DAYS);
}

/** "Maya and Juniper dare you: five full rings in 7 days". */
export function challengeInviteText(payload: ChallengePayload): string {
  const template = TEMPLATE_BY_ID.get(payload.k);
  const dare = template ? template.dare(payload.c ?? null) : 'a 7-day challenge';
  const who =
    payload.n && payload.t
      ? `${payload.n} and ${payload.t} dare`
      : payload.n
        ? `${payload.n} dares`
        : payload.t
          ? `${payload.t}'s keeper dares`
          : 'A friend dares';
  return `${who} you: ${dare}`;
}

/** "Maya finished: 5 / 5 full rings · self-reported". */
export function challengeResultText(payload: ChallengeResultPayload): string {
  const template = TEMPLATE_BY_ID.get(payload.k);
  const who = payload.n ?? 'Your friend';
  const verb = payload.done >= payload.of ? 'finished' : 'got to';
  return `${who} ${verb}: ${payload.done} / ${payload.of} ${template?.unit ?? ''} · self-reported`.replace(
    '  ',
    ' ',
  );
}

export interface ChallengeProgress extends QuestProgress {
  template: ChallengeTemplate;
  startDay: DayKey;
  endDay: DayKey;
  /** Days left including today; 0 once the window has passed. */
  daysLeft: number;
  ended: boolean;
}

type ChallengeFacts = Parameters<typeof evaluateCondition>[1];

export function challengeProgress(
  state: ChallengeFacts,
  active: ChallengeState,
  today: DayKey,
): ChallengeProgress | null {
  const template = TEMPLATE_BY_ID.get(active.templateId);
  if (!template) return null;
  const endDay = addDays(active.startDay, CHALLENGE_DAYS - 1);
  const result = evaluateCondition(
    template.condition(active.category),
    state,
    dayRange(active.startDay, endDay),
  );
  return {
    ...result,
    template,
    startDay: active.startDay,
    endDay,
    daysLeft: Math.max(0, diffDays(today, endDay) + 1),
    ended: today > endDay,
  };
}

export type ChallengeRefusal =
  'not-onboarded' | 'unknown-template' | 'needs-category' | 'busy' | LinkError;

export interface CreateChallengeInput {
  templateId: string;
  category?: CategoryId | null;
  message?: string;
  /** Put the display name in the link. Off by default: the name never leaves by accident. */
  includeName?: boolean;
}

function isBusy(state: GameState, today: DayKey): boolean {
  const active = state.challenge.active;
  if (!active || active.completedTs !== null) return false;
  return today <= addDays(active.startDay, CHALLENGE_DAYS - 1);
}

/** Starts a challenge as its creator and returns the payload to share. One at a time. */
export function createChallenge(
  ctx: Ctx,
  input: CreateChallengeInput,
):
  | { ok: true; encoded: string; payload: ChallengePayload }
  | { ok: false; reason: ChallengeRefusal } {
  const s = ctx.s;
  if (!isOnboarded(s)) return { ok: false, reason: 'not-onboarded' };
  const template = TEMPLATE_BY_ID.get(input.templateId);
  if (!template) return { ok: false, reason: 'unknown-template' };
  const category = template.needsCategory ? (input.category ?? null) : null;
  if (template.needsCategory && !category) return { ok: false, reason: 'needs-category' };
  if (isBusy(s, ctx.today)) return { ok: false, reason: 'busy' };

  const payload: ChallengePayload = { v: 1, k: template.id, s: ctx.today, d: 7 };
  if (category) payload.c = category;
  const name = input.includeName ? cleanLine(s.profile.name, NAME_MAX) : undefined;
  const tree = cleanLine(s.profile.treeName, TREE_NAME_MAX);
  const message = cleanLine((input.message ?? '').slice(0, 80), 80);
  if (name) payload.n = name;
  if (tree) payload.t = tree;
  payload.sp = s.profile.species;
  if (message) payload.m = message;
  const encoded = encodeChallenge(payload);
  if (!encoded) return { ok: false, reason: 'too-long' };

  closeActiveChallenge(ctx);
  s.challenge.active = {
    templateId: template.id,
    role: 'creator',
    startDay: ctx.today,
    days: 7,
    category,
    from: null,
    fromTree: null,
    message: message ?? null,
    completedTs: null,
  };
  ctx.events.push({ type: 'challenge-created', templateId: template.id });
  return { ok: true, encoded, payload };
}

/** Accepts a friend's challenge link. The friend's own seven days start today. */
export function acceptChallenge(
  ctx: Ctx,
  encoded: string,
): { ok: true; payload: ChallengePayload } | { ok: false; reason: ChallengeRefusal } {
  const s = ctx.s;
  if (!isOnboarded(s)) return { ok: false, reason: 'not-onboarded' };
  const decoded = decodeChallenge(encoded);
  if (!decoded.ok) return { ok: false, reason: decoded.error };
  if (isChallengeExpired(decoded.payload, ctx.today)) return { ok: false, reason: 'expired' };
  if (isBusy(s, ctx.today)) return { ok: false, reason: 'busy' };
  const { payload } = decoded;
  closeActiveChallenge(ctx);
  s.challenge.active = {
    templateId: payload.k,
    role: 'friend',
    startDay: ctx.today,
    days: 7,
    category: payload.c ?? null,
    from: payload.n ?? null,
    fromTree: payload.t ?? null,
    message: payload.m ?? null,
    completedTs: null,
  };
  ctx.events.push({ type: 'challenge-accepted', templateId: payload.k, from: payload.n ?? null });
  return { ok: true, payload };
}

/** Files an unfinished challenge in the history. A finished one is already there. */
function closeActiveChallenge(ctx: Ctx): void {
  const s = ctx.s;
  const active = s.challenge.active;
  if (!active) return;
  if (active.completedTs === null) {
    const state = challengeProgress(s, active, ctx.today);
    if (state) {
      s.challenge.history = [
        ...s.challenge.history,
        {
          templateId: active.templateId,
          startDay: active.startDay,
          done: state.current,
          of: state.target,
          success: false,
        },
      ];
    }
  }
  s.challenge.active = null;
}

/** Gives up or dismisses the current challenge card. No penalty. */
export function dismissChallenge(ctx: Ctx): boolean {
  if (!ctx.s.challenge.active) return false;
  closeActiveChallenge(ctx);
  return true;
}

/**
 * Runs at the end of every transaction: a challenge whose condition now holds is
 * completed (40 XP, once per week), and one whose seven days have passed is closed.
 */
export function reconcileChallenge(ctx: Ctx): void {
  const s = ctx.s;
  const active = s.challenge.active;
  if (!active || ctx.options.quests === false) return;
  const state = challengeProgress(s, active, ctx.today);
  if (!state) {
    s.challenge.active = null;
    return;
  }
  if (active.completedTs === null && state.done && !state.ended) {
    s.challenge.active = { ...active, completedTs: ctx.now };
    s.challenge.history = [
      ...s.challenge.history,
      {
        templateId: active.templateId,
        startDay: active.startDay,
        done: state.target,
        of: state.target,
        success: true,
      },
    ];
    const week = weekKey(ctx.today);
    let xp = 0;
    if (s.challenge.lastRewardWeek !== week) {
      s.challenge.lastRewardWeek = week;
      xp = XP_CHALLENGE;
      grantXp(ctx, xp, 'challenge');
    }
    writeActivity(ctx, 'challenge', `Challenge finished: ${state.template.title}.`);
    ctx.events.push({
      type: 'challenge-completed',
      templateId: active.templateId,
      done: state.target,
      of: state.target,
      xp,
    });
    return;
  }
  if (state.ended) {
    if (active.completedTs === null) {
      ctx.events.push({
        type: 'challenge-ended',
        templateId: active.templateId,
        done: state.current,
        of: state.target,
      });
      queueNotice(ctx, 'challenge-ended', active.startDay, {
        done: state.current,
        of: state.target,
        template: active.templateId,
      });
    }
    closeActiveChallenge(ctx);
  }
}

/** The result payload for the "swap result cards" link of a finished or ended challenge. */
export function challengeResultFor(
  state: GameState,
  today: DayKey,
  includeName: boolean,
): string | null {
  const active = state.challenge.active;
  const last = state.challenge.history[state.challenge.history.length - 1];
  const live = active ? challengeProgress(state, active, today) : null;
  const done = live ? live.current : last?.done;
  const of = live ? live.target : last?.of;
  const templateId = active?.templateId ?? last?.templateId;
  if (done === undefined || of === undefined || !templateId) return null;
  const payload: ChallengeResultPayload = { v: 1, k: templateId, done, of, on: today };
  const name = includeName ? cleanLine(state.profile.name, NAME_MAX) : undefined;
  if (name) payload.n = name;
  return encodeChallengeResult(payload);
}
