import { describe, expect, it } from 'vitest';
import {
  filterEntries,
  isTypingTarget,
  matchScore,
  parseQuery,
  searchWords,
  usableQty,
} from './commands';

describe('parseQuery', () => {
  it('splits a quantity off the words', () => {
    expect(parseQuery('bike 5')).toEqual({ text: 'bike', qty: 5 });
    expect(parseQuery('  2,5 Veggie   meal ')).toEqual({ text: 'veggie meal', qty: 2.5 });
  });

  it('keeps only the first number as the quantity', () => {
    expect(parseQuery('shower 4 10')).toEqual({ text: 'shower 10', qty: 4 });
  });

  it('has no quantity without a standalone number', () => {
    expect(parseQuery('5km run')).toEqual({ text: '5km run', qty: null });
    expect(parseQuery('0 waste')).toEqual({ text: '0 waste', qty: null });
    expect(parseQuery('')).toEqual({ text: '', qty: null });
  });
});

describe('searchWords', () => {
  it('drops the filler people type first', () => {
    expect(searchWords('log bike')).toEqual(['bike']);
    expect(searchWords('go to quests')).toEqual(['quests']);
  });

  it('keeps a filler word when it is the whole query', () => {
    expect(searchWords('log')).toEqual(['log']);
  });
});

describe('matchScore', () => {
  it('prefers words that start a word over words found inside one', () => {
    expect(matchScore('Walked or cycled instead of driving bike', ['bik'])).toBe(2);
    expect(matchScore('Motorbike trip', ['bike'])).toBe(1);
    expect(matchScore('Plant-based meal', ['bike'])).toBe(0);
  });

  it('needs every word and ignores accents and case', () => {
    expect(matchScore('Café visit by tram', ['cafe', 'tram'])).toBe(2);
    expect(matchScore('Café visit by tram', ['cafe', 'bus'])).toBe(0);
  });

  it('matches everything when nothing is typed', () => {
    expect(matchScore('anything', [])).toBe(2);
  });
});

describe('filterEntries', () => {
  const entries = [
    { id: 'motor', keywords: 'motorbike trip' },
    { id: 'meal', keywords: 'plant-based meal vegan' },
    { id: 'bike', keywords: 'walked or cycled bike bicycle' },
    { id: 'ebike', keywords: 'e-bike electric bike' },
  ];

  it('returns the matches best first and keeps catalogue order among equals', () => {
    expect(filterEntries(entries, ['bike']).map((entry) => entry.id)).toEqual([
      'bike',
      'ebike',
      'motor',
    ]);
  });

  it('respects the limit', () => {
    expect(filterEntries(entries, ['bike'], 1).map((entry) => entry.id)).toEqual(['bike']);
  });
});

describe('usableQty', () => {
  const km = { dailyCap: 200, decimals: 1 };

  it('rounds to the decimals the action allows', () => {
    expect(usableQty(5.26, km)).toBe(5.3);
    expect(usableQty(2.4, { dailyCap: 10, decimals: 0 })).toBe(2);
  });

  it('refuses a quantity past the daily cap, so the sheet opens with its default', () => {
    expect(usableQty(500, km)).toBeNull();
    expect(usableQty(null, km)).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('is true for text fields and editable regions only', () => {
    const input = document.createElement('input');
    const checkbox = Object.assign(document.createElement('input'), { type: 'checkbox' });
    const textarea = document.createElement('textarea');
    const button = document.createElement('button');
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
