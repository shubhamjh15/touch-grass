'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { game, gameActions } from '@/game';

/**
 * One shared one-second pulse for every countdown on the page. Components read a *derived*
 * value through `useClock`, so React re-renders them only when what they show changes: a
 * heading that prints minutes re-renders once a minute, not sixty times.
 */
const listeners = new Set<() => void>();
let timer: number | null = null;

const emit = () => {
  for (const listener of [...listeners]) listener();
};

// A background tab throttles timers; catch up the moment the page is looked at again.
const onVisible = () => {
  if (document.visibilityState === 'visible') emit();
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    timer = window.setInterval(emit, 1000);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      timer = null;
    }
  };
}

/**
 * A value derived from the game's clock, re-read every second. `read` must return a
 * primitive (a label, a flag, a rounded number) so unchanged values do not re-render.
 */
export function useClock<T extends string | number | boolean>(read: (now: number) => T): T {
  const snapshot = () => read(game.now());
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** How long after the reset moment the page asks the game to settle (the shell's clock is usually first). */
const SETTLE_DELAY_MS = 400;
/** Browsers clamp long timers; re-arm well inside the limit. */
const MAX_TIMER_MS = 6 * 60 * 60 * 1000;

/**
 * Makes sure the board rotates the moment its period ends, even if nothing else ticks the
 * game: at `resetsAt` the calendar is settled, which claims finished quests and draws the
 * new ones. Settling twice is harmless.
 */
export function useSettleAt(resetsAt: number): void {
  useEffect(() => {
    let handle: number;
    const arm = () => {
      const wait = resetsAt - game.now() + SETTLE_DELAY_MS;
      handle = window.setTimeout(
        () => {
          if (game.now() >= resetsAt) gameActions.tick();
          else arm();
        },
        Math.min(Math.max(wait, SETTLE_DELAY_MS), MAX_TIMER_MS),
      );
    };
    arm();
    return () => window.clearTimeout(handle);
  }, [resetsAt]);
}
