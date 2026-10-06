import { describe, expect, it } from 'vitest';
import { BASELINE_WORKED_EXAMPLES, type BaselineQuestionId } from '@/data/catalogue';
import { TREE_NAME_MAX } from '@/game';
import { TREE_NAMES, milesHint, splitOptionLabel } from './copy';
import {
  QUIZ_QUESTION_IDS,
  blockerOf,
  createDraft,
  draftBaseline,
  draftSuggestedFocus,
  engineStep,
  nextScreen,
  plantInput,
  previousScreen,
  progressOf,
  quizPosition,
  quizResumeScreen,
  reachable,
  reduceDraft,
  screenOfStep,
  screensFor,
  suggestedNames,
  type DraftAction,
  type FlowContext,
  type OnboardingDraft,
  type ScreenId,
} from './flow';

const PLAIN: FlowContext = { legacyOffered: false };
const LEGACY: FlowContext = { legacyOffered: true };

const fresh = () => createDraft({ nameSeed: 7 });
const apply = (draft: OnboardingDraft, ...actions: DraftAction[]) =>
  actions.reduce(reduceDraft, draft);

/** The UK worked example of the evidence base: ≈ 7.8 t. */
const UK = BASELINE_WORKED_EXAMPLES.find((example) => example.region === 'GB');
const ukAnswers = (): DraftAction[] =>
  QUIZ_QUESTION_IDS.map((question) => ({
    type: 'answer',
    question,
    option: UK?.answers[question] ?? '',
  }));

function walk(draft: OnboardingDraft, context: FlowContext): ScreenId[] {
  const seen: ScreenId[] = [draft.screen];
  let current = draft;
  for (let guard = 0; guard < 40; guard += 1) {
    const target = nextScreen(current, context);
    if (!target) break;
    seen.push(target);
    current = reduceDraft(current, { type: 'go', screen: target });
  }
  return seen;
}

describe('a new draft', () => {
  it('starts on the promise with a suggested tree name, an oak and Eat + Move', () => {
    const draft = fresh();
    expect(draft.screen).toBe('promise');
    expect(TREE_NAMES).toContain(draft.treeName);
    expect(draft.species).toBe('oak');
    expect(draft.focus).toEqual(['eat', 'move']);
    expect(draft.quiz).toBe('undecided');
  });

  it('keeps every suggested name inside the 16-character limit', () => {
    for (const name of TREE_NAMES) expect(name.length).toBeLessThanOrEqual(TREE_NAME_MAX);
  });

  it('walks the suggester through all twelve names without repeating one in a row', () => {
    let draft = fresh();
    const seen = [draft.treeName];
    for (let index = 0; index < TREE_NAMES.length - 1; index += 1) {
      draft = reduceDraft(draft, { type: 'suggest-name' });
      expect(draft.treeName).not.toBe(seen.at(-1));
      seen.push(draft.treeName);
    }
    expect(new Set(seen).size).toBe(TREE_NAMES.length);
    expect(suggestedNames(7)).toEqual(suggestedNames(7));
  });

  it('never suggests the name that is already typed', () => {
    const draft = fresh();
    const upcoming = suggestedNames(draft.nameSeed)[1] ?? '';
    const typed = reduceDraft(draft, { type: 'tree-name', value: upcoming });
    expect(reduceDraft(typed, { type: 'suggest-name' }).treeName).not.toBe(upcoming);
  });
});

describe('the order of screens', () => {
  it('is promise, you, tree, starting line, focus, comfort, ceremony when the quiz is skipped', () => {
    const draft = apply(fresh(), { type: 'quiz-skip' });
    expect(walk(draft, PLAIN)).toEqual([
      'promise',
      'you',
      'tree',
      'line',
      'focus',
      'comfort',
      'ceremony',
    ]);
  });

  it('puts the legacy question first only when old logs were found', () => {
    expect(screensFor(fresh(), LEGACY)[0]).toBe('legacy');
    expect(screensFor(fresh(), PLAIN)).not.toContain('legacy');
  });

  it('adds the region question and six questions when the quiz starts without a region', () => {
    const draft = apply(fresh(), { type: 'quiz-start' });
    const screens = screensFor(draft, PLAIN);
    expect(screens.slice(4, 12)).toEqual([
      'quiz-region',
      'quiz-diet',
      'quiz-transportMode',
      'quiz-weeklyDistance',
      'quiz-flights',
      'quiz-homeEnergy',
      'quiz-shopping',
      'result',
    ]);
    expect(quizPosition('quiz-diet', draft)).toEqual({ index: 2, total: 7 });
  });

  it('does not ask for the region twice', () => {
    const draft = apply(fresh(), { type: 'region', region: 'GB' }, { type: 'quiz-start' });
    expect(screensFor(draft, PLAIN)).not.toContain('quiz-region');
    expect(quizPosition('quiz-diet', draft)).toEqual({ index: 1, total: 6 });
  });

  it('keeps the region screen in place when the region is picked inside the quiz', () => {
    const draft = apply(fresh(), { type: 'quiz-start' }, { type: 'region', region: 'IN' });
    expect(screensFor(draft, PLAIN)).toContain('quiz-region');
    expect(previousScreen({ ...draft, screen: 'quiz-diet' }, PLAIN)).toBe('quiz-region');
  });

  it('goes straight from the result to comfort once the suggested focus is adopted', () => {
    const done = apply(fresh(), { type: 'quiz-start' }, ...ukAnswers());
    const adopted = reduceDraft(done, { type: 'focus-suggested' });
    expect(nextScreen({ ...adopted, screen: 'result' }, PLAIN)).toBe('comfort');
    expect(previousScreen({ ...adopted, screen: 'comfort' }, PLAIN)).toBe('result');

    const own = reduceDraft(done, { type: 'focus-own' });
    expect(nextScreen({ ...own, screen: 'result' }, PLAIN)).toBe('focus');
  });

  it('leaves the quiz out of the path once it is paused, and resumes at the open question', () => {
    const paused = apply(
      fresh(),
      { type: 'quiz-start' },
      { type: 'answer', question: 'diet', option: 'vegan' },
      { type: 'quiz-pause' },
    );
    expect(screensFor(paused, PLAIN)).not.toContain('quiz-diet');
    expect(paused.answers.diet).toBe('vegan');
    expect(quizResumeScreen(paused)).toBe('quiz-transportMode');
  });
});

describe('what each screen needs before the next one opens', () => {
  it('needs a tree name', () => {
    const empty = reduceDraft(fresh(), { type: 'tree-name', value: '   ' });
    expect(blockerOf('tree', empty)).toBe('Give your tree a name.');
    expect(blockerOf('tree', fresh())).toBeNull();
  });

  it('needs the starting-line choice, an answer per question and one to three focus areas', () => {
    expect(blockerOf('line', fresh())).not.toBeNull();
    expect(blockerOf('line', apply(fresh(), { type: 'quiz-skip' }))).toBeNull();
    expect(blockerOf('quiz-diet', fresh())).toBe('Pick the closest answer.');
    const none = apply(
      fresh(),
      { type: 'focus-toggle', category: 'eat' },
      { type: 'focus-toggle', category: 'move' },
    );
    expect(none.focus).toEqual([]);
    expect(blockerOf('focus', none)).toBe('Pick at least one.');
  });

  it('needs nothing on the optional screens', () => {
    for (const screen of ['promise', 'you', 'comfort'] as const) {
      expect(blockerOf(screen, fresh())).toBeNull();
    }
  });

  it('sends a jump past an unanswered screen back to that screen', () => {
    const nameless = reduceDraft(fresh(), { type: 'tree-name', value: '' });
    expect(reachable('ceremony', nameless, PLAIN)).toBe('tree');
    expect(reachable('ceremony', fresh(), PLAIN)).toBe('line');
    expect(reachable('ceremony', apply(fresh(), { type: 'quiz-skip' }), PLAIN)).toBe('ceremony');
  });

  it('holds everyone at the legacy question until it is answered', () => {
    expect(reachable('promise', fresh(), LEGACY)).toBe('legacy');
    const chosen = reduceDraft(fresh(), { type: 'legacy', choice: 'fresh' });
    expect(reachable('promise', chosen, LEGACY)).toBe('promise');
  });

  it('turns a stale quiz screen into the starting-line choice', () => {
    const skipped = apply(fresh(), { type: 'quiz-skip' });
    expect(reachable('quiz-flights', skipped, PLAIN)).toBe('line');
    expect(reachable('result', skipped, PLAIN)).toBe('line');
  });

  it('will not open the result while a question is open', () => {
    const partial = apply(
      fresh(),
      { type: 'quiz-start' },
      { type: 'region', region: 'GB' },
      { type: 'answer', question: 'diet', option: 'vegan' },
    );
    expect(reachable('result', partial, PLAIN)).toBe('quiz-transportMode');
  });
});

describe('answers', () => {
  it('trims names to their limits and collapses white space', () => {
    const draft = apply(
      fresh(),
      { type: 'name', value: 'A very long name that keeps going' },
      { type: 'tree-name', value: '  Sir   Leafs-a-lot the Third ' },
    );
    expect(draft.name).toHaveLength(20);
    expect(plantInput(draft).treeName).toBe('Sir Leafs-a-lot');
    expect(plantInput(draft).treeName.length).toBeLessThanOrEqual(TREE_NAME_MAX);
  });

  it('ignores an unknown species, region or quiz option', () => {
    const draft = fresh();
    expect(reduceDraft(draft, { type: 'species', species: 'birch' as never })).toBe(draft);
    expect(reduceDraft(draft, { type: 'region', region: 'ATLANTIS' as never })).toBe(draft);
    expect(reduceDraft(draft, { type: 'answer', question: 'diet', option: 'air' })).toBe(draft);
  });

  it('allows at most three focus areas', () => {
    const three = reduceDraft(fresh(), { type: 'focus-toggle', category: 'power' });
    expect(three.focus).toEqual(['eat', 'move', 'power']);
    expect(reduceDraft(three, { type: 'focus-toggle', category: 'water' })).toBe(three);
    expect(reduceDraft(three, { type: 'focus-toggle', category: 'eat' }).focus).toEqual([
      'move',
      'power',
    ]);
  });

  it('marks the quiz done with the last answer and reproduces the UK worked example', () => {
    let draft = apply(fresh(), { type: 'region', region: 'GB' }, { type: 'quiz-start' });
    const answers = ukAnswers();
    for (const answer of answers.slice(0, -1)) draft = reduceDraft(draft, answer);
    expect(draft.quiz).toBe('taking');
    expect(draftBaseline(draft)).toBeNull();
    draft = reduceDraft(draft, answers.at(-1) as DraftAction);
    expect(draft.quiz).toBe('done');
    expect(draftBaseline(draft)?.total).toBeCloseTo(UK?.result.total ?? 0, 1);
    expect(draftSuggestedFocus(draft)).toEqual(['eat', 'move']);
  });

  it('suggests Eat + Move without a finished quiz', () => {
    expect(draftSuggestedFocus(fresh())).toEqual(['eat', 'move']);
  });

  it('adds Nature & Voice for an already light footprint', () => {
    const light: Record<BaselineQuestionId, string> = {
      diet: 'vegan',
      transportMode: 'walk-cycle',
      weeklyDistance: 'under-25',
      flights: 'none',
      homeEnergy: 'minimal',
      shopping: 'minimal',
    };
    const draft = apply(
      fresh(),
      { type: 'quiz-start' },
      ...QUIZ_QUESTION_IDS.map((question): DraftAction => ({
        type: 'answer',
        question,
        option: light[question],
      })),
    );
    expect(draftBaseline(draft)?.total).toBeCloseTo(1.2, 1);
    expect(draftSuggestedFocus(draft)).toContain('nature');
  });

  it('drops an adopted focus back to a hand-picked one when the quiz is skipped after all', () => {
    const adopted = apply(
      fresh(),
      { type: 'quiz-start' },
      ...ukAnswers(),
      { type: 'focus-suggested' },
      { type: 'quiz-skip' },
    );
    expect(adopted.focusSource).toBe('own');
    expect(screensFor(adopted, PLAIN)).toContain('focus');
  });
});

describe('what the ceremony hands to the engine', () => {
  it('sends the baseline answers only for a finished quiz', () => {
    const partial = apply(
      fresh(),
      { type: 'quiz-start' },
      { type: 'answer', question: 'diet', option: 'vegan' },
      { type: 'quiz-pause' },
    );
    expect(plantInput(partial).baselineAnswers).toBeUndefined();
    const done = apply(fresh(), { type: 'quiz-start' }, ...ukAnswers());
    expect(plantInput(done).baselineAnswers).toEqual(UK?.answers);
  });

  it('switches to imperial units for the United States only', () => {
    expect(plantInput(reduceDraft(fresh(), { type: 'region', region: 'US' })).units).toBe(
      'imperial',
    );
    expect(
      plantInput(reduceDraft(fresh(), { type: 'region', region: 'GB' })).units,
    ).toBeUndefined();
  });
});

describe('progress', () => {
  it('fills the five squares in order and never goes backwards along the flow', () => {
    const draft = apply(fresh(), { type: 'quiz-start' }, ...ukAnswers(), { type: 'focus-own' });
    const filled = screensFor(draft, LEGACY).map(progressOf);
    expect(filled).toEqual([...filled].sort((a, b) => a - b));
    expect(filled[0]).toBe(0);
    expect(filled.at(-1)).toBe(5);
  });

  it('maps every screen to an engine step between 0 and 7 and back to a screen', () => {
    const draft = apply(fresh(), { type: 'quiz-start' }, ...ukAnswers(), { type: 'focus-own' });
    for (const screen of screensFor(draft, LEGACY)) {
      const step = engineStep(screen);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(7);
    }
    expect(screenOfStep(3)).toBe('tree');
    expect(screenOfStep(7)).toBe('ceremony');
    expect(screenOfStep(99)).toBe('ceremony');
    expect(screenOfStep(-4)).toBe('promise');
  });
});

describe('copy helpers', () => {
  it('splits an evidence-base label into a title and a detail', () => {
    expect(splitOptionLabel('Vegan - no animal products')).toEqual({
      title: 'Vegan',
      detail: 'No animal products',
    });
    expect(splitOptionLabel('25-75 km')).toEqual({ title: '25–75 km', detail: null });
    expect(splitOptionLabel('Car, usually shared (2 people)')).toEqual({
      title: 'Car, usually shared',
      detail: '2 people',
    });
  });

  it('gives the distance bands in miles, rounded to five', () => {
    expect(milesHint('25–75 km')).toBe('About 15–45 miles');
    expect(milesHint('Under 25 km')).toBe('Under about 15 miles');
    expect(milesHint('Over 500 km')).toBe('Over about 310 miles');
    expect(milesHint('Walk')).toBeNull();
  });
});
