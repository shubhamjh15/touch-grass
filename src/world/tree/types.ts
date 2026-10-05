import type { Species } from '../contract';

/**
 * Data model of a tree. Plain numbers and typed arrays only (no three.js), so the
 * generator and the pose function run in tests and in the main bundle alike.
 *
 * A {@link Skeleton} is the full-grown tree. It is generated once per (seed, species)
 * and never changes. A {@link Pose} is that skeleton revealed up to a growth value.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface Branch {
  /** Index of the parent branch, -1 for the trunk. Parents always come first. */
  parent: number;
  level: number;
  /** Distance along the parent at which this branch leaves it. */
  attachLength: number;
  /** Slice of the skeleton's node arrays. */
  nodeStart: number;
  nodeCount: number;
  length: number;
  /** Part of the trunk that starts below ground and is revealed from growth 0. */
  buried: number;
  /** Growth window in which the tip travels from the base to the end. */
  t0: number;
  t1: number;
  /** Pipe-model load its own tip carries when fully grown. */
  tipLoad: number;
  /** Distance over which the radius tapers to the pointed tip. */
  taper: number;
}

export type ClumpShape = 'blob' | 'tier';

/** A foliage mass: a glossy bubble (broadleaf) or a cone tier (conifer). */
export interface Clump {
  branch: number;
  /** It rides the growing tip of its branch until the tip passes this distance. */
  station: number;
  /** Offset from the anchor, scaled with the clump so a young clump hugs its twig. */
  offset: Vec3;
  /** Full-grown half-extents (blob) or radius / height / radius (tier). */
  size: Vec3;
  rotation: Quat;
  /** 0, 1 or 2: which canopy tone variant it wears. */
  variant: number;
  birth: number;
  /** Share of its final size right after it has popped in. */
  startScale: number;
  /** Growth at which it blossoms (tone changes from leaf to bloom). 2 = never. */
  bloom: number;
  /** A clump of the second foliage family (cherry leaves among the blossom). */
  alt: boolean;
}

export type AccentKind = 'leaf' | 'blossom';

/** A small die-cut leaf or blossom sitting on the surface of a clump. */
export interface Accent {
  clump: number;
  /** Unit direction from the clump centre, in the clump's local frame. */
  direction: Vec3;
  size: number;
  roll: number;
  birth: number;
  kind: AccentKind;
  /** 0..1, uniform. Lower quality tiers draw only the accents below their share. */
  rank: number;
  /** The accent is dropped when vitality falls below this (a resting tree looks sparse). */
  hideBelow: number;
}

export interface TreeMetrics {
  /** Highest point above the ground at growth 1. */
  top: number;
  /** Largest horizontal reach from the trunk base at growth 1. */
  halfWidth: number;
  trunkLength: number;
  /** Trunk radius at ground level at growth 1 (before the ring bonus). */
  baseRadius: number;
  /** Exponent of the framing curve: the gentlest ease-out that keeps this tree in frame. */
  frameEase: number;
}

export interface Skeleton {
  species: Species;
  seed: number;
  shape: ClumpShape;
  branches: Branch[];
  /** Final node positions, xyz per node. */
  nodePosition: Float32Array;
  /** Distance of each node from the base of its own branch. */
  nodeLength: Float32Array;
  /** Parallel-transport frame per node: normal xyz, binormal xyz. */
  nodeFrame: Float32Array;
  /** Wind weights per node: trunk bend, branch bob, phase. */
  nodeSway: Float32Array;
  /** Radius multiplier per node (root flare). */
  nodeFlare: Float32Array;
  /** Sorted by birth, so the clumps alive at any growth are a prefix. */
  clumps: Clump[];
  /** Sorted by birth. */
  accents: Accent[];
  pipeExponent: number;
  /** Turns a pipe-model load into a radius. */
  radiusScale: number;
  minRadius: number;
  /** Trunk tip schedule: finished at `trunkEnd`, eased by `trunkEase`. */
  trunkEnd: number;
  trunkEase: number;
  metrics: TreeMetrics;
}

export interface PoseStats {
  /** Revealed wood above ground, summed over all branches. */
  woodLength: number;
  /** Accents that have appeared (at full quality and vitality). */
  leafCount: number;
  clumpCount: number;
  /** Sum of all clump scales: a continuous measure of foliage mass. */
  foliage: number;
  trunkRadius: number;
  top: number;
  halfWidth: number;
}

export interface Pose {
  growth: number;
  nodePosition: Float32Array;
  nodeRadius: Float32Array;
  tipLength: Float32Array;
  /** Column-major 4x4 per clump, in skeleton order. */
  clumpMatrix: Float32Array;
  clumpScale: Float32Array;
  /** 0 = leaf tone, 1 = bloom tone. */
  clumpBloom: Float32Array;
  /** How many leading clumps are alive. */
  clumpCount: number;
  /** Column-major 4x4 per drawn accent, compacted to the accents within the quality share. */
  accentMatrix: Float32Array;
  /** Accents written (within the share) and how many of those have appeared. */
  accentSlots: number;
  accentCount: number;
  stats: PoseStats;
}

export interface PoseOptions {
  /** 0..1 transient overshoot of parts that have just appeared. Render-only. */
  pop?: number;
  /** 0..1. Low vitality drops accents; it never changes the wood or the clumps. */
  vitality?: number;
  /** Days the user has shown up: each ring thickens the wood a little. */
  ageDays?: number;
  /** Share of accents to draw (quality tier). */
  accentShare?: number;
}
