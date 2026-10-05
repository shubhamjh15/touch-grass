/**
 * Pooled loose bits: leaves, petals, confetti, drops, dust. Plain typed arrays and no
 * three.js, so the pool runs in tests and never allocates after construction: a spawn
 * overwrites a free slot (or the oldest bit when the pool is full) and a write fills
 * the instance buffers of the scene in place.
 *
 * Bits live in one of two spaces. *Free* bits are in the screen-locked space of the
 * sticker (x right, y up, z towards the viewer, world units) and do not turn with the
 * island. *Anchored* bits store a point of the island and ride it as it turns.
 */

/** How a bit's scale develops over its life. */
export const ENVELOPE = {
  /** Snaps in, shrinks away over the last fifth of its life. */
  chip: 0,
  /** Scale 0 -> 1.25 -> 1 (spring `pop`), holds, then shrinks away. */
  pop: 1,
  /** Full size at once, fades by shrinking over the whole life (dust, soil). */
  puff: 2,
} as const;
export type Envelope = (typeof ENVELOPE)[keyof typeof ENVELOPE];

/** Yaw and pitch of the island this frame, as sines and cosines. */
export interface IslandTurn {
  cosYaw: number;
  sinYaw: number;
  cosPitch: number;
  sinPitch: number;
}

export function createTurn(): IslandTurn {
  return { cosYaw: 1, sinYaw: 0, cosPitch: 1, sinPitch: 0 };
}

export function setTurn(turn: IslandTurn, yaw: number, pitch: number): IslandTurn {
  turn.cosYaw = Math.cos(yaw);
  turn.sinYaw = Math.sin(yaw);
  turn.cosPitch = Math.cos(pitch);
  turn.sinPitch = Math.sin(pitch);
  return turn;
}

/** Island space -> the screen-locked space of the sticker. Writes into `out` (xyz). */
export function toScreenSpace(
  turn: IslandTurn,
  x: number,
  y: number,
  z: number,
  out: Float32Array | number[],
  at = 0,
): void {
  const rx = x * turn.cosYaw + z * turn.sinYaw;
  const rz = -x * turn.sinYaw + z * turn.cosYaw;
  out[at] = rx;
  out[at + 1] = y * turn.cosPitch - rz * turn.sinPitch;
  out[at + 2] = y * turn.sinPitch + rz * turn.cosPitch;
}

/** The inverse: a point of the sticker's screen-locked space back onto the island. */
export function toIslandSpace(
  turn: IslandTurn,
  x: number,
  y: number,
  z: number,
  out: Float32Array | number[],
  at = 0,
): void {
  const iy = y * turn.cosPitch + z * turn.sinPitch;
  const rz = -y * turn.sinPitch + z * turn.cosPitch;
  out[at] = x * turn.cosYaw - rz * turn.sinYaw;
  out[at + 1] = iy;
  out[at + 2] = x * turn.sinYaw + rz * turn.cosYaw;
}

const POP_IN = 0.22;
const POP_OUT = 0.16;

/** Scale share (may exceed 1) of a bit of `age` seconds with `life` seconds to live. */
export function envelopeAt(envelope: number, age: number, life: number): number {
  if (age <= 0 || age >= life) return 0;
  if (envelope === ENVELOPE.pop) {
    const out = Math.min(1, (life - age) / POP_OUT);
    if (age >= POP_IN) return out;
    // Spring `pop`: about a fifth of overshoot, once.
    const x = age / POP_IN;
    return (1 + 0.25 * Math.sin(Math.PI * x) * (1 - x * 0.2)) * Math.min(1, x * 2.2) * out;
  }
  if (envelope === ENVELOPE.puff) {
    const x = age / life;
    return (0.55 + 0.45 * Math.min(1, x * 6)) * (1 - x * x);
  }
  const fadeFrom = life * 0.8;
  const snap = Math.min(1, age / 0.05);
  return age > fadeFrom ? snap * (1 - (age - fadeFrom) / (life - fadeFrom)) : snap;
}

const scratch = [0, 0, 0];

export class ParticlePool {
  readonly capacity: number;
  /** Position and velocity (free: screen-locked space; anchored: island space). */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  /** Negative age = still waiting (stagger). */
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly sx: Float32Array;
  readonly sy: Float32Array;
  readonly sz: Float32Array;
  /** Roll in the screen plane and its speed. */
  readonly angle: Float32Array;
  readonly spin: Float32Array;
  /** Tumble: the bit turns over like falling paper (its height is scaled by a cosine). */
  readonly flip: Float32Array;
  readonly flipRate: Float32Array;
  readonly gravity: Float32Array;
  readonly drag: Float32Array;
  /** Sideways flutter amplitude (units per second) and its phase. */
  readonly flutter: Float32Array;
  readonly phase: Float32Array;
  readonly tone: Float32Array;
  readonly envelope: Uint8Array;
  readonly anchored: Uint8Array;
  readonly alive: Uint8Array;
  private cursor = 0;
  private liveCount = 0;

  constructor(capacity: number) {
    const n = Math.max(1, Math.floor(capacity));
    this.capacity = n;
    const floats = () => new Float32Array(n);
    this.x = floats();
    this.y = floats();
    this.z = floats();
    this.vx = floats();
    this.vy = floats();
    this.vz = floats();
    this.age = floats();
    this.life = floats();
    this.sx = floats();
    this.sy = floats();
    this.sz = floats();
    this.angle = floats();
    this.spin = floats();
    this.flip = floats();
    this.flipRate = floats();
    this.gravity = floats();
    this.drag = floats();
    this.flutter = floats();
    this.phase = floats();
    this.tone = floats();
    this.envelope = new Uint8Array(n);
    this.anchored = new Uint8Array(n);
    this.alive = new Uint8Array(n);
  }

  /** Bits alive or waiting to appear. */
  get live(): number {
    return this.liveCount;
  }

  /**
   * Claims a slot and resets it to a motionless, zero-sized bit; the caller then fills
   * in what it needs. When the pool is full the oldest bit is recycled.
   */
  spawn(): number {
    let index = -1;
    for (let probe = 0; probe < this.capacity; probe += 1) {
      const candidate = (this.cursor + probe) % this.capacity;
      if (!this.alive[candidate]) {
        index = candidate;
        break;
      }
    }
    if (index < 0) {
      let oldest = -1;
      for (let i = 0; i < this.capacity; i += 1) {
        const share = (this.age[i] as number) / Math.max(1e-6, this.life[i] as number);
        if (share > oldest) {
          oldest = share;
          index = i;
        }
      }
      this.liveCount -= 1;
    }
    this.cursor = (index + 1) % this.capacity;
    this.alive[index] = 1;
    this.liveCount += 1;
    this.x[index] = 0;
    this.y[index] = 0;
    this.z[index] = 0;
    this.vx[index] = 0;
    this.vy[index] = 0;
    this.vz[index] = 0;
    this.age[index] = 0;
    this.life[index] = 1;
    this.sx[index] = 0.1;
    this.sy[index] = 0.1;
    this.sz[index] = 0.1;
    this.angle[index] = 0;
    this.spin[index] = 0;
    this.flip[index] = 0;
    this.flipRate[index] = 0;
    this.gravity[index] = 0;
    this.drag[index] = 0;
    this.flutter[index] = 0;
    this.phase[index] = 0;
    this.tone[index] = 0;
    this.envelope[index] = ENVELOPE.chip;
    this.anchored[index] = 0;
    return index;
  }

  /** Integrates every bit by `dt` seconds and retires the ones whose life is over. */
  step(dt: number): void {
    if (this.liveCount === 0 || dt <= 0) return;
    for (let i = 0; i < this.capacity; i += 1) {
      if (!this.alive[i]) continue;
      const age = (this.age[i] as number) + dt;
      this.age[i] = age;
      if (age >= (this.life[i] as number)) {
        this.alive[i] = 0;
        this.liveCount -= 1;
        continue;
      }
      if (age <= 0) continue;
      const keep = Math.exp(-(this.drag[i] as number) * dt);
      const vx = (this.vx[i] as number) * keep;
      const vy = ((this.vy[i] as number) - (this.gravity[i] as number) * dt) * keep;
      const vz = (this.vz[i] as number) * keep;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.vz[i] = vz;
      const sway =
        (this.flutter[i] as number) * Math.sin(age * 5.3 + (this.phase[i] as number) * 6.2832);
      this.x[i] = (this.x[i] as number) + (vx + sway) * dt;
      this.y[i] = (this.y[i] as number) + vy * dt;
      this.z[i] = (this.z[i] as number) + vz * dt;
      this.angle[i] = (this.angle[i] as number) + (this.spin[i] as number) * dt;
      this.flip[i] = (this.flip[i] as number) + (this.flipRate[i] as number) * dt;
    }
  }

  /**
   * Writes one column-major 4x4 and one tone triple per visible bit, compacted from
   * instance `from` on. Returns the index after the last instance written.
   */
  write(matrices: Float32Array, tones: Float32Array, from: number, turn: IslandTurn): number {
    let slot = from;
    if (this.liveCount === 0) return slot;
    const room = Math.min(matrices.length / 16, tones.length / 3);
    for (let i = 0; i < this.capacity && slot < room; i += 1) {
      if (!this.alive[i]) continue;
      const scale = envelopeAt(
        this.envelope[i] as number,
        this.age[i] as number,
        this.life[i] as number,
      );
      if (scale <= 0) continue;
      let px = this.x[i] as number;
      let py = this.y[i] as number;
      let pz = this.z[i] as number;
      if (this.anchored[i]) {
        toScreenSpace(turn, px, py, pz, scratch);
        px = scratch[0] as number;
        py = scratch[1] as number;
        pz = scratch[2] as number;
      }
      const cos = Math.cos(this.angle[i] as number);
      const sin = Math.sin(this.angle[i] as number);
      const sx = (this.sx[i] as number) * scale;
      // A tumbling chip never goes fully edge-on: paper always shows a sliver.
      const turnOver = Math.cos(this.flip[i] as number);
      const sy = (this.sy[i] as number) * scale * (0.25 + 0.75 * Math.abs(turnOver));
      const at = slot * 16;
      matrices[at] = cos * sx;
      matrices[at + 1] = sin * sx;
      matrices[at + 2] = 0;
      matrices[at + 3] = 0;
      matrices[at + 4] = -sin * sy;
      matrices[at + 5] = cos * sy;
      matrices[at + 6] = 0;
      matrices[at + 7] = 0;
      matrices[at + 8] = 0;
      matrices[at + 9] = 0;
      matrices[at + 10] = (this.sz[i] as number) * scale;
      matrices[at + 11] = 0;
      matrices[at + 12] = px;
      matrices[at + 13] = py;
      matrices[at + 14] = pz;
      matrices[at + 15] = 1;
      const tone = this.tone[i] as number;
      tones[slot * 3] = tone;
      tones[slot * 3 + 1] = tone;
      tones[slot * 3 + 2] = 0;
      slot += 1;
    }
    return slot;
  }

  clear(): void {
    this.alive.fill(0);
    this.liveCount = 0;
    this.cursor = 0;
  }
}

/** Writes a flat, rolled instance (a mover: a wing, a blade, a body) at `slot`. */
export function writeInstance(
  matrices: Float32Array,
  tones: Float32Array,
  slot: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  angle: number,
  tone: number,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = slot * 16;
  matrices[at] = cos * sx;
  matrices[at + 1] = sin * sx;
  matrices[at + 2] = 0;
  matrices[at + 3] = 0;
  matrices[at + 4] = -sin * sy;
  matrices[at + 5] = cos * sy;
  matrices[at + 6] = 0;
  matrices[at + 7] = 0;
  matrices[at + 8] = 0;
  matrices[at + 9] = 0;
  matrices[at + 10] = sz;
  matrices[at + 11] = 0;
  matrices[at + 12] = x;
  matrices[at + 13] = y;
  matrices[at + 14] = z;
  matrices[at + 15] = 1;
  tones[slot * 3] = tone;
  tones[slot * 3 + 1] = tone;
  tones[slot * 3 + 2] = 0;
}
