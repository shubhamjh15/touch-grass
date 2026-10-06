import { clamp01 } from '@/lib/math';
import type { WorldQuality } from './contract';

/**
 * The small lives of the island (design bible 5.9, direction 3.1): who is out at which
 * hour, how many of them a quality tier affords, and where each one is at a moment in
 * time. Pure maths: positions are functions of the clock, so nothing is simulated,
 * nothing drifts between frames and nothing is allocated while the world runs.
 */

export interface LifeCounts {
  butterflies: number;
  birds: number;
  bees: number;
  fireflies: number;
  /** Leaves the crown lets go per minute. */
  leaves: number;
}

/** The most of each kind a tier draws; the instanced pools are built to the `high` row. */
export const LIFE_CAPS: Record<WorldQuality, LifeCounts> = {
  low: { butterflies: 2, birds: 1, bees: 2, fireflies: 10, leaves: 4 },
  medium: { butterflies: 5, birds: 3, bees: 4, fireflies: 18, leaves: 8 },
  high: { butterflies: 7, birds: 4, bees: 5, fireflies: 24, leaves: 12 },
};

/** What the user has earned that brings life with it. */
export interface LifeProps {
  flowers: boolean;
  butterflies: boolean;
  birds: boolean;
  birdhouse: boolean;
  beehive: boolean;
  fireflies: boolean;
}

const ramp = (value: number, from: number, to: number) => clamp01((value - from) / (to - from));

/** 0 at night, 1 by day, with an hour of dawn and of dusk. */
export function daylight(hour: number): number {
  return Math.min(ramp(hour, 5.5, 6.5), 1 - ramp(hour, 19, 20));
}

/** How present each kind is at an hour, 0..1: butterflies and bees keep office hours. */
export function presenceAt(hour: number, out: LifeCounts): LifeCounts {
  const day = daylight(hour);
  out.butterflies = Math.min(ramp(hour, 7, 8), 1 - ramp(hour, 18, 19));
  out.bees = Math.min(ramp(hour, 7.5, 8.5), 1 - ramp(hour, 17.5, 18.5));
  out.birds = day;
  out.fireflies = 1 - Math.min(ramp(hour, 4.5, 5.5), 1 - ramp(hour, 19.5, 20.5));
  out.leaves = 1;
  return out;
}

/**
 * How many of each kind live on this island. A bare island already has a visitor or
 * two; the earned props bring the rest. A dormant tree is a quiet place.
 */
export function lifeCounts(
  quality: WorldQuality,
  props: LifeProps,
  vitality: number,
  out: LifeCounts,
): LifeCounts {
  const cap = LIFE_CAPS[quality];
  const awake = vitality > 0.2;
  out.butterflies = Math.min(
    cap.butterflies,
    (awake ? 1 : 0) + (props.flowers ? 1 : 0) + (props.butterflies ? 3 : 0),
  );
  out.birds = Math.min(cap.birds, 1 + (props.birdhouse ? 1 : 0) + (props.birds ? 2 : 0));
  out.bees = Math.min(cap.bees, (props.flowers && awake ? 1 : 0) + (props.beehive ? 3 : 0));
  out.fireflies = props.fireflies ? cap.fireflies : Math.min(cap.fireflies, 6);
  // A thirsty tree sheds; a dormant one has nothing left to drop.
  out.leaves = vitality < 0.12 ? 0 : cap.leaves * (vitality < 0.6 ? 2 : 1);
  return out;
}

/** Where a flyer is and how it is turned. Reused: every path writes into one of these. */
export interface Flyer {
  x: number;
  y: number;
  z: number;
  /** Heading about the vertical axis, radians; 0 faces +z. */
  heading: number;
  /** Roll into the turn, radians. */
  bank: number;
}

export const createFlyer = (): Flyer => ({ x: 0, y: 0, z: 0, heading: 0, bank: 0 });

interface Point {
  x: number;
  y: number;
  z: number;
}

/** A butterfly loops a lazy figure of eight over its flower, bobbing as it goes. */
export function butterflyAt(index: number, time: number, home: Point, out: Flyer): Flyer {
  const pace = 0.5 + (index % 3) * 0.09;
  const p = time * pace + index * 2.1;
  const reach = 0.42 + (index % 2) * 0.16;
  out.x = home.x + Math.sin(p) * reach;
  out.z = home.z + Math.sin(p * 2) * reach * 0.5;
  out.y = home.y + 0.62 + Math.sin(p * 1.7 + index) * 0.16 + Math.abs(Math.sin(p * 5.3)) * 0.05;
  const dx = Math.cos(p) * reach;
  const dz = Math.cos(p * 2) * reach;
  out.heading = Math.atan2(dx, dz);
  out.bank = Math.sin(p * 2) * 0.25;
  return out;
}

/** A bee hums in a tight knot about its hive or its flower. */
export function beeAt(index: number, time: number, home: Point, out: Flyer): Flyer {
  const p = time * (1.5 + index * 0.23) + index * 1.9;
  const reach = 0.22 + (index % 3) * 0.07;
  out.x = home.x + Math.sin(p) * reach + Math.sin(p * 3.1) * 0.03;
  out.z = home.z + Math.cos(p * 1.3 + index) * reach;
  out.y = home.y + Math.sin(p * 0.7 + index) * 0.1 + Math.sin(p * 4.3) * 0.015;
  out.heading = Math.atan2(Math.cos(p) * reach, -Math.sin(p * 1.3 + index) * reach * 1.3);
  out.bank = 0;
  return out;
}

export interface TreeBox extends Point {
  top: number;
  halfWidth: number;
}

/** A bird circles the crown, rising and falling a little, banked into its turn. */
export function birdAt(index: number, time: number, tree: TreeBox, out: Flyer): Flyer {
  const side = index % 2 === 0 ? 1 : -1;
  const radius = Math.max(1.5, tree.halfWidth + 0.7) + index * 0.32;
  const p = side * (time * (0.52 - index * 0.05) + index * 2.4);
  out.x = tree.x + Math.sin(p) * radius;
  out.z = tree.z + Math.cos(p) * radius * 0.82;
  out.y = tree.y + Math.max(1.3, tree.top * (0.72 + index * 0.07)) + Math.sin(p * 2.3) * 0.16;
  out.heading = Math.atan2(Math.cos(p) * side, -Math.sin(p) * 0.82 * side);
  out.bank = -side * 0.42;
  return out;
}

/** Eases a flyer away from a point by `amount` (0..1): the flinch when the island is tapped. */
export function flinch(out: Flyer, from: Point, amount: number, reach = 1.6): Flyer {
  if (amount <= 0) return out;
  const dx = out.x - from.x;
  const dz = out.z - from.z;
  const distance = Math.hypot(dx, dz);
  const near = clamp01(1 - distance / reach) * amount;
  if (near <= 0) return out;
  const ux = distance > 1e-4 ? dx / distance : 1;
  const uz = distance > 1e-4 ? dz / distance : 0;
  out.x += ux * near * 0.9;
  out.z += uz * near * 0.9;
  out.y += near * 0.55;
  return out;
}
