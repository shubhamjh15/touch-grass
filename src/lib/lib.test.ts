import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayKey,
  dayRange,
  diffDays,
  hourOfDay,
  msUntilTomorrow,
  startOfWeek,
  weekKey,
} from './dates';
import {
  formatCo2,
  formatCo2Parts,
  formatCompact,
  formatDay,
  formatDuration,
  lastDays,
  pluralize,
} from './format';
import { clamp, damp, inverseLerp, lerp, mapRange, roundTo, smoothstep } from './math';
import { createRng, hashString, mulberry32, pick, randomInt, sample, shuffle } from './rng';

describe('dates', () => {
  it('formats a local day key', () => {
    expect(dayKey(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06');
    expect(dayKey(new Date(2026, 0, 3, 0, 0))).toBe('2026-01-03');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('counts whole days between keys, including across DST changes', () => {
    expect(diffDays('2026-10-06', '2026-10-06')).toBe(0);
    expect(diffDays('2026-10-06', '2026-10-13')).toBe(7);
    expect(diffDays('2026-10-13', '2026-10-06')).toBe(-7);
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
    expect(diffDays('2026-10-24', '2026-11-02')).toBe(9);
  });

  it('lists an inclusive range', () => {
    expect(dayRange('2026-10-30', '2026-11-01')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(dayRange('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-10-06')).toBe('2026-10-05'); // Tuesday
    expect(startOfWeek('2026-10-05')).toBe('2026-10-05'); // Monday
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05'); // Sunday
    expect(weekKey('2026-10-11')).toBe('W2026-10-05');
  });

  it('reads the local hour and the time left today', () => {
    expect(hourOfDay(new Date(2026, 9, 6, 18, 30))).toBeCloseTo(18.5);
    const lateEvening = new Date(2026, 9, 6, 23, 0, 0).getTime();
    expect(msUntilTomorrow(lateEvening)).toBe(3_600_000);
  });
});

describe('format', () => {
  it('picks a CO2e unit that fits the size', () => {
    expect(formatCo2(0)).toBe('0 kg');
    expect(formatCo2(0.08)).toBe('80 g');
    expect(formatCo2(0.85)).toBe('850 g');
    expect(formatCo2(0.819)).toBe('820 g');
    expect(formatCo2(0.0864)).toBe('86 g');
    expect(formatCo2(0.0046)).toBe('5 g');
    expect(formatCo2(0.9949)).toBe('990 g');
    expect(formatCo2(1.26)).toBe('1.3 kg');
    expect(formatCo2(42.4)).toBe('42 kg');
    expect(formatCo2(1250)).toBe('1.25 t');
  });

  it('never shows 1,000 g', () => {
    expect(formatCo2(0.9996)).toBe('1 kg');
  });

  it('splits value and unit', () => {
    expect(formatCo2Parts(1.26)).toEqual({ value: '1.3', unit: 'kg' });
  });

  it('formats counts, days and durations', () => {
    expect(formatCompact(1234)).toBe('1.2K');
    expect(pluralize(1, 'day')).toBe('1 day');
    expect(pluralize(3, 'day')).toBe('3 days');
    expect(pluralize(2, 'leaf', 'leaves')).toBe('2 leaves');
    expect(formatDay('2026-10-06', '2026-10-06')).toBe('Today');
    expect(formatDay('2026-10-05', '2026-10-06')).toBe('Yesterday');
    expect(formatDay('2026-10-01', '2026-10-06')).toBe('Thu, Oct 1');
    expect(formatDuration(45)).toBe('45 sec');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatDuration(5400)).toBe('1 h 30 min');
  });

  it('lists the last N days oldest first', () => {
    expect(lastDays('2026-10-02', 3)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });
});

describe('math', () => {
  it('clamps, lerps and remaps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(inverseLerp(10, 20, 15)).toBe(0.5);
    expect(inverseLerp(3, 3, 9)).toBe(0);
    expect(mapRange(15, 10, 20, 0, 100)).toBe(50);
    expect(mapRange(99, 10, 20, 0, 100)).toBe(100);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(roundTo(1.2345, 2)).toBe(1.23);
  });

  it('damps towards a target without overshooting', () => {
    const next = damp(0, 10, 8, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(10);
    expect(damp(0, 10, 8, 100)).toBeCloseTo(10);
  });
});

describe('rng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });

  it('stays inside [0, 1) and looks uniform', () => {
    const rng = createRng('uniformity');
    let sum = 0;
    for (let i = 0; i < 10_000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      sum += value;
    }
    expect(sum / 10_000).toBeGreaterThan(0.47);
    expect(sum / 10_000).toBeLessThan(0.53);
  });

  it('hashes strings stably', () => {
    expect(hashString('touchgrass')).toBe(hashString('touchgrass'));
    expect(hashString('touchgrass')).not.toBe(hashString('touchgrasS'));
  });

  it('shuffles without losing items and leaves the input alone', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const shuffled = shuffle(createRng(7), items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...shuffled].sort()).toEqual(items);
    expect(shuffle(createRng(7), items)).toEqual(shuffled);
  });

  it('samples distinct items and picks within bounds', () => {
    const rng = createRng(9, '2026-10-06');
    const chosen = sample(rng, ['a', 'b', 'c', 'd'], 3);
    expect(new Set(chosen).size).toBe(3);
    expect(['a', 'b', 'c', 'd']).toContain(pick(rng, ['a', 'b', 'c', 'd']));
    for (let i = 0; i < 200; i += 1) {
      const value = randomInt(rng, 1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });
});
