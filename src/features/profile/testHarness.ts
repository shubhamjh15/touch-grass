import { readFileSync } from 'node:fs';
import path from 'node:path';
import { STORAGE_KEYS, game, gameActions, type GameState } from '@/game';

type Fixture = Record<string, { state: GameState; version: number } | undefined>;

/** A time on the fixtures' day, 6 October 2026. */
export const at = (hour: number, minute = 0): number =>
  new Date(2026, 9, 6, hour, minute).getTime();

/** Puts a saved game on the device exactly as the screenshot fixtures do, and loads it. */
export function seed(name: string): void {
  const file = path.resolve('scripts/fixtures', `${name}.json`);
  const saved = (JSON.parse(readFileSync(file, 'utf8')) as Fixture)[STORAGE_KEYS.game];
  if (saved) localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
  game.rehydrate();
  gameActions.tick();
}
