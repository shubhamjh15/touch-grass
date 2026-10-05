import { clamp01, lerp } from '@/lib/math';
import { createRng, type Rng } from '@/lib/rng';
import { VITALITY } from '../config';
import type { Species } from '../contract';
import { branchPhaseAt, trunkGrowthAt } from './curves';
import { solveFrameEase } from './frame';
import { createPose, poseTree } from './pose';
import { CHERRY, OAK, PINE, WOOD } from './species';
import type { Accent, AccentKind, Branch, Clump, ClumpShape, Quat, Skeleton, Vec3 } from './types';
import {
  add,
  cross,
  direction,
  dot,
  mix,
  normalize,
  quatFromAxisAngle,
  quatMultiply,
  scale,
  sub,
} from './vec';

/**
 * Bump when the generator changes shape, so nobody's saved tree silently mutates:
 * the version is part of every random stream.
 */
export const GEN_VERSION = 1;

type Range = readonly [number, number];
const within = (rng: Rng, range: Range) => lerp(range[0], range[1], rng());
const TAU = Math.PI * 2;

interface Draft {
  parent: number;
  level: number;
  attachLength: number;
  points: Vec3[];
  cumulative: number[];
  t0: number;
  t1: number;
  tipLoad: number;
  taper: number;
  buried: number;
}

interface BranchSpec {
  parent: number;
  attachLength: number;
  azimuth: number;
  elevation: number;
  /** Elevation the branch bends towards by its tip. */
  lift: number;
  bend: number;
  length: number;
  steps: number;
  wobble: number;
  delay: number;
  duration: number;
  /** Fixed start of the growth window, for late branches that ignore the parent's tip. */
  from?: number;
}

/** Collects branches, clumps and accents, then freezes them into a {@link Skeleton}. */
class Builder {
  readonly drafts: Draft[] = [];
  readonly clumps: Clump[] = [];
  readonly accents: Accent[] = [];

  constructor(
    readonly species: Species,
    readonly seed: number,
    readonly shape: ClumpShape,
  ) {}

  stream(name: string): Rng {
    return createRng(this.seed, this.species, GEN_VERSION, name);
  }

  private push(draft: Omit<Draft, 'cumulative'>): number {
    const cumulative = [0];
    for (let i = 1; i < draft.points.length; i += 1) {
      const a = draft.points[i - 1] as Vec3;
      const b = draft.points[i] as Vec3;
      cumulative.push(
        (cumulative[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
      );
    }
    this.drafts.push({ ...draft, cumulative });
    return this.drafts.length - 1;
  }

  lengthOf(branch: number): number {
    return (this.drafts[branch] as Draft).cumulative.at(-1) ?? 0;
  }

  pointAt(branch: number, distance: number): Vec3 {
    const { points, cumulative } = this.drafts[branch] as Draft;
    const last = points.length - 1;
    if (distance <= 0) return points[0] as Vec3;
    for (let i = 1; i <= last; i += 1) {
      const end = cumulative[i] as number;
      if (distance <= end) {
        const start = cumulative[i - 1] as number;
        return mix(points[i - 1] as Vec3, points[i] as Vec3, (distance - start) / (end - start));
      }
    }
    return points[last] as Vec3;
  }

  /** Distance along the trunk at which it reaches height `y`. */
  trunkLengthAt(y: number): number {
    const { points, cumulative } = this.drafts[0] as Draft;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1] as Vec3;
      const b = points[i] as Vec3;
      if (y <= b[1]) {
        const t = clamp01((y - a[1]) / Math.max(1e-6, b[1] - a[1]));
        return lerp(cumulative[i - 1] as number, cumulative[i] as number, t);
      }
    }
    return cumulative.at(-1) ?? 0;
  }

  /** Growth at which the tip of `branch` has travelled `distance`. */
  reaches(branch: number, distance: number): number {
    const draft = this.drafts[branch] as Draft;
    const total = draft.cumulative.at(-1) ?? 1;
    if (branch === 0) {
      const share = (distance - draft.buried) / (total - draft.buried);
      return trunkGrowthAt(share);
    }
    return draft.t0 + (draft.t1 - draft.t0) * branchPhaseAt(distance / total);
  }

  trunk(points: Vec3[], tipLoad: number): number {
    return this.push({
      parent: -1,
      level: 0,
      attachLength: 0,
      points,
      t0: 0,
      t1: 1,
      tipLoad,
      taper: WOOD.trunkTaper,
      buried: WOOD.buried,
    });
  }

  branch(spec: BranchSpec, rng: Rng): number {
    const parent = this.drafts[spec.parent] as Draft;
    const start = this.pointAt(spec.parent, spec.attachLength);
    const from = direction(spec.azimuth, spec.elevation);
    const to = direction(spec.azimuth, spec.lift);
    const points: Vec3[] = [start];
    let cursor = start;
    for (let i = 1; i <= spec.steps; i += 1) {
      const t = i / spec.steps;
      const jitter: Vec3 = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
      const heading = normalize(add(mix(from, to, spec.bend * t), scale(jitter, spec.wobble)));
      cursor = add(cursor, scale(heading, spec.length / spec.steps));
      points.push(cursor);
    }
    const t0 = spec.from ?? this.reaches(spec.parent, spec.attachLength) + spec.delay;
    return this.push({
      parent: spec.parent,
      level: parent.level + 1,
      attachLength: spec.attachLength,
      points,
      t0,
      t1: Math.min(0.97, t0 + spec.duration),
      tipLoad: 0.04,
      taper: WOOD.branchTaper,
      buried: 0,
    });
  }

  /** Adds a clump riding the tip of `branch`; its weight thickens the wood that carries it. */
  clump(
    branch: number,
    clump: Omit<
      Clump,
      'branch' | 'station' | 'birth' | 'bloom' | 'alt' | 'rotation' | 'hideBelow'
    > &
      Partial<Pick<Clump, 'station' | 'birth' | 'bloom' | 'alt' | 'rotation'>>,
  ): number {
    const draft = this.drafts[branch] as Draft;
    draft.tipLoad += ((clump.size[0] + clump.size[2]) / 2) ** 2;
    this.clumps.push({
      branch,
      station: this.lengthOf(branch),
      birth: draft.t0 + 0.012,
      bloom: 2,
      hideBelow: -1,
      alt: false,
      rotation: [0, 0, 0, 1],
      ...clump,
    });
    return this.clumps.length - 1;
  }

  accent(accent: Accent): void {
    this.accents.push(accent);
  }

  /** Leaves or blossoms spread over the outward-facing side of a clump. */
  scatter(
    clumpIndex: number,
    count: number,
    kind: AccentKind,
    size: Range,
    outward: Vec3,
    rng: Rng,
    earliest = 0,
  ): void {
    const clump = this.clumps[clumpIndex] as Clump;
    const first = Math.max(clump.birth + 0.05, earliest);
    for (let i = 0; i < count; i += 1) {
      const jitter: Vec3 = [rng() * 2 - 1, rng() * 1.6 - 0.5, rng() * 2 - 1];
      const dir = normalize(add(add(outward, [0, 0.45, 0]), scale(jitter, 0.4)));
      this.accent({
        clump: clumpIndex,
        direction: [dir[0], Math.max(dir[1], -0.25), dir[2]],
        size: within(rng, size),
        roll: rng() * TAU,
        birth: lerp(first, 0.985, rng() ** 1.2),
        kind,
        rank: rng(),
        hideBelow: 0.12 + 0.55 * rng(),
      });
    }
  }

  /** The two seed leaves of a sprout. They ride the trunk tip, then the first clump. */
  cotyledons(clumpIndex: number, rng: Rng): void {
    const turn = (rng() - 0.5) * 0.9;
    for (const side of [-1, 1]) {
      const dir = normalize([side * 0.8 * Math.cos(turn), 0.62, side * 0.8 * Math.sin(turn)]);
      this.accent({
        clump: clumpIndex,
        direction: dir,
        size: 0.3 + rng() * 0.05,
        roll: side > 0 ? 0 : Math.PI,
        birth: 0.004,
        kind: 'leaf',
        rank: 0,
        hideBelow: -1,
      });
    }
  }

  finish(baseRadius: number, pipeExponent: number, flare: number): Skeleton {
    const { drafts } = this;
    const nodeTotal = drafts.reduce((sum, draft) => sum + draft.points.length, 0);
    const nodePosition = new Float32Array(nodeTotal * 3);
    const nodeLength = new Float32Array(nodeTotal);
    const nodeFrame = new Float32Array(nodeTotal * 6);
    const nodeSway = new Float32Array(nodeTotal * 3);
    const nodeFlare = new Float32Array(nodeTotal).fill(1);
    const branches: Branch[] = [];
    const phase = this.stream('sway');

    const trunk = drafts[0] as Draft;
    const treeHeight = (trunk.points.at(-1) as Vec3)[1];
    // Path length from the trunk to every branch base, to weight the branch bob.
    const reach: number[] = [];
    drafts.forEach((draft, index) => {
      reach[index] = draft.parent <= 0 ? 0 : (reach[draft.parent] as number) + draft.attachLength;
    });
    const longest = Math.max(
      1e-6,
      ...drafts.map((draft, index) =>
        index === 0 ? 0 : (reach[index] as number) + (draft.cumulative.at(-1) ?? 0),
      ),
    );

    let cursor = 0;
    drafts.forEach((draft, index) => {
      const count = draft.points.length;
      const branchPhase = phase();
      const anchorHeight = index === 0 ? 0 : (draft.points[0] as Vec3)[1];
      let normal: Vec3 = [1, 0, 0];
      for (let i = 0; i < count; i += 1) {
        const node = cursor + i;
        const point = draft.points[i] as Vec3;
        nodePosition.set(point, node * 3);
        nodeLength[node] = draft.cumulative[i] as number;

        // Parallel transport keeps the ring orientation steady along the branch (no twist).
        const before = draft.points[Math.max(0, i - 1)] as Vec3;
        const after = draft.points[Math.min(count - 1, i + 1)] as Vec3;
        const tangent = normalize(sub(after, before));
        if (i === 0) {
          const helper: Vec3 = Math.abs(tangent[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
          normal = normalize(cross(helper, tangent));
        } else {
          normal = normalize(sub(normal, scale(tangent, dot(normal, tangent))));
        }
        const binormal = cross(tangent, normal);
        nodeFrame.set(normal, node * 6);
        nodeFrame.set(binormal, node * 6 + 3);

        const height = index === 0 ? point[1] : anchorHeight;
        nodeSway[node * 3] = clamp01(height / treeHeight) ** 1.5;
        nodeSway[node * 3 + 1] =
          index === 0 ? 0 : ((reach[index] as number) + (draft.cumulative[i] as number)) / longest;
        nodeSway[node * 3 + 2] = branchPhase;
        if (index === 0) nodeFlare[node] = 1 + flare * Math.exp(-Math.max(point[1], -0.1) / 0.32);
      }
      branches.push({
        parent: draft.parent,
        level: draft.level,
        attachLength: draft.attachLength,
        nodeStart: cursor,
        nodeCount: count,
        length: draft.cumulative.at(-1) ?? 0,
        buried: draft.buried,
        t0: draft.t0,
        t1: draft.t1,
        tipLoad: draft.tipLoad,
        taper: draft.taper,
      });
      cursor += count;
    });

    // Birth order: whatever is alive at a given growth is a prefix of each list.
    // A resting tree looks sparse: some outer clumps (never the core, the crown or a
    // main limb's) are marked to be hidden as vitality runs out.
    const rest = this.stream('rest');
    const outer = this.clumps
      .filter((clump) => {
        const draft = drafts[clump.branch] as Draft;
        return draft.level >= 2 || (draft.level === 1 && draft.t0 >= 0.75);
      })
      .map((clump) => ({ clump, order: rest() }))
      .sort((a, b) => a.order - b.order);
    const quota = Math.floor(this.clumps.length * VITALITY.dormantHidden);
    for (const { clump } of outer.slice(0, quota)) clump.hideBelow = lerp(0.06, 0.4, rest());

    const clumpOrder = this.clumps.map((_, index) => index);
    clumpOrder.sort(
      (a, b) => (this.clumps[a] as Clump).birth - (this.clumps[b] as Clump).birth || a - b,
    );
    const clumpSlot: number[] = [];
    clumpOrder.forEach((from, to) => {
      clumpSlot[from] = to;
    });
    const clumps = clumpOrder.map((index) => this.clumps[index] as Clump);
    const accents = this.accents
      .map((accent) => ({ ...accent, clump: clumpSlot[accent.clump] as number }))
      .sort((a, b) => a.birth - b.birth || a.rank - b.rank);

    const skeleton: Skeleton = {
      species: this.species,
      seed: this.seed,
      shape: this.shape,
      branches,
      nodePosition,
      nodeLength,
      nodeFrame,
      nodeSway,
      nodeFlare,
      clumps,
      accents,
      pipeExponent,
      radiusScale: 1,
      minRadius: WOOD.minRadius,
      metrics: {
        top: 0,
        halfWidth: 0,
        trunkLength: trunk.cumulative.at(-1) ?? 0,
        baseRadius,
        frameEase: 1,
      },
    };

    // Solve the load-to-radius factor so the full-grown trunk has the designed girth.
    const pose = createPose(skeleton);
    poseTree(skeleton, 1, pose);
    const groundNode = 1;
    const unscaled = (pose.nodeRadius[groundNode] as number) / (nodeFlare[groundNode] as number);
    skeleton.radiusScale = baseRadius / Math.max(1e-6, unscaled);
    poseTree(skeleton, 1, pose);
    skeleton.metrics.top = pose.stats.top;
    skeleton.metrics.halfWidth = pose.stats.halfWidth;
    skeleton.metrics.frameEase = solveFrameEase(skeleton.metrics, (growth) => {
      poseTree(skeleton, growth, pose);
      return pose.stats;
    });
    return skeleton;
  }
}

/** A near-vertical polyline from below the grass to `height`, drifting by `offset(y)`. */
function trunkPoints(
  height: number,
  nodes: number,
  offset: (y: number) => [number, number],
): Vec3[] {
  const points: Vec3[] = [[0, -WOOD.buried, 0]];
  for (let i = 0; i < nodes - 1; i += 1) {
    const y = (height * i) / (nodes - 2);
    const [x, z] = offset(y);
    points.push([x, y, z]);
  }
  return points;
}

const upright = (rng: Rng, tilt: number): Quat =>
  quatMultiply(
    quatFromAxisAngle([0, 1, 0], rng() * TAU),
    quatFromAxisAngle(normalize([rng() - 0.5, 0, rng() - 0.5]), tilt * rng()),
  );

/** Evenly spread azimuths with a little jitter: reads designed from every side. */
function ring(count: number, start: number, jitter: number, rng: Rng): number[] {
  return Array.from(
    { length: count },
    (_, i) => start + (i / count) * TAU + (rng() - 0.5) * jitter,
  );
}

/** `count` values across a range in shuffled order, so heights interleave around the trunk. */
function staggered(count: number, range: Range, rng: Rng): number[] {
  const slots = Array.from({ length: count }, (_, i) => (count === 1 ? 0.5 : i / (count - 1)));
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j] as number, slots[i] as number];
  }
  return slots.map((slot) => lerp(range[0], range[1], slot));
}

const flatOutward = (azimuth: number, rise: number): Vec3 =>
  normalize([Math.cos(azimuth), rise, Math.sin(azimuth)]);

function growOak(seed: number): Skeleton {
  const p = OAK;
  const b = new Builder('oak', seed, 'blob');
  const wood = b.stream('wood');
  const leaf = b.stream('leaves');
  const drift = [wood() * TAU, wood() * TAU];
  const ramp = (y: number) => clamp01(y / 1.5) ** 2;
  b.trunk(
    trunkPoints(p.trunkHeight, p.trunkNodes, (y) => [
      p.wander * Math.sin(y * 0.9 + (drift[0] as number)) * ramp(y),
      p.wander * Math.sin(y * 0.7 + (drift[1] as number)) * ramp(y),
    ]),
    0,
  );

  const core = b.clump(0, {
    station: b.trunkLengthAt(p.core.height),
    offset: [0, 0.12, 0],
    size: [p.core.radius, p.core.radius * p.core.squash, p.core.radius],
    rotation: upright(wood, 0.1),
    variant: 0,
    birth: p.core.birth,
    startScale: p.core.startScale,
  });
  b.cotyledons(core, leaf);

  const crown = b.clump(0, {
    offset: [0, 0.3, 0],
    size: [p.crown.radius, p.crown.radius * 0.95, p.crown.radius],
    rotation: upright(wood, 0.15),
    variant: 2,
    birth: b.reaches(0, b.trunkLengthAt(p.crown.height)),
    startScale: p.crown.startScale,
  });
  b.scatter(crown, 2, 'leaf', p.leaves.size, [0, 1, 0], leaf);

  const start = wood() * TAU;
  const lowerAz = ring(p.lower.count, start, 0.45, wood);
  const lowerY = staggered(p.lower.count, p.lower.attach, wood);
  lowerAz.forEach((azimuth, i) => {
    const limb = b.branch(
      {
        parent: 0,
        attachLength: b.trunkLengthAt(lowerY[i] as number),
        azimuth,
        elevation: within(wood, p.lower.elevation),
        lift: p.lower.lift,
        bend: p.lower.bend,
        length: within(wood, p.lower.length),
        steps: 5,
        wobble: 0.14,
        delay: 0.008,
        duration: p.lower.duration,
      },
      wood,
    );
    const radius = within(wood, p.lower.radius);
    const out = flatOutward(azimuth, 0.35);
    const clump = b.clump(limb, {
      offset: scale(out, radius * 0.22),
      size: [radius, radius * 0.93, radius],
      rotation: upright(wood, 0.2),
      variant: i % 3,
      startScale: 0.3,
    });
    b.scatter(clump, Math.round(within(leaf, p.leaves.perClump)), 'leaf', p.leaves.size, out, leaf);

    // A side twig fills the gap to the next limb: ten lobes around instead of five.
    const side = p.lower.side;
    const swing = (i % 2 === 0 ? 1 : -1) * within(wood, side.swing);
    const twig = b.branch(
      {
        parent: limb,
        attachLength: b.lengthOf(limb) * within(wood, side.at),
        azimuth: azimuth + swing,
        elevation: within(wood, side.elevation),
        lift: deg(50),
        bend: 0.4,
        length: within(wood, side.length),
        steps: 3,
        wobble: 0.1,
        delay: 0.02,
        duration: side.duration,
      },
      wood,
    );
    const small = within(wood, side.radius);
    const sideOut = flatOutward(azimuth + swing, 0.3);
    const ear = b.clump(twig, {
      offset: scale(sideOut, small * 0.2),
      size: [small, small * 0.95, small],
      rotation: upright(wood, 0.2),
      variant: (i + 1) % 3,
      startScale: 0.35,
    });
    b.scatter(
      ear,
      Math.round(within(leaf, p.leaves.perClump)),
      'leaf',
      p.leaves.size,
      sideOut,
      leaf,
    );
  });

  const upperAz = ring(p.upper.count, start + Math.PI / p.upper.count, 0.4, wood);
  const upperY = staggered(p.upper.count, p.upper.attach, wood);
  upperAz.forEach((azimuth, i) => {
    const limb = b.branch(
      {
        parent: 0,
        attachLength: b.trunkLengthAt(upperY[i] as number),
        azimuth,
        elevation: within(wood, p.upper.elevation),
        lift: p.upper.lift,
        bend: p.upper.bend,
        length: within(wood, p.upper.length),
        steps: 4,
        wobble: 0.12,
        delay: 0.008,
        duration: p.upper.duration,
      },
      wood,
    );
    const radius = within(wood, p.upper.radius);
    const out = flatOutward(azimuth, 0.9);
    const clump = b.clump(limb, {
      offset: scale(out, radius * 0.2),
      size: [radius, radius * 0.94, radius],
      rotation: upright(wood, 0.2),
      variant: (i + 2) % 3,
      startScale: 0.32,
    });
    b.scatter(clump, Math.round(within(leaf, p.leaves.perClump)), 'leaf', p.leaves.size, out, leaf);
  });

  const lateAz = ring(p.late.count, start + 0.9, 0.5, wood);
  const lateY = staggered(p.late.count, p.late.attach, wood);
  lateAz.forEach((azimuth, i) => {
    const twig = b.branch(
      {
        parent: 0,
        attachLength: b.trunkLengthAt(lateY[i] as number),
        azimuth,
        elevation: within(wood, p.late.elevation),
        lift: p.late.lift,
        bend: 0.4,
        length: within(wood, p.late.length),
        steps: 3,
        wobble: 0.1,
        delay: 0,
        duration: p.late.duration,
        from: p.late.from + i * p.late.step,
      },
      wood,
    );
    const radius = within(wood, p.late.radius);
    const out = flatOutward(azimuth, 0.7);
    const clump = b.clump(twig, {
      offset: scale(out, radius * 0.3),
      size: [radius, radius * 0.95, radius],
      rotation: upright(wood, 0.2),
      variant: i % 3,
      startScale: 0.5,
    });
    b.scatter(clump, 3, 'leaf', p.leaves.size, out, leaf);
  });

  return b.finish(p.baseRadius, p.pipeExponent, p.flare);
}

function growCherry(seed: number): Skeleton {
  const p = CHERRY;
  const b = new Builder('cherry', seed, 'blob');
  const wood = b.stream('wood');
  const leaf = b.stream('leaves');
  const petals = b.stream('blossom');

  // The lean is mostly sideways to the default view, so the S-curve reads.
  const leanAz = (wood() < 0.5 ? 0 : Math.PI) + (wood() - 0.5) * 0.9;
  const smooth = (a: number, c: number, y: number) => {
    const t = clamp01((y - a) / (c - a));
    return t * t * (3 - 2 * t);
  };
  b.trunk(
    trunkPoints(p.trunkHeight, p.trunkNodes, (y) => {
      const reach = p.lean * smooth(0.15, 1.9, y) - p.leanBack * smooth(1.5, p.trunkHeight, y);
      return [Math.cos(leanAz) * reach, Math.sin(leanAz) * reach];
    }),
    0,
  );

  let made = 0;
  const flat = (radius: number): Vec3 => [
    radius * p.stretch,
    radius * p.squash,
    radius * p.stretch,
  ];
  const dress = (clumpIndex: number, out: Vec3) => {
    const clump = b.clumps[clumpIndex] as Clump;
    made += 1;
    if (made % p.greenEvery === 0) {
      clump.alt = true;
      b.scatter(clumpIndex, 3, 'leaf', p.leaves.size, out, leaf);
      return;
    }
    clump.bloom = Math.max(within(petals, p.bloom), clump.birth + 0.02);
    b.scatter(
      clumpIndex,
      Math.round(within(petals, p.blossoms.perClump)),
      'blossom',
      p.blossoms.size,
      out,
      petals,
      clump.bloom + 0.02,
    );
    b.scatter(
      clumpIndex,
      Math.round(within(leaf, p.leaves.perClump)),
      'leaf',
      p.leaves.size,
      out,
      leaf,
    );
  };

  const core = b.clump(0, {
    station: b.trunkLengthAt(p.core.height),
    offset: [0, 0.1, 0],
    size: flat(p.core.radius),
    rotation: upright(wood, 0.08),
    variant: 0,
    birth: p.core.birth,
    startScale: p.core.startScale,
  });
  b.cotyledons(core, leaf);
  dress(core, [0, 1, 0]);

  const start = leanAz + Math.PI / 4;
  const limbAz = ring(p.limbs.count, start, 0.5, wood);
  const limbY = staggered(p.limbs.count, p.limbs.attach, wood);
  limbAz.forEach((azimuth, i) => {
    const limb = b.branch(
      {
        parent: 0,
        attachLength: b.trunkLengthAt(limbY[i] as number),
        azimuth,
        elevation: within(wood, p.limbs.elevation),
        lift: p.limbs.lift,
        bend: p.limbs.bend,
        length: within(wood, p.limbs.length),
        steps: 6,
        wobble: 0.16,
        delay: 0.008,
        duration: p.limbs.duration,
      },
      wood,
    );
    const radius = within(wood, p.limbs.radius);
    const out = flatOutward(azimuth, 0.25);
    dress(
      b.clump(limb, {
        offset: scale(out, radius * 0.25),
        size: flat(radius),
        rotation: upright(wood, 0.14),
        variant: i % 3,
        startScale: 0.3,
      }),
      out,
    );

    const rise = p.limbs.rise;
    const riser = b.branch(
      {
        parent: limb,
        attachLength: b.lengthOf(limb) * rise.at,
        azimuth: azimuth + (wood() - 0.5) * 0.8,
        elevation: within(wood, rise.elevation),
        lift: deg(80),
        bend: 0.4,
        length: within(wood, rise.length),
        steps: 3,
        wobble: 0.12,
        delay: 0.02,
        duration: p.limbs.sideDuration,
      },
      wood,
    );
    const riseRadius = within(wood, rise.radius);
    dress(
      b.clump(riser, {
        offset: [0, riseRadius * 0.2, 0],
        size: flat(riseRadius),
        rotation: upright(wood, 0.14),
        variant: (i + 1) % 3,
        startScale: 0.35,
      }),
      [0, 1, 0],
    );

    const reach = p.limbs.reach;
    const swing = (i % 2 === 0 ? 1 : -1) * within(wood, reach.swing);
    const arm = b.branch(
      {
        parent: limb,
        attachLength: b.lengthOf(limb) * reach.at,
        azimuth: azimuth + swing,
        elevation: within(wood, reach.elevation),
        lift: deg(10),
        bend: 0.5,
        length: within(wood, reach.length),
        steps: 3,
        wobble: 0.12,
        delay: 0.03,
        duration: p.limbs.sideDuration,
      },
      wood,
    );
    const armRadius = within(wood, reach.radius);
    const armOut = flatOutward(azimuth + swing, 0.15);
    dress(
      b.clump(arm, {
        offset: scale(armOut, armRadius * 0.25),
        size: flat(armRadius),
        rotation: upright(wood, 0.14),
        variant: (i + 2) % 3,
        startScale: 0.35,
      }),
      armOut,
    );
  });

  const lateAz = ring(p.late.count, start + 0.7, 0.6, wood);
  const lateY = staggered(p.late.count, p.late.attach, wood);
  lateAz.forEach((azimuth, i) => {
    const twig = b.branch(
      {
        parent: 0,
        attachLength: b.trunkLengthAt(lateY[i] as number),
        azimuth,
        elevation: within(wood, p.late.elevation),
        lift: p.late.lift,
        bend: 0.4,
        length: within(wood, p.late.length),
        steps: 3,
        wobble: 0.1,
        delay: 0,
        duration: p.late.duration,
        from: p.late.from + i * p.late.step,
      },
      wood,
    );
    const radius = within(wood, p.late.radius);
    const out = flatOutward(azimuth, 0.8);
    dress(
      b.clump(twig, {
        offset: scale(out, radius * 0.3),
        size: flat(radius),
        rotation: upright(wood, 0.14),
        variant: i % 3,
        startScale: 0.5,
      }),
      out,
    );
  });

  return b.finish(p.baseRadius, p.pipeExponent, p.flare);
}

function growPine(seed: number): Skeleton {
  const p = PINE;
  const b = new Builder('pine', seed, 'tier');
  const wood = b.stream('wood');
  const leaf = b.stream('leaves');
  const drift = [wood() * TAU, wood() * TAU];
  b.trunk(
    trunkPoints(p.trunkHeight, p.trunkNodes, (y) => [
      p.wander * Math.sin(y * 1.3 + (drift[0] as number)) * clamp01(y),
      p.wander * Math.sin(y * 1.1 + (drift[1] as number)) * clamp01(y),
    ]),
    0.2,
  );

  const { tiers } = p;
  const total = b.lengthOf(0);
  for (let i = tiers.count - 1; i >= 0; i -= 1) {
    const t = i / Math.max(1, tiers.count - 1);
    const height = lerp(tiers.height[0], tiers.height[1], t);
    const radius = lerp(tiers.radius[0], tiers.radius[1], t);
    const base = tiers.firstBase + i * tiers.spacing;
    const top = i === tiers.count - 1;
    const turn = quatFromAxisAngle([0, 1, 0], wood() * TAU);
    const index = b.clump(0, {
      // The top tier rides the tip (its apex caps the mast); the others wait at their whorl.
      station: top ? total : b.trunkLengthAt(base),
      offset: top ? [0, -(p.trunkHeight - base), 0] : [0, 0, 0],
      size: [radius, height, radius],
      rotation: turn,
      variant: i % 3,
      birth: top ? tiers.topBirth : b.reaches(0, b.trunkLengthAt(base + height * tiers.birthLead)),
      startScale: tiers.startScale,
    });
    if (top) b.cotyledons(index, leaf);
    const tufts = Math.round(within(leaf, p.tufts.perTier));
    const clump = b.clumps[index] as Clump;
    for (let k = 0; k < tufts; k += 1) {
      const azimuth = leaf() * TAU;
      b.accent({
        clump: index,
        direction: [Math.cos(azimuth), 0.04, Math.sin(azimuth)],
        size: within(leaf, p.tufts.size),
        roll: leaf() * TAU,
        birth: lerp(clump.birth + 0.06, 0.985, leaf()),
        kind: 'leaf',
        rank: leaf(),
        hideBelow: 0.12 + 0.55 * leaf(),
      });
    }
  }

  return b.finish(p.baseRadius, p.pipeExponent, p.flare);
}

function deg(value: number): number {
  return (value * Math.PI) / 180;
}

/**
 * Generates the full-grown tree for a user. Deterministic: the same seed and species
 * always give the identical skeleton, on every device and every visit.
 */
export function generateTree(seed: number, species: Species): Skeleton {
  switch (species) {
    case 'oak':
      return growOak(seed);
    case 'cherry':
      return growCherry(seed);
    case 'pine':
      return growPine(seed);
  }
}
