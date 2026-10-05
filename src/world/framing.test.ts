import { describe, expect, it } from 'vitest';
import { CAMERA, STICKER } from './config';
import {
  fitSubject,
  stepSpring,
  stickerReach,
  stickerSpec,
  type Box,
  type Spring,
} from './framing';

const canvas = { width: 1200, height: 800 };
const frame = { halfWidth: 3.1, lawn: 3.08, top: 5, bottom: 2.5 };

describe('fitSubject', () => {
  const box: Box = { x: 100, y: 50, width: 600, height: 700 };

  it('centres the subject horizontally and stands it on the bottom edge', () => {
    const placed = fitSubject({ box, canvas, frame, fit: 0.86, anchor: 1 });
    expect(placed.left).toBeCloseTo(box.x + box.width / 2, 6);
    // The lowest pixel of the sticker (paint + margin + shadow) is the bottom edge of the box.
    const lowest =
      placed.top +
      frame.bottom * placed.scale +
      stickerReach(placed.sticker) +
      placed.sticker.shadow;
    expect(lowest).toBeCloseTo(box.y + box.height, 6);
  });

  it('makes the lawn fit x the box width when the height allows it', () => {
    const placed = fitSubject({ box, canvas, frame, fit: 0.74, anchor: 1 });
    expect(2 * frame.lawn * placed.scale).toBeCloseTo(box.width * 0.74, 6);
  });

  it('never lets the sticker leave the box in either dimension', () => {
    const sizes = [
      [600, 700],
      [900, 300],
      [200, 700],
      [120, 120],
      [1400, 900],
    ] as const;
    for (const fit of [0.5, 0.86, 1]) {
      for (const [width, height] of sizes) {
        const target: Box = { x: 0, y: 0, width, height };
        const placed = fitSubject({ box: target, canvas, frame, fit, anchor: 1 });
        const reach = stickerReach(placed.sticker);
        const usedWidth =
          frame.halfWidth * 2 * placed.scale + 2 * reach + 2 * placed.sticker.shadow;
        const usedHeight =
          (frame.top + frame.bottom) * placed.scale * CAMERA.headroom +
          2 * reach +
          placed.sticker.shadow;
        expect(usedWidth).toBeLessThanOrEqual(width + 1e-6);
        expect(usedHeight).toBeLessThanOrEqual(height + 1e-6);
        expect(2 * frame.lawn * placed.scale).toBeLessThanOrEqual(width * fit + 1e-6);
      }
    }
  });

  it('keeps page chrome free at the top of a bleed stage', () => {
    const tall: Box = { x: 0, y: 0, width: 2000, height: 600 };
    const bare = fitSubject({ box: tall, canvas, frame, fit: 0.86, anchor: 1 });
    const chromed = fitSubject({ box: tall, canvas, frame, fit: 0.86, anchor: 1, chrome: 64 });
    expect(chromed.scale).toBeLessThan(bare.scale);
    const highest = chromed.top - frame.top * chromed.scale - stickerReach(chromed.sticker);
    expect(highest).toBeGreaterThanOrEqual(64);
  });

  it('centres vertically for the centre anchor', () => {
    const placed = fitSubject({ box, canvas, frame, fit: 0.62, anchor: 0 });
    const reach = stickerReach(placed.sticker);
    const highest = placed.top - frame.top * placed.scale - reach;
    const lowest = placed.top + frame.bottom * placed.scale + reach + placed.sticker.shadow;
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
});

describe('stickerSpec', () => {
  it('uses the three line weights of the design bible', () => {
    expect(stickerSpec(112)).toMatchObject({ ink: 2, margin: 5, shadow: 5, keyline: 1.5 });
    expect(stickerSpec(400)).toMatchObject({ ink: 3, margin: 8, shadow: 8 });
    expect(stickerSpec(900)).toMatchObject({ ink: 4, margin: 10, shadow: 8 });
  });

  it('cross-fades between them instead of popping', () => {
    let previous = stickerSpec(0);
    for (let side = 1; side <= 1000; side += 1) {
      const now = stickerSpec(side);
      expect(now.ink).toBeGreaterThanOrEqual(previous.ink);
      expect(now.ink - previous.ink).toBeLessThan(2 / STICKER.blend + 1e-9);
      expect(now.margin - previous.margin).toBeLessThan(4 / STICKER.blend + 1e-9);
      previous = now;
    }
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
