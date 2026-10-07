'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/game/keys';
import { SkipLink } from '@/ui';
import { Guard } from '../Guard';
import { Main } from '../Main';
import { ServiceWorker } from '../pwa/ServiceWorker';
import { RouteEffects } from '../RouteEffects';
import { routeInfo } from '../routes';
import { ShellProviders } from '../ShellProviders';

// The error page and the 404 are part of every route, exactly like this layout, and the three
// share most of what they use from the UI kit. Next bundles each of them as its own group; built
// apart, each carried its own copy of those shared pieces (and so did the game's runtime chunk).
// Handing them out from here puts the three in one group, with one copy.
export { RouteError } from '../RouteError';
export { default as NotFoundPage } from '@/features/system/NotFoundPage';

// The world probes WebGL and measures the page, so it only ever runs in the browser.
const WorldCanvas = dynamic(() => import('@/world').then((world) => world.WorldCanvas), {
  ssr: false,
});

// The game's runtime: the rules engine, its catalogue, the feedback layer and the toast outlet.
const GameShell = dynamic(() => import('../runtime/GameShell').then((shell) => shell.GameShell), {
  ssr: false,
});

/** A public page that works without the game: it paints first and fetches the game afterwards. */
function isPublicPath(pathname: string): boolean {
  const { shell, id } = routeInfo(pathname);
  return shell === 'marketing' || id === 'unknown';
}

// Inside the app the game is needed before anything can be shown: start fetching it while React
// is still hydrating, instead of after.
if (typeof window !== 'undefined' && !isPublicPath(window.location.pathname)) {
  void import('../runtime/GameShell');
}

/** How long a public page may stay busy before the game is fetched regardless. */
const IDLE_PATIENCE_MS = 1500;

function savedGameExists(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.game) !== null;
  } catch {
    return false;
  }
}

/**
 * Mounts the game's runtime: at once inside the app, and on a public page once it has painted
 * and the browser has a moment. Someone who already has a tree is about to be sent into the app
 * (or shown "Open the app"), so for them it is fetched straight away. It never unmounts.
 */
function GameShellSlot() {
  const eager = !isPublicPath(usePathname() ?? '/');
  const [wanted, setWanted] = useState(false);
  if (eager && !wanted) setWanted(true);

  useEffect(() => {
    if (wanted) return undefined;
    if (savedGameExists()) {
      setWanted(true);
      return undefined;
    }
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(() => setWanted(true), {
        timeout: IDLE_PATIENCE_MS,
      });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(() => setWanted(true), 300);
    return () => window.clearTimeout(timer);
  }, [wanted]);

  return wanted ? <GameShell /> : null;
}

/** Routes without a layout of their own (onboarding, workbenches) still get the page's `<main>`. */
function RootFrame({ children }: { children: ReactNode }) {
  const { shell, id } = routeInfo(usePathname() ?? '/');
  // The 404 brings its own chrome (and its own main) through `NotFoundShell`.
  const needsMain = shell === 'onboarding' || (shell === 'bare' && id !== 'unknown');
  return needsMain ? <Main>{children}</Main> : <>{children}</>;
}

/**
 * The one layout that never unmounts. It owns the providers, the persistent 3D world, the route
 * guard and the slot for the game's runtime (clock, bridge to the world, feedback for game
 * events, toasts); every page renders above the world and reserves space for it with
 * `<WorldStage>`.
 *
 * Every route pays for what this file imports, the public ones included, so the game stays out
 * of it: what the guard and the providers need to know arrives through `boot/bootStore`.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ShellProviders>
      <SkipLink targetId="main" />
      <WorldCanvas />
      <GameShellSlot />
      <RouteEffects />
      <ServiceWorker />
      <div className="relative z-10">
        <Guard>
          <RootFrame>{children}</RootFrame>
        </Guard>
      </div>
    </ShellProviders>
  );
}
