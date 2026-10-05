import * as THREE from 'three';
import { mulberry32 } from '@/lib/rng';
import type { Pose, Skeleton } from '../tree/types';

/**
 * Geometry builders. Every solid carries an `aHull` attribute: the direction (and
 * miter length) its surface moves when the sticker passes swell it. Fills never use
 * vertex normals: flat facets come from screen-space derivatives, round shapes shade
 * from the hull direction.
 */

type Triangles = number[];

/**
 * Hull vectors for a triangle soup. Vertices that share a position are welded, and each
 * gets the vector `m` that best satisfies `m . n = 1` for all the face normals `n`
 * around it: every face plane then moves out by exactly one unit, so a hard-edged
 * low-poly solid keeps a constant outline width and sharp, mitred corners instead of
 * splitting open. `maxMiter` caps the length at spiky corners; 1 gives plain smooth normals.
 */
export function hullVectors(positions: ArrayLike<number>, maxMiter: number): Float32Array {
  const count = positions.length / 3;
  const groups = new Map<string, { normals: number[]; members: number[] }>();
  const key = (i: number) =>
    `${Math.round((positions[i * 3] as number) * 2000)},${Math.round((positions[i * 3 + 1] as number) * 2000)},${Math.round((positions[i * 3 + 2] as number) * 2000)}`;

  for (let t = 0; t < count; t += 3) {
    const ax = positions[t * 3] as number;
    const ay = positions[t * 3 + 1] as number;
    const az = positions[t * 3 + 2] as number;
    const ux = (positions[t * 3 + 3] as number) - ax;
    const uy = (positions[t * 3 + 4] as number) - ay;
    const uz = (positions[t * 3 + 5] as number) - az;
    const vx = (positions[t * 3 + 6] as number) - ax;
    const vy = (positions[t * 3 + 7] as number) - ay;
    const vz = (positions[t * 3 + 8] as number) - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-12) continue;
    nx /= length;
    ny /= length;
    nz /= length;
    for (let corner = 0; corner < 3; corner += 1) {
      const id = key(t + corner);
      let group = groups.get(id);
      if (!group) {
        group = { normals: [], members: [] };
        groups.set(id, group);
      }
      group.members.push(t + corner);
      // Coplanar neighbours count once, or large fans would outvote a single side wall.
      let known = false;
      for (let n = 0; n < group.normals.length; n += 3) {
        const d =
          (group.normals[n] as number) * nx +
          (group.normals[n + 1] as number) * ny +
          (group.normals[n + 2] as number) * nz;
        if (d > 0.995) known = true;
      }
      if (!known) group.normals.push(nx, ny, nz);
    }
  }

  const hull = new Float32Array(count * 3);
  const damping = 0.08;
  for (const group of groups.values()) {
    // Damped least squares towards the average normal keeps the system well-posed
    // when the faces around a vertex are (nearly) coplanar.
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const a = [damping, 0, 0, 0, damping, 0, 0, 0, damping];
    for (let n = 0; n < group.normals.length; n += 3) {
      const x = group.normals[n] as number;
      const y = group.normals[n + 1] as number;
      const z = group.normals[n + 2] as number;
      sx += x;
      sy += y;
      sz += z;
      a[0] = (a[0] as number) + x * x;
      a[1] = (a[1] as number) + x * y;
      a[2] = (a[2] as number) + x * z;
      a[4] = (a[4] as number) + y * y;
      a[5] = (a[5] as number) + y * z;
      a[8] = (a[8] as number) + z * z;
    }
    a[3] = a[1] as number;
    a[6] = a[2] as number;
    a[7] = a[5] as number;
    const mean = Math.hypot(sx, sy, sz) || 1;
    const bx = sx + (damping * sx) / mean;
    const by = sy + (damping * sy) / mean;
    const bz = sz + (damping * sz) / mean;
    const [a0, a1, a2, a3, a4, a5, a6, a7, a8] = a as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const det = a0 * (a4 * a8 - a5 * a7) - a1 * (a3 * a8 - a5 * a6) + a2 * (a3 * a7 - a4 * a6);
    let mx = sx / mean;
    let my = sy / mean;
    let mz = sz / mean;
    if (Math.abs(det) > 1e-9) {
      mx = (bx * (a4 * a8 - a5 * a7) - a1 * (by * a8 - a5 * bz) + a2 * (by * a7 - a4 * bz)) / det;
      my = (a0 * (by * a8 - a5 * bz) - bx * (a3 * a8 - a5 * a6) + a2 * (a3 * bz - by * a6)) / det;
      mz = (a0 * (a4 * bz - by * a7) - a1 * (a3 * bz - by * a6) + bx * (a3 * a7 - a4 * a6)) / det;
    }
    const length = Math.hypot(mx, my, mz) || 1;
    const capped = Math.min(Math.max(length, 1), maxMiter) / length;
    for (const member of group.members) {
      hull[member * 3] = mx * capped;
      hull[member * 3 + 1] = my * capped;
      hull[member * 3 + 2] = mz * capped;
    }
  }
  return hull;
}

/** A static solid from a triangle soup, with optional per-vertex tones and parts. */
export function soupGeometry(
  positions: ArrayLike<number>,
  maxMiter: number,
  tones?: ArrayLike<number>,
  parts?: ArrayLike<number>,
  normals?: ArrayLike<number>,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const count = positions.length / 3;
  geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(positions), 3));
  geometry.setAttribute('aHull', new THREE.BufferAttribute(hullVectors(positions, maxMiter), 3));
  if (tones) {
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      data[i * 3] = tones[i] as number;
      data[i * 3 + 1] = tones[i] as number;
    }
    geometry.setAttribute('aTone', new THREE.BufferAttribute(data, 3));
  }
  if (parts) geometry.setAttribute('aPart', new THREE.BufferAttribute(Float32Array.from(parts), 1));
  if (normals) {
    geometry.setAttribute('aNormal', new THREE.BufferAttribute(Float32Array.from(normals), 3));
  }
  return geometry;
}

/** A unit sphere of triangles: the glossy foliage bubble. Its hull vector is its position. */
export function blobGeometry(detail: number): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, detail);
  const geometry = new THREE.BufferGeometry();
  const position = source.getAttribute('position').clone();
  geometry.setAttribute('position', position);
  geometry.setAttribute('aHull', position.clone());
  source.dispose();
  return geometry;
}

const TAU = Math.PI * 2;

/** A cone tier with a scalloped hem. Base at y = 0, apex at y = 1, radius 1. */
export function tierGeometry(teeth: number): THREE.BufferGeometry {
  const soup: Triangles = [];
  const hem: Array<[number, number, number]> = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const angle = (i / (teeth * 2)) * TAU;
    const tip = i % 2 === 0;
    const radius = tip ? 1 : 0.8;
    hem.push([Math.cos(angle) * radius, tip ? 0 : 0.11, Math.sin(angle) * radius]);
  }
  // Shading normals follow the smooth cone, so the shade falls in one clean wedge.
  const normals: number[] = [];
  const slope = (point: [number, number, number]): [number, number, number] => {
    const flat = Math.hypot(point[0], point[2]) || 1;
    return [point[0] / flat / Math.SQRT2, Math.SQRT1_2, point[2] / flat / Math.SQRT2];
  };
  for (let i = 0; i < hem.length; i += 1) {
    const a = hem[i] as [number, number, number];
    const b = hem[(i + 1) % hem.length] as [number, number, number];
    const na = slope(a);
    const nb = slope(b);
    soup.push(0, 1, 0, ...b, ...a);
    normals.push((na[0] + nb[0]) / 2, na[1], (na[2] + nb[2]) / 2, ...nb, ...na);
    soup.push(0, 0.2, 0, ...a, ...b);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
  }
  return soupGeometry(soup, 1.3, undefined, undefined, normals);
}

/**
 * A leaf bud: base at the origin, tip at y = 1. It is a flattened four-sided spindle
 * rather than a flat card, so it shows a leaf silhouette from every side and is a
 * closed solid the outline passes can swell.
 */
export function leafGeometry(): THREE.BufferGeometry {
  const rings: Array<[number, number]> = [
    [0.2, 0.2],
    [0.5, 0.3],
    [0.8, 0.17],
  ];
  const corner = (ring: [number, number], side: number): [number, number, number] => {
    const angle = (side / 4) * TAU;
    return [Math.cos(angle) * ring[1], ring[0], Math.sin(angle) * ring[1] * 0.55];
  };
  const soup: Triangles = [];
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    const first = rings[0] as [number, number];
    const last = rings[rings.length - 1] as [number, number];
    soup.push(0, 0, 0, ...corner(first, side), ...corner(first, next));
    soup.push(0, 1, 0, ...corner(last, next), ...corner(last, side));
    for (let r = 0; r < rings.length - 1; r += 1) {
      const lower = rings[r] as [number, number];
      const upper = rings[r + 1] as [number, number];
      soup.push(...corner(upper, side), ...corner(lower, next), ...corner(lower, side));
      soup.push(...corner(upper, side), ...corner(upper, next), ...corner(lower, next));
    }
  }
  return soupGeometry(soup, 1.15);
}

/** A five-petal blossom facing +z. Part 1 marks the yellow heart. */
export function blossomGeometry(): THREE.BufferGeometry {
  const soup: Triangles = [];
  const parts: number[] = [];
  const points = 10;
  const rim = (i: number, radius: number, z: number): [number, number, number] => {
    const angle = (i / points) * TAU + Math.PI / 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, z];
  };
  for (let i = 0; i < points; i += 1) {
    const j = (i + 1) % points;
    const outerA = rim(i, i % 2 === 0 ? 1 : 0.62, 0);
    const outerB = rim(j, j % 2 === 0 ? 1 : 0.62, 0);
    const innerA = rim(i, 0.32, 0.16);
    const innerB = rim(j, 0.32, 0.16);
    soup.push(0, 0, 0.22, ...innerA, ...innerB);
    parts.push(1, 1, 1);
    soup.push(...innerA, ...outerA, ...outerB, ...innerA, ...outerB, ...innerB);
    parts.push(0, 0, 0, 0, 0, 0);
    soup.push(0, 0, -0.12, ...outerB, ...outerA);
    parts.push(0, 0, 0);
  }
  return soupGeometry(soup, 1, undefined, parts);
}

/** A pebble: a squashed, slightly battered icosahedron with flat facets. */
export function rockGeometry(): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, 0);
  const position = source.getAttribute('position');
  const random = mulberry32(7);
  const moved = new Map<string, [number, number, number]>();
  const soup: Triangles = [];
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const id = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let point = moved.get(id);
    if (!point) {
      const stretch = 0.82 + random() * 0.36;
      point = [x * stretch, Math.max(y * stretch, -0.45), z * stretch];
      moved.set(id, point);
    }
    soup.push(...point);
  }
  source.dispose();
  return soupGeometry(soup, 1.25);
}

/** Three blades of grass as slim pyramids fanning from one root. */
export function tuftGeometry(): THREE.BufferGeometry {
  const soup: Triangles = [];
  const blades: Array<[number, number, number]> = [
    [0, 1, 0],
    [-0.62, 0.72, 0.12],
    [0.6, 0.66, -0.1],
  ];
  blades.forEach(([tx, ty, tz], blade) => {
    const turn = blade * 2.1;
    const base: Array<[number, number, number]> = [0, 1, 2].map((corner) => {
      const angle = turn + (corner / 3) * TAU;
      return [tx * 0.3 + Math.cos(angle) * 0.2, -0.05, tz * 0.3 + Math.sin(angle) * 0.2];
    });
    for (let i = 0; i < 3; i += 1) {
      const a = base[i] as [number, number, number];
      const b = base[(i + 1) % 3] as [number, number, number];
      soup.push(tx, ty, tz, ...b, ...a);
    }
    soup.push(...(base[0] as number[]), ...(base[1] as number[]), ...(base[2] as number[]));
  });
  return soupGeometry(soup, 1);
}

/** The ring plaque: a short elliptical plug facing +z, centred on the origin. */
export function emblemGeometry(
  width: number,
  height: number,
  depth: number,
  tone: number,
): THREE.BufferGeometry {
  const soup: Triangles = [];
  const sides = 16;
  const point = (i: number, z: number): [number, number, number] => {
    const angle = (i / sides) * TAU;
    return [Math.cos(angle) * width, Math.sin(angle) * height, z];
  };
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    soup.push(0, 0, depth, ...point(i, depth), ...point(j, depth));
    soup.push(...point(i, depth), ...point(i, 0), ...point(j, 0));
    soup.push(...point(i, depth), ...point(j, 0), ...point(j, depth));
    soup.push(0, 0, 0, ...point(j, 0), ...point(i, 0));
  }
  return soupGeometry(soup, 1.2, new Float32Array(soup.length / 3).fill(tone));
}

/** Flat marks printed on a surface (the sundial's hour ticks): no hull, so no outline. */
export function decalGeometry(positions: ArrayLike<number>, tone: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const count = positions.length / 3;
  const tones = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    tones[i * 3] = tone;
    tones[i * 3 + 1] = tone;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(positions), 3));
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 3));
  return geometry;
}

/**
 * The wood: one tube mesh for trunk and branches. Rings are shared between segments,
 * so the silhouette is continuous; a child branch simply starts inside its parent.
 * Indices, hull vectors, sway weights and tones are static; `writeWood` only rewrites
 * positions when growth changes.
 */
export interface WoodMesh {
  geometry: THREE.BufferGeometry;
  /** Sides of the ring of every node. */
  sides: Uint8Array;
  /** First vertex of every node's ring. */
  ringStart: Uint32Array;
}

export function woodGeometry(
  skeleton: Skeleton,
  trunkSides: number,
  branchSides: number,
  tone: number,
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

  const hull = new Float32Array(vertices * 3);
  const sway = new Float32Array(vertices * 3);
  const tones = new Float32Array(vertices * 3);
  const indices: number[] = [];
  for (const branch of skeleton.branches) {
    for (let n = 0; n < branch.nodeCount; n += 1) {
      const node = branch.nodeStart + n;
      const count = sides[node] as number;
      const start = ringStart[node] as number;
      for (let s = 0; s < count; s += 1) {
        const angle = (s / count) * TAU;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const v = (start + s) * 3;
        for (let axis = 0; axis < 3; axis += 1) {
          hull[v + axis] =
            cos * (skeleton.nodeFrame[node * 6 + axis] as number) +
            sin * (skeleton.nodeFrame[node * 6 + 3 + axis] as number);
          sway[v + axis] = skeleton.nodeSway[node * 3 + axis] as number;
        }
        tones[v] = tone;
        tones[v + 1] = tone;
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
  geometry.setAttribute('aHull', new THREE.BufferAttribute(hull, 3));
  geometry.setAttribute('aSway', new THREE.BufferAttribute(sway, 3));
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 3));
  geometry.setIndex(indices);
  return { geometry, sides, ringStart };
}

/** Where the rings of a branch that has not started yet are parked: far outside any view. */
const PARKED = -1e5;

export function writeWood(wood: WoodMesh, skeleton: Skeleton, pose: Pose): void {
  const position = wood.geometry.getAttribute('position') as THREE.BufferAttribute;
  const hull = wood.geometry.getAttribute('aHull') as THREE.BufferAttribute;
  const out = position.array as Float32Array;
  const dir = hull.array as Float32Array;
  // A swollen outline pass would still draw a dot around a zero-radius ring, so a
  // branch that does not exist yet must not be anywhere on screen.
  const parked = new Uint8Array(wood.sides.length);
  skeleton.branches.forEach((branch, index) => {
    if ((pose.tipLength[index] as number) <= 0) {
      parked.fill(1, branch.nodeStart, branch.nodeStart + branch.nodeCount);
    }
  });
  for (let node = 0; node < wood.sides.length; node += 1) {
    const radius = pose.nodeRadius[node] as number;
    const x = pose.nodePosition[node * 3] as number;
    const y = parked[node] ? PARKED : (pose.nodePosition[node * 3 + 1] as number);
    const z = pose.nodePosition[node * 3 + 2] as number;
    const start = (wood.ringStart[node] as number) * 3;
    const end = start + (wood.sides[node] as number) * 3;
    for (let v = start; v < end; v += 3) {
      out[v] = x + (dir[v] as number) * radius;
      out[v + 1] = y + (dir[v + 1] as number) * radius;
      out[v + 2] = z + (dir[v + 2] as number) * radius;
    }
  }
  position.needsUpdate = true;
}
