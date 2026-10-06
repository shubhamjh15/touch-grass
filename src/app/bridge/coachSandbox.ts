import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { useCoachStore } from '@/ai';
import { SANDBOX_PREFIX, gameStore } from '@/game';

/**
 * Keeps the coach's chat out of the real history while the game shows a sandbox (the demo
 * world). The game moves its own save into the tab's session storage; the conversation with
 * Moss is saved by the AI module, so this is where it follows: while a sandbox is on, the
 * chat is read from and written to the same session-only namespace, and the moment it ends
 * the real conversation is read back, untouched.
 */

/** Session storage that never throws, with memory behind it when the browser refuses. */
function sessionArea(): StateStorage {
  const memory = new Map<string, string>();
  const area = (): Storage | null => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    getItem(name) {
      try {
        return area()?.getItem(name) ?? memory.get(name) ?? null;
      } catch {
        return memory.get(name) ?? null;
      }
    },
    setItem(name, value) {
      memory.set(name, value);
      try {
        area()?.setItem(name, value);
      } catch {
        // A full or blocked session storage: the chat still works until the tab reloads.
      }
    },
    removeItem(name) {
      memory.delete(name);
      try {
        area()?.removeItem(name);
      } catch {
        // Nothing stored, nothing to remove.
      }
    },
  };
}

type CoachPersistOptions = ReturnType<typeof useCoachStore.persist.getOptions>;

let real: Pick<CoachPersistOptions, 'name' | 'storage'> | null = null;

function follow(sandbox: boolean): void {
  const persist = useCoachStore.persist;
  if (sandbox === (real !== null)) return;
  if (sandbox) {
    const { name, storage } = persist.getOptions();
    real = { name, storage };
    persist.setOptions({
      name: `${SANDBOX_PREFIX}${name ?? ''}`,
      storage: createJSONStorage(sessionArea),
    });
  } else if (real) {
    persist.setOptions(real);
    real = null;
  }
  // Re-reading replaces what is in memory with what the new place holds (nothing, for a
  // fresh sandbox) and writes nothing, so neither conversation can leak into the other.
  void persist.rehydrate();
}

let installed = false;

/** Call once, in the browser, before anything renders the conversation. */
export function installCoachSandbox(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  follow(gameStore.getState().runtime.sandbox);
  gameStore.subscribe((state, previous) => {
    if (state.runtime.sandbox !== previous.runtime.sandbox) follow(state.runtime.sandbox);
  });
}

installCoachSandbox();
