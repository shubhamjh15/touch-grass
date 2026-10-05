import type { Species, WorldQuality } from './contract';

/**
 * The one place to re-tune the Grove: every colour, proportion and timing the
 * world uses lives here, so the art direction can change without touching the
 * generators or the shaders. No three.js in this file: it ships in the main bundle.
 */

// --- Brand ---------------------------------------------------------------------------------

export const INK = '#18181b';
export const PAPER = '#ffffff';
export const MINT = '#f0fdf4';

// --- The die-cut sticker -------------------------------------------------------------------

/** Line weights in CSS pixels at full size. They mirror the UI: 4 px borders, 8 px hard shadow. */
export const STICKER = {
  inkPx: 4,
  /** White die-cut margin outside the ink line. */
  borderPx: 9,
  /** Hairline that closes the white margin, so the sticker edge reads on a pale sky. */
  keylinePx: 1.5,
  /** Hard shadow offset, down and to the right. */
  shadowPx: 8,
  /** The weights shrink with the subject below this scale (px per world unit)... */
  fullWeightScale: 44,
  /** ...but never below this share, so a thumbnail still reads as a sticker. */
  minWeight: 0.42,
} as const;

// --- Camera and placement ------------------------------------------------------------------

export const CAMERA = {
  /** Elevation of the orthographic three-quarter view. sin(13.5 deg) matches the mockup ellipses. */
  pitch: (13.5 * Math.PI) / 180,
  /** Resting azimuth of the island: the ring emblem sits just left of centre. */
  yaw: -0.16,
  /** Slow idle turn, radians either side of `yaw`, by stage mode. */
  idleYaw: { hero: 0.16, hub: 0.1, companion: 0.05, ceremony: 0.08 },
  idleYawPeriod: 38,
  /** Gentle bob in world units and seconds. */
  bob: 0.045,
  bobPeriod: 6.5,
} as const;

export const MOTION = {
  /** Flight between two stages: an under-damped spring, about 700 ms with a small overshoot. */
  flightOmega: 9,
  flightZeta: 0.72,
  /** Reduced motion replaces the flight with a dip-to-transparent of this length. */
  crossFadeMs: 180,
  /** First appearance and disappearance. */
  appearOmega: 11,
  appearZeta: 0.6,
  fadeOutPerSecond: 7,
  /** A stage may vanish for this long (lazy route) before the world starts to fade. */
  graceMs: 220,
  /** Displayed growth, vitality and hour ease towards the snapshot at these rates (1/s). */
  growthLambda: 3.2,
  vitalityLambda: 2.4,
  hourLambda: 5,
  /** New parts overshoot by this share while growth is moving. */
  popOvershoot: 0.22,
} as const;

// --- Quality tiers -------------------------------------------------------------------------

export interface QualityTier {
  /** Device-pixel-ratio cap. Never exceeds the real devicePixelRatio. */
  dpr: number;
  /** Icosphere subdivisions of a foliage clump. */
  clumpDetail: number;
  /** Share of leaf and blossom accents that is drawn. */
  accentShare: number;
  /** Segments around the island and sides of the trunk. */
  islandSegments: number;
  trunkSides: number;
  branchSides: number;
  /** Share of grass tufts and pebbles. */
  scatterShare: number;
}

export const QUALITY: Record<WorldQuality, QualityTier> = {
  low: {
    dpr: 1,
    clumpDetail: 2,
    accentShare: 0.25,
    islandSegments: 22,
    trunkSides: 6,
    branchSides: 4,
    scatterShare: 0.4,
  },
  medium: {
    dpr: 1.5,
    clumpDetail: 3,
    accentShare: 0.5,
    islandSegments: 30,
    trunkSides: 8,
    branchSides: 5,
    scatterShare: 0.7,
  },
  high: {
    dpr: 2,
    clumpDetail: 4,
    accentShare: 1,
    islandSegments: 40,
    trunkSides: 10,
    branchSides: 6,
    scatterShare: 1,
  },
};

/** Budgets at growth 1, asserted by tests and shown in the world lab. */
export const BUDGET: Record<WorldQuality, { drawCalls: number; triangles: number }> = {
  low: { drawCalls: 60, triangles: 45_000 },
  medium: { drawCalls: 60, triangles: 80_000 },
  high: { drawCalls: 60, triangles: 120_000 },
};

// --- Tones ---------------------------------------------------------------------------------

/**
 * Every painted surface picks one tone. A tone is a (lit, shade, highlight) triple;
 * the shader never computes a colour, it only chooses between these.
 */
export const TONE = {
  bark: 0,
  canopyA: 1,
  canopyB: 2,
  canopyC: 3,
  /** Second foliage family: cherry leaves before the bloom, and the green clumps among the pink. */
  canopyAlt: 4,
  accent: 5,
  petal: 6,
  petalCore: 7,
  grassPatch: 8,
  grassTop: 9,
  grassSide: 10,
  kraftA: 11,
  kraftB: 12,
  rock: 13,
  soil: 14,
  seed: 15,
  plaque: 16,
} as const;
export const TONE_COUNT = 17;

/** lit, shade, highlight */
export type ToneTriple = readonly [string, string, string];
type VitalityRamp = { thriving: ToneTriple; thirsty: ToneTriple; dormant: ToneTriple };

export const CANOPY: Record<Species, VitalityRamp> = {
  oak: {
    thriving: ['#4ade80', '#16a34a', '#bbf7d0'],
    thirsty: ['#bef264', '#84cc16', '#ecfccb'],
    dormant: ['#d1d9b8', '#a3ae88', '#e9eddb'],
  },
  cherry: {
    thriving: ['#f9a8d4', '#ec4899', '#fce7f3'],
    thirsty: ['#fbcfe8', '#f472b6', '#fdf2f8'],
    dormant: ['#e2cfd6', '#c0a4af', '#f2e8ec'],
  },
  pine: {
    thriving: ['#2dd4a8', '#0b8f77', '#a7f3d0'],
    thirsty: ['#b5dc8f', '#7fae52', '#def0cb'],
    dormant: ['#b9c8b4', '#8ea08a', '#dbe5d8'],
  },
};

/** Green leaf family shared by cherry leaves and sprout cotyledons. */
export const LEAF: VitalityRamp = {
  thriving: ['#86efac', '#22c55e', '#dcfce7'],
  thirsty: ['#d9f99d', '#a3e635', '#f7fee7'],
  dormant: ['#d1d9b8', '#a3ae88', '#e9eddb'],
};

/** The small die-cut leaves that break the canopy silhouette. */
export const ACCENT: VitalityRamp = {
  thriving: ['#bef264', '#84cc16', '#ecfccb'],
  thirsty: ['#e4f58a', '#bcd63a', '#f7fee7'],
  dormant: ['#dfe3c4', '#b7bf98', '#eef0df'],
};

export const GRASS: Record<
  'thriving' | 'thirsty' | 'dormant',
  { patch: string; top: string; decal: string; side: string; sideShade: string }
> = {
  thriving: {
    patch: '#a5f3c0',
    top: '#86efac',
    decal: '#4ade80',
    side: '#4ade80',
    sideShade: '#22c55e',
  },
  thirsty: {
    patch: '#e6fbb5',
    top: '#d9f99d',
    decal: '#bef264',
    side: '#bef264',
    sideShade: '#a3e635',
  },
  dormant: {
    patch: '#e8edd8',
    top: '#dfe6cc',
    decal: '#c5cfab',
    side: '#c5cfab',
    sideShade: '#a3ae88',
  },
};

export const FIXED_TONES = {
  bark: ['#c08457', '#96633a', '#d9a87e'],
  /** A sprout's stem is green; it turns to bark as the seedling hardens. */
  stem: ['#4ade80', '#16a34a', '#bbf7d0'],
  petal: ['#fff7fb', '#fbcfe8', '#ffffff'],
  petalCore: ['#facc15', '#eab308', '#fde68a'],
  kraftA: ['#e7c9a0', '#d4a373', '#f3dcb8'],
  kraftB: ['#d4a373', '#b98652', '#e7c9a0'],
  rock: ['#e7e5e4', '#a8a29e', '#fafaf9'],
  soil: ['#96633a', '#7a4e2b', '#b07a4c'],
  seed: ['#e7c9a0', '#c9965f', '#f3dcb8'],
  plaque: ['#f3dcb8', '#96633a', '#fff7ed'],
} as const satisfies Record<string, ToneTriple>;

/** Colour jitter between clumps: B leans to the shade, C to the highlight. */
export const CANOPY_JITTER = { towardShade: 0.14, towardHighlight: 0.16 } as const;

// --- Shading -------------------------------------------------------------------------------

export const SHADING = {
  /**
   * Facing ratios (normal . light) where the halftone band starts and ends. Below `shade`
   * a surface takes its shade tone, above `lit` its lit tone, in between printed dots.
   */
  shade: 0.2,
  lit: 0.46,
  /** Halftone pitch in world units and screen angle: the dots are printed on the sticker. */
  dotPitch: 0.15,
  dotAngle: (30 * Math.PI) / 180,
  /** Clumps use the mockup's crescent: a lit disc pushed towards the light by these radii. */
  crescentShade: 0.37,
  crescentBand: 0.157,
  /** Bean highlight: distance from the centre, half length, half width, bend (clump radii). */
  glossAt: 0.6,
  glossLength: 0.22,
  glossWidth: 0.1,
  glossBend: 0.9,
  /** Depth squash of clumps towards their centre, so they stack like paper discs. */
  clumpFlatten: 0.1,
} as const;

// --- Time of day ---------------------------------------------------------------------------

export type DaySlot = 'night' | 'dawn' | 'day' | 'dusk';

/** Local clock boundaries, in hours: night ends, dawn ends, day ends, dusk ends. */
export const SLOT_EDGES = { dawn: 5.5, day: 8, dusk: 17.5, night: 20 } as const;

export interface SlotLook {
  /** Sky bands, zenith to horizon. */
  bands: readonly [string, string, string, string];
  /** Full-page tint behind everything: always pale, ink text keeps well over 7:1. */
  page: string;
  orb: string;
  cloud: string;
  /** Colour of crop marks and strings, which must read on this sky. */
  mark: string;
  stars: number;
  /** Multiplied over lit and shaded paint. White by day, so brand colours are exact. */
  gradeLit: string;
  gradeShade: string;
}

export const SLOT_LOOK: Record<DaySlot, SlotLook> = {
  dawn: {
    bands: ['#c7d2fe', '#fbcfe8', '#fed7aa', '#fef3c7'],
    page: '#fff9f0',
    orb: '#fb923c',
    cloud: '#ffffff',
    mark: INK,
    stars: 0,
    gradeLit: '#ffeedd',
    gradeShade: '#ffd9c2',
  },
  day: {
    bands: ['#bfdbfe', '#cfe8fb', '#dff3ee', '#f0fdf4'],
    page: MINT,
    orb: '#facc15',
    cloud: '#ffffff',
    mark: INK,
    stars: 0,
    gradeLit: '#ffffff',
    gradeShade: '#ffffff',
  },
  dusk: {
    bands: ['#a5b4fc', '#f9a8d4', '#fdba74', '#fde68a'],
    page: '#fff6ee',
    orb: '#ff6b4a',
    cloud: '#fff7ed',
    mark: INK,
    stars: 0,
    gradeLit: '#ffdcc4',
    gradeShade: '#f7b9a6',
  },
  night: {
    bands: ['#0f1535', '#18204a', '#232f66', '#31407f'],
    page: '#eef1fb',
    orb: '#fef9c3',
    cloud: '#c7d2fe',
    mark: '#c7d2fe',
    stars: 1,
    // Moonlight: cool, and the shade is lifted towards the lit grade so forms stay readable.
    gradeLit: '#a3aef0',
    gradeShade: '#8791df',
  },
};

/** Half-width, in hours, of the cross-fade around each slot boundary. */
export const SKY_BLEND_HOURS = 1 / 3;
export const GRADE_BLEND_HOURS = 0.75;

/** Share of the stage box each sky band takes, zenith to horizon. */
export const SKY_BAND_FLEX = [18, 20, 22, 40] as const;

// --- Island --------------------------------------------------------------------------------

export const ISLAND = {
  /** Radius of the grass top in world units. Everything else is relative to it. */
  radius: 3,
  /** How far the lid of grass overhangs the slab below, so its rim gets an ink line. */
  lidOverhang: 0.07,
  lidThickness: 0.03,
  slabThickness: 0.27,
  /** Earth strata, top to bottom: radius as a share of the top, and thickness. */
  strata: [
    [0.893, 0.48],
    [0.72, 0.48],
    [0.507, 0.44],
    [0.293, 0.36],
    [0.133, 0.24],
  ],
  /** Wobble of the coastline (two harmonics) and of each stratum. */
  coastWobble: [0.028, 0.016],
  strataWobble: 0.03,
  /** Lighter grass patch in the middle, as a share of the radius. */
  patch: 0.58,
  dome: 0.07,
  mound: { radius: 0.5, height: 0.11 },
  rocks: 6,
  tufts: 14,
  emblem: { width: 0.24, height: 0.165, depth: 0.07 },
} as const;
