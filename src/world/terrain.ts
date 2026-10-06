import { clamp01, smoothstep } from '@/lib/math';
import { createRng } from '@/lib/rng';
import { ISLAND } from './config';
import { clockToIsland, layoutIsland } from './props/layout';
import { TREE_ORIGIN } from './tree/island';

/**
 * The shape of the floating island as pure maths: where the coast runs, how high the
 * lawn is at any point, where the spring pond and its stream lie and where the stepping
 * stones lead. Deterministic from the user's seed and free of three.js, so the scene,
 * the scatter of grass and flowers, the prop layout and the tests all read one truth.
 *
 * Axes: x to the viewer's right, y up, z towards the viewer at the rest camera.
 */

export interface Stone {
  x: number;
  y: number;
  z: number;
  radius: number;
  yaw: number;
}

export interface Terrain {
  seed: number;
  /** Radius of the lawn's rim in the direction `angle = atan2(z, x)`. */
  coast: (angle: number) => number;
  /** Height of the ground at a point of the lawn. */
  height: (x: number, z: number) => number;
  /** Whether a point is on the lawn, at least `margin` world units inside the rim. */
  inside: (x: number, z: number, margin?: number) => boolean;
  /** Whether a point is dry land: on the lawn and not in the pond or the stream. */
  dry: (x: number, z: number, margin?: number) => boolean;
  /** The spring pond: centre, radius and the height of its water surface. */
  pond: { x: number; z: number; radius: number; level: number };
  /** Centre line of the stream from the pond's bank to the rim, and its half-width. */
  stream: { points: Array<[number, number]>; halfWidth: number };
  /** Where the stream leaves the island and falls. */
  outlet: { x: number; y: number; z: number; angle: number };
  /** Stepping stones from the front rim to the foot of the tree. */
  path: Stone[];
  /** Where the trunk meets the ground. */
  tree: [number, number, number];
  /** How far the rock underside hangs below the lawn. */
  depth: number;
}

const TAU = Math.PI * 2;
const R = ISLAND.radius;

/** How far the underside hangs below the lawn, in world units. */
export const ISLAND_DEPTH = 2.5;

const gauss = (dx: number, dz: number, sigma: number) =>
  Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));

/** Distance from a point to a polyline. */
function distanceToLine(x: number, z: number, points: Array<[number, number]>): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i] as [number, number];
    const [bx, bz] = points[i + 1] as [number, number];
    const dx = bx - ax;
    const dz = bz - az;
    const span = dx * dx + dz * dz;
    const t = span > 1e-9 ? clamp01(((x - ax) * dx + (z - az) * dz) / span) : 0;
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

const cache = new Map<number, Terrain>();

export function createTerrain(seed: number): Terrain {
  const cached = cache.get(seed);
  if (cached) return cached;
  const rng = createRng(seed, 'terrain', 1);
  const phase = [rng() * TAU, rng() * TAU, rng() * TAU, rng() * TAU, rng() * TAU];
  const layout = layoutIsland(seed);

  const coast = (angle: number) =>
    R *
    (1 +
      0.045 * Math.sin(2 * angle + (phase[0] as number)) +
      0.03 * Math.sin(3 * angle + (phase[1] as number)) +
      0.018 * Math.sin(5 * angle + (phase[2] as number)));

  // The pond takes the spot the layout reserves for it, so nothing else ever stands there.
  const spot = layout.spots.pond;
  const pond = { x: spot.x, z: spot.z, radius: 0.62, level: 0 };
  const pondAngle = Math.atan2(pond.z, pond.x);
  const rimX = Math.cos(pondAngle) * coast(pondAngle);
  const rimZ = Math.sin(pondAngle) * coast(pondAngle);
  const bend = (rng() - 0.5) * 0.3;
  const stream: Array<[number, number]> = [];
  const startX = pond.x + Math.cos(pondAngle) * pond.radius * 0.7;
  const startZ = pond.z + Math.sin(pondAngle) * pond.radius * 0.7;
  for (let i = 0; i <= 6; i += 1) {
    const t = i / 6;
    const arc = Math.sin(t * Math.PI) * bend;
    stream.push([
      startX + (rimX - startX) * t - Math.sin(pondAngle) * arc,
      startZ + (rimZ - startZ) * t + Math.cos(pondAngle) * arc,
    ]);
  }
  const halfWidth = 0.13;

  const treeX = TREE_ORIGIN[0];
  const treeZ = TREE_ORIGIN[2];

  /** The lawn without the water carved into it. */
  const rolling = (x: number, z: number) => {
    const rho = Math.min(1, Math.hypot(x, z) / R);
    return (
      0.12 * (1 - rho * rho) +
      0.34 * gauss(x + 1.25, z + 1.55, 1.25) +
      0.16 * gauss(x - 1.75, z + 1.15, 0.9) +
      0.13 * gauss(x - treeX, z - treeZ, 0.62) +
      0.022 * Math.sin(x * 2.1 + (phase[3] as number)) * Math.cos(z * 1.7 + (phase[4] as number))
    );
  };
  pond.level = rolling(pond.x, pond.z) - 0.075;

  const height = (x: number, z: number) => {
    let h = rolling(x, z);
    const fromPond = Math.hypot(x - pond.x, z - pond.z);
    h -= 0.3 * (1 - smoothstep(pond.radius * 0.5, pond.radius * 1.18, fromPond));
    const fromStream = distanceToLine(x, z, stream);
    h -= 0.12 * (1 - smoothstep(halfWidth * 0.6, halfWidth * 1.9, fromStream));
    // The rim rolls over into the lip instead of ending on a knife edge.
    const share = Math.hypot(x, z) / coast(Math.atan2(z, x));
    h -= 0.08 * smoothstep(0.88, 1, share);
    return h;
  };

  const inside = (x: number, z: number, margin = 0) =>
    Math.hypot(x, z) <= coast(Math.atan2(z, x)) - margin;

  const dry = (x: number, z: number, margin = 0) =>
    inside(x, z, margin) &&
    Math.hypot(x - pond.x, z - pond.z) > pond.radius + margin &&
    distanceToLine(x, z, stream) > halfWidth + margin;

  // Stepping stones: a lazy curve from the front rim to the foot of the tree.
  const [fromX, fromZ] = clockToIsland(6.2, 0.86);
  const toX = treeX + 0.18;
  const toZ = treeZ + 0.66;
  const midX = (fromX + toX) / 2 - 0.5;
  const midZ = (fromZ + toZ) / 2 + 0.08;
  const path: Stone[] = [];
  const stones = 8;
  for (let i = 0; i < stones; i += 1) {
    const t = (i + 0.5) / stones;
    const u = 1 - t;
    const x = u * u * fromX + 2 * u * t * midX + t * t * toX + (rng() - 0.5) * 0.07;
    const z = u * u * fromZ + 2 * u * t * midZ + t * t * toZ + (rng() - 0.5) * 0.07;
    const radius = 0.16 + rng() * 0.06;
    const yaw = rng() * TAU;
    if (!dry(x, z, radius)) continue;
    path.push({ x, y: height(x, z), z, radius, yaw });
  }

  const terrain: Terrain = {
    seed,
    coast,
    height,
    inside,
    dry,
    pond,
    stream: { points: stream, halfWidth },
    outlet: { x: rimX, y: height(rimX * 0.97, rimZ * 0.97), z: rimZ, angle: pondAngle },
    path,
    tree: [treeX, height(treeX, treeZ) - 0.03, treeZ],
    depth: ISLAND_DEPTH,
  };
  if (cache.size > 8) cache.clear();
  cache.set(seed, terrain);
  return terrain;
}

/** Height of the lawn at a point, for whoever places things on it (props, creatures). */
export function terrainHeight(seed: number, x: number, z: number): number {
  return createTerrain(seed).height(x, z);
}
