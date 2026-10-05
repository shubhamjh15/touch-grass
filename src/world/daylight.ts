import { hexToRgb, mixOklab, mixRgb, rgbToHex, type Rgb } from './color';
import {
  GRADE_BLEND_HOURS,
  SKY_BLEND_HOURS,
  SLOT_EDGES,
  SLOT_LOOK,
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
  halfWindow: number,
): { from: DaySlot; to: DaySlot; mix: number } {
  const h = wrapHour(hour);
  for (const slot of ORDER) {
    const edge = STARTS[slot];
    const signed = ((h - edge + 36) % 24) - 12;
    if (Math.abs(signed) < halfWindow) {
      const previous = ORDER[(ORDER.indexOf(slot) + 3) % 4] as DaySlot;
      const t = (signed + halfWindow) / (2 * halfWindow);
      return { from: previous, to: slot, mix: t * t * (3 - 2 * t) };
    }
  }
  const slot = slotAt(h);
  return { from: slot, to: slot, mix: 0 };
}

function blendLook<T>(
  hour: number,
  halfWindow: number,
  read: (look: SlotLook) => T,
  mix: (a: T, b: T, t: number) => T,
): T {
  const blend = slotBlend(hour, halfWindow);
  const from = read(SLOT_LOOK[blend.from]);
  return blend.mix === 0 ? from : mix(from, read(SLOT_LOOK[blend.to]), blend.mix);
}

const mixHex = (a: string, b: string, t: number) => rgbToHex(mixOklab(hexToRgb(a), hexToRgb(b), t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface SkyLook {
  bands: [string, string, string, string];
  page: string;
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

/** 0 at the start of the arc (rising on the left), 1 at its end. Sun 06-18, moon 18-06. */
function arcProgress(hour: number): { u: number; night: boolean } {
  const h = wrapHour(hour);
  const night = h < 6 || h >= 18;
  return { u: night ? ((h + 6) % 12) / 12 : (h - 6) / 12, night };
}

export function skyAt(hour: number): SkyLook {
  const read = <T>(pick: (look: SlotLook) => T, mix: (a: T, b: T, t: number) => T) =>
    blendLook(hour, SKY_BLEND_HOURS, pick, mix);
  const bands = [0, 1, 2, 3].map((index) =>
    read((look) => look.bands[index] as string, mixHex),
  ) as SkyLook['bands'];
  const { u, night } = arcProgress(hour);
  return {
    bands,
    page: read((look) => look.page, mixHex),
    orb: read((look) => look.orb, mixHex),
    cloud: read((look) => look.cloud, mixHex),
    mark: read((look) => look.mark, mixHex),
    stars: read((look) => look.stars, lerp),
    orbX: 0.5 - 0.36 * Math.cos(Math.PI * u),
    orbY: 0.6 - 0.46 * Math.sin(Math.PI * u),
    moon: night ? 1 : 0,
  };
}

/** Publishes the sky as `--sky-*` custom properties (on `:root`) for the CSS layers and the UI. */
export function applySkyVars(target: HTMLElement, sky: SkyLook): void {
  const style = target.style;
  sky.bands.forEach((band, index) => style.setProperty(`--sky-${index}`, band));
  style.setProperty('--sky-top', sky.bands[0]);
  style.setProperty('--sky-horizon', sky.bands[3]);
  style.setProperty('--sky-page', sky.page);
  style.setProperty('--sky-orb', sky.orb);
  style.setProperty('--sky-cloud', sky.cloud);
  style.setProperty('--sky-mark', sky.mark);
  style.setProperty('--sky-stars', sky.stars.toFixed(3));
  style.setProperty('--sky-orb-x', `${(sky.orbX * 100).toFixed(2)}%`);
  style.setProperty('--sky-orb-y', `${(sky.orbY * 100).toFixed(2)}%`);
  style.setProperty('--sky-moon', String(sky.moon));
}

export interface LightLook {
  /** Unit vector towards the light, in view space (x right, y up, z towards the viewer). */
  direction: [number, number, number];
  gradeLit: Rgb;
  gradeShade: Rgb;
}

/**
 * Key light for the paint shader. The sun rises low on the left, stands high (still a
 * little left, like every card shadow in the UI) at noon and sets low on the right; the
 * moon repeats the arc. Elevation is what makes dawn and dusk read as "low sun".
 */
export function lightAt(hour: number): LightLook {
  const { u } = arcProgress(hour);
  const side = -Math.cos(Math.PI * u);
  const height = Math.sin(Math.PI * u);
  // Noon keeps a left bias so the shade side never flips straight overhead.
  const x = side * 0.78 - 0.22 * height;
  const y = 0.22 + 0.62 * height;
  const z = 0.55;
  const length = Math.hypot(x, y, z);
  const grade = (pick: (look: SlotLook) => string) =>
    blendLook(hour, GRADE_BLEND_HOURS, (look) => hexToRgb(pick(look)), mixRgb);
  return {
    direction: [x / length, y / length, z / length],
    gradeLit: grade((look) => look.gradeLit),
    gradeShade: grade((look) => look.gradeShade),
  };
}

/** Shortest signed distance from one hour to another on the 24 h dial. */
export function hourDelta(from: number, to: number): number {
  return ((to - from + 36) % 24) - 12;
}
