import { describe, expect, it } from 'vitest';
import {
  BASELINE_QUESTIONS,
  BASELINE_WORKED_EXAMPLES,
  type BaselineQuestionId,
} from '@/data/catalogue';
import { TREE_NAME_MAX } from '@/game';
import { QUESTION_COPY, TREE_NAMES, joinWords, splitOptionLabel } from './copy';
import {
  QUIZ_QUESTION_IDS,
  blockerOf,
  createDraft,
  draftBaseline,
  draftFocus,
  engineStep,
  gridRegion,
  isScreenId,
  nextScreen,
  plantInput,
  previousScreen,
  progressOf,
  questionOf,
  quizPosition,
  quizResumeScreen,
  reachable,
  reduceDraft,
  screenOfStep,
  screensFor,
  suggestedNames,
  type DraftAction,
  type OnboardingDraft,
  type ScreenId,
} from './flow';

const PLAIN = { legacyOffered: false };
const LEGACY = { legacyOffered: true };

const fresh = () => createDraft({ nameSeed: 7 });
const apply = (draft: OnboardingDraft, ...actions: DraftAction[]) =>
  actions.reduce(reduceDraft, draft);

const UK = BASELINE_WORKED_EXAMPLES.find((entry) => entry.region === 'GB');
const answerAll = (
  draft: OnboardingDraft,
  answers: Partial<Record<BaselineQuestionId, string>> = UK?.answers ?? {},
) =>
  QUIZ_QUESTION_IDS.reduce(
    (current, question) =>
      reduceDraft(current, { type: 'answer', question, option: answers[question] ?? '' }),
    draft,
  );

describe('a fresh draft', () => {
  it('starts on the name with a suggested tree name already in the field', () => {
    const draft = fresh();
    expect(draft.screen).toBe('name');
    expect(TREE_NAMES).toContain(draft.treeName);
    expect(draft.treeName).toBe(suggestedNames(7)[0]);
    expect(draft.species).toBe('oak');
    expect(draft.quiz).toBe('undecided');
  });

  it('takes the species grown in the landing demo', () => {
    expect(createDraft({ nameSeed: 1, species: 'pine' }).species).toBe('pine');
  });

  it('keeps every suggested name within the limit', () => {
    for (const name of TREE_NAMES) expect(name.length).toBeLessThanOrEqual(TREE_NAME_MAX);
  });
});

describe('the order of screens', () => {
  it('is name, tree, the quiz choice, then planting', () => {
    expect(screensFor(fresh(), PLAIN)).toEqual(['name', 'tree', 'line', 'plant']);
  });

  it('puts the old-logs question first only when there are old logs', () => {
    expect(screensFor(fresh(), LEGACY)[0]).toBe('legacy');
  });

  it('adds the questions and the result while the quiz is being taken', () => {
    const taking = apply(fresh(), { type: 'quiz-start' });
    expect(screensFor(taking, PLAIN)).toEqual([
      'name',
      'tree',
      'line',
      ...QUIZ_QUESTION_IDS.map((id) => `quiz-${id}`),
      'result',
      'plant',
    ]);
  });

  it('drops the quiz again when it is skipped, keeping the answers given', () => {
    const skipped = apply(
      fresh(),
      { type: 'quiz-start' },
      { type: 'answer', question: 'diet', option: 'vegan' },
      { type: 'quiz-skip' },
    );
    expect(screensFor(skipped, PLAIN)).toEqual(['name', 'tree', 'line', 'plant']);
    expect(skipped.answers).toEqual({ diet: 'vegan' });
    expect(quizResumeScreen(skipped)).toBe('quiz-transportMode');
  });

  it('walks forwards and backwards through the run', () => {
    const draft = { ...fresh(), screen: 'tree' as ScreenId };
    expect(nextScreen(draft, PLAIN)).toBe('line');
    expect(previousScreen(draft, PLAIN)).toBe('name');
    expect(previousScreen(fresh(), PLAIN)).toBeNull();
    expect(nextScreen({ ...draft, screen: 'plant' }, PLAIN)).toBeNull();
  });
});

describe('what each screen needs', () => {
  it('never holds anyone at the name: it is optional', () => {
    expect(blockerOf('name', fresh())).toBeNull();
  });

  it('needs a tree name', () => {
    const blank = apply(fresh(), { type: 'tree-name', value: '   ' });
    expect(blockerOf('tree', blank)).toBe('Give your tree a name.');
    expect(blockerOf('tree', fresh())).toBeNull();
  });

  it('needs the quiz to be taken or skipped', () => {
    expect(blockerOf('line', fresh())).not.toBeNull();
    expect(blockerOf('line', apply(fresh(), { type: 'quiz-skip' }))).toBeNull();
    expect(blockerOf('line', apply(fresh(), { type: 'quiz-start' }))).toBeNull();
  });

  it('needs an answer to each question: no invented defaults', () => {
    const taking = apply(fresh(), { type: 'quiz-start' });
    expect(blockerOf('quiz-diet', taking)).toBe('Pick the closest answer.');
    expect(blockerOf('result', taking)).not.toBeNull();
    const done = answerAll(taking);
    expect(done.quiz).toBe('done');
    expect(blockerOf('quiz-diet', done)).toBeNull();
    expect(blockerOf('result', done)).toBeNull();
  });

  it('sends a jump ahead back to the first screen that still needs something', () => {
    const blank = apply(fresh(), { type: 'tree-name', value: '' });
    expect(reachable('plant', blank, PLAIN)).toBe('tree');
    expect(reachable('plant', fresh(), PLAIN)).toBe('line');
    expect(reachable('plant', apply(fresh(), { type: 'quiz-skip' }), PLAIN)).toBe('plant');
    expect(reachable('name', fresh(), LEGACY)).toBe('legacy');
  });

  it('shows the quiz choice in place of a quiz screen that is no longer part of the run', () => {
    const skipped = apply(fresh(), { type: 'quiz-skip' });
    expect(reachable('quiz-flights', skipped, PLAIN)).toBe('line');
    expect(reachable('result', skipped, PLAIN)).toBe('line');
  });
});

describe('changing the draft', () => {
  it('trims names to their limits and collapses spaces', () => {
    const draft = apply(
      fresh(),
      { type: 'name', value: 'Ada   Lovelace of the Analytical Engine' },
      { type: 'tree-name', value: 'A  very long name for a tree' },
    );
    expect(draft.name).toBe('Ada Lovelace of the ');
    expect(draft.treeName).toHaveLength(TREE_NAME_MAX);
  });

  it('suggests a different name every time and wraps around', () => {
    let draft = fresh();
    const seen = new Set<string>([draft.treeName]);
    for (let index = 0; index < TREE_NAMES.length - 1; index += 1) {
      const before = draft.treeName;
      draft = reduceDraft(draft, { type: 'suggest-name' });
      expect(draft.treeName).not.toBe(before);
      seen.add(draft.treeName);
    }
    expect(seen.size).toBe(TREE_NAMES.length);
  });

  it('ignores answers the evidence base does not know', () => {
    const taking = apply(fresh(), { type: 'quiz-start' });
    expect(reduceDraft(taking, { type: 'answer', question: 'diet', option: 'air' })).toBe(taking);
  });

  it('picks a finished quiz back up as done', () => {
    const done = answerAll(apply(fresh(), { type: 'quiz-start' }));
    const again = apply(done, { type: 'quiz-skip' }, { type: 'quiz-start' });
    expect(again.quiz).toBe('done');
    expect(quizResumeScreen(again)).toBe('result');
  });
});

describe('the starting line', () => {
  it('reproduces the worked example of the evidence base', () => {
    const done = answerAll(apply(fresh(), { type: 'quiz-start' }));
    expect(draftBaseline(done, 'GB')?.total).toBeCloseTo(UK?.result.total ?? 0, 1);
  });

  it('has no figure while a question is open', () => {
    expect(draftBaseline(apply(fresh(), { type: 'quiz-start' }), 'GB')).toBeNull();
  });

  it('falls back to the world-average grid for a region it does not know', () => {
    expect(gridRegion('GB')).toBe('GB');
    expect(gridRegion('ATLANTIS')).toBe('WORLD');
  });

  it('files the six questions under five topics', () => {
    expect(QUIZ_QUESTION_IDS).toHaveLength(BASELINE_QUESTIONS.length);
    const positions = QUIZ_QUESTION_IDS.map((id) => quizPosition(`quiz-${id}`));
    expect(positions.map((position) => position?.index)).toEqual([1, 2, 2, 3, 4, 5]);
    expect(positions.every((position) => position?.total === 5)).toBe(true);
    expect(quizPosition('name')).toBeNull();
  });

  it('asks every question in six words or fewer', () => {
    for (const id of QUIZ_QUESTION_IDS) {
      expect(QUESTION_COPY[id].title.split(' ').length).toBeLessThanOrEqual(6);
    }
  });
});

describe('planting', () => {
  it('hands over the cleaned names, the species and the default focus', () => {
    const draft = apply(
      fresh(),
      { type: 'name', value: '  Sam ' },
      { type: 'tree-name', value: ' Fern ' },
      { type: 'species', species: 'cherry' },
      { type: 'quiz-skip' },
    );
    expect(plantInput(draft, 'WORLD')).toEqual({
      name: 'Sam',
      treeName: 'Fern',
      species: 'cherry',
      focus: ['eat', 'move'],
    });
  });

  it('brings the answers and the focus they suggest only when the quiz is finished', () => {
    const taking = apply(fresh(), { type: 'quiz-start' });
    const done = answerAll(taking);
    expect(plantInput(done, 'GB').baselineAnswers).toEqual(UK?.answers);
    expect(plantInput(done, 'GB').focus).toEqual(draftFocus(done, 'GB'));

    const abandoned = apply(done, { type: 'quiz-skip' });
    expect(plantInput(abandoned, 'GB').baselineAnswers).toBeUndefined();
    expect(plantInput(abandoned, 'GB').focus).toEqual(['eat', 'move']);
  });

  it('adds Nature for someone who already lives light', () => {
    const light = BASELINE_WORKED_EXAMPLES.find((entry) => entry.region === 'WORLD');
    const done = answerAll(apply(fresh(), { type: 'quiz-start' }), light?.answers);
    expect(draftFocus(done, 'WORLD')).toContain('nature');
  });
});

describe('progress and resuming', () => {
  it('only ever moves the bar forwards along a run', () => {
    const run = screensFor(apply(fresh(), { type: 'quiz-start' }), LEGACY);
    const values = run.map(progressOf);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeGreaterThan(values[index - 1] ?? 0);
    }
    expect(progressOf('plant')).toBe(1);
  });

  it('maps every screen to a step the game can keep, and back to a screen', () => {
    const run = screensFor(apply(fresh(), { type: 'quiz-start' }), LEGACY);
    for (const screen of run) {
      const step = engineStep(screen);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(7);
      expect(isScreenId(screenOfStep(step))).toBe(true);
    }
    expect(screenOfStep(0)).toBe('name');
    expect(screenOfStep(3)).toBe('tree');
    expect(screenOfStep(4)).toBe('line');
    expect(screenOfStep(7)).toBe('plant');
    expect(screenOfStep(Number.NaN)).toBe('name');
  });

  it('knows which question a screen asks', () => {
    expect(questionOf('quiz-flights')).toBe('flights');
    expect(questionOf('line')).toBeNull();
    expect(isScreenId('comfort')).toBe(false);
  });
});

describe('copy helpers', () => {
  it("lays the evidence base's answers out on two lines without changing the words", () => {
    expect(splitOptionLabel('Vegan - no animal products')).toEqual({
      title: 'Vegan',
      detail: 'No animal products',
    });
    expect(splitOptionLabel('25-75 km')).toEqual({ title: '25–75 km', detail: null });
    expect(splitOptionLabel('E-bike or e-scooter (own)')).toEqual({
      title: 'E-bike or e-scooter',
      detail: 'Own',
    });
  });

  it('joins words the way a sentence would', () => {
    expect(joinWords(['Eat'])).toBe('Eat');
    expect(joinWords(['Eat', 'Move'])).toBe('Eat and Move');
    expect(joinWords(['Eat', 'Move', 'Nature'])).toBe('Eat, Move and Nature');
  });
});
