import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, parseDayKey } from '@/lib/dates';
import { DEMO_DAYS, buildDemoState } from './demoWorld';
import * as demoWorld from './demoWorld';
import { DEMO_CACHE_KEY, forgetDemoWorld, growDemoWorld } from './grow';

function at(day: string, hour: number): number {
  const date = parseDayKey(day);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

// Growing the world plays two hundred days through the engine: seconds, on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DAY = '2026-10-06';
const NOW = at(DAY, 15);

afterEach(() => {
  forgetDemoWorld();
  vi.restoreAllMocks();
});

describe('growing the demo world', () => {
  it('gives the browser a turn while it works and ends with the same world as one go', async () => {
    const seen: number[] = [];
    const state = await growDemoWorld(NOW, ({ day, days }) => {
      expect(days).toBe(DEMO_DAYS);
      seen.push(day);
    });
    expect(state).toEqual(buildDemoState(NOW));
    // One report per slice: many of them means the work really was cut up.
    expect(seen.length).toBeGreaterThan(3);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('grows once: a second call, and a call made meanwhile, get the very same state', async () => {
    const play = vi.spyOn(demoWorld, 'playDemoWorld');
    const first = growDemoWorld(NOW);
    const joined = growDemoWorld(NOW);
    const state = await first;
    expect(await joined).toBe(state);

    const progress = vi.fn();
    expect(await growDemoWorld(NOW + 60_000, progress)).toBe(state);
    expect(progress).toHaveBeenCalledWith({ day: DEMO_DAYS, days: DEMO_DAYS });
    expect(play.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('keeps the grown world for the tab, and only for the day it was grown on', async () => {
    const state = await growDemoWorld(NOW);
    const stored = JSON.parse(sessionStorage.getItem(DEMO_CACHE_KEY) ?? 'null') as {
      day: string;
    };
    expect(stored.day).toBe(DAY);
    expect(localStorage.length).toBe(0);

    // A reload: the module's memory is gone, the session copy is not.
    const text = sessionStorage.getItem(DEMO_CACHE_KEY) ?? '';
    forgetDemoWorld();
    sessionStorage.setItem(DEMO_CACHE_KEY, text);
    expect(await growDemoWorld(NOW + 1000)).toEqual(state);

    // Tomorrow the history has to end tomorrow: yesterday's world is not reused.
    forgetDemoWorld();
    sessionStorage.setItem(DEMO_CACHE_KEY, text);
    const tomorrow = await growDemoWorld(at(addDays(DAY, 1), 9));
    expect(tomorrow.clock.today).toBe(addDays(DAY, 1));
  });

  it('distrusts a session copy that is not a valid game', async () => {
    sessionStorage.setItem(
      DEMO_CACHE_KEY,
      JSON.stringify({ v: 1, seed: 200200, day: DAY, state: { xp: 'lots' } }),
    );
    const state = await growDemoWorld(NOW);
    expect(state.clock.today).toBe(DAY);
    expect(state.logs.length).toBeGreaterThan(400);
  });
});
