import type { QuizQuestion } from '@/data/content';
import { LESSON_QUESTIONS, scoreQuiz, type QuizScore } from '@/game';
import { createRng, shuffle } from '@/lib/rng';

/**
 * The quiz as plain data. A run is one attempt at a lesson's three questions; the page keeps it
 * in React state and mirrors the unfinished part to the device as a draft, so a quiz left midway
 * picks up at the first unanswered question. Nothing here touches the store or the clock.
 */

export type OptionIndex = 0 | 1 | 2;

/** What survives a reload: which attempt this is and what has been answered so far. */
export interface QuizDraft {
  /** 0-based attempt number; it seeds the option order, so a resumed quiz looks the same. */
  attempt: number;
  /** The chosen option of each answered question, as an index into the canonical `options`. */
  answers: OptionIndex[];
}

export interface QuizRun extends QuizDraft {
  /** The answer to the last question in `answers` is on screen with its explanation. */
  revealed: boolean;
}

export type QuizQuestions = readonly [QuizQuestion, QuizQuestion, QuizQuestion];

const isOption = (value: unknown): value is OptionIndex =>
  value === 0 || value === 1 || value === 2;

export function startRun(attempt: number): QuizRun {
  return { attempt: Math.max(0, Math.floor(attempt)), answers: [], revealed: false };
}

/** Continues a saved draft at its first unanswered question. A finished draft is not resumable. */
export function resumeRun(draft: QuizDraft | null | undefined): QuizRun | null {
  if (!draft || draft.answers.length === 0 || draft.answers.length >= LESSON_QUESTIONS) return null;
  return { attempt: draft.attempt, answers: [...draft.answers], revealed: false };
}

/** Index of the question on screen: the one just answered while its feedback shows, else the next. */
export function currentIndex(run: QuizRun): number {
  const index = run.revealed ? run.answers.length - 1 : run.answers.length;
  return Math.min(Math.max(index, 0), LESSON_QUESTIONS - 1);
}

/** Every question has an answer. */
export function isComplete(run: QuizRun): boolean {
  return run.answers.length >= LESSON_QUESTIONS;
}

/** Records an answer to the question on screen. A second answer to the same question is ignored. */
export function answerQuestion(run: QuizRun, option: OptionIndex): QuizRun {
  if (run.revealed || isComplete(run)) return run;
  return { ...run, answers: [...run.answers, option], revealed: true };
}

/** Moves on from the feedback to the next question. After the last question it changes nothing. */
export function nextQuestion(run: QuizRun): QuizRun {
  if (!run.revealed || isComplete(run)) return run;
  return { ...run, revealed: false };
}

export function runScore(run: Pick<QuizRun, 'answers'>, questions: QuizQuestions): QuizScore {
  return scoreQuiz(
    run.answers,
    questions.map((question) => question.correct),
  );
}

/**
 * The order the three options are shown in. Seeded by the user, the question and the attempt:
 * stable across reloads of the same attempt, different on a retry, so the position of the right
 * answer cannot be memorised.
 */
export function optionOrder(userSeed: number, questionId: string, attempt: number): OptionIndex[] {
  const options: OptionIndex[] = [0, 1, 2];
  return shuffle(createRng(userSeed, questionId, attempt), options);
}

/** Validates one stored draft; anything malformed is dropped rather than trusted. */
export function parseDraft(value: unknown): QuizDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const { attempt, answers } = value as { attempt?: unknown; answers?: unknown };
  if (typeof attempt !== 'number' || !Number.isInteger(attempt) || attempt < 0) return null;
  if (!Array.isArray(answers) || answers.length > LESSON_QUESTIONS) return null;
  if (!answers.every(isOption)) return null;
  return { attempt, answers: [...answers] };
}

/** Validates the stored map of drafts, keeping only lessons that still exist. */
export function parseDrafts(
  value: unknown,
  knownLessons: ReadonlySet<string>,
): Record<string, QuizDraft> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const drafts: Record<string, QuizDraft> = {};
  for (const [lessonId, raw] of Object.entries(value)) {
    if (!knownLessons.has(lessonId)) continue;
    const draft = parseDraft(raw);
    if (draft && draft.answers.length > 0 && draft.answers.length < LESSON_QUESTIONS) {
      drafts[lessonId] = draft;
    }
  }
  return drafts;
}
