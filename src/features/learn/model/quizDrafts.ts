import { LESSON_IDS } from '@/data/content';
import { STORAGE_PREFIX, gameEvents } from '@/game';
import { parseDrafts, type QuizDraft } from './quiz';

/**
 * Unfinished quizzes, kept on the device so a quiz left midway resumes where it stopped. The key
 * sits under the product's storage prefix, so "Reset" clears it with everything else. It is a
 * convenience, not game state: scores and XP are only ever written by the store.
 */
export const QUIZ_DRAFTS_KEY = `${STORAGE_PREFIX}learn-quiz`;

const KNOWN = new Set(LESSON_IDS);

/**
 * Non-null once the browser has refused storage (a private window, a full quota): from then on
 * drafts live here and last for the visit.
 */
let fallback: Record<string, QuizDraft> | null = null;

// A reset wipes the device's storage; drafts held in memory go with it.
gameEvents.on('state-reset', () => {
  if (fallback) fallback = {};
});

export function readQuizDrafts(): Record<string, QuizDraft> {
  if (typeof window === 'undefined') return {};
  if (fallback) return { ...fallback };
  try {
    const raw = window.localStorage.getItem(QUIZ_DRAFTS_KEY);
    return raw === null ? {} : parseDrafts(JSON.parse(raw), KNOWN);
  } catch {
    // Unreadable or unparsable: start clean rather than trust it.
    return {};
  }
}

function write(drafts: Record<string, QuizDraft>): void {
  if (typeof window === 'undefined') return;
  if (fallback) {
    fallback = { ...drafts };
    return;
  }
  try {
    if (Object.keys(drafts).length === 0) window.localStorage.removeItem(QUIZ_DRAFTS_KEY);
    else window.localStorage.setItem(QUIZ_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    fallback = { ...drafts };
  }
}

export function readQuizDraft(lessonId: string): QuizDraft | null {
  return readQuizDrafts()[lessonId] ?? null;
}

export function saveQuizDraft(lessonId: string, draft: QuizDraft): void {
  write({
    ...readQuizDrafts(),
    [lessonId]: { attempt: draft.attempt, answers: [...draft.answers] },
  });
}

export function clearQuizDraft(lessonId: string): void {
  const drafts = readQuizDrafts();
  if (!(lessonId in drafts)) return;
  delete drafts[lessonId];
  write(drafts);
}

/** Forgets the in-memory fallback, so the next call tries the device's storage again. For tests. */
export function resetQuizDraftFallback(): void {
  fallback = null;
}
