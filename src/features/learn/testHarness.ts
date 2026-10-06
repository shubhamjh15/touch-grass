import { readFileSync } from 'node:fs';
import path from 'node:path';
import { STORAGE_KEYS, game, gameActions, getGameState, type GameState } from '@/game';

/**
 * What the Learn component tests share: the saved-state fixtures the screenshots use, loaded
 * into the real store, and a clock pinned to the morning those fixtures are anchored to.
 */

type Fixture = Record<string, { state: GameState; version: number } | undefined>;

/** A time on the fixtures' day, 6 October 2026. */
export const at = (hour: number, minute = 0): number =>
  new Date(2026, 9, 6, hour, minute).getTime();

/** Puts a saved game on the device exactly as the screenshot fixtures do, and loads it. */
export function seed(name: string, patch?: (state: GameState) => void): void {
  const file = path.resolve('scripts/fixtures', `${name}.json`);
  const saved = (JSON.parse(readFileSync(file, 'utf8')) as Fixture)[STORAGE_KEYS.game];
  if (saved) {
    patch?.(saved.state);
    localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
  }
  game.rehydrate();
  gameActions.tick();
}

export const xp = (): number => getGameState().xp;

export const lessonProgressOf = (slug: string) => getGameState().learn.lessons[slug];
