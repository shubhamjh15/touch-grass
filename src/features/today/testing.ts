/**
 * Test support for the Today page: the real game store, seeded from the saved states in
 * `scripts/fixtures` and run on a clock the test controls. Only imported by tests.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { STORAGE_KEYS, game, gameActions } from '@/game';

export type FixtureName =
  'day1' | 'day12' | 'day45' | 'day200' | 'thirsty' | 'dormant' | 'power-user';

/** The day every fixture is anchored to: a Tuesday. */
export const FIXTURE_DAY = { year: 2026, month: 10, day: 6 } as const;

/** A local time on (or `dayOffset` days after) the fixtures' day, as epoch milliseconds. */
export function at(hour: number, minute = 0, dayOffset = 0): number {
  return new Date(
    FIXTURE_DAY.year,
    FIXTURE_DAY.month - 1,
    FIXTURE_DAY.day + dayOffset,
    hour,
    minute,
  ).getTime();
}

export interface TestClock {
  now: number;
  /** Moves the clock and lets the game settle, as the shell's clock would. */
  set: (now: number) => void;
  advanceMinutes: (minutes: number) => void;
}

/** Loads a fixture into the app's own store and puts the game on a controllable clock. */
export function seedFixture(name: FixtureName, start = at(14, 32)): TestClock {
  const file = path.resolve(process.cwd(), 'scripts', 'fixtures', `${name}.json`);
  const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const clock: TestClock = {
    now: start,
    set(now) {
      clock.now = now;
      gameActions.tick();
    },
    advanceMinutes(minutes) {
      clock.set(clock.now + minutes * 60_000);
    },
  };
  game.setClock(() => clock.now);
  game.storage.setItem(STORAGE_KEYS.game, JSON.stringify(saved[STORAGE_KEYS.game]));
  game.rehydrate();
  gameActions.tick();
  return clock;
}

/** Puts the store back on the real clock with nothing planted. */
export function resetGame(): void {
  gameActions.resetAll();
  game.setClock(() => Date.now());
}
