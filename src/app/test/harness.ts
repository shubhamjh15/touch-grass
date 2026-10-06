/**
 * Test harness for the shell: the real game store seeded from a screenshot fixture, and a
 * viewport that answers media queries like a desk or like a phone.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { STORAGE_KEYS, game, gameActions, getGameState } from '@/game';
import { useShellStore } from '../shellStore';

export type FixtureName = 'day1' | 'day12' | 'day45' | 'power-user';

/** Loads `scripts/fixtures/<name>.json` into the real store and pins the clock to its last event. */
export function seedGame(name: FixtureName): number {
  const file = path.resolve(process.cwd(), 'scripts', 'fixtures', `${name}.json`);
  const saved = (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>)[
    STORAGE_KEYS.game
  ];
  localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
  const { lastEventTs } = (saved as { state: { clock: { lastEventTs: number } } }).state.clock;
  const now = lastEventTs + 60_000;
  game.setClock(() => now);
  game.rehydrate();
  gameActions.tick(now);
  if (getGameState().profile.treeName === '') throw new Error(`fixture ${name} did not load`);
  return now;
}

export function restoreClock(): void {
  game.setClock(() => Date.now());
}

/** Makes `min-width` media queries match (a desk, 1440 px) or not (a phone, 390 px). */
export function setViewport(kind: 'desktop' | 'phone'): void {
  const width = kind === 'desktop' ? 1440 : 390;
  window.matchMedia = (query: string): MediaQueryList => {
    const min = /min-width:\s*([\d.]+)rem/.exec(query);
    return {
      matches: min ? width >= Number(min[1]) * 16 : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    };
  };
}

/** Closes every overlay and shows the chrome again. */
export function resetShell(): void {
  useShellStore.setState({
    paletteOpen: false,
    paletteQuery: '',
    coachOpen: false,
    coachAsk: null,
    chromeHidden: 0,
    levelUp: null,
  });
}
