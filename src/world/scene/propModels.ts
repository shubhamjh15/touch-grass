import type * as THREE from 'three';
import type { IslandPropId, LandmarkId } from '../contract';
import type { Spot } from '../props/layout';
import { Kit } from './kit';

/**
 * The toys on the island: every ground prop of `ISLAND_PROPS` and every landmark of
 * `LANDMARKS`, modelled from rounded primitives in the brand palette (design bible 5.6
 * and 5.7, restyled as chunky wooden toys). Each stands on the origin facing +z, the
 * rest camera; the scene places it at its anchor.
 *
 * A model is one merged geometry, plus at most one part that moves by itself (the
 * turbine's rotor, the swing's seat, the duck on the pond) and one that glows (the
 * lantern's glass).
 */

const C = {
  pink: '#f472b6',
  pinkTint: '#fbcfe8',
  yellow: '#facc15',
  yellowTint: '#fde68a',
  violet: '#9974f8',
  tomato: '#ff6b4a',
  blue: '#60a5fa',
  blueDeep: '#3b82f6',
  orange: '#fb923c',
  teal: '#2dd4bf',
  moss: '#22c55e',
  mossDeep: '#16a34a',
  lime: '#bef264',
  green: '#4ade80',
  leaf: '#34b866',
  kraft: '#e7c9a0',
  kraftDeep: '#d4a373',
  kraftDark: '#b98652',
  bark: '#c08457',
  barkDeep: '#96633a',
  soil: '#7a4f33',
  paper: '#fffbeb',
  white: '#ffffff',
  ink: '#3f3f46',
  steel: '#e4e4e7',
  reed: '#8a5a3c',
} as const;

export type Motion = 'spin' | 'swing' | 'float';

export interface PropModel {
  body: THREE.BufferGeometry;
  /** A part that moves on its own about `pivot`. */
  moving?: {
    geometry: THREE.BufferGeometry;
    pivot: readonly [number, number, number];
    motion: Motion;
  };
  /** A part drawn unlit, so it can shine after dark. */
  glow?: THREE.BufferGeometry;
  /** Height of the model: where a label sits and how far a drop-in falls. */
  height: number;
}

const HALF = Math.PI / 2;

function mushrooms(): PropModel {
  const kit = new Kit().patch(0.2);
  const one = (x: number, z: number, size: number, lean: number) => {
    const stem = 0.13 * size;
    kit.cyl(0.035 * size, 0.05 * size, stem, C.paper, { at: [x, stem / 2, z], rot: [0, 0, lean] });
    kit.dome(0.12 * size, C.tomato, {
      at: [x - lean * stem, stem - 0.005, z],
      scale: [1, 0.78, 1],
      rot: [0, 0, lean],
    });
    for (let i = 0; i < 4; i += 1) {
      const angle = i * 1.7 + size * 3;
      const out = 0.065 * size;
      kit.ball(
        0.02 * size,
        C.white,
        {
          at: [
            x - lean * stem + Math.cos(angle) * out,
            stem + 0.066 * size,
            z + Math.sin(angle) * out,
          ],
          scale: [1, 0.5, 1],
        },
        0,
      );
    }
  };
  one(0, 0, 1.25, 0.08);
  one(-0.13, 0.07, 0.85, -0.2);
  one(0.11, 0.09, 0.62, 0.22);
  return { body: kit.build(), height: 0.3 };
}

function pond(): PropModel {
  // Stands on the water: the anchor of the pond is the middle of its surface.
  const kit = new Kit();
  const pad = (x: number, z: number, radius: number) =>
    kit.cyl(radius, radius * 0.92, 0.014, C.green, { at: [x, 0.012, z] }, 9);
  pad(-0.2, 0.12, 0.13);
  pad(0.16, -0.2, 0.1);
  pad(0.24, 0.2, 0.085);
  // A lotus on the largest pad.
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    kit.cone(
      0.03,
      0.09,
      i % 2 ? C.pink : C.pinkTint,
      {
        at: [-0.2 + Math.cos(angle) * 0.03, 0.06, 0.12 + Math.sin(angle) * 0.03],
        rot: [Math.sin(angle) * 0.6, 0, -Math.cos(angle) * 0.6],
      },
      4,
    );
  }
  kit.ball(0.022, C.yellow, { at: [-0.2, 0.05, 0.12] }, 0);
  // Reeds on the far bank.
  const reed = (x: number, z: number, height: number) => {
    kit.cyl(
      0.008,
      0.012,
      height,
      C.leaf,
      {
        at: [x, height / 2, z],
        sway: [0, height],
      },
      5,
    );
    kit.cyl(0.024, 0.024, 0.12, C.reed, { at: [x, height + 0.02, z], sway: [0, height] }, 6);
  };
  reed(-0.42, -0.36, 0.5);
  reed(-0.5, -0.26, 0.38);
  reed(-0.34, -0.44, 0.44);
  reed(0.46, -0.3, 0.42);

  const duck = new Kit();
  duck.ball(0.075, C.yellow, { at: [0, 0.045, 0], scale: [1, 0.78, 1.3] });
  duck.ball(0.05, C.yellow, { at: [0, 0.12, 0.07] });
  duck.cone(0.022, 0.05, C.orange, { at: [0, 0.112, 0.125], rot: [HALF, 0, 0] }, 5);
  duck.cone(0.03, 0.07, C.yellowTint, { at: [0, 0.075, -0.1], rot: [-2.2, 0, 0] }, 4);
  duck.ball(0.01, C.ink, { at: [0.028, 0.135, 0.105] }, 0);
  duck.ball(0.01, C.ink, { at: [-0.028, 0.135, 0.105] }, 0);
  return {
    body: kit.build(false),
    moving: { geometry: duck.build(false), pivot: [0, 0, 0], motion: 'float' },
    height: 0.5,
  };
}

function bench(): PropModel {
  const kit = new Kit().patch(0.36);
  for (const z of [-0.07, 0.07]) {
    kit.rbox(0.72, 0.045, 0.12, 0.02, z < 0 ? C.bark : C.kraftDeep, { at: [0, 0.235, z] });
  }
  for (const [y, tone] of [
    [0.36, C.kraftDeep],
    [0.47, C.bark],
  ] as const) {
    kit.rbox(0.72, 0.085, 0.04, 0.018, tone, {
      at: [0, y, -0.15 - (y - 0.36) * 0.25],
      rot: [-0.2, 0, 0],
    });
  }
  for (const x of [-0.3, 0.3]) {
    kit.box(0.05, 0.23, 0.05, C.barkDeep, { at: [x, 0.115, 0.09] });
    kit.box(0.05, 0.54, 0.05, C.barkDeep, { at: [x, 0.27, -0.14], rot: [-0.12, 0, 0] });
    kit.rbox(0.06, 0.04, 0.3, 0.015, C.barkDeep, { at: [x, 0.33, -0.02] });
  }
  return { body: kit.build(), height: 0.6 };
}

function lantern(): PropModel {
  const kit = new Kit().patch(0.14);
  kit.cyl(0.07, 0.085, 0.05, C.barkDeep, { at: [0, 0.025, 0] });
  kit.cyl(0.026, 0.034, 0.5, C.bark, { at: [0, 0.29, 0] }, 6);
  kit.rbox(0.19, 0.03, 0.19, 0.012, C.ink, { at: [0, 0.545, 0] });
  for (const [x, z] of [
    [-0.075, -0.075],
    [0.075, -0.075],
    [-0.075, 0.075],
    [0.075, 0.075],
  ] as const) {
    kit.box(0.02, 0.17, 0.02, C.ink, { at: [x, 0.64, z] });
  }
  kit.cone(0.16, 0.11, C.tomato, { at: [0, 0.78, 0], rot: [0, Math.PI / 4, 0] }, 4);
  kit.ball(0.022, C.yellow, { at: [0, 0.85, 0] }, 0);
  const glass = new Kit().rbox(0.14, 0.16, 0.14, 0.02, C.yellowTint, { at: [0, 0.64, 0] });
  return { body: kit.build(), glow: glass.build(false), height: 0.9 };
}

function turbine(): PropModel {
  const kit = new Kit().patch(0.2);
  kit.cyl(0.13, 0.15, 0.06, C.steel, { at: [0, 0.03, 0] });
  kit.cyl(0.036, 0.075, 2, C.white, { at: [0, 1.04, 0] }, 9);
  kit.rbox(0.13, 0.12, 0.3, 0.04, C.white, { at: [0, 2.06, 0.02] });
  kit.rbox(0.135, 0.03, 0.2, 0.012, C.yellow, { at: [0, 2.06, -0.02] });

  const rotor = new Kit();
  rotor.ball(0.07, C.yellow, { scale: [1, 1, 0.8] });
  rotor.cone(0.05, 0.08, C.yellow, { at: [0, 0, 0.07], rot: [HALF, 0, 0] });
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2;
    rotor.rbox(0.11, 0.78, 0.022, 0.01, C.white, {
      at: [-Math.sin(angle) * 0.43, Math.cos(angle) * 0.43, 0],
      rot: [0, 0.16, angle],
      scale: [1, 1, 1],
    });
  }
  return {
    body: kit.build(),
    moving: { geometry: rotor.build(false), pivot: [0, 2.06, 0.2], motion: 'spin' },
    height: 2.5,
  };
}

function solar(): PropModel {
  const kit = new Kit().patch(0.3);
  kit.cyl(0.035, 0.045, 0.34, C.bark, { at: [0, 0.17, -0.04] }, 6);
  kit.box(0.4, 0.03, 0.04, C.barkDeep, { at: [0, 0.3, -0.04] });
  // The panel leans towards the viewer and the midday sun; parts stack along its normal.
  const tilt = 0.74;
  const up = Math.cos(tilt);
  const out = Math.sin(tilt);
  const layer = (lift: number, w: number, h: number, d: number, tone: string, r = 0) => {
    const at = [0, 0.42 + up * lift, out * lift] as const;
    if (r > 0) kit.rbox(w, h, d, r, tone, { at, rot: [tilt, 0, 0] });
    else kit.box(w, h, d, tone, { at, rot: [tilt, 0, 0] });
  };
  layer(0, 0.68, 0.035, 0.48, C.white, 0.015);
  layer(0.012, 0.62, 0.03, 0.42, C.blueDeep, 0.01);
  // The grid: two uprights and one rail, proud of the glass.
  for (const x of [-0.105, 0.105]) {
    kit.box(0.014, 0.012, 0.42, C.white, {
      at: [x, 0.42 + up * 0.026, out * 0.026],
      rot: [tilt, 0, 0],
    });
  }
  layer(0.026, 0.62, 0.012, 0.014, C.white);
  return { body: kit.build(), height: 0.8 };
}

function compost(): PropModel {
  const kit = new Kit().patch(0.3);
  const half = 0.22;
  for (const [x, z] of [
    [-half, -half],
    [half, -half],
    [-half, half],
    [half, half],
  ] as const) {
    kit.box(0.05, 0.4, 0.05, C.barkDeep, { at: [x, 0.2, z] });
  }
  for (const y of [0.08, 0.2, 0.32]) {
    kit.rbox(0.46, 0.085, 0.03, 0.012, C.kraft, { at: [0, y, half] });
    kit.rbox(0.46, 0.085, 0.03, 0.012, C.kraftDeep, { at: [0, y, -half] });
    kit.rbox(0.03, 0.085, 0.46, 0.012, C.kraftDeep, { at: [half, y, 0] });
    kit.rbox(0.03, 0.085, 0.46, 0.012, C.kraft, { at: [-half, y, 0] });
  }
  kit.box(0.4, 0.3, 0.4, C.soil, { at: [0, 0.18, 0] });
  // What is cooking: peel, a leaf, an apple core.
  kit.ball(0.05, C.tomato, { at: [0.07, 0.35, 0.05], scale: [1, 0.7, 1] }, 0);
  kit.ball(0.06, C.lime, { at: [-0.08, 0.345, -0.03], scale: [1.2, 0.4, 0.8] }, 0);
  kit.ball(0.045, C.orange, { at: [-0.02, 0.35, 0.11], scale: [1, 0.5, 1.3] }, 0);
  // The lid stands open at the back.
  kit.rbox(0.52, 0.035, 0.5, 0.015, C.moss, { at: [0, 0.57, -0.3], rot: [-1.25, 0, 0] });
  kit.ball(0.03, C.ink, { at: [0, 0.6, -0.28] }, 0);
  return { body: kit.build(), height: 0.85 };
}

function veggiePatch(): PropModel {
  const kit = new Kit().patch(0.5);
  const w = 0.86;
  const d = 0.56;
  kit.rbox(w, 0.11, 0.05, 0.015, C.kraftDark, { at: [0, 0.055, d / 2] });
  kit.rbox(w, 0.11, 0.05, 0.015, C.kraftDark, { at: [0, 0.055, -d / 2] });
  kit.rbox(0.05, 0.11, d, 0.015, C.bark, { at: [w / 2, 0.055, 0] });
  kit.rbox(0.05, 0.11, d, 0.015, C.bark, { at: [-w / 2, 0.055, 0] });
  kit.box(w - 0.04, 0.09, d - 0.04, C.soil, { at: [0, 0.05, 0] });
  for (let i = 0; i < 3; i += 1) {
    const x = (i - 1) * 0.27;
    // Front row: carrots, shoulders out of the soil, feathery tops.
    kit.cone(0.042, 0.1, C.orange, { at: [x, 0.105, 0.13], rot: [Math.PI, 0, 0] }, 6);
    for (let leaf = 0; leaf < 3; leaf += 1) {
      const lean = (leaf - 1) * 0.5;
      kit.cone(
        0.022,
        0.17,
        leaf === 1 ? C.green : C.leaf,
        {
          at: [x + lean * 0.05, 0.22, 0.13],
          rot: [0, 0, -lean],
          sway: [0.12, 0.32],
        },
        4,
      );
    }
    // Back row: cabbages.
    kit.ball(0.085, C.green, { at: [x, 0.14, -0.13], scale: [1, 0.8, 1] });
    kit.ball(0.06, C.lime, { at: [x, 0.17, -0.13], scale: [1, 0.8, 1] }, 0);
  }
  // A little marker with a seed packet on it.
  kit.box(0.02, 0.2, 0.02, C.barkDeep, { at: [w / 2 - 0.08, 0.15, d / 2 - 0.08] });
  kit.rbox(0.1, 0.08, 0.015, 0.006, C.paper, { at: [w / 2 - 0.08, 0.26, d / 2 - 0.07] });
  return { body: kit.build(), height: 0.42 };
}

function beehive(): PropModel {
  const kit = new Kit().patch(0.2);
  for (const [x, z] of [
    [-0.11, -0.09],
    [0.11, -0.09],
    [-0.11, 0.09],
    [0.11, 0.09],
  ] as const) {
    kit.box(0.035, 0.18, 0.035, C.barkDeep, { at: [x, 0.09, z] });
  }
  kit.rbox(0.34, 0.04, 0.28, 0.015, C.bark, { at: [0, 0.19, 0] });
  const tiers = [
    [0.17, 0.27],
    [0.15, 0.4],
    [0.115, 0.52],
  ] as const;
  for (const [radius, y] of tiers) {
    kit.ball(radius, C.yellow, { at: [0, y, 0], scale: [1, 0.52, 1] });
  }
  kit.dome(0.08, C.kraftDark, { at: [0, 0.57, 0], scale: [1, 0.8, 1] });
  kit.cyl(0.04, 0.04, 0.02, C.ink, { at: [0, 0.27, 0.16], rot: [HALF, 0, 0] });
  kit.rbox(0.14, 0.02, 0.07, 0.008, C.bark, { at: [0, 0.225, 0.17] });
  return { body: kit.build(), height: 0.7 };
}

function birdhouse(): PropModel {
  const kit = new Kit().patch(0.14);
  kit.cyl(0.028, 0.038, 0.72, C.bark, { at: [0, 0.36, 0] }, 6);
  kit.rbox(0.2, 0.03, 0.2, 0.01, C.barkDeep, { at: [0, 0.725, 0] });
  kit.rbox(0.24, 0.24, 0.22, 0.03, C.pink, { at: [0, 0.855, 0] });
  // A pitched roof: two boards meeting at the ridge.
  for (const side of [-1, 1]) {
    kit.rbox(0.2, 0.03, 0.3, 0.012, C.yellow, {
      at: [side * 0.075, 1.03, 0],
      rot: [0, 0, -side * 0.72],
    });
  }
  kit.box(0.2, 0.1, 0.2, C.pink, { at: [0, 0.98, 0], scale: [0.72, 1, 1] });
  kit.cyl(0.045, 0.045, 0.02, C.ink, { at: [0, 0.875, 0.112], rot: [HALF, 0, 0] }, 9);
  kit.cyl(0.012, 0.012, 0.09, C.barkDeep, { at: [0, 0.79, 0.14], rot: [HALF, 0, 0] }, 5);
  return { body: kit.build(), height: 1.15 };
}

function swing(): PropModel {
  const kit = new Kit().patch(0.3);
  const top = 0.98;
  for (const x of [-0.32, 0.32]) {
    for (const lean of [-1, 1]) {
      kit.cyl(
        0.024,
        0.03,
        1.04,
        C.bark,
        {
          at: [x, top / 2, lean * 0.16],
          rot: [lean * 0.32, 0, 0],
        },
        6,
      );
    }
  }
  kit.cyl(0.028, 0.028, 0.76, C.barkDeep, { at: [0, top, 0], rot: [0, 0, HALF] }, 6);
  const seat = new Kit();
  for (const x of [-0.16, 0.16]) {
    seat.cyl(0.008, 0.008, 0.62, C.paper, { at: [x, -0.31, 0] }, 4);
  }
  seat.rbox(0.4, 0.035, 0.14, 0.012, C.tomato, { at: [0, -0.63, 0] });
  return {
    body: kit.build(),
    moving: { geometry: seat.build(false), pivot: [0, top, 0], motion: 'swing' },
    height: 1.1,
  };
}

function signpost(): PropModel {
  const kit = new Kit().patch(0.14);
  kit.cyl(0.028, 0.04, 0.7, C.bark, { at: [0, 0.35, 0] }, 6);
  kit.ball(0.04, C.barkDeep, { at: [0, 0.71, 0] }, 0);
  const board = (y: number, side: number, tone: string, turn: number) => {
    kit.rbox(0.3, 0.1, 0.03, 0.012, tone, { at: [side * 0.07, y, 0.03], rot: [0, turn, 0] });
    kit.cyl(
      0.075,
      0.075,
      0.03,
      tone,
      {
        at: [side * 0.24, y, 0.03 - side * turn * 0.17],
        rot: [HALF, side * HALF * 0.33 + (side < 0 ? Math.PI : 0), 0],
      },
      3,
    );
  };
  board(0.58, 1, C.yellow, 0.14);
  board(0.44, -1, C.pink, -0.1);
  return { body: kit.build(), height: 0.85 };
}

// --- Landmarks -----------------------------------------------------------------------------

function wateringCan(): PropModel {
  const kit = new Kit().patch(0.18);
  kit.cyl(0.115, 0.125, 0.22, C.blue, { at: [0, 0.12, 0] }, 10);
  kit.cyl(0.125, 0.125, 0.025, C.blueDeep, { at: [0, 0.235, 0] }, 10);
  kit.cyl(0.1, 0.1, 0.01, C.ink, { at: [0, 0.245, 0] }, 10);
  // Spout to the right, rose on its end.
  kit.cyl(0.022, 0.032, 0.26, C.blue, { at: [0.19, 0.2, 0], rot: [0, 0, -0.95] }, 6);
  kit.cone(0.05, 0.06, C.blueDeep, { at: [0.31, 0.29, 0], rot: [0, 0, 2.2] }, 7);
  // Handle at the back.
  kit.ring(0.085, 0.017, C.blueDeep, { at: [-0.13, 0.15, 0], rot: [0, 0, HALF] }, Math.PI);
  return { body: kit.build(), height: 0.42 };
}

function noticeBoard(): PropModel {
  const kit = new Kit().patch(0.32);
  for (const x of [-0.27, 0.27]) {
    kit.cyl(0.028, 0.036, 0.72, C.bark, { at: [x, 0.36, 0] }, 6);
  }
  kit.rbox(0.66, 0.44, 0.045, 0.02, C.kraft, { at: [0, 0.48, 0] });
  kit.rbox(0.74, 0.05, 0.12, 0.018, C.barkDeep, { at: [0, 0.73, 0] });
  const ticket = (x: number, y: number, tone: string, turn: number, pin: string) => {
    kit.rbox(0.15, 0.2, 0.012, 0.005, tone, { at: [x, y, 0.03], rot: [0, 0, turn] });
    kit.ball(0.016, pin, { at: [x, y + 0.07, 0.042] }, 0);
  };
  ticket(-0.19, 0.5, C.yellow, 0.1, C.tomato);
  ticket(0, 0.46, C.pink, -0.07, C.blueDeep);
  ticket(0.19, 0.51, C.white, 0.05, C.moss);
  return { body: kit.build(), height: 0.85 };
}

function books(): PropModel {
  const kit = new Kit().patch(0.22);
  const book = (y: number, tone: string, turn: number, w: number) => {
    kit.rbox(w, 0.07, 0.25, 0.014, tone, { at: [0, y, 0], rot: [0, turn, 0] });
    kit.box(w - 0.03, 0.045, 0.255, C.paper, { at: [0.012, y, 0], rot: [0, turn, 0] });
  };
  book(0.04, C.blue, 0.12, 0.34);
  book(0.115, C.pink, -0.2, 0.31);
  // The top book lies open: two blocks of pages and a ribbon.
  kit.rbox(0.36, 0.02, 0.26, 0.008, C.yellow, { at: [0, 0.16, 0], rot: [0, 0.08, 0] });
  for (const side of [-1, 1]) {
    kit.rbox(0.165, 0.03, 0.235, 0.012, C.white, {
      at: [side * 0.085, 0.188, 0],
      rot: [0, 0.08, -side * 0.14],
    });
  }
  kit.box(0.02, 0.008, 0.3, C.tomato, { at: [0, 0.196, 0.03], rot: [0, 0.08, 0] });
  return { body: kit.build(), height: 0.32 };
}

/** A slice of trunk whose growth rings are counted: one per milestone of days shown up. */
function medallion(rings: number): PropModel {
  const kit = new Kit().patch(0.24);
  kit.cyl(0.2, 0.22, 0.13, C.barkDeep, { at: [0, 0.065, 0] }, 12);
  const bands = Math.max(1, Math.min(5, rings));
  kit.cyl(0.18, 0.18, 0.012, C.kraft, { at: [0, 0.134, 0] }, 12);
  for (let i = 0; i < bands; i += 1) {
    const share = 1 - (i + 0.5) / (bands + 0.5);
    const outer = 0.165 * share + 0.012;
    kit.cyl(
      outer,
      outer,
      0.006,
      i % 2 ? C.kraft : C.kraftDark,
      {
        at: [0, 0.142 + i * 0.004, 0],
      },
      12,
    );
  }
  kit.ball(0.014, C.barkDeep, { at: [0, 0.148 + bands * 0.004, 0], scale: [1, 0.5, 1] }, 0);
  // A sprig growing from its side: it is still alive.
  kit.cone(0.03, 0.1, C.lime, { at: [0.2, 0.14, 0.05], rot: [0, 0, -0.7], sway: [0.1, 0.2] }, 4);
  return { body: kit.build(), height: 0.26 };
}

function mailbox(): PropModel {
  const kit = new Kit().patch(0.17);
  kit.cyl(0.028, 0.036, 0.5, C.bark, { at: [0, 0.25, 0] }, 6);
  kit.rbox(0.22, 0.14, 0.34, 0.03, C.pink, { at: [0, 0.57, 0] });
  kit.cyl(0.11, 0.11, 0.34, C.pink, { at: [0, 0.64, 0], rot: [HALF, 0, 0] }, 10);
  kit.cyl(0.095, 0.095, 0.012, C.pinkTint, { at: [0, 0.64, 0.172], rot: [HALF, 0, 0] }, 10);
  kit.box(0.19, 0.13, 0.012, C.pinkTint, { at: [0, 0.57, 0.172] });
  kit.box(0.1, 0.014, 0.014, C.ink, { at: [0, 0.6, 0.18] });
  // The flag is up: there is post.
  kit.box(0.014, 0.2, 0.02, C.barkDeep, { at: [0.118, 0.66, -0.03] });
  kit.rbox(0.014, 0.08, 0.12, 0.005, C.yellow, { at: [0.12, 0.73, 0.02] });
  // A letter peeking out.
  kit.rbox(0.13, 0.012, 0.1, 0.004, C.paper, { at: [0, 0.6, 0.2], rot: [0.3, 0, 0.06] });
  return { body: kit.build(), height: 0.85 };
}

/** Moss, the coach: a moss ball with two dot eyes and one sprout. */
function moss(): PropModel {
  const kit = new Kit().patch(0.26);
  kit.ball(0.27, C.moss, { at: [0, 0.25, 0], scale: [1, 0.92, 1] }, 2);
  // Tufts, so the ball is fuzzy and not a marble.
  const tufts = [
    [0.2, 0.36, -0.1],
    [-0.21, 0.3, -0.08],
    [0.12, 0.47, -0.09],
    [-0.1, 0.46, 0.08],
    [0.02, 0.2, -0.24],
    [-0.2, 0.16, 0.12],
    [0.22, 0.17, 0.1],
  ] as const;
  tufts.forEach(([x, y, z], index) =>
    kit.ball(0.085, index % 2 ? C.mossDeep : C.green, { at: [x, y, z] }, 0),
  );
  for (const x of [-0.09, 0.09]) {
    kit.ball(0.062, C.white, { at: [x, 0.3, 0.215], scale: [1, 1.08, 0.6] });
    kit.ball(0.03, C.ink, { at: [x * 0.94, 0.295, 0.25], scale: [1, 1.1, 0.5] }, 0);
    kit.ball(0.01, C.white, { at: [x * 0.94 + 0.012, 0.308, 0.264] }, 0);
  }
  // A small smile.
  kit.ring(
    0.045,
    0.009,
    C.ink,
    { at: [0, 0.215, 0.256], rot: [0.25, 0, Math.PI * 1.15] },
    Math.PI * 0.7,
  );
  // The sprout.
  kit.cyl(0.012, 0.016, 0.14, C.lime, { at: [0, 0.56, 0], sway: [0.5, 0.66] }, 5);
  for (const side of [-1, 1]) {
    kit.ball(
      0.06,
      C.lime,
      {
        at: [side * 0.055, 0.645, 0],
        scale: [1, 0.3, 0.6],
        rot: [0, 0, side * 0.5],
        sway: [0.5, 0.66],
      },
      0,
    );
  }
  return { body: kit.build(), height: 0.72 };
}

/** The passport: a paper tag on a string. Hangs from the origin. */
function tag(): PropModel {
  const kit = new Kit();
  kit.cyl(0.006, 0.006, 0.09, C.barkDeep, { at: [0, -0.045, 0] }, 4);
  kit.rbox(0.17, 0.23, 0.022, 0.01, C.paper, { at: [0, -0.2, 0], rot: [0, 0, 0.06] });
  kit.rbox(0.11, 0.03, 0.006, 0.002, C.moss, { at: [0.004, -0.15, 0.013], rot: [0, 0, 0.06] });
  kit.rbox(0.11, 0.014, 0.006, 0.002, C.kraftDark, {
    at: [0.008, -0.205, 0.013],
    rot: [0, 0, 0.06],
  });
  kit.rbox(0.07, 0.014, 0.006, 0.002, C.kraftDark, {
    at: [-0.01, -0.235, 0.013],
    rot: [0, 0, 0.06],
  });
  kit.ring(0.014, 0.005, C.kraftDark, { at: [0.004, -0.105, 0.012] });
  return { body: kit.build(false), height: 0.1 };
}

/** The earned flowers: tall blooms at the nine places the layout keeps for them. */
export function flowerBed(spots: readonly Spot[]): THREE.BufferGeometry {
  const kit = new Kit();
  const tones = [C.pink, C.yellow, C.violet, C.tomato, C.white] as const;
  spots.forEach((spot, index) => {
    const height = 0.3 + ((index * 37) % 10) * 0.012;
    const tone = tones[index % tones.length] as string;
    const top = spot.y + height;
    const sway = [spot.y, top] as const;
    kit.cyl(0.011, 0.015, height, C.leaf, { at: [spot.x, spot.y + height / 2, spot.z], sway }, 5);
    kit.ball(
      0.05,
      C.green,
      {
        at: [spot.x + 0.04, spot.y + height * 0.4, spot.z],
        scale: [1, 0.25, 0.5],
        rot: [0, spot.yaw, 0.6],
        sway,
      },
      0,
    );
    if (index % 3 === 1) {
      // A tulip: a cup of three petals.
      kit.ball(0.05, tone, { at: [spot.x, top, spot.z], scale: [1, 1.25, 1], sway }, 0);
      for (let i = 0; i < 3; i += 1) {
        const angle = (i / 3) * Math.PI * 2 + spot.yaw;
        kit.cone(
          0.03,
          0.08,
          tone,
          {
            at: [spot.x + Math.cos(angle) * 0.03, top + 0.045, spot.z + Math.sin(angle) * 0.03],
            sway,
          },
          4,
        );
      }
    } else {
      // A daisy turned to the viewer: five petals round a yellow heart.
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 + index;
        kit.ball(
          0.04,
          tone,
          {
            at: [spot.x + Math.cos(angle) * 0.052, top + Math.sin(angle) * 0.052, spot.z],
            scale: [1, 1, 0.35],
            sway,
          },
          0,
        );
      }
      kit.ball(
        0.03,
        tone === C.yellow ? C.orange : C.yellow,
        {
          at: [spot.x, top, spot.z + 0.012],
          scale: [1, 1, 0.6],
          sway,
        },
        0,
      );
    }
  });
  return kit.build(false);
}

export type GroundModelId = Exclude<
  IslandPropId,
  'flowers' | 'birds' | 'butterflies' | 'fireflies'
>;

const PROPS: Record<GroundModelId, () => PropModel> = {
  mushrooms,
  pond,
  bench,
  lantern,
  turbine,
  solar,
  compost,
  'veggie-patch': veggiePatch,
  beehive,
  birdhouse,
  swing,
  signpost,
};

export function propModel(id: GroundModelId): PropModel {
  return PROPS[id]();
}

export function landmarkModel(id: LandmarkId, rings: number): PropModel {
  switch (id) {
    case 'log':
      return wateringCan();
    case 'quests':
      return noticeBoard();
    case 'learn':
      return books();
    case 'impact':
      return medallion(rings);
    case 'community':
      return mailbox();
    case 'coach':
      return moss();
    case 'me':
      return tag();
  }
}

export function disposeModel(model: PropModel): void {
  model.body.dispose();
  model.moving?.geometry.dispose();
  model.glow?.dispose();
}
