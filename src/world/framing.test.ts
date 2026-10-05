import { describe, expect, it } from 'vitest';
import { STICKER } from './config';
import {
  fitSubject,
  stepSpring,
  stickerMargins,
  stickerWeight,
  type Box,
  type Spring,
} from './framing';

const canvas = { width: 1200, height: 800 };
const frame = { halfWidth: 3, top: 5, bottom: 2.5 };

describe('fitSubject', () => {
  const box: Box = { x: 100, y: 50, width: 600, height: 500 };

  it('centres the subject horizontally and stands it on the bottom edge', () => {
    const placed = fitSubject({ box, canvas, frame, fit: 0.86, anchor: 1 });
    const { side, shadow } = stickerMargins(placed.weight);
    expect(placed.left).toBeCloseTo(box.x + box.width / 2, 6);
    // The lowest pixel of the sticker (paint + margin + shadow) is the bottom edge of the box.
    const lowest = placed.top + frame.bottom * placed.scale + side + shadow;
    expect(lowest).toBeCloseTo(box.y + box.height, 6);
  });

  it('fits the framed subject inside fit x box in both dimensions', () => {
    const sizes = [
      [600, 500],
      [900, 300],
      [200, 700],
      [120, 120],
    ] as const;
    for (const fit of [0.5, 0.86, 1]) {
      for (const [width, height] of sizes) {
        const target: Box = { x: 0, y: 0, width, height };
        const placed = fitSubject({ box: target, canvas, frame, fit, anchor: 1 });
        const { side, shadow } = stickerMargins(placed.weight);
        const usedWidth = frame.halfWidth * 2 * placed.scale + 2 * side + 2 * shadow;
        const usedHeight = (frame.top + frame.bottom) * placed.scale + 2 * side + shadow;
        expect(usedWidth).toBeLessThanOrEqual(width * fit + 1e-6);
        expect(usedHeight).toBeLessThanOrEqual(height * fit + 1e-6);
        // It touches the limit in at least one dimension: no wasted space.
        expect(Math.min(width * fit - usedWidth, height * fit - usedHeight)).toBeLessThan(1e-6);
      }
    }
  });

  it('centres vertically for the centre anchor', () => {
    const placed = fitSubject({ box, canvas, frame, fit: 0.8, anchor: 0 });
    const { side, shadow } = stickerMargins(placed.weight);
    const highest = placed.top - frame.top * placed.scale - side;
    const lowest = placed.top + frame.bottom * placed.scale + side + shadow;
    expect((highest + lowest) / 2).toBeCloseTo(box.y + box.height / 2, 6);
  });

  it('maps canvas pixels to camera units with y up and the centre at zero', () => {
    const placed = fitSubject({ box, canvas, frame, fit: 0.86, anchor: 1 });
    expect(placed.x).toBeCloseTo(placed.left - canvas.width / 2, 9);
    expect(placed.y).toBeCloseTo(canvas.height / 2 - placed.top, 9);
  });

  it('follows the box 1:1 when it moves (scrolling)', () => {
    const before = fitSubject({ box, canvas, frame, fit: 0.86, anchor: 1 });
    const moved = { ...box, x: box.x + 37.5, y: box.y - 212.25 };
    const after = fitSubject({ box: moved, canvas, frame, fit: 0.86, anchor: 1 });
    expect(after.left - before.left).toBeCloseTo(37.5, 9);
    expect(after.top - before.top).toBeCloseTo(-212.25, 9);
    expect(after.scale).toBe(before.scale);
  });

  it('survives a collapsed box', () => {
    const collapsed: Box = { x: 0, y: 0, width: 0, height: 0 };
    const placed = fitSubject({ box: collapsed, canvas, frame, fit: 0.86, anchor: 1 });
    expect(Number.isFinite(placed.scale)).toBe(true);
    expect(placed.scale).toBeGreaterThan(0);
  });

  it('thins the sticker lines for small subjects but keeps them readable', () => {
    expect(stickerWeight(STICKER.fullWeightScale * 2)).toBe(1);
    expect(stickerWeight(1)).toBe(STICKER.minWeight);
    expect(stickerWeight(STICKER.fullWeightScale * 0.6)).toBeCloseTo(0.6, 6);
  });
});

describe('stepSpring', () => {
  const run = (zeta: number, dt: number) => {
    const spring: Spring = { x: 1, v: 0 };
    let lowest = 1;
    for (let time = 0; time < 2; time += dt) {
      stepSpring(spring, dt, 9, zeta);
      lowest = Math.min(lowest, spring.x);
    }
    return { spring, lowest };
  };

  it('settles at rest and overshoots a little when under-damped', () => {
    const { spring, lowest } = run(0.72, 1 / 60);
    expect(spring.x).toBe(0);
    expect(spring.v).toBe(0);
    expect(lowest).toBeLessThan(-0.01);
    expect(lowest).toBeGreaterThan(-0.12);
  });

  it('never overshoots when critically damped', () => {
    expect(run(1, 1 / 60).lowest).toBeGreaterThanOrEqual(0);
  });

  it('is frame-rate independent', () => {
    const at = (dt: number) => {
      const spring: Spring = { x: 1, v: 0 };
      for (let i = 0; i < Math.round(0.3 / dt); i += 1) stepSpring(spring, dt, 9, 0.72);
      return spring.x;
    };
    expect(at(1 / 120)).toBeCloseTo(at(1 / 30), 6);
  });

  it('is practically there after 700 ms', () => {
    const spring: Spring = { x: 1, v: 0 };
    for (let i = 0; i < 42; i += 1) stepSpring(spring, 1 / 60, 9, 0.72);
    expect(Math.abs(spring.x)).toBeLessThan(0.03);
  });
});
