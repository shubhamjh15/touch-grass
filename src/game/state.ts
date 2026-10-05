/** The empty game state and the invariants every saved state must satisfy. */
import { DEFAULT_REGION, EVIDENCE_META } from '@/data/catalogue';
import { dayKey } from '@/lib/dates';
import {
  CONTENT_VERSION,
  DEFAULT_FOCUS,
  FOCUS_MAX,
  GP_CHECK_IN,
  GP_DAILY_CAP,
  GP_RING_CLOSED,
  LOG_XP_DAILY_CAP,
  RAIN_CAP,
  RAIN_START,
  REST_DAYS_MAX,
  SCHEMA_VERSION,
} from './economy';
import type { DayKey, GameState } from './types';

/** A state before onboarding: nothing planted, nothing earned. */
export function createInitialState(now: number): GameState {
  const today = dayKey(now);
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    factorsVersion: EVIDENCE_META.factorsVersion,
    profile: {
      name: 'Friend',
      treeName: '',
      species: 'oak',
      userSeed: 1,
      plantedDay: today,
      region: DEFAULT_REGION,
      heat: 'unknown',
      units: 'metric',
      focus: [...DEFAULT_FOCUS],
    },
    onboarding: { step: 0, completedAt: null, coachMarksSeen: false, legacy: 'none' },
    settings: {
      restDays: [],
      restDaysPending: null,
      restDaysFrom: null,
      hiddenActions: [],
      sound: true,
      haptics: true,
      motion: 'system',
      graphics: 'auto',
      sky: 'local',
      celebrations: 'full',
      shareStatsWithCoach: true,
    },
    clock: { today, lastEventTs: 0 },
    xp: 0,
    tree: { gp: 0, rings: 0, fullRings: 0, vitality: 'thriving', missed: 0 },
    streak: { current: 0, best: 0, milestones: [] },
    rain: { bank: RAIN_START, progress: 0, lastRefillWeek: null, gifts: [] },
    marks: {},
    days: {},
    logs: [],
    breaks: [],
    activeBreak: null,
    quests: {
      daily: null,
      weekly: null,
      claims: [],
      epics: {},
      pinnedEpic: null,
      lastSelfAttestedTs: null,
    },
    badges: {},
    learn: { lessons: {}, mythsFlipped: [], opens: [] },
    baseline: { current: null, history: [] },
    journal: [],
    reactions: {},
    customActions: [],
    challenge: { active: null, lastRewardWeek: null, history: [] },
    activity: [],
    notices: [],
    seen: {
      messages: [],
      recapWeek: null,
      coachPrivacyNotice: false,
      maxLevel: 1,
      maxStage: 0,
      shareExports: 0,
    },
  };
}

export function isOnboarded(state: Pick<GameState, 'onboarding'>): boolean {
  return state.onboarding.completedAt !== null;
}

/**
 * Checks the invariants of product spec section 13.4. Returns one line per violation;
 * an empty list means the state is consistent. Run in tests and on every import.
 */
export function checkInvariants(state: GameState): string[] {
  const problems: string[] = [];
  const say = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };

  say(Number.isInteger(state.xp) && state.xp >= 0, 'xp must be a non-negative integer');
  say(
    Number.isInteger(state.tree.gp) && state.tree.gp >= 0,
    'tree.gp must be a non-negative integer',
  );
  say(state.rain.bank >= 0 && state.rain.bank <= RAIN_CAP, 'rain.bank must be between 0 and 2');
  say(
    state.rain.progress >= 0 && state.rain.progress <= 4,
    'rain.progress must be between 0 and 4',
  );
  say(state.streak.best >= state.streak.current, 'streak.best must be at least streak.current');
  say(state.streak.current >= 0, 'streak.current must not be negative');
  say(state.tree.missed >= 0, 'tree.missed must not be negative');
  say(state.settings.restDays.length <= REST_DAYS_MAX, 'at most three rest days');
  say(
    state.profile.focus.length >= 1 && state.profile.focus.length <= FOCUS_MAX,
    'focus must hold one to three categories',
  );
  say(new Set(state.profile.focus).size === state.profile.focus.length, 'focus must be unique');

  const dayKeys = Object.keys(state.days);
  say(state.tree.rings === dayKeys.length, 'tree.rings must equal the number of active days');
  let fullMarks = 0;
  for (const mark of Object.values(state.marks)) if (mark === 'full') fullMarks += 1;
  say(state.tree.fullRings === fullMarks, 'tree.fullRings must equal the number of full marks');
  for (const key of dayKeys) {
    const mark = state.marks[key];
    say(mark === 'ring' || mark === 'full', `active day ${key} must be marked ring or full`);
    say(
      (mark === 'full') === (state.days[key]?.ringClosed === true),
      `day ${key}: ring flag and mark disagree`,
    );
    say(key <= state.clock.today, `active day ${key} is after clock.today`);
  }

  const xpByDay = new Map<DayKey, number>();
  const gpByDay = new Map<DayKey, number>();
  let previousTs = Number.NEGATIVE_INFINITY;
  const ids = new Set<string>();
  for (const log of state.logs) {
    say(log.day <= state.clock.today, `log ${log.id} is after clock.today`);
    say(log.ts >= previousTs, `log ${log.id} is out of order`);
    say(!ids.has(log.id), `log id ${log.id} is not unique`);
    say(log.xp >= 0 && log.gp >= 0 && log.rewardedActs >= 0, `log ${log.id} has negative rewards`);
    say(log.co2eKg === null || log.co2eKg >= 0, `log ${log.id} has a negative estimate`);
    ids.add(log.id);
    previousTs = log.ts;
    xpByDay.set(log.day, (xpByDay.get(log.day) ?? 0) + log.xp);
    gpByDay.set(log.day, (gpByDay.get(log.day) ?? 0) + log.gp);
  }
  for (const [day, xp] of xpByDay) {
    say(xp <= LOG_XP_DAILY_CAP, `log XP on ${day} exceeds ${LOG_XP_DAILY_CAP}`);
  }
  const sunlightByDay = new Map<DayKey, number>();
  for (const entry of state.breaks) {
    sunlightByDay.set(entry.day, (sunlightByDay.get(entry.day) ?? 0) + entry.gp);
  }
  for (const day of new Set([...gpByDay.keys(), ...dayKeys])) {
    const record = state.days[day];
    const total =
      (gpByDay.get(day) ?? 0) +
      (record ? GP_CHECK_IN : 0) +
      (record?.ringClosed ? GP_RING_CLOSED : 0) +
      (sunlightByDay.get(day) ?? 0);
    say(total <= GP_DAILY_CAP, `growth points on ${day} exceed ${GP_DAILY_CAP}`);
  }
  return problems;
}
