'use client';

import { useEffect } from 'react';
import { useShellStore } from '../shellStore';

/**
 * Asks the shell to put its navigation away while something needs the whole screen: the break
 * timer, a ceremony. The top bar, app bar, tab bar and Log sticker return when the caller
 * unmounts or passes `false`. Several callers may ask at once.
 */
export function useHideChrome(active = true): void {
  useEffect(() => {
    if (!active) return undefined;
    return useShellStore.getState().hideChrome();
  }, [active]);
}
