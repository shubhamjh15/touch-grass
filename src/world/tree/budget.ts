import { QUALITY } from '../config';
import type { WorldQuality } from '../contract';
import { buildIsland } from './island';
import type { Skeleton } from './types';

/**
 * Predicts what the renderer will be asked to draw for a full-grown tree, without
 * touching WebGL: the numbers a test can hold against the tier budgets. The triangle
 * counts per part and the passes per solid mirror `scene/geometry.ts` and
 * `scene/GroveRig.ts`; the world lab shows the measured `renderer.info` values, and
 * the two agree to the triangle.
 */

const PARTS = {
  tier: 36,
  leaf: 24,
  blossom: 40,
  rock: 20,
  tuft: 12,
  emblem: 64,
} as const;

export interface BudgetEstimate {
  drawCalls: number;
  triangles: number;
  clumps: number;
  accents: number;
}

export function estimateBudget(skeleton: Skeleton, quality: WorldQuality): BudgetEstimate {
  const tier = QUALITY[quality];
  const island = buildIsland(skeleton.seed, tier.islandSegments, tier.scatterShare);

  let wood = 0;
  for (const branch of skeleton.branches) {
    const sides =
      branch.parent < 0
        ? tier.trunkSides
        : branch.level === 1
          ? tier.branchSides
          : Math.max(4, tier.branchSides - 1);
    wood += (branch.nodeCount - 1) * sides * 2;
  }

  const drawn = skeleton.accents.filter((accent) => accent.rank < tier.accentShare);
  const leaves = drawn.filter((accent) => accent.kind === 'leaf').length;
  const blossoms = drawn.length - leaves;
  const clump = skeleton.shape === 'tier' ? PARTS.tier : 20 * (tier.clumpDetail + 1) ** 2;

  // Passes per solid: fill + ink, plus white and shadow for sticker solids, plus the
  // kiss-cut line where the tier draws it, plus the sundial shadow for wood and clumps.
  const sticker = 4 + (tier.keyline ? 1 : 0);
  const cast = tier.castShadow ? 1 : 0;
  const solids: Array<[triangles: number, passes: number]> = [
    [island.triangles, sticker],
    [island.ticks.length / 9, 1],
    [(island.rocks.length + 1) * PARTS.rock, 2],
    [island.tufts.length * PARTS.tuft, 2],
    [PARTS.emblem, 2],
    [wood, (tier.woodSticker ? sticker : 2) + cast],
    [skeleton.clumps.length * clump, sticker + cast],
    [leaves * PARTS.leaf, sticker],
    [blossoms * PARTS.blossom, sticker],
  ];
  const used = solids.filter(([triangles]) => triangles > 0);
  return {
    drawCalls: used.reduce((sum, [, passes]) => sum + passes, 0),
    triangles: used.reduce((sum, [triangles, passes]) => sum + triangles * passes, 0),
    clumps: skeleton.clumps.length,
    accents: drawn.length,
  };
}
