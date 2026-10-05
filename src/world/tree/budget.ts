import { QUALITY } from '../config';
import type { WorldQuality } from '../contract';
import { buildIsland } from './island';
import type { Skeleton } from './types';

/**
 * Predicts what the renderer will be asked to draw for a full-grown tree, without
 * touching WebGL: the numbers a test can hold against the tier budgets. The triangle
 * counts per part mirror the builders in `scene/geometry.ts`; the world lab shows the
 * measured `renderer.info` values next to them.
 */

const PARTS = {
  tier: 36,
  leaf: 24,
  blossom: 40,
  rock: 20,
  tuft: 12,
  emblem: 64,
} as const;

/** Passes a solid is drawn in: shadow, keyline, white, fill, ink. Or just fill and ink. */
const STICKER_PASSES = 5;
const PLAIN_PASSES = 2;

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
  const clumpTriangles = skeleton.shape === 'tier' ? PARTS.tier : 20 * (tier.clumpDetail + 1) ** 2;

  const sticker =
    island.triangles +
    wood +
    skeleton.clumps.length * clumpTriangles +
    leaves * PARTS.leaf +
    blossoms * PARTS.blossom +
    (island.rocks.length + 1) * PARTS.rock;
  const plain = island.tufts.length * PARTS.tuft + PARTS.emblem;

  // island, wood, clumps, rocks + seed, then leaves and blossoms when the tree has any.
  const stickerSolids = 4 + (leaves > 0 ? 1 : 0) + (blossoms > 0 ? 1 : 0);
  return {
    drawCalls: stickerSolids * STICKER_PASSES + 2 * PLAIN_PASSES,
    triangles: sticker * STICKER_PASSES + plain * PLAIN_PASSES,
    clumps: skeleton.clumps.length,
    accents: drawn.length,
  };
}
