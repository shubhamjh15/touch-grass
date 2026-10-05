import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { unlockedProps } from './badges';
import { growthInfo } from './growth';
import { STORAGE_KEYS } from './keys';
import { levelOf } from './levels';
import { parseStoredGame } from './persist';
import { checkInvariants } from './state';
import { createMemoryStorage } from './storage';
import { createGame } from './store';
import type { GameState } from './types';

/**
 * The committed fixtures are generated from the engine (`node scripts/build-fixtures.mjs`).
 * This suite fails when the schema or the rules move and the fixtures were not rebuilt.
 */
const dir = path.resolve(process.cwd(), 'scripts', 'fixtures');
const NAMES = ['fresh', 'day1', 'day12', 'day45', 'day200', 'thirsty', 'dormant', 'power-user'];

function read(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
}

function stateOf(name: string): GameState {
  const loaded = parseStoredGame(JSON.stringify(read(name)[STORAGE_KEYS.game]));
  if (!loaded.ok) throw new Error(`${name}: ${loaded.reason} — ${loaded.detail}`);
  return loaded.state;
}

const kgOf = (state: GameState) =>
  state.logs.reduce((sum, log) => sum + (log.estimate === 'factor' ? (log.co2eKg ?? 0) : 0), 0);

describe('screenshot fixtures', () => {
  it('ships exactly the eight named states', () => {
    const files = readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''))
      .sort();
    expect(files).toEqual([...NAMES].sort());
  });

  it('maps storage keys to values, and only the game key', () => {
    expect(read('fresh')).toEqual({});
    for (const name of NAMES.filter((item) => item !== 'fresh')) {
      const entries = read(name);
      expect(Object.keys(entries)).toEqual([STORAGE_KEYS.game]);
      expect(entries[STORAGE_KEYS.game]).toMatchObject({ version: 1 });
    }
  });

  it.each(NAMES.filter((name) => name !== 'fresh'))(
    '%s loads through the app’s own validation',
    (name) => {
      const state = stateOf(name);
      expect(checkInvariants(state)).toEqual([]);
      expect(state.onboarding.completedAt).not.toBeNull();
      expect(state.profile.treeName).toBe('Fern');
      expect(state.notices.length).toBeLessThanOrEqual(2);
      const game = createGame({
        storage: createMemoryStorage({
          [STORAGE_KEYS.game]: JSON.stringify(read(name)[STORAGE_KEYS.game]),
        }),
        now: () => state.clock.lastEventTs,
      });
      expect(game.store.getState().runtime.recovery).toBeNull();
      expect(game.store.getState().game).toEqual(state);
    },
  );

  it('day1 is the moment after the ceremony', () => {
    const state = stateOf('day1');
    expect(state).toMatchObject({
      xp: 35,
      logs: [],
      tree: { gp: 8, rings: 1 },
      streak: { current: 1 },
    });
    expect(state.onboarding.coachMarksSeen).toBe(false);
    expect(state.quests.daily?.slots).toHaveLength(3);
  });

  it('day12 matches the mock-ups: an oak named Fern, level 5, a 12-day streak, about 48 kg', () => {
    const state = stateOf('day12');
    expect(state.profile).toMatchObject({ treeName: 'Fern', species: 'oak' });
    expect(levelOf(state.xp)).toBe(5);
    expect(state.streak.current).toBe(12);
    expect(state.tree.rings).toBe(12);
    expect(Math.abs(kgOf(state) - 48)).toBeLessThan(1.5);
    expect(growthInfo(state.tree.gp).stage).toBe('Sapling');
    expect(state.days[state.clock.today]?.ringClosed).toBe(false);
    expect(state.notices).toEqual([]);
  });

  it('day45 and day200 show a growing tree and a filling island', () => {
    const mid = stateOf('day45');
    const late = stateOf('day200');
    expect(growthInfo(mid.tree.gp).stage).toBe('Young tree');
    expect(mid.challenge.active?.templateId).toBe('rings_5');
    expect(Object.values(mid.marks)).toContain('missed');
    expect(growthInfo(late.tree.gp).stage).toBe('Mature tree');
    expect(unlockedProps(late.badges).length).toBeGreaterThan(unlockedProps(mid.badges).length);
    expect(
      Object.values(late.learn.lessons).filter((lesson) => lesson.passedTs !== null),
    ).toHaveLength(10);
  });

  it('thirsty and dormant are waiting, with everything they earned intact', () => {
    const thirsty = stateOf('thirsty');
    const dormant = stateOf('dormant');
    expect(thirsty.tree).toMatchObject({ vitality: 'thirsty', missed: 3, rings: 18 });
    expect(thirsty.days[thirsty.clock.today]).toBeUndefined();
    expect(dormant.tree.vitality).toBe('dormant');
    expect(dormant.tree.missed).toBeGreaterThanOrEqual(7);
    expect(dormant.tree.rings).toBe(30);
    expect(dormant.profile.species).toBe('cherry');
    expect(dormant.notices.map((notice) => notice.kind)).toContain('streak-rested');
  });

  it('power-user is an elder pine with the whole island', () => {
    const state = stateOf('power-user');
    expect(state.profile.species).toBe('pine');
    expect(growthInfo(state.tree.gp).stage).toBe('Elder');
    expect(unlockedProps(state.badges)).toHaveLength(16);
    expect(levelOf(state.xp)).toBeGreaterThanOrEqual(30);
    expect(state.logs.length).toBeGreaterThan(1000);
  });
});
