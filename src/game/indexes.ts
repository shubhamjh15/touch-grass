/**
 * Read-only lookups over the saved collections, memoised on the collection's identity.
 * Collections are replaced (never mutated) on change, so a WeakMap keyed by the array
 * is a correct cache and costs nothing when the state did not change.
 */
import type { CategoryId } from '@/data/catalogue';
import type { DayKey } from '@/lib/dates';
import type { BreakEntry, JournalNote, LearnOpen, LogEntry } from './types';

/** Caches `compute` per key identity. The key must be a collection that is replaced on change. */
export function memoize<K extends object, V>(compute: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>();
  return (key) => {
    if (cache.has(key)) return cache.get(key) as V;
    const value = compute(key);
    cache.set(key, value);
    return value;
  };
}

const memo = memoize;

function groupByDay<T extends { day: DayKey }>(items: readonly T[]): Map<DayKey, T[]> {
  const map = new Map<DayKey, T[]>();
  for (const item of items) {
    const list = map.get(item.day);
    if (list) list.push(item);
    else map.set(item.day, [item]);
  }
  return map;
}

const EMPTY: readonly never[] = Object.freeze([]);

const logIndex = memo((logs: readonly LogEntry[]) => groupByDay(logs));
const breakIndex = memo((breaks: readonly BreakEntry[]) => groupByDay(breaks));
const noteIndex = memo((notes: readonly JournalNote[]) => groupByDay(notes));
const openIndex = memo((opens: readonly LearnOpen[]) => groupByDay(opens));

/** The logs of one day, in timestamp order. */
export function logsOn(logs: readonly LogEntry[], day: DayKey): readonly LogEntry[] {
  return logIndex(logs).get(day) ?? EMPTY;
}

export function breaksOn(breaks: readonly BreakEntry[], day: DayKey): readonly BreakEntry[] {
  return breakIndex(breaks).get(day) ?? EMPTY;
}

export function notesOn(notes: readonly JournalNote[], day: DayKey): readonly JournalNote[] {
  return noteIndex(notes).get(day) ?? EMPTY;
}

export function opensOn(opens: readonly LearnOpen[], day: DayKey): readonly LearnOpen[] {
  return openIndex(opens).get(day) ?? EMPTY;
}

export interface LifetimeLogStats {
  logs: number;
  rewardedActs: number;
  actsByCategory: Readonly<Record<CategoryId, number>>;
  actsByAction: ReadonlyMap<string, number>;
  logsByAction: ReadonlyMap<string, number>;
  /** Estimated kg CO2e avoided from sourced factors: the headline total. */
  factorKg: number;
  /** Kilograms from AI estimates, always reported apart. */
  aiKg: number;
  kgByCategory: Readonly<Record<CategoryId, number>>;
  categoriesTried: number;
  /** The most categories with a rewarded act on any single day. */
  maxCategoriesInDay: number;
  /** Logs saved between midnight and 04:00 local time. */
  nightLogs: number;
  earthDayLogs: number;
}

const zeroByCategory = (): Record<CategoryId, number> => ({
  move: 0,
  eat: 0,
  power: 0,
  water: 0,
  stuff: 0,
  waste: 0,
  nature: 0,
});

/** Local hour (0..23) at which a log was saved, from the offset frozen on the log. */
export function localHourOf(log: Pick<LogEntry, 'ts' | 'tzOffsetMin'>): number {
  return new Date(log.ts - log.tzOffsetMin * 60_000).getUTCHours();
}

export const lifetimeLogStats = memo((logs: readonly LogEntry[]): LifetimeLogStats => {
  const actsByCategory = zeroByCategory();
  const kgByCategory = zeroByCategory();
  const actsByAction = new Map<string, number>();
  const logsByAction = new Map<string, number>();
  let rewardedActs = 0;
  let factorKg = 0;
  let aiKg = 0;
  let nightLogs = 0;
  let earthDayLogs = 0;
  let maxCategoriesInDay = 0;
  let currentDay = '';
  let dayCategories = new Set<CategoryId>();

  for (const log of logs) {
    if (log.day !== currentDay) {
      currentDay = log.day;
      dayCategories = new Set();
    }
    logsByAction.set(log.actionId, (logsByAction.get(log.actionId) ?? 0) + 1);
    if (log.rewardedActs > 0) {
      rewardedActs += log.rewardedActs;
      actsByCategory[log.category] += log.rewardedActs;
      actsByAction.set(log.actionId, (actsByAction.get(log.actionId) ?? 0) + log.rewardedActs);
      dayCategories.add(log.category);
      maxCategoriesInDay = Math.max(maxCategoriesInDay, dayCategories.size);
    }
    if (log.co2eKg !== null) {
      if (log.estimate === 'factor') {
        factorKg += log.co2eKg;
        kgByCategory[log.category] += log.co2eKg;
      } else if (log.estimate === 'ai') {
        aiKg += log.co2eKg;
      }
    }
    if (log.source !== 'legacy') {
      if (localHourOf(log) < 4) nightLogs += 1;
      if (log.day.endsWith('-04-22')) earthDayLogs += 1;
    }
  }

  return {
    logs: logs.length,
    rewardedActs,
    actsByCategory,
    actsByAction,
    logsByAction,
    factorKg,
    aiKg,
    kgByCategory,
    categoriesTried: Object.values(actsByCategory).filter((count) => count > 0).length,
    maxCategoriesInDay,
    nightLogs,
    earthDayLogs,
  };
});
