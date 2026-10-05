import { clamp01 } from '@/lib/math';

/**
 * The growth curves shared by the generator (to schedule births) and the pose function
 * (to reveal). Every one of them is non-decreasing in `growth`: that is what makes the
 * tree monotonic, so change them with care (the tests sample 200 steps).
 */

const smooth01 = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Share of the trunk that is revealed: fast while young, complete at `end`. */
export function trunkProgress(growth: number, end: number, ease: number): number {
  return 1 - (1 - clamp01(growth / end)) ** ease;
}

/** Growth at which the trunk has revealed `share` of itself. Inverse of {@link trunkProgress}. */
export function trunkGrowthAt(share: number, end: number, ease: number): number {
  return end * (1 - (1 - clamp01(share)) ** (1 / ease));
}

const BRANCH_EASE = 1.25;

/** Share of a branch that is revealed at `phase` (0..1) of its growth window. */
export function branchProgress(phase: number): number {
  return 1 - (1 - clamp01(phase)) ** BRANCH_EASE;
}

export function branchPhaseAt(share: number): number {
  return 1 - (1 - clamp01(share)) ** (1 / BRANCH_EASE);
}

/** Growth span over which a newborn clump pops from nothing to its start size. */
export const CLUMP_POP_SPAN = 0.05;
/** Growth span over which a leaf or blossom unfolds. */
export const ACCENT_POP_SPAN = 0.035;

/**
 * Scale of a clump, 0..1. It pops in quickly to `startScale` and then keeps swelling
 * until growth 1, so the canopy fills out for the whole life of the tree.
 */
export function clumpScale(growth: number, birth: number, startScale: number): number {
  if (growth <= birth) return 0;
  const pop = smooth01((growth - birth) / CLUMP_POP_SPAN);
  const swell = clamp01((growth - birth) / Math.max(1e-6, 1 - birth)) ** 0.8;
  return pop * (startScale + (1 - startScale) * swell);
}

export function accentScale(growth: number, birth: number): number {
  return growth <= birth ? 0 : smooth01((growth - birth) / ACCENT_POP_SPAN);
}

/**
 * Pipe-model load a branch tip carries: it rises as the branch extends and keeps
 * rising until growth 1 (the wood thickens for the whole life of the tree).
 */
export function tipLoadShare(growth: number, t0: number, extended: number): number {
  if (growth <= t0) return 0;
  const maturity = clamp01((growth - t0) / Math.max(1e-6, 1 - t0)) ** 0.8;
  return extended * (0.3 + 0.7 * maturity);
}

/** Radius multiplier near a growing tip: 0 at the tip, 1 from `taper` behind it. */
export function tipTaper(distance: number, taper: number): number {
  return clamp01(distance / taper) ** 0.7;
}

/** Transient overshoot of a part that appeared within the last `span` of growth. */
export function popBump(growth: number, birth: number, span: number): number {
  const x = (growth - birth) / span;
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2;
}

/** Ring bonus: every day the user shows up thickens the wood a touch, saturating gently. */
export function ringFactor(ageDays: number): number {
  return 1 + 0.12 * (1 - Math.exp(-Math.max(0, ageDays) / 120));
}

export { smooth01 };
