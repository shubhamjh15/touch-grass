/**
 * The game store: the persisted state, the runtime around it and every action the UI
 * needs. The rules live in the pure engine; this module adds what is impure — the
 * clock, storage, randomness and the event bus — and funnels every mutation through
 * one function, `run`, so a change is always atomic and always reported as events.
 *
 * Safe to import on the server: nothing touches `window` or storage at module load
 * unless a browser is present.
 */
import { msUntilTomorrow } from '@/lib/dates';
import { IS_DEV } from '@/lib/env';
import { randomSeed } from '@/lib/rng';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  acceptChallenge,
  addPost,
  clearJournal,
  createChallenge,
  deletePost,
  dismissChallenge,
  editPost,
  toggleReaction,
  type CreateChallengeInput,
  type PostInput,
} from './community';
import type { Ctx } from './ctx';
import { SCHEMA_VERSION } from './economy';
import {
  clearBaseline,
  devGrantGp,
  devGrantXp,
  devUnlockBadge,
  dismissNotice,
  markCoachMarksSeen,
  markCoachPrivacyNoticeSeen,
  markRecapSeen,
  plantTree,
  recordShareExport,
  setActionHidden,
  setBaseline,
  setOnboardingStep,
  transact,
  updateProfile,
  updateSettings,
  water,
  type OnboardInput,
  type OnboardResult,
  type ProfilePatch,
  type SettingsPatch,
} from './engine';
import { gameEvents, type GameEvent, type GameEventBus } from './events';
import { STORAGE_KEYS } from './keys';
import { LEGACY_KEYS, replayLegacy, scanLegacy, type LegacyScan } from './legacy';
import { completeLesson, flipMyth, markLessonRead, openLesson } from './lessons';
import {
  logAction,
  logCustom,
  logSavedCustom,
  removeLog,
  removeSavedCustom,
  undoLog,
  type LogActionInput,
  type LogCustomInput,
} from './logging';
import { buildExport, logsToCsv, parseImport, parseStoredGame, type ImportResult } from './persist';
import { claimEpic, claimQuest, pinEpic, swapQuest, updateEpic } from './quests';
import { createInitialState, isOnboarded } from './state';
import {
  clearAllAppStorage,
  clearRecovery,
  createMemoryStorage,
  createSandboxStorage,
  detectSessionStorage,
  detectStorage,
  keepForRecovery,
  readRecovery,
  storageUsedBytes,
  type KeyValueStorage,
  type RecoveryEntry,
  type StorageMode,
} from './storage';
import {
  finishBreak,
  signalBreak,
  startBreak,
  type BreakOutcome,
  type BreakSignal,
} from './touchGrass';
import type { BadgeTier, GameState } from './types';

export interface GameRuntime {
  /** The clock at the last tick or action. Drives "today" and the sky's hour. */
  now: number;
  /** The saved state has been read. False only on the server and before the first read. */
  hydrated: boolean;
  /** `memory` means a private window or blocked storage: nothing survives a reload. */
  storage: StorageMode;
  /** A save failed (the quota is full): the state lives on in memory, offer an export. */
  saveFailed: boolean;
  /** A stored save could not be read and was set aside: show the recovery screen. */
  recovery: { reason: string; detail: string; savedAt: number } | null;
  /** What the last scan of the legacy app's storage found. */
  legacy: { status: LegacyScan['status']; logs: number; skipped: number } | null;
  /**
   * A stand-in world is showing (the demo). It is read from and saved to the tab's session
   * storage only; the real save is not read, written or followed until the sandbox ends.
   */
  sandbox: boolean;
}

export interface GameStoreState {
  game: GameState;
  runtime: GameRuntime;
}

export interface CreateGameOptions {
  /** Defaults to the browser's storage, or memory when there is none. */
  storage?: KeyValueStorage;
  storageMode?: StorageMode;
  /** The clock. Tests and the QA helper replace it. */
  now?: () => number;
  /** A fresh uint32 for a new tree. */
  seed?: () => number;
  events?: GameEventBus;
  /** Where a sandbox keeps its stand-in save. Defaults to the tab's session storage. */
  sandboxStorage?: KeyValueStorage;
  /**
   * `false` builds a game that lives in memory only: nothing is read, nothing is saved.
   * For replaying the rules (the demo world is grown this way) without touching a save.
   */
  persist?: boolean;
}

export type GameStore = StoreApi<GameStoreState>;

export interface Game {
  store: GameStore;
  actions: GameActions;
  /** The clock this game runs on. */
  now: () => number;
  /** Replaces the clock: QA time travel. */
  setClock: (clock: () => number) => void;
  /** Re-reads the saved state, e.g. after another tab changed it. */
  rehydrate: () => void;
  /** The storage in use: the sandbox's own while one is showing. */
  storage: KeyValueStorage;
  /**
   * Shows `state` as a sandbox: from here on the game reads and saves a separate,
   * session-only namespace and leaves the real save exactly as it is.
   */
  enterSandbox: (state: GameState) => void;
  /** Ends the sandbox, forgets it and brings back the real save (or "nothing planted yet"). */
  leaveSandbox: () => void;
}

export type GameActions = ReturnType<typeof createActions>;

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

function createActions(
  store: GameStore,
  kv: KeyValueStorage,
  clock: { now: () => number },
  seed: () => number,
  bus: GameEventBus,
  sandbox: { isOn: () => boolean; leave: () => void },
) {
  /** The single path of every mutation: one transaction, one atomic set, one event batch. */
  function run<T>(operation: (ctx: Ctx) => T, extraEvents: readonly GameEvent[] = []): T {
    const now = clock.now();
    const before = store.getState();
    const outcome = transact(before.game, now, operation);
    if (outcome.state !== before.game || before.runtime.now !== now) {
      store.setState({ game: outcome.state, runtime: { ...store.getState().runtime, now } });
    }
    bus.emit([...extraEvents, ...outcome.events]);
    return outcome.result;
  }

  const read = (key: string): string | null => {
    try {
      return kv.getItem(key);
    } catch {
      return null;
    }
  };

  const patchRuntime = (patch: Partial<GameRuntime>) =>
    store.setState({ runtime: { ...store.getState().runtime, ...patch } });

  return {
    // ── Onboarding and profile ───────────────────────────────────────────────
    /** Looks for data of the legacy app; real logs are offered at step 0 of onboarding. */
    scanLegacy(): GameRuntime['legacy'] {
      const scan = scanLegacy(read, clock.now());
      const summary = { status: scan.status, logs: scan.logs.length, skipped: scan.skipped };
      patchRuntime({ legacy: summary });
      const { game } = store.getState();
      if (scan.status === 'real' && game.onboarding.legacy === 'none' && !isOnboarded(game)) {
        run((ctx) => {
          ctx.s.onboarding.legacy = 'offered';
        });
      }
      return summary;
    },
    /** "Start fresh": the old logs stay behind (a backup is still kept when planting). */
    declineLegacy(): void {
      run((ctx) => {
        if (!isOnboarded(ctx.s)) ctx.s.onboarding.legacy = 'declined';
      });
    },
    /** The seed-planting ceremony. Brings accepted legacy logs along, then plants. */
    onboard(input: Omit<OnboardInput, 'userSeed'>): OnboardResult {
      const now = clock.now();
      const before = store.getState();
      const scan = scanLegacy(read, now);
      const bringing = before.game.onboarding.legacy === 'offered' && scan.status === 'real';
      const base = bringing ? replayLegacy(before.game, scan, now) : before.game;
      const outcome = transact(base, now, (ctx) => plantTree(ctx, { ...input, userSeed: seed() }));
      if (!outcome.result.ok) return outcome.result;

      store.setState({ game: outcome.state, runtime: { ...before.runtime, now } });
      if (scan.status !== 'none') {
        try {
          // The raw legacy data is copied before the old keys go, and kept until deleted.
          if (scan.status === 'real')
            kv.setItem(STORAGE_KEYS.legacyBackup, JSON.stringify(scan.raw));
          for (const key of LEGACY_KEYS) kv.removeItem(key);
        } catch {
          // Without storage there is nothing to back up or remove.
        }
      }
      const imported: GameEvent[] = bringing
        ? [
            {
              type: 'legacy-imported',
              logs: scan.logs.length,
              skipped: scan.skipped,
              rings: outcome.state.tree.rings,
              xp: outcome.state.xp,
            },
          ]
        : [];
      bus.emit([...imported, ...outcome.events]);
      return outcome.result;
    },
    setOnboardingStep: (step: number) => run((ctx) => setOnboardingStep(ctx, step)),
    updateProfile: (patch: ProfilePatch) => run((ctx) => updateProfile(ctx, patch)),
    updateSettings: (patch: SettingsPatch) => run((ctx) => updateSettings(ctx, patch)),
    /** "Not for me": hides an action from the grid, quick-log, coach chips and new quests. */
    hideAction: (actionId: string) => run((ctx) => setActionHidden(ctx, actionId, true)),
    unhideAction: (actionId: string) => run((ctx) => setActionHidden(ctx, actionId, false)),
    markCoachMarksSeen: () => run(markCoachMarksSeen),
    markCoachPrivacyNoticeSeen: () => run(markCoachPrivacyNoticeSeen),

    // ── The daily loop ───────────────────────────────────────────────────────
    /** The Water button. Returns false when today already has its check-in. */
    checkIn: () => run(water),
    logAction: (input: LogActionInput) => run((ctx) => logAction(ctx, input)),
    logCustom: (input: LogCustomInput) => run((ctx) => logCustom(ctx, input)),
    logSavedCustom: (savedId: string) => run((ctx) => logSavedCustom(ctx, savedId)),
    removeSavedCustom: (savedId: string) => run((ctx) => removeSavedCustom(ctx, savedId)),
    /** The undo behind the 8-second toast. */
    undoLog: (logId: string) => run((ctx) => undoLog(ctx, logId)),
    /** Deletes any log, today's or a settled one. */
    deleteLog: (logId: string) => run((ctx) => removeLog(ctx, logId)),

    // ── Quests ───────────────────────────────────────────────────────────────
    claimQuest: (questId: string) => run((ctx) => claimQuest(ctx, questId)),
    swapQuest: (kind: 'daily' | 'weekly', slot: number) => run((ctx) => swapQuest(ctx, kind, slot)),
    /** Claims an epic; a self-attested one needs `confirmed: true`. */
    completeEpic: (epicId: string, confirmed = false) =>
      run((ctx) => claimEpic(ctx, epicId, confirmed)),
    updateEpic: (epicId: string, patch: { checklist?: readonly boolean[]; note?: string }) =>
      run((ctx) => updateEpic(ctx, epicId, patch)),
    pinEpic: (epicId: string | null) => run((ctx) => pinEpic(ctx, epicId)),

    // ── Learn ────────────────────────────────────────────────────────────────
    openLesson: (slug: string) => run((ctx) => openLesson(ctx, slug)),
    markLessonRead: (slug: string) => run((ctx) => markLessonRead(ctx, slug)),
    /** Records a finished quiz with its score out of three. */
    completeLesson: (slug: string, score: number) => run((ctx) => completeLesson(ctx, slug, score)),
    flipMyth: (myth: number) => run((ctx) => flipMyth(ctx, myth)),

    // ── Starting line ────────────────────────────────────────────────────────
    setBaseline: (answers: unknown, options?: { useAsFocus?: boolean }) =>
      run((ctx) => setBaseline(ctx, answers, options)),
    clearBaseline: () => run(clearBaseline),

    // ── Touch Grass ──────────────────────────────────────────────────────────
    startTouchGrass: (plannedMin: number) => run((ctx) => startBreak(ctx, plannedMin)),
    /** Page hidden, shown again, or touched while a break runs. */
    signalTouchGrass: (signal: BreakSignal) => {
      if (store.getState().game.activeBreak) run((ctx) => signalBreak(ctx, signal));
    },
    finishTouchGrass: (outcome: BreakOutcome) => run((ctx) => finishBreak(ctx, outcome)),

    // ── Community ────────────────────────────────────────────────────────────
    addPost: (input: PostInput) => run((ctx) => addPost(ctx, input)),
    editPost: (noteId: string, patch: { text?: string; tag?: string | null }) =>
      run((ctx) => editPost(ctx, noteId, patch)),
    deletePost: (noteId: string) => run((ctx) => deletePost(ctx, noteId)),
    clearJournal: () => run(clearJournal),
    /** Toggles a mark on this device (e.g. saving an editorial post). Returns the new state. */
    react: (targetId: string, reaction: string) =>
      run((ctx) => toggleReaction(ctx, targetId, reaction)),
    createChallenge: (input: CreateChallengeInput) => run((ctx) => createChallenge(ctx, input)),
    acceptChallenge: (encoded: string) => run((ctx) => acceptChallenge(ctx, encoded)),
    dismissChallenge: () => run(dismissChallenge),
    /** A share card was exported; the first one earns Show & Tell. */
    recordShareExport: () => run(recordShareExport),

    // ── Notices and recap ────────────────────────────────────────────────────
    dismissNotice: (noticeId: string) => run((ctx) => dismissNotice(ctx, noticeId)),
    markRecapSeen: (week: string) => run((ctx) => markRecapSeen(ctx, week)),

    // ── Clock ────────────────────────────────────────────────────────────────
    /** Settles the calendar: call on app open, on resume and at midnight. */
    tick(now?: number): void {
      if (now === undefined) {
        run(() => undefined);
        return;
      }
      const before = store.getState();
      const outcome = transact(before.game, now, () => undefined);
      if (outcome.state !== before.game || before.runtime.now !== now) {
        store.setState({ game: outcome.state, runtime: { ...before.runtime, now } });
      }
      bus.emit(outcome.events);
    },

    // ── Data ─────────────────────────────────────────────────────────────────
    /** The export file's contents. Coach chats are left out unless asked for. */
    exportState(options: { includeCoach?: boolean; appVersion?: string } = {}): string {
      let coach: unknown = null;
      if (options.includeCoach) {
        try {
          coach = JSON.parse(read(STORAGE_KEYS.coach) ?? 'null');
        } catch {
          coach = null;
        }
      }
      const envelope = buildExport(store.getState().game, clock.now(), {
        appVersion: options.appVersion,
        coach,
      });
      return JSON.stringify(envelope, null, 2);
    },
    exportLogsCsv: (): string => logsToCsv(store.getState().game),
    /** Validates an export file and describes it. Changes nothing. */
    previewImport: (text: string): ImportResult => parseImport(text),
    /** Replaces this device's data with a validated export. A failed import changes nothing. */
    importState(text: string): ImportResult {
      const now = clock.now();
      const parsed = parseImport(text);
      if (!parsed.ok) return parsed;
      const settled = transact(parsed.state, now, () => undefined);
      store.setState({
        game: settled.state,
        runtime: { ...store.getState().runtime, now, recovery: null },
      });
      if (parsed.coach !== null && parsed.coach !== undefined) {
        try {
          kv.setItem(STORAGE_KEYS.coach, JSON.stringify(parsed.coach));
        } catch {
          // Coach history is a convenience; the game data is already in place.
        }
      }
      bus.emit([{ type: 'state-imported' }, ...settled.events]);
      return parsed;
    },
    /**
     * Deletes everything the app stored on this device and starts over. In a sandbox there
     * is only the sandbox to erase: it ends, and the real save is left as it was.
     */
    resetAll(): void {
      if (sandbox.isOn()) {
        // Announced first, so whatever listens clears the sandbox's leftovers, not the real ones.
        bus.emit([{ type: 'state-reset' }]);
        sandbox.leave();
        return;
      }
      clearAllAppStorage(kv);
      const now = clock.now();
      store.setState({
        game: createInitialState(now),
        runtime: {
          ...store.getState().runtime,
          now,
          recovery: null,
          legacy: null,
          saveFailed: false,
          sandbox: false,
        },
      });
      bus.emit([{ type: 'state-reset' }]);
    },
    storageUsedBytes: (): number => storageUsedBytes(kv),
    /** The raw data of the legacy app, if a backup was kept. */
    legacyBackup: (): string | null => read(STORAGE_KEYS.legacyBackup),
    deleteLegacyBackup(): void {
      try {
        kv.removeItem(STORAGE_KEYS.legacyBackup);
      } catch {
        // Nothing stored, nothing to delete.
      }
    },
    /** Saves that could not be read, for "Download the raw save". */
    recoveryEntries: (): RecoveryEntry[] => readRecovery(kv),
    /** "Start fresh" on the recovery screen: drops the unreadable saves. */
    discardRecovery(): void {
      clearRecovery(kv);
      patchRuntime({ recovery: null });
    },

    // ── QA (only reachable through the DEV-only window helper) ───────────────
    devGrantXp: (amount: number) => run((ctx) => devGrantXp(ctx, amount)),
    devGrantGp: (amount: number) => run((ctx) => devGrantGp(ctx, amount)),
    devUnlockBadge: (badgeId: string, tier: BadgeTier = 1) =>
      run((ctx) => devUnlockBadge(ctx, badgeId, tier)),
  };
}

/** Builds a game: store, actions and clock. The app uses one; tests build their own. */
export function createGame(options: CreateGameOptions = {}): Game {
  const persisted = options.persist !== false;
  const detected = options.storage
    ? { storage: options.storage, mode: options.storageMode ?? ('local' as StorageMode) }
    : persisted
      ? detectStorage()
      : { storage: createMemoryStorage(), mode: 'memory' as StorageMode };
  const real = detected.storage;
  const clock = { now: options.now ?? (() => Date.now()) };
  const bus = options.events ?? gameEvents;
  const isBrowser = typeof window !== 'undefined';

  let recovery: GameRuntime['recovery'] = null;
  let lastWritten: GameState | null = null;
  let saveFailed = false;

  // The sandbox. A game with a storage of its own (tests, tools) keeps its sandbox in memory
  // unless it is given a place for it; the app's game uses the tab's session storage.
  const sandbox = createSandboxStorage(
    options.sandboxStorage ??
      (persisted && !options.storage ? detectSessionStorage() : createMemoryStorage()),
  );
  let sandboxed = persisted && sandbox.isMarked();
  /** The real game as it was in memory when a sandbox began, for a save that never reached storage. */
  let parked: { game: GameState; lastWritten: GameState | null; saveFailed: boolean } | null = null;
  // Everything below reads and writes through this, so one switch moves the whole game.
  const kv: KeyValueStorage = {
    getItem: (key) => (sandboxed ? sandbox.view : real).getItem(key),
    setItem: (key, value) => (sandboxed ? sandbox.view : real).setItem(key, value),
    removeItem: (key) => (sandboxed ? sandbox.view : real).removeItem(key),
    keys: () => (sandboxed ? sandbox.view : real).keys(),
  };

  const persistStorage: PersistStorage<GameState> = {
    getItem(name): StorageValue<GameState> | null {
      let raw: string | null;
      try {
        raw = kv.getItem(name);
      } catch {
        return null;
      }
      if (raw === null) return null;
      const loaded = parseStoredGame(raw);
      if (!loaded.ok) {
        // Never a silent wipe: the unreadable save is set aside before anything overwrites it.
        const savedAt = clock.now();
        keepForRecovery(kv, { savedAt, reason: loaded.reason, detail: loaded.detail, raw });
        recovery = { reason: loaded.reason, detail: loaded.detail, savedAt };
        return null;
      }
      lastWritten = loaded.migratedFrom === null ? loaded.state : null;
      return { state: loaded.state, version: SCHEMA_VERSION };
    },
    setItem(name, value): void {
      // Runtime-only updates (the clock) must not rewrite an unchanged save.
      if (value.state === lastWritten) return;
      const failedBefore = saveFailed;
      try {
        kv.setItem(name, JSON.stringify({ state: value.state, version: SCHEMA_VERSION }));
        lastWritten = value.state;
        saveFailed = false;
      } catch (error) {
        saveFailed = true;
        if (!isQuotaError(error)) console.warn('[game] could not save', error);
      }
      // This runs inside a set; the flag reaches the runtime right after it.
      if (saveFailed !== failedBefore) queueMicrotask(syncRuntime);
    },
    removeItem(name): void {
      try {
        kv.removeItem(name);
      } catch {
        // Nothing stored, nothing to remove.
      }
    },
  };

  const initial = (): GameStoreState => ({
    game: createInitialState(clock.now()),
    runtime: {
      now: clock.now(),
      hydrated: false,
      storage: detected.mode,
      saveFailed: false,
      recovery: null,
      legacy: null,
      sandbox: false,
    },
  });

  const store: GameStore = persisted
    ? createStore<GameStoreState>()(
        persist(initial, {
          name: STORAGE_KEYS.game,
          version: SCHEMA_VERSION,
          storage: persistStorage,
          partialize: (state) => state.game,
          merge: (saved, current) => (saved ? { ...current, game: saved as GameState } : current),
          // On the server there is nothing to read; the browser hydrates synchronously below.
          skipHydration: true,
        }),
      )
    : createStore<GameStoreState>()(initial);

  function syncRuntime(): void {
    const runtime = store.getState().runtime;
    if (
      runtime.hydrated &&
      runtime.saveFailed === saveFailed &&
      runtime.recovery === recovery &&
      runtime.sandbox === sandboxed
    )
      return;
    store.setState({
      runtime: { ...runtime, hydrated: true, saveFailed, recovery, sandbox: sandboxed },
    });
  }

  const readSaved = () =>
    persistStorage.getItem(STORAGE_KEYS.game) as StorageValue<GameState> | null;

  const rehydrate = () => {
    const failuresBefore = recovery;
    const stored = readSaved();
    if (stored) {
      if (stored.state !== store.getState().game) store.setState({ game: stored.state });
    } else if (recovery === failuresBefore) {
      // The key is gone (reset in another tab, cleared site data): this tab starts blank too.
      lastWritten = null;
      store.setState({ game: createInitialState(clock.now()) });
    }
    syncRuntime();
  };

  if (!persisted) {
    syncRuntime();
  } else if (isBrowser || options.storage) {
    let stored = readSaved();
    if (sandboxed && (!stored || !isOnboarded(stored.state))) {
      // The tab says "sandbox" but there is no world to show: forget it and open the real save.
      sandbox.clear();
      sandboxed = false;
      recovery = null;
      lastWritten = null;
      stored = readSaved();
    }
    // A blank state is not a save: nothing is written until the game actually changes,
    // which also leaves an unreadable save in place until the user has decided.
    if (stored) store.setState({ game: stored.state });
    else lastWritten = store.getState().game;
    syncRuntime();
  }

  function enterSandbox(state: GameState): void {
    if (!persisted) return;
    const current = store.getState();
    if (!sandboxed) parked = { game: current.game, lastWritten, saveFailed };
    sandbox.clear();
    sandbox.mark();
    sandboxed = true;
    lastWritten = null;
    saveFailed = false;
    recovery = null;
    store.setState({
      game: state,
      runtime: { ...current.runtime, saveFailed, recovery, legacy: null, sandbox: true },
    });
    actions.tick();
  }

  function leaveSandbox(): void {
    if (!sandboxed) return;
    const held = parked;
    parked = null;
    sandbox.clear();
    sandboxed = false;
    recovery = null;
    saveFailed = false;
    lastWritten = null;
    const stored = readSaved();
    let next: GameState;
    if (held?.saveFailed) {
      // The real game had outgrown its save (a full quota): what was in memory is the truth.
      next = held.game;
      lastWritten = held.lastWritten;
      saveFailed = true;
    } else if (stored) {
      next = stored.state;
    } else {
      // Nothing was ever planted: back to exactly that, without writing a blank save.
      next = createInitialState(clock.now());
      lastWritten = next;
    }
    store.setState({
      game: next,
      runtime: { ...store.getState().runtime, saveFailed, recovery, legacy: null, sandbox: false },
    });
    actions.tick();
  }

  const actions = createActions(store, kv, clock, options.seed ?? randomSeed, bus, {
    isOn: () => sandboxed,
    leave: leaveSandbox,
  });
  return {
    store,
    actions,
    now: () => clock.now(),
    setClock: (next) => {
      clock.now = next;
    },
    rehydrate,
    storage: kv,
    enterSandbox,
    leaveSandbox,
  };
}

/** The app's game. */
export const game: Game = createGame();
export const gameStore: GameStore = game.store;
/** Every action the UI needs. Stable references: safe to use in effects and handlers. */
export const gameActions: GameActions = game.actions;

/** The current persisted state, outside React. */
export function getGameState(): GameState {
  return gameStore.getState().game;
}

export interface ClockHandle {
  stop: () => void;
}

/**
 * Keeps the game in step with real time while the app is open: a tick now, one every
 * minute (the sky), one just after local midnight (the day rolls over without a
 * reload), one whenever the tab becomes visible again, and a re-read when another tab
 * saves. Call once from the shell; returns a handle that removes every listener.
 */
export function startGameClock(target: Game = game, intervalMs = 60_000): ClockHandle {
  if (typeof window === 'undefined') return { stop: () => undefined };
  const { actions } = target;
  let midnight: ReturnType<typeof setTimeout> | undefined;

  const scheduleMidnight = () => {
    if (midnight !== undefined) clearTimeout(midnight);
    // One second past midnight, so the new day has certainly begun.
    midnight = setTimeout(
      () => {
        actions.tick();
        scheduleMidnight();
      },
      msUntilTomorrow(target.now()) + 1000,
    );
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      actions.tick();
      scheduleMidnight();
    }
  };
  const onStorage = (event: StorageEvent) => {
    // A sandbox does not follow other tabs: the real save is re-read when it ends.
    if (target.store.getState().runtime.sandbox) return;
    if (event.key === STORAGE_KEYS.game || event.key === null) target.rehydrate();
  };

  actions.tick();
  scheduleMidnight();
  const interval = setInterval(() => actions.tick(), intervalMs);
  // The QA helper is loaded on demand, and only where development code is allowed.
  if (IS_DEV) void import('./dev').then((module) => module.installGameDevTools(target));
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('pageshow', onVisible);
  window.addEventListener('storage', onStorage);

  return {
    stop() {
      if (midnight !== undefined) clearTimeout(midnight);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('storage', onStorage);
    },
  };
}
