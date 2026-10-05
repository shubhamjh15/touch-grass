'use client';

import type { ReactNode } from 'react';

/** Shell for public pages: landing, methodology, privacy. */
export function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
