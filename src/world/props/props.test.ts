import { describe, expect, it } from 'vitest';
import { ISLAND } from '../config';
import { TREE_ORIGIN } from '../tree/island';
import {
  FLOWER_COUNT,
  HOMES,
  RIM,
  TRUNK_CLEARANCE,
  clockToIsland,
  layoutIsland,
  type Spot,
} from './layout';

const SEEDS = [1, 2, 3, 7, 12, 99, 1234, 20261006, 4_000_000_000];

const footprints = (seed: number): Array<Spot & { id: string }> => {
  const layout = layoutIsland(seed);
  return [
    ...Object.entries(layout.spots).map(([id, spot]) => ({ ...spot, id })),
    ...layout.flowers.map((spot, index) => ({ ...spot, id: `flower-${index}` })),
  ];
};

describe('clock positions', () => {
  it('puts 6 o’clock towards the viewer and 3 o’clock on the right', () => {
    const [x6, z6] = clockToIsland(6, 1);
    expect(x6).toBeCloseTo(0);
    expect(z6).toBeCloseTo(ISLAND.radius);
    const [x3, z3] = clockToIsland(3, 1);
    expect(x3).toBeCloseTo(ISLAND.radius);
    expect(z3).toBeCloseTo(0);
  });
});

describe('island layout', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(JSON.stringify(layoutIsland(12))).toBe(JSON.stringify(layoutIsland(12)));
    const a = layoutIsland(12).spots.pond;
    const b = layoutIsland(13).spots.pond;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0);
  });

  it('places every ground prop and landmark, and all nine flowers', () => {
    for (const seed of SEEDS) {
      const layout = layoutIsland(seed);
      expect(Object.keys(layout.spots).sort()).toEqual(
        Object.keys(HOMES)
          .filter((id) => id !== 'flowers')
          .sort(),
      );
      expect(layout.flowers, `seed ${seed}`).toHaveLength(FLOWER_COUNT);
    }
  });

  it('never overlaps two footprints', () => {
    for (const seed of SEEDS) {
      const all = footprints(seed);
      for (let i = 0; i < all.length; i += 1) {
        for (let j = i + 1; j < all.length; j += 1) {
          const a = all[i] as Spot & { id: string };
          const b = all[j] as Spot & { id: string };
          const distance = Math.hypot(a.x - b.x, a.z - b.z);
          expect(distance, `seed ${seed}: ${a.id} / ${b.id}`).toBeGreaterThanOrEqual(
            a.radius + b.radius - 1e-6,
          );
        }
      }
    }
  });

  it('keeps everything on the lawn, inside the hour ticks and off the trunk', () => {
    for (const seed of SEEDS) {
      for (const spot of footprints(seed)) {
        const fromCentre = Math.hypot(spot.x, spot.z);
        expect(fromCentre + spot.radius, `seed ${seed}: ${spot.id}`).toBeLessThanOrEqual(
          RIM * ISLAND.radius + 1e-6,
        );
        const fromTrunk = Math.hypot(spot.x - TREE_ORIGIN[0], spot.z - TREE_ORIGIN[2]);
        expect(fromTrunk, `seed ${seed}: ${spot.id}`).toBeGreaterThanOrEqual(
          TRUNK_CLEARANCE + spot.radius - 1e-6,
        );
        expect(spot.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('stays near the homes the bible gives (within a quarter of the lawn radius)', () => {
    for (const seed of SEEDS) {
      const { spots } = layoutIsland(seed);
      for (const [id, home] of Object.entries(HOMES)) {
        if (id === 'flowers') continue;
        const [x, z] = clockToIsland(home.clock, home.rho);
        const spot = spots[id as keyof typeof spots];
        expect(Math.hypot(spot.x - x, spot.z - z), `seed ${seed}: ${id}`).toBeLessThan(
          ISLAND.radius * 0.25,
        );
      }
    }
  });

  it('keeps the landmarks on the front half of the lawn, where callouts can reach them', () => {
    for (const seed of SEEDS) {
      const { spots } = layoutIsland(seed);
      for (const id of ['log', 'quests', 'learn', 'community', 'coach'] as const) {
        expect(spots[id].z, `seed ${seed}: ${id}`).toBeGreaterThan(TREE_ORIGIN[2]);
      }
    }
  });
});
