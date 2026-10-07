'use client';

import { MotionConfig } from 'framer-motion';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { UiLinkProvider, type UiLinkProps } from '@/ui';
import { useBootMotion } from './boot/bootStore';

/** Lets every `href` in the UI kit navigate client-side: the kit itself may not import the router. */
function RouterLink({ href, ...rest }: UiLinkProps) {
  // Other origins, downloads and mail links are ordinary anchors.
  if (!href.startsWith('/') || href.startsWith('//')) return <a href={href} {...rest} />;
  return <NextLink href={href} {...rest} />;
}

const REDUCED_MOTION = { system: 'user', reduced: 'always', full: 'never' } as const;

/**
 * App-wide providers: client-side links for the UI kit, and Framer Motion following the Motion
 * setting. Nothing here may import the game: this wraps every route, public ones included (the
 * game's own runtime is `GameShell`).
 */
export function ShellProviders({ children }: { children: ReactNode }) {
  const motion = useBootMotion();
  return (
    <UiLinkProvider component={RouterLink}>
      <MotionConfig reducedMotion={REDUCED_MOTION[motion]}>{children}</MotionConfig>
    </UiLinkProvider>
  );
}
