import { createRng, type Rng } from '@/lib/rng';
import { ISLAND, SUNDIAL, TONE } from '../config';
import type { SubjectFrame } from '../framing';
import type { Quat, Vec3 } from './types';
import { quatFromAxisAngle, quatMultiply } from './vec';

/**
 * The floating island as plain data: a triangle soup with a tone and a shading normal
 * per vertex, plus where the pebbles, tufts, seed, hour ticks and ring medallion sit.
 * Deterministic from the seed.
 *
 * Every layer (grass lid, grass slab, each cardboard terrace, the soil patch) is its
 * own closed solid. That is deliberate: an inverted-hull outline only draws around
 * closed shapes, so stacking solids is what puts an ink line between the layers.
 */

export interface ScatterItem {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  tone: number;
}

export interface IslandModel {
  positions: Float32Array;
  normals: Float32Array;
  tones: Float32Array;
  triangles: number;
  /** Flat ink dashes on the lawn: the hour ticks of the sundial. */
  ticks: Float32Array;
  rocks: ScatterItem[];
  tufts: ScatterItem[];
  seed: ScatterItem;
  emblem: { position: Vec3; width: number; height: number; depth: number };
  /** Where the trunk meets the ground. */
  treeOrigin: Vec3;
  /** Rim of the lawn: radius(angle) = radius * (1 + a1 sin(2 angle + p1) + a2 sin(3 angle + p2)). */
  coast: { a1: number; p1: number; a2: number; p2: number };
}

const TAU = Math.PI * 2;

/** Ground height of the lawn at `rho` (0 centre .. 1 rim). */
export function groundHeight(rho: number): number {
  return ISLAND.dome * (1 - Math.min(1, rho) ** 2);
}

/** The tree stands on the soil patch, a little behind the centre of the lawn. */
export const TREE_ORIGIN: Vec3 = [
  0,
  groundHeight(ISLAND.treeBack / ISLAND.radius) + ISLAND.mound.height - 0.03,
  -ISLAND.treeBack,
];
export const TREE_BASE = TREE_ORIGIN[1];

class Soup {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly tones: number[] = [];

  triangle(a: Vec3, b: Vec3, c: Vec3, tone: number, na: Vec3, nb: Vec3, nc: Vec3): void {
    this.positions.push(...a, ...b, ...c);
    this.normals.push(...na, ...nb, ...nc);
    this.tones.push(tone, tone, tone);
  }

  /** Wall between two rings wound counter-clockwise seen from above, facing outwards. */
  wall(upper: Vec3[], lower: Vec3[], tone: number, centre: readonly [number, number]): void {
    const count = upper.length;
    const out = (p: Vec3): Vec3 => {
      const x = p[0] - centre[0];
      const z = p[2] - centre[1];
      const l = Math.hypot(x, z) || 1;
      return [x / l, 0, z / l];
    };
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      const [ui, uj, li, lj] = [upper[i], upper[j], lower[i], lower[j]] as [Vec3, Vec3, Vec3, Vec3];
      this.triangle(ui, lj, li, tone, out(ui), out(lj), out(li));
      this.triangle(ui, uj, lj, tone, out(ui), out(uj), out(lj));
    }
  }

  /** Fan closing a ring: facing up, or down when `flip` is set. */
  cap(ring: Vec3[], centre: Vec3, tone: number, flip = false): void {
    const count = ring.length;
    const n: Vec3 = [0, flip ? -1 : 1, 0];
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      if (flip) this.triangle(centre, ring[i] as Vec3, ring[j] as Vec3, tone, n, n, n);
      else this.triangle(centre, ring[j] as Vec3, ring[i] as Vec3, tone, n, n, n);
    }
  }

  /** Band between an inner and an outer ring on an upward-facing surface. */
  band(inner: Vec3[], outer: Vec3[], tone: number): void {
    const count = inner.length;
    const n: Vec3 = [0, 1, 0];
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      this.triangle(inner[i] as Vec3, outer[j] as Vec3, outer[i] as Vec3, tone, n, n, n);
      this.triangle(inner[i] as Vec3, inner[j] as Vec3, outer[j] as Vec3, tone, n, n, n);
    }
  }
}

function wobble(rng: Rng, first: number, second: number) {
  const p1 = rng() * TAU;
  const p2 = rng() * TAU;
  const at = (angle: number) =>
    1 + first * Math.sin(2 * angle + p1) + second * Math.sin(3 * angle + p2);
  return { at, a1: first, p1, a2: second, p2 };
}

function ringAt(
  segments: number,
  radius: (angle: number) => number,
  y: number | ((rho: number) => number),
  centre: readonly [number, number] = [0, 0],
): Vec3[] {
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * TAU;
    const r = radius(angle);
    const x = centre[0] + Math.cos(angle) * r;
    const z = centre[1] + Math.sin(angle) * r;
    const height = typeof y === 'number' ? y : y(Math.hypot(x, z) / ISLAND.radius);
    return [x, height, z];
  });
}

function scatter(
  rng: Rng,
  count: number,
  ring: readonly [number, number],
  spacing: number,
  taken: Vec3[],
): Vec3[] {
  const placed: Vec3[] = [];
  for (let attempt = 0; attempt < count * 14 && placed.length < count; attempt += 1) {
    const rho = Math.sqrt(ring[0] ** 2 + (ring[1] ** 2 - ring[0] ** 2) * rng());
    const angle = rng() * TAU;
    const point: Vec3 = [
      Math.cos(angle) * rho * ISLAND.radius,
      groundHeight(rho),
      Math.sin(angle) * rho * ISLAND.radius,
    ];
    const clear = [...taken, ...placed].every(
      (other) => Math.hypot(other[0] - point[0], other[2] - point[2]) > spacing,
    );
    if (clear) placed.push(point);
  }
  return placed;
}

export function buildIsland(seed: number, segments: number, scatterShare = 1): IslandModel {
  const rng = createRng(seed, 'island', 2);
  const soup = new Soup();
  const R = ISLAND.radius;
  const coast = wobble(rng, ISLAND.coastWobble[0], ISLAND.coastWobble[1]);
  const patchEdge = wobble(rng, 0.1, 0.07);
  const origin: readonly [number, number] = [0, 0];

  // Grass lid: a domed top with a lighter patch, and a thin edge that carries the rim line.
  const rim = ringAt(segments, (a) => R * coast.at(a), 0);
  const patch = ringAt(segments, (a) => R * ISLAND.patch * patchEdge.at(a), groundHeight);
  const inner = ringAt(segments, () => R * ISLAND.patch * 0.5, groundHeight);
  soup.cap(inner, [0, groundHeight(0), 0], TONE.grassPatch);
  soup.band(inner, patch, TONE.grassPatch);
  soup.band(patch, rim, TONE.grassTop);
  const lidBottom = ringAt(segments, (a) => R * coast.at(a), -ISLAND.lidThickness);
  soup.wall(rim, lidBottom, TONE.grassTop, origin);
  soup.cap(lidBottom, [0, -ISLAND.lidThickness, 0], TONE.grassSide, true);

  // Grass slab under the lid.
  let y = -ISLAND.lidThickness;
  const slabRadius = (a: number) => R * coast.at(a) - ISLAND.lidOverhang;
  const slabTop = ringAt(segments, slabRadius, y);
  const slabBottom = ringAt(segments, slabRadius, y - ISLAND.slabThickness);
  soup.cap(slabTop, [0, y, 0], TONE.grassSide);
  soup.wall(slabTop, slabBottom, TONE.grassSide, origin);
  soup.cap(slabBottom, [0, y - ISLAND.slabThickness, 0], TONE.grassSide, true);
  y -= ISLAND.slabThickness;

  // Cardboard terraces: stacked discs, each cut a little off-centre.
  let emblemY = y;
  let emblemRadius = R;
  ISLAND.strata.forEach(([share, thickness], index) => {
    const edge = wobble(rng, ISLAND.strataWobble, ISLAND.strataWobble * 0.6);
    const drift = index === 0 ? 0.3 : 1;
    const centre: [number, number] = [
      (rng() - 0.5) * 2 * ISLAND.strataOffset * R * drift,
      (rng() - 0.5) * 2 * ISLAND.strataOffset * R * drift,
    ];
    const count = Math.max(8, Math.round(segments * Math.sqrt(share)));
    const radius = (a: number) => R * share * edge.at(a);
    const upper = ringAt(count, radius, y, centre);
    const lower = ringAt(count, radius, y - thickness, centre);
    const tone = index % 2 === 0 ? TONE.kraftA : TONE.kraftB;
    soup.cap(upper, [centre[0], y, centre[1]], tone);
    soup.wall(upper, lower, tone, centre);
    soup.cap(lower, [centre[0], y - thickness, centre[1]], tone, true);
    if (index === 0) {
      emblemY = y - thickness / 2;
      emblemRadius = radius(Math.PI / 2) + centre[1];
    }
    y -= thickness;
  });

  // Soil patch the seed sits in, under the tree.
  const foot: readonly [number, number] = [TREE_ORIGIN[0], TREE_ORIGIN[2]];
  const footGround = groundHeight(ISLAND.treeBack / R);
  const moundRing = ringAt(
    12,
    () => ISLAND.mound.radius,
    (rho) => groundHeight(rho) - 0.02,
    foot,
  );
  const moundTop = ringAt(
    12,
    () => ISLAND.mound.radius * 0.5,
    () => footGround + ISLAND.mound.height * 0.82,
    foot,
  );
  soup.cap(moundTop, [foot[0], footGround + ISLAND.mound.height, foot[1]], TONE.soil);
  soup.band(moundTop, moundRing, TONE.soil);
  soup.cap(moundRing, [foot[0], footGround - 0.04, foot[1]], TONE.soil, true);

  // Hour ticks: thirteen dashes just inside the front rim, 06:00 on the viewer's right
  // through noon straight ahead to 18:00 on the left. Noon is double length.
  const ticks: number[] = [];
  const last = SUNDIAL.ticks - 1;
  for (let k = 0; k <= last; k += 1) {
    const angle = (k / last) * Math.PI;
    const outer = R * coast.at(angle) * (1 - ISLAND.ticks.inset);
    const length = ISLAND.ticks.length * (k * 2 === last ? 2 : 1);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const half = ISLAND.ticks.width / 2;
    const corner = (radius: number, side: number): Vec3 => {
      const x = cos * radius - sin * side;
      const z = sin * radius + cos * side;
      return [x, groundHeight(Math.hypot(x, z) / R) + 0.008, z];
    };
    const a = corner(outer - length, -half);
    const b = corner(outer - length, half);
    const c = corner(outer, half);
    const d = corner(outer, -half);
    ticks.push(...a, ...c, ...d, ...a, ...b, ...c);
  }

  const taken: Vec3[] = [[foot[0], 0, foot[1]]];
  const rockSpots = scatter(rng, Math.round(ISLAND.rocks * scatterShare), [0.45, 0.8], 0.8, taken);
  const rocks = rockSpots.map((position): ScatterItem => {
    const size = 0.1 + rng() * 0.07;
    return {
      position: [position[0], position[1] + size * 0.3, position[2]],
      rotation: quatMultiply(
        quatFromAxisAngle([0, 1, 0], rng() * TAU),
        quatFromAxisAngle([1, 0, 0], (rng() - 0.5) * 0.5),
      ),
      scale: [size * (1 + rng() * 0.5), size * (0.65 + rng() * 0.3), size],
      tone: TONE.rock,
    };
  });
  const tuftSpots = scatter(
    rng,
    Math.max(3, Math.round(ISLAND.tufts * scatterShare)),
    [0.3, 0.88],
    0.5,
    [...taken, ...rockSpots],
  );
  const tufts = tuftSpots.map((position): ScatterItem => {
    const size = 0.15 + rng() * 0.09;
    return {
      position,
      rotation: quatFromAxisAngle([0, 1, 0], rng() * TAU),
      scale: [size, size * (0.9 + rng() * 0.5), size],
      tone: TONE.grassSide,
    };
  });

  return {
    positions: new Float32Array(soup.positions),
    normals: new Float32Array(soup.normals),
    tones: new Float32Array(soup.tones),
    triangles: soup.tones.length / 3,
    ticks: new Float32Array(ticks),
    rocks,
    tufts,
    seed: {
      position: [TREE_ORIGIN[0] + 0.02, TREE_ORIGIN[1] + 0.05, TREE_ORIGIN[2] + 0.06],
      rotation: quatFromAxisAngle([0, 0, 1], 0.32),
      scale: [0.1, 0.13, 0.1],
      tone: TONE.seed,
    },
    emblem: {
      position: [0, emblemY, emblemRadius - ISLAND.emblem.depth * 0.35],
      width: ISLAND.emblem.width,
      height: ISLAND.emblem.height,
      depth: ISLAND.emblem.depth,
    },
    treeOrigin: TREE_ORIGIN,
    coast: { a1: coast.a1, p1: coast.p1, a2: coast.a2, p2: coast.p2 },
  };
}

/**
 * Screen-space extents of the island alone for a camera pitched down by `pitch`:
 * the widest rim, the far rim above the origin and the lowest terrace below it.
 */
export function islandFrame(pitch: number): SubjectFrame {
  const sin = Math.sin(pitch);
  const cos = Math.cos(pitch);
  const R = ISLAND.radius * (1 + ISLAND.coastWobble[0] + ISLAND.coastWobble[1]);
  let depth = ISLAND.lidThickness + ISLAND.slabThickness;
  let bottom = depth * cos + R * sin;
  for (const [share, thickness] of ISLAND.strata) {
    depth += thickness;
    bottom = Math.max(bottom, depth * cos + ISLAND.radius * share * 1.06 * sin);
  }
  return { halfWidth: R, lawn: R, top: R * sin + ISLAND.dome * cos, bottom };
}
