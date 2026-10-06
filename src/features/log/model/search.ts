/**
 * Search over the sticker sheet (spec 3.4): a forgiving match on a tile's title, caption and
 * synonyms. Ranking: a prefix match first, then what the person logs most, then alphabetical.
 * The same word index backs the custom-action matcher (spec 3.6 a).
 */
import type { Tile, TileState } from './tiles';

/** Lower case, accents folded, punctuation to spaces: "Café-run!" -> "cafe run". */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokens(text: string): string[] {
  const clean = normalise(text);
  return clean ? clean.split(' ') : [];
}

interface TileIndex {
  /** Title, caption and each synonym, normalised, as whole phrases. */
  phrases: readonly string[];
  /** Every distinct word of those phrases. */
  words: readonly string[];
}

const INDEX = new WeakMap<Tile, TileIndex>();

function indexOf(tile: Tile): TileIndex {
  const cached = INDEX.get(tile);
  if (cached) return cached;
  const phrases = [tile.title, tile.label, ...tile.synonyms].map(normalise).filter(Boolean);
  const words = [...new Set(phrases.flatMap((phrase) => phrase.split(' ')))];
  const built = { phrases, words };
  INDEX.set(tile, built);
  return built;
}

/** Edits allowed for a word of this length: none for short words, where a typo changes the meaning. */
function typoBudget(length: number): number {
  if (length < 4) return 0;
  return length < 8 ? 1 : 2;
}

/** Levenshtein distance, abandoned as soon as it must exceed `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    let best = row;
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      const value = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + cost,
      );
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[b.length] ?? max + 1;
}

/** 0 = a word starts with the token, 1 = a word contains it, 2 = a typo away, `null` = no match. */
function tokenTier(token: string, words: readonly string[]): 0 | 1 | 2 | null {
  let tier: 0 | 1 | 2 | null = null;
  const budget = typoBudget(token.length);
  for (const word of words) {
    if (word.startsWith(token)) return 0;
    if (token.length >= 3 && word.includes(token)) tier = 1;
    else if (tier === null && budget > 0) {
      // Compare against the word's start too, so "recyle" finds "recycling" while typing.
      const head = word.slice(0, token.length + 1);
      if (
        editDistance(token, word, budget) <= budget ||
        editDistance(token, head, budget) <= budget
      ) {
        tier = 2;
      }
    }
  }
  return tier;
}

/**
 * How well a tile answers a query, lower is better; `null` when it does not.
 * 0: the title, caption or a synonym starts with the whole query.
 * 1: every word of the query starts a word of the tile.
 * 2: every word is found inside one.
 * 3: found only by allowing for a typo.
 */
export function matchTier(tile: Tile, query: string): 0 | 1 | 2 | 3 | null {
  const clean = normalise(query);
  if (!clean) return null;
  const index = indexOf(tile);
  if (index.phrases.some((phrase) => phrase.startsWith(clean))) return 0;
  let worst = 0;
  for (const token of clean.split(' ')) {
    const tier = tokenTier(token, index.words);
    if (tier === null) return null;
    worst = Math.max(worst, tier);
  }
  return (worst + 1) as 1 | 2 | 3;
}

/** The tiles that answer a query, best first. Hidden tiles never appear. */
export function searchTiles(states: readonly TileState[], query: string): TileState[] {
  const hits: { state: TileState; tier: number }[] = [];
  for (const state of states) {
    if (state.hidden) continue;
    const tier = matchTier(state.tile, query);
    if (tier !== null) hits.push({ state, tier });
  }
  return hits
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.state.recentLogs - a.state.recentLogs ||
        a.state.tile.title.localeCompare(b.state.tile.title, 'en'),
    )
    .map((hit) => hit.state);
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'my',
  'our',
  'i',
  'we',
  'of',
  'to',
  'for',
  'and',
  'in',
  'on',
  'at',
  'with',
  'instead',
  'did',
  'just',
  'some',
  'got',
  'it',
  'not',
  'no',
  'from',
  'today',
  'this',
  'that',
  'up',
  'off',
  'out',
  'day',
  'new',
  'old',
  'own',
  'me',
  'home',
  'used',
  'took',
  'made',
  'had',
  'went',
  'was',
  'something',
]);

export interface CatalogueGuess {
  tile: Tile;
  /** Characters of the description the tile's own words account for. */
  score: number;
}

/**
 * The local matcher of the custom flow: does a free-text description name something the
 * catalogue already has? A tile is a candidate when one of its phrases appears in the text
 * as whole words, or two of its words do. Returns at most two, most convincing first.
 */
export function guessCatalogueTiles(text: string, states: readonly TileState[]): CatalogueGuess[] {
  const words = tokens(text).filter((word) => !/^\d+$/.test(word));
  const content = words.filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  if (content.length === 0) return [];
  const padded = ` ${words.join(' ')} `;
  const guesses: CatalogueGuess[] = [];

  for (const state of states) {
    if (state.hidden) continue;
    const index = indexOf(state.tile);
    let phraseScore = 0;
    for (const phrase of index.phrases) {
      const significant = phrase
        .split(' ')
        .some((word) => word.length > 3 && !STOP_WORDS.has(word));
      if (significant && padded.includes(` ${phrase} `)) {
        phraseScore = Math.max(phraseScore, phrase.length);
      }
    }
    const shared = content.filter((word) => word.length > 3 && index.words.includes(word));
    const wordScore = shared.length >= 2 ? shared.join('').length : 0;
    const score = Math.max(phraseScore, wordScore);
    if (score > 0) guesses.push({ tile: state.tile, score });
  }

  return guesses.sort((a, b) => b.score - a.score || a.tile.order - b.tile.order).slice(0, 2);
}

/** The first plain number in a description ("cycled 12 km" -> 12), or `null`. */
export function quantityIn(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)/.exec(text);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value <= 10_000 ? value : null;
}
