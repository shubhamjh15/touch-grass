import * as THREE from 'three';
import { smoothstep } from '@/lib/math';
import { createRng } from '@/lib/rng';
import type { Terrain } from '../terrain';
import { orient } from './geometry';

/**
 * The island as two meshes:
 *
 *   - the lawn: a smooth, rolling grass surface with vertex colours (meadow greens, soil
 *     under the tree, sand around the pond and along the stream) that rolls over the rim
 *     into a thick grass lip;
 *   - the rock: the faceted underside, stepped in strata from a soil band under the lip
 *     down to a ragged point, flat-shaded so every facet catches the light on its own.
 */

const TAU = Math.PI * 2;

const hex = (value: string) => new THREE.Color(value);

const LAWN = {
  light: hex('#8fe07a'),
  mid: hex('#6fd06a'),
  deep: hex('#4fb85e'),
  soil: hex('#a9794e'),
  sand: hex('#ead7a4'),
  bed: hex('#b9a06c'),
  lip: hex('#4cae5a'),
  under: hex('#2f8a48'),
};

const ROCK = [
  hex('#7a5236'),
  hex('#dcb98e'),
  hex('#c99f70'),
  hex('#e4c79d'),
  hex('#b98a5c'),
  hex('#cfa679'),
  hex('#a57a50'),
  hex('#8c6644'),
];

function distanceToLine(x: number, z: number, points: Array<[number, number]>): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i] as [number, number];
    const [bx, bz] = points[i + 1] as [number, number];
    const dx = bx - ax;
    const dz = bz - az;
    const span = dx * dx + dz * dz;
    const t = span > 1e-9 ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / span)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/** Colour of the lawn at a point: the meadow, with soil, sand and water beds painted in. */
export function lawnColour(terrain: Terrain, x: number, z: number, out: THREE.Color): THREE.Color {
  const patch =
    0.5 +
    0.5 * Math.sin(x * 1.7 + terrain.seed) * Math.cos(z * 1.3 - terrain.seed * 0.7) +
    0.25 * Math.sin(x * 4.1 + z * 3.3);
  out.copy(LAWN.mid).lerp(LAWN.light, Math.min(1, Math.max(0, patch)));
  const rho = Math.hypot(x, z) / terrain.coast(Math.atan2(z, x));
  out.lerp(LAWN.deep, smoothstep(0.62, 1, rho) * 0.75);
  const fromTree = Math.hypot(x - terrain.tree[0], z - terrain.tree[2]);
  out.lerp(LAWN.soil, 1 - smoothstep(0.26, 0.62, fromTree));
  const { pond, stream } = terrain;
  const fromPond = Math.hypot(x - pond.x, z - pond.z);
  const fromStream = distanceToLine(x, z, stream.points);
  const wet = Math.max(
    1 - smoothstep(pond.radius * 1.0, pond.radius * 1.42, fromPond),
    1 - smoothstep(stream.halfWidth * 1.3, stream.halfWidth * 2.6, fromStream),
  );
  out.lerp(LAWN.sand, wet);
  const bed = Math.max(
    1 - smoothstep(pond.radius * 0.5, pond.radius * 0.95, fromPond),
    1 - smoothstep(stream.halfWidth * 0.4, stream.halfWidth * 1.1, fromStream),
  );
  out.lerp(LAWN.bed, bed);
  return out;
}

export function lawnGeometry(terrain: Terrain, segments: number): THREE.BufferGeometry {
  const rings = Math.max(10, Math.round(segments * 0.36));
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const colour = new THREE.Color();

  const centre = terrain.height(0, 0);
  positions.push(0, centre, 0);
  lawnColour(terrain, 0, 0, colour);
  colours.push(colour.r, colour.g, colour.b);

  const ringStart = (ring: number) => 1 + (ring - 1) * segments;
  for (let ring = 1; ring <= rings; ring += 1) {
    // Rings crowd towards the rim, where the lawn bends the most.
    const share = (ring / rings) ** 0.85;
    for (let s = 0; s < segments; s += 1) {
      const angle = (s / segments) * TAU;
      const radius = terrain.coast(angle) * share;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions.push(x, terrain.height(x, z), z);
      lawnColour(terrain, x, z, colour);
      colours.push(colour.r, colour.g, colour.b);
    }
  }
  for (let s = 0; s < segments; s += 1) {
    indices.push(0, ringStart(1) + s, ringStart(1) + ((s + 1) % segments));
  }
  for (let ring = 1; ring < rings; ring += 1) {
    for (let s = 0; s < segments; s += 1) {
      const a = ringStart(ring) + s;
      const b = ringStart(ring) + ((s + 1) % segments);
      const c = ringStart(ring + 1) + s;
      const d = ringStart(ring + 1) + ((s + 1) % segments);
      indices.push(a, c, d, a, d, b);
    }
  }

  // The lip: the grass rolls over the rim, bulges out and tucks back under.
  const lip = [
    { out: 0.07, down: 0.05, colour: LAWN.deep },
    { out: 0.1, down: 0.17, colour: LAWN.lip },
    { out: 0.03, down: 0.3, colour: LAWN.under },
    { out: -0.16, down: 0.36, colour: LAWN.under },
  ];
  let previous = ringStart(rings);
  for (const step of lip) {
    const start = positions.length / 3;
    for (let s = 0; s < segments; s += 1) {
      const angle = (s / segments) * TAU;
      const edge = terrain.coast(angle);
      const radius = edge + step.out;
      const top = terrain.height(Math.cos(angle) * edge, Math.sin(angle) * edge);
      // The hem of the turf hangs unevenly.
      const ragged = step.down > 0.2 ? 0.05 * Math.sin(angle * 9 + terrain.seed) : 0;
      positions.push(Math.cos(angle) * radius, top - step.down + ragged, Math.sin(angle) * radius);
      colours.push(step.colour.r, step.colour.g, step.colour.b);
    }
    for (let s = 0; s < segments; s += 1) {
      const next = (s + 1) % segments;
      indices.push(
        previous + s,
        start + s,
        start + next,
        previous + s,
        start + next,
        previous + next,
      );
    }
    previous = start;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  // The lawn looks up; each step of the lip looks a little further down and out.
  const lawnTriangles = segments + (rings - 1) * segments * 2;
  return orient(geometry, (x, _y, z, triangle) => {
    if (triangle < lawnTriangles) return [0, 1, 0];
    const step = Math.floor((triangle - lawnTriangles) / (segments * 2));
    if (step === 0) return [x, 6, z];
    if (step === 1) return [x, 0, z];
    if (step === 2) return [x, -2, z];
    return [0, -1, 0];
  });
}

/** The rock underside. Fewer segments than the lawn on purpose: big facets read as stone. */
export function rockGeometry(terrain: Terrain, segments: number): THREE.BufferGeometry {
  const rng = createRng(terrain.seed, 'rock', 1);
  const around = Math.max(14, Math.round(segments * 0.5));
  const strata = ROCK.length;
  const depth = terrain.depth;
  const phases = Array.from({ length: strata + 1 }, () => [rng() * TAU, rng() * TAU, rng() * 0.5]);
  const offsets = Array.from({ length: strata + 1 }, (_, k) => [
    (rng() - 0.5) * 0.12 * k,
    (rng() - 0.5) * 0.12 * k,
  ]);

  /** Ring of stratum `k` at its `edge` (0 = upper, 1 = lower). */
  const ring = (k: number, edge: number): THREE.Vector3[] => {
    const level = k / strata;
    const [p1, p2, squash] = phases[k] as [number, number, number];
    const [ox, oz] = offsets[k] as [number, number];
    // Bulky under the turf, then drawing in fast; every other stratum juts out a little.
    const taper = ((1 - level ** 1.7) * 0.86 + 0.045) * (k % 2 === 1 ? 1.07 : 0.97);
    const y = -0.34 - (depth - 0.34) * ((k + edge) / strata) ** 1.08;
    return Array.from({ length: around }, (_, s) => {
      const angle = (s / around) * TAU;
      const lumps =
        1 +
        0.1 * Math.sin(angle * 3 + p1) +
        0.07 * Math.sin(angle * 5 + p2) +
        (((s * 7 + k * 3) % 5) - 2) * 0.022;
      // A stratum narrows a little towards its own lower edge, then the next one steps in.
      const radius = terrain.coast(angle) * taper * lumps * (1 - edge * (0.1 + squash * 0.22));
      const sag = (((s * 5 + k) % 4) - 1.5) * 0.03 * edge;
      return new THREE.Vector3(
        ox + Math.cos(angle) * radius,
        y + sag,
        oz + Math.sin(angle) * radius,
      );
    });
  };

  const positions: number[] = [];
  const colours: number[] = [];
  const colour = new THREE.Color();
  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, tone: THREE.Color) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    // Each facet takes its own slightly different shade.
    const jitter = 0.9 + rng() * 0.2;
    colour.copy(tone).multiplyScalar(jitter);
    for (let i = 0; i < 3; i += 1) colours.push(colour.r, colour.g, colour.b);
  };
  const quad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    tone: THREE.Color,
  ) => {
    face(a, b, c, tone);
    face(a, c, d, tone);
  };

  let above: THREE.Vector3[] | null = null;
  for (let k = 0; k < strata; k += 1) {
    const upper = ring(k, 0);
    const lower = ring(k, 1);
    const tone = ROCK[k] as THREE.Color;
    for (let s = 0; s < around; s += 1) {
      const next = (s + 1) % around;
      // The ledge between the stratum above and this one, then this one's cliff.
      if (above) {
        quad(
          above[s] as THREE.Vector3,
          above[next] as THREE.Vector3,
          upper[next] as THREE.Vector3,
          upper[s] as THREE.Vector3,
          tone,
        );
      }
      quad(
        upper[s] as THREE.Vector3,
        upper[next] as THREE.Vector3,
        lower[next] as THREE.Vector3,
        lower[s] as THREE.Vector3,
        tone,
      );
    }
    above = lower;
  }
  // The point: a short fan closing the last stratum.
  const last = above as THREE.Vector3[];
  const tip = new THREE.Vector3((rng() - 0.5) * 0.3, -depth - 0.25, (rng() - 0.5) * 0.3);
  for (let s = 0; s < around; s += 1) {
    face(
      last[s] as THREE.Vector3,
      last[(s + 1) % around] as THREE.Vector3,
      tip,
      ROCK[strata - 1] as THREE.Color,
    );
  }
  // A lid under the turf, so the grass lip never shows daylight through its hem.
  const lid = ring(0, 0);
  const middle = new THREE.Vector3(0, -0.3, 0);
  for (let s = 0; s < around; s += 1) {
    face(
      lid[s] as THREE.Vector3,
      middle,
      lid[(s + 1) % around] as THREE.Vector3,
      ROCK[0] as THREE.Color,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  // Flat shading needs unshared vertices; make every facet look away from the island's axis.
  const count = positions.length / 9;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let t = 0; t < count; t += 1) {
    a.fromBufferAttribute(position, t * 3);
    b.fromBufferAttribute(position, t * 3 + 1);
    c.fromBufferAttribute(position, t * 3 + 2);
    normal.subVectors(b, a).cross(c.clone().sub(a));
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    // Outwards and downwards from a point high on the axis.
    if (normal.x * cx + normal.y * (cy - 0.6) + normal.z * cz < 0) {
      position.setXYZ(t * 3 + 1, c.x, c.y, c.z);
      position.setXYZ(t * 3 + 2, b.x, b.y, b.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}
