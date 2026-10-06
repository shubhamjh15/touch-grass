'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { SkipLink } from '@/ui';
import { WorldBridge } from '../bridge/WorldBridge';
import { Feedback } from '../feedback/Feedback';
import { Guard } from '../Guard';
import { Main } from '../Main';
import { RouteEffects } from '../RouteEffects';
import { routeInfo } from '../routes';
import { ShellProviders } from '../ShellProviders';

// The world probes WebGL and measures the page, so it only ever runs in the browser.
const WorldCanvas = dynamic(() => import('@/world').then((world) => world.WorldCanvas), {
  ssr: false,
});

/** Routes without a layout of their own (onboarding, workbenches) still get the page's `<main>`. */
function RootFrame({ children }: { children: ReactNode }) {
  const { shell, id } = routeInfo(usePathname() ?? '/');
  // The 404 brings its own chrome (and its own main) through `NotFoundShell`.
  const needsMain = shell === 'onboarding' || (shell === 'bare' && id !== 'unknown');
  return needsMain ? <Main>{children}</Main> : <>{children}</>;
}

/**
 * The one layout that never unmounts. It owns the providers, the persistent 3D world and its
 * bridge to the game, the route guard, the feedback for game events (toasts with Undo, sounds,
 * celebrations) and the global overlays; every page renders above the
 * world and reserves space for it with `<WorldStage>`.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ShellProviders>
      <SkipLink targetId="main" />
      <WorldCanvas />
      <WorldBridge />
      <RouteEffects />
      <Feedback />
      <div className="relative z-10">
        <Guard>
          <RootFrame>{children}</RootFrame>
        </Guard>
      </div>
    </ShellProviders>
  );
}
