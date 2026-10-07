import { useSyncExternalStore } from 'react';
import type { WorldMotion } from '@/world/contract';

/**
 * The few facts about the saved game that the outermost shell needs on every route: has the save
 * been read, is there a tree, and how much motion the person wants. The game itself (rules,
 * catalogue, lessons) is a large download that public pages must not wait for, so the root
 * layout reads these from here and `connectGame` fills them in once the game has loaded.
 *
 * This module must stay free of imports from `@/game`.
 */
export interface BootState {
  /** The saved state has been read. False on the server and until the game has loaded. */
  hydrated: boolean;
  onboarded: boolean;
  motion: WorldMotion;
  /** The spoken description of the person's own grove, for a stage shown outside the app. */
  sceneLabel: string | null;
}

const INITIAL: BootState = {
  hydrated: false,
  onboarded: false,
  motion: 'system',
  sceneLabel: null,
};

let state: BootState = INITIAL;
const listeners = new Set<() => void>();
const resetListeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBoot(): BootState {
  return state;
}

/** Called by the game's connection whenever one of the facts changes. */
export function setBoot(next: BootState): void {
  if (
    next.hydrated === state.hydrated &&
    next.onboarded === state.onboarded &&
    next.motion === state.motion &&
    next.sceneLabel === state.sceneLabel
  ) {
    return;
  }
  state = next;
  for (const listener of [...listeners]) listener();
}

/** The person erased everything on this device. */
export function emitBootReset(): void {
  for (const listener of [...resetListeners]) listener();
}

export function onBootReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

function useBoot<T>(read: (boot: BootState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => read(state),
    () => read(INITIAL),
  );
}

const readHydrated = (boot: BootState) => boot.hydrated;
const readOnboarded = (boot: BootState) => boot.onboarded;
const readMotion = (boot: BootState) => boot.motion;
const readSceneLabel = (boot: BootState) => boot.sceneLabel;

/** False on the server, on the first paint, and until the game has loaded and read the save. */
export const useBootHydrated = (): boolean => useBoot(readHydrated);
export const useBootOnboarded = (): boolean => useBoot(readOnboarded);
export const useBootMotion = (): WorldMotion => useBoot(readMotion);
export const useBootSceneLabel = (): string | null => useBoot(readSceneLabel);
