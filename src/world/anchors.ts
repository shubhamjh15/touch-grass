import type { LandmarkId } from './contract';
import { layoutIsland, type SpotId } from './props/layout';
import { createTerrain } from './terrain';

/**
 * Named places on the island, in island space: one per ground prop and landmark (from
 * the seeded layout, which never moves when something is unlocked), plus the fixed
 * features of the terrain. This is the slot API for whoever puts things in the world:
 * mount a model at `anchorsFor(seed).bench` (or use `<Slot id="bench">` in the scene)
 * and it stands on the lawn, clear of every other footprint, the pond and the path.
 */

export type GroundAnchorId = Exclude<SpotId, 'flowers'>;
export type AnchorId =
  | GroundAnchorId
  | LandmarkId
  /** Foot of the trunk. */
  | 'tree'
  /** Where the stream leaves the island and falls. */
  | 'waterfall'
  /** First stepping stone at the front rim. */
  | 'gate';

export interface Anchor {
  x: number;
  /** Height of the ground there. */
  y: number;
  z: number;
  /** Turn about the vertical axis; 0 faces the rest camera. */
  yaw: number;
  /** Radius of the footprint kept clear around it. */
  radius: number;
  /** How far above the ground a label or callout dot should sit. */
  lift: number;
}

const cache = new Map<number, Record<AnchorId, Anchor>>();

export function anchorsFor(seed: number): Record<AnchorId, Anchor> {
  const cached = cache.get(seed);
  if (cached) return cached;
  const terrain = createTerrain(seed);
  const layout = layoutIsland(seed);
  const on = (x: number, z: number, radius: number, yaw = 0, lift = 0.3): Anchor => ({
    x,
    y: terrain.height(x, z),
    z,
    yaw,
    radius,
    lift,
  });
  const ground = Object.fromEntries(
    (
      Object.entries(layout.spots) as Array<[GroundAnchorId, (typeof layout.spots)[GroundAnchorId]]>
    ).map(([id, spot]) => [id, on(spot.x, spot.z, spot.radius, spot.yaw)]),
  ) as Record<GroundAnchorId, Anchor>;
  const [treeX, treeY, treeZ] = terrain.tree;
  const first = terrain.path[0];
  const anchors: Record<AnchorId, Anchor> = {
    ...ground,
    // The pond is real water now: its anchor is the middle of the surface.
    pond: { ...ground.pond, y: terrain.pond.level, radius: terrain.pond.radius, lift: 0.12 },
    // Two landmarks have no footprint of their own: the rings are read at the foot of the
    // tree, the passport hangs on its trunk (the scene moves that one with the tree).
    impact: on(treeX - 0.62, treeZ + 0.5, 0.2, 0, 0.18),
    me: { x: treeX, y: treeY, z: treeZ + 0.2, yaw: 0, radius: 0.2, lift: 0.8 },
    tree: { x: treeX, y: treeY, z: treeZ, yaw: 0, radius: 0.42, lift: 1 },
    waterfall: {
      x: terrain.outlet.x,
      y: terrain.outlet.y,
      z: terrain.outlet.z,
      yaw: 0,
      radius: 0.2,
      lift: 0.1,
    },
    gate: first ? on(first.x, first.z, first.radius, first.yaw, 0.2) : on(0, 2.4, 0.2),
  };
  if (cache.size > 8) cache.clear();
  cache.set(seed, anchors);
  return anchors;
}
