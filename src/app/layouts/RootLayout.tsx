'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

// The world probes WebGL and measures the page, so it only ever runs in the browser.
const WorldCanvas = dynamic(() => import('@/world').then((world) => world.WorldCanvas), {
  ssr: false,
});

/**
 * The one layout that never unmounts. It owns the persistent 3D world; every
 * page renders above it and reserves space for it with `<WorldStage>`.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorldCanvas />
      <div className="relative z-10">{children}</div>
    </>
  );
}
