import type { Species, StageMode, WorldQuality } from './contract';

/**
 * The one place to re-tune the Grove: every colour, line weight, timing and budget the
 * world uses lives here (tree proportions are in `tree/species.ts`), so the art direction
 * can change without touching the generators or the shaders. Values follow the design
 * bible, section 5 (the Grove) and section 7 (motion). No three.js in this file: it
 * ships in the main bundle.
 */

// --- Brand ---------------------------------------------------------------------------------

export const INK = '#18181b';
/** The die-cut margin: always white, never graded by the time of day. */
export const PAPER = '#ffffff';
export const MINT = '#f0fdf4';

// --- The die-cut sticker (bible 5.2) -------------------------------------------------------

export interface StickerSpec {
  /** Ink outline, the same family as the UI borders. */
  ink: number;
  /** White die-cut margin outside the ink line. */
  margin: number;
  /** Kiss-cut hairline that closes the margin, so the sticker edge reads on a pale sky. */
  keyline: number;
  /** Hard shadow offset, down and to the right. */
  shadow: number;
}

/** Line weights in CSS pixels, by the short side of the stage box. */
export const STICKER = {
  steps: [
    { below: 240, ink: 2, margin: 5, shadow: 5 },
    { below: 560, ink: 3, margin: 8, shadow: 8 },
    { below: Number.POSITIVE_INFINITY, ink: 4, margin: 10, shadow: 8 },
  ],
  keyline: 1.5,
  /** Neighbouring steps cross-fade over this many pixels, so a flight never pops. */
  blend: 56,
  /** While the sticker is carried between stages its shadow lengthens to this multiple. */
  carriedShadow: 2.5,
} as const;

// --- Camera and placement (bible 5.8) ------------------------------------------------------

const deg = (value: number) => (value * Math.PI) / 180;

export const CAMERA = {
  /** Elevation of the three-quarter view: the lawn ellipse has ratio 0.227, as in the look-dev. */
  pitch: deg(13.1),
  /** Elevation per stage mode. The ceremony looks down a little more. */
  pitchByMode: { hero: deg(13.1), hub: deg(13.1), companion: deg(13.1), ceremony: deg(20) },
  /** Resting azimuth: ring medallion, landmarks and sundial face the viewer. */
  yaw: 0,
  /** Idle turn. `turn` is seconds per full revolution, `drift` a sway in radians over `period`. */
  idle: {
    hero: { turn: 90, drift: 0, period: 20 },
    hub: { turn: 0, drift: deg(4), period: 20 },
    companion: { turn: 0, drift: deg(4), period: 20 },
    ceremony: { turn: 0, drift: 0, period: 20 },
  },
  /** Breathing bob in world units and seconds. */
  bob: 0.04,
  bobPeriod: 5,
  /** The subject plus this headroom must fit the stage height. */
  headroom: 1.08,
  /** Pixels of page chrome kept free at the top of a bleed stage (hero, hub). */
  bleedChrome: 84,
} as const satisfies Record<string, unknown>;

/** Stage defaults by mode: share of the stage width the lawn takes, and the anchor. */
export const STAGE_DEFAULTS: Record<StageMode, { fit: number; anchor: 'center' | 'bottom' }> = {
  hero: { fit: 0.86, anchor: 'bottom' },
  hub: { fit: 0.74, anchor: 'bottom' },
  companion: { fit: 0.86, anchor: 'bottom' },
  ceremony: { fit: 0.62, anchor: 'center' },
};

// --- Motion (bible 7.2, 7.3) ---------------------------------------------------------------

export const MOTION = {
  /** Spring `carry` (170 / 17 / 1): the world between two stages, settles in about 0.47 s. */
  flightOmega: 13.04,
  flightZeta: 0.652,
  /** Reduced motion replaces the flight with a cut and a cross-fade of this length. */
  crossFadeMs: 150,
  /** First appearance: a soft relative of spring `pop`. */
  appearOmega: 20,
  appearZeta: 0.5,
  appearFrom: 0.86,
  fadeOutPerSecond: 7,
  /** While a route is loading the world holds its last box this long before fading. */
  graceMs: 400,
  /** Displayed growth, vitality and hour ease towards the snapshot at these rates (1/s). */
  growthLambda: 3.2,
  /** A previewed species change regrows this many times faster than ordinary growth. */
  regrowBoost: 2.6,
  vitalityLambda: 2.4,
  hourLambda: 5,
  pitchLambda: 6,
  /** New parts overshoot by this share while growth is moving (spring `pop`, about 19 %). */
  popOvershoot: 0.19,
} as const;

// --- Quality tiers (direction 3.4) -----------------------------------------------------------

export interface QualityTier {
  /** Device-pixel-ratio cap on a fine pointer (desktop). Never exceeds the real devicePixelRatio. */
  dpr: number;
  /** The same cap on touch screens, whose pixels are smaller. */
  dprTouch: number;
  /**
   * Most megapixels the drawing buffer may hold: the pixel ratio is lowered on a large
   * stage until it fits. Integrated GPUs are bound by fill rate, not by the ratio.
   */
  megapixels: number;
  /** Side of the sun's shadow map in texels; 0 = no shadow pass, a soft blob under the crown. */
  shadowMap: number;
  /** The shadow map is redrawn every this many frames while nothing but the wind moves. */
  shadowEvery: number;
  /** Multisampled drawing buffer. */
  antialias: boolean;
  /** Bloom, vignette and tone mapping through the effect composer. */
  post: boolean;
  /** Half-resolution ambient occlusion in the composer. */
  ao: boolean;
  /** Icosphere subdivisions of a foliage puff. */
  puffDetail: number;
  /** Share of the leaf cards on the crown that is drawn. */
  leafShare: number;
  /** Segments around the island. */
  islandSegments: number;
  /** Sides of the trunk and of the branches. */
  trunkSides: number;
  branchSides: number;
  /** Grass tufts, flowers and drifting motes. */
  grassTufts: number;
  flowers: number;
  motes: number;
  clouds: number;
}

export const QUALITY: Record<WorldQuality, QualityTier> = {
  low: {
    dpr: 1,
    dprTouch: 1.5,
    megapixels: 1.1,
    shadowMap: 0,
    shadowEvery: 1,
    antialias: true,
    post: false,
    ao: false,
    puffDetail: 2,
    leafShare: 0.4,
    islandSegments: 36,
    trunkSides: 6,
    branchSides: 4,
    grassTufts: 800,
    flowers: 24,
    motes: 0,
    clouds: 4,
  },
  medium: {
    dpr: 1.5,
    dprTouch: 2,
    megapixels: 1.5,
    shadowMap: 1024,
    shadowEvery: 3,
    antialias: true,
    post: false,
    ao: false,
    puffDetail: 3,
    leafShare: 0.7,
    islandSegments: 48,
    trunkSides: 8,
    branchSides: 5,
    grassTufts: 1800,
    flowers: 44,
    motes: 28,
    clouds: 6,
  },
  high: {
    dpr: 1.5,
    dprTouch: 2,
    megapixels: 2.6,
    shadowMap: 2048,
    shadowEvery: 2,
    antialias: true,
    post: true,
    ao: true,
    puffDetail: 3,
    leafShare: 1,
    islandSegments: 64,
    trunkSides: 10,
    branchSides: 6,
    grassTufts: 3000,
    flowers: 64,
    motes: 48,
    clouds: 7,
  },
};

/** Budgets in view (direction 3.4), asserted against `renderer.info` in the world lab. */
export const BUDGET: Record<WorldQuality, { drawCalls: number; triangles: number }> = {
  low: { drawCalls: 60, triangles: 60_000 },
  medium: { drawCalls: 100, triangles: 120_000 },
  high: { drawCalls: 100, triangles: 150_000 },
};

// --- Tones ---------------------------------------------------------------------------------

/**
 * Every painted surface picks one tone. A tone is a (base, shade, highlight) triple;
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
  ink: 17,
  // Props, landmarks, Moss and loose paper bits (bible 5.3 fixed materials, 5.6, 5.7).
  paper: 18,
  white: 19,
  pink: 20,
  yellow: 21,
  violet: 22,
  tomato: 23,
  blue: 24,
  orange: 25,
  teal: 26,
  moss: 27,
  lime: 28,
  kraftDark: 29,
  green: 30,
  /** From here on tones are emissive: never graded by the time of day. */
  glow: 31,
  /** Lantern glass: plain yellow by day, `glow` once it is lit. */
  glass: 32,
  spark: 33,
} as const;
export const TONE_COUNT = 34;
/** First emissive tone: this one and every later tone ignore the time-of-day grade. */
export const EMISSIVE_FROM = 31;

/** base, shade, highlight */
export type ToneTriple = readonly [string, string, string];
export type VitalityRamp = { thriving: ToneTriple; thirsty: ToneTriple; dormant: ToneTriple };

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
    thriving: ['#34d399', '#059669', '#a7f3d0'],
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
  petal: ['#fff7fb', '#fbcfe8', '#ffffff'],
  petalCore: ['#facc15', '#eab308', '#fde68a'],
  kraftA: ['#e7c9a0', '#d4a373', '#f3dcb8'],
  kraftB: ['#d4a373', '#b98652', '#e7c9a0'],
  rock: ['#f5f5f4', '#d6d3d1', '#ffffff'],
  soil: ['#b98652', '#96633a', '#d4a373'],
  seed: ['#e7c9a0', '#d4a373', '#f3dcb8'],
  plaque: ['#fffbeb', INK, '#ffffff'],
  ink: [INK, INK, INK],
  paper: ['#fffbeb', '#f1e4bf', '#ffffff'],
  white: ['#ffffff', '#dfe3ea', '#ffffff'],
  pink: ['#f472b6', '#db2777', '#fce7f3'],
  yellow: ['#facc15', '#e0a800', '#fef9c3'],
  violet: ['#9974f8', '#7450e0', '#ede9fe'],
  tomato: ['#ff6b4a', '#dc3b21', '#fee2e2'],
  blue: ['#60a5fa', '#3b82f6', '#ffffff'],
  orange: ['#fb923c', '#ea6a12', '#ffedd5'],
  teal: ['#2dd4bf', '#0d9488', '#ccfbf1'],
  moss: ['#22c55e', '#16a34a', '#86efac'],
  lime: ['#bef264', '#84cc16', '#ecfccb'],
  kraftDark: ['#b98652', '#96633a', '#d4a373'],
  green: ['#4ade80', '#22c55e', '#bbf7d0'],
  glow: ['#fef9c3', '#fef9c3', '#ffffff'],
  glass: ['#facc15', '#e0a800', '#fef9c3'],
  spark: ['#fde68a', '#fde68a', '#fef9c3'],
} as const satisfies Record<string, ToneTriple>;

/** Colour jitter between clumps: B leans to the shade, C to the highlight. */
export const CANOPY_JITTER = { towardShade: 0.1, towardHighlight: 0.12 } as const;

// --- Paint: four printed steps, one lamp (bible 5.2) ---------------------------------------

export const SHADING = {
  /** The lamp, fixed in view space: top-left-front. Turning the island never moves it. */
  lamp: [-0.55, 0.65, 0.52],
  /** `dot(normal, lamp)` above `base` is the base tone, below `shade` the shade tone. */
  base: 0.1,
  shade: -0.25,
  /** Low tier: no halftone band, one hard edge here. */
  hardEdge: -0.08,
  /** The band between them: shade-coloured dots, constant on screen at full line weight. */
  dotPitchPx: 7,
  dotRadiusPx: 2.35,
  dotAngle: deg(30),
  /** Gloss: one hard oval towards the lamp. Centre and half-axes in clump radii, and its bend. */
  glossAt: 0.49,
  glossLength: 0.19,
  glossWidth: 0.1,
  glossBend: 0.5,
  /** Depth squash of clumps towards their centre, so they stack like paper discs. */
  clumpFlatten: 0.1,
} as const;

// --- Vitality (bible 5.3) ------------------------------------------------------------------

export const VITALITY = {
  /** Droop of the tips (1 = the thirsty maximum, 14 degrees) at vitality 1, 0.5 and 0. */
  droop: [0, 1, 0.57],
  /** Share of the full sway at vitality 1, 0.5 and 0. */
  sway: [1, 0.6, 0.15],
  /** Share of clumps a dormant tree hides. Never the core, never the crown. */
  dormantHidden: 0.35,
} as const;

// --- Time of day (bible 5.3) ---------------------------------------------------------------

export type DaySlot = 'night' | 'dawn' | 'day' | 'dusk';

/** Local clock boundaries, in hours: the hour at which each slot begins. */
export const SLOT_EDGES = { dawn: 5.5, day: 8, dusk: 17.5, night: 20 } as const;

export interface SlotLook {
  /** Sky bands, zenith to horizon. */
  bands: readonly [string, string, string, string];
  orb: string;
  cloud: string;
  /** Colour of crop marks and threads, which must read on this sky. */
  mark: string;
  stars: number;
  /** Multiplied per channel (in sRGB) over every painted tone. White by day. */
  grade: string;
  /** 1 when the sundial shadow is cast, 0 when it has faded out. */
  castShadow: number;
}

export const SLOT_LOOK: Record<DaySlot, SlotLook> = {
  dawn: {
    bands: ['#c7d2fe', '#fbcfe8', '#fed7aa', '#fef3c7'],
    orb: '#fb923c',
    cloud: '#ffffff',
    mark: INK,
    stars: 0,
    grade: '#ffe8d6',
    castShadow: 1,
  },
  day: {
    bands: ['#bfdbfe', '#cfe8fb', '#dff3ee', '#f0fdf4'],
    orb: '#facc15',
    cloud: '#ffffff',
    mark: INK,
    stars: 0,
    grade: '#ffffff',
    castShadow: 1,
  },
  dusk: {
    bands: ['#a5b4fc', '#f9a8d4', '#fdba74', '#fde68a'],
    orb: '#ff6b4a',
    cloud: '#fff7ed',
    mark: INK,
    stars: 0,
    grade: '#ffd2b8',
    castShadow: 1,
  },
  night: {
    bands: ['#0f1535', '#18204a', '#232f66', '#31407f'],
    orb: '#fef9c3',
    cloud: '#c7d2fe',
    mark: '#c7d2fe',
    stars: 1,
    // Lightened moonlight: every base tone keeps at least 3:1 against ink at night.
    grade: '#aab4f0',
    castShadow: 0,
  },
};

export const STAR = '#fde68a';

/** Half-width, in hours, of the cross-fade around each slot boundary (a 40-minute window). */
export const SLOT_BLEND_HOURS = 1 / 3;

/** The hanging rig: where the orb travels, as fractions of the stage box. */
export const ORB = {
  from: 5.5,
  until: 20,
  highest: 12.75,
  left: 0.12,
  right: 0.88,
  low: 0.5,
  high: 0.13,
  moon: [0.68, 0.14],
} as const;

/** The sundial: elevation of the sun above the horizon, `base + swing * sin(...)`, in radians. */
export const SUNDIAL = { base: deg(20), swing: deg(45), ticks: 13 } as const;

// --- Island (bible 5.4) --------------------------------------------------------------------

export const ISLAND = {
  /** Radius of the lawn in world units: the island diameter D of the bible is 6. */
  radius: 3,
  /** How far the lid of grass overhangs the slab below, so its rim gets an ink line. */
  lidOverhang: 0.07,
  lidThickness: 0.03,
  slabThickness: 0.25,
  /** Cardboard terraces, top to bottom: radius as a share of the lawn, and thickness. */
  strata: [
    [0.89, 0.48],
    [0.72, 0.48],
    [0.51, 0.44],
    [0.29, 0.36],
    [0.13, 0.24],
  ],
  /** Wobble of the rim (two harmonics, 3 % in total at most) and of each terrace. */
  coastWobble: [0.018, 0.01],
  strataWobble: 0.02,
  strataOffset: 0.02,
  /** Lighter grass patch in the middle, as a share of the radius. */
  patch: 0.58,
  dome: 0.07,
  /** The tree stands a little behind the centre, so the front lawn is larger. */
  treeBack: 0.24,
  mound: { radius: 0.46, height: 0.1 },
  rocks: 3,
  tufts: 16,
  /** Ring medallion: half-width, half-height and depth, and the day counts that add a ring. */
  emblem: { width: 0.225, height: 0.155, depth: 0.07, rings: [1, 7, 30, 100, 365] },
  /** Hour ticks of the sundial: distance inside the rim, length and width. */
  ticks: { inset: 0.04, length: 0.18, width: 0.04 },
} as const;

// --- Interaction ---------------------------------------------------------------------------

/** Drag, hover and idle rotation (bible 5.8, 5.9). Angles in radians, times in seconds. */
export const ORBIT = {
  /** Dragging across one stage width turns the island this far. */
  perStageWidth: deg(216),
  inertia: 0.35,
  maxSpeed: 6,
  /** Hub: the island eases back to its rest pose this long after release, over `returnTime`. */
  resumeAfter: 4,
  returnTime: 0.72,
  /** Vertical drag tilts the camera a little, with rubber-banding beyond the limit. */
  maxTilt: deg(10),
  /** Hover parallax on fine pointers. */
  hoverYaw: deg(3),
  hoverPitch: deg(2),
  hoverSmoothing: 0.25,
  /** One arrow-key press. */
  keyStep: deg(30),
} as const;

/** Runtime adaptation of the `auto` preference: resolution first, then the tier. */
export const GOVERNOR = {
  /** Shares of the tier's DPR cap that are tried before the tier is dropped. */
  dprSteps: [1, 0.85, 0.7],
  /** Frames judged together: half a second at 60 Hz. */
  window: 30,
  /** A frame is late when it takes this many display intervals. */
  lateFactor: 1.4,
  /** A window with more than this share of late frames is slow. */
  lateShare: 0.12,
  /** Slow windows in a row before anything changes: about a second in all. */
  strikes: 2,
  /** Display interval assumed until a faster cadence is observed, and the fastest believed. */
  refreshMs: 16.7,
  fastestMs: 4,
  /** Frames ignored after any change, while shaders compile and buffers resize. */
  settle: 45,
  /** Frames ignored after a drag, a resize or a return to the tab. */
  resume: 12,
  /** A single frame longer than this is a hiccup (tab switch, GC), not a slow device. */
  hiccupMs: 250,
} as const;
