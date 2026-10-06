import * as THREE from 'three';
import { createRng, type Rng } from '@/lib/rng';
import { clockToIsland, layoutIsland } from '../props/layout';
import type { Terrain } from '../terrain';
import { MEADOW } from './palette';

/**
 * Where the small things of the island stand: grass tufts, flowers, bushes, boulders and
 * stepping stones, as instance matrices and colours. Seeded per user. Every list is
 * ordered so that a lower quality tier simply draws a prefix of it.
 *
 * Bushes and boulders keep to the rim (outside the ring the prop layout uses) and to the
 * pond's bank, and flowers keep off every prop's footprint, so nothing here ever has to
 * move when a prop is unlocked.
 */

export interface Instances {
  matrices: Float32Array;
  colours: Float32Array;
  count: number;
}

export interface Scatter {
  tufts: Instances;
  /** Turf drooping over the rim: the same tufts, upside down. */
  hanging: Instances;
  /** Stems and heads share matrices; `flowers.colours` tints the heads. */
  flowers: Instances;
  bushes: Instances;
  rocks: Instances;
  stones: Instances;
}

const TAU = Math.PI * 2;

class Writer {
  readonly matrices: Float32Array;
  readonly colours: Float32Array;
  count = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly euler = new THREE.Euler();

  constructor(private readonly capacity: number) {
    this.matrices = new Float32Array(capacity * 16);
    this.colours = new Float32Array(capacity * 3);
  }

  get full(): boolean {
    return this.count >= this.capacity;
  }

  add(
    x: number,
    y: number,
    z: number,
    yaw: number,
    sx: number,
    sy: number,
    sz: number,
    colour: THREE.Color,
    shade = 1,
    tilt = 0,
  ): void {
    if (this.full) return;
    this.position.set(x, y, z);
    this.quaternion.setFromEuler(this.euler.set(tilt, yaw, tilt * 0.6, 'YXZ'));
    this.scale.set(sx, sy, sz);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrix.toArray(this.matrices, this.count * 16);
    this.colours[this.count * 3] = colour.r * shade;
    this.colours[this.count * 3 + 1] = colour.g * shade;
    this.colours[this.count * 3 + 2] = colour.b * shade;
    this.count += 1;
  }

  done(): Instances {
    return { matrices: this.matrices, colours: this.colours, count: this.count };
  }
}

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)] as T;

export function scatterIsland(
  terrain: Terrain,
  limits: { tufts: number; flowers: number },
): Scatter {
  const layout = layoutIsland(terrain.seed);
  const spots = Object.values(layout.spots);
  const [treeX, , treeZ] = terrain.tree;
  const onStone = (x: number, z: number) =>
    terrain.path.some((stone) => Math.hypot(stone.x - x, stone.z - z) < stone.radius * 1.05);

  const nearStone = (x: number, z: number) =>
    terrain.path.some((stone) => Math.hypot(stone.x - x, stone.z - z) < stone.radius * 1.9);

  // --- Grass: everywhere dry, thinner on the worn ground by the trunk.
  const grass = createRng(terrain.seed, 'grass', 1);
  const tufts = new Writer(limits.tufts);
  for (let attempt = 0; attempt < limits.tufts * 4 && !tufts.full; attempt += 1) {
    const angle = grass() * TAU;
    const share = Math.sqrt(grass());
    const radius = terrain.coast(angle) * share * 0.99;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const variety = grass();
    const size = grass();
    const turn = grass() * TAU;
    if (!terrain.dry(x, z, 0.03) || onStone(x, z)) continue;
    const fromTree = Math.hypot(x - treeX, z - treeZ);
    if (fromTree < 0.34 || (fromTree < 0.62 && variety < 0.6)) continue;
    // The ground shows through around the water and along the path.
    const fromPond = Math.hypot(x - terrain.pond.x, z - terrain.pond.z) / terrain.pond.radius;
    if (fromPond < 1.22 || (fromPond < 1.7 && variety < 0.55)) continue;
    if (nearStone(x, z) && variety < 0.7) continue;
    // Short on the open lawn, longer towards the rim and in two or three wild patches.
    const wild = 0.5 + 0.5 * Math.sin(x * 1.9 + terrain.seed) * Math.cos(z * 1.6);
    const height = 0.1 + 0.1 * size + 0.13 * share * share + 0.08 * wild;
    const width = 0.26 + 0.2 * size;
    tufts.add(
      x,
      terrain.height(x, z) - 0.015,
      z,
      turn,
      width,
      height,
      width,
      pick(grass, MEADOW.tufts),
      0.9 + variety * 0.2,
    );
  }

  // --- Turf hanging over the rim, so the island's edge is soft and alive, not a moulding.
  const fringe = createRng(terrain.seed, 'fringe', 1);
  const hanging = new Writer(Math.round(40 + limits.tufts * 0.05));
  while (!hanging.full) {
    const angle = fringe() * TAU;
    const edge = terrain.coast(angle) + 0.1;
    const x = Math.cos(angle) * edge;
    const z = Math.sin(angle) * edge;
    const length = 0.16 + fringe() * fringe() * 0.62;
    const width = 0.3 + fringe() * 0.25;
    hanging.add(
      x,
      terrain.height(x * 0.96, z * 0.96) - 0.2 - fringe() * 0.08,
      z,
      fringe() * TAU,
      width,
      length,
      width,
      pick(fringe, MEADOW.hanging),
      0.9 + fringe() * 0.25,
    );
  }

  // --- Flowers: small drifts on the open lawn, never on a prop's footprint.
  const bloom = createRng(terrain.seed, 'flowers', 1);
  const flowers = new Writer(limits.flowers);
  const clear = (x: number, z: number) =>
    spots.every((spot) => Math.hypot(spot.x - x, spot.z - z) > spot.radius + 0.12) &&
    Math.hypot(x - treeX, z - treeZ) > 0.6 &&
    !onStone(x, z);
  for (let drift = 0; drift < 40 && !flowers.full; drift += 1) {
    const angle = bloom() * TAU;
    const radius = terrain.coast(angle) * (0.3 + 0.62 * Math.sqrt(bloom()));
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const tint = pick(bloom, MEADOW.flowers);
    const members = 3 + Math.floor(bloom() * 5);
    for (let k = 0; k < members && !flowers.full; k += 1) {
      const x = cx + (bloom() - 0.5) * 0.6;
      const z = cz + (bloom() - 0.5) * 0.6;
      const height = 0.2 + bloom() * 0.16;
      const turn = (bloom() - 0.5) * 1.2;
      if (!terrain.dry(x, z, 0.08) || !clear(x, z)) continue;
      flowers.add(x, terrain.height(x, z) - 0.01, z, turn, 0.42, height, 0.42, tint);
    }
  }

  // --- Bushes: on the rim, out of the way of everything, three puffs each.
  const shrub = createRng(terrain.seed, 'bushes', 1);
  const bushes = new Writer(40);
  const bushClocks = [10.4, 11.5, 0.8, 1.9, 9.1, 3.0, 7.9];
  for (const clock of bushClocks) {
    const [ux, uz] = clockToIsland(clock + (shrub() - 0.5) * 0.5, 1);
    const angle = Math.atan2(uz, ux);
    const radius = terrain.coast(angle) * (0.9 + shrub() * 0.05);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const size = 0.3 + shrub() * 0.16;
    const tone = pick(shrub, MEADOW.bushes);
    const lobes = 2 + Math.floor(shrub() * 2);
    if (!terrain.dry(x, z, 0.25)) continue;
    const ground = terrain.height(x, z);
    bushes.add(x, ground + size * 0.62, z, shrub() * TAU, size, size * 0.86, size, tone);
    for (let lobe = 0; lobe < lobes; lobe += 1) {
      const side = angle + Math.PI / 2 + (lobe % 2 === 0 ? 0 : Math.PI) + (shrub() - 0.5) * 0.8;
      const reach = size * (0.72 + shrub() * 0.25);
      const lx = x + Math.cos(side) * reach;
      const lz = z + Math.sin(side) * reach;
      const small = size * (0.55 + shrub() * 0.22);
      if (!terrain.inside(lx, lz, 0.02)) continue;
      bushes.add(
        lx,
        terrain.height(lx, lz) + small * 0.6,
        lz,
        shrub() * TAU,
        small,
        small * 0.9,
        small,
        tone,
        0.9 + shrub() * 0.2,
      );
    }
  }

  // --- Boulders: a few on the pond's bank, the rest along the rim.
  const stone = createRng(terrain.seed, 'rocks', 1);
  const rocks = new Writer(22);
  const { pond } = terrain;
  for (let i = 0; i < 5; i += 1) {
    const angle = terrain.outlet.angle + Math.PI * (0.45 + i * 0.3) + (stone() - 0.5) * 0.3;
    const reach = pond.radius * (1.08 + stone() * 0.12);
    const x = pond.x + Math.cos(angle) * reach;
    const z = pond.z + Math.sin(angle) * reach;
    const size = 0.09 + stone() * 0.1;
    if (!terrain.inside(x, z, 0.1)) continue;
    rocks.add(
      x,
      terrain.height(x, z) + size * 0.25,
      z,
      stone() * TAU,
      size * 1.2,
      size,
      size,
      pick(stone, MEADOW.rocks),
      1,
      (stone() - 0.5) * 0.5,
    );
  }
  for (let i = 0; i < 12; i += 1) {
    const angle = stone() * TAU;
    const radius = terrain.coast(angle) * (0.9 + stone() * 0.07);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const size = 0.1 + stone() * stone() * 0.24;
    const squat = 0.7 + stone() * 0.4;
    const tilt = (stone() - 0.5) * 0.6;
    if (!terrain.dry(x, z, 0.18)) continue;
    rocks.add(
      x,
      terrain.height(x, z) + size * 0.2,
      z,
      stone() * TAU,
      size * 1.25,
      size * squat,
      size,
      pick(stone, MEADOW.rocks),
      1,
      tilt,
    );
  }

  // --- Stepping stones.
  const stones = new Writer(terrain.path.length);
  terrain.path.forEach((step, index) => {
    stones.add(
      step.x,
      step.y - 0.035,
      step.z,
      step.yaw,
      step.radius,
      0.12,
      step.radius * 0.84,
      MEADOW.stones[index % MEADOW.stones.length] as THREE.Color,
    );
  });

  return {
    tufts: tufts.done(),
    hanging: hanging.done(),
    flowers: flowers.done(),
    bushes: bushes.done(),
    rocks: rocks.done(),
    stones: stones.done(),
  };
}

/** Fills an instanced mesh from a scatter list, drawing at most `count` instances. */
export function applyInstances(
  mesh: THREE.InstancedMesh,
  instances: Instances,
  count: number,
): void {
  const shown = Math.min(count, instances.count, mesh.instanceMatrix.count);
  (mesh.instanceMatrix.array as Float32Array).set(instances.matrices.subarray(0, shown * 16));
  mesh.instanceMatrix.needsUpdate = true;
  const colour = new THREE.Color();
  for (let i = 0; i < shown; i += 1) {
    colour.setRGB(
      instances.colours[i * 3] as number,
      instances.colours[i * 3 + 1] as number,
      instances.colours[i * 3 + 2] as number,
    );
    mesh.setColorAt(i, colour);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.count = shown;
  mesh.computeBoundingSphere();
}
