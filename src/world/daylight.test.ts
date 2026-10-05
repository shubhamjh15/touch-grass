import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb } from './color';
import { INK, SLOT_LOOK } from './config';
import { hourDelta, lightAt, skyAt, slotAt, slotBlend } from './daylight';

describe('skyAt', () => {
  it('prints the token ramps in the middle of each slot', () => {
    expect(skyAt(12).bands).toEqual(SLOT_LOOK.day.bands);
    expect(skyAt(6.75).bands).toEqual(SLOT_LOOK.dawn.bands);
    expect(skyAt(18.75).bands).toEqual(SLOT_LOOK.dusk.bands);
    expect(skyAt(1).bands).toEqual(SLOT_LOOK.night.bands);
    expect(skyAt(24).bands).toEqual(skyAt(0).bands);
  });

  it('never jumps: neighbouring minutes are neighbouring colours', () => {
    let previous = skyAt(0);
    for (let minute = 1; minute <= 24 * 60; minute += 1) {
      const now = skyAt(minute / 60);
      now.bands.forEach((band, index) => {
        const a = hexToRgb(band);
        const b = hexToRgb(previous.bands[index] as string);
        const step = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
        expect(step).toBeLessThan(0.09);
      });
      previous = now;
    }
  });

  it('keeps the page tint pale enough for ink text at every hour', () => {
    const ink = hexToRgb(INK);
    for (let hour = 0; hour < 24; hour += 0.1) {
      expect(contrastRatio(hexToRgb(skyAt(hour).page), ink)).toBeGreaterThanOrEqual(7);
    }
  });

  it('hangs the sun by day and the moon by night, inside the box', () => {
    expect(skyAt(12).moon).toBe(0);
    expect(skyAt(23).moon).toBe(1);
    for (let hour = 0; hour < 24; hour += 0.5) {
      const sky = skyAt(hour);
      expect(sky.orbX).toBeGreaterThan(0.1);
      expect(sky.orbX).toBeLessThan(0.9);
      expect(sky.orbY).toBeGreaterThan(0.1);
      expect(sky.orbY).toBeLessThan(0.65);
    }
    // Low on the left at dawn, high at noon, low on the right at dusk.
    expect(skyAt(6.5).orbX).toBeLessThan(0.25);
    expect(skyAt(12).orbY).toBeLessThan(skyAt(7).orbY);
    expect(skyAt(17.5).orbX).toBeGreaterThan(0.75);
  });
});

describe('slots', () => {
  it('follows the clock boundaries', () => {
    expect(slotAt(5.4)).toBe('night');
    expect(slotAt(5.6)).toBe('dawn');
    expect(slotAt(8)).toBe('day');
    expect(slotAt(17.6)).toBe('dusk');
    expect(slotAt(20)).toBe('night');
  });

  it('cross-fades only inside the window around a boundary', () => {
    expect(slotBlend(12, 0.5).mix).toBe(0);
    const before = slotBlend(7.8, 0.5);
    expect(before).toMatchObject({ from: 'dawn', to: 'day' });
    expect(before.mix).toBeGreaterThan(0);
    expect(before.mix).toBeLessThan(0.5);
    expect(slotBlend(8, 0.5).mix).toBeCloseTo(0.5, 6);
  });
});

describe('lightAt', () => {
  it('is a unit vector that always shines from the front and from above', () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const { direction } = lightAt(hour);
      expect(Math.hypot(...direction)).toBeCloseTo(1, 6);
      expect(direction[2]).toBeGreaterThan(0.3);
      expect(direction[1]).toBeGreaterThan(0);
    }
  });

  it('is low and warm at dusk, neutral at noon, cool at night', () => {
    expect(lightAt(12).gradeLit).toEqual([1, 1, 1]);
    expect(lightAt(18.75).direction[1]).toBeLessThan(lightAt(12).direction[1]);
    const dusk = lightAt(18.75).gradeLit;
    expect(dusk[0]).toBeGreaterThan(dusk[2]);
    const night = lightAt(1).gradeLit;
    expect(night[2]).toBeGreaterThan(night[0]);
    // Lifted ambient: at night the shade grade stays close to the lit grade.
    expect(night[0] - lightAt(1).gradeShade[0]).toBeLessThan(0.15);
  });

  it('takes the short way round the dial', () => {
    expect(hourDelta(23, 1)).toBe(2);
    expect(hourDelta(1, 23)).toBe(-2);
  });
});
