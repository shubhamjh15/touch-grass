import type { CategoryId } from './tokens';

/**
 * One die-cut silhouette per action category, in a 66 × 66 box. Shape + icon + colour is the triple
 * coding that keeps categories apart without relying on colour (bible 4.3).
 */
export interface StickerShape {
  /** Human name of the silhouette, used in docs and tests. */
  name: string;
  d: string;
  /** Icon nudge so it sits in the optical centre of an asymmetric shape. */
  iconDx: number;
  iconDy: number;
  /** The price tag's punched hole. */
  hole?: { cx: number; cy: number; r: number };
}

export const STICKER_SHAPES: Record<CategoryId, StickerShape> = {
  move: {
    name: 'ticket',
    d: 'M8 14h50a4 4 0 0 1 4 4v8a7 7 0 0 0 0 14v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-8a7 7 0 0 0 0-14v-8a4 4 0 0 1 4-4z',
    iconDx: 0,
    iconDy: 0,
  },
  eat: { name: 'plate', d: 'M33 6a27 27 0 1 0 0 54a27 27 0 1 0 0-54z', iconDx: 0, iconDy: 0 },
  power: {
    name: 'burst',
    d: 'M33 2l6.2 7.8 9.3-3.6 1.5 9.9 9.9 1.5-3.6 9.3L64 33l-7.8 6.2 3.6 9.3-9.9 1.5-1.5 9.9-9.3-3.6L33 64l-6.2-7.8-9.3 3.6-1.5-9.9-9.9-1.5 3.6-9.3L2 33l7.8-6.2-3.6-9.3 9.9-1.5 1.5-9.9 9.3 3.6z',
    iconDx: 0,
    iconDy: 0,
  },
  water: {
    name: 'drop',
    d: 'M33 4c5 9 22 22 22 37a22 22 0 0 1-44 0C11 26 28 13 33 4z',
    iconDx: 0,
    iconDy: 6,
  },
  stuff: {
    name: 'price tag',
    d: 'M22 6h34a4 4 0 0 1 4 4v46a4 4 0 0 1-4 4H22L5 33z',
    iconDx: 6,
    iconDy: 0,
    hole: { cx: 17, cy: 33, r: 3 },
  },
  waste: { name: 'hexagon', d: 'M33 4l25 14.5v29L33 62 8 47.5v-29z', iconDx: 0, iconDy: 0 },
  nature: {
    name: 'leaf',
    d: 'M33 5c6 0 9 5 15 6s11 3 12 9-3 9-3 15 4 10 1 16-9 5-14 8-7 6-13 5-7-6-12-9-11-3-13-9 3-9 3-15-4-10-1-15 8-5 13-7 6-4 12-4z',
    iconDx: 0,
    iconDy: 0,
  },
};
