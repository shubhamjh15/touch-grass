import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays } from '@/lib/dates';
import { createGameDevTools, installGameDevTools, type GameDevTools } from './dev';
import { createEventBus, type GameEvent } from './events';
import {
  getCoachContext,
  useActionState,
  useBadge,
  useBadges,
  useGameActions,
  useGameClock,
  useGameEvent,
  useGameEvents,
  useGameHydrated,
  useGameRuntime,
  useGameState,
  useHud,
  useImpact,
  useIsOnboarded,
  useLevelInfo,
  useProfile,
  useQuests,
  useQuickLog,
  useSettings,
  useStreak,
  useToday,
  useTouchGrass,
  useTouchGrassTracker,
  useTreeStatus,
  useWorldSnapshot,
} from './hooks';
import { createMemoryStorage } from './storage';
import { createGame, game, gameActions, gameStore } from './store';
import { localTime } from './testkit';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
let now = localTime(MON, 12);

beforeEach(() => {
  now = localTime(MON, 12);
  game.setClock(() => now);
  gameActions.resetAll();
});

afterEach(() => {
  vi.useRealTimers();
  game.setClock(() => Date.now());
});

function plant(): void {
  const result = gameActions.onboard({ name: 'Maya', treeName: 'Fern', species: 'oak' });
  if (!result.ok) throw new Error(result.reason);
}

describe('game hooks', () => {
  it('reports hydration and the runtime', () => {
    expect(renderHook(() => useGameHydrated()).result.current).toBe(true);
    expect(renderHook(() => useGameRuntime()).result.current).toMatchObject({
      storage: 'local',
      saveFailed: false,
      recovery: null,
    });
    expect(renderHook(() => useIsOnboarded()).result.current).toBe(false);
  });

  it('follows the store through the daily loop', () => {
    const tree = renderHook(() => useTreeStatus());
    const today = renderHook(() => useToday());
    const hud = renderHook(() => useHud());
    const level = renderHook(() => useLevelInfo());
    expect(tree.result.current).toMatchObject({ stage: 'Seed', rings: 0 });

    act(plant);
    expect(renderHook(() => useIsOnboarded()).result.current).toBe(true);
    expect(tree.result.current).toMatchObject({
      name: 'Fern',
      stage: 'Sprout',
      rings: 1,
      checkedInToday: true,
    });
    expect(today.result.current).toMatchObject({ checkedIn: true, logs: [], actsToRing: 3 });
    expect(level.result.current.level).toBe(1);

    now += 1000;
    act(() => {
      gameActions.logAction({ actionId: 'plant-based-meal', qty: 3 });
    });
    expect(today.result.current).toMatchObject({ ringClosed: true, rewardedActs: 3, logXp: 45 });
    expect(tree.result.current.statusLine).toBe('Ring closed. See you tomorrow?');
    expect(level.result.current.level).toBe(2);
    expect(hud.result.current).toMatchObject({ level: 2, streak: 1, rings: 1, treeName: 'Fern' });
    expect(hud.result.current.kgLabel).toBe('≈ 4.6 kg');
  });

  it('keeps a read model’s identity when something unrelated changes', () => {
    act(plant);
    let renders = 0;
    const tree = renderHook(() => {
      renders += 1;
      return useTreeStatus();
    });
    const quests = renderHook(() => useQuests());
    const badges = renderHook(() => useBadges());
    const impact = renderHook(() => useImpact());
    const first = {
      tree: tree.result.current,
      quests: quests.result.current,
      badges: badges.result.current,
      impact: impact.result.current,
    };
    const before = renders;

    act(() => {
      gameActions.updateSettings({ sound: false });
      gameActions.tick(now + 60_000);
      gameActions.react('editorial:x', 'saved');
    });
    expect(tree.result.current).toBe(first.tree);
    expect(quests.result.current).toBe(first.quests);
    expect(impact.result.current).toBe(first.impact);
    expect(renders).toBe(before);

    now += 120_000;
    act(() => {
      gameActions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
    });
    expect(tree.result.current).not.toBe(first.tree);
    expect(quests.result.current).not.toBe(first.quests);
    expect(badges.result.current).not.toBe(first.badges);
    expect(impact.result.current.logs).toBe(1);
    expect(renders).toBeGreaterThan(before);
  });

  it('exposes slices, single actions and single badges', () => {
    act(plant);
    expect(renderHook(() => useProfile()).result.current).toMatchObject({
      treeName: 'Fern',
      name: 'Maya',
    });
    expect(renderHook(() => useSettings()).result.current.sound).toBe(false);
    expect(renderHook(() => useGameState((state) => state.xp)).result.current).toBe(35);
    expect(renderHook(() => useStreak()).result.current).toMatchObject({ current: 1, rainBank: 1 });
    expect(renderHook(() => useQuickLog()).result.current).toHaveLength(6);

    const meal = renderHook(() => useActionState('plant-based-meal'));
    const badge = renderHook(() => useBadge('first-leaf'));
    expect(meal.result.current).toMatchObject({ actsLeft: 3, maxed: false });
    expect(badge.result.current?.tier).toBe(0);
    expect(renderHook(() => useActionState('nope')).result.current).toBeUndefined();
    now += 1000;
    act(() => {
      gameActions.logAction({ actionId: 'plant-based-meal', qty: 3 });
    });
    expect(meal.result.current).toMatchObject({ actsLeft: 0, maxed: true, unitsLeft: 0 });
    expect(badge.result.current?.tier).toBe(1);
    expect(renderHook(() => useGameActions()).result.current).toBe(gameActions);
  });

  it('hands the world a snapshot that changes only when the world should', () => {
    act(plant);
    const world = renderHook(() => useWorldSnapshot());
    const first = world.result.current;
    expect(first).toMatchObject({ species: 'oak', ageDays: 1, vitality: 1, hour: 12, props: [] });
    expect(first.growth).toBeCloseTo(0.03, 10);
    act(() => gameActions.tick(now + 20_000));
    expect(world.result.current).toBe(first);
    act(() => gameActions.tick(now + 30 * 60_000));
    expect(world.result.current.hour).toBe(12.5);
    now += 31 * 60_000;
    act(() => {
      gameActions.logAction({ actionId: 'plant-based-meal' });
    });
    expect(world.result.current.growth).toBeGreaterThan(first.growth);
    expect(world.result.current.props).toEqual(['flowers']);
  });

  it('builds the coach context on demand from the live store', () => {
    act(plant);
    const context = getCoachContext({ lessonTitles: { 'big-levers': 'Big levers' } });
    expect(context).toMatchObject({ displayName: 'Maya', region: 'WORLD', rings: 1, ringLeft: 3 });
    expect(context.actions).toHaveLength(51);
  });

  it('subscribes to events while mounted and stops on unmount', () => {
    const levels: number[] = [];
    const batches: number[] = [];
    const single = renderHook(() => useGameEvent('level-up', (event) => levels.push(event.level)));
    const batch = renderHook(() => useGameEvents((events) => batches.push(events.length)));
    act(plant);
    now += 1000;
    act(() => {
      gameActions.logAction({ actionId: 'plant-based-meal', qty: 3 });
    });
    expect(levels).toEqual([2]);
    expect(batches).toHaveLength(2);
    single.unmount();
    batch.unmount();
    act(() => {
      gameActions.devGrantXp(5000);
    });
    expect(levels).toEqual([2]);
    expect(batches).toHaveLength(2);
  });

  it('rolls the day over at midnight while the clock hook is mounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(localTime(MON, 23, 59, 0));
    game.setClock(() => Date.now());
    act(plant);
    const today = renderHook(() => useToday());
    const clock = renderHook(() => useGameClock());
    expect(today.result.current.day).toBe(MON);
    act(() => {
      vi.advanceTimersByTime(62_000);
    });
    expect(today.result.current).toMatchObject({ day: day(1), checkedIn: false });
    expect(gameStore.getState().game.quests.daily?.key).toBe(day(1));
    clock.unmount();
    act(() => {
      vi.advanceTimersByTime(48 * 3600_000);
    });
    expect(gameStore.getState().game.clock.today).toBe(day(1));
  });

  it('tracks presence only while a break runs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(localTime(MON, 12));
    game.setClock(() => Date.now());
    act(plant);
    const add = vi.spyOn(window, 'addEventListener');
    const tracker = renderHook(() => useTouchGrassTracker());
    const status = renderHook(() => useTouchGrass());
    expect(add).not.toHaveBeenCalledWith('pointerdown', expect.anything(), expect.anything());
    expect(status.result.current.active).toBeNull();

    act(() => {
      gameActions.startTouchGrass(10);
    });
    expect(add).toHaveBeenCalledWith('pointerdown', expect.anything(), expect.anything());
    expect(status.result.current.active?.plannedMin).toBe(10);

    act(() => {
      vi.advanceTimersByTime(9 * 60_000);
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(gameStore.getState().game.activeBreak?.awayMs).toBe(9 * 60_000);
    act(() => {
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new Event('keydown'));
    });
    expect(gameStore.getState().game.activeBreak?.awayMs).toBe(9 * 60_000);

    act(() => {
      vi.advanceTimersByTime(60_000);
      gameActions.finishTouchGrass('outside');
    });
    expect(gameStore.getState().game.breaks[0]).toMatchObject({ kept: true, keptMin: 10 });
    const remove = vi.spyOn(window, 'removeEventListener');
    tracker.unmount();
    expect(remove).not.toHaveBeenCalledWith('pointerdown', expect.anything(), expect.anything());
  });
});

describe('the QA helper', () => {
  function devGame() {
    const clock = { now: localTime(MON, 9) };
    const bus = createEventBus();
    const events: GameEvent[] = [];
    bus.onAny((event) => events.push(event));
    const target = createGame({
      storage: createMemoryStorage(),
      now: () => clock.now,
      events: bus,
      seed: () => 3,
    });
    target.actions.onboard({ treeName: 'Fern', species: 'pine' });
    return { target, events };
  }

  it('travels through time, logs, grants and unlocks through the real store', () => {
    vi.useFakeTimers();
    vi.setSystemTime(localTime(MON, 9));
    const { target } = devGame();
    const tools = createGameDevTools(target);
    expect(tools.help()).toContain('__game.travel');
    expect(tools.water()).toBe(false);
    expect(tools.log('plant-based-meal', 2)).toMatchObject({ ok: true });
    expect(tools.closeRing()).toMatchObject({ ok: false, reason: 'over-cap' });

    tools.travel(1, 2);
    expect(tools.state().clock.today).toBe(day(1));
    expect(tools.water()).toBe(true);
    expect(tools.closeRing()).toMatchObject({ ok: true });
    expect(tools.state().days[day(1)]?.ringClosed).toBe(true);

    tools.travelTo(`${day(5)}T08:00`);
    expect(tools.state().clock.today).toBe(day(5));
    expect(tools.state().tree.vitality).toBe('thirsty');
    expect(tools.travelTo(`${day(2)}T08:00`)).toContain('forward only');
    expect(tools.world()).toMatchObject({ species: 'pine', hour: 8 });

    expect(tools.grantXp(1000)).toBe(tools.state().xp);
    expect(tools.grantGp(200)).toBe(tools.state().tree.gp);
    expect(tools.unlockBadge('bookworm', 2)).toBe(true);
    expect(tools.state().badges.bookworm?.tier).toBe(2);
    expect(tools.status()).toContain('Fern');

    const summary = tools.play(10);
    expect(summary).toContain('streak 10');
    expect(tools.state().tree.rings).toBe(12);

    const text = tools.export();
    tools.reset();
    expect(tools.state().onboarding.completedAt).toBeNull();
    expect(tools.import(text)).toBe(true);
    expect(tools.state().profile.treeName).toBe('Fern');
    expect(tools.realTime()).toBeTypeOf('string');
  });

  it('installs on window in development only', () => {
    const { target } = devGame();
    window.__game = undefined;
    installGameDevTools(target);
    // Read through a function so the compiler does not narrow the property to undefined.
    const installed = (): GameDevTools | undefined => window.__game;
    expect(installed()?.help()).toContain('__game.status');
    window.__game = undefined;
  });
});
