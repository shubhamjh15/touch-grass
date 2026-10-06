import * as THREE from 'three';
import { smoothstep } from '@/lib/math';
import { createRng } from '@/lib/rng';
import { TREE_SCALE } from '../camera';
import type { QualityTier } from '../config';
import type { Species } from '../contract';
import { generateTree } from '../tree/generate';
import { createPose, poseTree } from '../tree/pose';
import type { Pose, Skeleton } from '../tree/types';
import {
  blossomGeometry,
  leafGeometry,
  needleGeometry,
  puffGeometry,
  seedLeafGeometry,
  tierGeometry,
  woodGeometry,
  writeWood,
  type WoodMesh,
} from './geometry';
import { live, shared } from './live';
import { toyDepthMaterial, toyMaterial } from './materials';
import { SEED, SPECIES_PALETTE, type SpeciesPalette } from './palette';

/**
 * The tree, drawn from the skeleton in `src/world/tree/` (a pure function of seed,
 * species and growth). Five meshes, however old the tree is:
 *
 *   - wood: one tube for the trunk and every branch, its rings moved when growth changes;
 *   - puffs: one instance per foliage clump, the soft body of the crown (cone tiers on
 *     the conifer) and what casts the crown's shadow;
 *   - leaves: hundreds of small cards shingled over the puffs, which is what makes the
 *     crown read as leafy, flutter in the wind, thin out when the tree is dormant and
 *     turn to petals where a cherry is in bloom;
 *   - blossoms: the big five-petal flowers of a cherry;
 *   - the seed it grew from, while it is still a seed.
 *
 * Buffers are rewritten only while growth, vitality or a pulse is moving the pose; a
 * tree at rest costs five draw calls and no CPU, the wind lives in the vertex shader.
 */

/** One ball of a clump's puff: the clump itself, or a smaller one budding from its surface. */
interface Lobe {
  clump: number;
  /** Centre and radius in the clump's own unit space. */
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Brightness of this lobe: the ones on top catch more sky. */
  shade: number;
}

interface ShellLeaf {
  clump: number;
  /** Point on the clump's puff, in the clump's unit space, and the outward direction there. */
  px: number;
  py: number;
  pz: number;
  nx: number;
  ny: number;
  nz: number;
  /** A fixed nudge of the leaf's tip, so no two leaves lie alike. */
  jx: number;
  jy: number;
  jz: number;
  size: number;
  /** 0..1: leaves below a clump's fill level are shown, so a young clump has few. */
  order: number;
  colour: number;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Radius of a cone tier at height `u` (0 hem .. 1 apex): the profile of `tierGeometry`. */
function tierRadius(u: number): number {
  if (u < 0.3) return 1 - (u / 0.3) * 0.2;
  if (u < 0.62) return 0.8 - ((u - 0.3) / 0.32) * 0.34;
  return 0.46 * (1 - (u - 0.62) / 0.38);
}

/**
 * A broadleaf clump is not one ball but a small cumulus: the clump's own sphere with a
 * few smaller ones budding from its upper surface. Conifer tiers stay single.
 */
function buildLobes(skeleton: Skeleton): Lobe[] {
  const rng = createRng(skeleton.seed, skeleton.species, 'lobes', 1);
  const lobes: Lobe[] = [];
  const tier = skeleton.shape === 'tier';
  skeleton.clumps.forEach((clump, index) => {
    lobes.push({ clump: index, x: 0, y: 0, z: 0, radius: 1, shade: 1 });
    if (tier) return;
    const mean = (clump.size[0] + clump.size[1] + clump.size[2]) / 3;
    const buds = mean > 0.8 ? 5 : mean > 0.55 ? 4 : 3;
    const turn = rng() * Math.PI * 2;
    for (let k = 0; k < buds; k += 1) {
      // Spread round the clump, mostly on its upper half.
      const angle = turn + (k / buds) * Math.PI * 2 + (rng() - 0.5) * 0.7;
      const up = -0.15 + rng() * 0.8;
      const flat = Math.sqrt(Math.max(0, 1 - up * up));
      const radius = 0.5 + rng() * 0.2;
      const reach = 0.66 + rng() * 0.12;
      lobes.push({
        clump: index,
        x: Math.cos(angle) * flat * reach,
        y: up * reach,
        z: Math.sin(angle) * flat * reach,
        radius,
        shade: 0.94 + up * 0.14 + rng() * 0.06,
      });
    }
  });
  return lobes;
}

function buildShell(
  skeleton: Skeleton,
  lobes: Lobe[],
  perPuff: number,
  palette: SpeciesPalette,
): ShellLeaf[] {
  const rng = createRng(skeleton.seed, skeleton.species, 'shell', 2);
  const leaves: ShellLeaf[] = [];
  const tier = skeleton.shape === 'tier';
  lobes.forEach((lobe, lobeIndex) => {
    const clump = skeleton.clumps[lobe.clump];
    if (!clump) return;
    const mean = ((clump.size[0] + clump.size[1] + clump.size[2]) / 3) * lobe.radius;
    // Leaves cover area: a ball twice as wide carries four times as many.
    const count = Math.max(6, Math.round(perPuff * mean * mean * (tier ? 1.3 : 1.25)));
    const turn = rng() * Math.PI * 2;
    for (let k = 0; k < count; k += 1) {
      let px: number;
      let py: number;
      let pz: number;
      let nx: number;
      let ny: number;
      let nz: number;
      const jx = (rng() - 0.5) * 2;
      const jy = (rng() - 0.5) * 2;
      const jz = (rng() - 0.5) * 2;
      const size = 0.78 + rng() * 0.5;
      const order = rng();
      const tone = Math.floor(rng() * palette.leaves.length);
      if (tier) {
        const u = rng() ** 1.5 * 0.86;
        const angle = k * GOLDEN + turn;
        const radius = tierRadius(u) * 1.01;
        px = Math.cos(angle) * radius;
        py = u;
        pz = Math.sin(angle) * radius;
        nx = Math.cos(angle);
        ny = 0.5;
        nz = Math.sin(angle);
      } else {
        // An even spiral over the ball, leaving out its underside.
        const y = 1 - ((k + 0.5) / count) * 1.62;
        const flat = Math.sqrt(Math.max(0, 1 - y * y));
        const angle = k * GOLDEN + turn;
        nx = Math.cos(angle) * flat;
        ny = y;
        nz = Math.sin(angle) * flat;
        px = lobe.x + nx * lobe.radius;
        py = lobe.y + ny * lobe.radius;
        pz = lobe.z + nz * lobe.radius;
        // A leaf buried inside a neighbouring ball of the same clump would never be seen.
        const buried = lobes.some(
          (other, otherIndex) =>
            otherIndex !== lobeIndex &&
            other.clump === lobe.clump &&
            Math.hypot(px - other.x, py - other.y, pz - other.z) < other.radius * 0.96,
        );
        if (buried) continue;
      }
      leaves.push({
        clump: lobe.clump,
        px,
        py,
        pz,
        nx,
        ny,
        nz,
        jx,
        jy,
        jz,
        size,
        order,
        colour: tone,
      });
    }
  });
  return leaves;
}

const colour = new THREE.Color();
const LEAF_SIZE: Record<Species, number> = { oak: 0.22, cherry: 0.2, pine: 0.3 };

export class TreeRig {
  readonly group = new THREE.Group();
  readonly skeleton: Skeleton;
  private readonly pose: Pose;
  private readonly palette: SpeciesPalette;
  private readonly wood: WoodMesh;
  private readonly woodMesh: THREE.Mesh;
  private readonly puffs: THREE.InstancedMesh;
  private readonly leaves: THREE.InstancedMesh;
  private readonly blossoms: THREE.InstancedMesh | null;
  private readonly seedLeaves: THREE.InstancedMesh;
  private readonly seed: THREE.Mesh;
  private readonly lobes: Lobe[];
  private readonly shell: ShellLeaf[];
  /** Matrices of the clumps as the leaves see them (after the resting shrink). */
  private readonly clumpMatrices: Float32Array;
  /** The two seed leaves of the sprout (the skeleton's first accents). */
  private readonly seedLeafAccents: number[] = [];
  private readonly blossomAccents: number[] = [];
  /** Slot of every accent in the pose's compacted accent buffer. */
  private readonly accentSlot: Int32Array;
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private posed = { growth: -1, vitality: -1, ageDays: -1, pop: -1, cold: -1 };
  private hover = 0;

  constructor(seed: number, species: Species, tier: QualityTier) {
    this.skeleton = generateTree(seed, species);
    this.pose = createPose(this.skeleton);
    this.palette = SPECIES_PALETTE[species];
    const { skeleton, palette } = this;
    const conifer = skeleton.shape === 'tier';

    // Wood.
    this.wood = woodGeometry(skeleton, tier.trunkSides, tier.branchSides);
    const woodMaterial = toyMaterial(
      { color: palette.bark, vertexColors: true },
      { sway: 'tree', rim: 0.35 },
    );
    this.woodMesh = new THREE.Mesh(this.wood.geometry, woodMaterial);
    this.woodMesh.castShadow = true;
    this.woodMesh.receiveShadow = true;
    this.woodMesh.frustumCulled = false;
    this.woodMesh.customDepthMaterial = toyDepthMaterial('tree');

    // Puffs.
    const puffGeo = conifer ? tierGeometry(9) : puffGeometry(tier.puffDetail);
    const puffMaterial = toyMaterial(
      { color: '#ffffff', vertexColors: conifer },
      { sway: 'tree', mood: true, flash: true, rim: 0.55 },
    );
    this.lobes = buildLobes(skeleton);
    this.clumpMatrices = new Float32Array(Math.max(1, skeleton.clumps.length) * 16);
    this.puffs = new THREE.InstancedMesh(puffGeo, puffMaterial, Math.max(1, this.lobes.length));
    this.puffs.castShadow = true;
    this.puffs.receiveShadow = true;
    this.puffs.frustumCulled = false;
    this.puffs.customDepthMaterial = toyDepthMaterial('tree');
    this.puffs.count = 0;
    this.puffs.setColorAt(0, palette.puffs[0] as THREE.Color);

    // Leaves: the shell on the puffs, then the skeleton's own accents (seed leaves first).
    this.accentSlot = new Int32Array(skeleton.accents.length);
    skeleton.accents.forEach((accent, index) => {
      this.accentSlot[index] = index;
      // The shell of leaf cards replaces the skeleton's sparse feature leaves; only its
      // seed leaves and its blossoms are drawn as they are.
      if (accent.kind === 'blossom') this.blossomAccents.push(index);
      else if (accent.birth < 0.01) this.seedLeafAccents.push(index);
    });
    const perPuff = Math.round((conifer ? 90 : 165) * tier.leafShare);
    this.shell = buildShell(skeleton, this.lobes, perPuff, palette);
    const leafMaterial = toyMaterial(
      { color: '#ffffff', side: THREE.DoubleSide },
      {
        sway: 'leaf',
        mood: true,
        flash: true,
        rim: 0.25,
        baseShade: 0.76,
        tipShade: 1.1,
        uplit: true,
      },
    );
    const leafGeo = conifer ? needleGeometry() : leafGeometry();
    this.leaves = new THREE.InstancedMesh(leafGeo, leafMaterial, Math.max(1, this.shell.length));
    this.leaves.receiveShadow = true;
    this.leaves.frustumCulled = false;
    this.leaves.count = 0;
    this.leaves.setColorAt(0, palette.leaves[0] as THREE.Color);

    if (this.blossomAccents.length > 0) {
      const blossomMaterial = toyMaterial(
        { color: '#ffffff', vertexColors: true, side: THREE.DoubleSide },
        { sway: 'leaf', flash: true },
      );
      this.blossoms = new THREE.InstancedMesh(
        blossomGeometry(),
        blossomMaterial,
        this.blossomAccents.length,
      );
      this.blossoms.frustumCulled = false;
      this.blossoms.count = 0;
      this.disposables.push(this.blossoms.geometry, blossomMaterial);
    } else {
      this.blossoms = null;
    }

    // Seed leaves: two rounded leaves, big and bright while the tree is a sprout.
    const seedLeafGeo = seedLeafGeometry();
    const seedLeafMaterial = toyMaterial(
      // A little light of their own: the sprout is all a new user has, so it must read
      // as fresh and bright at any hour and from any side.
      {
        color: palette.shoot,
        emissive: palette.shoot,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
      },
      {
        sway: 'leaf',
        mood: true,
        flash: true,
        rim: 0.4,
        baseShade: 0.8,
        tipShade: 1.08,
        uplit: true,
      },
    );
    this.seedLeaves = new THREE.InstancedMesh(
      seedLeafGeo,
      seedLeafMaterial,
      Math.max(1, this.seedLeafAccents.length),
    );
    this.seedLeaves.castShadow = true;
    this.seedLeaves.frustumCulled = false;
    this.seedLeaves.count = 0;
    this.disposables.push(seedLeafGeo, seedLeafMaterial);

    // The seed.
    const seedGeo = new THREE.SphereGeometry(1, 14, 10);
    const seedMaterial = toyMaterial({ color: SEED }, { rim: 0.4 });
    this.seed = new THREE.Mesh(seedGeo, seedMaterial);
    this.seed.castShadow = true;

    this.group.add(this.woodMesh, this.puffs, this.leaves, this.seedLeaves, this.seed);
    if (this.blossoms) this.group.add(this.blossoms);
    this.disposables.push(
      this.wood.geometry,
      woodMaterial,
      puffGeo,
      puffMaterial,
      leafGeo,
      leafMaterial,
      seedGeo,
      seedMaterial,
      this.woodMesh.customDepthMaterial,
      this.puffs.customDepthMaterial,
    );
  }

  /** Called once per frame, before the scene renders. */
  update(): void {
    const { channels, mood, terrain } = live;
    const growth = channels.gate > 0 ? 0 : live.growth;
    const pop = Math.round(live.growing * 24) / 24;
    const cold = Math.round(mood.cold * 60) / 60;
    const { posed } = this;
    if (
      Math.abs(growth - posed.growth) > 5e-5 ||
      Math.abs(live.vitality - posed.vitality) > 0.004 ||
      live.ageDays !== posed.ageDays ||
      pop !== posed.pop ||
      cold !== posed.cold
    ) {
      posed.growth = growth;
      posed.vitality = live.vitality;
      posed.ageDays = live.ageDays;
      posed.pop = pop;
      posed.cold = cold;
      this.write(growth, pop);
    }

    // Pulses and hover squash, stretch and lift the whole tree; the wind is in the shader.
    this.hover += ((live.hover === 'tree' ? 1 : 0) - this.hover) * Math.min(1, live.dt * 10);
    const squash = channels.squash * 2.2;
    const lift = 1 + this.hover * 0.025;
    const [x, y, z] = terrain.tree;
    this.group.position.set(x, y, z);
    this.group.scale.set(
      TREE_SCALE * lift * (1 + squash * 0.6),
      TREE_SCALE * lift * (1 - squash),
      TREE_SCALE * lift * (1 + squash * 0.6),
    );
    const girth = 1 + channels.girth * 3;
    this.woodMesh.scale.set(girth, 1, girth);
    // A seed has no wood yet: the buried stub of the trunk stays out of sight.
    this.woodMesh.visible = growth > 0.004;

    // The seed sits in the soil until the sprout has pushed past it.
    const seedShare = 1 - smoothstep(0.012, 0.06, growth);
    this.seed.visible = seedShare > 0.01;
    if (this.seed.visible) {
      const fall = channels.seed >= 0 ? 1 - channels.seed : 0;
      const press = 1 - channels.seedSquash;
      this.seed.position.set(0.02, 0.07 + fall * 3.2, 0.07);
      this.seed.rotation.set(0.3, 0.4, 0.5 + fall * 4);
      this.seed.scale.set(
        0.15 * seedShare * (2 - press),
        0.2 * seedShare * press,
        0.15 * seedShare,
      );
    }

    const { stats } = this.pose;
    live.tree.x = x;
    live.tree.y = y;
    live.tree.z = z;
    live.tree.top = Math.max(0.2, stats.top) * TREE_SCALE;
    live.tree.halfWidth = Math.max(0.15, stats.halfWidth) * TREE_SCALE;
    shared.uTree.value.set(x, y, z, Math.max(1.2, live.tree.top));
  }

  private write(growth: number, pop: number): void {
    const { skeleton, pose, palette } = this;
    const { mood } = live;
    poseTree(skeleton, growth, pose, {
      pop,
      vitality: live.vitality,
      ageDays: live.ageDays,
      accentShare: 1,
    });
    writeWood(this.wood, pose);

    // Clumps: the pose's matrices, shrunk about their own centre as the tree rests.
    const conifer = skeleton.shape === 'tier';
    const puffScale = conifer ? 0.72 + 0.28 * mood.puff : mood.puff;
    const clumpMatrices = this.clumpMatrices;
    const clumps = pose.clumpCount;
    clumpMatrices.set(pose.clumpMatrix.subarray(0, clumps * 16));
    for (let i = 0; i < clumps; i += 1) {
      const o = i * 16;
      for (let k = 0; k < 12; k += 1) {
        // A conifer keeps its tiers' height; only their spread draws in.
        if (conifer && k >= 4 && k < 8) continue;
        clumpMatrices[o + k] = (clumpMatrices[o + k] as number) * puffScale;
      }
    }

    // Puffs: every lobe of every living clump.
    const out = this.puffs.instanceMatrix.array as Float32Array;
    let written = 0;
    for (const lobe of this.lobes) {
      if (lobe.clump >= clumps) continue;
      const clump = skeleton.clumps[lobe.clump];
      const fill = pose.clumpScale[lobe.clump] as number;
      if (!clump || fill <= 0) continue;
      // Buds swell a little after the clump they sit on.
      const bud = lobe.radius === 1 ? 1 : lobe.radius * Math.min(1, 0.35 + fill * 0.9);
      const m = lobe.clump * 16;
      const to = written * 16;
      for (let k = 0; k < 12; k += 1) out[to + k] = (clumpMatrices[m + k] as number) * bud;
      out[to + 12] =
        (clumpMatrices[m] as number) * lobe.x +
        (clumpMatrices[m + 4] as number) * lobe.y +
        (clumpMatrices[m + 8] as number) * lobe.z +
        (clumpMatrices[m + 12] as number);
      out[to + 13] =
        (clumpMatrices[m + 1] as number) * lobe.x +
        (clumpMatrices[m + 5] as number) * lobe.y +
        (clumpMatrices[m + 9] as number) * lobe.z +
        (clumpMatrices[m + 13] as number);
      out[to + 14] =
        (clumpMatrices[m + 2] as number) * lobe.x +
        (clumpMatrices[m + 6] as number) * lobe.y +
        (clumpMatrices[m + 10] as number) * lobe.z +
        (clumpMatrices[m + 14] as number);
      out[to + 15] = 1;
      const bloom = pose.clumpBloom[lobe.clump] as number;
      colour.copy(palette.puffs[clump.variant % palette.puffs.length] as THREE.Color);
      if (bloom > 0 && !clump.alt && palette.bloomPuffs.length > 0) {
        colour.lerp(
          palette.bloomPuffs[clump.variant % palette.bloomPuffs.length] as THREE.Color,
          bloom,
        );
      }
      colour.multiplyScalar(lobe.shade);
      this.puffs.setColorAt(written, colour);
      written += 1;
    }
    this.puffs.count = written;
    this.puffs.instanceMatrix.needsUpdate = true;
    if (this.puffs.instanceColor) this.puffs.instanceColor.needsUpdate = true;

    this.writeLeaves(growth, clumpMatrices, clumps, conifer);
    this.writeBlossoms();
  }

  private writeLeaves(growth: number, puffs: Float32Array, clumps: number, conifer: boolean): void {
    const { skeleton, pose, palette, shell } = this;
    const { mood } = live;
    const out = this.leaves.instanceMatrix.array as Float32Array;
    const base = LEAF_SIZE[skeleton.species];
    let written = 0;

    this.writeSeedLeaves(growth);

    const droop = mood.droop;
    for (const leaf of shell) {
      if (leaf.clump >= clumps) continue;
      const clump = skeleton.clumps[leaf.clump];
      const fill = pose.clumpScale[leaf.clump] as number;
      if (!clump || fill <= 0) continue;
      // A young clump carries a few leaves, a resting tree drops most of them.
      if (leaf.order > fill ** 0.6 * mood.leaves) continue;
      const m = leaf.clump * 16;
      const m0 = puffs[m] as number;
      const m1 = puffs[m + 1] as number;
      const m2 = puffs[m + 2] as number;
      const m4 = puffs[m + 4] as number;
      const m5 = puffs[m + 5] as number;
      const m6 = puffs[m + 6] as number;
      const m8 = puffs[m + 8] as number;
      const m9 = puffs[m + 9] as number;
      const m10 = puffs[m + 10] as number;
      const scaleX = Math.hypot(m0, m1, m2);
      if (scaleX < 1e-4) continue;
      const px = m0 * leaf.px + m4 * leaf.py + m8 * leaf.pz + (puffs[m + 12] as number);
      const py = m1 * leaf.px + m5 * leaf.py + m9 * leaf.pz + (puffs[m + 13] as number);
      const pz = m2 * leaf.px + m6 * leaf.py + m10 * leaf.pz + (puffs[m + 14] as number);
      // Outward direction (the puff is close enough to a sphere for this to hold).
      let nx = m0 * leaf.nx + m4 * leaf.ny + m8 * leaf.nz;
      let ny = m1 * leaf.nx + m5 * leaf.ny + m9 * leaf.nz;
      let nz = m2 * leaf.nx + m6 * leaf.ny + m10 * leaf.nz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      // Leaves lie on the ball like shingles: the tip runs down along the surface (on
      // the very top, where "down" has no direction, it fans out instead), lifted a little
      // so the edge of the crown is scalloped rather than spiky. Thirst lets it hang.
      const hang = (conifer ? 0.85 : 1) + droop * 0.8;
      let tx = nx * ny * hang + leaf.jx * 0.42 + nx * 0.22;
      let ty = -(1 - ny * ny) * hang + leaf.jy * 0.2 + ny * 0.22 - droop * 0.35;
      let tz = nz * ny * hang + leaf.jz * 0.42 + nz * 0.22;
      if (ny > 0.86) {
        tx += leaf.jx * 0.9;
        tz += leaf.jz * 0.9;
      }
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      // Face: the part of the outward direction that is square to the tip.
      const along = nx * tx + ny * ty + nz * tz;
      let fx = nx - tx * along;
      let fy = ny - ty * along;
      let fz = nz - tz * along;
      const fl = Math.hypot(fx, fy, fz);
      if (fl < 1e-3) {
        fx = 0;
        fy = 1;
        fz = 0;
      } else {
        fx /= fl;
        fy /= fl;
        fz /= fl;
      }
      const sx = ty * fz - tz * fy;
      const sy = tz * fx - tx * fz;
      const sz = tx * fy - ty * fx;
      const size = base * leaf.size * (0.62 + 0.38 * fill);
      const to = written * 16;
      out[to] = sx * size;
      out[to + 1] = sy * size;
      out[to + 2] = sz * size;
      out[to + 3] = 0;
      out[to + 4] = tx * size;
      out[to + 5] = ty * size;
      out[to + 6] = tz * size;
      out[to + 7] = 0;
      out[to + 8] = fx * size;
      out[to + 9] = fy * size;
      out[to + 10] = fz * size;
      out[to + 11] = 0;
      out[to + 12] = px - tx * size * 0.4 + nx * 0.03;
      out[to + 13] = py - ty * size * 0.4 + ny * 0.03;
      out[to + 14] = pz - tz * size * 0.4 + nz * 0.03;
      out[to + 15] = 1;
      const bloom = pose.clumpBloom[leaf.clump] as number;
      if (bloom > 0.5 && !clump.alt && palette.bloomLeaves.length > 0) {
        this.leaves.setColorAt(
          written,
          palette.bloomLeaves[leaf.colour % palette.bloomLeaves.length] as THREE.Color,
        );
      } else if (leaf.order > 0.94) {
        this.leaves.setColorAt(written, palette.shoot);
      } else {
        this.leaves.setColorAt(written, palette.leaves[leaf.colour] as THREE.Color);
      }
      written += 1;
    }
    this.leaves.count = written;
    this.leaves.instanceMatrix.needsUpdate = true;
    if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
  }

  /**
   * The sprout: its two seed leaves are drawn large while there is nothing else to look
   * at, settle to their real size as the first foliage arrives and are shed after that.
   */
  private writeSeedLeaves(growth: number): void {
    const { pose } = this;
    const out = this.seedLeaves.instanceMatrix.array as Float32Array;
    const boost =
      (1.7 - 0.7 * smoothstep(0.03, 0.16, growth)) * (1 - smoothstep(0.2, 0.34, growth));
    let written = 0;
    for (const index of this.seedLeafAccents) {
      const slot = this.accentSlot[index] as number;
      if (slot >= pose.accentSlots || boost <= 0.001) continue;
      const from = slot * 16;
      const to = written * 16;
      for (let k = 0; k < 16; k += 1) {
        out[to + k] = (pose.accentMatrix[from + k] as number) * (k < 12 ? boost : 1);
      }
      written += 1;
    }
    this.seedLeaves.count = written;
    this.seedLeaves.instanceMatrix.needsUpdate = true;
  }

  private writeBlossoms(): void {
    const { blossoms, pose } = this;
    if (!blossoms) return;
    const out = blossoms.instanceMatrix.array as Float32Array;
    let written = 0;
    for (const index of this.blossomAccents) {
      const slot = this.accentSlot[index] as number;
      if (slot >= pose.accentSlots) continue;
      const from = slot * 16;
      if (
        Math.abs(pose.accentMatrix[from] as number) +
          Math.abs(pose.accentMatrix[from + 5] as number) <
        1e-5
      ) {
        continue;
      }
      out.set(pose.accentMatrix.subarray(from, from + 16), written * 16);
      // Sit a little proud of the puff, among the leaf cards.
      out[written * 16 + 12] =
        (out[written * 16 + 12] as number) + (out[written * 16 + 8] as number) * 0.5;
      out[written * 16 + 13] =
        (out[written * 16 + 13] as number) + (out[written * 16 + 9] as number) * 0.5;
      out[written * 16 + 14] =
        (out[written * 16 + 14] as number) + (out[written * 16 + 10] as number) * 0.5;
      blossoms.setColorAt(written, this.palette.blossom);
      written += 1;
    }
    blossoms.count = written;
    blossoms.instanceMatrix.needsUpdate = true;
    if (blossoms.instanceColor) blossoms.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.puffs.dispose();
    this.leaves.dispose();
    this.seedLeaves.dispose();
    this.blossoms?.dispose();
  }
}
