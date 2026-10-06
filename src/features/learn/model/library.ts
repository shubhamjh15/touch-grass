import {
  FACTS,
  LESSONS,
  LESSON_BY_ID,
  LESSON_CATEGORY_BY_ID,
  type Fact,
  type Lesson,
  type LessonCategoryId,
} from '@/data/content';
import type { LearnBoard, LessonProgress, LessonStatus, QuizScore } from '@/game';
import { LESSON_QUESTIONS } from '@/game';
import { pluralize } from '@/lib/format';
import type { QuizDraft } from './quiz';

/** One lesson as the library shows it: the content joined with what this device remembers. */
export interface LessonRow {
  lesson: Lesson;
  /** 1-based reading order: "LESSON 03". */
  number: number;
  status: LessonStatus;
  bestScore: QuizScore;
  attempts: number;
  /** When the lesson was last opened; `null` when it never was. */
  openedTs: number | null;
  /** Questions already answered in a quiz that was left midway; 0 when there is none. */
  quizAnswered: number;
}

const UNOPENED: LessonProgress = {
  openedTs: null,
  readTs: null,
  attempts: 0,
  bestScore: 0,
  firstAttemptScore: null,
  passedTs: null,
};

/** Joins the ten lessons with the saved progress and any unfinished quizzes. */
export function buildLibrary(
  board: Pick<LearnBoard, 'lessons'>,
  drafts: Readonly<Record<string, QuizDraft>> = {},
): LessonRow[] {
  const bySlug = new Map(board.lessons.map((view) => [view.slug, view]));
  return LESSONS.map((lesson, index) => {
    const view = bySlug.get(lesson.id);
    const progress = view?.progress ?? UNOPENED;
    const answered = drafts[lesson.id]?.answers.length ?? 0;
    return {
      lesson,
      number: index + 1,
      status: view?.status ?? 'new',
      bestScore: progress.bestScore,
      attempts: progress.attempts,
      openedTs: progress.openedTs,
      quizAnswered: answered > 0 && answered < LESSON_QUESTIONS ? answered : 0,
    };
  });
}

export type TopicFilter = 'all' | LessonCategoryId;

/** Reads the `?topic=` parameter; anything unknown means "all". */
export function parseTopic(value: string | null | undefined): TopicFilter {
  // Own keys only: "constructor" is in every object, and it is not a topic.
  return value && Object.hasOwn(LESSON_CATEGORY_BY_ID, value) ? (value as LessonCategoryId) : 'all';
}

export function filterLessons(rows: readonly LessonRow[], topic: TopicFilter): LessonRow[] {
  return topic === 'all' ? [...rows] : rows.filter((row) => row.lesson.category === topic);
}

/** How many lessons each filter chip would show. */
export function topicCounts(rows: readonly LessonRow[]): Record<TopicFilter, number> {
  const counts = { all: rows.length } as Record<TopicFilter, number>;
  for (const id of Object.keys(LESSON_CATEGORY_BY_ID) as LessonCategoryId[]) counts[id] = 0;
  for (const row of rows) counts[row.lesson.category] += 1;
  return counts;
}

/** Why a lesson is the one on the featured card. */
export type FeaturedReason = 'start' | 'resume-quiz' | 'continue' | 'recommended';

export interface FeaturedLesson {
  row: LessonRow;
  reason: FeaturedReason;
}

/**
 * The one lesson to do next. An unfinished quiz comes first, then a lesson that was opened but
 * not passed (the most recent one), then a true first run starts with lesson 1, and after that
 * the engine's recommendation (the first unpassed lesson in the user's focus areas). `null`
 * means all ten are passed.
 */
export function featuredLesson(
  rows: readonly LessonRow[],
  recommended: string | null,
): FeaturedLesson | null {
  const open = rows.filter((row) => row.status !== 'passed');
  if (open.length === 0) return null;

  const midQuiz = open.find((row) => row.quizAnswered > 0);
  if (midQuiz) return { row: midQuiz, reason: 'resume-quiz' };

  const started = open
    .filter((row) => row.openedTs !== null)
    .sort((a, b) => (b.openedTs ?? 0) - (a.openedTs ?? 0))[0];
  if (started) return { row: started, reason: 'continue' };

  const anyOpened = rows.some((row) => row.openedTs !== null);
  const first = open[0] as LessonRow;
  if (!anyOpened) return { row: first, reason: 'start' };

  const pick = open.find((row) => row.lesson.id === recommended) ?? first;
  return { row: pick, reason: 'recommended' };
}

export interface LibrarySummary {
  total: number;
  passed: number;
  /** Opened or read, not passed yet. */
  started: number;
  /** Every lesson passed. */
  complete: boolean;
}

export function librarySummary(rows: readonly LessonRow[]): LibrarySummary {
  const passed = rows.filter((row) => row.status === 'passed').length;
  const started = rows.filter((row) => row.status !== 'passed' && row.openedTs !== null).length;
  return { total: rows.length, passed, started, complete: passed === rows.length };
}

/** "LESSON 03 · 2 MIN": the mono line above a lesson title. */
export function lessonSlug(number: number, readingMinutes: number): string {
  return `Lesson ${String(number).padStart(2, '0')} · ${readingMinutes} min`;
}

/** What a screen reader hears for a lesson's state: "Passed, 3 of 3". */
export function statusText(row: Pick<LessonRow, 'status' | 'bestScore' | 'quizAnswered'>): string {
  if (row.status === 'passed') return `Passed, ${row.bestScore} of ${LESSON_QUESTIONS}`;
  if (row.quizAnswered > 0) {
    return `Quiz in progress, ${row.quizAnswered} of ${LESSON_QUESTIONS} answered`;
  }
  return row.status === 'read' ? 'Read, quiz not passed yet' : 'New';
}

/** "2 min read · 3 questions". */
export function lessonLength(lesson: Pick<Lesson, 'readingMinutes'>): string {
  return `${lesson.readingMinutes} min read · ${pluralize(LESSON_QUESTIONS, 'question')}`;
}

export interface LessonNeighbours {
  number: number;
  previous: Lesson | null;
  next: Lesson | null;
}

/** Where a lesson sits in the reading order; `null` for a slug that does not exist. */
export function lessonNeighbours(lessonId: string): LessonNeighbours | null {
  const index = LESSONS.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return null;
  return {
    number: index + 1,
    previous: LESSONS[index - 1] ?? null,
    next: LESSONS[index + 1] ?? null,
  };
}

/** The lesson to offer after this one: the next unpassed lesson in reading order, wrapping round. */
export function nextUnpassed(rows: readonly LessonRow[], lessonId: string): LessonRow | null {
  const index = rows.findIndex((row) => row.lesson.id === lessonId);
  if (index < 0) return null;
  for (let step = 1; step < rows.length; step += 1) {
    const row = rows[(index + step) % rows.length] as LessonRow;
    if (row.status !== 'passed') return row;
  }
  return null;
}

/** The fact a day shows, from the engine's 1-based fact number. */
export function factByNumber(number: number): Fact | null {
  return FACTS[number - 1] ?? null;
}

/** A fact's "Tell me more" lesson, when it has one and the lesson still exists. */
export function factLesson(fact: Fact): Lesson | null {
  return fact.link.kind === 'lesson' ? (LESSON_BY_ID.get(fact.link.lessonId) ?? null) : null;
}
