'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Toaster as SonnerToaster } from 'sonner';
import { useBreakpoint } from '@/lib/hooks';

const noop = () => () => undefined;

/**
 * The toast outlet. Mount once in the shell. Mobile: top-centre under the safe area, never over the
 * Log sticker or the keyboard. Desktop: bottom-right, 24 px in. At most three are visible.
 *
 * It renders into `document.body`, so toasts sit on the global z-scale (above modals and their
 * scrim) wherever the shell happens to mount it.
 */
export function Toaster() {
  const desktop = useBreakpoint('lg');
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  return createPortal(
    <SonnerToaster
      position={desktop ? 'bottom-right' : 'top-center'}
      visibleToasts={3}
      gap={8}
      offset={24}
      mobileOffset={{ top: 'calc(var(--safe-t) + 12px)', left: 12, right: 12 }}
      containerAriaLabel="Notifications"
      toastOptions={{ unstyled: true }}
      style={{ zIndex: 'var(--z-toast)' } as CSSProperties}
    />,
    document.body,
  );
}
