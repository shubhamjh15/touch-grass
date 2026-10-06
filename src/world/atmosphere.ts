import { clamp01, lerp, smoothstep } from '@/lib/math';
import { hexToRgb, mixOklab, type Rgb } from './color';
import { wrapHour } from './daylight';

/**
 * Light and sky of the 3D world as a pure function of the local hour, and the mood of
 * the island as a pure function of the tree's vitality. No three.js: the scene turns
 * these numbers into lights, uniforms and colours, the tests check them directly.
 *
 * Light is deliberately flat: the hemisphere fill carries more than half of the picture
 * and the key light models it, so shadows stay coloured and soft like a toy on a table,
 * never black.
 *
 * Colours are sRGB triples in 0..1. Directions are unit vectors in island space
 * (x right, y up, z towards the viewer at the rest camera).
 */

export type Vec3 = [number, number, number];

export interface Atmosphere {
  /** Towards the key light: the sun by day, the moon at night. Always above the horizon. */
  lightDir: Vec3;
  lightColor: Rgb;
  lightIntensity: number;
  /** Hemisphere fill: colour from above, colour bounced from below, strength. */
  skyFill: Rgb;
  groundFill: Rgb;
  fillIntensity: number;
  /** The painted sky: straight up, at the horizon and below it (the haze under the island). */
  zenith: Rgb;
  horizon: Rgb;
  haze: Rgb;
  /** Where the sun or moon hangs in the back sky, its colour and the glow around it. */
  orbDir: Vec3;
  orbColor: Rgb;
  glow: Rgb;
  /** 0 = the orb is the sun, 1 = it is the moon. */
  moon: number;
  /** 0 by day, 1 in full night. Stars and fireflies follow it. */
  night: number;
  /** Tint of the clouds. */
  cloud: Rgb;
  /** 0..1 darkness of the cast shadows (soft at dawn and under the moon). */
  shadow: number;
}

interface Key {
  hour: number;
  zenith: string;
  horizon: string;
  haze: string;
  light: string;
  intensity: number;
  skyFill: string;
  groundFill: string;
  fill: number;
  orb: string;
  glow: string;
  cloud: string;
  shadow: number;
}

/** First and last light: between them the sun is the key light, outside them the moon. */
export const SUNRISE = 5.5;
export const SUNSET = 20;

const NIGHT: Omit<Key, 'hour'> = {
  zenith: '#0a1033',
  horizon: '#2b3a7c',
  haze: '#1a2352',
  light: '#c3d0ff',
  intensity: 1.07,
  skyFill: '#6478d6',
  groundFill: '#3a4a86',
  fill: 1.99,
  orb: '#fef9c3',
  glow: '#7f93e8',
  cloud: '#8f9fe0',
  shadow: 0.55,
};

const DAY: Omit<Key, 'hour'> = {
  zenith: '#2f8ff0',
  horizon: '#a9defc',
  haze: '#dff3ff',
  light: '#fff4d6',
  intensity: 2.02,
  skyFill: '#cfe7ff',
  groundFill: '#d9dcc0',
  fill: 2.85,
  orb: '#fff3b0',
  glow: '#fffbe0',
  cloud: '#ffffff',
  shadow: 0.62,
};

/** The day in keyframes; hours between two keys are blended in OKLab. */
const KEYS: readonly Key[] = [
  { hour: 0, ...NIGHT },
  { hour: 4.6, ...NIGHT },
  {
    hour: 6.1,
    zenith: '#7f9cf0',
    horizon: '#ffc9a8',
    haze: '#ffe3d2',
    light: '#ffc79a',
    intensity: 1.63,
    skyFill: '#d3caf7',
    groundFill: '#d9b9a6',
    fill: 2.18,
    orb: '#ffb36b',
    glow: '#ffd9b0',
    cloud: '#ffe1d6',
    shadow: 0.55,
  },
  {
    hour: 8,
    zenith: '#4a9df5',
    horizon: '#bfe6fd',
    haze: '#e6f5ff',
    light: '#ffeccb',
    intensity: 1.89,
    skyFill: '#cfe6ff',
    groundFill: '#d6d6bc',
    fill: 2.66,
    orb: '#ffe9a0',
    glow: '#fff6d8',
    cloud: '#ffffff',
    shadow: 0.6,
  },
  { hour: 11, ...DAY },
  { hour: 15.5, ...DAY },
  {
    hour: 18,
    zenith: '#5b86e6',
    horizon: '#ffd08a',
    haze: '#ffe6bd',
    light: '#ffb466',
    intensity: 1.98,
    skyFill: '#d0c6f2',
    groundFill: '#e0b98c',
    fill: 2.18,
    orb: '#ffb347',
    glow: '#ffd27a',
    cloud: '#ffe2c2',
    shadow: 0.62,
  },
  {
    hour: 19.4,
    zenith: '#3b3f95',
    horizon: '#ff9a7a',
    haze: '#c98aa0',
    light: '#ff8f6b',
    intensity: 1.29,
    skyFill: '#a79ee6',
    groundFill: '#a27f95',
    fill: 1.9,
    orb: '#ff7a55',
    glow: '#ff9f80',
    cloud: '#f5b3b8',
    shadow: 0.6,
  },
  { hour: 20.8, ...NIGHT },
  { hour: 24, ...NIGHT },
];

const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

const MOON_LIGHT: Vec3 = normalize([-0.5, 0.74, 0.45]);
const MOON_ORB: Vec3 = normalize([0.42, 0.52, -0.74]);

const deg = (value: number) => (value * Math.PI) / 180;

/** Share of the daylight arc that has passed, 0 at first light and 1 at last light. */
function dayShare(hour: number): number {
  return clamp01((hour - SUNRISE) / (SUNSET - SUNRISE));
}

/** Direction towards the sun: it rises on the viewer's right, sets on the left, stays in front. */
function sunLight(hour: number): Vec3 {
  const share = dayShare(hour);
  const elevation = deg(10) + deg(50) * Math.sin(share * Math.PI);
  const flat = Math.cos(elevation);
  return normalize([Math.cos(share * Math.PI) * flat, Math.sin(elevation), 0.62 * flat]);
}

/** Where the sun is painted: the same arc, mirrored into the sky behind the island. */
function sunOrb(hour: number): Vec3 {
  const share = dayShare(hour);
  const elevation = deg(4) + deg(40) * Math.sin(share * Math.PI);
  const flat = Math.cos(elevation);
  return normalize([Math.cos(share * Math.PI) * 0.82 * flat, Math.sin(elevation), -0.8 * flat]);
}

export function atmosphereAt(hourInput: number): Atmosphere {
  const hour = wrapHour(hourInput);
  let index = 0;
  while (index < KEYS.length - 2 && (KEYS[index + 1] as Key).hour <= hour) index += 1;
  const from = KEYS[index] as Key;
  const to = KEYS[index + 1] as Key;
  const t = smoothstep(from.hour, to.hour, hour);
  const colour = (read: (key: Key) => string) =>
    mixOklab(hexToRgb(read(from)), hexToRgb(read(to)), t);
  const number = (read: (key: Key) => number) => lerp(read(from), read(to), t);

  // The key light hands over between sun and moon while it is at its dimmest.
  const sunUp = smoothstep(SUNRISE - 0.2, SUNRISE + 0.7, hour) * (1 - smoothstep(19.5, 20.3, hour));
  const moonUp = 1 - smoothstep(4.7, 5.5, hour) + smoothstep(20.3, 21.1, hour);
  const byMoon = moonUp > sunUp;
  const handover = Math.max(sunUp, Math.min(1, moonUp));
  const night = clamp01(1 - smoothstep(4.8, 6.2, hour) + smoothstep(19.3, 20.8, hour));

  return {
    lightDir: byMoon ? MOON_LIGHT : sunLight(hour),
    lightColor: colour((key) => key.light),
    lightIntensity: number((key) => key.intensity) * (0.25 + 0.75 * handover),
    skyFill: colour((key) => key.skyFill),
    groundFill: colour((key) => key.groundFill),
    fillIntensity: number((key) => key.fill),
    zenith: colour((key) => key.zenith),
    horizon: colour((key) => key.horizon),
    haze: colour((key) => key.haze),
    orbDir: byMoon ? MOON_ORB : sunOrb(hour),
    orbColor: colour((key) => key.orb),
    glow: colour((key) => key.glow),
    moon: byMoon ? 1 : 0,
    night,
    cloud: colour((key) => key.cloud),
    shadow: number((key) => key.shadow) * (0.35 + 0.65 * handover),
  };
}

/** How the island feels at a given vitality. Every value eases with it; nothing snaps. */
export interface Mood {
  /** 0..1: how yellow and dull the greens are. Peaks at "thirsty" (vitality 0.5). */
  dry: number;
  /** 0..1: how cool and bare everything is. 1 at "dormant" (vitality 0). */
  cold: number;
  /** 0..1 droop of leaves and tips. */
  droop: number;
  /** Share of the full wind sway. A resting tree barely moves. */
  sway: number;
  /** Share of the crown's leaves that is shown. A dormant tree is almost bare. */
  leaves: number;
  /** Scale of the foliage puffs. */
  puff: number;
  /** Multiplier of the key light: a dormant island sits under a dimmer, cooler sky. */
  light: number;
}

export function moodAt(vitalityInput: number): Mood {
  const vitality = clamp01(vitalityInput);
  const cold = clamp01(1 - vitality / 0.45);
  const dry = clamp01(1 - Math.abs(vitality - 0.5) / 0.4) * (1 - cold * 0.6);
  const thirst = clamp01((1 - vitality) / 0.5);
  return {
    dry,
    cold,
    droop: lerp(thirst, 0.55, cold),
    sway: lerp(lerp(1, 0.6, thirst), 0.2, cold),
    leaves: lerp(lerp(1, 0.82, thirst), 0.12, cold),
    puff: lerp(lerp(1, 0.94, thirst), 0.5, cold),
    light: lerp(lerp(1, 0.93, thirst), 0.74, cold),
  };
}
