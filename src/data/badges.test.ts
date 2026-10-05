import { describe, expect, it } from 'vitest';
import { ISLAND_PROPS, type IslandPropId } from '@/world/contract';
import { BADGES, BADGE_BY_ID, ISLAND_PROP_ORDER, PROP_UNLOCK } from './badges';

describe('badges', () => {
  it('has 33 badges: 15 tiered, 9 single and 9 secret', () => {
    expect(BADGES).toHaveLength(33);
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(33);
    expect(BADGES.filter((badge) => badge.thresholds.length === 3)).toHaveLength(15);
    expect(BADGES.filter((badge) => badge.secret)).toHaveLength(9);
    expect(BADGES.filter((badge) => !badge.secret && badge.thresholds.length === 1)).toHaveLength(
      9,
    );
  });

  it('pays 20 / 40 / 80 per tier and 50 for secrets', () => {
    for (const badge of BADGES) {
      expect(badge.xp).toHaveLength(badge.thresholds.length);
      if (badge.thresholds.length === 3) expect(badge.xp).toEqual([20, 40, 80]);
      if (badge.secret) {
        expect(badge.xp).toEqual([50]);
        expect(badge.riddle).toBeTruthy();
      }
      expect([...badge.thresholds]).toEqual([...badge.thresholds].sort((a, b) => a - b));
    }
    expect(BADGE_BY_ID.get('loop-maker')?.thresholds).toEqual([5, 20, 60]);
    expect(BADGE_BY_ID.get('ring-collector')?.thresholds).toEqual([7, 30, 150]);
  });

  it('unlocks every contract prop through exactly one existing badge tier', () => {
    const keys = Object.keys(PROP_UNLOCK) as IslandPropId[];
    expect([...keys].sort()).toEqual([...ISLAND_PROPS].sort());
    const seen = new Set<string>();
    for (const prop of ISLAND_PROPS) {
      const unlock = PROP_UNLOCK[prop];
      const badge = BADGE_BY_ID.get(unlock.badge);
      expect(badge).toBeDefined();
      expect(badge?.thresholds[unlock.tier - 1]).toBeDefined();
      expect(badge?.secret).toBe(false);
      const key = `${unlock.badge}:${unlock.tier}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(unlock.logLine.length).toBeGreaterThan(10);
    }
  });

  it('repeats the world contract order exactly', () => {
    expect(ISLAND_PROP_ORDER).toEqual([...ISLAND_PROPS]);
  });
});
