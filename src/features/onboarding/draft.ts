/**
 * Keeps the onboarding draft on the device, so a reload or a closed tab resumes on the same
 * screen with everything typed so far. Removed the moment the tree is planted. A private
 * window may refuse storage: every call then quietly does nothing and the flow lives in memory.
 */
import { BASELINE_QUESTIONS, GRID_BY_ID, type BaselineQuestionId } from '@/data/catalogue';
import { FOCUS_MAX, NAME_MAX, STORAGE_PREFIX, TREE_NAME_MAX, normalizeFocus } from '@/game';
import { SPECIES, type Species } from '@/world';
import {
  createDraft,
  isScreenId,
  type FocusSource,
  type LegacyChoice,
  type OnboardingDraft,
  type QuizStatus,
} from './flow';

export const DRAFT_KEY = `${STORAGE_PREFIX}onboarding`;

/** The landing page's demo leaves the species it grew here for the first-run flow to pick up. */
export const DEMO_CARRY_KEY = 'demoCarry';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function localStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function sessionStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const QUIZ_STATUSES: readonly QuizStatus[] = ['undecided', 'taking', 'paused', 'skipped', 'done'];
const FOCUS_SOURCES: readonly FocusSource[] = ['default', 'quiz', 'own'];
const LEGACY_CHOICES: readonly LegacyChoice[] = ['undecided', 'bring', 'fresh'];

const oneOf = <T extends string>(options: readonly T[], value: unknown): T | undefined =>
  options.find((option) => option === value);

const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

function parseAnswers(value: unknown): OnboardingDraft['answers'] {
  const answers: Partial<Record<BaselineQuestionId, string>> = {};
  if (typeof value !== 'object' || value === null) return answers;
  const record = value as Record<string, unknown>;
  for (const question of BASELINE_QUESTIONS) {
    const answer = record[question.id];
    if (typeof answer === 'string' && question.options.some((option) => option.id === answer)) {
      answers[question.id] = answer;
    }
  }
  return answers;
}

/**
 * Rebuilds a draft from whatever was stored. Every field is checked on its own and falls
 * back to a fresh draft's value, so an old or hand-edited entry can never break the flow.
 * Returns `null` when the text is not a draft at all.
 */
export function parseDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.v !== 1) return null;

  const nameSeed = typeof record.nameSeed === 'number' ? record.nameSeed >>> 0 : 1;
  const fresh = createDraft({ nameSeed });
  const answers = parseAnswers(record.answers);
  const complete = BASELINE_QUESTIONS.every((question) => answers[question.id] !== undefined);
  let quiz = oneOf(QUIZ_STATUSES, record.quiz) ?? fresh.quiz;
  // The status follows the answers, never the other way round.
  if (quiz === 'done' && !complete) quiz = 'taking';
  if (quiz === 'taking' && complete) quiz = 'done';

  const region =
    typeof record.region === 'string' && GRID_BY_ID.has(record.region)
      ? (record.region as OnboardingDraft['region'])
      : fresh.region;
  const focus = Array.isArray(record.focus)
    ? (normalizeFocus(record.focus) ?? []).slice(0, FOCUS_MAX)
    : fresh.focus;
  let focusSource = oneOf(FOCUS_SOURCES, record.focusSource) ?? fresh.focusSource;
  if (focusSource === 'quiz' && quiz !== 'done') focusSource = 'own';

  return {
    v: 1,
    screen: isScreenId(record.screen) ? record.screen : fresh.screen,
    name: text(record.name, NAME_MAX) ?? fresh.name,
    region,
    regionSet: record.regionSet === true,
    species: oneOf<Species>(SPECIES, record.species) ?? fresh.species,
    treeName: text(record.treeName, TREE_NAME_MAX) ?? fresh.treeName,
    nameSeed,
    nameIndex:
      typeof record.nameIndex === 'number' && Number.isInteger(record.nameIndex)
        ? Math.max(0, record.nameIndex)
        : 0,
    quiz,
    quizAsksRegion: record.quizAsksRegion === true,
    answers,
    focus,
    focusSource,
    legacy: oneOf(LEGACY_CHOICES, record.legacy) ?? fresh.legacy,
  };
}

export function loadDraft(store: Store | null = localStore()): OnboardingDraft | null {
  try {
    return parseDraft(store?.getItem(DRAFT_KEY) ?? null);
  } catch {
    return null;
  }
}

/** Returns false when the draft could not be written (the flow then lives in memory). */
export function saveDraft(draft: OnboardingDraft, store: Store | null = localStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(store: Store | null = localStore()): void {
  try {
    store?.removeItem(DRAFT_KEY);
  } catch {
    // Nothing was stored, so there is nothing to remove.
  }
}

/** The species grown in the landing page's demo, if the visitor came from it. */
export function readDemoSpecies(store: Store | null = sessionStore()): Species | undefined {
  try {
    const raw = store?.getItem(DEMO_CARRY_KEY);
    if (!raw) return undefined;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return undefined;
    return oneOf<Species>(SPECIES, (data as Record<string, unknown>).species);
  } catch {
    return undefined;
  }
}
