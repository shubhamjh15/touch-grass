'use client';

/**
 * React hooks over the game store. Each returns a read model that keeps its identity
 * until something it depends on changes, so components re-render only when they must.
 * Mutations never happen here: components call `gameActions` (or `useGameActions()`).
 */
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { WorldSnapshot } from '@/world/contract';
import type { BadgeStatus } from './badges';
import type { EpicStatus } from './quests';
import { gameEvents, type GameEvent, type GameEventOf, type GameEventType } from './events';
import type { LevelInfo } from './levels';
import {
  selectActionStates,
  selectActionStatesById,
  selectBadges,
  selectBaseline,
  selectChallenge,
  selectClock,
  selectCoachContext,
  selectEpics,
  selectHistory,
  selectHud,
  selectImpact,
  selectIslandLog,
  selectJournal,
  selectLearn,
  selectLevelInfo,
  selectNotices,
  selectPassport,
  selectQuests,
  selectQuickLog,
  selectRecap,
  selectStreak,
  selectTodaySummary,
  selectTouchGrass,
  selectTreeStatus,
  selectWorldSnapshot,
  type ActionState,
  type BadgeBoard,
  type BaselineView,
  type ChallengeView,
  type ClockStatus,
  type CoachContextOptions,
  type CoachContextShape,
  type GameSelector,
  type Hud,
  type Impact,
  type LearnBoard,
  type NoticeView,
  type Passport,
  type QuestBoard,
  type RecapView,
  type StreakStatus,
  type TodaySummary,
  type TouchGrassStatus,
  type TreeStatus,
} from './selectors';
import {
  game,
  gameActions,
  gameStore,
  startGameClock,
  type GameActions,
  type GameRuntime,
} from './store';
import type {
  ActivityEntry,
  GameState,
  JournalNote,
  LogEntry,
  Onboarding,
  Profile,
  SavedCustomAction,
  Settings,
} from './types';

/**
 * Subscribes to a read model. The selector must return a primitive, a slice of the
 * state, or one of the memoised selectors of this module — never a fresh object.
 */
export function useGame<T>(selector: GameSelector<T>): T {
  return useStore(gameStore, (state) => selector(state.game, state.runtime.now));
}

/** A slice of the persisted state, e.g. `useGameState((game) => game.xp)`. */
export function useGameState<T>(selector: (game: GameState) => T): T {
  return useStore(gameStore, (state) => selector(state.game));
}

/** False on the server and until the saved state has been read. */
export function useGameHydrated(): boolean {
  return useStore(gameStore, (state) => state.runtime.hydrated);
}

/** A stand-in world (the demo) is showing; the real save is untouched until it ends. */
export function useIsSandbox(): boolean {
  return useStore(gameStore, (state) => state.runtime.sandbox);
}

/** Storage mode, save failures and recovery: what the shell needs for its banners. */
export function useGameRuntime(): GameRuntime {
  return useStore(gameStore, (state) => state.runtime);
}

/** The store's clock, updated once a minute and on every action. */
export function useGameNow(): number {
  return useStore(gameStore, (state) => state.runtime.now);
}

/** Every action the UI can take. The object never changes identity. */
export function useGameActions(): GameActions {
  return gameActions;
}

export const useIsOnboarded = (): boolean =>
  useGameState((state) => state.onboarding.completedAt !== null);
export const useProfile = (): Profile => useGameState((state) => state.profile);
export const useSettings = (): Settings => useGameState((state) => state.settings);
export const useOnboarding = (): Onboarding => useGameState((state) => state.onboarding);
export const useCustomActions = (): readonly SavedCustomAction[] =>
  useGameState((state) => state.customActions);
export const useActivity = (): readonly ActivityEntry[] => useGameState((state) => state.activity);

export const useLevelInfo = (): LevelInfo => useGame(selectLevelInfo);
export const useTreeStatus = (): TreeStatus => useGame(selectTreeStatus);
export const useStreak = (): StreakStatus => useGame(selectStreak);
export const useToday = (): TodaySummary => useGame(selectTodaySummary);
export const useHud = (): Hud => useGame(selectHud);
/** All 51 actions with today's caps, for the Log page. */
export const useActionStates = (): ActionState[] => useGame(selectActionStates);
/** One action's caps and one-tap quantity; `undefined` for an unknown id. */
export const useActionState = (actionId: string): ActionState | undefined =>
  useStore(gameStore, (state) =>
    selectActionStatesById(state.game, state.runtime.now).get(actionId),
  );
/** Today's six one-tap tiles. */
export const useQuickLog = (): ActionState[] => useGame(selectQuickLog);
export const useQuests = (): QuestBoard => useGame(selectQuests);
export const useEpics = (): EpicStatus[] => useGame(selectEpics);
export const useBadges = (): BadgeBoard => useGame(selectBadges);
/** One badge's progress; `undefined` for an unknown id. */
export const useBadge = (badgeId: string): BadgeStatus | undefined =>
  useStore(gameStore, (state) =>
    selectBadges(state.game, state.runtime.now).all.find((status) => status.badge.id === badgeId),
  );
export const useImpact = (): Impact => useGame(selectImpact);
export const useHistory = (): LogEntry[] => useGame(selectHistory);
export const useBaseline = (): BaselineView | null => useGame(selectBaseline);
export const useLearn = (): LearnBoard => useGame(selectLearn);
export const useTouchGrass = (): TouchGrassStatus => useGame(selectTouchGrass);
export const useJournal = (): JournalNote[] => useGame(selectJournal);
export const useChallenge = (): ChallengeView | null => useGame(selectChallenge);
export const useNotices = (): NoticeView[] => useGame(selectNotices);
export const useRecap = (): RecapView => useGame(selectRecap);
export const useIslandLog = (): ActivityEntry[] => useGame(selectIslandLog);
export const usePassport = (): Passport => useGame(selectPassport);
export const useGameClockStatus = (): ClockStatus => useGame(selectClock);

/** The snapshot the Grove draws: pass it to the world bridge. */
export const useWorldSnapshot = (): WorldSnapshot => useGame(selectWorldSnapshot);

/**
 * The coach's context, built at call time (it is rebuilt for every request, so it is a
 * function rather than a subscription).
 */
export function getCoachContext(options?: CoachContextOptions): CoachContextShape {
  const { game: state } = gameStore.getState();
  return selectCoachContext(state, game.now(), options);
}

/** Runs `handler` for one event type while the component is mounted. */
export function useGameEvent<T extends GameEventType>(
  type: T,
  handler: (event: GameEventOf<T>) => void,
): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => gameEvents.on(type, (event) => latest.current(event)), [type]);
}

/** Runs `handler` once per mutation with everything it caused, in order. */
export function useGameEvents(handler: (events: readonly GameEvent[]) => void): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => gameEvents.onBatch((events) => latest.current(events)), []);
}

/**
 * Keeps the game in step with real time while mounted: settles the day on open, on
 * resume and at local midnight, moves the sky once a minute and follows other tabs.
 * Mount once, in the shell.
 */
export function useGameClock(): void {
  useEffect(() => {
    const handle = startGameClock();
    return () => handle.stop();
  }, []);
}

const INPUT_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const;
const INPUT_THROTTLE_MS = 5000;

/**
 * Feeds a running Touch Grass break with what the page can honestly know: when it was
 * hidden, when it came back, and whether anyone touched it. No permissions, no sensors.
 * Mount wherever a break can be running (the shell is fine); it is idle otherwise.
 */
export function useTouchGrassTracker(): void {
  const running = useGameState((state) => state.activeBreak !== null);
  useEffect(() => {
    if (!running) return undefined;
    let lastInput = 0;
    const onVisibility = () =>
      gameActions.signalTouchGrass(document.visibilityState === 'hidden' ? 'hidden' : 'visible');
    const onHide = () => gameActions.signalTouchGrass('hidden');
    const onInput = () => {
      const now = Date.now();
      // A save per pointer move would be wasteful; one every few seconds is plenty.
      if (document.visibilityState !== 'visible' || now - lastInput < INPUT_THROTTLE_MS) return;
      lastInput = now;
      gameActions.signalTouchGrass('input');
    };
    if (document.visibilityState === 'hidden') gameActions.signalTouchGrass('hidden');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    // Capture, so scrolling inside any panel counts as being at the screen.
    const listening = { passive: true, capture: true } as const;
    for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, listening);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput, listening);
    };
  }, [running]);
}
