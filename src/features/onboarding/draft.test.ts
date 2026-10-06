import { describe, expect, it } from 'vitest';
import { DRAFT_KEY, clearDraft, loadDraft, parseDraft, saveDraft } from './draft';
import { createDraft, reduceDraft, type OnboardingDraft } from './flow';

const sample = (): OnboardingDraft => ({
  ...createDraft({ nameSeed: 42, species: 'cherry' }),
  screen: 'quiz-flights',
  name: 'Sam',
  treeName: 'Fern',
  quiz: 'taking',
  answers: { diet: 'vegetarian', transportMode: 'bus', weeklyDistance: '25-75' },
});

describe('the saved draft', () => {
  it('comes back exactly as it was saved', () => {
    const draft = sample();
    expect(saveDraft(draft)).toBe(true);
    expect(loadDraft()).toEqual(draft);
  });

  it('is gone after planting', () => {
    saveDraft(sample());
    clearDraft();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(loadDraft()).toBeNull();
  });

  it('is nothing when storage holds something else, or a draft of the older flow', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('not json')).toBeNull();
    expect(parseDraft('[1,2,3]')).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 1, screen: 'tree' }))).toBeNull();
  });

  it('repairs fields that do not make sense instead of failing', () => {
    const repaired = parseDraft(
      JSON.stringify({
        v: 2,
        screen: 'checkout',
        name: 'x'.repeat(60),
        species: 'birch',
        treeName: 12,
        nameSeed: 9,
        nameIndex: -3,
        quiz: 'done',
        answers: { diet: 'vegan', flights: 'weekly-rocket', bogus: 'yes' },
        legacy: 'maybe',
      }),
    );
    expect(repaired).not.toBeNull();
    expect(repaired?.screen).toBe('name');
    expect(repaired?.name).toHaveLength(20);
    expect(repaired?.species).toBe('oak');
    expect(repaired?.treeName).toBe(createDraft({ nameSeed: 9 }).treeName);
    expect(repaired?.nameIndex).toBe(0);
    // Only one valid answer survives, so the quiz cannot be "done".
    expect(repaired?.answers).toEqual({ diet: 'vegan' });
    expect(repaired?.quiz).toBe('taking');
    expect(repaired?.legacy).toBe('undecided');
  });

  it('survives a storage that refuses to write', () => {
    const refusing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(saveDraft(sample(), refusing)).toBe(false);
    expect(loadDraft(refusing)).toBeNull();
    expect(() => clearDraft(refusing)).not.toThrow();
    expect(saveDraft(sample(), null)).toBe(false);
  });

  it('round-trips through every kind of change', () => {
    const draft = reduceDraft(sample(), { type: 'answer', question: 'flights', option: 'none' });
    saveDraft(draft);
    expect(loadDraft()?.answers.flights).toBe('none');
  });
});
