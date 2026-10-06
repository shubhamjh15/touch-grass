/**
 * The first-run flow as data: which screens exist, in which order, what each one needs
 * before the next opens, and how every answer changes the draft. Pure, so the whole flow
 * is testable without a browser.
 *
 * Everything typed before the seed is planted lives in one {@link OnboardingDraft}; the game
 * store only learns about it when the tree is planted.
 */
import {
  BASELINE_QUESTIONS,
  DEFAULT_REGION,
  GRID_BY_ID,
  type BaselineQuestionId,
  type BaselineSegment,
  type CategoryId,
  type RegionId,
} from '@/data/catalogue';
import {
  BASELINE_SEGMENTS,
  FOCUS_MAX,
  NAME_MAX,
  TREE_NAME_MAX,
  computeBaseline,
  parseBaselineAnswers,
  suggestFocus,
  type BaselineAnswers,
  type BaselineTonnes,
} from '@/game';
import { createRng, shuffle } from '@/lib/rng';
import { SPECIES, type Species } from '@/world';
import { TREE_NAMES } from './copy';

// ── Screens ─────────────────────────────────────────────────────────────────

export const QUIZ_QUESTION_IDS: readonly BaselineQuestionId[] = BASELINE_QUESTIONS.map(
  (question) => question.id,
);

export type QuizScreenId = `quiz-${BaselineQuestionId}`;

/**
 * - `legacy`: only when the earlier version of the app left real logs in this browser.
 * - `name` → `tree` → `line` (take the quiz or skip it) → the quiz and its `result` → `plant`.
 */
export type ScreenId = 'legacy' | 'name' | 'tree' | 'line' | QuizScreenId | 'result' | 'plant';

const QUESTION_SCREENS: readonly QuizScreenId[] = QUIZ_QUESTION_IDS.map(
  (id): QuizScreenId => `quiz-${id}`,
);

const ALL_SCREENS: readonly ScreenId[] = [
  'legacy',
  'name',
  'tree',
  'line',
  ...QUESTION_SCREENS,
  'result',
  'plant',
];

export function isScreenId(value: unknown): value is ScreenId {
  return typeof value === 'string' && ALL_SCREENS.some((screen) => screen === value);
}

/** The quiz question a screen asks, or `null` for every other screen. */
export function questionOf(screen: ScreenId): BaselineQuestionId | null {
  return QUIZ_QUESTION_IDS.find((id) => screen === `quiz-${id}`) ?? null;
}

// ── The draft ───────────────────────────────────────────────────────────────

/**
 * - `undecided`: the starting-line choice has not been made.
 * - `taking`: in the quiz. `done`: every question answered.
 * - `skipped`: "Skip for now", on the first screen or part-way through; answers are kept.
 */
export type QuizStatus = 'undecided' | 'taking' | 'skipped' | 'done';

export type LegacyChoice = 'undecided' | 'bring' | 'fresh';

export const DRAFT_VERSION = 2;

export interface OnboardingDraft {
  v: typeof DRAFT_VERSION;
  screen: ScreenId;
  /** As typed; trimmed and defaulted to "Friend" by the engine at planting. */
  name: string;
  species: Species;
  treeName: string;
  /** Fixes the order the name suggester walks through, so a reload does not reshuffle it. */
  nameSeed: number;
  nameIndex: number;
  quiz: QuizStatus;
  answers: Partial<Record<BaselineQuestionId, string>>;
  legacy: LegacyChoice;
}

/** What the flow needs to know about the world outside the draft. */
export interface FlowContext {
  /** Real logs from the old app were found and have not been turned down. */
  legacyOffered: boolean;
}

export interface DraftSeed {
  nameSeed: number;
  species?: Species;
}

/** The suggester's names in this draft's order. */
export function suggestedNames(nameSeed: number): string[] {
  return shuffle(createRng('tree-names', nameSeed), TREE_NAMES);
}

export function createDraft({ nameSeed, species }: DraftSeed): OnboardingDraft {
  const seed = nameSeed >>> 0;
  return {
    v: DRAFT_VERSION,
    screen: 'name',
    name: '',
    species: species ?? 'oak',
    treeName: suggestedNames(seed)[0] ?? TREE_NAMES[0],
    nameSeed: seed,
    nameIndex: 0,
    quiz: 'undecided',
    answers: {},
    legacy: 'undecided',
  };
}

// ── Reading the draft ───────────────────────────────────────────────────────

const collapse = (value: string) => value.replace(/\s+/g, ' ');

/** The tree name as the engine will store it. */
export function cleanTreeName(value: string): string {
  return collapse(value).trim().slice(0, TREE_NAME_MAX);
}

export function cleanUserName(value: string): string {
  return collapse(value).trim().slice(0, NAME_MAX);
}

/** The name to print while the user is still typing: never empty. */
export function treeNameOr(draft: OnboardingDraft, fallback = 'your tree'): string {
  return cleanTreeName(draft.treeName) || fallback;
}

export function treeNameError(draft: OnboardingDraft): string | null {
  return cleanTreeName(draft.treeName) ? null : 'Give your tree a name.';
}

export function completeAnswers(draft: OnboardingDraft): BaselineAnswers | null {
  return parseBaselineAnswers(draft.answers);
}

export function answeredCount(draft: OnboardingDraft): number {
  return QUIZ_QUESTION_IDS.filter((id) => draft.answers[id] !== undefined).length;
}

/**
 * The electricity grid the estimate uses: the region the game holds (world average until the
 * user sets one in Me), or the world average when that is not a region we know.
 */
export function gridRegion(region: string): RegionId {
  return GRID_BY_ID.get(region)?.id ?? DEFAULT_REGION;
}

/** The starting line this draft would produce in `region`, or `null` while a question is open. */
export function draftBaseline(draft: OnboardingDraft, region: string): BaselineTonnes | null {
  const answers = completeAnswers(draft);
  return answers ? computeBaseline(answers, gridRegion(region)) : null;
}

/** The focus areas the tree starts with: the quiz's suggestion, or Eat + Move without one. */
export function draftFocus(draft: OnboardingDraft, region: string): CategoryId[] {
  const baseline = draft.quiz === 'done' ? draftBaseline(draft, region) : null;
  return suggestFocus(baseline).slice(0, FOCUS_MAX);
}

// ── Order ───────────────────────────────────────────────────────────────────

/** The screens of this particular run, first to last. */
export function screensFor(draft: OnboardingDraft, context: FlowContext): ScreenId[] {
  const screens: ScreenId[] = [];
  if (context.legacyOffered) screens.push('legacy');
  screens.push('name', 'tree', 'line');
  if (draft.quiz === 'taking' || draft.quiz === 'done') screens.push(...QUESTION_SCREENS, 'result');
  screens.push('plant');
  return screens;
}

/** Why the flow may not move past `screen` yet, or `null` when it may. */
export function blockerOf(screen: ScreenId, draft: OnboardingDraft): string | null {
  if (screen === 'legacy') {
    return draft.legacy === 'undecided' ? 'Choose what happens to your old logs.' : null;
  }
  if (screen === 'tree') return treeNameError(draft);
  if (screen === 'line') {
    return draft.quiz === 'undecided' ? 'Take the quiz or skip it for now.' : null;
  }
  const question = questionOf(screen);
  if (question) return draft.answers[question] === undefined ? 'Pick the closest answer.' : null;
  if (screen === 'result') return completeAnswers(draft) ? null : 'Answer every question first.';
  return null;
}

/**
 * The screen to show when `wanted` is asked for: `wanted` itself when everything before it
 * is in order, otherwise the first screen that still needs something. Keeps a stale history
 * entry or a hand-edited draft from skipping a required answer.
 */
export function reachable(
  wanted: ScreenId,
  draft: OnboardingDraft,
  context: FlowContext,
): ScreenId {
  const screens = screensFor(draft, context);
  const first = screens[0] ?? 'name';
  const target = screens.indexOf(wanted);
  if (target < 0) {
    // A quiz screen that is no longer part of the run: the choice screen stands in for it.
    return questionOf(wanted) !== null || wanted === 'result'
      ? reachable('line', draft, context)
      : first;
  }
  for (let index = 0; index < target; index += 1) {
    const screen = screens[index];
    if (screen !== undefined && blockerOf(screen, draft) !== null) return screen;
  }
  return wanted;
}

export function nextScreen(draft: OnboardingDraft, context: FlowContext): ScreenId | null {
  const screens = screensFor(draft, context);
  const index = screens.indexOf(draft.screen);
  return index >= 0 ? (screens[index + 1] ?? null) : (screens[0] ?? null);
}

export function previousScreen(draft: OnboardingDraft, context: FlowContext): ScreenId | null {
  const screens = screensFor(draft, context);
  const index = screens.indexOf(draft.screen);
  return index > 0 ? (screens[index - 1] ?? null) : null;
}

/** Where a half-finished quiz picks up: the first question without an answer. */
export function quizResumeScreen(draft: OnboardingDraft): ScreenId {
  const open = QUIZ_QUESTION_IDS.find((id) => draft.answers[id] === undefined);
  return open ? `quiz-${open}` : 'result';
}

// ── Progress ────────────────────────────────────────────────────────────────

/**
 * The quiz covers five things: food, getting around, flights, home and stuff. Getting around
 * needs two taps (how, then how far), so it is one question in two parts.
 */
export const QUIZ_TOPICS: readonly BaselineSegment[] = BASELINE_SEGMENTS;

/** "Question 2 of 5": which of the five topics a quiz screen belongs to. */
export function quizPosition(screen: ScreenId): { index: number; total: number } | null {
  const id = questionOf(screen);
  const segment = BASELINE_QUESTIONS.find((question) => question.id === id)?.segment;
  if (!segment) return null;
  return { index: QUIZ_TOPICS.indexOf(segment) + 1, total: QUIZ_TOPICS.length };
}

const QUIZ_FROM = 0.5;
const QUIZ_TO = 0.85;

/**
 * How full the thin bar at the top is, 0 to 1. Fixed per screen rather than counted from the
 * run, so starting the quiz never makes the bar jump backwards.
 */
export function progressOf(screen: ScreenId): number {
  switch (screen) {
    case 'legacy':
      return 0.05;
    case 'name':
      return 0.15;
    case 'tree':
      return 0.35;
    case 'line':
      return QUIZ_FROM;
    case 'result':
      return 0.92;
    case 'plant':
      return 1;
    default: {
      const index = QUESTION_SCREENS.indexOf(screen);
      return QUIZ_FROM + ((QUIZ_TO - QUIZ_FROM) * (index + 1)) / QUESTION_SCREENS.length;
    }
  }
}

/** The resume point the game keeps (`onboarding.step`, 0 to 7). */
export function engineStep(screen: ScreenId): number {
  switch (screen) {
    case 'legacy':
      return 0;
    case 'name':
      return 2;
    case 'tree':
      return 3;
    case 'plant':
      return 7;
    default:
      return 4;
  }
}

/** The screen a saved engine step stands for, when the draft itself is gone. */
export function screenOfStep(step: number): ScreenId {
  const rounded = Number.isFinite(step) ? Math.round(step) : 0;
  if (rounded <= 2) return 'name';
  if (rounded === 3) return 'tree';
  if (rounded <= 6) return 'line';
  return 'plant';
}

// ── Changing the draft ──────────────────────────────────────────────────────

export type DraftAction =
  | { type: 'go'; screen: ScreenId }
  | { type: 'name'; value: string }
  | { type: 'species'; species: Species }
  | { type: 'tree-name'; value: string }
  | { type: 'suggest-name' }
  | { type: 'legacy'; choice: Exclude<LegacyChoice, 'undecided'> }
  | { type: 'quiz-start' }
  | { type: 'quiz-skip' }
  | { type: 'answer'; question: BaselineQuestionId; option: string };

const isKnownOption = (question: BaselineQuestionId, option: string) =>
  BASELINE_QUESTIONS.some(
    (entry) => entry.id === question && entry.options.some((candidate) => candidate.id === option),
  );

/** While the quiz is open its status follows the answers: all given means done. */
function withQuizStatus(draft: OnboardingDraft): OnboardingDraft {
  if (draft.quiz !== 'taking' && draft.quiz !== 'done') return draft;
  const quiz: QuizStatus = completeAnswers(draft) ? 'done' : 'taking';
  return quiz === draft.quiz ? draft : { ...draft, quiz };
}

/** Every way the draft can change. Unknown or impossible input returns the draft untouched. */
export function reduceDraft(draft: OnboardingDraft, action: DraftAction): OnboardingDraft {
  switch (action.type) {
    case 'go':
      return action.screen === draft.screen ? draft : { ...draft, screen: action.screen };
    case 'name':
      return { ...draft, name: collapse(action.value).slice(0, NAME_MAX) };
    case 'species':
      return SPECIES.includes(action.species) ? { ...draft, species: action.species } : draft;
    case 'tree-name':
      return { ...draft, treeName: collapse(action.value).slice(0, TREE_NAME_MAX) };
    case 'suggest-name': {
      const names = suggestedNames(draft.nameSeed);
      let index = (draft.nameIndex + 1) % names.length;
      // Never suggest what is already in the field.
      if (names[index] === cleanTreeName(draft.treeName)) index = (index + 1) % names.length;
      return { ...draft, nameIndex: index, treeName: names[index] ?? draft.treeName };
    }
    case 'legacy':
      return { ...draft, legacy: action.choice };
    case 'quiz-start':
      return withQuizStatus({ ...draft, quiz: 'taking' });
    case 'quiz-skip':
      return draft.quiz === 'skipped' ? draft : { ...draft, quiz: 'skipped' };
    case 'answer':
      if (!isKnownOption(action.question, action.option)) return draft;
      return withQuizStatus({
        ...draft,
        answers: { ...draft.answers, [action.question]: action.option },
      });
  }
}

/** What planting hands to the engine. The region stays whatever the game already holds. */
export interface PlantInput {
  name: string;
  treeName: string;
  species: Species;
  focus: CategoryId[];
  baselineAnswers?: BaselineAnswers;
}

export function plantInput(draft: OnboardingDraft, region: string): PlantInput {
  const answers = draft.quiz === 'done' ? completeAnswers(draft) : null;
  return {
    name: cleanUserName(draft.name),
    treeName: cleanTreeName(draft.treeName),
    species: draft.species,
    focus: draftFocus(draft, region),
    ...(answers ? { baselineAnswers: answers } : {}),
  };
}
