/**
 * The three simulated users of the product spec (appendix F), played through the real
 * engine. The simulation suite asserts the published tables with it and the fixture
 * generator builds saved states from it, so neither can drift from the rules.
 *
 * Harness rules, as published: day 1 is a Monday and the planting day; region WORLD,
 * heat unknown, no baseline, no rest days, nothing hidden. Quest rotation is not run:
 * claims are injected with the XP shown. Only the badges that follow from those events
 * are counted.
 */
import { addDays, type DayKey } from '@/lib/dates';
import type { EngineOptions } from './ctx';
import { water } from './engine';
import { growthOf, stageOf } from './growth';
import { LESSON_SLUGS, completeLesson } from './lessons';
import { levelOf } from './levels';
import { logAction } from './logging';
import { injectClaim } from './quests';
import { type GameSession, localTime, plantedSession } from './testkit';
import { finishBreak, signalBreak, startBreak } from './touchGrass';
import type { GameState } from './types';

export interface DayPlan {
  logs: readonly (readonly [actionId: string, qty: number])[];
  dailyClaims?: readonly number[];
  weeklyClaims?: readonly number[];
  /** `pass` = 2 of 3; `perfect` = 3 of 3 on the first attempt. */
  lesson?: 'pass' | 'perfect' | null;
  breakMin?: number;
}

export type PersonaId = 'lazy' | 'typical' | 'power';

/** What each persona does on day `d` (1-based); `null` on a day they do not show up. */
export const PERSONAS: Readonly<Record<PersonaId, (d: number) => DayPlan | null>> = {
  // "Lena": Monday, Wednesday and Saturday, one act each.
  lazy: (d) => {
    const weekday = (d - 1) % 7;
    if (![0, 2, 5].includes(weekday)) return null;
    const logs: DayPlan['logs'] =
      weekday === 0
        ? [['plant-based-meal', 1]]
        : weekday === 2
          ? [['refuse-single-use-bottle', 1]]
          : [['walk-cycle-instead-of-car', 2]];
    return { logs, dailyClaims: weekday === 5 ? [15] : [], lesson: d === 13 ? 'pass' : null };
  },
  // "Maya": every day except Sunday, two acts, a third on Monday, Wednesday and Friday.
  typical: (d) => {
    const weekday = (d - 1) % 7;
    if (weekday === 6) return null;
    const logs: (readonly [string, number])[] = [
      ['plant-based-meal', 1],
      ['bus-instead-of-car', 5],
    ];
    if ([0, 2, 4].includes(weekday)) logs.push(['refuse-single-use-bottle', 1]);
    const week = Math.floor((d - 1) / 7) + 1;
    return {
      logs,
      dailyClaims: [20],
      weeklyClaims: weekday === 5 ? [60] : [],
      lesson: weekday === 1 && week <= 10 ? (week % 2 === 0 ? 'perfect' : 'pass') : null,
      breakMin: weekday === 5 ? 20 : 0,
    };
  },
  // "Arjun", the min-maxer: ten acts every day, every quest, a break and a lesson when he can.
  power: (d) => ({
    logs: [
      ['walk-cycle-instead-of-car', 5],
      ['plant-based-meal', 3],
      ['shorter-shower', 2],
      ['wash-cold-instead-of-40', 1],
      ['standby-off', 1],
      ['refuse-single-use-bottle', 2],
      ['tap-off-while-brushing', 1],
    ],
    dailyClaims: [15, 20, 25],
    weeklyClaims: (d - 1) % 7 === 6 ? [60, 80, 100] : [],
    lesson: (d - 1) % 3 === 0 ? 'perfect' : null,
    breakMin: 20,
  }),
};

/** The badges the published tables count; secrets and self-reported ones are left out. */
export const COUNTED_BADGES: ReadonlySet<string> = new Set([
  'first-leaf',
  'trailblazer',
  'plant-plate',
  'watt-watcher',
  'drop-saver',
  'loop-maker',
  'bin-boss',
  'wild-heart',
  'ring-collector',
  'on-a-roll',
  'full-circle',
  'kept-out',
  'quest-hand',
  'bookworm',
  'grass-toucher',
  'well-rounded',
  'clean-sweep',
]);

export const SIMULATION_OPTIONS: EngineOptions = {
  quests: false,
  badgeFilter: (badgeId) => COUNTED_BADGES.has(badgeId),
};

/** A Monday, so the published weekday patterns line up with real calendar weeks. */
export const SIMULATION_START: DayKey = '2026-01-05';

export interface SimulationMark {
  xp: number;
  level: number;
  gp: number;
  growth: number;
  stage: string;
  rings: number;
  fullRings: number;
  streak: number;
  bestStreak: number;
  rain: number;
  kg: number;
  badges: number;
}

export function markOf(state: GameState): SimulationMark {
  let kg = 0;
  for (const log of state.logs) if (log.estimate === 'factor') kg += log.co2eKg ?? 0;
  return {
    xp: state.xp,
    level: levelOf(state.xp),
    gp: state.tree.gp,
    growth: growthOf(state.tree.gp),
    stage: stageOf(state.tree.gp),
    rings: state.tree.rings,
    fullRings: state.tree.fullRings,
    streak: state.streak.current,
    bestStreak: state.streak.best,
    rain: state.rain.bank,
    kg,
    badges: Object.values(state.badges).reduce((sum, badge) => sum + badge.tier, 0),
  };
}

const MINUTE = 60_000;

/** Plays one active day of a plan: water, logs, break, claims, lesson — in the published order. */
export function playDay(session: GameSession, day: DayKey, plan: DayPlan, firstDay: boolean): void {
  const morning = localTime(day, 8);
  if (!firstDay) session.at(morning, water);
  plan.logs.forEach(([actionId, qty], index) => {
    const result = session.at(morning + (index + 1) * 5 * MINUTE, (ctx) =>
      logAction(ctx, { actionId, qty }),
    );
    if (!result.ok)
      throw new Error(`simulated log refused on ${day}: ${actionId} (${result.reason})`);
  });
  if (plan.breakMin) {
    const start = localTime(day, 12);
    session.at(start, (ctx) => startBreak(ctx, plan.breakMin ?? 0));
    session.at(start + 1000, (ctx) => signalBreak(ctx, 'hidden'));
    session.at(start + plan.breakMin * MINUTE, (ctx) => finishBreak(ctx, 'outside'));
  }
  const evening = localTime(day, 20);
  (plan.dailyClaims ?? []).forEach((xp, index) =>
    session.at(evening + index, (ctx) => injectClaim(ctx, 'daily', `sim-daily-${index}`, xp)),
  );
  (plan.weeklyClaims ?? []).forEach((xp, index) =>
    session.at(evening + 10 + index, (ctx) =>
      injectClaim(ctx, 'weekly', `sim-weekly-${index}`, xp),
    ),
  );
  if (plan.lesson) {
    const slug = LESSON_SLUGS.find((id) => session.state.learn.lessons[id]?.passedTs == null);
    if (slug) {
      const score = plan.lesson === 'perfect' ? 3 : 2;
      session.at(evening + 100, (ctx) => completeLesson(ctx, slug, score));
    }
  }
}

export interface SimulationResult {
  session: GameSession;
  /** State summaries at the end of the requested days. */
  marks: Record<number, SimulationMark>;
  /** First day (1-based) each level was reached. */
  levelDays: Record<number, number>;
  /** First day each stage was reached. */
  stageDays: Record<string, number>;
}

/** Plays a persona for `days` days from a Monday and records the requested checkpoints. */
export function simulate(
  persona: PersonaId,
  days: number,
  checkpoints: readonly number[] = [1, 7, 30, 365],
  start: DayKey = SIMULATION_START,
): SimulationResult {
  const plan = PERSONAS[persona];
  const session = plantedSession(localTime(start, 8), { name: 'Sim' }, SIMULATION_OPTIONS);
  const marks: Record<number, SimulationMark> = {};
  const levelDays: Record<number, number> = {};
  const stageDays: Record<string, number> = {};
  for (let d = 1; d <= days; d += 1) {
    const today = plan(d);
    if (today) playDay(session, addDays(start, d - 1), today, d === 1);
    const mark = markOf(session.state);
    if (checkpoints.includes(d)) marks[d] = mark;
    if (levelDays[mark.level] === undefined) levelDays[mark.level] = d;
    if (stageDays[mark.stage] === undefined) stageDays[mark.stage] = d;
  }
  return { session, marks, levelDays, stageDays };
}

/** The first day a level at or above `level` was reached, or `null` if it never was. */
export function dayOfLevel(result: SimulationResult, level: number): number | null {
  const days = Object.entries(result.levelDays)
    .filter(([reached]) => Number(reached) >= level)
    .map(([, day]) => day);
  return days.length > 0 ? Math.min(...days) : null;
}
