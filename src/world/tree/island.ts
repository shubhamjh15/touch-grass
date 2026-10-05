import { createRng, type Rng } from '@/lib/rng';
import { ISLAND, TONE } from '../config';
import type { SubjectFrame } from '../framing';
import type { Quat, Vec3 } from './types';
import { quatFromAxisAngle, quatMultiply } from './vec';

/**
 * The floating island as plain data: a triangle soup with one tone per vertex, plus
 * where the pebbles, tufts, seed and ring emblem sit. Deterministic from the seed.
 *
 * Every layer (grass lid, grass slab, each earth stratum, the soil mound) is its own
 * closed solid. That is deliberate: an inverted-hull outline only draws around closed
 * shapes, so stacking solids is what puts an ink line between the layers.
 */

export interface ScatterItem {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  tone: number;
}

export interface IslandModel {
  positions: Float32Array;
  tones: Float32Array;
  triangles: number;
  rocks: ScatterItem[];
  tufts: ScatterItem[];
  seed: ScatterItem;
  emblem: { position: Vec3; width: number; height: number; depth: number };
  /** Height of the ground where the tree stands (top of the soil mound, a little sunk). */
  treeBase: number;
}

const TAU = Math.PI * 2;

/** Ground height of the grass top at `rho` (0 centre .. 1 rim). */
export function groundHeight(rho: number): number {
  return ISLAND.dome * (1 - Math.min(1, rho) ** 2);
}

export const TREE_BASE = groundHeight(0) + ISLAND.mound.height - 0.03;

class Soup {
  readonly positions: number[] = [];
  readonly tones: number[] = [];

  triangle(a: Vec3, b: Vec3, c: Vec3, tone: number): void {
    this.positions.push(...a, ...b, ...c);
    this.tones.push(tone, tone, tone);
  }

  /** Wall between two rings wound counter-clockwise seen from above, facing outwards. */
  wall(upper: Vec3[], lower: Vec3[], tone: number): void {
    const count = upper.length;
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      this.triangle(upper[i] as Vec3, lower[j] as Vec3, lower[i] as Vec3, tone);
      this.triangle(upper[i] as Vec3, upper[j] as Vec3, lower[j] as Vec3, tone);
    }
  }

  /** Fan closing a ring: facing up, or down when `flip` is set. */
  cap(ring: Vec3[], centre: Vec3, tone: number, flip = false): void {
    const count = ring.length;
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      if (flip) this.triangle(centre, ring[i] as Vec3, ring[j] as Vec3, tone);
      else this.triangle(centre, ring[j] as Vec3, ring[i] as Vec3, tone);
    }
  }

  /** Band between an inner and an outer ring on an upward-facing surface. */
  band(inner: Vec3[], outer: Vec3[], tone: number): void {
    const count = inner.length;
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      this.triangle(inner[i] as Vec3, outer[j] as Vec3, outer[i] as Vec3, tone);
      this.triangle(inner[i] as Vec3, inner[j] as Vec3, outer[j] as Vec3, tone);
    }
  }
}

function wobble(rng: Rng, first: number, second: number): (angle: number) => number {
  const a = rng() * TAU;
  const b = rng() * TAU;
  return (angle) => 1 + first * Math.sin(2 * angle + a) + second * Math.sin(3 * angle + b);
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
    const height = typeof y === 'number' ? y : y(r / ISLAND.radius);
    return [centre[0] + Math.cos(angle) * r, height, centre[1] + Math.sin(angle) * r];
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
  for (let attempt = 0; attempt < count * 12 && placed.length < count; attempt += 1) {
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
  const rng = createRng(seed, 'island', 1);
  const soup = new Soup();
  const R = ISLAND.radius;
  const coast = wobble(rng, ISLAND.coastWobble[0], ISLAND.coastWobble[1]);
  const patchEdge = wobble(rng, 0.1, 0.07);

  // Grass lid: a domed top with a lighter patch, and a thin edge that carries the rim line.
  const rim = ringAt(segments, (a) => R * coast(a), 0);
  const patch = ringAt(segments, (a) => R * ISLAND.patch * patchEdge(a), groundHeight);
  const inner = ringAt(segments, () => R * ISLAND.patch * 0.5, groundHeight);
  soup.cap(inner, [0, groundHeight(0), 0], TONE.grassPatch);
  soup.band(inner, patch, TONE.grassPatch);
  soup.band(patch, rim, TONE.grassTop);
  const lidBottom = ringAt(segments, (a) => R * coast(a), -ISLAND.lidThickness);
  soup.wall(rim, lidBottom, TONE.grassTop);
  soup.cap(lidBottom, [0, -ISLAND.lidThickness, 0], TONE.grassSide, true);

  // Grass slab under the lid.
  let y = -ISLAND.lidThickness;
  const slabRadius = (a: number) => R * coast(a) - ISLAND.lidOverhang;
  const slabTop = ringAt(segments, slabRadius, y);
  const slabBottom = ringAt(segments, slabRadius, y - ISLAND.slabThickness);
  soup.cap(slabTop, [0, y, 0], TONE.grassSide);
  soup.wall(slabTop, slabBottom, TONE.grassSide);
  soup.cap(slabBottom, [0, y - ISLAND.slabThickness, 0], TONE.grassSide, true);
  y -= ISLAND.slabThickness;

  // Earth strata: stacked cardboard discs, each cut a little off-centre.
  let emblemY = y;
  let emblemRadius = R;
  ISLAND.strata.forEach(([share, thickness], index) => {
    const edge = wobble(rng, ISLAND.strataWobble, ISLAND.strataWobble * 0.6);
    const centre: [number, number] = [
      (rng() - 0.5) * 0.05 * R * (index === 0 ? 0.3 : 1),
      (rng() - 0.5) * 0.05 * R * (index === 0 ? 0.3 : 1),
    ];
    const count = Math.max(8, Math.round(segments * Math.sqrt(share)));
    const radius = (a: number) => R * share * edge(a);
    const upper = ringAt(count, radius, y, centre);
    const lower = ringAt(count, radius, y - thickness, centre);
    const tone = index % 2 === 0 ? TONE.kraftA : TONE.kraftB;
    soup.cap(upper, [centre[0], y, centre[1]], tone);
    soup.wall(upper, lower, tone);
    soup.cap(lower, [centre[0], y - thickness, centre[1]], tone, true);
    if (index === 0) {
      emblemY = y - thickness / 2;
      emblemRadius = radius(Math.PI / 2) + centre[1];
    }
    y -= thickness;
  });

  // Soil mound the seed sits in.
  const moundRing = ringAt(
    12,
    () => ISLAND.mound.radius,
    (rho) => groundHeight(rho) - 0.02,
  );
  const moundTop = ringAt(
    12,
    () => ISLAND.mound.radius * 0.5,
    groundHeight(0) + ISLAND.mound.height * 0.82,
  );
  soup.cap(moundTop, [0, groundHeight(0) + ISLAND.mound.height, 0], TONE.soil);
  soup.band(moundTop, moundRing, TONE.soil);
  soup.cap(moundRing, [0, groundHeight(0) - 0.04, 0], TONE.soil, true);

  const rockSpots = scatter(
    rng,
    Math.max(2, Math.round(ISLAND.rocks * scatterShare)),
    [0.5, 0.9],
    0.7,
    [],
  );
  const rocks = rockSpots.map((position): ScatterItem => {
    const size = 0.13 + rng() * 0.12;
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
    [0.28, 0.93],
    0.45,
    rockSpots,
  );
  const tufts = tuftSpots.map((position): ScatterItem => {
    const size = 0.15 + rng() * 0.1;
    return {
      position,
      rotation: quatFromAxisAngle([0, 1, 0], rng() * TAU),
      scale: [size, size * (0.9 + rng() * 0.5), size],
      tone: TONE.grassSide,
    };
  });

  return {
    positions: new Float32Array(soup.positions),
    tones: new Float32Array(soup.tones),
    triangles: soup.tones.length / 3,
    rocks,
    tufts,
    seed: {
      position: [0.02, TREE_BASE + 0.05, 0.06],
      rotation: quatFromAxisAngle([0, 0, 1], 0.32),
      scale: [0.1, 0.13, 0.1],
      tone: TONE.seed,
    },
    emblem: {
      position: [-0.05, emblemY, emblemRadius - ISLAND.emblem.depth * 0.35],
      width: ISLAND.emblem.width,
      height: ISLAND.emblem.height,
      depth: ISLAND.emblem.depth,
    },
    treeBase: TREE_BASE,
  };
}

/**
 * Screen-space extents of the island alone for a camera pitched down by `pitch`:
 * the widest coastline, the far rim above the origin and the lowest stratum below it.
 */
export function islandFrame(pitch: number): SubjectFrame {
  const sin = Math.sin(pitch);
  const cos = Math.cos(pitch);
  const R = ISLAND.radius * (1 + ISLAND.coastWobble[0] + ISLAND.coastWobble[1]);
  let depth = ISLAND.lidThickness + ISLAND.slabThickness;
  let bottom = depth * cos + R * sin;
  for (const [share, thickness] of ISLAND.strata) {
    depth += thickness;
    bottom = Math.max(bottom, depth * cos + ISLAND.radius * share * 1.08 * sin);
  }
  return { halfWidth: R, top: R * sin + ISLAND.dome * cos, bottom };
}
