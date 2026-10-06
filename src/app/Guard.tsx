'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useGameEvent, useGameHydrated, useIsOnboarded } from '@/game';
import { Splash } from './boot/Splash';
import { useFontsReady } from './boot/useFontsReady';
import { decideGuard, readPendingDestination, writePendingDestination } from './guardDecision';
import { routeInfo } from './routes';

/** How long the splash takes to peel away (`--dur-fast`, plus a frame). */
const SPLASH_EXIT_MS = 160;

/** The splash, with a short exit so the first screen is stuck on rather than popped in. */
function BootSplash({ show }: { show: boolean }) {
  const [gone, setGone] = useState(false);
  // A later redirect brings it back: start over.
  if (show && gone) setGone(false);

  useEffect(() => {
    if (show || gone) return undefined;
    const timer = window.setTimeout(() => setGone(true), SPLASH_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [show, gone]);

  if (!show && gone) return null;
  return <Splash leaving={!show} />;
}

/**
 * Decides who may see the current route, from the saved state on this device, and sends
 * everyone else where they belong. Until that is known it shows the splash, so a page that
 * is about to be replaced never flashes.
 */
export function Guard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const hydrated = useGameHydrated();
  const onboarded = useIsOnboarded();
  const fontsReady = useFontsReady();
  const info = routeInfo(pathname);

  // What was true when the user arrived on this path. Onboarding finishes while `/start` is
  // still showing its last steps, so `/start` only redirects people who arrive with a tree.
  const [arrival, setArrival] = useState<{ path: string; onboarded: boolean } | null>(null);
  if (hydrated && arrival?.path !== pathname) setArrival({ path: pathname, onboarded });

  const [justReset, setJustReset] = useState(false);
  useGameEvent('state-reset', () => setJustReset(true));
  if (justReset && info.shell !== 'app') setJustReset(false);

  const arrivedOnboarded = arrival?.path === pathname ? arrival.onboarded : onboarded;
  const decision = decideGuard({
    pathname,
    search: hydrated ? window.location.search : '',
    hash: hydrated ? window.location.hash : '',
    hydrated,
    onboarded: info.shell === 'onboarding' ? arrivedOnboarded : onboarded,
    pending: hydrated && info.shell === 'onboarding' ? readPendingDestination() : null,
    justReset,
  });

  const target = decision.kind === 'redirect' ? decision.to : null;
  const remember = decision.kind === 'redirect' ? decision.remember : undefined;
  useEffect(() => {
    if (target === null) return;
    if (remember) writePendingDestination(remember);
    router.replace(target);
  }, [target, remember, router, pathname]);

  // Arrived inside the app with a tree: whatever was remembered has served its purpose.
  const settled = hydrated && onboarded && info.shell === 'app';
  useEffect(() => {
    if (settled) writePendingDestination(null);
  }, [settled, pathname]);

  // App screens are set in three fonts; public pages are server-rendered and never wait.
  const needsFonts = info.shell === 'app' || info.shell === 'onboarding';
  const blocked = decision.kind !== 'allow' || (needsFonts && !fontsReady);

  return (
    <>
      {decision.kind === 'allow' ? children : null}
      <BootSplash show={blocked} />
    </>
  );
}
