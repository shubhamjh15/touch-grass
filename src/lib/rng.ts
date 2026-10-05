/**
 * Deterministic randomness. The same seed always produces the same sequence, so
 * a user's tree, island and quest rotation look identical on every visit.
 */

/** Returns a float in [0, 1). */
export type Rng = () => number;

/** Fast, well-distributed 32-bit PRNG (mulberry32). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Builds an RNG from any mix of numbers and strings, e.g. `createRng(userSeed, '2026-10-06')`. */
export function createRng(...parts: Array<number | string>): Rng {
  return mulberry32(hashString(parts.join('|')));
}

export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Integer in [min, max], both inclusive. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randomBetween(rng, min, max + 1));
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() needs at least one item');
  return items[Math.floor(rng() * items.length)] as T;
}

/** Returns a shuffled copy (Fisher-Yates). The input is not modified. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Picks `count` distinct items. Returns fewer if the list is shorter. */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, Math.max(0, count));
}

/** A fresh, non-deterministic seed for a new user. */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] as number;
}
