/**
 * Proportions of the three species, in world units (the lawn has radius 3, so the
 * design bible's island diameter D is 6). This is the tuning sheet for silhouettes:
 * change numbers here, not in the generator. Angles are radians; "elevation" is
 * measured above the horizon.
 *
 * Targets at growth 1 (bible 5.5): oak 0.82 D tall with a 0.95 D ball; cherry 0.66 D
 * tall with a 1.10 D flat umbrella; pine 0.95 D tall with a 0.46 D stack of cones.
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
  trunkHeight: 3.9,
  trunkNodes: 12,
  baseRadius: 0.38,
  flare: 0.5,
  pipeExponent: 1.8,
  wander: 0.13,
  core: { height: 2.95, radius: 1.5, squash: 0.95, birth: 0.06, startScale: 0.16 },
  crown: { height: 3.2, radius: 0.72, startScale: 0.45 },
  lower: {
    count: 5,
    attach: [1.0, 1.45],
    length: [1.8, 2.05],
    elevation: [deg(14), deg(26)],
    lift: deg(42),
    bend: 0.55,
    radius: [0.86, 0.98],
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
    attach: [2.2, 2.9],
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
    length: [1.85, 2.05],
    elevation: [deg(4), deg(24)],
    lift: deg(32),
    radius: [0.52, 0.62],
    from: 0.8,
    step: 0.04,
    duration: 0.12,
  },
  leaves: { perClump: [1, 2], size: [0.3, 0.4] },
} as const;

export const CHERRY = {
  /** Elegant and open: a leaning trunk, long flat limbs with visible forks, an umbrella of blossom. */
  trunkHeight: 3.1,
  trunkNodes: 9,
  baseRadius: 0.3,
  flare: 0.4,
  pipeExponent: 2.1,
  lean: 0.5,
  leanBack: 0.3,
  /** Clumps are wide, flat ellipsoids. */
  stretch: 1.2,
  squash: 0.7,
  core: { height: 2.95, radius: 1.0, birth: 0.06, startScale: 0.2 },
  limbs: {
    count: 4,
    attach: [1.1, 1.7],
    length: [2.35, 2.7],
    elevation: [deg(26), deg(36)],
    lift: deg(4),
    bend: 0.85,
    radius: [0.8, 0.92],
    duration: 0.62,
    rise: {
      at: 0.45,
      elevation: [deg(58), deg(70)],
      length: [0.9, 1.1],
      radius: [0.62, 0.72],
    },
    reach: {
      at: 0.74,
      swing: [0.85, 1.1],
      elevation: [deg(4), deg(16)],
      length: [0.8, 0.95],
      radius: [0.5, 0.6],
    },
    sideDuration: 0.4,
  },
  late: {
    count: 2,
    attach: [2.5, 2.9],
    length: [1.4, 1.6],
    elevation: [deg(25), deg(40)],
    lift: deg(20),
    radius: [0.55, 0.62],
    from: 0.82,
    step: 0.06,
    duration: 0.12,
  },
  /** Every n-th clump stays a green leaf clump among the pink. */
  greenEvery: 4,
  bloom: [0.4, 0.54],
  blossoms: { perClump: [2, 4], size: [0.22, 0.3] },
  leaves: { perClump: [0, 1], size: [0.28, 0.36] },
} as const;

export const PINE = {
  /** Conical: a straight mast with stacked, scalloped tiers. */
  trunkHeight: 5.45,
  trunkNodes: 13,
  baseRadius: 0.26,
  flare: 0.35,
  pipeExponent: 2.3,
  wander: 0.025,
  tiers: {
    count: 7,
    firstBase: 0.72,
    spacing: 0.63,
    height: [1.3, 1.02],
    radius: [1.38, 0.5],
    startScale: 0.35,
    /** A tier appears when the tip has climbed this share of its height above its base. */
    birthLead: 0.2,
    topBirth: 0.05,
  },
  tufts: { perTier: [0, 2], size: [0.16, 0.22] },
} as const;
