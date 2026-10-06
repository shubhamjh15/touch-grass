'use client';

import { useCallback, useEffect, useState } from 'react';

/** The install prompt the browser hands over; it is not in the DOM typings yet. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState = 'unavailable' | 'ready' | 'installed';

function standalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/**
 * Whether this browser will offer to install the app, and the way to ask. Browsers that never fire
 * `beforeinstallprompt` (Safari, Firefox) stay `unavailable` and the page shows nothing for it.
 */
export function useInstallPrompt(): { state: InstallState; install: () => Promise<void> } {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(standalone);

  useEffect(() => {
    const onPrompt = (next: Event) => {
      next.preventDefault();
      setEvent(next as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setEvent(null);
  }, [event]);

  return { state: installed ? 'installed' : event ? 'ready' : 'unavailable', install };
}
