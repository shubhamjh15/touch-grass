/**
 * Helpers for driving the pure engine from tests, the simulation suite and the fixture
 * generator. Nothing here touches the store, storage or the real clock.
 */
import { parseDayKey, type DayKey } from '@/lib/dates';
import type { Ctx, EngineOptions } from './ctx';
import { plantTree, transact, type OnboardInput } from './engine';
import type { GameEvent, GameEventOf, GameEventType } from './events';
import { createInitialState } from './state';
import type { GameState } from './types';

/** Epoch milliseconds of a local wall-clock time on a day. */
export function localTime(day: DayKey, hour = 12, minute = 0, second = 0): number {
  const date = parseDayKey(day);
  date.setHours(hour, minute, second, 0);
  return date.getTime();
}

export const TEST_SEED = 20261006;

/** A session against the pure engine: holds the state and remembers every event. */
export class GameSession {
  state: GameState;
  /** Events of the most recent operation. */
  last: GameEvent[] = [];
  /** Every event since the session began. */
  all: GameEvent[] = [];
  private readonly options: EngineOptions;

  constructor(state: GameState, options: EngineOptions = {}) {
    this.state = state;
    this.options = options;
  }

  /** Runs one operation at `now` and returns what it returned. */
  at<T>(now: number, run: (ctx: Ctx) => T): T {
    const outcome = transact(this.state, now, run, this.options);
    this.state = outcome.state;
    this.last = outcome.events;
    this.all.push(...outcome.events);
    return outcome.result;
  }

  /** What the app does on open, on resume and at midnight: a passive tick at `now`. */
  tick(now: number): void {
    const outcome = transact(this.state, now, () => undefined, { ...this.options, passive: true });
    this.state = outcome.state;
    this.last = outcome.events;
    this.all.push(...outcome.events);
  }

  /** Settles the calendar at `now` as an action would, however far the clock moved. */
  settle(now: number): void {
    this.at(now, () => undefined);
  }

  eventsOf<T extends GameEventType>(
    type: T,
    from: readonly GameEvent[] = this.last,
  ): GameEventOf<T>[] {
    return from.filter((event): event is GameEventOf<T> => event.type === type);
  }

  has(type: GameEventType): boolean {
    return this.last.some((event) => event.type === type);
  }
}

/** A session with a tree planted at `now` (the ceremony has run: ring 1, 35 XP, 8 GP). */
export function plantedSession(
  now: number,
  input: Partial<OnboardInput> = {},
  options: EngineOptions = {},
): GameSession {
  const session = new GameSession(createInitialState(now), options);
  const result = session.at(now, (ctx) =>
    plantTree(ctx, {
      name: 'Maya',
      treeName: 'Fern',
      species: 'oak',
      userSeed: TEST_SEED,
      ...input,
    }),
  );
  if (!result.ok) throw new Error(`could not plant: ${result.reason}`);
  return session;
}
