import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, dayKey } from '@/lib/dates';
import { createEventBus, type GameEvent } from './events';
import { STORAGE_KEYS } from './keys';
import { checkInvariants } from './state';
import { createMemoryStorage, detectStorage, type KeyValueStorage } from './storage';
import { createGame, startGameClock, type Game } from './store';
import { localTime } from './testkit';
import type { GameState } from './types';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);

interface Harness {
  game: Game;
  storage: KeyValueStorage;
  events: GameEvent[];
  clock: { now: number };
  /** A second game on the same storage: another tab, or the same tab after a reload. */
  again: () => Game;
}

function harness(initial: Record<string, string> = {}, start = noon(0)): Harness {
  const storage = createMemoryStorage(initial);
  const clock = { now: start };
  const bus = createEventBus();
  const events: GameEvent[] = [];
  bus.onAny((event) => events.push(event));
  let seed = 100;
  const make = () =>
    createGame({ storage, now: () => clock.now, events: bus, seed: () => (seed += 1) });
  return { game: make(), storage, events, clock, again: make };
}

function planted(initial: Record<string, string> = {}, start = noon(0)): Harness {
  const h = harness(initial, start);
  const result = h.game.actions.onboard({ name: 'Maya', treeName: 'Fern', species: 'oak' });
  if (!result.ok) throw new Error(result.reason);
  return h;
}

const saved = (storage: KeyValueStorage): { state: GameState; version: number } =>
  JSON.parse(storage.getItem(STORAGE_KEYS.game) ?? 'null') as { state: GameState; version: number };

const stateOf = (game: Game) => game.store.getState().game;

afterEach(() => {
  vi.useRealTimers();
});

describe('the store', () => {
  it('starts blank, hydrated and unsaved', () => {
    const h = harness();
    expect(h.game.store.getState().runtime).toMatchObject({
      hydrated: true,
      storage: 'local',
      saveFailed: false,
      recovery: null,
      now: noon(0),
    });
    expect(stateOf(h.game).onboarding.completedAt).toBeNull();
    expect(h.storage.getItem(STORAGE_KEYS.game)).toBeNull();
  });

  it('persists only the game state, versioned, after every mutation', () => {
    const h = planted();
    const stored = saved(h.storage);
    expect(stored.version).toBe(1);
    expect(Object.keys(stored)).toEqual(['state', 'version']);
    expect(stored.state).toEqual(stateOf(h.game));
    expect(stored.state).not.toHaveProperty('runtime');
    expect(stored.state.profile.userSeed).toBe(101);

    h.clock.now += 1000;
    h.game.actions.logAction({ actionId: 'plant-based-meal', qty: 2 });
    expect(saved(h.storage).state.logs).toHaveLength(1);
    expect(saved(h.storage).state).toEqual(stateOf(h.game));
  });

  it('survives a reload', () => {
    const h = planted();
    h.clock.now += 1000;
    h.game.actions.logAction({ actionId: 'plant-based-meal', qty: 3 });
    const reloaded = h.again();
    expect(stateOf(reloaded)).toEqual(stateOf(h.game));
    expect(reloaded.store.getState().runtime.hydrated).toBe(true);
    expect(checkInvariants(stateOf(reloaded))).toEqual([]);
  });

  it('does not rewrite the save when only the clock moved', () => {
    const h = planted();
    const setItem = vi.spyOn(h.storage, 'setItem');
    h.clock.now += 60_000;
    h.game.actions.tick();
    h.game.actions.tick(h.clock.now + 60_000);
    expect(setItem).not.toHaveBeenCalled();
    expect(h.game.store.getState().runtime.now).toBe(h.clock.now + 60_000);
    h.clock.now += 120_000;
    h.game.actions.checkIn();
    expect(setItem).not.toHaveBeenCalled();
    h.game.actions.logAction({ actionId: 'plant-based-meal' });
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('sends every mutation through one path that emits typed events', () => {
    const h = planted();
    expect(h.events.map((event) => event.type)).toContain('planted');
    h.events.length = 0;
    h.clock.now += 1000;
    const result = h.game.actions.logAction({ actionId: 'plant-based-meal', qty: 3 });
    expect(result.ok).toBe(true);
    const types = h.events.map((event) => event.type);
    for (const expected of [
      'action-logged',
      'xp-gained',
      'ring',
      'badge-unlocked',
      'growth',
      'level-up',
    ] as const) {
      expect(types).toContain(expected);
    }
    h.events.length = 0;
    h.game.actions.updateSettings({ sound: false });
    expect(h.events).toEqual([]);
    expect(stateOf(h.game).settings.sound).toBe(false);
  });

  it('leaves the state untouched when an action is refused', () => {
    const h = planted();
    const before = stateOf(h.game);
    h.clock.now += 1000;
    expect(h.game.actions.logAction({ actionId: 'plant-based-meal', qty: 99 })).toMatchObject({
      ok: false,
    });
    expect(h.game.actions.claimQuest('d_nope')).toMatchObject({ ok: false });
    expect(h.game.actions.updateProfile({ treeName: '' })).toMatchObject({ ok: false });
    expect(h.game.actions.undoLog('nope')).toMatchObject({ ok: false });
    expect(stateOf(h.game)).toBe(before);
  });

  it('offers the whole daily loop', () => {
    const h = planted();
    const { actions } = h.game;
    h.clock.now = noon(1);
    expect(actions.checkIn()).toBe(true);
    expect(actions.checkIn()).toBe(false);
    expect(actions.swapQuest('weekly', 2).ok).toBe(true);
    const log = actions.logAction({ actionId: 'bus-instead-of-car', qty: 5, source: 'quick' });
    expect(log.ok).toBe(true);
    h.clock.now += 3000;
    expect(log.ok && actions.undoLog(log.log.id).ok).toBe(true);
    expect(
      actions.logCustom({ title: 'Fixed a bike', category: 'stuff', effort: 3, save: true }).ok,
    ).toBe(true);
    expect(actions.completeLesson('the-blanket', 3)).toMatchObject({ ok: true, xp: 40 });
    expect(actions.flipMyth(2)).toMatchObject({ first: true });
    expect(actions.addPost({ text: 'A journal note that is long enough.' })).toMatchObject({
      ok: true,
      rewarded: true,
    });
    expect(actions.react('editorial:one', 'saved')).toBe(true);
    expect(
      actions.setBaseline({
        diet: 'vegan',
        transportMode: 'bus',
        weeklyDistance: '25-75',
        flights: 'none',
        homeEnergy: 'minimal',
        shopping: 'minimal',
      }),
    ).toMatchObject({ ok: true });
    expect(actions.createChallenge({ templateId: 'rings_5' }).ok).toBe(true);
    expect(actions.completeEpic('e_green_power', true)).toMatchObject({ ok: true, xp: 300 });
    expect(actions.startTouchGrass(10).ok).toBe(true);
    actions.signalTouchGrass('hidden');
    h.clock.now += 11 * 60_000;
    expect(actions.finishTouchGrass('outside')).toMatchObject({ ok: true, rewarded: true });
    actions.hideAction('thermostat-down-1c');
    expect(stateOf(h.game).settings.hiddenActions).toEqual(['thermostat-down-1c']);
    actions.unhideAction('thermostat-down-1c');
    actions.recordShareExport();
    expect(stateOf(h.game).badges['show-and-tell']?.tier).toBe(1);
    expect(checkInvariants(stateOf(h.game))).toEqual([]);
    expect(saved(h.storage).state).toEqual(stateOf(h.game));
  });
});

describe('safe rehydration', () => {
  it('never wipes silently: corrupt JSON gives a fresh state plus a recoverable backup', () => {
    const raw = '{"state": {"xp": 123, "profile": ';
    const h = harness({ [STORAGE_KEYS.game]: raw });
    expect(stateOf(h.game).onboarding.completedAt).toBeNull();
    expect(h.game.store.getState().runtime.recovery).toMatchObject({ reason: 'not-json' });
    expect(h.game.actions.recoveryEntries()).toMatchObject([{ reason: 'not-json', raw }]);
    expect(h.storage.getItem(STORAGE_KEYS.game)).toBe(raw);

    h.game.actions.onboard({ treeName: 'Fern', species: 'oak' });
    expect(saved(h.storage).state.profile.treeName).toBe('Fern');
    expect(h.game.actions.recoveryEntries()[0]?.raw).toBe(raw);
    h.game.actions.discardRecovery();
    expect(h.game.actions.recoveryEntries()).toEqual([]);
    expect(h.game.store.getState().runtime.recovery).toBeNull();
  });

  it('sets aside a save from a newer version instead of downgrading it', () => {
    const source = planted();
    const newer = JSON.stringify({
      state: { ...stateOf(source.game), schemaVersion: 2 },
      version: 2,
    });
    const h = harness({ [STORAGE_KEYS.game]: newer });
    expect(h.game.store.getState().runtime.recovery).toMatchObject({ reason: 'newer-schema' });
    expect(h.game.actions.recoveryEntries()[0]?.raw).toBe(newer);
    expect(stateOf(h.game).xp).toBe(0);
  });

  it('rejects a save whose numbers do not add up', () => {
    const source = planted();
    const cheated = { ...stateOf(source.game), tree: { ...stateOf(source.game).tree, rings: 400 } };
    const h = harness({ [STORAGE_KEYS.game]: JSON.stringify({ state: cheated, version: 1 }) });
    expect(h.game.store.getState().runtime.recovery).toMatchObject({ reason: 'invariants' });
  });

  it('keeps the three most recent unreadable saves', () => {
    const storage = createMemoryStorage();
    for (let index = 0; index < 5; index += 1) {
      storage.setItem(STORAGE_KEYS.game, `broken ${index}`);
      createGame({ storage, now: () => noon(0) + index });
    }
    const entries = createGame({ storage, now: () => noon(1) }).actions.recoveryEntries();
    expect(entries.map((entry) => entry.raw)).toEqual(['broken 4', 'broken 3', 'broken 2']);
  });

  it('recovers through an import of the raw save when it was only a bad wrapper', () => {
    const source = planted();
    const text = source.game.actions.exportState();
    const h = harness({ [STORAGE_KEYS.game]: 'garbage' });
    expect(h.game.actions.importState(text).ok).toBe(true);
    expect(stateOf(h.game).profile.treeName).toBe('Fern');
    expect(h.game.store.getState().runtime.recovery).toBeNull();
  });
});

describe('storage that misbehaves', () => {
  it('keeps playing in memory when a save fails, and says so', async () => {
    const h = planted();
    const quota = new DOMException('full', 'QuotaExceededError');
    const setItem = vi.spyOn(h.storage, 'setItem').mockImplementation(() => {
      throw quota;
    });
    h.clock.now += 1000;
    expect(h.game.actions.logAction({ actionId: 'plant-based-meal' }).ok).toBe(true);
    expect(stateOf(h.game).logs).toHaveLength(1);
    await Promise.resolve();
    expect(h.game.store.getState().runtime.saveFailed).toBe(true);
    expect(h.game.actions.exportState()).toContain('"plant-based-meal"');

    setItem.mockRestore();
    h.clock.now += 5000;
    h.game.actions.logAction({ actionId: 'bus-instead-of-car' });
    await Promise.resolve();
    expect(h.game.store.getState().runtime.saveFailed).toBe(false);
    expect(saved(h.storage).state.logs).toHaveLength(2);
  });

  it('survives storage that throws on every call', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
      keys: () => {
        throw new Error('denied');
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const game = createGame({
      storage: broken,
      storageMode: 'memory',
      now: () => noon(0),
      seed: () => 5,
    });
    expect(game.actions.onboard({ treeName: 'Fern', species: 'pine' }).ok).toBe(true);
    expect(game.actions.logAction({ actionId: 'plant-based-meal' }).ok).toBe(true);
    expect(game.actions.storageUsedBytes()).toBe(0);
    expect(game.actions.legacyBackup()).toBeNull();
    expect(() => game.actions.resetAll()).not.toThrow();
    expect(game.store.getState().runtime.storage).toBe('memory');
    expect(warn).toHaveBeenCalled();
  });

  it('detects the browser storage', () => {
    const detected = detectStorage();
    expect(detected.mode).toBe('local');
    detected.storage.setItem('touchgrass:probe-test', 'x');
    expect(detected.storage.keys()).toContain('touchgrass:probe-test');
    expect(localStorage.getItem('touchgrass:probe-test')).toBe('x');
  });
});

describe('cross-tab sync', () => {
  it('picks up what another tab saved, without echoing it back', () => {
    const h = planted();
    const other = h.again();
    h.clock.now += 1000;
    other.actions.logAction({ actionId: 'plant-based-meal', qty: 2 });
    expect(stateOf(h.game).logs).toHaveLength(0);
    const setItem = vi.spyOn(h.storage, 'setItem');
    const events = h.events.length;
    h.game.rehydrate();
    expect(stateOf(h.game)).toEqual(stateOf(other));
    expect(setItem).not.toHaveBeenCalled();
    expect(h.events).toHaveLength(events);
  });

  it('follows a reset made in another tab', () => {
    const h = planted();
    const other = h.again();
    other.actions.resetAll();
    h.game.rehydrate();
    expect(stateOf(h.game).onboarding.completedAt).toBeNull();
    expect(stateOf(h.game).xp).toBe(0);
  });

  it('re-reads on the storage event and ticks at local midnight', () => {
    vi.useFakeTimers();
    const start = localTime(MON, 23, 59, 30);
    vi.setSystemTime(start);
    const storage = createMemoryStorage();
    const bus = createEventBus();
    const seen: string[] = [];
    bus.on('day-rolled', (event) => seen.push(`${event.from}>${event.to}`));
    const game = createGame({ storage, events: bus, seed: () => 9 });
    game.actions.onboard({ treeName: 'Fern', species: 'oak' });
    const other = createGame({ storage, events: createEventBus(), seed: () => 9 });

    const handle = startGameClock(game);
    expect(stateOf(game).clock.today).toBe(MON);
    vi.advanceTimersByTime(32_000);
    expect(dayKey(Date.now())).toBe(day(1));
    expect(stateOf(game).clock.today).toBe(day(1));
    expect(stateOf(game).quests.daily?.key).toBe(day(1));
    expect(seen).toEqual([`${MON}>${day(1)}`]);

    other.rehydrate();
    other.actions.checkIn();
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.game }));
    expect(stateOf(game).tree.rings).toBe(2);
    window.dispatchEvent(new StorageEvent('storage', { key: 'someone-else' }));

    // The once-a-minute tick keeps the clock (and the sky) moving.
    vi.advanceTimersByTime(28_000);
    expect(game.store.getState().runtime.now).toBe(start + 60_000);
    expect(Date.now()).toBe(start + 60_000);
    vi.advanceTimersByTime(24 * 3600_000);
    expect(stateOf(game).clock.today).toBe(day(2));
    handle.stop();
    const frozen = stateOf(game).clock.today;
    vi.advanceTimersByTime(48 * 3600_000);
    expect(stateOf(game).clock.today).toBe(frozen);
  });
});

describe('export, import and reset', () => {
  it('round-trips through the export file', () => {
    const h = planted();
    h.clock.now += 1000;
    h.game.actions.logAction({ actionId: 'plant-based-meal', qty: 3 });
    h.storage.setItem(STORAGE_KEYS.coach, JSON.stringify([{ role: 'user', content: 'hello' }]));
    const plain = JSON.parse(h.game.actions.exportState()) as { coach: unknown; app: string };
    expect(plain).toMatchObject({ app: 'touchgrass', coach: null });
    const text = h.game.actions.exportState({ includeCoach: true });

    const target = harness({}, h.clock.now);
    const preview = target.game.actions.previewImport(text);
    expect(preview.ok && preview.preview).toMatchObject({ treeName: 'Fern', rings: 1, logs: 1 });
    expect(stateOf(target.game).xp).toBe(0);
    const result = target.game.actions.importState(text);
    expect(result.ok).toBe(true);
    expect(stateOf(target.game)).toEqual(stateOf(h.game));
    expect(saved(target.storage).state).toEqual(stateOf(h.game));
    expect(target.storage.getItem(STORAGE_KEYS.coach)).toBe(
      JSON.stringify([{ role: 'user', content: 'hello' }]),
    );
    expect(target.events.map((event) => event.type)).toContain('state-imported');
    expect(target.events.some((event) => event.type === 'level-up')).toBe(false);
  });

  it('settles an imported save to today', () => {
    const h = planted();
    const text = h.game.actions.exportState();
    const later = harness({}, noon(3));
    later.game.actions.importState(text);
    expect(stateOf(later.game).clock.today).toBe(day(3));
    expect(stateOf(later.game).tree.vitality).toBe('thirsty');
    expect(stateOf(later.game).quests.daily?.key).toBe(day(3));
  });

  it('changes nothing when an import fails', () => {
    const h = planted();
    const before = stateOf(h.game);
    const stored = h.storage.getItem(STORAGE_KEYS.game);
    for (const text of [
      'nope',
      '{"app":"other"}',
      JSON.stringify({ app: 'touchgrass', state: { schemaVersion: 1 } }),
    ]) {
      expect(h.game.actions.importState(text).ok).toBe(false);
    }
    expect(stateOf(h.game)).toBe(before);
    expect(h.storage.getItem(STORAGE_KEYS.game)).toBe(stored);
  });

  it('exports the logs as CSV', () => {
    const h = planted();
    h.clock.now += 1000;
    h.game.actions.logAction({ actionId: 'plant-based-meal' });
    expect(h.game.actions.exportLogsCsv().split('\r\n')).toHaveLength(2);
  });

  it('resets everything the app stored and nothing else', () => {
    const h = planted({ 'someone-elses-key': 'keep me', actionLogs: '[]' });
    h.storage.setItem(STORAGE_KEYS.coach, '[]');
    h.storage.setItem(STORAGE_KEYS.ui, '{}');
    expect(h.game.actions.storageUsedBytes()).toBeGreaterThan(1000);
    h.events.length = 0;
    h.game.actions.resetAll();
    expect(h.events).toEqual([{ type: 'state-reset' }]);
    expect(stateOf(h.game).onboarding.completedAt).toBeNull();
    expect(stateOf(h.game).logs).toEqual([]);
    expect(h.storage.keys().sort()).toEqual([STORAGE_KEYS.game, 'someone-elses-key'].sort());
    expect(saved(h.storage).state.xp).toBe(0);
    expect(h.again().store.getState().game.onboarding.completedAt).toBeNull();
  });
});

describe('legacy import', () => {
  const stats = JSON.stringify({
    xp: 4250,
    level: 5,
    co2Saved: 45.2,
    streak: 12,
    badges: ['Eco-Warrior'],
  });
  const seedLogs = [
    { id: '1', type: 'Recycled Glass' },
    { id: '2', type: 'Biked to Work' },
    { id: '3', type: 'Meat-free Meal' },
  ];
  const realLogs = [
    { id: String(localTime(day(-4), 9)), type: 'Veggie Meal', co2Impact: 1.5, xpReward: 30 },
    { id: String(localTime(day(-3), 9)), type: 'Refill Bottle', co2Impact: 0.1, xpReward: 10 },
    { id: String(localTime(day(-3), 10)), type: 'Juggled compost', co2Impact: 9, xpReward: 500 },
  ];

  it('offers real logs, brings them along and backs the old data up', () => {
    const actionLogs = JSON.stringify([...seedLogs, ...realLogs]);
    const h = harness({ userStats: stats, actionLogs });
    expect(h.game.actions.scanLegacy()).toEqual({ status: 'real', logs: 3, skipped: 3 });
    expect(stateOf(h.game).onboarding.legacy).toBe('offered');
    expect(h.game.store.getState().runtime.legacy).toEqual({ status: 'real', logs: 3, skipped: 3 });

    expect(h.game.actions.onboard({ treeName: 'Fern', species: 'oak' }).ok).toBe(true);
    const state = stateOf(h.game);
    expect(state.onboarding.legacy).toBe('imported');
    expect(state.logs.map((log) => log.source)).toEqual(['legacy', 'legacy', 'legacy']);
    expect(state.logs.every((log) => log.co2eKg === null)).toBe(true);
    expect(state.tree.rings).toBe(3);
    expect(state.profile.plantedDay).toBe(day(-4));
    expect(state.xp).toBeLessThan(400);
    expect(state.streak.current).not.toBe(12);
    expect(state.badges['old-growth']?.tier).toBe(1);
    expect(h.events.map((event) => event.type)).toContain('legacy-imported');
    expect(
      h.events
        .filter((event) => event.type === 'level-up')
        .every((event) => event.type !== 'level-up' || !event.first),
    ).toBe(true);

    expect(h.storage.getItem('userStats')).toBeNull();
    expect(h.storage.getItem('actionLogs')).toBeNull();
    expect(JSON.parse(h.game.actions.legacyBackup() ?? '{}')).toEqual({
      userStats: stats,
      actionLogs,
    });
    h.game.actions.deleteLegacyBackup();
    expect(h.game.actions.legacyBackup()).toBeNull();
    expect(checkInvariants(state)).toEqual([]);
  });

  it('starts fresh when the user declines, still keeping a backup', () => {
    const actionLogs = JSON.stringify(realLogs);
    const h = harness({ userStats: stats, actionLogs });
    h.game.actions.scanLegacy();
    h.game.actions.declineLegacy();
    h.game.actions.onboard({ treeName: 'Fern', species: 'oak' });
    const state = stateOf(h.game);
    expect(state.onboarding.legacy).toBe('declined');
    expect(state.logs).toEqual([]);
    expect(state.xp).toBe(35);
    expect(state.profile.plantedDay).toBe(MON);
    expect(h.storage.getItem('actionLogs')).toBeNull();
    expect(h.game.actions.legacyBackup()).not.toBeNull();
  });

  it('shows nothing for the seeded placeholders and removes them after onboarding', () => {
    const h = harness({ userStats: stats, actionLogs: JSON.stringify(seedLogs) });
    expect(h.game.actions.scanLegacy()).toEqual({ status: 'seed-only', logs: 0, skipped: 3 });
    expect(stateOf(h.game).onboarding.legacy).toBe('none');
    expect(h.storage.getItem('userStats')).toBe(stats);
    h.game.actions.onboard({ treeName: 'Fern', species: 'oak' });
    expect(stateOf(h.game).xp).toBe(35);
    expect(h.storage.getItem('userStats')).toBeNull();
    expect(h.storage.getItem('actionLogs')).toBeNull();
    expect(h.game.actions.legacyBackup()).toBeNull();
  });

  it('does nothing without legacy data', () => {
    const h = harness();
    expect(h.game.actions.scanLegacy()).toEqual({ status: 'none', logs: 0, skipped: 0 });
    expect(stateOf(h.game).onboarding.legacy).toBe('none');
  });
});
