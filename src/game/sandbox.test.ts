import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays } from '@/lib/dates';
import { createEventBus, type GameEvent } from './events';
import { SANDBOX_MARK_KEY, SANDBOX_PREFIX, STORAGE_KEYS } from './keys';
import { createMemoryStorage, type KeyValueStorage } from './storage';
import { createGame, startGameClock, type Game } from './store';
import { localTime } from './testkit';
import type { GameState } from './types';

const MON = '2026-10-05';
const noon = (offset = 0) => localTime(addDays(MON, offset), 12);

interface Tab {
  game: Game;
  events: GameEvent[];
}

interface World {
  /** The device's storage: shared by every tab. */
  real: KeyValueStorage;
  clock: { now: number };
  /** Opens a tab. Each tab has its own session storage unless one is handed over (a reload). */
  tab: (session?: KeyValueStorage) => Tab & { session: KeyValueStorage };
}

function world(initial: Record<string, string> = {}): World {
  const real = createMemoryStorage(initial);
  const clock = { now: noon() };
  let seed = 500;
  return {
    real,
    clock,
    tab(session = createMemoryStorage()) {
      const bus = createEventBus();
      const events: GameEvent[] = [];
      bus.onAny((event) => events.push(event));
      const game = createGame({
        storage: real,
        sandboxStorage: session,
        now: () => clock.now,
        events: bus,
        seed: () => (seed += 1),
      });
      return { game, events, session };
    },
  };
}

/** A stand-in world: somebody else's tree, a few days old, built by the real rules. */
function standIn(): GameState {
  const clock = { now: noon(-3) };
  const sim = createGame({
    persist: false,
    now: () => clock.now,
    seed: () => 77,
    events: createEventBus(),
  });
  sim.actions.onboard({ name: 'Guest', treeName: 'Juniper', species: 'pine' });
  for (let day = -3; day < 0; day += 1) {
    clock.now = noon(day);
    sim.actions.checkIn();
    sim.actions.logAction({ actionId: 'plant-based-meal', qty: 1 });
  }
  return sim.store.getState().game;
}

const stateOf = (game: Game) => game.store.getState().game;
const contents = (storage: KeyValueStorage): Record<string, string | null> =>
  Object.fromEntries(
    storage
      .keys()
      .sort()
      .map((key) => [key, storage.getItem(key)]),
  );

/** Fails the test the moment anything touches the storage. */
function seal(storage: KeyValueStorage) {
  return {
    getItem: vi.spyOn(storage, 'getItem'),
    setItem: vi.spyOn(storage, 'setItem'),
    removeItem: vi.spyOn(storage, 'removeItem'),
    keys: vi.spyOn(storage, 'keys'),
  };
}

function expectUntouched(spies: ReturnType<typeof seal>): void {
  expect(spies.getItem).not.toHaveBeenCalled();
  expect(spies.setItem).not.toHaveBeenCalled();
  expect(spies.removeItem).not.toHaveBeenCalled();
  expect(spies.keys).not.toHaveBeenCalled();
}

function plantedWorld(): World & { mine: Tab & { session: KeyValueStorage } } {
  const w = world();
  const mine = w.tab();
  mine.game.actions.onboard({ name: 'Maya', treeName: 'Fern', species: 'oak' });
  mine.game.actions.logAction({ actionId: 'plant-based-meal', qty: 2 });
  return { ...w, mine };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('a sandbox', () => {
  it('shows the stand-in world and says so', () => {
    const { mine } = plantedWorld();
    expect(mine.game.store.getState().runtime.sandbox).toBe(false);
    mine.game.enterSandbox(standIn());
    expect(mine.game.store.getState().runtime.sandbox).toBe(true);
    expect(stateOf(mine.game).profile.treeName).toBe('Juniper');
    expect(stateOf(mine.game).clock.today).toBe(MON);
  });

  it('never reads, writes or lists the real storage while it is on', () => {
    const { mine, real, clock } = plantedWorld();
    const before = contents(real);
    const spies = seal(real);

    mine.game.enterSandbox(standIn());
    clock.now += 60_000;
    expect(mine.game.actions.checkIn()).toBe(true);
    expect(mine.game.actions.logAction({ actionId: 'bus-instead-of-car', qty: 5 }).ok).toBe(true);
    mine.game.actions.updateProfile({ treeName: 'Changed' });
    mine.game.actions.updateSettings({ sound: false });
    mine.game.actions.scanLegacy();
    mine.game.actions.exportState({ includeCoach: true });
    mine.game.actions.storageUsedBytes();
    mine.game.actions.recoveryEntries();
    mine.game.actions.legacyBackup();
    mine.game.actions.deleteLegacyBackup();
    mine.game.actions.tick(clock.now + 86_400_000);
    mine.game.rehydrate();

    expectUntouched(spies);
    expect(contents(real)).toEqual(before);
  });

  it('keeps its own save in the session storage, behind its prefix', () => {
    const { mine } = plantedWorld();
    mine.game.enterSandbox(standIn());
    mine.game.actions.updateProfile({ treeName: 'Changed' });

    expect(mine.session.getItem(SANDBOX_MARK_KEY)).toBe('1');
    const saved = JSON.parse(
      mine.session.getItem(`${SANDBOX_PREFIX}${STORAGE_KEYS.game}`) ?? 'null',
    ) as { state: GameState };
    expect(saved.state.profile.treeName).toBe('Changed');
    expect(mine.game.storage.keys()).toEqual([STORAGE_KEYS.game]);
    for (const key of mine.session.keys()) {
      expect(key === SANDBOX_MARK_KEY || key.startsWith(SANDBOX_PREFIX)).toBe(true);
    }
  });

  it('survives a reload of the tab without looking at the real save', () => {
    const { mine, real, tab } = plantedWorld();
    mine.game.enterSandbox(standIn());
    mine.game.actions.updateProfile({ treeName: 'Changed' });

    const spies = seal(real);
    const reloaded = tab(mine.session);
    expect(reloaded.game.store.getState().runtime).toMatchObject({ sandbox: true, hydrated: true });
    expect(stateOf(reloaded.game).profile.treeName).toBe('Changed');
    expectUntouched(spies);
  });

  it('is not seen by another tab, which still has the real save', () => {
    const { mine, tab } = plantedWorld();
    mine.game.enterSandbox(standIn());
    const other = tab();
    expect(other.game.store.getState().runtime.sandbox).toBe(false);
    expect(stateOf(other.game).profile.treeName).toBe('Fern');
  });

  it('does not follow what other tabs save', () => {
    const { mine, tab, clock } = plantedWorld();
    const other = tab();
    mine.game.enterSandbox(standIn());
    const handle = startGameClock(mine.game);

    clock.now += 1000;
    other.game.actions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.game }));
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(stateOf(mine.game).profile.treeName).toBe('Juniper');
    handle.stop();
  });

  it('ends with exactly what was there: the same state and an untouched save', () => {
    const { mine, real, clock } = plantedWorld();
    const stateBefore = stateOf(mine.game);
    const savedBefore = contents(real);

    mine.game.enterSandbox(standIn());
    clock.now += 60_000;
    mine.game.actions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
    const setItem = vi.spyOn(real, 'setItem');
    const removeItem = vi.spyOn(real, 'removeItem');
    mine.game.leaveSandbox();

    expect(mine.game.store.getState().runtime.sandbox).toBe(false);
    expect(stateOf(mine.game)).toEqual(stateBefore);
    expect(contents(real)).toEqual(savedBefore);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(mine.session.keys()).toEqual([]);
  });

  it('ends with "nothing planted yet" for a visitor who had no tree, and writes no blank save', () => {
    const w = world();
    const visitor = w.tab();
    expect(w.real.keys()).toEqual([]);

    visitor.game.enterSandbox(standIn());
    expect(stateOf(visitor.game).onboarding.completedAt).not.toBeNull();
    visitor.game.leaveSandbox();

    expect(stateOf(visitor.game).onboarding.completedAt).toBeNull();
    expect(stateOf(visitor.game).xp).toBe(0);
    expect(w.real.keys()).toEqual([]);
    // The blank state is still not a save: the minute tick must not write one either.
    visitor.game.actions.tick(w.clock.now + 60_000);
    expect(w.real.keys()).toEqual([]);
  });

  it('saves to the real storage again once it has ended', () => {
    const { mine, real, clock } = plantedWorld();
    mine.game.enterSandbox(standIn());
    mine.game.leaveSandbox();
    clock.now += 60_000;
    expect(mine.game.actions.logAction({ actionId: 'bus-instead-of-car', qty: 5 }).ok).toBe(true);
    const saved = JSON.parse(real.getItem(STORAGE_KEYS.game) ?? 'null') as { state: GameState };
    expect(saved.state.profile.treeName).toBe('Fern');
    expect(saved.state.logs).toHaveLength(2);
  });

  it('brings back what another tab saved in the meantime', () => {
    const { mine, tab, clock } = plantedWorld();
    const other = tab();
    mine.game.enterSandbox(standIn());
    clock.now += 1000;
    other.game.actions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
    mine.game.leaveSandbox();
    expect(stateOf(mine.game)).toEqual(stateOf(other.game));
  });

  it('ends after a reload too, when nothing of the real game is in memory', () => {
    const { mine, real, tab } = plantedWorld();
    const stateBefore = stateOf(mine.game);
    const savedBefore = contents(real);
    mine.game.enterSandbox(standIn());

    const reloaded = tab(mine.session);
    reloaded.game.leaveSandbox();
    expect(stateOf(reloaded.game)).toEqual(stateBefore);
    expect(contents(real)).toEqual(savedBefore);
    expect(mine.session.keys()).toEqual([]);
  });

  it('keeps a real game that had outgrown its storage', () => {
    const { mine, real, clock } = plantedWorld();
    const quota = vi.spyOn(real, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    clock.now += 60_000;
    mine.game.actions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
    const unsaved = stateOf(mine.game);
    expect(unsaved.logs).toHaveLength(2);

    mine.game.enterSandbox(standIn());
    mine.game.leaveSandbox();
    expect(stateOf(mine.game)).toEqual(unsaved);
    quota.mockRestore();
  });

  it('is what "reset" erases: the real save stays', () => {
    const { mine, real } = plantedWorld();
    const savedBefore = contents(real);
    mine.game.enterSandbox(standIn());
    mine.events.length = 0;
    mine.game.actions.resetAll();

    expect(mine.game.store.getState().runtime.sandbox).toBe(false);
    expect(stateOf(mine.game).profile.treeName).toBe('Fern');
    expect(contents(real)).toEqual(savedBefore);
    expect(mine.events.map((event) => event.type)).toContain('state-reset');
  });

  it('replaces an earlier sandbox instead of stacking on it', () => {
    const { mine, real } = plantedWorld();
    const stateBefore = stateOf(mine.game);
    mine.game.enterSandbox(standIn());
    mine.game.actions.updateProfile({ treeName: 'Changed' });
    mine.game.enterSandbox(standIn());
    expect(stateOf(mine.game).profile.treeName).toBe('Juniper');
    mine.game.leaveSandbox();
    expect(stateOf(mine.game)).toEqual(stateBefore);
    expect(real.getItem(STORAGE_KEYS.game)).not.toBeNull();
  });

  it('forgets a flag that has no world behind it', () => {
    const { mine, tab } = plantedWorld();
    const session = createMemoryStorage({ [SANDBOX_MARK_KEY]: '1' });
    const opened = tab(session);
    expect(opened.game.store.getState().runtime.sandbox).toBe(false);
    expect(stateOf(opened.game)).toEqual(stateOf(mine.game));
    expect(session.keys()).toEqual([]);
  });

  it('leaving when none is on changes nothing', () => {
    const { mine, real } = plantedWorld();
    const spies = seal(real);
    const before = stateOf(mine.game);
    mine.game.leaveSandbox();
    expect(stateOf(mine.game)).toBe(before);
    expectUntouched(spies);
  });
});

describe('a game in memory only', () => {
  it('plays the rules without reading or saving anything', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const sim = createGame({ persist: false, now: () => noon(), events: createEventBus() });
    expect(sim.store.getState().runtime).toMatchObject({ hydrated: true, storage: 'memory' });
    expect(sim.actions.onboard({ treeName: 'Fern', species: 'oak' }).ok).toBe(true);
    expect(sim.actions.logAction({ actionId: 'plant-based-meal', qty: 1 }).ok).toBe(true);
    expect(sim.store.getState().game.logs).toHaveLength(1);
    expect(sim.storage.keys()).toEqual([]);
    expect(local).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
