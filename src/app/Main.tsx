'use client';

import { createContext, use, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const InsideMain = createContext(false);

/**
 * The page's `<main id="main">`: the skip link's target and where route focus lands. Every
 * layout wraps its page in one, so pages never render their own `<main>`. Nested use (a
 * shell inside a shell, as on the 404) quietly becomes a `<div>`: a document has one main.
 */
export function Main({ className, children }: { className?: string; children: ReactNode }) {
  const nested = use(InsideMain);
  if (nested) return <div className={className}>{children}</div>;
  return (
    <InsideMain value>
      <main id="main" tabIndex={-1} className={cn('outline-hidden', className)}>
        {children}
      </main>
    </InsideMain>
  );
}
