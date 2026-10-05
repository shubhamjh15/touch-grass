import { ISLAND, TONE } from '../config';
import type { IslandPropId, LandmarkId } from '../contract';
import { TREE_ORIGIN } from '../tree/island';
import type { Skeleton } from '../tree/types';
import { ModelBuilder, type ModelData } from './kit';
import { layoutIsland, type Spot } from './layout';
import { SLOT, landmarkSlot, propSlot } from './slots';

/**
 * Every prop and landmark object of the island (design bible 5.6 and 5.7), modelled
 * from a handful of flat-toned solids in the sticker language: chunky, toy-like, a few
 * triangles per shape. All of them are merged into one mesh; `slots.ts` explains how
 * parts of that mesh still move on their own.
 */

type P3 = readonly [number, number, number];

/** A point on a branch where something can hang, in tree space. */
export interface HangPoint {
  position: P3;
  /** Wind weights of the branch there: the hung prop rides the branch. */
  sway: P3;
  branch: number;
  /** Distance along the branch: the prop appears once the growing tip has passed it. */
  along: number;
}

export interface TapTarget {
  slot: number;
  /** Island space. */
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface PropsModel {
  data: ModelData;
  /** Where each landmark's callout dot sits, in island space. */
  anchors: Record<LandmarkId, P3>;
  targets: TapTarget[];
  /** Trunk node the passport tag is tied to, and the trunk radius it was modelled for. */
  tag: { node: number; radius: number };
  /** Island-space points the creatures orbit. */
  hive: P3 | null;
  meadow: P3;
  moss: P3;
  can: P3;
  lantern: P3 | null;
}

const SWING_SEAT_HEIGHT = 0.62;
const TAG_HEIGHT = 0.72;

/**
 * The lowest sturdy branch on each side of the trunk: the birdhouse hangs on the
 * viewer's left, the swing on the right. Conifers have none, and get posts instead.
 */
export function findHangPoints(skeleton: Skeleton | null): {
  left: HangPoint | null;
  right: HangPoint | null;
} {
  const result: { left: HangPoint | null; right: HangPoint | null } = { left: null, right: null };
  if (!skeleton || skeleton.shape === 'tier') return result;
  skeleton.branches.forEach((branch, index) => {
    if (branch.parent !== 0 || branch.nodeCount < 3) return;
    const node = branch.nodeStart + Math.round((branch.nodeCount - 1) * 0.62);
    const x = skeleton.nodePosition[node * 3] as number;
    const y = skeleton.nodePosition[node * 3 + 1] as number;
    const z = skeleton.nodePosition[node * 3 + 2] as number;
    // Enough air under it for a seat, far enough out to clear the trunk, not behind it.
    if (y < 1.25 || Math.abs(x) < 0.55 || z < -0.9) return;
    const point: HangPoint = {
      position: [x, y, z],
      sway: [
        skeleton.nodeSway[node * 3] as number,
        skeleton.nodeSway[node * 3 + 1] as number,
        skeleton.nodeSway[node * 3 + 2] as number,
      ],
      branch: index,
      along: skeleton.nodeLength[node] as number,
    };
    const side = x < 0 ? 'left' : 'right';
    const current = result[side];
    if (!current || y < current.position[1]) result[side] = point;
  });
  return result;
}

const FLOWER_TONES = [TONE.pink, TONE.yellow, TONE.violet] as const;

function flowers(b: ModelBuilder, spots: readonly Spot[]): void {
  spots.forEach((spot, index) => {
    const size = 0.85 + ((index * 7) % 5) * 0.075;
    b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('flowers'), size);
    b.bend(0.3, 0.55, 0.5, index * 0.37);
    b.cyl(0, 0, 0, 0.016, 0.014, 0.22, TONE.ink, { sides: 3, smooth: false });
    b.part(SLOT.flowerHeads, [0, 0.24, 0]);
    b.slab(ModelBuilder.disc(0, 0.24, 0.085, 7), -0.02, 0.02, FLOWER_TONES[index % 3] as number);
    b.slab(ModelBuilder.disc(0, 0.24, 0.03, 5), 0.02, 0.035, TONE.ink);
    b.body();
  });
}

function mushrooms(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('mushrooms'));
  const one = (x: number, z: number, size: number) => {
    b.cyl(x, 0, z, 0.034 * size, 0.03 * size, 0.1 * size, TONE.paper, { sides: 6 });
    b.ball(x, 0.105 * size, z, 0.1 * size, 0.075 * size, 0.1 * size, TONE.tomato, {
      gloss: true,
      rings: 4,
      sides: 8,
    });
    b.ball(x - 0.04 * size, 0.15 * size, z + 0.06 * size, 0.018, 0.018, 0.012, TONE.white, {
      rings: 2,
      sides: 5,
    });
    b.ball(x + 0.045 * size, 0.125 * size, z + 0.075 * size, 0.014, 0.014, 0.01, TONE.white, {
      rings: 2,
      sides: 5,
    });
  };
  one(0, 0, 1.25);
  one(0.15, 0.05, 0.9);
  one(-0.11, 0.09, 0.7);
}

function pond(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y - 0.01, spot.z, spot.yaw, propSlot('pond'));
  b.plate(ModelBuilder.oval(0, 0, 0.62, 0.4, 14), 0, 0.045, TONE.blue);
  b.plate(ModelBuilder.oval(-0.2, -0.13, 0.17, 0.05, 6), 0.045, 0.052, TONE.white);
  b.plate(ModelBuilder.oval(0.27, 0.12, 0.11, 0.075, 7), 0.045, 0.07, TONE.green);
  // The ripple: a flat ring that the scene steps outwards three times, then hides.
  b.part(SLOT.ripple, [-0.06, 0.05, 0.02]);
  const outer = ModelBuilder.oval(-0.06, 0.02, 0.3, 0.19, 12);
  const inner = ModelBuilder.oval(-0.06, 0.02, 0.24, 0.15, 12);
  for (let i = 0; i < outer.length; i += 1) {
    const j = (i + 1) % outer.length;
    const [oa, ob, ia, ib] = [outer[i], outer[j], inner[i], inner[j]] as [
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
    ];
    b.quad(
      [ia[0], 0.05, ia[1]],
      [oa[0], 0.05, oa[1]],
      [ob[0], 0.05, ob[1]],
      [ib[0], 0.05, ib[1]],
      TONE.white,
    );
  }
  b.body();
}

function bench(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('bench'));
  for (const x of [-0.28, 0.28]) {
    b.box(x, 0.1, 0.07, 0.045, 0.2, 0.045, TONE.ink);
    b.box(x, 0.21, -0.09, 0.045, 0.42, 0.045, TONE.ink);
  }
  b.box(0, 0.215, 0, 0.72, 0.05, 0.24, TONE.bark);
  b.box(0, 0.36, -0.1, 0.72, 0.11, 0.04, TONE.bark);
}

function lantern(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('lantern'));
  // At night the lantern lays a hard disc of light on the lawn instead of a cast shadow.
  b.part(SLOT.lanternDisc, [0, 0.012, 0]);
  b.plate(ModelBuilder.oval(0, 0, 0.9, 0.9, 20), 0.008, 0.014, TONE.glow);
  b.body();
  b.cyl(0, 0, 0, 0.034, 0.028, 0.44, TONE.bark, { sides: 6 });
  b.box(0, 0.45, 0, 0.2, 0.03, 0.2, TONE.bark);
  b.box(0, 0.54, 0, 0.16, 0.16, 0.16, TONE.glass);
  b.box(0, 0.54, 0.081, 0.022, 0.16, 0.012, TONE.ink);
  b.box(0, 0.54, 0.081, 0.16, 0.022, 0.012, TONE.ink);
  b.cyl(0, 0.62, 0, 0.14, 0, 0.09, TONE.bark, { sides: 4, smooth: false });
}

const BLADE: ReadonlyArray<readonly [number, number]> = [
  [-0.035, 0.02],
  [0.035, 0.02],
  [0.06, 0.2],
  [0.012, 0.62],
  [-0.03, 0.2],
];

function turbine(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('turbine'));
  const hub = 1.52;
  b.cyl(0, 0, 0, 0.075, 0.04, hub, TONE.white, { sides: 7 });
  b.box(0, hub, 0.03, 0.12, 0.11, 0.24, TONE.white);
  b.part(SLOT.blades, [0, hub, 0.17]);
  for (let blade = 0; blade < 3; blade += 1) {
    const angle = (blade / 3) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const turned = BLADE.map(([x, y]) => [x * cos - y * sin, hub + x * sin + y * cos] as const);
    b.slab(turned, 0.15, 0.185, TONE.white);
  }
  b.ball(0, hub, 0.19, 0.065, 0.065, 0.05, TONE.yellow, { rings: 3, sides: 7 });
  b.body();
}

function solar(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('solar'));
  const pitch = 0.72;
  b.cyl(0, 0, 0, 0.034, 0.03, 0.28, TONE.bark, { sides: 6 });
  b.box(0, 0.34, 0, 0.6, 0.04, 0.4, TONE.blue, { pitch });
  // Printed grid: three cells by two.
  const lift = 0.024;
  const up = (y: number, z: number): [number, number] => [
    0.34 + y * Math.cos(pitch) - z * Math.sin(pitch),
    y * Math.sin(pitch) + z * Math.cos(pitch),
  ];
  for (const x of [-0.1, 0.1]) {
    const [y, z] = up(lift, 0);
    b.box(x, y, z, 0.018, 0.012, 0.4, TONE.white, { pitch });
  }
  const [y, z] = up(lift, 0);
  b.box(0, y, z, 0.6, 0.012, 0.018, TONE.white, { pitch });
}

function compost(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('compost'));
  b.box(0, 0.16, 0, 0.46, 0.32, 0.4, TONE.kraftA);
  for (const y of [0.1, 0.21]) b.box(0, y, 0.201, 0.47, 0.028, 0.012, TONE.kraftDark);
  for (const x of [-0.235, 0.235]) b.box(x, 0.16, 0.19, 0.03, 0.34, 0.05, TONE.kraftDark);
  b.box(0.01, 0.35, 0, 0.54, 0.06, 0.48, TONE.green, { roll: -0.07 });
  // Two paper puffs of steam on a thread.
  b.part(SLOT.steam, [0.06, 0.4, 0]);
  b.cyl(0.06, 0.38, 0, 0.007, 0.007, 0.44, TONE.ink, { sides: 3, smooth: false });
  b.ball(0.05, 0.6, 0, 0.07, 0.055, 0.03, TONE.white, { rings: 3, sides: 7 });
  b.ball(0.09, 0.8, 0, 0.055, 0.045, 0.03, TONE.white, { rings: 3, sides: 7 });
  b.body();
}

function veggiePatch(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('veggie-patch'));
  b.box(0, 0.05, 0, 0.9, 0.1, 0.56, TONE.kraftDark);
  let phase = 0;
  for (const z of [-0.14, 0.14]) {
    for (const x of [-0.29, 0, 0.29]) {
      const carrot = x > 0 === z > 0;
      if (carrot) b.cyl(x, 0.1, z, 0.05, 0.045, 0.035, TONE.orange, { sides: 6 });
      b.bend(0.3, 0.5, 0.5, (phase += 0.23));
      b.cyl(x - 0.035, 0.12, z, 0.03, 0, 0.14, TONE.green, { sides: 4, smooth: false });
      b.cyl(x + 0.035, 0.12, z, 0.03, 0, 0.11, TONE.green, { sides: 4, smooth: false });
      b.cyl(x, 0.12, z + 0.01, 0.034, 0, 0.18, TONE.green, { sides: 4, smooth: false });
      b.bend(0, 0, 0, 0);
    }
  }
}

function beehive(b: ModelBuilder, spot: Spot): P3 {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('beehive'));
  b.cyl(0, 0, 0, 0.034, 0.03, 0.2, TONE.bark, { sides: 6 });
  b.box(0, 0.21, 0, 0.3, 0.03, 0.26, TONE.bark);
  b.cyl(0, 0.225, 0, 0.15, 0.17, 0.11, TONE.yellow, { sides: 9 });
  b.cyl(0, 0.335, 0, 0.18, 0.18, 0.11, TONE.yellow, { sides: 9 });
  b.cyl(0, 0.445, 0, 0.17, 0.12, 0.1, TONE.yellow, { sides: 9 });
  b.cyl(0, 0.545, 0, 0.12, 0.03, 0.05, TONE.yellow, { sides: 9 });
  b.slab(ModelBuilder.disc(0, 0.28, 0.04, 6), 0.15, 0.175, TONE.ink);
  return [spot.x, spot.y + 0.42, spot.z];
}

/** The little house itself, with its origin under the middle of its floor. */
function birdhouseBody(b: ModelBuilder, y: number): void {
  b.box(0, y + 0.11, 0, 0.24, 0.22, 0.2, TONE.pink);
  b.slab(
    [
      [-0.18, y + 0.2],
      [0.18, y + 0.2],
      [0, y + 0.37],
    ],
    -0.14,
    0.14,
    TONE.yellow,
  );
  b.slab(ModelBuilder.disc(0, y + 0.12, 0.045, 7), 0.1, 0.112, TONE.ink);
  b.box(0, y + 0.045, 0.13, 0.02, 0.02, 0.07, TONE.bark);
}

function birdhouse(b: ModelBuilder, spot: Spot, hang: HangPoint | null): void {
  if (hang) {
    const [x, y, z] = hang.position;
    b.place(x + TREE_ORIGIN[0], y + TREE_ORIGIN[1], z + TREE_ORIGIN[2], 0, propSlot('birdhouse'));
    b.ride(hang.sway);
    b.cyl(0, -0.3, 0, 0.007, 0.007, 0.3, TONE.ink, { sides: 3, smooth: false });
    birdhouseBody(b, -0.66);
    b.ride(null);
    return;
  }
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('birdhouse'));
  b.cyl(0, 0, 0, 0.034, 0.028, 0.5, TONE.bark, { sides: 6 });
  birdhouseBody(b, 0.5);
}

function swing(b: ModelBuilder, spot: Spot, hang: HangPoint | null): void {
  if (hang) {
    const [x, y, z] = hang.position;
    const drop = Math.max(0.5, y - SWING_SEAT_HEIGHT);
    b.place(x + TREE_ORIGIN[0], y + TREE_ORIGIN[1], z + TREE_ORIGIN[2], 0, propSlot('swing'));
    b.ride(hang.sway);
    b.part(SLOT.swingSeat, [0, 0, 0]);
    for (const side of [-0.17, 0.17]) {
      b.cyl(side, -drop, 0, 0.008, 0.008, drop, TONE.ink, { sides: 3, smooth: false });
    }
    b.box(0, -drop, 0, 0.42, 0.045, 0.15, TONE.bark);
    b.body();
    b.ride(null);
    return;
  }
  // No branch to hang from (a conifer): a small gallows carries the swing instead.
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('swing'));
  const top = 1.04;
  b.cyl(-0.26, 0, 0, 0.04, 0.032, top + 0.04, TONE.bark, { sides: 6 });
  b.box(0.04, top, 0, 0.66, 0.055, 0.055, TONE.bark);
  b.part(SLOT.swingSeat, [0.1, top, 0]);
  for (const side of [-0.07, 0.27]) {
    b.cyl(side, top - 0.6, 0, 0.008, 0.008, 0.6, TONE.ink, { sides: 3, smooth: false });
  }
  b.box(0.1, top - 0.6, 0, 0.42, 0.045, 0.15, TONE.bark);
  b.body();
}

function signpost(b: ModelBuilder, spot: Spot): void {
  b.place(spot.x, spot.y, spot.z, spot.yaw, propSlot('signpost'));
  b.cyl(0, 0, 0, 0.036, 0.03, 0.62, TONE.bark, { sides: 6 });
  b.slab(
    [
      [-0.15, 0.4],
      [0.13, 0.4],
      [0.24, 0.47],
      [0.13, 0.54],
      [-0.15, 0.54],
    ],
    0.03,
    0.06,
    TONE.yellow,
  );
  b.slab(
    [
      [0.15, 0.22],
      [0.15, 0.35],
      [-0.12, 0.35],
      [-0.22, 0.285],
      [-0.12, 0.22],
    ],
    0.03,
    0.06,
    TONE.pink,
  );
}

// --- Landmarks -----------------------------------------------------------------------------

function wateringCan(b: ModelBuilder, spot: Spot): P3 {
  b.place(spot.x, spot.y, spot.z, spot.yaw, landmarkSlot('log'));
  // It tips about its foot on the trunk side when the tree is watered.
  b.pivot([-0.12, 0, 0]);
  b.cyl(0, 0, 0, 0.13, 0.115, 0.22, TONE.blue, { sides: 9, gloss: true });
  b.box(-0.2, 0.2, 0, 0.26, 0.035, 0.04, TONE.blue, { roll: -0.62 });
  b.cyl(-0.31, 0.25, 0, 0.03, 0.06, 0.05, TONE.blue, { sides: 6 });
  b.box(0.17, 0.13, 0, 0.035, 0.17, 0.04, TONE.blue);
  b.box(0.14, 0.215, 0, 0.09, 0.035, 0.04, TONE.blue);
  b.box(0.14, 0.045, 0, 0.09, 0.035, 0.04, TONE.blue);
  return [spot.x, spot.y + 0.2, spot.z];
}

function noticeBoard(b: ModelBuilder, spot: Spot): P3 {
  b.place(spot.x, spot.y, spot.z, spot.yaw, landmarkSlot('quests'));
  for (const x of [-0.23, 0.23]) b.cyl(x, 0, 0, 0.03, 0.026, 0.6, TONE.bark, { sides: 6 });
  b.box(0, 0.42, 0, 0.6, 0.36, 0.045, TONE.kraftA);
  b.box(-0.18, 0.44, 0.026, 0.13, 0.17, 0.012, TONE.yellow, { roll: 0.08 });
  b.box(0, 0.4, 0.026, 0.13, 0.17, 0.012, TONE.pink, { roll: -0.06 });
  b.box(0.18, 0.45, 0.026, 0.13, 0.15, 0.012, TONE.white, { roll: 0.05 });
  for (const x of [-0.18, 0, 0.18]) {
    b.ball(x, 0.515, 0.04, 0.016, 0.016, 0.012, TONE.tomato, { rings: 2, sides: 5 });
  }
  return [spot.x, spot.y + 0.44, spot.z];
}

function books(b: ModelBuilder, spot: Spot): P3 {
  b.place(spot.x, spot.y, spot.z, spot.yaw, landmarkSlot('learn'));
  b.box(0, 0.035, 0, 0.34, 0.07, 0.25, TONE.blue);
  b.box(0, 0.035, 0.012, 0.3, 0.045, 0.25, TONE.white);
  b.box(0.015, 0.105, 0, 0.3, 0.07, 0.23, TONE.pink);
  b.box(0.015, 0.105, 0.012, 0.26, 0.045, 0.23, TONE.white);
  // The open book on top: two covers in a shallow V, pages above them.
  for (const side of [-1, 1]) {
    b.box(side * 0.078, 0.175, 0, 0.16, 0.022, 0.22, TONE.yellow, { roll: side * 0.22 });
    b.box(side * 0.074, 0.196, 0, 0.14, 0.02, 0.2, TONE.white, { roll: side * 0.22 });
  }
  return [spot.x, spot.y + 0.2, spot.z];
}

function mailbox(b: ModelBuilder, spot: Spot): P3 {
  b.place(spot.x, spot.y, spot.z, spot.yaw, landmarkSlot('community'));
  b.cyl(0, 0, 0, 0.034, 0.03, 0.36, TONE.bark, { sides: 6 });
  b.box(0, 0.44, 0, 0.2, 0.15, 0.3, TONE.pink);
  b.box(0, 0.53, 0, 0.15, 0.05, 0.3, TONE.pink);
  b.box(0, 0.44, 0.152, 0.11, 0.022, 0.01, TONE.ink);
  b.box(0.112, 0.5, 0.05, 0.02, 0.17, 0.03, TONE.yellow);
  b.box(0.112, 0.565, 0.085, 0.02, 0.07, 0.09, TONE.yellow);
  return [spot.x, spot.y + 0.5, spot.z];
}

/** Moss, the coach: a glossy moss ball with two dot eyes, a small mouth and one sprout. */
function moss(b: ModelBuilder, spot: Spot): P3 {
  b.place(spot.x, spot.y, spot.z, 0, landmarkSlot('coach'));
  b.ball(0, 0.235, 0, 0.27, 0.245, 0.26, TONE.moss, { gloss: true, rings: 6, sides: 12 });
  b.part(SLOT.mossEyes, [0, 0.29, 0.22]);
  for (const side of [-1, 1]) {
    b.ball(side * 0.095, 0.29, 0.215, 0.055, 0.06, 0.035, TONE.white, { rings: 3, sides: 8 });
    b.ball(side * 0.09, 0.285, 0.245, 0.024, 0.028, 0.016, TONE.ink, { rings: 3, sides: 6 });
  }
  b.body();
  b.slab(
    [
      [-0.04, 0.2],
      [-0.015, 0.182],
      [0.015, 0.182],
      [0.04, 0.2],
      [0.015, 0.192],
      [-0.015, 0.192],
    ],
    0.25,
    0.262,
    TONE.ink,
  );
  b.part(SLOT.mossSprout, [0, 0.47, 0]);
  b.cyl(0, 0.46, 0, 0.012, 0.01, 0.1, TONE.ink, { sides: 3, smooth: false });
  b.slab(
    [
      [0, 0.55],
      [0.06, 0.56],
      [0.115, 0.62],
      [0.045, 0.625],
    ],
    -0.012,
    0.012,
    TONE.lime,
  );
  b.slab(
    [
      [0, 0.55],
      [-0.035, 0.6],
      [-0.085, 0.605],
      [-0.05, 0.56],
    ],
    -0.012,
    0.012,
    TONE.lime,
  );
  b.body();
  return [spot.x, spot.y + 0.3, spot.z + 0.2];
}

/** The passport: a paper hang tag tied round the trunk. */
function hangTag(b: ModelBuilder, skeleton: Skeleton): { node: number; radius: number; at: P3 } {
  const trunk = skeleton.branches[0];
  let node = trunk ? trunk.nodeStart : 0;
  if (trunk) {
    for (let n = 0; n < trunk.nodeCount; n += 1) {
      node = trunk.nodeStart + n;
      if ((skeleton.nodePosition[node * 3 + 1] as number) >= TAG_HEIGHT) break;
    }
  }
  const x = (skeleton.nodePosition[node * 3] as number) + TREE_ORIGIN[0];
  const y = (skeleton.nodePosition[node * 3 + 1] as number) + TREE_ORIGIN[1];
  const z = (skeleton.nodePosition[node * 3 + 2] as number) + TREE_ORIGIN[2];
  // Modelled against the stoutest trunk; the scene scales the slot to the trunk of the day.
  const radius = skeleton.metrics.baseRadius * 1.05;
  b.place(x, y, z, 0, landmarkSlot('me'));
  b.box(0, 0, radius * 0.5, radius * 2.15, 0.03, radius * 1.2, TONE.pink);
  b.cyl(radius * 0.55, -0.12, radius + 0.03, 0.006, 0.006, 0.12, TONE.ink, {
    sides: 3,
    smooth: false,
  });
  b.slab(
    [
      [radius * 0.55 - 0.085, -0.36],
      [radius * 0.55 + 0.085, -0.36],
      [radius * 0.55 + 0.085, -0.17],
      [radius * 0.55 + 0.035, -0.11],
      [radius * 0.55 - 0.035, -0.11],
      [radius * 0.55 - 0.085, -0.17],
    ],
    radius + 0.02,
    radius + 0.045,
    TONE.paper,
  );
  b.slab(
    ModelBuilder.disc(radius * 0.55, -0.16, 0.018, 5),
    radius + 0.045,
    radius + 0.052,
    TONE.ink,
  );
  return { node, radius, at: [x + radius * 0.55, y - 0.24, z + radius] };
}

export interface PropsInput {
  seed: number;
  props: readonly IslandPropId[];
  skeleton: Skeleton | null;
  /** Centre of the ring medallion (the Impact landmark), island space. */
  emblem: P3;
  /** Branch points that have grown out far enough to carry the hung props, if any. */
  hang?: { birdhouse: HangPoint | null; swing: HangPoint | null };
}

/** Builds the merged prop mesh for a set of unlocked props. Deterministic from its input. */
export function buildProps({ seed, props, skeleton, emblem, hang }: PropsInput): PropsModel {
  const layout = layoutIsland(seed);
  const { spots } = layout;
  const has = (id: IslandPropId) => props.includes(id);
  const houseHang = hang?.birdhouse ?? null;
  const swingHang = hang?.swing ?? null;
  // A conifer never grows a branch that could carry the swing: it gets a small gallows.
  const gallows = skeleton?.shape === 'tier';
  const b = new ModelBuilder();
  const targets: TapTarget[] = [];
  const target = (slot: number, spot: Spot, height: number, radius = spot.radius) =>
    targets.push({ slot, x: spot.x, y: spot.y + height, z: spot.z, radius: radius + 0.08 });

  if (has('flowers')) {
    flowers(b, layout.flowers);
    for (const spot of layout.flowers) target(propSlot('flowers'), spot, 0.2, 0.14);
  }
  if (has('mushrooms')) {
    mushrooms(b, spots.mushrooms);
    target(propSlot('mushrooms'), spots.mushrooms, 0.1);
  }
  if (has('pond')) {
    pond(b, spots.pond);
    target(propSlot('pond'), spots.pond, 0.02);
  }
  if (has('bench')) {
    bench(b, spots.bench);
    target(propSlot('bench'), spots.bench, 0.25);
  }
  if (has('lantern')) {
    lantern(b, spots.lantern);
    target(propSlot('lantern'), spots.lantern, 0.4, 0.2);
  }
  if (has('turbine')) {
    turbine(b, spots.turbine);
    target(propSlot('turbine'), spots.turbine, 1.2, 0.5);
  }
  if (has('solar')) {
    solar(b, spots.solar);
    target(propSlot('solar'), spots.solar, 0.3);
  }
  if (has('compost')) {
    compost(b, spots.compost);
    target(propSlot('compost'), spots.compost, 0.25);
  }
  if (has('veggie-patch')) {
    veggiePatch(b, spots['veggie-patch']);
    target(propSlot('veggie-patch'), spots['veggie-patch'], 0.1);
  }
  let hive: P3 | null = null;
  if (has('beehive')) {
    hive = beehive(b, spots.beehive);
    target(propSlot('beehive'), spots.beehive, 0.35, 0.22);
  }
  if (has('birdhouse')) {
    birdhouse(b, spots.birdhouse, houseHang);
    if (!houseHang) target(propSlot('birdhouse'), spots.birdhouse, 0.6, 0.2);
  }
  if (has('swing') && (swingHang || gallows)) swing(b, spots.swing, swingHang);
  if (has('signpost')) {
    signpost(b, spots.signpost);
    target(propSlot('signpost'), spots.signpost, 0.4, 0.22);
  }

  const can = wateringCan(b, spots.log);
  target(landmarkSlot('log'), spots.log, 0.12);
  const board = noticeBoard(b, spots.quests);
  target(landmarkSlot('quests'), spots.quests, 0.4);
  const stack = books(b, spots.learn);
  target(landmarkSlot('learn'), spots.learn, 0.1);
  const post = mailbox(b, spots.community);
  target(landmarkSlot('community'), spots.community, 0.45, 0.2);
  const mossAt = moss(b, spots.coach);
  target(landmarkSlot('coach'), spots.coach, 0.25);
  const tag = skeleton
    ? hangTag(b, skeleton)
    : { node: 0, radius: 0.2, at: [TREE_ORIGIN[0], TREE_ORIGIN[1] + 0.5, TREE_ORIGIN[2]] as P3 };

  const anchors: Record<LandmarkId, P3> = {
    log: can,
    quests: board,
    learn: stack,
    impact: emblem,
    community: post,
    coach: mossAt,
    me: tag.at,
  };
  const meadow = layout.flowers.reduce<[number, number, number]>(
    (sum, spot) => [
      sum[0] + spot.x / layout.flowers.length,
      sum[1] + spot.y / layout.flowers.length,
      sum[2] + spot.z / layout.flowers.length,
    ],
    [0, 0, 0],
  );

  return {
    data: b.data,
    anchors,
    targets,
    tag: { node: tag.node, radius: tag.radius },
    hive,
    meadow: layout.flowers.length > 0 ? meadow : [0, 0.05, ISLAND.radius * 0.6],
    moss: [spots.coach.x, spots.coach.y, spots.coach.z],
    can: [spots.log.x, spots.log.y, spots.log.z],
    lantern: has('lantern') ? [spots.lantern.x, spots.lantern.y, spots.lantern.z] : null,
  };
}
