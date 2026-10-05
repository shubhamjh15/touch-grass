import { clamp01 } from '@/lib/math';
import {
  ACCENT_POP_SPAN,
  CLUMP_POP_SPAN,
  accentScale,
  branchProgress,
  clumpScale,
  popBump,
  ringFactor,
  bloomShare,
  vitalityShare,
  tipLoadShare,
  tipTaper,
  trunkProgress,
} from './curves';
import type { Pose, PoseOptions, Quat, Skeleton, Vec3 } from './types';
import {
  composeInto,
  normalize,
  quatBetween,
  quatFromAxisAngle,
  quatMultiply,
  rotate,
} from './vec';

/** Allocates the buffers a skeleton needs once; `poseTree` then only overwrites them. */
export function createPose(skeleton: Skeleton): Pose {
  const nodes = skeleton.nodeLength.length;
  return {
    growth: -1,
    nodePosition: new Float32Array(nodes * 3),
    nodeRadius: new Float32Array(nodes),
    tipLength: new Float32Array(skeleton.branches.length),
    clumpMatrix: new Float32Array(Math.max(1, skeleton.clumps.length) * 16),
    clumpScale: new Float32Array(Math.max(1, skeleton.clumps.length)),
    clumpBloom: new Float32Array(Math.max(1, skeleton.clumps.length)),
    clumpCount: 0,
    accentMatrix: new Float32Array(Math.max(1, skeleton.accents.length) * 16),
    accentSlots: 0,
    accentCount: 0,
    stats: {
      woodLength: 0,
      leafCount: 0,
      clumpCount: 0,
      foliage: 0,
      trunkRadius: 0,
      top: 0,
      halfWidth: 0,
    },
  };
}

const UP: Vec3 = [0, 1, 0];
const FRONT: Vec3 = [0, 0, 1];
const scratch: Vec3 = [0, 0, 0];

/** Point on a branch `distance` along its final polyline, written to `scratch`. */
function pointAlong(skeleton: Skeleton, branchIndex: number, distance: number): Vec3 {
  const branch = skeleton.branches[branchIndex];
  if (!branch) return scratch;
  const { nodePosition, nodeLength } = skeleton;
  const first = branch.nodeStart;
  const last = first + branch.nodeCount - 1;
  let node = first;
  while (node < last && (nodeLength[node + 1] as number) < distance) node += 1;
  const next = Math.min(last, node + 1);
  const from = nodeLength[node] as number;
  const span = (nodeLength[next] as number) - from;
  const t = span > 1e-9 ? clamp01((distance - from) / span) : 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const a = nodePosition[node * 3 + axis] as number;
    const b = nodePosition[next * 3 + axis] as number;
    scratch[axis] = a + (b - a) * t;
  }
  return scratch;
}

/**
 * Reveals a skeleton up to `growth` (0..1). The single source of truth for what the
 * tree looks like at a given growth: the scene uploads these buffers, the framing and
 * the tests read the stats.
 *
 * Monotonic by construction: wood only extends and thickens, clumps and accents only
 * appear and swell. `options.pop` and `options.vitality` are render-time dressing and
 * are left at their defaults by anything that measures growth.
 */
export function poseTree(
  skeleton: Skeleton,
  growthInput: number,
  pose: Pose,
  options: PoseOptions = {},
): Pose {
  const growth = clamp01(growthInput);
  const pop = options.pop ?? 0;
  const vitality = options.vitality ?? 1;
  const share = options.accentShare ?? 1;
  const ring = ringFactor(options.ageDays ?? 0);
  const { branches, nodePosition, nodeLength, nodeFlare, clumps, accents } = skeleton;
  const { tipLength, nodeRadius, stats } = pose;
  const exponent = 1 / skeleton.pipeExponent;

  // 1. How far every tip has travelled.
  let woodLength = 0;
  for (let i = 0; i < branches.length; i += 1) {
    const branch = branches[i];
    if (!branch) continue;
    if (branch.parent < 0) {
      const progress = trunkProgress(growth);
      tipLength[i] = branch.buried + (branch.length - branch.buried) * progress;
    } else {
      const phase = (growth - branch.t0) / Math.max(1e-6, branch.t1 - branch.t0);
      tipLength[i] = growth <= branch.t0 ? 0 : branch.length * branchProgress(phase);
    }
    woodLength += Math.max(0, (tipLength[i] as number) - branch.buried);
  }

  // 2. Pipe model: every node carries the load of all the living tips above it.
  //    Children come after their parents, so one reverse sweep accumulates the loads.
  nodeRadius.fill(0);
  for (let i = branches.length - 1; i >= 0; i -= 1) {
    const branch = branches[i];
    if (!branch) continue;
    const extended = (tipLength[i] as number) / branch.length;
    const own = branch.tipLoad * tipLoadShare(growth, branch.t0, extended);
    let atBase = 0;
    for (let n = 0; n < branch.nodeCount; n += 1) {
      const node = branch.nodeStart + n;
      nodeRadius[node] = (nodeRadius[node] as number) + own;
      if (n === 0) atBase = nodeRadius[node] as number;
    }
    const parent = branches[branch.parent];
    if (!parent || atBase <= 0) continue;
    for (let n = 0; n < parent.nodeCount; n += 1) {
      const node = parent.nodeStart + n;
      if ((nodeLength[node] as number) > branch.attachLength + 1e-6) break;
      nodeRadius[node] = (nodeRadius[node] as number) + atBase;
    }
  }

  // 3. Node positions and radii. Unborn nodes collapse onto the tip (degenerate rings).
  let trunkRadius = 0;
  let top = 0;
  for (let i = 0; i < branches.length; i += 1) {
    const branch = branches[i];
    if (!branch) continue;
    const reach = tipLength[i] as number;
    const tip = pointAlong(skeleton, i, reach);
    const tipX = tip[0];
    const tipY = tip[1];
    const tipZ = tip[2];
    if (reach > 0) top = Math.max(top, tipY);
    for (let n = 0; n < branch.nodeCount; n += 1) {
      const node = branch.nodeStart + n;
      const along = nodeLength[node] as number;
      if (along < reach) {
        pose.nodePosition[node * 3] = nodePosition[node * 3] as number;
        pose.nodePosition[node * 3 + 1] = nodePosition[node * 3 + 1] as number;
        pose.nodePosition[node * 3 + 2] = nodePosition[node * 3 + 2] as number;
        const piped = skeleton.radiusScale * (nodeRadius[node] as number) ** exponent;
        nodeRadius[node] =
          Math.max(piped, skeleton.minRadius) *
          (nodeFlare[node] as number) *
          tipTaper(reach - along, branch.taper) *
          ring;
      } else {
        pose.nodePosition[node * 3] = tipX;
        pose.nodePosition[node * 3 + 1] = tipY;
        pose.nodePosition[node * 3 + 2] = tipZ;
        nodeRadius[node] = 0;
      }
    }
    if (i === 0) trunkRadius = nodeRadius[branch.nodeStart + 1] ?? 0;
  }

  // 4. Clumps ride their branch tip until it passes their station.
  const tier = skeleton.shape === 'tier';
  let clumpCount = 0;
  let foliage = 0;
  let halfWidth = 0;
  for (let i = 0; i < clumps.length; i += 1) {
    const clump = clumps[i];
    if (!clump) continue;
    const grown = clumpScale(growth, clump.birth, clump.startScale);
    pose.clumpScale[i] = grown;
    foliage += grown;
    if (grown > 0) clumpCount = i + 1;
    // Pop and rest are dressing: they change what is drawn, never what is measured.
    let size = grown * vitalityShare(vitality, clump.hideBelow);
    if (pop > 0) size *= 1 + pop * popBump(growth, clump.birth, CLUMP_POP_SPAN * 1.6);
    const anchor = pointAlong(
      skeleton,
      clump.branch,
      Math.min(tipLength[clump.branch] as number, clump.station),
    );
    const x = anchor[0] + clump.offset[0] * size;
    const y = anchor[1] + clump.offset[1] * size;
    const z = anchor[2] + clump.offset[2] * size;
    composeInto(
      pose.clumpMatrix,
      i * 16,
      x,
      y,
      z,
      clump.rotation,
      clump.size[0] * size,
      clump.size[1] * size,
      clump.size[2] * size,
    );
    pose.clumpBloom[i] = bloomShare(growth, clump.bloom);
    if (grown > 0) {
      const cx = anchor[0] + clump.offset[0] * grown;
      const cz = anchor[2] + clump.offset[2] * grown;
      top = Math.max(top, anchor[1] + (clump.offset[1] + clump.size[1]) * grown);
      halfWidth = Math.max(
        halfWidth,
        Math.hypot(cx, cz) + Math.max(clump.size[0], clump.size[2]) * grown,
      );
    }
  }

  // 5. Accents sit on the surface of their clump and unfold one by one.
  let slots = 0;
  let accentCount = 0;
  let leafCount = 0;
  for (let i = 0; i < accents.length; i += 1) {
    const accent = accents[i];
    if (!accent) continue;
    const unfolded = accentScale(growth, accent.birth);
    if (unfolded > 0) leafCount += 1;
    if (accent.rank >= share) continue;
    const clump = clumps[accent.clump];
    if (!clump) continue;
    const base = accent.clump * 16;
    const m = pose.clumpMatrix;
    const dir = accent.direction;
    // Local point on the clump surface: a sphere for bubbles, the cone flank for tiers.
    let lx = dir[0] * 0.96;
    let ly = dir[1] * 0.96;
    let lz = dir[2] * 0.96;
    if (tier) {
      const up = clamp01(dir[1]);
      const flat = Math.hypot(dir[0], dir[2]) || 1;
      lx = (dir[0] / flat) * (1 - up) * 0.98;
      ly = up;
      lz = (dir[2] / flat) * (1 - up) * 0.98;
    }
    const px =
      (m[base] as number) * lx +
      (m[base + 4] as number) * ly +
      (m[base + 8] as number) * lz +
      (m[base + 12] as number);
    const py =
      (m[base + 1] as number) * lx +
      (m[base + 5] as number) * ly +
      (m[base + 9] as number) * lz +
      (m[base + 13] as number);
    const pz =
      (m[base + 2] as number) * lx +
      (m[base + 6] as number) * ly +
      (m[base + 10] as number) * lz +
      (m[base + 14] as number);
    const hidden =
      vitalityShare(vitality, accent.hideBelow) * vitalityShare(vitality, clump.hideBelow);
    let size = accent.size * unfolded * hidden;
    if (pop > 0) size *= 1 + pop * 1.5 * popBump(growth, accent.birth, ACCENT_POP_SPAN * 2.2);
    const outward = normalize(rotate(clump.rotation, dir));
    const facing: Quat = quatMultiply(
      quatBetween(accent.kind === 'leaf' ? UP : FRONT, outward),
      quatFromAxisAngle(accent.kind === 'leaf' ? UP : FRONT, accent.roll),
    );
    composeInto(pose.accentMatrix, slots * 16, px, py, pz, facing, size, size, size);
    slots += 1;
    if (unfolded > 0) accentCount = slots;
  }

  pose.growth = growth;
  pose.clumpCount = clumpCount;
  pose.accentSlots = slots;
  pose.accentCount = accentCount;
  stats.woodLength = woodLength;
  stats.leafCount = leafCount;
  stats.clumpCount = clumpCount;
  stats.foliage = foliage;
  stats.trunkRadius = trunkRadius;
  stats.top = top;
  stats.halfWidth = halfWidth;
  return pose;
}
