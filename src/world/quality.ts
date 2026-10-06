import { GOVERNOR, QUALITY } from './config';
import type { WorldQuality } from './contract';

/**
 * Quality decisions, as pure functions: which tier `auto` starts on, how it adapts
 * while running, and how often a tier needs a new frame.
 *
 * Adaptation is a ratchet. When frames stay slow it first lowers the resolution in a
 * few steps, then drops a tier; it never climbs back during a session, so it cannot
 * oscillate between two states that are each "almost fast enough".
 */

export interface DeviceHints {
  /** A software rasteriser (no GPU): 3D works but must stay on the lowest tier. */
  software: boolean;
  /** `navigator.hardwareConcurrency`, when the browser tells. */
  cores?: number;
  /** `navigator.deviceMemory` in GB, when the browser tells. */
  memoryGb?: number;
  /** A touch-first device (`pointer: coarse`): phones and tablets start on `medium`. */
  coarsePointer: boolean;
}

/** The tier `auto` starts on: conservative on phones and weak machines, generous on desktops. */
export function resolveAutoTier(hints: DeviceHints): WorldQuality {
  if (hints.software) return 'low';
  const cores = hints.cores ?? 4;
  const memory = hints.memoryGb ?? 4;
  if (cores <= 2 || memory <= 2) return 'low';
  if (hints.coarsePointer || cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

const LOWER: Record<WorldQuality, WorldQuality | null> = {
  high: 'medium',
  medium: 'low',
  low: null,
};

export class QualityGovernor {
  tier: WorldQuality;
  /** Index into `GOVERNOR.dprSteps`. */
  step = 0;
  private total = 0;
  private frames = 0;
  private settling: number = GOVERNOR.settle;

  constructor(tier: WorldQuality) {
    this.tier = tier;
  }

  /** Share of the tier's DPR cap to render at. */
  get dprScale(): number {
    return GOVERNOR.dprSteps[this.step] ?? 1;
  }

  /** Device pixel ratio this state allows on a display that could do more. */
  get dprCap(): number {
    return QUALITY[this.tier].dpr * this.dprScale;
  }

  /** True once nothing is left to give: the lowest tier at the lowest resolution. */
  get exhausted(): boolean {
    return LOWER[this.tier] === null && this.step >= GOVERNOR.dprSteps.length - 1;
  }

  /** Starts over on a tier (the user changed the preference). */
  reset(tier: WorldQuality): void {
    this.tier = tier;
    this.step = 0;
    this.total = 0;
    this.frames = 0;
    this.settling = GOVERNOR.settle;
  }

  /**
   * Feeds one rendered frame's duration in milliseconds. Returns true when the state
   * changed and the caller must apply `tier` and `dprScale`.
   */
  sample(frameMs: number): boolean {
    if (this.exhausted) return false;
    // A frame this long is a hiccup (a tab switch, a GC pause), not a slow device.
    if (!(frameMs > 0) || frameMs > GOVERNOR.hiccupMs) return false;
    if (this.settling > 0) {
      this.settling -= 1;
      return false;
    }
    this.total += frameMs;
    this.frames += 1;
    if (this.frames < GOVERNOR.window) return false;
    const average = this.total / this.frames;
    this.total = 0;
    this.frames = 0;
    if (average <= GOVERNOR.slowMs) return false;

    if (this.step < GOVERNOR.dprSteps.length - 1) {
      this.step += 1;
    } else {
      const lower = LOWER[this.tier];
      if (!lower) return false;
      // Dropping a tier must not raise the resolution again: keep it at or below now.
      const before = this.dprCap;
      let step = GOVERNOR.dprSteps.findIndex(
        (share) => QUALITY[lower].dpr * share <= before + 1e-6,
      );
      if (step < 0) step = GOVERNOR.dprSteps.length - 1;
      this.tier = lower;
      this.step = step;
    }
    this.settling = GOVERNOR.settle;
    return true;
  }
}

/**
 * Seconds a tier may let pass between two frames of a world that is standing still on
 * the page (bible 5.11): `low` idles at 30 fps, `medium` drops to 30 fps after eight
 * quiet seconds, `high` follows the display. A world that is being scrolled, dragged,
 * flown or pulsed always renders every frame, or it would swim against the page.
 */
export function frameInterval(tier: WorldQuality, idleSeconds: number): number {
  if (tier === 'low') return 1 / 30;
  if (tier === 'medium') return idleSeconds > 8 ? 1 / 30 : 0;
  return 0;
}
