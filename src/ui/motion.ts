/**
 * Motion tokens (bible 7.2). Springs are named here once; nobody types stiffness numbers in a feature.
 * Durations mirror the CSS custom properties (`--dur-*`) in seconds, for Framer Motion.
 */

interface Spring {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass: number;
}

const spring = (stiffness: number, damping: number, mass: number): Spring => ({
  type: 'spring',
  stiffness,
  damping,
  mass,
});

export const SPRINGS = {
  /** Button release, switch thumb. */
  press: spring(700, 30, 0.6),
  /** Stickers landing, new leaves, badges, checks (about 19 % overshoot). */
  pop: spring(520, 18, 0.7),
  /** Cards entering, layout shifts. */
  settle: spring(260, 26, 1),
  /** Sheets, drawers, modals, the nav pill (no overshoot). */
  sheet: spring(380, 36, 1),
  /** Hang-tag sway, tilt return, idle bobs. */
  float: spring(120, 14, 1),
  /** The world between stages. */
  carry: spring(170, 17, 1),
  /** Number digits (critically damped). */
  tick: spring(900, 40, 0.5),
} as const;

export type SpringName = keyof typeof SPRINGS;

/** Seconds. */
export const DURATIONS = {
  press: 0.08,
  fast: 0.14,
  base: 0.22,
  slow: 0.36,
  scene: 0.64,
  ceremony: 1.2,
} as const;

/** Cubic-bezier control points matching the `--ease-*` tokens. */
export const EASINGS = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  inOut: [0.65, 0, 0.35, 1],
  stick: [0.34, 1.56, 0.64, 1],
  peel: [0.3, 0, 0.1, 1],
  mech: [0.2, 0, 0, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Seconds between siblings; the whole cascade is capped at `max`. */
export const STAGGER = { exit: 0.018, enter: 0.028, max: 0.24 } as const;

/** Delay in seconds for the n-th sibling of a staggered enter, with the cap applied. */
export function enterDelay(index: number): number {
  return Math.min(index * STAGGER.enter, STAGGER.max);
}
