import { hashString } from '@/lib/rng';

/**
 * Shared design-system types and class lookups. Tailwind only sees complete class names, so every
 * token-to-class mapping lives here as a full string; components never build a class by concatenation.
 */

export const HUES = [
  'green',
  'blue',
  'yellow',
  'pink',
  'orange',
  'teal',
  'violet',
  'tomato',
] as const;
export type Hue = (typeof HUES)[number];

export const CATEGORY_IDS = ['move', 'eat', 'power', 'water', 'stuff', 'waste', 'nature'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/**
 * The canonical order wherever two category colours touch (stacked bars from the baseline up,
 * legends, filters). Chosen for worst-case colour-blind separation; do not reorder.
 */
export const CATEGORY_ORDER: readonly CategoryId[] = [
  'stuff',
  'power',
  'waste',
  'water',
  'eat',
  'move',
  'nature',
];

/** A surface colour a small printed thing can take: a hue fill or one of the neutrals. */
export type Swatch = Hue | 'white' | 'paper' | 'ink';

/** Saturated fills. Text on them is always ink (white only on `ink`). */
export const FILL_BG: Record<Swatch, string> = {
  green: 'bg-green text-ink',
  blue: 'bg-blue text-ink',
  yellow: 'bg-yellow text-ink',
  pink: 'bg-pink text-ink',
  orange: 'bg-orange text-ink',
  teal: 'bg-teal text-ink',
  violet: 'bg-violet text-ink',
  tomato: 'bg-tomato text-ink',
  white: 'bg-white text-ink',
  paper: 'bg-paper text-ink',
  ink: 'bg-ink text-white',
};

/** Quiet surfaces: a hue's tint keeps `ink-2` text legible. */
export const TINT_BG: Record<Hue, string> = {
  green: 'bg-green-tint',
  blue: 'bg-blue-tint',
  yellow: 'bg-yellow-tint',
  pink: 'bg-pink-tint',
  orange: 'bg-orange-tint',
  teal: 'bg-teal-tint',
  violet: 'bg-violet-tint',
  tomato: 'bg-tomato-tint',
};

/** The only coloured text: a `*-deep` on card, mat, paper or its own tint. */
export const DEEP_TEXT: Record<Hue, string> = {
  green: 'text-green-deep',
  blue: 'text-blue-deep',
  yellow: 'text-yellow-deep',
  pink: 'text-pink-deep',
  orange: 'text-orange-deep',
  teal: 'text-teal-deep',
  violet: 'text-violet-deep',
  tomato: 'text-tomato-deep',
};

/** CSS custom-property references, for SVG paint and `style` variables (never a hex in a component). */
export const HUE_VAR: Record<Hue, string> = {
  green: 'var(--color-green)',
  blue: 'var(--color-blue)',
  yellow: 'var(--color-yellow)',
  pink: 'var(--color-pink)',
  orange: 'var(--color-orange)',
  teal: 'var(--color-teal)',
  violet: 'var(--color-violet)',
  tomato: 'var(--color-tomato)',
};

export const HUE_DEEP_VAR: Record<Hue, string> = {
  green: 'var(--color-green-deep)',
  blue: 'var(--color-blue-deep)',
  yellow: 'var(--color-yellow-deep)',
  pink: 'var(--color-pink-deep)',
  orange: 'var(--color-orange-deep)',
  teal: 'var(--color-teal-deep)',
  violet: 'var(--color-violet-deep)',
  tomato: 'var(--color-tomato-deep)',
};

export const SWATCH_VAR: Record<Swatch, string> = {
  ...HUE_VAR,
  white: 'var(--color-white)',
  paper: 'var(--color-paper)',
  ink: 'var(--color-ink)',
};

export interface CategoryStyle {
  /** Product-facing name, sentence case. */
  label: string;
  /** The plain hue this category shares its colours with. */
  hue: Hue;
  /** Sticker fill; carries ink text. */
  bg: string;
  tintBg: string;
  deepText: string;
  fillVar: string;
  deepVar: string;
  /** Chart ink (>= 3:1 on card). Charts only, never UI fills. */
  markVar: string;
}

export const CATEGORY: Record<CategoryId, CategoryStyle> = {
  move: {
    label: 'Move',
    hue: 'violet',
    bg: 'bg-cat-move text-ink',
    tintBg: 'bg-cat-move-tint',
    deepText: 'text-cat-move-deep',
    fillVar: 'var(--color-cat-move)',
    deepVar: 'var(--color-cat-move-deep)',
    markVar: 'var(--color-cat-move-mark)',
  },
  eat: {
    label: 'Eat',
    hue: 'orange',
    bg: 'bg-cat-eat text-ink',
    tintBg: 'bg-cat-eat-tint',
    deepText: 'text-cat-eat-deep',
    fillVar: 'var(--color-cat-eat)',
    deepVar: 'var(--color-cat-eat-deep)',
    markVar: 'var(--color-cat-eat-mark)',
  },
  power: {
    label: 'Power',
    hue: 'yellow',
    bg: 'bg-cat-power text-ink',
    tintBg: 'bg-cat-power-tint',
    deepText: 'text-cat-power-deep',
    fillVar: 'var(--color-cat-power)',
    deepVar: 'var(--color-cat-power-deep)',
    markVar: 'var(--color-cat-power-mark)',
  },
  water: {
    label: 'Water',
    hue: 'blue',
    bg: 'bg-cat-water text-ink',
    tintBg: 'bg-cat-water-tint',
    deepText: 'text-cat-water-deep',
    fillVar: 'var(--color-cat-water)',
    deepVar: 'var(--color-cat-water-deep)',
    markVar: 'var(--color-cat-water-mark)',
  },
  stuff: {
    label: 'Stuff',
    hue: 'pink',
    bg: 'bg-cat-stuff text-ink',
    tintBg: 'bg-cat-stuff-tint',
    deepText: 'text-cat-stuff-deep',
    fillVar: 'var(--color-cat-stuff)',
    deepVar: 'var(--color-cat-stuff-deep)',
    markVar: 'var(--color-cat-stuff-mark)',
  },
  waste: {
    label: 'Waste',
    hue: 'teal',
    bg: 'bg-cat-waste text-ink',
    tintBg: 'bg-cat-waste-tint',
    deepText: 'text-cat-waste-deep',
    fillVar: 'var(--color-cat-waste)',
    deepVar: 'var(--color-cat-waste-deep)',
    markVar: 'var(--color-cat-waste-mark)',
  },
  nature: {
    label: 'Nature',
    hue: 'green',
    bg: 'bg-cat-nature text-ink',
    tintBg: 'bg-cat-nature-tint',
    deepText: 'text-cat-nature-deep',
    fillVar: 'var(--color-cat-nature)',
    deepVar: 'var(--color-cat-nature-deep)',
    markVar: 'var(--color-cat-nature-mark)',
  },
};

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

export function isHue(value: string): value is Hue {
  return (HUES as readonly string[]).includes(value);
}

/** The fixed rotation set (bible 3.1). Anything else is off-system. */
export type Rotation = -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4;

export const ROTATE: Record<Rotation, string> = {
  [-4]: '-rotate-4',
  [-3]: '-rotate-3',
  [-2]: '-rotate-2',
  [-1]: '-rotate-1',
  0: 'rotate-0',
  1: 'rotate-1',
  2: 'rotate-2',
  3: 'rotate-3',
  4: 'rotate-4',
};

/**
 * A stable resting rotation for a thing, picked by hashing its id: never `Math.random()` at render.
 * Interactive things stay within ±2°; pass `max` 3 or 4 for expressive, static stickers.
 */
export function restRotation(id: string, max: 1 | 2 | 3 | 4 = 2): Rotation {
  const options: Rotation[] = [];
  for (let step = 1; step <= max; step += 1) {
    options.push(-step as Rotation, step as Rotation);
  }
  return options[hashString(id) % options.length] ?? 0;
}

/** Resting tilt for sticker lettering (bible 2.5): XROT from {-6, 0, 6}, YROT from {-12, -8, 8, 12}. */
export function restTilt(text: string): { xrot: number; yrot: number } {
  const hash = hashString(text);
  const xrot = [-6, 0, 6][hash % 3] ?? 0;
  const yrot = [-12, -8, 8, 12][(hash >>> 3) % 4] ?? 8;
  return { xrot, yrot };
}
