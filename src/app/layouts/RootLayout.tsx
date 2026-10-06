'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useGameHydrated, useSettings } from '@/game';
import { SkipLink } from '@/ui';
import { WorldBridge } from '../bridge/WorldBridge';
import { Feedback } from '../feedback/Feedback';
import { Guard } from '../Guard';
import { Main } from '../Main';
import { RouteEffects } from '../RouteEffects';
import { routeInfo } from '../routes';
import { ShellProviders } from '../ShellProviders';

// The WebGL canvas and everything behind it. Only fetched when the 3D preview is switched on.
const WorldCanvas = dynamic(() => import('@/world').then((world) => world.WorldCanvas), {
  ssr: false,
});

/**
 * The 3D preview is opt-in. While it is off (the default) nothing of it is mounted: no canvas,
 * no WebGL context, no per-frame work. Every stage then draws the illustrated tree itself.
 */
function ThreePreview() {
  const hydrated = useGameHydrated();
  const { graphics } = useSettings();
  return hydrated && graphics !== 'off' ? <WorldCanvas /> : null;
}

/** Routes without a layout of their own (onboarding, workbenches) still get the page's `<main>`. */
function RootFrame({ children }: { children: ReactNode }) {
  const { shell, id } = routeInfo(usePathname() ?? '/');
  // The 404 brings its own chrome, and its own main.
  const needsMain = shell === 'onboarding' || (shell === 'bare' && id !== 'unknown');
  return needsMain ? <Main>{children}</Main> : <>{children}</>;
}

/**
 * The one layout that never unmounts. It owns the providers, the bridge from the game to the
 * tree, the route guard, and the feedback that game events produce on any screen.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ShellProviders>
      <SkipLink targetId="main" />
      <ThreePreview />
      <WorldBridge />
      <RouteEffects />
      <Feedback />
      <div className="relative z-(--z-content)">
        <Guard>
          <RootFrame>{children}</RootFrame>
        </Guard>
      </div>
    </ShellProviders>
  );
}
