/**
 * The working context of one mutation. A transaction copies the state once, lets rule
 * modules change the copy through the helpers here, and collects the events they cause.
 *
 * Copy discipline: the small structs of the state (profile, tree, streak, …) are cloned
 * up front and may be assigned to directly. Collections (logs, marks, days, claims, …)
 * are shared with the previous state and must be *replaced*, never mutated in place.
 */
import { diffDays, type DayKey } from '@/lib/dates';
import { ACTIVITY_MAX } from './economy';
import type { GameEvent, XpReason } from './events';
import type { GameState, Notice, NoticeKind } from './types';

export interface EngineOptions {
  /** Limits which badges can be earned. Used by the simulation harness. */
  badgeFilter?: (badgeId: string) => boolean;
  /** `false` skips quest rotation, auto-claims and challenge tracking (simulation, legacy replay). */
  quests?: boolean;
  /** `false` queues no one-time notices (legacy replay: one summary instead of many messages). */
  notices?: boolean;
}

export interface Ctx {
  /** The draft being built. */
  s: GameState;
  /** The state the transaction started from. Never changed. */
  readonly before: GameState;
  readonly now: number;
  /** The day this transaction's events belong to; never earlier than `clock.today`. */
  today: DayKey;
  events: GameEvent[];
  readonly options: EngineOptions;
}

const SMALL_STRUCTS = [
  'profile',
  'onboarding',
  'settings',
  'clock',
  'tree',
  'streak',
  'rain',
  'quests',
  'learn',
  'baseline',
  'challenge',
  'seen',
] as const satisfies readonly (keyof GameState)[];

export function beginCtx(state: GameState, now: number, options: EngineOptions = {}): Ctx {
  const draft: GameState = { ...state };
  for (const key of SMALL_STRUCTS) {
    // Each of these is a plain object of scalars and replaceable collections.
    (draft as unknown as Record<string, unknown>)[key] = { ...state[key] };
  }
  return { s: draft, before: state, now, today: state.clock.today, events: [], options };
}

function sameShallow(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => left[key] === right[key]);
}

/**
 * Finishes a draft with structural sharing: slices that did not change keep their old
 * reference, and a draft without any change *is* the previous state.
 */
export function sealState(ctx: Ctx): GameState {
  const draft = ctx.s as unknown as Record<string, unknown>;
  const before = ctx.before as unknown as Record<string, unknown>;
  let changed = false;
  for (const key of Object.keys(draft)) {
    if (sameShallow(draft[key], before[key])) draft[key] = before[key];
    else changed = true;
  }
  return changed ? ctx.s : ctx.before;
}

/** Adds (or, with a negative amount, takes back) XP. XP never goes below zero. */
export function grantXp(ctx: Ctx, amount: number, reason: XpReason): number {
  const whole = Math.trunc(amount);
  if (whole === 0) return 0;
  const next = Math.max(0, ctx.s.xp + whole);
  const applied = next - ctx.s.xp;
  ctx.s.xp = next;
  if (applied > 0) ctx.events.push({ type: 'xp-gained', amount: applied, reason, total: next });
  if (applied < 0) ctx.events.push({ type: 'xp-removed', amount: -applied, reason, total: next });
  return applied;
}

/** Adds or removes growth points. The `growth` event is emitted once, when the transaction ends. */
export function grantGp(ctx: Ctx, amount: number): void {
  ctx.s.tree.gp = Math.max(0, ctx.s.tree.gp + Math.trunc(amount));
}

/** "Day 9" for a day, counted from planting. */
export function dayNumber(state: Pick<GameState, 'profile'>, day: DayKey): number {
  return Math.max(1, diffDays(state.profile.plantedDay, day) + 1);
}

/** Writes a line to the activity and Island log, newest first, capped. */
export function writeActivity(ctx: Ctx, kind: string, text: string): void {
  const line = `Day ${dayNumber(ctx.s, ctx.today)} · ${text.replaceAll('{Tree}', ctx.s.profile.treeName)}`;
  ctx.s.activity = [{ ts: ctx.now, day: ctx.today, kind, text: line }, ...ctx.s.activity].slice(
    0,
    ACTIVITY_MAX,
  );
}

/** Queues a one-time message. A notice id that was already shown or queued is ignored. */
export function queueNotice(ctx: Ctx, kind: NoticeKind, key: string, data: Notice['data']): void {
  if (ctx.options.notices === false) return;
  const id = `${kind}:${key}`;
  if (ctx.s.seen.messages.includes(id) || ctx.s.notices.some((notice) => notice.id === id)) return;
  const notice: Notice = { id, kind, ts: ctx.now, day: ctx.today, data };
  ctx.s.notices = [...ctx.s.notices, notice];
  ctx.events.push({ type: 'notice', notice });
}
