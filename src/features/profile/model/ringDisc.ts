import type { Passport } from '@/game';

/** The most bands the disc draws: past this, each band stands for several days. */
export const MAX_BANDS = 24;

export interface RingBand {
  /** Thick when most of the days it stands for closed the ring. */
  kind: 'full' | 'ring';
  days: number;
}

/**
 * Turns the passport's one-entry-per-day ring sequence into at most {@link MAX_BANDS} bands, from
 * the pith outward. A long-lived tree has hundreds of rings, more than a disc can draw, so
 * neighbouring days are merged and the page says so; the exact counts stay in the text summary.
 */
export function ringBands(sequence: Passport['ringSequence']): RingBand[] {
  const total = sequence.length;
  if (total === 0) return [];
  const per = daysPerBand(total);
  const bands: RingBand[] = [];
  for (let start = 0; start < total; start += per) {
    const slice = sequence.slice(start, start + per);
    const full = slice.filter((kind) => kind === 'full').length;
    bands.push({ kind: full * 2 >= slice.length ? 'full' : 'ring', days: slice.length });
  }
  return bands;
}

/** Days each band stands for; 1 means every ring is drawn. */
export function daysPerBand(total: number): number {
  return Math.max(1, Math.ceil(total / MAX_BANDS));
}

export interface RingGeometry {
  kind: RingBand['kind'];
  /** Outer radius of this band in the disc's 100-unit box. */
  radius: number;
}

export const PITH_RADIUS = 3.5;
export const BARK_RADIUS = 45;

/** Outer radius of every band: thick bands are twice as wide as thin ones, and together they fill the disc. */
export function ringGeometry(bands: readonly RingBand[]): RingGeometry[] {
  const widths = bands.map((band) => (band.kind === 'full' ? 2 : 1));
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum === 0) return [];
  const room = BARK_RADIUS - PITH_RADIUS;
  let edge = PITH_RADIUS;
  return bands.map((band, index) => {
    edge += ((widths[index] ?? 1) / sum) * room;
    return { kind: band.kind, radius: edge };
  });
}
