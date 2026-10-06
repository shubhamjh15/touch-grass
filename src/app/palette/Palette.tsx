'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useShellStore } from '../shellStore';

// cmdk and the catalogue search stay out of the first load: the chunk arrives on first open.
const CommandMenu = dynamic(() => import('./CommandMenu'), { ssr: false });

/**
 * The command palette and its one shortcut, Ctrl or Cmd + K. It has no button anywhere: it is
 * a fast lane for people who look for it, and the app is complete without it.
 */
export function Palette() {
  const open = useShellStore((state) => state.paletteOpen);
  // Once opened it stays mounted, so reopening is instant.
  const [loaded, setLoaded] = useState(false);
  if (open && !loaded) setLoaded(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      const shell = useShellStore.getState();
      shell.setPaletteOpen(!shell.paletteOpen);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return loaded ? <CommandMenu /> : null;
}
