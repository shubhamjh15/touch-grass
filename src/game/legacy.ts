/**
 * Bringing real logs over from the legacy app (product spec section 13.3).
 *
 * The old app seeded its storage with invented numbers (4,250 XP, 45.2 kg, a 12-day
 * streak, three sample logs) and never recorded quantities. So nothing from
 * `userStats` is ever imported, the three seed logs are dropped, and real logs come
 * over without kilograms: they are replayed through today's rules for XP, growth and
 * rings, and read "Impact not quantified".
 */
import { ACTION_BY_ID, EVIDENCE_META } from '@/data/catalogue';
import { dayKey } from '@/lib/dates';
import { queueNotice, writeActivity, type Ctx } from './ctx';
import { transact } from './engine';
import { stageIndexOf } from './growth';
import { levelOf } from './levels';
import { saveLog, CUSTOM_ACTION_ID } from './logging';
import type { GameState } from './types';

export const LEGACY_KEYS = ['userStats', 'actionLogs'] as const;

/** The old app used `Date.now()` as the log id; anything earlier than this is not a real log. */
const LEGACY_EARLIEST_TS = new Date(2024, 0, 1).getTime();
const LEGACY_ID = /^\d{13}$/;

/** Old log names to today's catalogue. Unknown names become custom actions. */
const LEGACY_ACTIONS: Readonly<Record<string, string>> = {
  recycled: 'recycle-plastic-bottle',
  'veggie meal': 'plant-based-meal',
  'public transport': 'bus-instead-of-car',
  thrifting: 'second-hand-tshirt',
  'cold wash': 'wash-cold-instead-of-40',
  'refill bottle': 'refuse-single-use-bottle',
};

export interface LegacyLog {
  ts: number;
  /** The old app's action name, e.g. "Veggie Meal". */
  type: string;
}

export interface LegacyScan {
  /** `none`: no old keys. `seed-only`: only the invented sample data. `real`: logs worth bringing. */
  status: 'none' | 'seed-only' | 'real';
  logs: LegacyLog[];
  /** Entries that were not real logs (seed rows, malformed rows), dropped and counted. */
  skipped: number;
  /** The untouched old values, for the backup key. */
  raw: Record<string, string>;
}

function safely<T>(run: () => T): T | null {
  try {
    return run();
  } catch {
    return null;
  }
}

/** Reads the old app's storage. Never throws: unreadable data counts as nothing to bring. */
export function scanLegacy(read: (key: string) => string | null, now: number): LegacyScan {
  const raw: Record<string, string> = {};
  for (const key of LEGACY_KEYS) {
    const value = safely(() => read(key));
    if (typeof value === 'string') raw[key] = value;
  }
  if (Object.keys(raw).length === 0) return { status: 'none', logs: [], skipped: 0, raw };

  const entries = safely<unknown>(() => JSON.parse(raw.actionLogs ?? '[]'));
  const logs: LegacyLog[] = [];
  let skipped = 0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const record =
      typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
    const id = typeof record.id === 'string' ? record.id : '';
    const ts = LEGACY_ID.test(id) ? Number(id) : Number.NaN;
    const type = typeof record.type === 'string' ? record.type.trim() : '';
    if (Number.isFinite(ts) && ts >= LEGACY_EARLIEST_TS && ts <= now && type.length > 0) {
      logs.push({ ts, type: type.slice(0, 80) });
    } else {
      skipped += 1;
    }
  }
  logs.sort((a, b) => a.ts - b.ts);
  return { status: logs.length > 0 ? 'real' : 'seed-only', logs, skipped, raw };
}

function logLegacyEntry(ctx: Ctx, entry: LegacyLog): void {
  const action = ACTION_BY_ID.get(LEGACY_ACTIONS[entry.type.toLowerCase()] ?? '');
  const title = action ? action.title : entry.type;
  saveLog(ctx, {
    ts: ctx.now,
    day: ctx.today,
    tzOffsetMin: new Date(ctx.now).getTimezoneOffset(),
    actionId: action ? action.id : CUSTOM_ACTION_ID,
    variant: null,
    title,
    emoji: action ? action.emoji : '🌱',
    category: action ? action.category : 'nature',
    qty: 1,
    unit: action ? action.unit : 'time',
    // The old app recorded no quantities, so no kilograms are claimed or re-estimated.
    co2eKg: null,
    kgLow: null,
    kgHigh: null,
    estimate: 'none',
    factorsVersion: EVIDENCE_META.factorsVersion,
    kind: 'unrated',
    cadence: action ? action.cadence : 'occasional',
    source: 'legacy',
    effort: action ? null : 2,
  });
}

/**
 * Replays real legacy logs onto a state that is about to be planted. The result is a
 * tree planted on the day of the first old log, with rings, XP and growth as today's
 * rules give them. Celebrations are not replayed: one summary notice instead.
 */
export function replayLegacy(state: GameState, scan: LegacyScan, now: number): GameState {
  const first = scan.logs[0];
  if (!first || first.ts > now) return state;
  const plantedDay = dayKey(first.ts);
  let current: GameState = {
    ...state,
    profile: { ...state.profile, plantedDay },
    onboarding: { ...state.onboarding, completedAt: first.ts, legacy: 'offered' },
    clock: { today: plantedDay, lastEventTs: 0 },
  };
  const quiet = { quests: false, notices: false } as const;
  for (const entry of scan.logs) {
    current = transact(current, entry.ts, (ctx) => logLegacyEntry(ctx, entry), quiet).state;
  }
  const summary = transact(
    current,
    now,
    (ctx) => {
      const s = ctx.s;
      s.onboarding.legacy = 'imported';
      // Levels and stages reached by the replay are history, not news.
      s.seen.maxLevel = Math.max(s.seen.maxLevel, levelOf(s.xp));
      s.seen.maxStage = Math.max(s.seen.maxStage, stageIndexOf(s.tree.gp));
      writeActivity(
        ctx,
        'legacy',
        `${scan.logs.length} actions brought over from the earlier version of the app.`,
      );
      queueNotice(ctx, 'legacy-imported', 'once', {
        logs: scan.logs.length,
        skipped: scan.skipped,
        rings: s.tree.rings,
      });
      ctx.events.push({
        type: 'legacy-imported',
        logs: scan.logs.length,
        skipped: scan.skipped,
        rings: s.tree.rings,
        xp: s.xp,
      });
    },
    { quests: false },
  );
  return summary.state;
}
