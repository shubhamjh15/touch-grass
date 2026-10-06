import { describe, expect, it } from 'vitest';
import { BADGES } from '@/data/badges';
import { BADGE_LOOK } from './badgeLook';

describe('badge looks', () => {
  it('gives every badge of the catalogue a picture and an ink', () => {
    for (const badge of BADGES) expect(BADGE_LOOK[badge.id], badge.id).toBeDefined();
  });

  it('has no look for a badge that does not exist', () => {
    const ids = new Set(BADGES.map((badge) => badge.id));
    for (const id of Object.keys(BADGE_LOOK)) expect(ids.has(id), id).toBe(true);
  });
});
