/**
 * Learn rules (product spec section 7.1): lesson states, quiz scoring, XP exactly once
 * per lesson, myth-card first flips and the daily fact. Lesson content lives in
 * `src/data`; this module only knows the ten slugs and the areas they belong to.
 */
import type { CategoryId } from '@/data/catalogue';
import { diffDays, type DayKey } from '@/lib/dates';
import { checkIn } from './calendar';
import { grantXp, writeActivity, type Ctx } from './ctx';
import {
  LESSON_PASS_SCORE,
  LESSON_QUESTIONS,
  MYTH_COUNT,
  QUEST_EPOCH_DAY,
  XP_LESSON_PASS,
  XP_LESSON_PERFECT_BONUS,
  XP_MYTH_FLIP,
} from './economy';
import { isOnboarded } from './state';
import type { GameState, LessonProgress, QuizScore } from './types';

/** The ten lessons in reading order, with the focus areas that make one "recommended". */
export const LESSONS: readonly { slug: string; categories: readonly CategoryId[] }[] = [
  { slug: 'the-blanket', categories: [] },
  { slug: 'where-it-comes-from', categories: [] },
  { slug: 'big-levers', categories: ['move', 'eat', 'power'] },
  { slug: 'on-your-plate', categories: ['eat'] },
  { slug: 'food-we-never-eat', categories: ['eat', 'waste'] },
  { slug: 'getting-around', categories: ['move'] },
  { slug: 'power-at-home', categories: ['power', 'water'] },
  { slug: 'stuff', categories: ['stuff'] },
  { slug: 'recycling-honestly', categories: ['waste'] },
  { slug: 'good-news', categories: ['nature'] },
];

export const LESSON_SLUGS: readonly string[] = LESSONS.map((lesson) => lesson.slug);
export const DAILY_FACT_COUNT = 30;

/** Fact number (1 to 30) to the lesson its "Tell me more" opens; fact 28 opens Touch Grass. */
const FACT_LESSON: Readonly<Record<number, string>> = {
  1: 'power-at-home',
  2: 'power-at-home',
  13: 'power-at-home',
  14: 'power-at-home',
  22: 'power-at-home',
  3: 'good-news',
  4: 'good-news',
  21: 'good-news',
  29: 'good-news',
  30: 'good-news',
  5: 'recycling-honestly',
  15: 'recycling-honestly',
  18: 'recycling-honestly',
  6: 'food-we-never-eat',
  7: 'food-we-never-eat',
  25: 'food-we-never-eat',
  26: 'food-we-never-eat',
  8: 'on-your-plate',
  9: 'on-your-plate',
  23: 'on-your-plate',
  10: 'getting-around',
  11: 'getting-around',
  12: 'getting-around',
  16: 'stuff',
  17: 'stuff',
  19: 'the-blanket',
  20: 'the-blanket',
  24: 'big-levers',
  27: 'where-it-comes-from',
};

export interface DailyFactRef {
  /** 1 to 30. */
  number: number;
  /** The lesson to open, or `null` for the fact that opens Touch Grass. */
  lesson: string | null;
  opensTouchGrass: boolean;
}

/** Which of the thirty facts a day shows: stable per user, different per day. */
export function dailyFact(day: DayKey, userSeed: number): DailyFactRef {
  const offset = diffDays(QUEST_EPOCH_DAY, day) + (userSeed % DAILY_FACT_COUNT);
  const index = ((offset % DAILY_FACT_COUNT) + DAILY_FACT_COUNT) % DAILY_FACT_COUNT;
  const number = index + 1;
  const lesson = FACT_LESSON[number] ?? null;
  return { number, lesson, opensTouchGrass: lesson === null };
}

export type LessonStatus = 'new' | 'read' | 'passed';

const NEW_LESSON: LessonProgress = {
  openedTs: null,
  readTs: null,
  attempts: 0,
  bestScore: 0,
  firstAttemptScore: null,
  passedTs: null,
};

export function lessonProgress(state: Pick<GameState, 'learn'>, slug: string): LessonProgress {
  return state.learn.lessons[slug] ?? NEW_LESSON;
}

export function lessonStatus(progress: LessonProgress): LessonStatus {
  if (progress.passedTs !== null) return 'passed';
  return progress.readTs !== null ? 'read' : 'new';
}

export function passedLessons(state: Pick<GameState, 'learn'>): string[] {
  return LESSON_SLUGS.filter((slug) => state.learn.lessons[slug]?.passedTs != null);
}

/** "Recommended": the first unpassed lesson in the user's focus areas, else the first unpassed. */
export function recommendedLesson(state: Pick<GameState, 'learn' | 'profile'>): string | null {
  const open = LESSONS.filter((lesson) => state.learn.lessons[lesson.slug]?.passedTs == null);
  const inFocus = open.find((lesson) =>
    lesson.categories.some((category) => state.profile.focus.includes(category)),
  );
  return (inFocus ?? open[0])?.slug ?? null;
}

/** Correct answers out of three. `answers[i]` is the option the user picked for question i. */
export function scoreQuiz(answers: readonly number[], correct: readonly number[]): QuizScore {
  let score = 0;
  for (let index = 0; index < Math.min(LESSON_QUESTIONS, correct.length); index += 1) {
    if (answers[index] !== undefined && answers[index] === correct[index]) score += 1;
  }
  return Math.min(3, score) as QuizScore;
}

export function isPass(score: number): boolean {
  return score >= LESSON_PASS_SCORE;
}

function saveLesson(ctx: Ctx, slug: string, patch: Partial<LessonProgress>): LessonProgress {
  const next = { ...lessonProgress(ctx.s, slug), ...patch };
  ctx.s.learn.lessons = { ...ctx.s.learn.lessons, [slug]: next };
  return next;
}

/** A lesson was opened. Re-opening counts again for "read a lesson" quests. */
export function openLesson(ctx: Ctx, slug: string): boolean {
  if (!LESSON_SLUGS.includes(slug)) return false;
  if (lessonProgress(ctx.s, slug).openedTs === null) saveLesson(ctx, slug, { openedTs: ctx.now });
  ctx.s.learn.opens = [
    ...ctx.s.learn.opens,
    { ts: ctx.now, day: ctx.today, kind: 'lesson', id: slug },
  ];
  ctx.events.push({ type: 'lesson-opened', slug });
  return true;
}

/** A lesson was read: 80% scrolled or 30 seconds open. */
export function markLessonRead(ctx: Ctx, slug: string): boolean {
  if (!LESSON_SLUGS.includes(slug)) return false;
  const progress = lessonProgress(ctx.s, slug);
  if (progress.readTs !== null) return false;
  saveLesson(ctx, slug, { readTs: ctx.now, openedTs: progress.openedTs ?? ctx.now });
  return true;
}

export type LessonResult =
  | {
      ok: true;
      passed: boolean;
      firstPass: boolean;
      perfect: boolean;
      xp: number;
      score: QuizScore;
    }
  | { ok: false; reason: 'unknown-lesson' | 'invalid-score' };

/**
 * Records a finished quiz. Passing (2 of 3) pays 30 XP the first time, plus 10 when the
 * very first attempt was 3 of 3. Retries are unlimited and pay nothing more.
 */
export function completeLesson(ctx: Ctx, slug: string, score: number): LessonResult {
  if (!LESSON_SLUGS.includes(slug)) return { ok: false, reason: 'unknown-lesson' };
  if (!Number.isInteger(score) || score < 0 || score > LESSON_QUESTIONS) {
    return { ok: false, reason: 'invalid-score' };
  }
  const quizScore = score as QuizScore;
  const before = lessonProgress(ctx.s, slug);
  const firstAttempt = before.attempts === 0;
  const passed = isPass(quizScore);
  const firstPass = passed && before.passedTs === null;
  const firstAttemptScore = firstAttempt ? quizScore : before.firstAttemptScore;
  const perfect = firstPass && firstAttemptScore === 3 && quizScore === 3 && firstAttempt;

  saveLesson(ctx, slug, {
    openedTs: before.openedTs ?? ctx.now,
    readTs: before.readTs ?? ctx.now,
    attempts: before.attempts + 1,
    bestScore: Math.max(before.bestScore, quizScore) as QuizScore,
    firstAttemptScore,
    passedTs: firstPass ? ctx.now : before.passedTs,
  });

  let xp = 0;
  if (firstPass) {
    if (isOnboarded(ctx.s)) checkIn(ctx, 'lesson');
    xp = XP_LESSON_PASS + (perfect ? XP_LESSON_PERFECT_BONUS : 0);
    grantXp(ctx, xp, 'lesson');
    writeActivity(ctx, 'lesson', `Lesson passed: ${slug.replaceAll('-', ' ')}.`);
  }
  ctx.events.push({
    type: 'lesson-completed',
    slug,
    score: quizScore,
    passed,
    firstPass,
    perfect,
    xp,
  });
  return { ok: true, passed, firstPass, perfect, xp, score: quizScore };
}

/** A myth card was flipped. The first flip of each card pays 5 XP; every flip counts as "opened". */
export function flipMyth(ctx: Ctx, myth: number): { ok: boolean; first: boolean; xp: number } {
  if (!Number.isInteger(myth) || myth < 1 || myth > MYTH_COUNT)
    return { ok: false, first: false, xp: 0 };
  const first = !ctx.s.learn.mythsFlipped.includes(myth);
  ctx.s.learn.opens = [
    ...ctx.s.learn.opens,
    { ts: ctx.now, day: ctx.today, kind: 'myth', id: String(myth) },
  ];
  let xp = 0;
  if (first) {
    ctx.s.learn.mythsFlipped = [...ctx.s.learn.mythsFlipped, myth].sort((a, b) => a - b);
    xp = XP_MYTH_FLIP;
    grantXp(ctx, xp, 'myth');
  }
  ctx.events.push({ type: 'myth-flipped', myth, first, xp });
  return { ok: true, first, xp };
}
