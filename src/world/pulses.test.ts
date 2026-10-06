import { describe, expect, it } from 'vitest';
import type { WorldPulse } from './contract';
import {
  CALM_MS,
  MAX_OVERLAP,
  MAX_QUEUE,
  PulseScheduler,
  SCRIPTS,
  bump,
  createChannels,
  ramp,
  thump,
  type BurstKind,
} from './pulses';

const KINDS: WorldPulse[] = [
  { kind: 'grow', strength: 1 },
  { kind: 'ring' },
  { kind: 'water' },
  { kind: 'level-up', level: 4 },
  { kind: 'badge' },
  { kind: 'streak', days: 30 },
  { kind: 'plant' },
  { kind: 'celebrate' },
];

/** Runs a scheduler at 60 fps for `seconds` and records every burst. */
function run(scheduler: PulseScheduler, from: number, seconds: number, reduced = false) {
  const bursts: Array<{ kind: BurstKind; count: number; at: number }> = [];
  let busy = false;
  for (let t = from; t <= from + seconds; t += 1 / 60) {
    busy = scheduler.update(t, reduced, (kind, count) => bursts.push({ kind, count, at: t }));
  }
  return { bursts, busy };
}

describe('pulse envelopes', () => {
  it('are zero outside their window and bounded inside', () => {
    expect(bump(-1, 0, 100)).toBe(0);
    expect(bump(100, 0, 100)).toBe(0);
    expect(bump(50, 0, 100)).toBeCloseTo(1);
    expect(ramp(-5, 0, 100)).toBe(0);
    expect(ramp(500, 0, 100)).toBe(1);
    expect(thump(0, 120)).toBe(0);
    expect(thump(120, 120)).toBeCloseTo(1);
    // It rings out: well under a percent of the squash is left after 700 ms.
    expect(Math.abs(thump(820, 120))).toBeLessThan(0.01);
  });
});

describe('PulseScheduler', () => {
  it('plays every kind in the contract and returns to rest afterwards', () => {
    for (const pulse of KINDS) {
      const scheduler = new PulseScheduler();
      scheduler.push(pulse, 0);
      const length = SCRIPTS[pulse.kind].length / 1000;
      const during = run(scheduler, 0, length * 0.5);
      expect(during.busy, pulse.kind).toBe(true);
      const after = run(scheduler, length * 0.5 + 1 / 60, length);
      expect(after.busy, pulse.kind).toBe(false);
      expect(scheduler.channels, pulse.kind).toEqual(createChannels());
    }
  });

  it('emits each beat exactly once, even when frames are late', () => {
    for (const pulse of KINDS) {
      const expected = SCRIPTS[pulse.kind].beats.length;
      const smooth = new PulseScheduler();
      smooth.push(pulse, 0);
      expect(run(smooth, 0, 4).bursts, pulse.kind).toHaveLength(expected);

      // One frame, then nothing for five seconds (a hidden tab), then one more.
      const late = new PulseScheduler();
      late.push(pulse, 0);
      let count = 0;
      late.update(0.016, false, () => (count += 1));
      late.update(5, false, () => (count += 1));
      late.update(5.016, false, () => (count += 1));
      expect(count, pulse.kind).toBe(expected);
    }
  });

  it('scales the grow burst with strength, as the bible specifies', () => {
    const counts = (strength: number) => {
      const scheduler = new PulseScheduler();
      scheduler.push({ kind: 'grow', strength }, 0);
      return Object.fromEntries(run(scheduler, 0, 1.2).bursts.map((b) => [b.kind, b.count]));
    };
    expect(counts(0)).toEqual({ pops: 3, leaves: 8 });
    expect(counts(1)).toEqual({ pops: 8, leaves: 24 });
  });

  it('merges rapid grow pulses into one and caps the strength', () => {
    const scheduler = new PulseScheduler();
    scheduler.push({ kind: 'grow', strength: 0.5 }, 0);
    scheduler.push({ kind: 'grow', strength: 0.4 }, 0.1);
    scheduler.push({ kind: 'grow', strength: 0.9 }, 0.2);
    expect(scheduler.playing).toBe(1);
    const { bursts } = run(scheduler, 0.2, 2);
    expect(bursts.filter((b) => b.kind === 'pops')).toEqual([
      expect.objectContaining({ count: 8 }),
    ]);
  });

  it('lets at most two pulses overlap and queues the rest in order', () => {
    const scheduler = new PulseScheduler();
    scheduler.push({ kind: 'celebrate' }, 0);
    scheduler.push({ kind: 'badge' }, 0);
    scheduler.push({ kind: 'level-up', level: 2 }, 0);
    scheduler.push({ kind: 'ring' }, 0);
    expect(scheduler.playing).toBe(MAX_OVERLAP);
    expect(scheduler.waiting).toBe(2);
    let peak = 0;
    const kinds: BurstKind[] = [];
    for (let t = 0; t < 6; t += 1 / 60) {
      scheduler.update(t, false, (kind) => kinds.push(kind));
      peak = Math.max(peak, scheduler.playing);
    }
    expect(peak).toBe(MAX_OVERLAP);
    expect(scheduler.playing).toBe(0);
    expect(scheduler.waiting).toBe(0);
    // celebrate (confetti) and badge (dust) first, then the queued level-up (confetti).
    expect(kinds).toEqual(['confetti', 'dust', 'confetti']);
  });

  it('never holds more than its queue and keeps the newest pulse', () => {
    const scheduler = new PulseScheduler();
    for (let i = 0; i < MAX_OVERLAP + MAX_QUEUE + 5; i += 1) scheduler.push({ kind: 'badge' }, 0);
    scheduler.push({ kind: 'plant' }, 0);
    expect(scheduler.waiting).toBe(MAX_QUEUE);
    const { bursts } = run(scheduler, 0, 12);
    expect(bursts.at(-1)?.kind).toBe('soil');
    expect(scheduler.playing + scheduler.waiting).toBe(0);
  });

  it('holds growth at zero for the first second of the planting ceremony only', () => {
    const scheduler = new PulseScheduler();
    scheduler.push({ kind: 'plant' }, 0);
    scheduler.update(0.5, false, () => {});
    expect(scheduler.channels.gate).toBe(1);
    expect(scheduler.channels.seed).toBeCloseTo(1);
    scheduler.update(1.2, false, () => {});
    expect(scheduler.channels.gate).toBe(0);
  });

  it('becomes one calm highlight under reduced motion: no bursts, no movement', () => {
    for (const pulse of KINDS) {
      const scheduler = new PulseScheduler();
      scheduler.push(pulse, 0);
      let bursts = 0;
      let peak = 0;
      for (let t = 0; t < CALM_MS / 1000; t += 1 / 60) {
        scheduler.update(t, true, () => (bursts += 1));
        const { flash, ...rest } = scheduler.channels;
        peak = Math.max(peak, flash);
        expect(rest, pulse.kind).toEqual({ ...createChannels(), flash: undefined });
      }
      expect(bursts, pulse.kind).toBe(0);
      expect(peak, pulse.kind).toBeGreaterThan(0.2);
      expect(run(scheduler, CALM_MS / 1000, 0.1, true).busy).toBe(false);
    }
  });
});
