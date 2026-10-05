import { describe, expect, it } from 'vitest';
import { ISLAND } from '../config';
import { ISLAND_PROPS, LANDMARKS, SPECIES } from '../contract';
import { generateTree } from '../tree/generate';
import { TREE_ORIGIN } from '../tree/island';
import { createPose, poseTree } from '../tree/pose';
import {
  FLOWER_COUNT,
  HOMES,
  RIM,
  TRUNK_CLEARANCE,
  clockToIsland,
  layoutIsland,
  type Spot,
} from './layout';
import { buildProps, findHangPoints } from './models';
import { SLOT, SLOT_COUNT, landmarkSlot, propSlot } from './slots';

const SEEDS = [1, 2, 3, 7, 12, 99, 1234, 20261006, 4_000_000_000];
const EMBLEM = [0, -0.4, 2.6] as const;

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

describe('prop models', () => {
  it('builds a consistent mesh for every single prop and for all of them', () => {
    const skeleton = generateTree(12, 'oak');
    const sets = [[], ...ISLAND_PROPS.map((id) => [id]), [...ISLAND_PROPS]];
    for (const props of sets) {
      const { data } = buildProps({ seed: 12, props, skeleton, emblem: EMBLEM });
      const vertices = data.positions.length / 3;
      expect(vertices % 3).toBe(0);
      expect(data.normals).toHaveLength(vertices * 3);
      expect(data.tones).toHaveLength(vertices);
      expect(data.gloss).toHaveLength(vertices);
      expect(data.sway).toHaveLength(vertices * 3);
      expect(data.inner).toHaveLength(vertices * 4);
      expect(data.outer).toHaveLength(vertices * 4);
      expect(data.positions.every(Number.isFinite)).toBe(true);
      expect(data.normals.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < vertices; i += 1) {
        const inner = data.inner[i * 4 + 3] as number;
        const outer = data.outer[i * 4 + 3] as number;
        expect(inner).toBeLessThan(SLOT_COUNT);
        expect(outer).toBeGreaterThan(0);
        expect(outer).toBeLessThan(SLOT.blades);
      }
    }
  });

  it('is deterministic', () => {
    const skeleton = generateTree(7, 'cherry');
    const build = () =>
      buildProps({ seed: 7, props: [...ISLAND_PROPS], skeleton, emblem: EMBLEM }).data.positions;
    expect(build()).toEqual(build());
  });

  it('stays within a small triangle budget with everything unlocked', () => {
    for (const species of SPECIES) {
      const skeleton = generateTree(12, species);
      const hang = findHangPoints(skeleton);
      const { data } = buildProps({
        seed: 12,
        props: [...ISLAND_PROPS],
        skeleton,
        emblem: EMBLEM,
        hang: { birdhouse: hang.left, swing: hang.right },
      });
      expect(data.positions.length / 9, species).toBeLessThan(4200);
    }
  });

  it('always models the landmark objects and gives each an anchor above the lawn', () => {
    const { data, anchors } = buildProps({
      seed: 3,
      props: [],
      skeleton: generateTree(3, 'pine'),
      emblem: EMBLEM,
    });
    const slots = new Set<number>();
    for (let i = 3; i < data.outer.length; i += 4) slots.add(data.outer[i] as number);
    for (const id of LANDMARKS) {
      if (id === 'impact') continue;
      expect(slots.has(landmarkSlot(id)), id).toBe(true);
      expect(anchors[id][1], id).toBeGreaterThan(0);
    }
    expect(anchors.impact).toEqual(EMBLEM);
    expect(slots.has(propSlot('pond'))).toBe(false);
  });

  it('hangs the birdhouse and the swing on branches only when one can carry them', () => {
    const pine = findHangPoints(generateTree(12, 'pine'));
    expect(pine).toEqual({ left: null, right: null });
    for (const species of ['oak', 'cherry'] as const) {
      for (const seed of SEEDS.slice(0, 5)) {
        const skeleton = generateTree(seed, species);
        const { left, right } = findHangPoints(skeleton);
        const pose = poseTree(skeleton, 1, createPose(skeleton));
        for (const point of [left, right]) {
          if (!point) continue;
          // The branch has grown past the hanging point on a full-grown tree.
          expect(pose.tipLength[point.branch], `${species} ${seed}`).toBeGreaterThanOrEqual(
            point.along,
          );
          expect(point.position[1]).toBeGreaterThan(1.2);
        }
        if (left) expect(left.position[0]).toBeLessThan(0);
        if (right) expect(right.position[0]).toBeGreaterThan(0);
      }
    }
  });

  it('gives a conifer a gallows for the swing and everyone else nothing until a branch is ready', () => {
    const triangles = (species: 'oak' | 'pine') =>
      buildProps({
        seed: 12,
        props: ['swing'],
        skeleton: generateTree(12, species),
        emblem: EMBLEM,
      }).data.positions.length -
      buildProps({ seed: 12, props: [], skeleton: generateTree(12, species), emblem: EMBLEM }).data
        .positions.length;
    expect(triangles('pine')).toBeGreaterThan(0);
    expect(triangles('oak')).toBe(0);
  });
});
