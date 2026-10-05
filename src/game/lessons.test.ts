import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/dates';
import {
  DAILY_FACT_COUNT,
  LESSON_SLUGS,
  completeLesson,
  dailyFact,
  flipMyth,
  isPass,
  lessonProgress,
  lessonStatus,
  markLessonRead,
  openLesson,
  passedLessons,
  recommendedLesson,
  scoreQuiz,
} from './lessons';
import { badgeMetric } from './badges';
import { logAction } from './logging';
import { dailyProgress, evaluateCondition } from './quests';
import { createInitialState } from './state';
import { GameSession, localTime, plantedSession } from './testkit';
import {
  awayMsAt,
  breakCooldownMin,
  breakStats,
  breakXp,
  finishBreak,
  judgeBreak,
  signalBreak,
  startBreak,
  suggestedBreakMin,
  trackBreak,
} from './touchGrass';
import type { ActiveBreak } from './types';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);
const MIN = 60_000;

describe('lessons', () => {
  it('knows the ten lessons', () => {
    expect(LESSON_SLUGS).toHaveLength(10);
    expect(new Set(LESSON_SLUGS).size).toBe(10);
  });

  it('scores a quiz out of three', () => {
    expect(scoreQuiz([0, 1, 2], [0, 1, 2])).toBe(3);
    expect(scoreQuiz([0, 1, 0], [0, 1, 2])).toBe(2);
    expect(scoreQuiz([2, 2], [0, 1, 2])).toBe(0);
    expect(scoreQuiz([], [0, 1, 2])).toBe(0);
    expect(scoreQuiz([0, 1, 2, 3], [0, 1, 2, 3])).toBe(3);
    expect([0, 1, 2, 3].map(isPass)).toEqual([false, false, true, true]);
  });

  it('moves a lesson from new to read to passed', () => {
    const session = plantedSession(noon(0));
    expect(lessonStatus(lessonProgress(session.state, 'the-blanket'))).toBe('new');
    expect(session.at(noon(0) + 1000, (ctx) => openLesson(ctx, 'the-blanket'))).toBe(true);
    expect(session.state.learn.opens).toHaveLength(1);
    expect(lessonStatus(lessonProgress(session.state, 'the-blanket'))).toBe('new');
    expect(session.at(noon(0) + 31_000, (ctx) => markLessonRead(ctx, 'the-blanket'))).toBe(true);
    expect(session.at(noon(0) + 32_000, (ctx) => markLessonRead(ctx, 'the-blanket'))).toBe(false);
    expect(lessonStatus(lessonProgress(session.state, 'the-blanket'))).toBe('read');
    session.at(noon(0) + 60_000, (ctx) => completeLesson(ctx, 'the-blanket', 2));
    expect(lessonStatus(lessonProgress(session.state, 'the-blanket'))).toBe('passed');
    expect(passedLessons(session.state)).toEqual(['the-blanket']);
    expect(session.at(noon(0), (ctx) => openLesson(ctx, 'no-such-lesson'))).toBe(false);
  });

  it('pays 30 XP on the first pass and nothing for retries', () => {
    const session = plantedSession(noon(0));
    const xp = session.state.xp;
    expect(session.at(noon(0) + 1000, (ctx) => completeLesson(ctx, 'big-levers', 1))).toMatchObject(
      {
        ok: true,
        passed: false,
        xp: 0,
      },
    );
    expect(session.state.xp).toBe(xp);
    expect(session.at(noon(0) + 2000, (ctx) => completeLesson(ctx, 'big-levers', 3))).toMatchObject(
      {
        passed: true,
        firstPass: true,
        perfect: false,
        xp: 30,
      },
    );
    expect(session.state.xp).toBe(xp + 30 + 20);
    expect(session.eventsOf('lesson-completed')[0]).toMatchObject({
      slug: 'big-levers',
      score: 3,
      xp: 30,
    });
    const after = session.state.xp;
    expect(session.at(noon(0) + 3000, (ctx) => completeLesson(ctx, 'big-levers', 3))).toMatchObject(
      {
        passed: true,
        firstPass: false,
        xp: 0,
      },
    );
    expect(session.state.xp).toBe(after);
    expect(lessonProgress(session.state, 'big-levers')).toMatchObject({
      attempts: 3,
      bestScore: 3,
      firstAttemptScore: 1,
    });
    expect(session.state.badges.bookworm?.tier).toBe(1);
  });

  it('adds 10 XP for three out of three on the first attempt only', () => {
    const session = plantedSession(noon(0));
    expect(session.at(noon(0) + 1000, (ctx) => completeLesson(ctx, 'stuff', 3))).toMatchObject({
      perfect: true,
      xp: 40,
    });
    expect(session.at(noon(0) + 2000, (ctx) => completeLesson(ctx, 'good-news', 2))).toMatchObject({
      perfect: false,
      xp: 30,
    });
    expect(session.at(noon(0) + 3000, (ctx) => completeLesson(ctx, 'stuff', 4))).toEqual({
      ok: false,
      reason: 'invalid-score',
    });
    expect(session.at(noon(0) + 3000, (ctx) => completeLesson(ctx, 'nope', 3))).toEqual({
      ok: false,
      reason: 'unknown-lesson',
    });
  });

  it('checks in when a quiz pass is the first act of a day', () => {
    const session = plantedSession(noon(0));
    session.at(noon(1), (ctx) => completeLesson(ctx, 'the-blanket', 1));
    expect(session.state.days[day(1)]).toBeUndefined();
    session.at(noon(1) + 1000, (ctx) => completeLesson(ctx, 'the-blanket', 2));
    expect(session.state.days[day(1)]).toBeDefined();
    expect(session.eventsOf('checked-in')[0]).toMatchObject({ via: 'lesson', implicit: true });
  });

  it('awards Sharpshooter after five perfect first attempts', () => {
    const session = plantedSession(noon(0));
    LESSON_SLUGS.slice(0, 5).forEach((slug, index) =>
      session.at(noon(0) + 1000 + index, (ctx) => completeLesson(ctx, slug, 3)),
    );
    expect(session.state.badges.sharpshooter?.tier).toBe(1);
    expect(session.state.badges.bookworm?.tier).toBe(2);
  });

  it('recommends the first unpassed lesson in the focus areas', () => {
    const session = plantedSession(noon(0), { focus: ['waste'] });
    expect(recommendedLesson(session.state)).toBe('food-we-never-eat');
    session.at(noon(0) + 1000, (ctx) => completeLesson(ctx, 'food-we-never-eat', 2));
    expect(recommendedLesson(session.state)).toBe('recycling-honestly');
    session.at(noon(0) + 2000, (ctx) => completeLesson(ctx, 'recycling-honestly', 2));
    expect(recommendedLesson(session.state)).toBe('the-blanket');
    LESSON_SLUGS.forEach((slug, index) =>
      session.at(noon(1) + index, (ctx) => completeLesson(ctx, slug, 2)),
    );
    expect(recommendedLesson(session.state)).toBeNull();
  });

  it('pays 5 XP for the first flip of each myth card', () => {
    const session = plantedSession(noon(0));
    const xp = session.state.xp;
    expect(session.at(noon(0) + 1000, (ctx) => flipMyth(ctx, 4))).toEqual({
      ok: true,
      first: true,
      xp: 5,
    });
    expect(session.at(noon(0) + 2000, (ctx) => flipMyth(ctx, 4))).toEqual({
      ok: true,
      first: false,
      xp: 0,
    });
    expect(session.at(noon(0) + 3000, (ctx) => flipMyth(ctx, 11))).toEqual({
      ok: false,
      first: false,
      xp: 0,
    });
    expect(session.state.xp).toBe(xp + 5);
    expect(session.state.learn.mythsFlipped).toEqual([4]);
    expect(session.state.learn.opens).toHaveLength(2);
  });

  it('prunes old opens after two weeks', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => openLesson(ctx, 'the-blanket'));
    session.at(noon(10), (ctx) => openLesson(ctx, 'stuff'));
    session.tick(noon(15));
    expect(session.state.learn.opens.map((entry) => entry.id)).toEqual(['stuff']);
  });

  it('lets a visitor read before planting, without rewards', () => {
    const session = new GameSession(createInitialState(noon(0)));
    session.at(noon(0), (ctx) => completeLesson(ctx, 'the-blanket', 3));
    expect(session.state.learn.lessons['the-blanket']?.passedTs).not.toBeNull();
    expect(session.state.days).toEqual({});
  });

  it('picks a daily fact that is stable per user and changes every day', () => {
    const numbers = new Set<number>();
    for (let offset = 0; offset < DAILY_FACT_COUNT; offset += 1) {
      const fact = dailyFact(day(offset), 12345);
      expect(fact).toEqual(dailyFact(day(offset), 12345));
      numbers.add(fact.number);
    }
    expect(numbers.size).toBe(DAILY_FACT_COUNT);
    expect(dailyFact('2026-01-01', 0)).toEqual({
      number: 1,
      lesson: 'power-at-home',
      opensTouchGrass: false,
    });
    expect(dailyFact('2026-01-01', 27)).toEqual({
      number: 28,
      lesson: null,
      opensTouchGrass: true,
    });
    expect(dailyFact('2025-12-31', 0).number).toBe(30);
    expect(dailyFact('2026-01-01', 4_294_967_295).number).toBeGreaterThanOrEqual(1);
  });
});

describe('touch grass', () => {
  const start = noon(0);
  const fresh = (plannedMin = 10): ActiveBreak => ({
    startTs: start,
    plannedMin,
    awayMs: 0,
    lastVisibleTs: start,
    hiddenSinceTs: null,
  });

  it('counts hidden time in full', () => {
    let active = trackBreak(fresh(), 'hidden', start + 5_000);
    active = trackBreak(active, 'visible', start + 8 * MIN);
    expect(active.awayMs).toBe(8 * MIN - 5_000);
    expect(active.hiddenSinceTs).toBeNull();
    expect(judgeBreak(active, start + 10 * MIN)).toMatchObject({
      kept: true,
      keptMin: 10,
      why: 'kept',
    });
  });

  it('counts visible time without input only after a minute of stillness', () => {
    let active = fresh();
    for (let second = 20; second <= 600; second += 20)
      active = trackBreak(active, 'input', start + second * 1000);
    expect(active.awayMs).toBe(0);
    expect(judgeBreak(active, start + 10 * MIN)).toMatchObject({ kept: false, why: 'not-away' });

    const idle = trackBreak(fresh(), 'input', start + 9 * MIN);
    expect(idle.awayMs).toBe(9 * MIN);
    expect(awayMsAt(fresh(), start + 10 * MIN)).toBe(10 * MIN);
    expect(awayMsAt(fresh(), start + 30_000)).toBe(0);
  });

  it('forgives two quick peeks but not scrolling through the break', () => {
    let active = trackBreak(fresh(), 'hidden', start + 10_000);
    active = trackBreak(active, 'visible', start + 4 * MIN);
    active = trackBreak(active, 'input', start + 4 * MIN + 20_000);
    active = trackBreak(active, 'hidden', start + 4 * MIN + 40_000);
    active = trackBreak(active, 'visible', start + 9 * MIN);
    expect(judgeBreak(active, start + 10 * MIN).kept).toBe(true);
    expect(judgeBreak(active, start + 10 * MIN).awayMs).toBeGreaterThanOrEqual(7 * MIN);
  });

  it('needs the planned time, or ten minutes when ended early', () => {
    const away = trackBreak(fresh(30), 'hidden', start + 1000);
    expect(judgeBreak(away, start + 9 * MIN)).toMatchObject({
      kept: false,
      keptMin: 0,
      why: 'too-short',
    });
    expect(judgeBreak(away, start + 12 * MIN)).toMatchObject({
      kept: true,
      keptMin: 10,
      complete: false,
    });
    expect(judgeBreak(away, start + 30 * MIN)).toMatchObject({
      kept: true,
      keptMin: 30,
      complete: true,
    });
    expect([5, 10, 19, 20, 45].map(breakXp)).toEqual([0, 15, 15, 25, 25]);
  });

  it('rewards the first kept break of a day and is its check-in', () => {
    const session = plantedSession(noon(0));
    const begin = noon(1);
    expect(session.at(begin, (ctx) => startBreak(ctx, 20))).toEqual({
      ok: true,
      endsAt: begin + 20 * MIN,
    });
    expect(session.state.days[day(1)]).toBeUndefined();
    expect(session.at(begin + 1000, (ctx) => startBreak(ctx, 10))).toMatchObject({
      ok: false,
      reason: 'already-running',
    });
    session.at(begin + 2000, (ctx) => signalBreak(ctx, 'hidden'));
    session.at(begin + 20 * MIN, (ctx) => signalBreak(ctx, 'visible'));
    const xp = session.state.xp;
    const gp = session.state.tree.gp;
    const result = session.at(begin + 20 * MIN + 5000, (ctx) => finishBreak(ctx, 'outside'));
    expect(result).toMatchObject({ ok: true, rewarded: true });
    expect(session.eventsOf('checked-in')[0]).toMatchObject({ via: 'break' });
    expect(session.eventsOf('break-finished')[0]).toMatchObject({
      kept: true,
      keptMin: 20,
      xp: 25,
      gp: 2,
    });
    expect(session.state.xp).toBe(xp + 10 + 25 + 20);
    expect(session.state.tree.gp).toBe(gp + 8 + 2);
    expect(session.state.activeBreak).toBeNull();
    expect(session.state.breaks[0]).toMatchObject({
      kept: true,
      keptMin: 20,
      outcome: 'outside',
      xp: 25,
      gp: 2,
    });
    expect(session.state.badges['grass-toucher']?.tier).toBe(1);
    expect(session.state.days[day(1)]?.breakRewarded).toBe(true);
  });

  it('records later breaks without XP and enforces thirty minutes between them', () => {
    const session = plantedSession(noon(0));
    const run = (begin: number, minutes: number) => {
      session.at(begin, (ctx) => startBreak(ctx, minutes));
      session.at(begin + 1000, (ctx) => signalBreak(ctx, 'hidden'));
      return session.at(begin + minutes * MIN, (ctx) => finishBreak(ctx, 'rested'));
    };
    run(noon(0) + 1000, 10);
    const xp = session.state.xp;
    const end = noon(0) + 1000 + 10 * MIN;
    expect(breakCooldownMin(session.state, end + 5 * MIN)).toBe(25);
    expect(session.at(end + 5 * MIN, (ctx) => startBreak(ctx, 10))).toMatchObject({
      ok: false,
      reason: 'cooldown',
      waitMin: 25,
    });
    expect(run(end + 30 * MIN, 45)).toMatchObject({ ok: true, rewarded: false });
    expect(session.state.xp).toBe(xp);
    expect(session.state.breaks.map((entry) => [entry.kept, entry.xp])).toEqual([
      [true, 15],
      [true, 0],
    ]);
    expect(suggestedBreakMin(session.state)).toBe(45);
    expect(breakStats(session.state, [MON])).toEqual({
      minutesTotal: 55,
      minutesThisWeek: 55,
      breaksKept: 2,
    });
  });

  it('records nothing for "did not really take a break"', () => {
    const session = plantedSession(noon(0));
    session.at(noon(1), (ctx) => startBreak(ctx, 10));
    const result = session.at(noon(1) + 12 * MIN, (ctx) => finishBreak(ctx, 'none'));
    expect(result).toMatchObject({ ok: true, entry: null, rewarded: false });
    expect(session.state.breaks).toEqual([]);
    expect(session.state.days[day(1)]).toBeUndefined();
    expect(session.eventsOf('break-cancelled')).toHaveLength(1);
    expect(session.at(noon(1) + 13 * MIN, (ctx) => finishBreak(ctx, 'outside'))).toEqual({
      ok: false,
      reason: 'no-break',
    });
  });

  it('does not reward a break spent on the screen, and lets it be retried at once', () => {
    const session = plantedSession(noon(0));
    const begin = noon(1);
    session.at(begin, (ctx) => startBreak(ctx, 10));
    for (let second = 30; second <= 600; second += 30) {
      session.at(begin + second * 1000, (ctx) => signalBreak(ctx, 'input'));
    }
    const result = session.at(begin + 10 * MIN + 1000, (ctx) => finishBreak(ctx, 'outside'));
    expect(result).toMatchObject({ ok: true, rewarded: false });
    expect(session.state.breaks[0]).toMatchObject({ kept: false, xp: 0, gp: 0, keptMin: 0 });
    expect(session.state.days[day(1)]).toBeUndefined();
    expect(breakCooldownMin(session.state, begin + 11 * MIN)).toBe(0);
  });

  it('survives a reload: a break keeps running on wall-clock time', () => {
    const session = plantedSession(noon(0));
    session.at(noon(1), (ctx) => startBreak(ctx, 10));
    const restored = new GameSession(JSON.parse(JSON.stringify(session.state)));
    const result = restored.at(noon(1) + 15 * MIN, (ctx) => finishBreak(ctx, 'outside'));
    expect(result).toMatchObject({ ok: true, rewarded: true });
  });

  it('validates the start', () => {
    const session = plantedSession(noon(0));
    expect(session.at(noon(0) + 1, (ctx) => startBreak(ctx, 5))).toMatchObject({
      ok: false,
      reason: 'invalid-duration',
    });
    expect(session.at(noon(0) + 1, (ctx) => startBreak(ctx, Number.NaN))).toMatchObject({
      ok: false,
      reason: 'invalid-duration',
    });
    expect(suggestedBreakMin(session.state)).toBe(10);
    const visitor = new GameSession(createInitialState(noon(0)));
    expect(visitor.at(noon(0), (ctx) => startBreak(ctx, 10))).toMatchObject({
      ok: false,
      reason: 'not-onboarded',
    });
  });

  it('counts at most two breaks a day toward quests and the badge', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal' }));
    for (let round = 0; round < 3; round += 1) {
      const begin = noon(0) + 5000 + round * 45 * MIN;
      session.at(begin, (ctx) => startBreak(ctx, 10));
      session.at(begin + 1000, (ctx) => signalBreak(ctx, 'hidden'));
      session.at(begin + 10 * MIN, (ctx) => finishBreak(ctx, 'outside'));
    }
    expect(session.state.breaks.filter((entry) => entry.kept)).toHaveLength(3);
    expect(badgeMetric(session.state, 'breaks-kept')).toBe(2);
    expect(evaluateCondition({ kind: 'break', minutes: 10, min: 3 }, session.state, [MON])).toEqual(
      { current: 2, target: 3, done: false },
    );
    expect(dailyProgress(session.state, 'd_touch_grass', MON).done).toBe(true);
  });
});
