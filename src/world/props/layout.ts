import { createRng } from '@/lib/rng';
import { ISLAND } from '../config';
import type { IslandPropId, LandmarkId } from '../contract';
import { TREE_ORIGIN, groundHeight } from '../tree/island';

/**
 * Where everything stands on the lawn (design bible 5.4, 5.6, 5.7). Every prop and
 * landmark has a home given as a clock position seen from the rest camera (6 o'clock is
 * towards the viewer) and a radius. The seed jitters each home a little, then a
 * relaxation pass pushes footprints apart until none overlap, none touch the trunk and
 * all stay inside the hour ticks on the rim. The layout does not depend on which props
 * are unlocked, so nothing ever moves when a new one arrives.
 */

export interface Spot {
  /** Island space, on the lawn. */
  x: number;
  y: number;
  z: number;
  /** Radius of the footprint that is kept clear, in world units. */
  radius: number;
  /** Turn about the vertical axis; 0 faces the rest camera. */
  yaw: number;
}

export type GroundPropId = Exclude<IslandPropId, 'birds' | 'butterflies' | 'fireflies'>;
export type GroundLandmarkId = Exclude<LandmarkId, 'impact' | 'me'>;
export type SpotId = GroundPropId | GroundLandmarkId;

interface Home {
  clock: number;
  /** Share of the lawn radius. */
  rho: number;
  radius: number;
  /** How much the seed may turn it, in radians. Things with a front face barely turn. */
  turn: number;
  /** Heavier things give way less when footprints are pushed apart. */
  weight: number;
}

/** Homes from the bible tables. The swing's home is only used when no branch can carry it. */
export const HOMES: Record<SpotId, Home> = {
  // Landmarks: front lawn, never hidden by the trunk.
  log: { clock: 5, rho: 0.28, radius: 0.24, turn: 0.2, weight: 3 },
  quests: { clock: 8.5, rho: 0.62, radius: 0.34, turn: 0.1, weight: 3 },
  learn: { clock: 7, rho: 0.45, radius: 0.24, turn: 0.3, weight: 3 },
  community: { clock: 4, rho: 0.8, radius: 0.18, turn: 0.1, weight: 3 },
  coach: { clock: 3.5, rho: 0.5, radius: 0.3, turn: 0, weight: 3 },
  // Props.
  mushrooms: { clock: 7.5, rho: 0.8, radius: 0.22, turn: 0.6, weight: 1 },
  pond: { clock: 4.5, rho: 0.56, radius: 0.5, turn: 0.15, weight: 4 },
  bench: { clock: 8, rho: 0.44, radius: 0.36, turn: 0.08, weight: 2 },
  lantern: { clock: 5.2, rho: 0.78, radius: 0.16, turn: 0.2, weight: 1 },
  turbine: { clock: 1, rho: 0.8, radius: 0.2, turn: 0, weight: 2 },
  solar: { clock: 11, rho: 0.75, radius: 0.32, turn: 0.1, weight: 2 },
  compost: { clock: 9.5, rho: 0.8, radius: 0.32, turn: 0.15, weight: 2 },
  'veggie-patch': { clock: 3, rho: 0.62, radius: 0.5, turn: 0.1, weight: 2 },
  beehive: { clock: 2, rho: 0.78, radius: 0.2, turn: 0.2, weight: 1 },
  birdhouse: { clock: 10, rho: 0.6, radius: 0.16, turn: 0.2, weight: 1 },
  swing: { clock: 2.6, rho: 0.34, radius: 0.3, turn: 0, weight: 1 },
  signpost: { clock: 6.6, rho: 0.74, radius: 0.16, turn: 0.1, weight: 1 },
  flowers: { clock: 6, rho: 0.7, radius: 0, turn: 0, weight: 0 },
};

export const FLOWER_COUNT = 9;
const FLOWER_RADIUS = 0.11;
/** Nothing stands closer to the trunk than this (plus its own footprint). */
export const TRUNK_CLEARANCE = 0.42;
/** Footprints stay inside this share of the lawn radius: the hour ticks own the rim. */
export const RIM = 0.9;
const TAU = Math.PI * 2;

export interface IslandLayout {
  spots: Record<Exclude<SpotId, 'flowers'>, Spot>;
  flowers: Spot[];
}

/** Clock position and radius share to island coordinates (x right, z towards the viewer). */
export function clockToIsland(clock: number, rho: number): [number, number] {
  const angle = (clock / 12) * TAU;
  const r = rho * ISLAND.radius;
  return [Math.sin(angle) * r, -Math.cos(angle) * r];
}

interface Body {
  id: SpotId;
  x: number;
  z: number;
  radius: number;
  weight: number;
  yaw: number;
}

/** Keeps a footprint on the lawn and off the trunk. */
function contain(body: Body): void {
  const limit = RIM * ISLAND.radius - body.radius;
  const fromCentre = Math.hypot(body.x, body.z);
  if (fromCentre > limit) {
    body.x *= limit / fromCentre;
    body.z *= limit / fromCentre;
  }
  const dx = body.x - TREE_ORIGIN[0];
  const dz = body.z - TREE_ORIGIN[2];
  const fromTrunk = Math.hypot(dx, dz);
  const clear = TRUNK_CLEARANCE + body.radius;
  if (fromTrunk < clear) {
    // Straight out from the trunk; a body exactly on it leaves towards the viewer.
    const ux = fromTrunk > 1e-6 ? dx / fromTrunk : 0;
    const uz = fromTrunk > 1e-6 ? dz / fromTrunk : 1;
    body.x = TREE_ORIGIN[0] + ux * clear;
    body.z = TREE_ORIGIN[2] + uz * clear;
  }
}

const spotOf = (body: { x: number; z: number; radius: number; yaw: number }): Spot => ({
  x: body.x,
  y: groundHeight(Math.hypot(body.x, body.z) / ISLAND.radius),
  z: body.z,
  radius: body.radius,
  yaw: body.yaw,
});

const cache = new Map<number, IslandLayout>();

export function layoutIsland(seed: number): IslandLayout {
  const cached = cache.get(seed);
  if (cached) return cached;
  const rng = createRng(seed, 'props', 1);
  const bodies: Body[] = [];
  for (const [id, home] of Object.entries(HOMES) as Array<[SpotId, Home]>) {
    if (id === 'flowers') continue;
    const [x, z] = clockToIsland(
      home.clock + (rng() - 0.5) * 0.24,
      home.rho + (rng() - 0.5) * 0.05,
    );
    bodies.push({
      id,
      x,
      z,
      radius: home.radius,
      weight: home.weight,
      yaw: (rng() - 0.5) * 2 * home.turn,
    });
  }

  // Relaxation: overlapping footprints push each other apart, lighter ones give way more.
  const gap = 0.04;
  for (let pass = 0; pass < 240; pass += 1) {
    let moved = false;
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const a = bodies[i] as Body;
        const b = bodies[j] as Body;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        let distance = Math.hypot(dx, dz);
        const need = a.radius + b.radius + gap;
        if (distance >= need) continue;
        if (distance < 1e-6) {
          dx = Math.cos(i * 2.4 + j);
          dz = Math.sin(i * 2.4 + j);
          distance = 1;
        }
        const push = (need - distance) * 1.02;
        const share = a.weight / (a.weight + b.weight);
        a.x -= (dx / distance) * push * (1 - share);
        a.z -= (dz / distance) * push * (1 - share);
        b.x += (dx / distance) * push * share;
        b.z += (dz / distance) * push * share;
        moved = true;
      }
    }
    for (const body of bodies) contain(body);
    if (!moved) break;
  }

  // Flowers fill what is left of the front lawn (bible: scattered, r 0.5 to 0.85).
  const flowers: Spot[] = [];
  const taken = bodies.map((body) => ({ x: body.x, z: body.z, radius: body.radius }));
  for (let attempt = 0; attempt < 900 && flowers.length < FLOWER_COUNT; attempt += 1) {
    // The zone widens if the front lawn is crowded, so nine flowers always fit.
    const widen = Math.min(1, attempt / 500);
    const clock = 6 + (rng() - 0.5) * (4 + 3 * widen);
    const rho = 0.5 - 0.15 * widen + rng() * (0.35 + 0.15 * widen);
    const [x, z] = clockToIsland(clock, Math.min(rho, RIM - 0.05));
    const candidate = { x, z, radius: FLOWER_RADIUS, yaw: (rng() - 0.5) * 0.5 };
    const clear = taken.every(
      (other) => Math.hypot(other.x - x, other.z - z) >= other.radius + FLOWER_RADIUS + gap,
    );
    const offTrunk =
      Math.hypot(x - TREE_ORIGIN[0], z - TREE_ORIGIN[2]) >= TRUNK_CLEARANCE + FLOWER_RADIUS;
    if (!clear || !offTrunk) continue;
    taken.push(candidate);
    flowers.push(spotOf(candidate));
  }

  const spots = Object.fromEntries(
    bodies.map((body) => [body.id, spotOf(body)]),
  ) as IslandLayout['spots'];
  const layout = { spots, flowers };
  if (cache.size > 16) cache.clear();
  cache.set(seed, layout);
  return layout;
}
