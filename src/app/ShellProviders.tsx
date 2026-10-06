'use client';

import { MotionConfig } from 'framer-motion';
import NextLink from 'next/link';
import { useEffect, type ReactNode } from 'react';
import {
  gameActions,
  useGameClock,
  useGameHydrated,
  useIsOnboarded,
  useSettings,
  useTouchGrassTracker,
} from '@/game';
import { installAudioUnlock } from '@/lib/sfx';
import { Toaster, UiLinkProvider, type UiLinkProps } from '@/ui';

/** Lets every `href` in the UI kit navigate client-side: the kit itself may not import the router. */
function RouterLink({ href, ...rest }: UiLinkProps) {
  // Other origins, downloads and mail links are ordinary anchors.
  if (!href.startsWith('/') || href.startsWith('//')) return <a href={href} {...rest} />;
  return <NextLink href={href} {...rest} />;
}

const REDUCED_MOTION = { system: 'user', reduced: 'always', full: 'never' } as const;

/** Things that must run exactly once for the whole app, whatever route is showing. */
function GameRuntime() {
  useGameClock();
  useTouchGrassTracker();

  const hydrated = useGameHydrated();
  const onboarded = useIsOnboarded();
  useEffect(() => {
    // First launch only: look for data from the old app, so onboarding can offer to bring it along.
    if (hydrated && !onboarded) gameActions.scanLegacy();
  }, [hydrated, onboarded]);

  useEffect(() => installAudioUnlock(), []);

  return null;
}

/**
 * App-wide providers: client-side links for the UI kit, Framer Motion following the Motion
 * setting, the toast outlet, and the game's clock.
 */
export function ShellProviders({ children }: { children: ReactNode }) {
  const { motion } = useSettings();
  return (
    <UiLinkProvider component={RouterLink}>
      <MotionConfig reducedMotion={REDUCED_MOTION[motion]}>
        <GameRuntime />
        {children}
        <Toaster />
      </MotionConfig>
    </UiLinkProvider>
  );
}
