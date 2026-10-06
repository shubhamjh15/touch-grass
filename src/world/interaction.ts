import { clamp, damp } from '@/lib/math';
import { CAMERA, ORBIT } from './config';
import type { StageMode } from './contract';

/**
 * How the island turns: the idle motion of each stage mode plus what the user does to
 * it (drag with inertia, hover parallax, arrow keys). Pure state and maths, stepped once
 * per frame by the tracker; pointer and keyboard handlers on the stage element only
 * feed it numbers. The scene applies the yaw as a camera orbit about the tree, so the
 * sun, the shadows and the sky stay where they are while the user looks around.
 */

const TAU = Math.PI * 2;
const nearestTurn = (angle: number) => Math.round(angle / TAU) * TAU;

export class OrbitController {
  /** Total yaw of the island this frame, radians. */
  yaw = 0;
  /** Extra camera elevation this frame, radians (drag tilt and hover parallax). */
  pitch = 0;
  /** True while the user is dragging or the island is still coasting. */
  moving = false;

  private user = 0;
  private velocity = 0;
  private tilt = 0;
  private idle = 0;
  private drift = 0;
  private driftClock = 0;
  /** 0 while the user is in charge, eased back to 1 when the idle motion resumes. */
  private idleGain = 1;
  private sinceRelease = Number.POSITIVE_INFINITY;
  private dragging = false;
  private dragged = 0;
  private pendingKeys = 0;
  private hoverX = 0;
  private hoverY = 0;
  private hoverYaw = 0;
  private hoverPitch = 0;

  get isDragging(): boolean {
    return this.dragging;
  }

  dragStart(): void {
    this.dragging = true;
    this.dragged = 0;
    this.velocity = 0;
    this.sinceRelease = 0;
  }

  /**
   * Pointer movement since the last call, as shares of the stage width and height.
   * One stage width turns the island 216 degrees; vertical movement tilts it a little.
   */
  dragMove(dxShare: number, dyShare: number): void {
    if (!this.dragging) return;
    const turn = dxShare * ORBIT.perStageWidth;
    this.user += turn;
    this.dragged += turn;
    // Beyond the limit the tilt rubber-bands: each extra pixel moves it less.
    const over = Math.max(0, Math.abs(this.tilt) / ORBIT.maxTilt - 0.6);
    this.tilt = clamp(
      this.tilt + (dyShare * ORBIT.maxTilt * 2.4) / (1 + over * 4),
      -ORBIT.maxTilt * 1.3,
      ORBIT.maxTilt * 1.3,
    );
  }

  dragEnd(): void {
    this.dragging = false;
    this.sinceRelease = 0;
  }

  /** Pointer position over the stage, -1..1 from its centre; `null` when it leaves. */
  hover(x: number | null, y: number | null): void {
    this.hoverX = x === null ? 0 : clamp(x, -1, 1);
    this.hoverY = y === null ? 0 : clamp(y, -1, 1);
  }

  /** Arrow keys: `steps` of 30 degrees, eased. Positive turns the front to the right. */
  nudge(steps: number): void {
    this.pendingKeys += steps * ORBIT.keyStep;
    this.sinceRelease = 0;
  }

  /** Up and down arrow keys: tips the camera a step; it eases back like a released drag. */
  lift(steps: number): void {
    this.tilt = clamp(this.tilt + steps * ORBIT.maxTilt * 0.6, -ORBIT.maxTilt, ORBIT.maxTilt * 1.3);
    this.sinceRelease = 0;
  }

  /** Back to the rest pose (Home key). */
  reset(): void {
    this.pendingKeys = nearestTurn(this.user) - this.user;
    this.sinceRelease = 0;
  }

  step(dt: number, mode: StageMode, reduced: boolean, interactive: boolean): void {
    const idle = CAMERA.idle[mode];
    if (!interactive && this.dragging) this.dragEnd();

    // What the user drives.
    if (this.dragging) {
      // Velocity follows the drag, so releasing hands over to inertia without a jump.
      if (dt > 0) {
        const speed = clamp(this.dragged / dt, -ORBIT.maxSpeed, ORBIT.maxSpeed);
        this.velocity += (speed - this.velocity) * Math.min(1, dt * 20);
      }
      this.dragged = 0;
    } else {
      this.sinceRelease += dt;
      if (reduced) this.velocity = 0;
      this.user += this.velocity * dt;
      this.velocity *= Math.exp(-dt / ORBIT.inertia);
      if (Math.abs(this.velocity) < 0.002) this.velocity = 0;
      this.tilt = damp(this.tilt, 0, 8, dt);
      if (Math.abs(this.tilt) < 1e-4) this.tilt = 0;
    }
    if (this.pendingKeys !== 0) {
      const share = reduced ? 1 : 1 - Math.exp(-dt * 12);
      const move = Math.abs(this.pendingKeys) < 0.002 ? this.pendingKeys : this.pendingKeys * share;
      this.user += move;
      this.pendingKeys -= move;
    }

    // Modes with a front (hub, companion, ceremony) return to it; a hero keeps turning.
    const resumed = !this.dragging && this.sinceRelease >= ORBIT.resumeAfter;
    const hasFront = idle.turn === 0;
    if (mode === 'ceremony' || (hasFront && resumed)) {
      const rest = nearestTurn(this.user);
      // 720 ms to settle: an exponential that is within 1 % by then.
      this.user = reduced ? rest : damp(this.user, rest, 4.6 / ORBIT.returnTime, dt);
      if (Math.abs(this.user - rest) < 1e-4) this.user = rest;
    }

    // Idle motion: off while the user is in charge, eased back in afterwards.
    const wantIdle = reduced || this.dragging || !resumed ? 0 : 1;
    this.idleGain = damp(this.idleGain, wantIdle, wantIdle ? 1.4 : 10, dt);
    if (reduced) this.idleGain = 0;
    if (idle.turn > 0) {
      this.idle += (TAU / idle.turn) * this.idleGain * dt;
    } else {
      // Leaving a turning mode: unwind to the nearest full turn so the front faces front.
      const rest = nearestTurn(this.idle);
      this.idle = reduced ? rest : damp(this.idle, rest, 4, dt);
      if (Math.abs(this.idle - rest) < 1e-4) this.idle = rest;
    }
    this.driftClock += dt * this.idleGain;
    const drift = idle.drift * Math.sin((this.driftClock * TAU) / idle.period);
    this.drift = reduced ? 0 : damp(this.drift, drift, 4, dt);

    // Hover parallax: fine pointers only (the stage decides), never under reduced motion.
    const lambda = 1 / (ORBIT.hoverSmoothing * 0.5);
    const hx = reduced || !interactive || this.dragging ? 0 : this.hoverX * ORBIT.hoverYaw;
    const hy = reduced || !interactive || this.dragging ? 0 : this.hoverY * ORBIT.hoverPitch;
    this.hoverYaw = damp(this.hoverYaw, hx, lambda, dt);
    this.hoverPitch = damp(this.hoverPitch, hy, lambda, dt);

    this.yaw = this.idle + this.drift + this.user + this.hoverYaw;
    this.pitch = this.tilt + this.hoverPitch;
    this.moving =
      this.dragging ||
      this.velocity !== 0 ||
      this.pendingKeys !== 0 ||
      this.tilt !== 0 ||
      Math.abs(this.hoverYaw - hx) > 1e-4;
  }
}

/** The one controller of the one world: the active stage feeds it, the tracker steps it. */
export const orbit = new OrbitController();

// --- Taps: fire-and-forget, like pulses ---------------------------------------------------

type TapListener = (clientX: number, clientY: number) => void;
const tapListeners = new Set<TapListener>();

/** A tap or click on the active stage, in viewport coordinates. */
export function emitTap(clientX: number, clientY: number): void {
  tapListeners.forEach((listener) => listener(clientX, clientY));
}

/** Scene-side subscription. Returns an unsubscribe function. */
export function onTap(listener: TapListener): () => void {
  tapListeners.add(listener);
  return () => {
    tapListeners.delete(listener);
  };
}

// --- Pointer and hit-testing: what the user points at and taps, by name ---------------------

/**
 * The pointer over the active stage, in viewport coordinates. The stage writes it on
 * pointer moves; the scene reads it once per frame and ray-casts only when it moved.
 */
export const pointer = { x: 0, y: 0, inside: false, moved: false };

export function setPointer(clientX: number, clientY: number): void {
  pointer.x = clientX;
  pointer.y = clientY;
  pointer.inside = true;
  pointer.moved = true;
}

export function clearPointer(): void {
  pointer.inside = false;
  pointer.moved = true;
}

/**
 * A named part of the world under the pointer. Names are plain strings so new parts need
 * no change here: `tree`, `ground`, `water`, `prop:<id>`, `landmark:<id>`, `creature:<id>`.
 */
export interface WorldHit {
  part: string;
  /** Where the ray met the part, in island space. */
  point: [number, number, number];
  clientX: number;
  clientY: number;
}

type HitListener = (hit: WorldHit) => void;
type HoverListener = (hit: WorldHit | null) => void;
const hitListeners = new Set<HitListener>();
const hoverListeners = new Set<HoverListener>();

/** Scene-side: a tap landed on a named part. */
export function emitWorldTap(hit: WorldHit): void {
  hitListeners.forEach((listener) => listener(hit));
}

/** Scene-side: the part under the pointer changed (`null` = nothing). */
export function emitWorldHover(hit: WorldHit | null): void {
  hoverListeners.forEach((listener) => listener(hit));
}

/** Subscribes to taps on named parts of the world. Returns an unsubscribe function. */
export function onWorldTap(listener: HitListener): () => void {
  hitListeners.add(listener);
  return () => {
    hitListeners.delete(listener);
  };
}

/** Subscribes to the part under the pointer changing. Returns an unsubscribe function. */
export function onWorldHover(listener: HoverListener): () => void {
  hoverListeners.add(listener);
  return () => {
    hoverListeners.delete(listener);
  };
}
