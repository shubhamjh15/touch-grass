'use client';

import { useEffect } from 'react';
import { toastLater } from '@/ui';

const UPDATE_TOAST_ID = 'service-worker-update';
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the offline service worker (production builds only: in development a worker would
 * serve stale files) and, when a newer build is waiting, asks before switching to it.
 *
 * The switch reloads the page, so it only happens when the person taps "Reload": they may be
 * halfway through logging something. Saved data lives on the device and is untouched either way.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return undefined;
    const container = navigator.serviceWorker;
    // Only a swap of one worker for another reloads the page; the first install must not.
    let hadController = container.controller !== null;
    let reloading = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const offerUpdate = (waiting: ServiceWorker) => {
      toastLater({
        id: UPDATE_TOAST_ID,
        title: 'A new version is ready',
        meta: 'Reload to get it. Your tree and logs stay on this device.',
        tone: 'info',
        duration: Number.POSITIVE_INFINITY,
        action: { label: 'Reload', onClick: () => waiting.postMessage({ type: 'SKIP_WAITING' }) },
      });
    };

    const watch = (next: ServiceWorkerRegistration) => {
      if (next.waiting && container.controller) offerUpdate(next.waiting);
      next.addEventListener('updatefound', () => {
        const installing = next.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && container.controller) offerUpdate(installing);
        });
      });
    };

    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => undefined);
    };

    container.addEventListener('controllerchange', onControllerChange);
    container
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registered) => {
        registration = registered;
        watch(registered);
      })
      .catch(() => undefined);
    document.addEventListener('visibilitychange', checkForUpdate);
    const timer = window.setInterval(checkForUpdate, UPDATE_CHECK_MS);

    return () => {
      container.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
