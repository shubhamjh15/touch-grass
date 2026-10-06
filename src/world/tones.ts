import { clamp01, smoothstep } from '@/lib/math';
import { hexToRgb, mixOklab, mixRgb, type Rgb } from './color';
import {
  ACCENT,
  CANOPY,
  CANOPY_JITTER,
  FIXED_TONES,
  GRASS,
  LEAF,
  TONE,
  TONE_COUNT,
  type ToneTriple,
  type VitalityRamp,
} from './config';
import type { Species } from './contract';

/**
 * Resolves the paint table for a tree in a given state: one (lit, shade, highlight)
 * triple per tone. Vitality only ever changes colour here (thriving, thirsty and
 * dormant ramps are mixed), never geometry.
 */
export interface ToneTable {
  lit: Float32Array;
  shade: Float32Array;
  highlight: Float32Array;
}

export function createToneTable(): ToneTable {
  return {
    lit: new Float32Array(TONE_COUNT * 3),
    shade: new Float32Array(TONE_COUNT * 3),
    highlight: new Float32Array(TONE_COUNT * 3),
  };
}

type Triple = [Rgb, Rgb, Rgb];
const parse = (triple: ToneTriple): Triple => [
  hexToRgb(triple[0]),
  hexToRgb(triple[1]),
  hexToRgb(triple[2]),
];
/** Vitality ramps are mixed perceptually, so "thirsty" never passes through mud. */
const mixTriple = (a: Triple, b: Triple, t: number): Triple => [
  mixOklab(a[0], b[0], t),
  mixOklab(a[1], b[1], t),
  mixOklab(a[2], b[2], t),
];

/** Blends the three vitality ramps: 1 thriving, 0.5 thirsty, 0 dormant. */
function byVitality(ramp: VitalityRamp, vitality: number): Triple {
  const v = clamp01(vitality);
  return v >= 0.5
    ? mixTriple(parse(ramp.thirsty), parse(ramp.thriving), (v - 0.5) * 2)
    : mixTriple(parse(ramp.dormant), parse(ramp.thirsty), v * 2);
}

export function resolveTones(
  table: ToneTable,
  species: Species,
  vitality: number,
  growth: number,
): ToneTable {
  const put = (tone: number, triple: Triple) => {
    table.lit.set(triple[0], tone * 3);
    table.shade.set(triple[1], tone * 3);
    table.highlight.set(triple[2], tone * 3);
  };
  const fixed = (tone: number, triple: ToneTriple) => put(tone, parse(triple));

  const canopy = byVitality(CANOPY[species], vitality);
  put(TONE.canopyA, canopy);
  put(TONE.canopyB, [
    mixRgb(canopy[0], canopy[1], CANOPY_JITTER.towardShade),
    mixRgb(canopy[1], [0, 0, 0], 0.06),
    canopy[2],
  ]);
  put(TONE.canopyC, [
    mixRgb(canopy[0], canopy[2], CANOPY_JITTER.towardHighlight),
    mixRgb(canopy[1], canopy[0], 0.12),
    canopy[2],
  ]);
  put(TONE.canopyAlt, byVitality(LEAF, vitality));
  // A conifer's accents are pale new growth, not lime leaves.
  put(
    TONE.accent,
    species === 'pine'
      ? [mixRgb(canopy[0], canopy[2], 0.65), canopy[0], canopy[2]]
      : byVitality(ACCENT, vitality),
  );

  // A sprout's stem is green and hardens into bark as the seedling grows.
  const hardened = smoothstep(0.05, 0.2, growth);
  put(TONE.bark, mixTriple(byVitality(LEAF, vitality), parse(FIXED_TONES.bark), hardened));

  const v = clamp01(vitality);
  const grassFrom = v >= 0.5 ? GRASS.thirsty : GRASS.dormant;
  const grassTo = v >= 0.5 ? GRASS.thriving : GRASS.thirsty;
  const grassMix = v >= 0.5 ? (v - 0.5) * 2 : v * 2;
  const grass = (pick: (set: (typeof GRASS)['thriving']) => string) =>
    mixOklab(hexToRgb(pick(grassFrom)), hexToRgb(pick(grassTo)), grassMix);
  // The "shade" of a grass top is the contact decal under the crown.
  const decal = grass((set) => set.decal);
  put(TONE.grassPatch, [grass((set) => set.patch), decal, grass((set) => set.patch)]);
  put(TONE.grassTop, [grass((set) => set.top), decal, grass((set) => set.patch)]);
  put(TONE.grassSide, [
    grass((set) => set.side),
    grass((set) => set.sideShade),
    grass((set) => set.top),
  ]);

  fixed(TONE.petal, FIXED_TONES.petal);
  fixed(TONE.petalCore, FIXED_TONES.petalCore);
  fixed(TONE.kraftA, FIXED_TONES.kraftA);
  fixed(TONE.kraftB, FIXED_TONES.kraftB);
  fixed(TONE.rock, FIXED_TONES.rock);
  fixed(TONE.soil, FIXED_TONES.soil);
  fixed(TONE.seed, FIXED_TONES.seed);
  fixed(TONE.plaque, FIXED_TONES.plaque);
  fixed(TONE.ink, FIXED_TONES.ink);
  fixed(TONE.paper, FIXED_TONES.paper);
  fixed(TONE.white, FIXED_TONES.white);
  fixed(TONE.pink, FIXED_TONES.pink);
  fixed(TONE.yellow, FIXED_TONES.yellow);
  fixed(TONE.violet, FIXED_TONES.violet);
  fixed(TONE.tomato, FIXED_TONES.tomato);
  fixed(TONE.blue, FIXED_TONES.blue);
  fixed(TONE.orange, FIXED_TONES.orange);
  fixed(TONE.teal, FIXED_TONES.teal);
  fixed(TONE.moss, FIXED_TONES.moss);
  fixed(TONE.lime, FIXED_TONES.lime);
  fixed(TONE.kraftDark, FIXED_TONES.kraftDark);
  fixed(TONE.green, FIXED_TONES.green);
  fixed(TONE.glow, FIXED_TONES.glow);
  fixed(TONE.glass, FIXED_TONES.glass);
  fixed(TONE.spark, FIXED_TONES.spark);
  return table;
}
