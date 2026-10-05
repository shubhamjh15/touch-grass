'use client';

import type { ReactNode } from 'react';

/** Shell for the signed-in product: navigation, HUD and the page. */
export function AppLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
