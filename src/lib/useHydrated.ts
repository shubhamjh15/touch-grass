'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False on the server and while the page hydrates, true afterwards. Server-rendered
 * pages use it to show anything that depends on saved state only once the browser
 * has it, so the first paint always matches the server's HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
