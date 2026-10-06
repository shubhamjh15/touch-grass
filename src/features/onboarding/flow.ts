/**
 * The first-run flow as data: which screens exist, in which order, what each one needs
 * before the next opens, and how every answer changes the draft. Pure, so the whole flow
 * is testable without a browser.
 *
 * Everything typed before the seed is planted lives in one {@link OnboardingDraft}; the game
 * store only learns about it at the ceremony.
 */
import {
  BASELINE_QUESTIONS,
  DEFAULT_REGION,
  GRID_BY_ID,
  type BaselineQuestionId,
  type CategoryId,
  type RegionId,
} from '@/data/catalogue';
import {
  DEFAULT_FOCUS,
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

export type QuizScreenId = 'quiz-region' | `quiz-${BaselineQuestionId}`;

export type ScreenId =
  | 'legacy'
  | 'promise'
  | 'you'
  | 'tree'
  | 'line'
  | QuizScreenId
  | 'result'
  | 'focus'
  | 'comfort'
  | 'ceremony';

const QUESTION_SCREENS: readonly QuizScreenId[] = QUIZ_QUESTION_IDS.map(
  (id): QuizScreenId => `quiz-${id}`,
);

const ALL_SCREENS: readonly ScreenId[] = [
  'legacy',
  'promise',
  'you',
  'tree',
  'line',
  'quiz-region',
  ...QUESTION_SCREENS,
  'result',
  'focus',
  'comfort',
  'ceremony',
];

export function isScreenId(value: unknown): value is ScreenId {
  return typeof value === 'string' && ALL_SCREENS.some((screen) => screen === value);
}

/** The quiz question a screen asks, or `null` for every other screen. */
export function questionOf(screen: ScreenId): BaselineQuestionId | null {
  return QUIZ_QUESTION_IDS.find((id) => screen === `quiz-${id}`) ?? null;
}

export function isQuizScreen(screen: ScreenId): screen is QuizScreenId {
  return screen === 'quiz-region' || questionOf(screen) !== null;
}

// ── The draft ───────────────────────────────────────────────────────────────

/**
 * - `undecided`: the starting-line choice has not been made.
 * - `taking`: in the quiz. `paused`: "Finish later", answers kept.
 * - `skipped`: "Skip for now". `done`: every question answered.
 */
export type QuizStatus = 'undecided' | 'taking' | 'paused' | 'skipped' | 'done';

/** `default`: Eat + Move, untouched. `quiz`: adopted from the starting line. `own`: picked by hand. */
export type FocusSource = 'default' | 'quiz' | 'own';

export type LegacyChoice = 'undecided' | 'bring' | 'fresh';

export interface OnboardingDraft {
  v: 1;
  screen: ScreenId;
  /** As typed; trimmed and defaulted to "Friend" by the engine at planting. */
  name: string;
  region: RegionId;
  /** The user chose the region themselves (so the quiz need not ask again). */
  regionSet: boolean;
  species: Species;
  treeName: string;
  /** Fixes the order the name suggester walks through, so a reload does not reshuffle it. */
  nameSeed: number;
  nameIndex: number;
  quiz: QuizStatus;
  /** The quiz opens with "Where's home?" because no region was chosen before it started. */
  quizAsksRegion: boolean;
  answers: Partial<Record<BaselineQuestionId, string>>;
  focus: CategoryId[];
  focusSource: FocusSource;
  legacy: LegacyChoice;
}

/** What the flow needs to know about the world outside the draft. */
export interface FlowContext {
  /** Real logs from the old app were found and have not been turned down. */
  legacyOffered: boolean;
}

export interface DraftSeed {
  nameSeed: number;
  region?: RegionId;
  species?: Species;
}

/** The suggester's names in this draft's order. */
export function suggestedNames(nameSeed: number): string[] {
  return shuffle(createRng('tree-names', nameSeed), TREE_NAMES);
}

export function createDraft({ nameSeed, region, species }: DraftSeed): OnboardingDraft {
  const seed = nameSeed >>> 0;
  return {
    v: 1,
    screen: 'promise',
    name: '',
    region: region ?? DEFAULT_REGION,
    regionSet: false,
    species: species ?? 'oak',
    treeName: suggestedNames(seed)[0] ?? TREE_NAMES[0],
    nameSeed: seed,
    nameIndex: 0,
    quiz: 'undecided',
    quizAsksRegion: false,
    answers: {},
    focus: [...DEFAULT_FOCUS],
    focusSource: 'default',
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

/** The starting line this draft would produce, or `null` while a question is open. */
export function draftBaseline(draft: OnboardingDraft): BaselineTonnes | null {
  const answers = completeAnswers(draft);
  return answers ? computeBaseline(answers, draft.region) : null;
}

/** The focus areas the quiz suggests (Eat + Move without one). */
export function draftSuggestedFocus(draft: OnboardingDraft): CategoryId[] {
  return suggestFocus(draft.quiz === 'done' ? draftBaseline(draft) : null);
}

export function regionName(region: RegionId): string {
  if (region === DEFAULT_REGION) return 'World average';
  return GRID_BY_ID.get(region)?.name ?? 'World average';
}

/** Distances get miles alongside kilometres where road signs use miles. */
export function usesMiles(region: RegionId): boolean {
  return region === 'US' || region === 'GB';
}

// ── Order ───────────────────────────────────────────────────────────────────

/** The screens of this particular run, first to last. */
export function screensFor(draft: OnboardingDraft, context: FlowContext): ScreenId[] {
  const screens: ScreenId[] = [];
  if (context.legacyOffered) screens.push('legacy');
  screens.push('promise', 'you', 'tree', 'line');
  if (draft.quiz === 'taking' || draft.quiz === 'done') {
    if (draft.quizAsksRegion) screens.push('quiz-region');
    screens.push(...QUESTION_SCREENS, 'result');
  }
  // "Use these as my focus" on the result is the choice; asking again would be noise.
  if (!(draft.quiz === 'done' && draft.focusSource === 'quiz')) screens.push('focus');
  screens.push('comfort', 'ceremony');
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
  if (screen === 'focus') {
    if (draft.focus.length < 1) return 'Pick at least one.';
    return draft.focus.length > FOCUS_MAX ? 'Pick up to three.' : null;
  }
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
  const first = screens[0] ?? 'promise';
  const target = screens.indexOf(wanted);
  if (target < 0) {
    // A quiz screen that is no longer part of the run: the choice screen stands in for it.
    return isQuizScreen(wanted) || wanted === 'result' ? reachable('line', draft, context) : first;
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

/** Where a paused or half-finished quiz picks up: the first question without an answer. */
export function quizResumeScreen(draft: OnboardingDraft): ScreenId {
  const open = QUIZ_QUESTION_IDS.find((id) => draft.answers[id] === undefined);
  return open ? `quiz-${open}` : 'result';
}

// ── Progress ────────────────────────────────────────────────────────────────

export const PROGRESS_STEPS = 5;

/** Squares filled in the five-square stepper: you, tree, starting line, focus, comfort. */
export function progressOf(screen: ScreenId): number {
  switch (screen) {
    case 'legacy':
    case 'promise':
      return 0;
    case 'you':
      return 1;
    case 'tree':
      return 2;
    case 'focus':
      return 4;
    case 'comfort':
    case 'ceremony':
      return 5;
    default:
      return 3;
  }
}

/** The resume point the game keeps (`onboarding.step`, 0 to 7). */
export function engineStep(screen: ScreenId): number {
  switch (screen) {
    case 'legacy':
      return 0;
    case 'promise':
      return 1;
    case 'you':
      return 2;
    case 'tree':
      return 3;
    case 'focus':
      return 5;
    case 'comfort':
      return 6;
    case 'ceremony':
      return 7;
    default:
      return 4;
  }
}

/** The screen a saved engine step stands for, when the draft itself is gone. */
export function screenOfStep(step: number): ScreenId {
  const screens: readonly ScreenId[] = [
    'promise',
    'promise',
    'you',
    'tree',
    'line',
    'focus',
    'comfort',
    'ceremony',
  ];
  return screens[Math.min(screens.length - 1, Math.max(0, Math.round(step)))] ?? 'promise';
}

/** "3 / 7": where a quiz screen sits among the quiz's own screens. */
export function quizPosition(
  screen: ScreenId,
  draft: OnboardingDraft,
): { index: number; total: number } | null {
  const screens: ScreenId[] = [
    ...(draft.quizAsksRegion ? ['quiz-region' as const] : []),
    ...QUESTION_SCREENS,
  ];
  const index = screens.indexOf(screen);
  return index < 0 ? null : { index: index + 1, total: screens.length };
}

// ── Changing the draft ──────────────────────────────────────────────────────

export type DraftAction =
  | { type: 'go'; screen: ScreenId }
  | { type: 'name'; value: string }
  | { type: 'region'; region: RegionId }
  | { type: 'species'; species: Species }
  | { type: 'tree-name'; value: string }
  | { type: 'suggest-name' }
  | { type: 'legacy'; choice: Exclude<LegacyChoice, 'undecided'> }
  | { type: 'quiz-start' }
  | { type: 'quiz-skip' }
  | { type: 'quiz-pause' }
  | { type: 'answer'; question: BaselineQuestionId; option: string }
  | { type: 'focus-suggested' }
  | { type: 'focus-own' }
  | { type: 'focus-toggle'; category: CategoryId };

const isKnownOption = (question: BaselineQuestionId, option: string) =>
  BASELINE_QUESTIONS.some(
    (entry) => entry.id === question && entry.options.some((candidate) => candidate.id === option),
  );

function withQuizStatus(draft: OnboardingDraft): OnboardingDraft {
  if (draft.quiz !== 'taking' && draft.quiz !== 'done') return draft;
  const quiz: QuizStatus = completeAnswers(draft) ? 'done' : 'taking';
  if (quiz === draft.quiz) return draft;
  // An answer was withdrawn: a focus adopted from the old result no longer has a basis.
  return quiz === 'taking' && draft.focusSource === 'quiz'
    ? { ...draft, quiz, focusSource: 'own' }
    : { ...draft, quiz };
}

/** Every way the draft can change. Unknown or impossible input returns the draft untouched. */
export function reduceDraft(draft: OnboardingDraft, action: DraftAction): OnboardingDraft {
  switch (action.type) {
    case 'go':
      return action.screen === draft.screen ? draft : { ...draft, screen: action.screen };
    case 'name':
      return { ...draft, name: collapse(action.value).slice(0, NAME_MAX) };
    case 'region':
      if (!GRID_BY_ID.has(action.region)) return draft;
      return { ...draft, region: action.region, regionSet: true };
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
      return withQuizStatus({
        ...draft,
        quiz: 'taking',
        // Decided once, when the quiz first opens, so Back always finds the same screens.
        quizAsksRegion:
          draft.quiz === 'undecided' || draft.quiz === 'skipped'
            ? !draft.regionSet
            : draft.quizAsksRegion,
      });
    case 'quiz-skip':
      return {
        ...draft,
        quiz: 'skipped',
        focusSource: draft.focusSource === 'quiz' ? 'own' : draft.focusSource,
      };
    case 'quiz-pause':
      return {
        ...draft,
        quiz: 'paused',
        focusSource: draft.focusSource === 'quiz' ? 'own' : draft.focusSource,
      };
    case 'answer':
      if (!isKnownOption(action.question, action.option)) return draft;
      return withQuizStatus({
        ...draft,
        answers: { ...draft.answers, [action.question]: action.option },
      });
    case 'focus-suggested': {
      const focus = draftSuggestedFocus(draft);
      return draft.quiz === 'done' ? { ...draft, focus, focusSource: 'quiz' } : draft;
    }
    case 'focus-own':
      return {
        ...draft,
        // Start from the suggestion: it is the informed default, and every chip can be changed.
        focus: draft.focusSource === 'default' ? draftSuggestedFocus(draft) : draft.focus,
        focusSource: 'own',
      };
    case 'focus-toggle': {
      const chosen = draft.focus.includes(action.category);
      if (!chosen && draft.focus.length >= FOCUS_MAX) return draft;
      return {
        ...draft,
        focus: chosen
          ? draft.focus.filter((category) => category !== action.category)
          : [...draft.focus, action.category],
        focusSource: 'own',
      };
    }
  }
}

/** What the ceremony hands to the engine. */
export interface PlantInput {
  name: string;
  treeName: string;
  species: Species;
  region: RegionId;
  focus: CategoryId[];
  units?: 'imperial';
  baselineAnswers?: BaselineAnswers;
}

export function plantInput(draft: OnboardingDraft): PlantInput {
  const answers = draft.quiz === 'done' ? completeAnswers(draft) : null;
  return {
    name: cleanUserName(draft.name),
    treeName: cleanTreeName(draft.treeName),
    species: draft.species,
    region: draft.region,
    focus: draft.focus.slice(0, FOCUS_MAX),
    ...(draft.region === 'US' ? { units: 'imperial' as const } : {}),
    ...(answers ? { baselineAnswers: answers } : {}),
  };
}
