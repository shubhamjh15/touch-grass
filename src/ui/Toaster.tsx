'use client';

import { useEffect, useId, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Toaster as SonnerToaster } from 'sonner';
import { useBreakpoint } from '@/lib/hooks';
import { markToastOutletReady } from './toastOutlet';

// Every mounted <Toaster/>, oldest first. Only the first one renders, so a page that mounts its
// own outlet next to the shell's never prints each toast twice.
let mounted: string[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setMounted(next: string[]): void {
  mounted = next;
  for (const listener of listeners) listener();
}

/** Rendered after the outlet, so its effect runs once the outlet has started listening. */
function OutletReady() {
  useEffect(() => markToastOutletReady(), []);
  return null;
}

/**
 * The toast outlet. Mount once in the shell. Mobile: top-centre under the safe area, never over the
 * Log sticker or the keyboard. Desktop: bottom-right, 24 px in. At most three are visible.
 *
 * It renders into `document.body`, so toasts sit on the global z-scale (above modals and their
 * scrim) wherever the shell happens to mount it.
 */
export function Toaster() {
  const id = useId();
  const desktop = useBreakpoint('lg');
  const primary = useSyncExternalStore(
    subscribe,
    () => mounted[0] ?? null,
    () => null,
  );

  useEffect(() => {
    setMounted([...mounted, id]);
    return () => setMounted(mounted.filter((entry) => entry !== id));
  }, [id]);

  if (primary !== id) return null;

  return createPortal(
    <>
      <SonnerToaster
        position={desktop ? 'bottom-right' : 'top-center'}
        visibleToasts={3}
        gap={8}
        offset={24}
        mobileOffset={{ top: 'calc(var(--safe-t) + 12px)', left: 12, right: 12 }}
        containerAriaLabel="Notifications"
        toastOptions={{ unstyled: true }}
        style={{ zIndex: 'var(--z-toast)' } as CSSProperties}
      />
      <OutletReady />
    </>,
    document.body,
  );
}
