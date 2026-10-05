import { describe, expect, it } from 'vitest';
import { STORE_KEY as COACH_STORE_KEY } from '@/ai/coachStore';
import { STORAGE_KEYS, STORAGE_PREFIX } from '@/game/keys';
import { BRAND } from '@/lib/brand';

/**
 * Promises that two modules make to each other but cannot check themselves,
 * because neither is allowed to import the other.
 */
describe('cross-module contracts', () => {
  it('the coach saves its chat under the key the game exports and resets', () => {
    expect(COACH_STORE_KEY).toBe(STORAGE_KEYS.coach);
  });

  it('every storage key lives under the product prefix', () => {
    for (const key of Object.values(STORAGE_KEYS))
      expect(key.startsWith(STORAGE_PREFIX)).toBe(true);
    expect(STORAGE_PREFIX).toBe(`${BRAND.slug.replace('-', '')}:`);
  });
});
