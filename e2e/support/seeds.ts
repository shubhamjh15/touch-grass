import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { GameState } from '../../src/game/types';

/**
 * Saved states for the suite. They come from `scripts/fixtures/*.json`, which the game engine
 * generates by playing the real rules; the specs never hand-write a save.
 */

export type FixtureName =
  'fresh' | 'day1' | 'day12' | 'day45' | 'day200' | 'thirsty' | 'dormant' | 'power-user';

export const ORIGIN = `http://localhost:${process.env.PW_PORT ?? 4173}`;
export const GAME_KEY = 'touchgrass:game';
export const COACH_KEY = 'touchgrass:coach';
export const UI_KEY = 'touchgrass:ui';

/** localStorage entries as Playwright's `storageState` wants them. */
export type StorageEntries = Record<string, string>;

export interface SavedGameFile {
  state: GameState;
  version: number;
}

function readFixture(name: FixtureName): Record<string, unknown> {
  const file = path.resolve(process.cwd(), 'scripts', 'fixtures', `${name}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** The raw localStorage entries of a fixture (`fresh` has none). */
export function fixtureEntries(name: FixtureName): StorageEntries {
  const entries: StorageEntries = {};
  for (const [key, value] of Object.entries(readFixture(name))) {
    entries[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return entries;
}

/**
 * A fixture whose game state is edited before it is stored, for a situation the fixtures do
 * not have (an XP total one log short of a level, a legacy key). The edit sees the plain
 * object and may change it in place.
 */
export function editedFixture(
  name: FixtureName,
  edit: (state: SavedGameFile['state']) => void,
): StorageEntries {
  const entries = fixtureEntries(name);
  const raw = entries[GAME_KEY];
  if (!raw) throw new Error(`fixture ${name} has no saved game`);
  const file = JSON.parse(raw) as SavedGameFile;
  edit(file.state);
  entries[GAME_KEY] = JSON.stringify(file);
  return entries;
}

/** A `storageState` for `test.use` that seeds localStorage before the first page loads. */
export function storageOf(entries: StorageEntries) {
  return {
    cookies: [],
    origins: [
      {
        origin: ORIGIN,
        localStorage: Object.entries(entries).map(([name, value]) => ({ name, value })),
      },
    ],
  };
}

export function seeded(name: FixtureName) {
  return storageOf(fixtureEntries(name));
}
