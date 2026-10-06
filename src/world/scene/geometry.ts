import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '@/lib/rng';
import type { Pose, Skeleton } from '../tree/types';

/**
 * The small shapes the world is assembled from. Every builder returns a fresh geometry
 * that its caller owns and disposes. Conventions: y is up; a blade, leaf or stem has its
 * base at the origin and its tip at y = 1; `aTip` is 0 at the base and 1 at the tip
 * (the wind and the base-to-tip shade read it).
 */

const TAU = Math.PI * 2;

/** `count` points spread evenly over the unit sphere. */
function fibonacciSphere(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const radius = Math.sqrt(1 - y * y);
    points.push(new THREE.Vector3(Math.cos(golden * i) * radius, y, Math.sin(golden * i) * radius));
  }
  return points;
}

/** An icosphere with shared vertices, so normals come out smooth. */
function smoothSphere(detail: number): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, detail);
  source.deleteAttribute('normal');
  source.deleteAttribute('uv');
  const merged = mergeVertices(source, 1e-4);
  source.dispose();
  return merged;
}

/**
 * A foliage puff: a sphere swollen into a dozen soft knobs, like a head of broccoli.
 * Radius about 1. The same shape serves the crown, the bushes and the clouds.
 */
export function puffGeometry(detail: number, knobs = 13, swell = 0.24): THREE.BufferGeometry {
  const geometry = smoothSphere(detail);
  const centres = fibonacciSphere(knobs);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    let knob = 0;
    for (const centre of centres) {
      const near = THREE.MathUtils.smoothstep(v.dot(centre), 0.55, 1);
      if (near > knob) knob = near;
    }
    v.multiplyScalar(1 - swell * 0.55 + swell * knob);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Flips every triangle of an indexed geometry whose face looks away from `reference`
 * (a direction given for the triangle's centre), then rebuilds the normals. It lets a
 * builder list faces without minding the winding.
 */
export function orient(
  geometry: THREE.BufferGeometry,
  reference: (
    x: number,
    y: number,
    z: number,
    triangle: number,
  ) => readonly [number, number, number],
): THREE.BufferGeometry {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  if (!index) return geometry;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let t = 0; t < index.count; t += 3) {
    const ia = index.getX(t);
    const ib = index.getX(t + 1);
    const ic = index.getX(t + 2);
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    normal.subVectors(b, a).cross(c.clone().sub(a));
    const out = reference(
      (a.x + b.x + c.x) / 3,
      (a.y + b.y + c.y) / 3,
      (a.z + b.z + c.z) / 3,
      t / 3,
    );
    if (normal.x * out[0] + normal.y * out[1] + normal.z * out[2] < 0) {
      index.setX(t + 1, ic);
      index.setX(t + 2, ib);
    }
  }
  index.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function withTips(geometry: THREE.BufferGeometry, tips: number[]): THREE.BufferGeometry {
  geometry.setAttribute('aTip', new THREE.Float32BufferAttribute(tips, 1));
  return geometry;
}

/** A leaf card: a folded teardrop, four triangles, facing +z. */
export function leafGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  // base, right, left, midrib, tip
  const positions = [0, 0, 0, 0.42, 0.5, 0.06, -0.42, 0.5, 0.06, 0, 0.55, -0.02, 0, 1, 0.08];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 3, 0, 3, 2, 3, 1, 4, 3, 4, 2]);
  geometry.computeVertexNormals();
  return withTips(geometry, [0, 0.5, 0.5, 0.5, 1]);
}

/**
 * A seed leaf: a rounded, gently cupped oval with enough triangles to stay round when it
 * fills the frame (a sprout is shown close up). Base at the origin, tip at y = 1.
 */
export function seedLeafGeometry(): THREE.BufferGeometry {
  const rows = [
    [0, 0.06],
    [0.14, 0.24],
    [0.34, 0.37],
    [0.56, 0.4],
    [0.78, 0.31],
    [0.93, 0.16],
    [1, 0.02],
  ] as const;
  const positions: number[] = [];
  const tips: number[] = [];
  const indices: number[] = [];
  rows.forEach(([t, half], row) => {
    // Cupped across, arched along.
    const arch = Math.sin(t * Math.PI) * 0.1;
    positions.push(-half, t, arch + 0.07, 0, t, arch - 0.02, half, t, arch + 0.07);
    tips.push(t, t, t);
    if (row > 0) {
      const a = (row - 1) * 3;
      const b = row * 3;
      indices.push(a, a + 1, b + 1, a, b + 1, b, a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return withTips(geometry, tips);
}

/** A slim needle spray for the conifer: the same card, narrower and longer. */
export function needleGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = [0, 0, 0, 0.2, 0.4, 0.05, -0.2, 0.4, 0.05, 0, 0.5, -0.02, 0, 1, 0.04];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 3, 0, 3, 2, 3, 1, 4, 3, 4, 2]);
  geometry.computeVertexNormals();
  return withTips(geometry, [0, 0.5, 0.5, 0.5, 1]);
}

/** A five-petal blossom facing +z, a little cupped, with a golden heart (vertex colours). */
export function blossomGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const tips: number[] = [];
  const petal = [1, 1, 1];
  const heart = [1, 0.78, 0.25];
  const push = (x: number, y: number, z: number, colour: number[]) => {
    positions.push(x, y, z);
    colours.push(...colour);
    tips.push(1);
  };
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * TAU + Math.PI / 2;
    const left = angle - 0.42;
    const right = angle + 0.42;
    const inner = 0.22;
    push(Math.cos(left) * inner, Math.sin(left) * inner, 0.02, heart);
    push(Math.cos(right) * inner, Math.sin(right) * inner, 0.02, heart);
    push(Math.cos(right) * 0.78, Math.sin(right) * 0.78, 0.14, petal);
    push(Math.cos(left) * inner, Math.sin(left) * inner, 0.02, heart);
    push(Math.cos(right) * 0.78, Math.sin(right) * 0.78, 0.14, petal);
    push(Math.cos(angle) * 1, Math.sin(angle) * 1, 0.2, petal);
    push(Math.cos(left) * inner, Math.sin(left) * inner, 0.02, heart);
    push(Math.cos(angle) * 1, Math.sin(angle) * 1, 0.2, petal);
    push(Math.cos(left) * 0.78, Math.sin(left) * 0.78, 0.14, petal);
    // The heart: one fan triangle per petal.
    push(0, 0, 0.07, heart);
    push(Math.cos(left) * inner, Math.sin(left) * inner, 0.02, heart);
    push(Math.cos(right) * inner, Math.sin(right) * inner, 0.02, heart);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return withTips(geometry, tips);
}

/**
 * One tier of a conifer: a full, slightly bulging cone whose hem hangs in scallops.
 * Base at y = 0, apex at y = 1, radius 1. Vertex colours lighten the bough tips.
 */
export function tierGeometry(scallops: number): THREE.BufferGeometry {
  const around = scallops * 2;
  const positions: number[] = [0, 1, 0];
  const colours: number[] = [0.82, 0.82, 0.82];
  const rings = [
    { y: 0.62, radius: 0.46, shade: 0.86 },
    { y: 0.3, radius: 0.8, shade: 0.95 },
    { y: 0, radius: 1, shade: 1.12 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < around; i += 1) {
      const angle = (i / around) * TAU;
      const hem = ring.y === 0;
      const dip = hem && i % 2 === 1;
      const radius = ring.radius * (dip ? 0.8 : 1);
      positions.push(
        Math.cos(angle) * radius,
        ring.y + (dip ? 0.1 : hem ? -0.03 : 0),
        Math.sin(angle) * radius,
      );
      const shade = ring.shade * (dip ? 0.86 : 1);
      colours.push(shade, shade, shade);
    }
  }
  // Underside: a shallow dark cone closing the tier.
  const under = positions.length / 3;
  positions.push(0, 0.3, 0);
  colours.push(0.5, 0.5, 0.5);
  const indices: number[] = [];
  for (let i = 0; i < around; i += 1) {
    const next = (i + 1) % around;
    indices.push(0, 1 + next, 1 + i);
    for (let ring = 0; ring < rings.length - 1; ring += 1) {
      const a = 1 + ring * around;
      const b = a + around;
      indices.push(a + i, a + next, b + next, a + i, b + next, b + i);
    }
    const hem = 1 + (rings.length - 1) * around;
    indices.push(under, hem + i, hem + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  // Six triangles per step around: the last of each six closes the underside.
  return orient(geometry, (x, _y, z, triangle) => (triangle % 6 === 5 ? [0, -1, 0] : [x, 0.5, z]));
}

/** A boulder: a battered icosphere with flat facets. Radius about 1. */
export function rockGeometry(seed: number, detail = 1): THREE.BufferGeometry {
  const merged = smoothSphere(detail);
  const position = merged.getAttribute('position') as THREE.BufferAttribute;
  const random = mulberry32(seed);
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    v.multiplyScalar(0.78 + random() * 0.4);
    position.setXYZ(i, v.x, v.y * 0.8, v.z);
  }
  const geometry = merged.toNonIndexed();
  merged.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A tuft of grass: three tapering blades leaning apart. About 1 tall, 0.5 wide.
 * `hanging` turns it upside down (tips at y = -1) for the turf that droops over the rim;
 * its shading normals still point up, so it is lit like the lawn it hangs from.
 */
export function tuftGeometry(hanging = false): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const tips: number[] = [];
  const indices: number[] = [];
  const blades = [
    { angle: 0.2, lean: 0.26, height: 1, width: 0.15 },
    { angle: 2.3, lean: 0.42, height: 0.72, width: 0.14 },
    { angle: 4.3, lean: 0.36, height: 0.86, width: 0.13 },
  ];
  for (const blade of blades) {
    const start = positions.length / 3;
    const dx = Math.cos(blade.angle);
    const dz = Math.sin(blade.angle);
    // Across the blade: perpendicular to its lean.
    const ax = -dz;
    const az = dx;
    const at = (side: number, t: number, width: number) => {
      const out = blade.lean * t * t + 0.05;
      positions.push(
        dx * out + ax * side * width,
        blade.height * t * (hanging ? -1 : 1),
        dz * out + az * side * width,
      );
      // Blades are lit like the lawn they stand on, with a hint of their own lean.
      normals.push(dx * 0.25, 0.95, dz * 0.25);
      tips.push(t);
    };
    at(-1, 0, blade.width);
    at(1, 0, blade.width);
    at(-1, 0.55, blade.width * 0.8);
    at(1, 0.55, blade.width * 0.8);
    at(0, 1, 0);
    indices.push(start, start + 1, start + 3, start, start + 3, start + 2);
    indices.push(start + 2, start + 3, start + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return withTips(geometry, tips);
}

/** A flower stem: two crossed slivers, 1 tall. */
export function stemGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const tips: number[] = [];
  const indices: number[] = [];
  for (const angle of [0, Math.PI / 2]) {
    const start = positions.length / 3;
    const ax = Math.cos(angle) * 0.035;
    const az = Math.sin(angle) * 0.035;
    positions.push(-ax, 0, -az, ax, 0, az, -ax * 0.6, 1, -az * 0.6, ax * 0.6, 1, az * 0.6);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    tips.push(0, 0, 1, 1);
    indices.push(start, start + 1, start + 3, start, start + 3, start + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return withTips(geometry, tips);
}

/**
 * A flower head sitting on the tip of a unit stem: six petals around a domed heart,
 * tilted towards the viewer. Vertex colours: white petals (tinted per instance), a
 * golden heart.
 */
export function flowerHeadGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const petals = 6;
  const tilt = 0.5;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const push = (x: number, y: number, z: number, colour: readonly number[]) => {
    // Tilt about x so the face looks up and forwards, then lift onto the stem tip.
    positions.push(x, 1 + y * cos - z * sin, y * sin + z * cos);
    colours.push(...colour);
  };
  const white = [1, 1, 1] as const;
  const gold = [1, 0.8, 0.22] as const;
  for (let i = 0; i < petals; i += 1) {
    const angle = (i / petals) * TAU;
    const left = angle - 0.36;
    const right = angle + 0.36;
    push(0, 0.03, 0, white);
    push(Math.sin(right) * 0.2, 0.05, Math.cos(right) * 0.2, white);
    push(Math.sin(left) * 0.2, 0.05, Math.cos(left) * 0.2, white);
    push(Math.sin(left) * 0.2, 0.05, Math.cos(left) * 0.2, white);
    push(Math.sin(right) * 0.2, 0.05, Math.cos(right) * 0.2, white);
    push(Math.sin(angle) * 0.34, 0.1, Math.cos(angle) * 0.34, white);
    // Heart.
    push(0, 0.11, 0, gold);
    push(Math.sin(right) * 0.1, 0.07, Math.cos(right) * 0.1, gold);
    push(Math.sin(left) * 0.1, 0.07, Math.cos(left) * 0.1, gold);
  }
  const geometry = new THREE.BufferGeometry();
  const count = positions.length / 3;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  // A flower is lit like the lawn around it, whichever way a petal happens to face.
  const normals = new Array<number>(count * 3);
  for (let i = 0; i < count; i += 1) {
    normals[i * 3] = 0;
    normals[i * 3 + 1] = 0.94;
    normals[i * 3 + 2] = 0.34;
  }
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return withTips(geometry, new Array<number>(count).fill(1));
}

/** A stepping stone: a low, rounded, six-sided slab. Radius 1, top at y = 0.5. */
export function stoneGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(0.86, 1, 0.5, 7, 1).toNonIndexed();
  geometry.translate(0, 0.25, 0);
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  return geometry;
}

// --- Wood: one tube mesh for the trunk and every branch -------------------------------------

export interface WoodMesh {
  geometry: THREE.BufferGeometry;
  /** Sides of the ring of every node, and the first vertex of that ring. */
  sides: Uint8Array;
  ringStart: Uint32Array;
  /** Unit direction of every vertex from its node (also its normal). */
  spokes: Float32Array;
}

/**
 * Builds the tube once per skeleton. The topology never changes: `writeWood` only moves
 * the rings when growth changes, so a growing tree costs one buffer upload, not a rebuild.
 */
export function woodGeometry(
  skeleton: Skeleton,
  trunkSides: number,
  branchSides: number,
): WoodMesh {
  const nodes = skeleton.nodeLength.length;
  const sides = new Uint8Array(nodes);
  const ringStart = new Uint32Array(nodes);
  let vertices = 0;
  for (const branch of skeleton.branches) {
    const count =
      branch.parent < 0
        ? trunkSides
        : branch.level === 1
          ? branchSides
          : Math.max(4, branchSides - 1);
    for (let n = 0; n < branch.nodeCount; n += 1) {
      const node = branch.nodeStart + n;
      sides[node] = count;
      ringStart[node] = vertices;
      vertices += count;
    }
  }

  const spokes = new Float32Array(vertices * 3);
  const colours = new Float32Array(vertices * 3);
  const indices: number[] = [];
  for (const branch of skeleton.branches) {
    for (let n = 0; n < branch.nodeCount; n += 1) {
      const node = branch.nodeStart + n;
      const count = sides[node] as number;
      const start = ringStart[node] as number;
      // Bark darkens towards the root and warms towards the twigs.
      const along = branch.nodeCount > 1 ? n / (branch.nodeCount - 1) : 0;
      const shade = branch.parent < 0 ? 0.78 + 0.22 * along : 0.96 + 0.1 * along;
      for (let s = 0; s < count; s += 1) {
        const angle = (s / count) * TAU;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const v = (start + s) * 3;
        for (let axis = 0; axis < 3; axis += 1) {
          spokes[v + axis] =
            cos * (skeleton.nodeFrame[node * 6 + axis] as number) +
            sin * (skeleton.nodeFrame[node * 6 + 3 + axis] as number);
        }
        // Every other spoke is a touch darker: cheap bark ridges.
        const ridge = s % 2 === 0 ? 1 : 0.94;
        colours[v] = shade * ridge;
        colours[v + 1] = shade * ridge;
        colours[v + 2] = shade * ridge;
        if (n < branch.nodeCount - 1) {
          const next = (ringStart[node + 1] as number) + s;
          const nextWrap = (ringStart[node + 1] as number) + ((s + 1) % count);
          const wrap = start + ((s + 1) % count);
          indices.push(start + s, nextWrap, next, start + s, wrap, nextWrap);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', new THREE.BufferAttribute(spokes.slice(), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  return { geometry, sides, ringStart, spokes };
}

export function writeWood(wood: WoodMesh, pose: Pose): void {
  const position = wood.geometry.getAttribute('position') as THREE.BufferAttribute;
  const out = position.array as Float32Array;
  const { spokes } = wood;
  for (let node = 0; node < wood.sides.length; node += 1) {
    const radius = pose.nodeRadius[node] as number;
    const x = pose.nodePosition[node * 3] as number;
    const y = pose.nodePosition[node * 3 + 1] as number;
    const z = pose.nodePosition[node * 3 + 2] as number;
    const start = (wood.ringStart[node] as number) * 3;
    const end = start + (wood.sides[node] as number) * 3;
    for (let v = start; v < end; v += 3) {
      out[v] = x + (spokes[v] as number) * radius;
      out[v + 1] = y + (spokes[v + 1] as number) * radius;
      out[v + 2] = z + (spokes[v + 2] as number) * radius;
    }
  }
  position.needsUpdate = true;
}
