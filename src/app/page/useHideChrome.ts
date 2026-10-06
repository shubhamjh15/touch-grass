'use client';

import { useEffect } from 'react';
import { useShellStore } from '../shellStore';

/**
 * Asks the shell to put its navigation away while something needs the whole screen (the break
 * timer). The top bar, the tab bar and the Ask Moss button return when the caller unmounts or
 * passes `false`. Several callers may ask at once.
 */
export function useHideChrome(active = true): void {
  useEffect(() => {
    if (!active) return undefined;
    return useShellStore.getState().hideChrome();
  }, [active]);
}
