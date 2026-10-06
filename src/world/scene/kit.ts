import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A small modelling kit for the toys that stand on the island: props, landmarks and
 * creatures. A model is a handful of rounded primitives, each painted one colour, merged
 * into a single geometry with a `color` attribute, so a whole bench or mailbox is one
 * draw call and one shared material.
 *
 * Every vertex also carries `aTip` (0 = rigid, up to 1 = sways like a blade of grass), so
 * petals, reeds and carrot tops nod in the same wind as the meadow.
 */

export type Vec3 = readonly [number, number, number];

export interface Place {
  /** Centre of the part. */
  at?: Vec3;
  /** Euler turn in radians, applied x then y then z. */
  rot?: Vec3;
  scale?: Vec3 | number;
  /** The part sways: `aTip` runs 0 at this height to 1 at the second one. */
  sway?: readonly [number, number];
}

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scaling = new THREE.Vector3();
const euler = new THREE.Euler();
const colour = new THREE.Color();

export class Kit {
  private readonly parts: THREE.BufferGeometry[] = [];

  /** Adds any geometry, painted and placed. The geometry is consumed. */
  add(source: THREE.BufferGeometry, hex: string, place: Place = {}): this {
    const { at = [0, 0, 0], rot = [0, 0, 0], scale = 1, sway } = place;
    // Some of three's primitives are indexed and some are not: merge them all unindexed.
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    position.set(at[0], at[1], at[2]);
    quaternion.setFromEuler(euler.set(rot[0], rot[1], rot[2]));
    if (typeof scale === 'number') scaling.setScalar(scale);
    else scaling.set(scale[0], scale[1], scale[2]);
    geometry.applyMatrix4(matrix.compose(position, quaternion, scaling));
    geometry.deleteAttribute('uv');
    const points = geometry.getAttribute('position');
    const colours = new Float32Array(points.count * 3);
    const tips = new Float32Array(points.count);
    colour.set(hex);
    for (let i = 0; i < points.count; i += 1) {
      colours[i * 3] = colour.r;
      colours[i * 3 + 1] = colour.g;
      colours[i * 3 + 2] = colour.b;
      if (sway) {
        const share = (points.getY(i) - sway[0]) / Math.max(1e-4, sway[1] - sway[0]);
        tips[i] = Math.min(1, Math.max(0, share));
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geometry.setAttribute('aTip', new THREE.BufferAttribute(tips, 1));
    this.parts.push(geometry);
    return this;
  }

  box(width: number, height: number, depth: number, hex: string, place?: Place): this {
    return this.add(new THREE.BoxGeometry(width, height, depth), hex, place);
  }

  /** A box with bevelled edges: the chunky, hand-made body of most toys. */
  rbox(
    width: number,
    height: number,
    depth: number,
    radius: number,
    hex: string,
    place?: Place,
  ): this {
    return this.add(new RoundedBoxGeometry(width, height, depth, 1, radius), hex, place);
  }

  /** An upright cylinder or cone frustum (`top` and `bottom` radii). */
  cyl(top: number, bottom: number, height: number, hex: string, place?: Place, sides = 8): this {
    return this.add(new THREE.CylinderGeometry(top, bottom, height, sides, 1), hex, place);
  }

  cone(radius: number, height: number, hex: string, place?: Place, sides = 6): this {
    return this.add(new THREE.ConeGeometry(radius, height, sides, 1), hex, place);
  }

  ball(radius: number, hex: string, place?: Place, detail = 1): this {
    const [across, down] = detail === 0 ? [5, 3] : detail === 1 ? [8, 5] : [12, 8];
    return this.add(new THREE.SphereGeometry(radius, across, down), hex, place);
  }

  /** The upper half of a ball: caps, domes, lids. */
  dome(radius: number, hex: string, place?: Place, sides = 8): this {
    return this.add(
      new THREE.SphereGeometry(radius, sides, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      hex,
      place,
    );
  }

  /** A ring or part of one (`arc` in radians), lying in the xy plane. */
  ring(radius: number, tube: number, hex: string, place?: Place, arc = Math.PI * 2): this {
    return this.add(new THREE.TorusGeometry(radius, tube, 5, 10, arc), hex, place);
  }

  /** A soft dark patch on the lawn, so the toy sits on something on every tier. */
  patch(radius: number, hex = '#2f9f58'): this {
    return this.add(new THREE.CylinderGeometry(radius, radius * 1.08, 0.012, 10, 1), hex, {
      at: [0, 0.004, 0],
    });
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  /**
   * Merges the parts. `grounded` darkens the lowest few centimetres a little, a painted
   * stand-in for the occlusion where a toy meets the grass.
   */
  build(grounded = true): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts, false) ?? new THREE.BufferGeometry();
    for (const part of this.parts) part.dispose();
    this.parts.length = 0;
    if (grounded && merged.getAttribute('position')) {
      const points = merged.getAttribute('position');
      const colours = merged.getAttribute('color');
      for (let i = 0; i < points.count; i += 1) {
        const lift = Math.min(1, Math.max(0, points.getY(i) / 0.22));
        const shade = 0.78 + 0.22 * lift;
        colours.setXYZ(
          i,
          colours.getX(i) * shade,
          colours.getY(i) * shade,
          colours.getZ(i) * shade,
        );
      }
    }
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }
}

/** Triangles of a geometry, for the budget table. */
export function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return index.count / 3;
  const points = geometry.getAttribute('position');
  return points ? points.count / 3 : 0;
}
