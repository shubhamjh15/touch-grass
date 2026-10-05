/**
 * Runtime validation of a saved game state. Saved data comes from storage, from an
 * import file or from another tab, so nothing about it is trusted: every field is
 * checked, and the first problem is reported with its path.
 */
import { CATEGORY_IDS } from '@/data/catalogue';
import { dayKey, parseDayKey } from '@/lib/dates';
import type { GameState } from './types';

/** Returns a description of the first problem, or `null` when the value is fine. */
type Check = (value: unknown, path: string) => string | null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const expected = (path: string, what: string) => `${path}: expected ${what}`;

const str =
  (max = 2000): Check =>
  (value, path) =>
    typeof value === 'string' && value.length <= max
      ? null
      : expected(path, `text up to ${max} characters`);

const bool: Check = (value, path) =>
  typeof value === 'boolean' ? null : expected(path, 'true or false');

const num =
  (min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): Check =>
  (value, path) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
      ? null
      : expected(path, 'a number in range');

const int =
  (min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): Check =>
  (value, path) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
      ? null
      : expected(path, 'a whole number in range');

const oneOf =
  (...allowed: readonly unknown[]): Check =>
  (value, path) =>
    allowed.includes(value) ? null : expected(path, `one of ${allowed.map(String).join(', ')}`);

const nullable =
  (check: Check): Check =>
  (value, path) =>
    value === null ? null : check(value, path);

const arr =
  (check: Check, max = 100_000): Check =>
  (value, path) => {
    if (!Array.isArray(value) || value.length > max) return expected(path, 'a list');
    for (let index = 0; index < value.length; index += 1) {
      const problem = check(value[index], `${path}[${index}]`);
      if (problem) return problem;
    }
    return null;
  };

const record =
  (check: Check, keyCheck?: Check): Check =>
  (value, path) => {
    if (!isObject(value)) return expected(path, 'an object');
    for (const [key, item] of Object.entries(value)) {
      const problem = keyCheck?.(key, `${path} key "${key}"`) ?? check(item, `${path}.${key}`);
      if (problem) return problem;
    }
    return null;
  };

const obj =
  (shape: Record<string, Check>): Check =>
  (value, path) => {
    if (!isObject(value)) return expected(path, 'an object');
    for (const [key, check] of Object.entries(shape)) {
      const problem = check(value[key], path ? `${path}.${key}` : key);
      if (problem) return problem;
    }
    return null;
  };

const tuple =
  (check: Check, length: number): Check =>
  (value, path) =>
    Array.isArray(value) && value.length === length
      ? arr(check)(value, path)
      : expected(path, `a list of ${length}`);

const day: Check = (value, path) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  dayKey(parseDayKey(value)) === value
    ? null
    : expected(path, 'a calendar day');

const week: Check = (value, path) =>
  typeof value === 'string' && value.startsWith('W')
    ? day(value.slice(1), path)
    : expected(path, 'a week key');

const ts = num(0, 8.64e15);
const count = int(0);
const category = oneOf(...CATEGORY_IDS);
const tier = oneOf(1, 2, 3);
const quizScore = oneOf(0, 1, 2, 3);
const effort = oneOf(1, 2, 3, 4);

const logEntry = obj({
  id: str(64),
  ts,
  day,
  tzOffsetMin: int(-1000, 1000),
  actionId: str(80),
  variant: nullable(str(80)),
  title: str(120),
  emoji: str(16),
  category,
  qty: num(0, 1_000_000),
  unit: str(24),
  co2eKg: nullable(num(0)),
  kgLow: nullable(num(0)),
  kgHigh: nullable(num(0)),
  estimate: oneOf('factor', 'ai', 'none'),
  factorsVersion: str(24),
  kind: oneOf('swap', 'keep', 'unrated'),
  cadence: oneOf('recurring', 'occasional'),
  rewardedActs: int(0, 12),
  xp: int(0, 150),
  gp: int(0, 30),
  source: oneOf('log', 'quick', 'coach', 'quest', 'lesson', 'recap', 'custom', 'legacy'),
  effort: nullable(effort),
});

const breakEntry = obj({
  id: str(64),
  startTs: ts,
  endTs: ts,
  day,
  plannedMin: num(0, 1000),
  keptMin: num(0, 1000),
  awayMs: num(0),
  kept: bool,
  outcome: oneOf('outside', 'rested', 'none'),
  xp: int(0, 100),
  gp: int(0, 30),
});

const questPeriod = (key: Check) =>
  obj({
    key,
    slots: tuple(str(64), 3),
    swapsUsed: int(0, 10),
    swapOffsets: tuple(int(0, 10_000), 3),
  });

const baselineResult = obj({
  takenDay: day,
  region: str(16),
  modelVersion: oneOf(1),
  answers: obj({
    diet: str(40),
    transportMode: str(40),
    weeklyDistance: str(40),
    flights: str(40),
    homeEnergy: str(40),
    shopping: str(40),
  }),
  tonnes: obj({
    food: num(0, 1000),
    transport: num(0, 1000),
    flights: num(0, 1000),
    home: num(0, 1000),
    stuff: num(0, 1000),
    total: num(0, 5000),
  }),
});

const stateShape = obj({
  schemaVersion: oneOf(1),
  contentVersion: str(24),
  factorsVersion: str(24),
  profile: obj({
    name: str(20),
    treeName: str(16),
    species: oneOf('oak', 'cherry', 'pine'),
    userSeed: int(0, 4_294_967_295),
    plantedDay: day,
    region: str(16),
    heat: oneOf('unknown', 'gas', 'electric', 'heat-pump', 'none'),
    units: oneOf('metric', 'imperial'),
    focus: arr(category, 3),
  }),
  onboarding: obj({
    step: int(0, 8),
    completedAt: nullable(ts),
    coachMarksSeen: bool,
    legacy: oneOf('none', 'offered', 'imported', 'declined'),
  }),
  settings: obj({
    restDays: arr(int(0, 6), 3),
    restDaysPending: nullable(arr(int(0, 6), 3)),
    restDaysFrom: nullable(day),
    hiddenActions: arr(str(80), 200),
    sound: bool,
    haptics: bool,
    motion: oneOf('system', 'reduced', 'full'),
    graphics: oneOf('auto', 'low', 'medium', 'high', 'off'),
    sky: oneOf('local', 'day'),
    celebrations: oneOf('full', 'subtle'),
    shareStatsWithCoach: bool,
  }),
  clock: obj({ today: day, lastEventTs: ts }),
  xp: count,
  tree: obj({
    gp: count,
    rings: count,
    fullRings: count,
    vitality: oneOf('thriving', 'thirsty', 'dormant', 'waking'),
    missed: count,
  }),
  streak: obj({ current: count, best: count, milestones: arr(count, 20) }),
  rain: obj({
    bank: int(0, 2),
    progress: int(0, 4),
    lastRefillWeek: nullable(week),
    gifts: arr(count, 20),
  }),
  marks: record(oneOf('full', 'ring', 'rain', 'rest', 'missed'), day),
  days: record(
    obj({
      checkInTs: ts,
      ringClosed: bool,
      cleanSweep: bool,
      breakRewarded: bool,
      journalRewarded: bool,
      returnedFrom: oneOf('rain', 'missed', 'dormant', null),
      ringCelebrated: bool,
      ringRain: oneOf('none', 'progress', 'cloud'),
    }),
    day,
  ),
  logs: arr(logEntry),
  breaks: arr(breakEntry),
  activeBreak: nullable(
    obj({
      startTs: ts,
      plannedMin: num(0, 1000),
      awayMs: num(0),
      lastVisibleTs: nullable(ts),
      hiddenSinceTs: nullable(ts),
    }),
  ),
  quests: obj({
    daily: nullable(questPeriod(day)),
    weekly: nullable(questPeriod(week)),
    claims: arr(
      obj({
        questId: str(64),
        kind: oneOf('daily', 'weekly', 'epic'),
        period: str(16),
        ts,
        xp: int(0, 1000),
        auto: bool,
      }),
    ),
    epics: record(obj({ checklist: arr(bool, 20), note: str(600), claimedTs: nullable(ts) })),
    pinnedEpic: nullable(str(64)),
    lastSelfAttestedTs: nullable(ts),
  }),
  badges: record(obj({ tier, earned: arr(obj({ tier, ts }), 3) })),
  learn: obj({
    lessons: record(
      obj({
        openedTs: nullable(ts),
        readTs: nullable(ts),
        attempts: count,
        bestScore: quizScore,
        firstAttemptScore: nullable(quizScore),
        passedTs: nullable(ts),
      }),
    ),
    mythsFlipped: arr(int(1, 10), 10),
    opens: arr(obj({ ts, day, kind: oneOf('lesson', 'myth'), id: str(64) }), 20_000),
  }),
  baseline: obj({ current: nullable(baselineResult), history: arr(baselineResult, 50) }),
  journal: arr(
    obj({
      id: str(64),
      ts,
      day,
      text: str(500),
      tag: nullable(str(24)),
      attachment: nullable(str(400)),
      editedTs: nullable(ts),
    }),
    50_000,
  ),
  reactions: record(arr(str(24), 20)),
  customActions: arr(
    obj({
      id: str(64),
      title: str(80),
      emoji: str(16),
      category,
      effort,
      co2eKg: nullable(num(0, 5)),
      estimate: oneOf('ai', 'none'),
      qty: num(0, 1000),
      unit: str(24),
    }),
    12,
  ),
  challenge: obj({
    active: nullable(
      obj({
        templateId: str(40),
        role: oneOf('creator', 'friend'),
        startDay: day,
        days: oneOf(7),
        category: nullable(category),
        from: nullable(str(20)),
        fromTree: nullable(str(16)),
        message: nullable(str(80)),
        completedTs: nullable(ts),
      }),
    ),
    lastRewardWeek: nullable(week),
    history: arr(
      obj({ templateId: str(40), startDay: day, done: count, of: count, success: bool }),
      2000,
    ),
  }),
  activity: arr(obj({ ts, day, kind: str(24), text: str(300) }), 500),
  notices: arr(
    obj({
      id: str(80),
      kind: str(32),
      ts,
      day,
      data: record((value, path) =>
        typeof value === 'string' || typeof value === 'number'
          ? null
          : expected(path, 'text or a number'),
      ),
    }),
    100,
  ),
  seen: obj({
    messages: arr(str(80), 400),
    recapWeek: nullable(week),
    coachPrivacyNotice: bool,
    maxLevel: int(1),
    maxStage: int(0, 8),
    shareExports: count,
  }),
});

/**
 * Fills in the fields that were added to the state after its first layout. An additive
 * field needs no migration, only a default here. Nothing else is ever invented: a save
 * that lacks a core field is damaged and must fail validation.
 */
export function withDefaults(input: unknown): unknown {
  if (!isObject(input)) return input;
  const out: Record<string, unknown> = { ...input };
  if (out.reactions === undefined) out.reactions = {};
  if (out.notices === undefined) out.notices = [];
  if (isObject(out.seen)) {
    out.seen = { maxLevel: 1, maxStage: 0, shareExports: 0, ...out.seen };
  }
  if (isObject(out.days)) {
    const days: Record<string, unknown> = {};
    for (const [key, record] of Object.entries(out.days)) {
      days[key] = isObject(record)
        ? { ringCelebrated: record.ringClosed === true, ringRain: 'none', ...record }
        : record;
    }
    out.days = days;
  }
  if (Array.isArray(out.logs)) {
    out.logs = out.logs.map((log: unknown) =>
      isObject(log) && log.effort === undefined ? { ...log, effort: null } : log,
    );
  }
  if (isObject(out.activeBreak) && out.activeBreak.hiddenSinceTs === undefined) {
    out.activeBreak = { ...out.activeBreak, hiddenSinceTs: null };
  }
  if (isObject(out.challenge) && isObject(out.challenge.active)) {
    out.challenge = {
      ...out.challenge,
      active: { fromTree: null, ...out.challenge.active },
    };
  }
  return out;
}

export type ValidationResult = { ok: true; state: GameState } | { ok: false; reason: string };

/** Checks that a value is a structurally valid game state of the current schema. */
export function validateState(input: unknown): ValidationResult {
  const problem = stateShape(input, '');
  if (problem) return { ok: false, reason: problem };
  const state = input as GameState;
  if (
    new Set(state.profile.focus).size !== state.profile.focus.length ||
    state.profile.focus.length < 1
  ) {
    return { ok: false, reason: 'profile.focus: expected one to three different categories' };
  }
  return { ok: true, state };
}
