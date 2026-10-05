/**
 * A tiny modelling kit for props: boxes, prisms, slabs, cylinders and balls appended to
 * one triangle soup, each vertex tagged with a tone, a shading normal, a gloss flag, its
 * two slots and its wind weights. Plain arrays, no three.js: the same models feed the
 * WebGL mesh, the budget estimate and the tests.
 *
 * Model space: y up, +z towards the viewer at the rest camera, +x to the viewer's right.
 * One unit is one world unit (the lawn's radius is 3).
 */

type P3 = readonly [number, number, number];
type P2 = readonly [number, number];

const TAU = Math.PI * 2;

export interface ModelData {
  positions: number[];
  normals: number[];
  tones: number[];
  /** 1 where the surface is glossy. */
  gloss: number[];
  /** Pivot xyz and slot of the moving part a vertex belongs to (slot 0 = none). */
  inner: number[];
  /** Pivot xyz and slot of the prop a vertex belongs to. */
  outer: number[];
  /** Wind weights per vertex: lean, bob, phase. */
  sway: number[];
}

interface BoxOptions {
  /** Roll about the box's own z axis (the screen-facing axis at rest), radians. */
  roll?: number;
  /** Pitch about the box's own x axis, radians. */
  pitch?: number;
  gloss?: boolean;
}

interface RoundOptions {
  sides?: number;
  smooth?: boolean;
  gloss?: boolean;
}

export class ModelBuilder {
  readonly data: ModelData = {
    positions: [],
    normals: [],
    tones: [],
    gloss: [],
    inner: [],
    outer: [],
    sway: [],
  };

  private ox = 0;
  private oy = 0;
  private oz = 0;
  private cos = 1;
  private sin = 0;
  private size = 1;
  private outerSlot = 0;
  private outerPivot: P3 = [0, 0, 0];
  private innerSlot = 0;
  private innerPivot: P3 = [0, 0, 0];
  private bendHeight = 0;
  private bendLean = 0;
  private bendBob = 0;
  private bendPhase = 0;
  private rigid: P3 | null = null;

  get triangles(): number {
    return this.data.positions.length / 9;
  }

  /** Starts a prop: where its model origin stands on the island, and its slot. */
  place(x: number, y: number, z: number, yaw: number, slot: number, size = 1): this {
    this.ox = x;
    this.oy = y;
    this.oz = z;
    this.cos = Math.cos(yaw);
    this.sin = Math.sin(yaw);
    this.size = size;
    this.outerSlot = slot;
    this.outerPivot = [x, y, z];
    this.innerSlot = 0;
    this.innerPivot = [x, y, z];
    this.bendHeight = 0;
    this.rigid = null;
    return this;
  }

  /** The prop's pivot, in model space (default: its origin). A hanging prop pivots where it hangs. */
  pivot(local: P3): this {
    this.outerPivot = this.world(local);
    return this;
  }

  /** Following primitives belong to a moving part with this slot and pivot (model space). */
  part(slot: number, pivot: P3 = [0, 0, 0]): this {
    this.innerSlot = slot;
    this.innerPivot = this.world(pivot);
    return this;
  }

  /** Back to the prop's static body. */
  body(): this {
    this.innerSlot = 0;
    this.innerPivot = this.outerPivot;
    return this;
  }

  /** Following primitives bend in the wind: nothing at the ground, fully at `height`. */
  bend(height: number, lean: number, bob: number, phase: number): this {
    this.bendHeight = height;
    this.bendLean = lean;
    this.bendBob = bob;
    this.bendPhase = phase;
    this.rigid = null;
    return this;
  }

  /** Following primitives move rigidly with these wind weights (a prop hung on a branch). */
  ride(weights: P3 | null): this {
    this.rigid = weights;
    this.bendHeight = 0;
    return this;
  }

  private world(local: P3): [number, number, number] {
    const x = local[0] * this.size;
    const z = local[2] * this.size;
    return [
      this.ox + x * this.cos + z * this.sin,
      this.oy + local[1] * this.size,
      this.oz - x * this.sin + z * this.cos,
    ];
  }

  private turn(normal: P3): [number, number, number] {
    return [
      normal[0] * this.cos + normal[2] * this.sin,
      normal[1],
      -normal[0] * this.sin + normal[2] * this.cos,
    ];
  }

  private vertex(local: P3, normal: P3, tone: number, gloss: boolean): void {
    const d = this.data;
    d.positions.push(...this.world(local));
    d.normals.push(...this.turn(normal));
    d.tones.push(tone);
    d.gloss.push(gloss ? 1 : 0);
    d.inner.push(...this.innerPivot, this.innerSlot);
    d.outer.push(...this.outerPivot, this.outerSlot);
    if (this.rigid) {
      d.sway.push(...this.rigid);
    } else if (this.bendHeight > 0) {
      const t = Math.min(1, Math.max(0, local[1] / this.bendHeight));
      d.sway.push(this.bendLean * t, this.bendBob * t * t, this.bendPhase);
    } else {
      d.sway.push(0, 0, 0);
    }
  }

  /** One flat-shaded triangle, counter-clockwise seen from outside. */
  tri(a: P3, b: P3, c: P3, tone: number, gloss = false): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    const n: P3 = [nx, ny, nz];
    this.vertex(a, n, tone, gloss);
    this.vertex(b, n, tone, gloss);
    this.vertex(c, n, tone, gloss);
  }

  private smoothTri(a: P3, b: P3, c: P3, na: P3, nb: P3, nc: P3, tone: number, gloss: boolean) {
    this.vertex(a, na, tone, gloss);
    this.vertex(b, nb, tone, gloss);
    this.vertex(c, nc, tone, gloss);
  }

  quad(a: P3, b: P3, c: P3, d: P3, tone: number, gloss = false): void {
    this.tri(a, b, c, tone, gloss);
    this.tri(a, c, d, tone, gloss);
  }

  /** A box centred on (cx, cy, cz). */
  box(
    cx: number,
    cy: number,
    cz: number,
    width: number,
    height: number,
    depth: number,
    tone: number,
    options: BoxOptions = {},
  ): this {
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;
    const cr = Math.cos(options.roll ?? 0);
    const sr = Math.sin(options.roll ?? 0);
    const cp = Math.cos(options.pitch ?? 0);
    const sp = Math.sin(options.pitch ?? 0);
    const corner = (sx: number, sy: number, sz: number): P3 => {
      // Pitch about x first, then roll about z.
      const y1 = sy * hh * cp - sz * hd * sp;
      const z1 = sy * hh * sp + sz * hd * cp;
      const x1 = sx * hw;
      return [cx + x1 * cr - y1 * sr, cy + x1 * sr + y1 * cr, cz + z1];
    };
    const gloss = options.gloss ?? false;
    const [lbf, rbf, rtf, ltf] = [
      corner(-1, -1, 1),
      corner(1, -1, 1),
      corner(1, 1, 1),
      corner(-1, 1, 1),
    ];
    const [lbb, rbb, rtb, ltb] = [
      corner(-1, -1, -1),
      corner(1, -1, -1),
      corner(1, 1, -1),
      corner(-1, 1, -1),
    ];
    this.quad(lbf, rbf, rtf, ltf, tone, gloss);
    this.quad(rbb, lbb, ltb, rtb, tone, gloss);
    this.quad(ltf, rtf, rtb, ltb, tone, gloss);
    this.quad(lbb, rbb, rbf, lbf, tone, gloss);
    this.quad(rbf, rbb, rtb, rtf, tone, gloss);
    this.quad(lbb, lbf, ltf, ltb, tone, gloss);
    return this;
  }

  /**
   * A flat board: a convex polygon in the model's xy plane (counter-clockwise seen from
   * +z), extruded from z0 to z1. Arrows, roofs, wings, tags, flower heads.
   */
  slab(points: readonly P2[], z0: number, z1: number, tone: number, gloss = false): this {
    const count = points.length;
    const centre = points.reduce<[number, number]>(
      (sum, point) => [sum[0] + point[0] / count, sum[1] + point[1] / count],
      [0, 0],
    );
    for (let i = 0; i < count; i += 1) {
      const a = points[i] as P2;
      const b = points[(i + 1) % count] as P2;
      this.tri([centre[0], centre[1], z1], [a[0], a[1], z1], [b[0], b[1], z1], tone, gloss);
      this.tri([centre[0], centre[1], z0], [b[0], b[1], z0], [a[0], a[1], z0], tone, gloss);
      this.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], tone);
    }
    return this;
  }

  /**
   * A plate lying on the ground: a convex polygon in the xz plane (counter-clockwise
   * seen from above), from y0 up to y1. Ponds, beds, lily pads.
   */
  plate(points: readonly P2[], y0: number, y1: number, tone: number, gloss = false): this {
    const count = points.length;
    const centre = points.reduce<[number, number]>(
      (sum, point) => [sum[0] + point[0] / count, sum[1] + point[1] / count],
      [0, 0],
    );
    for (let i = 0; i < count; i += 1) {
      const a = points[i] as P2;
      const b = points[(i + 1) % count] as P2;
      this.tri([centre[0], y1, centre[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], tone, gloss);
      this.tri([centre[0], y0, centre[1]], [b[0], y0, b[1]], [a[0], y0, a[1]], tone, gloss);
      this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], tone);
    }
    return this;
  }

  /** An upright cylinder or cone frustum standing on (cx, y0, cz). `r1` = 0 makes a cone. */
  cyl(
    cx: number,
    y0: number,
    cz: number,
    r0: number,
    r1: number,
    height: number,
    tone: number,
    options: RoundOptions = {},
  ): this {
    const sides = options.sides ?? 7;
    const smooth = options.smooth ?? true;
    const gloss = options.gloss ?? false;
    const y1 = y0 + height;
    const slope = (r0 - r1) / (height || 1);
    const ring = (i: number, radius: number, y: number): P3 => {
      const angle = (i / sides) * TAU;
      return [cx + Math.sin(angle) * radius, y, cz + Math.cos(angle) * radius];
    };
    const out = (i: number): P3 => {
      const angle = (i / sides) * TAU;
      const length = Math.hypot(1, slope);
      return [Math.sin(angle) / length, slope / length, Math.cos(angle) / length];
    };
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides;
      const [a0, b0, a1, b1] = [ring(i, r0, y0), ring(j, r0, y0), ring(i, r1, y1), ring(j, r1, y1)];
      if (smooth) {
        this.smoothTri(a0, b0, b1, out(i), out(j), out(j), tone, gloss);
        if (r1 > 0) this.smoothTri(a0, b1, a1, out(i), out(j), out(i), tone, gloss);
      } else {
        this.tri(a0, b0, b1, tone, gloss);
        if (r1 > 0) this.tri(a0, b1, a1, tone, gloss);
      }
      this.tri([cx, y0, cz], b0, a0, tone, gloss);
      if (r1 > 0) this.tri([cx, y1, cz], a1, b1, tone, gloss);
    }
    return this;
  }

  /** An ellipsoid centred on (cx, cy, cz), smooth-shaded. */
  ball(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    tone: number,
    options: { gloss?: boolean; rings?: number; sides?: number } = {},
  ): this {
    const rings = options.rings ?? 4;
    const sides = options.sides ?? 7;
    const gloss = options.gloss ?? false;
    const at = (ring: number, side: number): { p: P3; n: P3 } => {
      const polar = (ring / rings) * Math.PI;
      const angle = (side / sides) * TAU;
      const n: P3 = [
        Math.sin(polar) * Math.sin(angle),
        Math.cos(polar),
        Math.sin(polar) * Math.cos(angle),
      ];
      return { p: [cx + n[0] * rx, cy + n[1] * ry, cz + n[2] * rz], n };
    };
    for (let ring = 0; ring < rings; ring += 1) {
      for (let side = 0; side < sides; side += 1) {
        const a = at(ring, side);
        const b = at(ring, side + 1);
        const c = at(ring + 1, side + 1);
        const d = at(ring + 1, side);
        if (ring > 0) this.smoothTri(a.p, d.p, b.p, a.n, d.n, b.n, tone, gloss);
        if (ring < rings - 1) this.smoothTri(b.p, d.p, c.p, b.n, d.n, c.n, tone, gloss);
      }
    }
    return this;
  }

  /** A regular polygon in the xy plane, for `slab`. */
  static disc(cx: number, cy: number, radius: number, sides: number, turn = 0): P2[] {
    return Array.from({ length: sides }, (_, i) => {
      const angle = turn + (i / sides) * TAU;
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
    });
  }

  /** An ellipse in the xz plane, counter-clockwise seen from above, for `plate`. */
  static oval(cx: number, cz: number, rx: number, rz: number, sides: number): P2[] {
    return Array.from({ length: sides }, (_, i) => {
      const angle = -(i / sides) * TAU;
      return [cx + Math.cos(angle) * rx, cz + Math.sin(angle) * rz] as const;
    });
  }
}
