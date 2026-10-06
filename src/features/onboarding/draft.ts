/**
 * Keeps the onboarding draft on the device, so a reload or a closed tab resumes on the same
 * screen with everything typed so far. Removed the moment the tree is planted. A private
 * window may refuse storage: every call then quietly does nothing and the flow lives in memory.
 */
import { BASELINE_QUESTIONS, type BaselineQuestionId } from '@/data/catalogue';
import { NAME_MAX, STORAGE_PREFIX, TREE_NAME_MAX } from '@/game';
import { SPECIES, type Species } from '@/world';
import {
  DRAFT_VERSION,
  createDraft,
  isScreenId,
  type LegacyChoice,
  type OnboardingDraft,
  type QuizStatus,
} from './flow';

export const DRAFT_KEY = `${STORAGE_PREFIX}onboarding`;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function localStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const QUIZ_STATUSES: readonly QuizStatus[] = ['undecided', 'taking', 'skipped', 'done'];
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
 * Returns `null` when the text is not a draft of this version at all.
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
  if (record.v !== DRAFT_VERSION) return null;

  const nameSeed = typeof record.nameSeed === 'number' ? record.nameSeed >>> 0 : 1;
  const fresh = createDraft({ nameSeed });
  const answers = parseAnswers(record.answers);
  const complete = BASELINE_QUESTIONS.every((question) => answers[question.id] !== undefined);
  let quiz = oneOf(QUIZ_STATUSES, record.quiz) ?? fresh.quiz;
  // The status follows the answers, never the other way round.
  if (quiz === 'done' && !complete) quiz = 'taking';
  if (quiz === 'taking' && complete) quiz = 'done';

  return {
    v: DRAFT_VERSION,
    screen: isScreenId(record.screen) ? record.screen : fresh.screen,
    name: text(record.name, NAME_MAX) ?? fresh.name,
    species: oneOf<Species>(SPECIES, record.species) ?? fresh.species,
    treeName: text(record.treeName, TREE_NAME_MAX) ?? fresh.treeName,
    nameSeed,
    nameIndex:
      typeof record.nameIndex === 'number' && Number.isInteger(record.nameIndex)
        ? Math.max(0, record.nameIndex)
        : 0,
    quiz,
    answers,
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
