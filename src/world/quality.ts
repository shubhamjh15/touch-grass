import { GOVERNOR, QUALITY } from './config';
import type { WorldQuality } from './contract';

/**
 * Quality decisions, as pure functions: which tier `auto` starts on (by the class of
 * the GPU, not by core count: a six-core laptop with integrated graphics is not a
 * gaming PC), how it adapts while running, and how many pixels a tier may draw.
 *
 * Adaptation aims at the display's own cadence. A frame that misses its slot is what a
 * person sees as jitter, so the governor counts late frames rather than averaging, and
 * reacts within about a second. It is a ratchet: resolution first, then the tier, never
 * back up during a session, so it cannot oscillate between two states that are each
 * "almost fast enough".
 */

export type GpuClass = 'software' | 'integrated' | 'mobile' | 'discrete' | 'apple' | 'unknown';

/**
 * Sorts the unmasked renderer string of `WEBGL_debug_renderer_info` into a class.
 * Integrated and mobile chips share memory with the system and are bound by fill rate;
 * they are what most people open the app on.
 */
export function classifyGpu(renderer: string): GpuClass {
  const name = renderer.toLowerCase();
  if (name === '') return 'unknown';
  if (/swiftshader|llvmpipe|software|basic render|softpipe/.test(name)) return 'software';
  if (/mali|adreno|powervr|videocore|tegra|vivante/.test(name)) return 'mobile';
  if (/apple/.test(name)) return 'apple';
  if (
    /nvidia|geforce|quadro|rtx|gtx|radeon\s*(\(tm\)\s*)?(rx|pro|r9|r7)|firepro|arc\(tm\)\s*a\d|arc a\d/.test(
      name,
    )
  ) {
    return 'discrete';
  }
  if (/intel|iris|uhd|hd graphics|radeon|amd|vega/.test(name)) return 'integrated';
  return 'unknown';
}

export interface DeviceHints {
  gpu: GpuClass;
  /** `navigator.hardwareConcurrency`, when the browser tells. */
  cores?: number;
  /** `navigator.deviceMemory` in GB, when the browser tells. */
  memoryGb?: number;
  /** A touch-first device (`pointer: coarse`): phones and tablets. */
  coarsePointer: boolean;
}

/**
 * The tier `auto` starts on. Only a discrete card or desktop Apple silicon starts on
 * `high` (post-processing); integrated and mobile chips, and anything unrecognised,
 * start on `medium`, which is designed to be the tier most people see.
 */
export function resolveAutoTier(hints: DeviceHints): WorldQuality {
  if (hints.gpu === 'software') return 'low';
  const cores = hints.cores ?? 4;
  const memory = hints.memoryGb ?? 4;
  if (cores <= 2 || memory <= 2) return 'low';
  if (hints.coarsePointer) return 'medium';
  return hints.gpu === 'discrete' || hints.gpu === 'apple' ? 'high' : 'medium';
}

/**
 * Device pixel ratio for a stage of `cssPixels` (width times height): the device's own
 * ratio, capped by the tier, scaled by the governor, and never more than the tier's
 * pixel budget. A fill-rate-bound GPU cares about pixels drawn, not about the ratio:
 * a wide hero stage on a dense screen is the case that would otherwise stutter.
 */
export function resolveDpr(
  tier: WorldQuality,
  cssPixels: number,
  deviceDpr: number,
  coarsePointer: boolean,
  scale: number,
): number {
  const spec = QUALITY[tier];
  const cap = Math.min(deviceDpr, coarsePointer ? spec.dprTouch : spec.dpr) * scale;
  const budget = Math.sqrt((spec.megapixels * 1e6 * scale * scale) / Math.max(1, cssPixels));
  return Math.max(0.5, Math.min(cap, budget));
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
  /** The display's frame interval as observed: the fastest steady cadence seen so far. */
  refreshMs: number = GOVERNOR.refreshMs;
  private readonly window = new Float32Array(GOVERNOR.window);
  private filled = 0;
  private strikes = 0;
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
    this.filled = 0;
    this.strikes = 0;
    this.settling = GOVERNOR.settle;
  }

  /** Forgets the frames collected so far: after a drag, a resize or a hidden tab. */
  pause(): void {
    this.filled = 0;
    this.settling = Math.max(this.settling, GOVERNOR.resume);
  }

  /**
   * Feeds one rendered frame's interval in milliseconds. Returns true when the state
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
    this.window[this.filled] = frameMs;
    this.filled += 1;
    if (this.filled < GOVERNOR.window) return false;
    this.filled = 0;

    const sorted = this.window.slice().sort();
    const median = sorted[sorted.length >> 1] as number;
    // A 120 Hz screen has 8 ms frames, a 50 Hz one 20 ms: learn the cadence, never guess slower.
    if (median < this.refreshMs) this.refreshMs = Math.max(GOVERNOR.fastestMs, median);
    const lateAfter = this.refreshMs * GOVERNOR.lateFactor;
    let late = 0;
    for (const value of sorted) if (value > lateAfter) late += 1;
    const slow = late / sorted.length > GOVERNOR.lateShare;
    this.strikes = slow ? this.strikes + 1 : 0;
    if (this.strikes < GOVERNOR.strikes) return false;
    this.strikes = 0;

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
