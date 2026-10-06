/**
 * The command palette's matching, kept pure so it is tested without rendering anything:
 * "bike 5" is a search for "bike" with a quantity of 5.
 */

export interface ParsedQuery {
  /** The query without the number, lower case, single spaces. */
  text: string;
  /** The first standalone number in the query, if it is a usable quantity. */
  qty: number | null;
}

const NUMBER = /^\d+(?:[.,]\d+)?$/;
/** Words people type before the thing they mean: "log bike", "go to quests". */
const FILLER = new Set(['log', 'add', 'go', 'to', 'open', 'goto']);

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.,+-]+/g, ' ')
    .trim();
}

export function parseQuery(query: string): ParsedQuery {
  let qty: number | null = null;
  const words: string[] = [];
  for (const token of normalise(query).split(' ')) {
    if (!token) continue;
    if (qty === null && NUMBER.test(token)) {
      const value = Number(token.replace(',', '.'));
      if (Number.isFinite(value) && value > 0 && value <= 100_000) {
        qty = value;
        continue;
      }
    }
    words.push(token);
  }
  return { text: words.join(' '), qty };
}

/** The words that must match, without leading filler ("log bike" searches for "bike"). */
export function searchWords(text: string): string[] {
  const words = normalise(text).split(' ').filter(Boolean);
  while (words.length > 1 && FILLER.has(words[0] ?? '')) words.shift();
  return words;
}

/**
 * How well `haystack` answers the words: 2 when every word starts a word of the haystack,
 * 1 when every word appears somewhere inside it, 0 when one is missing. No words match anything.
 */
export function matchScore(haystack: string, words: readonly string[]): 0 | 1 | 2 {
  if (words.length === 0) return 2;
  const text = normalise(haystack);
  const parts = text.split(' ');
  let score: 1 | 2 = 2;
  for (const word of words) {
    if (parts.some((part) => part.startsWith(word))) continue;
    if (!text.includes(word)) return 0;
    score = 1;
  }
  return score;
}

export interface Searchable {
  id: string;
  /** Everything a query may match: title, synonyms, category. */
  keywords: string;
}

/** The entries that match, best first; ties keep their original order. */
export function filterEntries<T extends Searchable>(
  entries: readonly T[],
  words: readonly string[],
  limit = Number.POSITIVE_INFINITY,
): T[] {
  const scored: { entry: T; score: number; index: number }[] = [];
  entries.forEach((entry, index) => {
    const score = matchScore(entry.keywords, words);
    if (score > 0) scored.push({ entry, score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, limit).map((item) => item.entry);
}

/** A quantity an action can take: inside its daily cap, rounded to the decimals it allows. */
export function usableQty(
  qty: number | null,
  action: { dailyCap: number; decimals: number },
): number | null {
  if (qty === null) return null;
  const factor = 10 ** action.decimals;
  const rounded = Math.round(qty * factor) / factor;
  return rounded > 0 && rounded <= action.dailyCap ? rounded : null;
}
