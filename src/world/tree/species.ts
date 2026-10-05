/**
 * Proportions of the three species, in world units (the island's grass top has
 * radius 3). This is the tuning sheet for silhouettes: change numbers here, not in
 * the generator. Angles are radians; "elevation" is measured above the horizon.
 */

const deg = (value: number) => (value * Math.PI) / 180;

/** Shared by every species. */
export const WOOD = {
  /** Trunk that starts below the grass so the base is always buried. */
  buried: 0.25,
  minRadius: 0.034,
  trunkTaper: 0.7,
  branchTaper: 0.45,
} as const;

export const OAK = {
  /** Broad and round: a generous ball of bubbles on a stout trunk. */
  trunkHeight: 4.1,
  trunkNodes: 12,
  trunkEnd: 0.85,
  trunkEase: 2.2,
  baseRadius: 0.4,
  flare: 0.5,
  pipeExponent: 1.8,
  wander: 0.13,
  core: { height: 3.0, radius: 1.5, squash: 0.95, birth: 0.055, startScale: 0.16 },
  crown: { height: 3.5, radius: 0.72, startScale: 0.45 },
  lower: {
    count: 5,
    attach: [1.2, 1.85],
    length: [1.75, 2.0],
    elevation: [deg(14), deg(26)],
    lift: deg(42),
    bend: 0.55,
    radius: [0.84, 0.97],
    duration: 0.6,
    side: {
      at: [0.5, 0.62],
      swing: [0.75, 1.0],
      elevation: [deg(20), deg(40)],
      length: [0.95, 1.15],
      radius: [0.56, 0.68],
      duration: 0.45,
    },
  },
  upper: {
    count: 4,
    attach: [2.35, 2.95],
    length: [1.2, 1.45],
    elevation: [deg(42), deg(58)],
    lift: deg(72),
    bend: 0.5,
    radius: [0.76, 0.88],
    duration: 0.5,
  },
  /** Extra clumps only an elder tree earns. */
  late: {
    count: 4,
    attach: [2.4, 3.0],
    length: [1.1, 1.3],
    elevation: [deg(4), deg(24)],
    radius: [0.52, 0.62],
    from: 0.8,
    step: 0.04,
    duration: 0.12,
  },
  leaves: { perClump: [1, 2], size: [0.3, 0.4] },
} as const;

export const CHERRY = {
  /** Elegant and open: a leaning trunk, long flat limbs, an umbrella of blossom. */
  trunkHeight: 2.95,
  trunkNodes: 9,
  trunkEnd: 0.8,
  trunkEase: 1.7,
  baseRadius: 0.3,
  flare: 0.4,
  pipeExponent: 2.4,
  lean: 0.55,
  leanBack: 0.28,
  /** Clumps are wide, flat ellipsoids. */
  stretch: 1.18,
  squash: 0.74,
  core: { height: 2.7, radius: 1.0, birth: 0.055, startScale: 0.22 },
  limbs: {
    count: 4,
    attach: [1.15, 1.75],
    length: [1.9, 2.25],
    elevation: [deg(38), deg(50)],
    lift: deg(12),
    bend: 0.8,
    radius: [0.8, 0.94],
    duration: 0.36,
    rise: {
      at: 0.42,
      elevation: [deg(55), deg(68)],
      length: [0.85, 1.0],
      radius: [0.56, 0.66],
    },
    reach: {
      at: 0.72,
      swing: [0.8, 1.05],
      elevation: [deg(8), deg(22)],
      length: [0.75, 0.9],
      radius: [0.5, 0.6],
    },
    sideDuration: 0.26,
  },
  late: {
    count: 2,
    attach: [2.5, 2.9],
    length: [0.8, 0.95],
    elevation: [deg(35), deg(55)],
    radius: [0.5, 0.58],
    from: 0.82,
    step: 0.06,
    duration: 0.12,
  },
  /** Every n-th clump stays a green leaf clump among the pink. */
  greenEvery: 4,
  bloom: [0.42, 0.52],
  blossoms: { perClump: [3, 4], size: [0.2, 0.27] },
  leaves: { perClump: [1, 2], size: [0.24, 0.32] },
} as const;

export const PINE = {
  /** Conical: a straight mast with stacked, scalloped tiers. */
  trunkHeight: 4.6,
  trunkNodes: 12,
  trunkEnd: 0.9,
  trunkEase: 1.5,
  baseRadius: 0.27,
  flare: 0.35,
  pipeExponent: 2.3,
  wander: 0.03,
  tiers: {
    count: 6,
    firstBase: 0.62,
    spacing: 0.6,
    height: [1.25, 1.05],
    radius: [1.62, 0.66],
    startScale: 0.35,
    /** A tier appears when the tip has climbed this share of its height above its base. */
    birthLead: 0.25,
    topBirth: 0.05,
  },
  tufts: { perTier: [2, 4], size: [0.22, 0.3] },
} as const;
