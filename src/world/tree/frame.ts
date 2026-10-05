import { clamp01 } from '@/lib/math';
import { CAMERA } from '../config';
import type { SubjectFrame } from '../framing';
import { TREE_BASE, islandFrame } from './island';
import type { PoseStats, TreeMetrics } from './types';

/** Headroom over the grass that is always framed, so a seed is not a speck in a huge box. */
const YOUNG_HEADROOM = 1.15;
/** Slack around the crown. */
const CROWN_MARGIN = 0.14;
/** How much of the crown's reach shows as extra height under the elevated camera. */
const DEPTH_SHARE = 0.35;
const MIN_EASE = 1.3;

/** 0..1 eased share of the full-grown frame that is used at `growth`. Monotonic. */
export function frameProgress(growth: number, ease: number): number {
  return 1 - (1 - clamp01(growth)) ** ease;
}

/** Screen-space height of a tree whose top and reach are given, seen from `pitch`. */
function projectedTop(top: number, halfWidth: number, pitch: number): number {
  return (TREE_BASE + top + CROWN_MARGIN) * Math.cos(pitch) + halfWidth * DEPTH_SHARE * Math.sin(pitch);
}

/**
 * The virtual box the camera frames at a given growth: close on the sprout when the
 * tree is young, pulled back for an elder. It is an eased, monotonic function of
 * growth (never the live bounding box), so the subject's size on screen glides instead
 * of jumping whenever a clump pops in.
 */
export function subjectFrame(metrics: TreeMetrics, growth: number, pitch: number): SubjectFrame {
  const island = islandFrame(pitch);
  const eased = frameProgress(growth, metrics.frameEase);
  const young = island.top + YOUNG_HEADROOM;
  const elder = projectedTop(metrics.top, metrics.halfWidth, pitch);
  return {
    halfWidth: Math.max(island.halfWidth, (metrics.halfWidth + CROWN_MARGIN) * eased),
    top: young + Math.max(0, elder - young) * eased,
    bottom: island.bottom,
  };
}

/**
 * Finds the gentlest ease-out exponent whose frame contains the tree at every growth.
 * Solved once per skeleton from a sweep of poses, so the frame stays a smooth analytic
 * curve and still never crops this particular tree.
 */
export function solveFrameEase(metrics: TreeMetrics, statsAt: (growth: number) => PoseStats): number {
  const pitch = CAMERA.pitch;
  const island = islandFrame(pitch);
  const young = island.top + YOUNG_HEADROOM;
  const elder = projectedTop(metrics.top, metrics.halfWidth, pitch);
  let ease = MIN_EASE;
  const need = (share: number, growth: number) => {
    if (share <= 0) return;
    ease = Math.max(ease, Math.log(1 - Math.min(share, 0.9999)) / Math.log(1 - growth));
  };
  const steps = 120;
  for (let step = 1; step < steps; step += 1) {
    const growth = step / steps;
    const stats = statsAt(growth);
    const top = projectedTop(stats.top - CROWN_MARGIN * 0.5, stats.halfWidth, pitch);
    if (elder > young) need((top - young) / (elder - young), growth);
    if (stats.halfWidth > island.halfWidth - CROWN_MARGIN) {
      need(stats.halfWidth / (metrics.halfWidth + CROWN_MARGIN), growth);
    }
  }
  return ease * 1.02;
}
