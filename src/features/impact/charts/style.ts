/**
 * How a line looks, shared by the plot (inside the lazy chart chunk) and the legend (outside it).
 * Colour is never the only signal: each line also has its own dash, and the legend repeats both.
 */
export interface LineStyle {
  stroke: string;
  /** SVG `stroke-dasharray`; empty for a solid line. */
  dash: string;
}

const SOLID_INK: LineStyle = { stroke: 'var(--color-ink)', dash: '' };

export const LINE_STYLES: readonly LineStyle[] = [
  SOLID_INK,
  { stroke: 'var(--color-green-deep)', dash: '7 4' },
  { stroke: 'var(--color-blue-deep)', dash: '2 4' },
  { stroke: 'var(--color-yellow-deep)', dash: '10 3 2 3' },
  { stroke: 'var(--color-cat-move-deep)', dash: '14 4' },
  { stroke: 'var(--color-pink-deep)', dash: '3 3' },
  { stroke: 'var(--color-teal-deep)', dash: '1 4' },
  { stroke: 'var(--color-orange-deep)', dash: '5 2 1 2' },
  { stroke: 'var(--color-ink-3)', dash: '9 3' },
];

export function lineStyle(index: number): LineStyle {
  return LINE_STYLES[index % LINE_STYLES.length] ?? SOLID_INK;
}

/** The tick and label ink for every chart: mono, small, never a series colour. */
export const TICK = {
  fontSize: 11,
  fill: 'var(--color-ink-3)',
  fontFamily: 'var(--font-mono)',
} as const;

export const AXIS_LINE = { stroke: 'var(--color-ink)', strokeWidth: 1.5 } as const;
