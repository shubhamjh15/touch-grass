import { hexToRgb, mixOklab, rgbToHex, type Rgb } from './color';
import {
  ORB,
  SLOT_BLEND_HOURS,
  SLOT_EDGES,
  SLOT_LOOK,
  STAR,
  SUNDIAL,
  type DaySlot,
  type SlotLook,
} from './config';

/** Everything that follows the local time of day. Pure: the same hour gives the same look. */

export function wrapHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

const ORDER: readonly DaySlot[] = ['night', 'dawn', 'day', 'dusk'];
const STARTS: Record<DaySlot, number> = {
  dawn: SLOT_EDGES.dawn,
  day: SLOT_EDGES.day,
  dusk: SLOT_EDGES.dusk,
  night: SLOT_EDGES.night,
};

export function slotAt(hour: number): DaySlot {
  const h = wrapHour(hour);
  if (h >= SLOT_EDGES.night || h < SLOT_EDGES.dawn) return 'night';
  if (h < SLOT_EDGES.day) return 'dawn';
  if (h < SLOT_EDGES.dusk) return 'day';
  return 'dusk';
}

/**
 * The two slots an hour sits between and how far it is into the cross-fade.
 * Outside a blend window `mix` is 0 and `from === to`.
 */
export function slotBlend(
  hour: number,
  halfWindow = SLOT_BLEND_HOURS,
): { from: DaySlot; to: DaySlot; mix: number } {
  const h = wrapHour(hour);
  for (const slot of ORDER) {
    const signed = ((h - STARTS[slot] + 36) % 24) - 12;
    if (Math.abs(signed) < halfWindow) {
      const previous = ORDER[(ORDER.indexOf(slot) + 3) % 4] as DaySlot;
      return { from: previous, to: slot, mix: (signed + halfWindow) / (2 * halfWindow) };
    }
  }
  const slot = slotAt(h);
  return { from: slot, to: slot, mix: 0 };
}

function blendLook<T>(
  hour: number,
  read: (look: SlotLook) => T,
  mix: (a: T, b: T, t: number) => T,
): T {
  const blend = slotBlend(hour);
  const from = read(SLOT_LOOK[blend.from]);
  return blend.mix === 0 ? from : mix(from, read(SLOT_LOOK[blend.to]), blend.mix);
}

const mixHex = (a: string, b: string, t: number) => rgbToHex(mixOklab(hexToRgb(a), hexToRgb(b), t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface SkyLook {
  bands: [string, string, string, string];
  orb: string;
  cloud: string;
  mark: string;
  stars: number;
  /** Where the sun or moon hangs, as fractions of the stage box. */
  orbX: number;
  orbY: number;
  /** 0 by day, 1 at night: the sun sticker swaps for the moon. */
  moon: number;
}

/** The sun travels left to right between first and last light, highest a little after noon. */
function orbPosition(hour: number): { x: number; y: number; moon: number } {
  const h = wrapHour(hour);
  if (h < ORB.from || h >= ORB.until) return { x: ORB.moon[0], y: ORB.moon[1], moon: 1 };
  const across = (h - ORB.from) / (ORB.until - ORB.from);
  const climb =
    h <= ORB.highest
      ? (h - ORB.from) / (ORB.highest - ORB.from)
      : (ORB.until - h) / (ORB.until - ORB.highest);
  return {
    x: lerp(ORB.left, ORB.right, across),
    y: lerp(ORB.low, ORB.high, Math.sin((climb * Math.PI) / 2)),
    moon: 0,
  };
}

export function skyAt(hour: number): SkyLook {
  const bands = [0, 1, 2, 3].map((index) =>
    blendLook(hour, (look) => look.bands[index] as string, mixHex),
  ) as SkyLook['bands'];
  const orb = orbPosition(hour);
  return {
    bands,
    orb: blendLook(hour, (look) => look.orb, mixHex),
    cloud: blendLook(hour, (look) => look.cloud, mixHex),
    mark: blendLook(hour, (look) => look.mark, mixHex),
    stars: blendLook(hour, (look) => look.stars, lerp),
    orbX: orb.x,
    orbY: orb.y,
    moon: orb.moon,
  };
}

/**
 * Publishes the sky as custom properties. On `:root` these are the public tokens the UI
 * may read (`--sky-0..3`, `--orb`, `--cloud`, `--stage-mark`); the world's own layer sets
 * them on itself too, so its print is exact at once even where the page eases the tokens.
 */
export function applySkyVars(target: HTMLElement, sky: SkyLook): void {
  const style = target.style;
  sky.bands.forEach((band, index) => style.setProperty(`--sky-${index}`, band));
  style.setProperty('--orb', sky.orb);
  style.setProperty('--cloud', sky.cloud);
  style.setProperty('--stage-mark', sky.mark);
  style.setProperty('--star', STAR);
  style.setProperty('--sky-stars', sky.stars.toFixed(3));
  style.setProperty('--sky-orb-x', `${(sky.orbX * 100).toFixed(2)}%`);
  style.setProperty('--sky-orb-y', `${(sky.orbY * 100).toFixed(2)}%`);
  style.setProperty('--sky-moon', String(sky.moon));
}

export interface LightLook {
  /** Multiplied over every painted tone. */
  grade: Rgb;
  /**
   * Unit vector towards the sun in the island's rest frame (x to the viewer's right,
   * y up, z towards the viewer). The island is a sundial: the tree's shadow points to
   * the right at 06:00, at the viewer at noon and to the left at 18:00.
   */
  sun: [number, number, number];
  /** 0..1: how much of the cast shadow is printed (it fades out at night). */
  castShadow: number;
}

export function lightAt(hour: number): LightLook {
  const h = wrapHour(hour);
  const sweep = (Math.PI * (h - 6)) / 12;
  const elevation = SUNDIAL.base + SUNDIAL.swing * Math.max(0, Math.sin(sweep));
  const flat = Math.cos(elevation);
  return {
    grade: blendLook(hour, (look) => hexToRgb(look.grade), mixOklab),
    sun: [-Math.cos(sweep) * flat, Math.sin(elevation), -Math.sin(sweep) * flat],
    castShadow: blendLook(hour, (look) => look.castShadow, lerp),
  };
}

/** Shortest signed distance from one hour to another on the 24 h dial. */
export function hourDelta(from: number, to: number): number {
  return ((to - from + 36) % 24) - 12;
}
