import { describe, expect, it } from 'vitest';
import { CAMERA } from '../config';
import { SPECIES } from '../contract';
import { subjectFrame } from './frame';
import { generateTree } from './generate';
import { TREE_BASE, buildIsland } from './island';
import { createPose, poseTree } from './pose';

const SEEDS = [1, 12, 20261006];

describe('generateTree', () => {
  it.each(SPECIES)('is deterministic for %s', (species) => {
    const a = generateTree(42, species);
    const b = generateTree(42, species);
    expect(Array.from(a.nodePosition)).toEqual(Array.from(b.nodePosition));
    expect(a.clumps).toEqual(b.clumps);
    expect(a.accents).toEqual(b.accents);
    expect(a.radiusScale).toBe(b.radiusScale);
  });

  it('gives every seed a tree of its own and every species a silhouette of its own', () => {
    const one = generateTree(1, 'oak');
    const two = generateTree(2, 'oak');
    expect(Array.from(one.nodePosition)).not.toEqual(Array.from(two.nodePosition));

    const oak = generateTree(7, 'oak').metrics;
    const cherry = generateTree(7, 'cherry').metrics;
    const pine = generateTree(7, 'pine').metrics;
    const slenderness = (m: typeof oak) => m.top / (2 * m.halfWidth);
    // Pine is a spire, cherry an umbrella, oak a ball in between.
    expect(slenderness(pine)).toBeGreaterThan(slenderness(oak) * 1.25);
    expect(slenderness(oak)).toBeGreaterThan(slenderness(cherry) * 1.1);
  });

  it.each(SPECIES)('keeps births ordered and inside the growth range for %s', (species) => {
    const tree = generateTree(5, species);
    const clumpBirths = tree.clumps.map((clump) => clump.birth);
    const accentBirths = tree.accents.map((accent) => accent.birth);
    expect(clumpBirths).toEqual([...clumpBirths].sort((a, b) => a - b));
    expect(accentBirths).toEqual([...accentBirths].sort((a, b) => a - b));
    for (const birth of [...clumpBirths, ...accentBirths]) {
      expect(birth).toBeGreaterThanOrEqual(0);
      expect(birth).toBeLessThan(1);
    }
    for (const branch of tree.branches) {
      expect(branch.t1).toBeGreaterThan(branch.t0);
      expect(branch.t1).toBeLessThanOrEqual(1);
    }
  });
});

describe('poseTree', () => {
  const cases = SPECIES.flatMap((species) => SEEDS.map((seed) => [species, seed] as const));

  it.each(cases)('never shrinks anything as %s (seed %i) grows', (species, seed) => {
    const tree = generateTree(seed, species);
    const pose = createPose(tree);
    const tolerance = 1e-6;
    let previous = {
      wood: -1,
      leaves: -1,
      trunk: -1,
      foliage: -1,
      top: -1,
      width: -1,
      radii: new Float32Array(pose.nodeRadius.length),
      clumps: new Float32Array(pose.clumpScale.length),
      tips: new Float32Array(pose.tipLength.length),
    };
    const steps = 200;
    for (let step = 0; step <= steps; step += 1) {
      poseTree(tree, step / steps, pose);
      const { stats } = pose;
      expect(stats.woodLength).toBeGreaterThanOrEqual(previous.wood - tolerance);
      expect(stats.leafCount).toBeGreaterThanOrEqual(previous.leaves);
      expect(stats.trunkRadius).toBeGreaterThanOrEqual(previous.trunk - tolerance);
      expect(stats.foliage).toBeGreaterThanOrEqual(previous.foliage - tolerance);
      expect(stats.top).toBeGreaterThanOrEqual(previous.top - tolerance);
      expect(stats.halfWidth).toBeGreaterThanOrEqual(previous.width - tolerance);
      const shrunk = (now: Float32Array, before: Float32Array) =>
        now.findIndex((value, index) => value < (before[index] as number) - tolerance);
      expect(shrunk(pose.nodeRadius, previous.radii)).toBe(-1);
      expect(shrunk(pose.clumpScale, previous.clumps)).toBe(-1);
      expect(shrunk(pose.tipLength, previous.tips)).toBe(-1);
      previous = {
        wood: stats.woodLength,
        leaves: stats.leafCount,
        trunk: stats.trunkRadius,
        foliage: stats.foliage,
        top: stats.top,
        width: stats.halfWidth,
        radii: pose.nodeRadius.slice(),
        clumps: pose.clumpScale.slice(),
        tips: pose.tipLength.slice(),
      };
    }
  });

  it.each(SPECIES)('shows something new for every 0.002 of growth on %s', (species) => {
    const tree = generateTree(12, species);
    const pose = createPose(tree);
    // One number that rises whenever wood extends or thickens, or foliage appears or swells.
    const measure = () =>
      pose.stats.woodLength + pose.stats.trunkRadius + pose.stats.foliage + pose.stats.leafCount;
    poseTree(tree, 0, pose);
    let previous = measure();
    for (let step = 1; step <= 500; step += 1) {
      poseTree(tree, step / 500, pose);
      const now = measure();
      expect(now).toBeGreaterThan(previous);
      previous = now;
    }
  });

  it.each(SPECIES)('starts %s as a bare seed bed and ends with everything revealed', (species) => {
    const tree = generateTree(3, species);
    const pose = createPose(tree);
    poseTree(tree, 0, pose);
    expect(pose.clumpCount).toBe(0);
    expect(pose.accentCount).toBe(0);
    expect(pose.stats.woodLength).toBe(0);
    poseTree(tree, 0.03, pose);
    // A sprout: a short stem and its two seed leaves.
    expect(pose.accentCount).toBe(2);
    expect(pose.stats.woodLength).toBeGreaterThan(0.1);
    poseTree(tree, 1, pose);
    expect(pose.clumpCount).toBe(tree.clumps.length);
    expect(pose.accentCount).toBe(tree.accents.length);
  });

  it('draws fewer accents on lower tiers without touching the wood or the clumps', () => {
    const tree = generateTree(12, 'oak');
    const full = poseTree(tree, 1, createPose(tree));
    const quarter = poseTree(tree, 1, createPose(tree), { accentShare: 0.25 });
    expect(quarter.accentSlots).toBeLessThan(full.accentSlots);
    expect(quarter.clumpCount).toBe(full.clumpCount);
    expect(Array.from(quarter.nodeRadius)).toEqual(Array.from(full.nodeRadius));
  });

  it('lets low vitality drop accents but never the tree itself', () => {
    const tree = generateTree(12, 'oak');
    const thriving = poseTree(tree, 0.8, createPose(tree), { vitality: 1 });
    const dormant = poseTree(tree, 0.8, createPose(tree), { vitality: 0 });
    expect(Array.from(dormant.nodeRadius)).toEqual(Array.from(thriving.nodeRadius));
    expect(Array.from(dormant.nodePosition)).toEqual(Array.from(thriving.nodePosition));
    // Never smaller: the measured tree is the same, only outer clumps and accents rest.
    expect(dormant.stats).toEqual(thriving.stats);
    const hidden = tree.clumps.filter((clump) => clump.hideBelow >= 0);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.length).toBeLessThanOrEqual(tree.clumps.length * 0.35);
    // The core, the first clump to be born, is never among them.
    expect(tree.clumps[0]?.hideBelow).toBe(-1);
  });
});

describe('subjectFrame', () => {
  it.each(SPECIES)('is monotonic and always contains the %s it frames', (species) => {
    const cos = Math.cos(CAMERA.pitch);
    const sin = Math.sin(CAMERA.pitch);
    for (const seed of SEEDS) {
      const tree = generateTree(seed, species);
      const pose = createPose(tree);
      let previous = subjectFrame(tree.metrics, 0, CAMERA.pitch);
      for (let step = 0; step <= 100; step += 1) {
        const growth = step / 100;
        poseTree(tree, growth, pose);
        const frame = subjectFrame(tree.metrics, growth, CAMERA.pitch);
        expect(frame.top).toBeGreaterThanOrEqual(previous.top);
        expect(frame.halfWidth).toBeGreaterThanOrEqual(previous.halfWidth);
        expect(frame.bottom).toBe(previous.bottom);
        // Screen-space extent of the live tree: its height, plus what its depth adds from above.
        const top = (TREE_BASE + pose.stats.top) * cos + pose.stats.halfWidth * 0.35 * sin;
        expect(frame.top).toBeGreaterThanOrEqual(top);
        expect(frame.halfWidth).toBeGreaterThanOrEqual(pose.stats.halfWidth);
        previous = frame;
      }
    }
  });
});

describe('buildIsland', () => {
  it('is deterministic from the seed', () => {
    const a = buildIsland(9, 30);
    expect(a.normals.length).toBe(a.positions.length);
    expect(a.ticks.length).toBe(13 * 6 * 3);
    const b = buildIsland(9, 30);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(a.rocks).toEqual(b.rocks);
    expect(a.positions.length).toBe(a.triangles * 9);
    expect(buildIsland(10, 30).rocks).not.toEqual(a.rocks);
  });
});
