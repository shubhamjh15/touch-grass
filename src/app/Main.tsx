'use client';

import { createContext, use, type ComponentProps, type Ref } from 'react';
import { cn } from '@/lib/cn';

const InsideMain = createContext(false);

/**
 * The page's `<main id="main">`: the skip link's target and where route focus lands. Every
 * layout wraps its page in one, so pages never render their own `<main>`. Nested use (a
 * shell inside a shell, as on the 404) quietly becomes a `<div>`: a document has one main.
 */
export function Main({ className, children, ref, ...rest }: ComponentProps<'main'>) {
  const nested = use(InsideMain);
  if (nested) {
    return (
      <div className={className} {...rest} ref={ref as Ref<HTMLDivElement> | undefined}>
        {children}
      </div>
    );
  }
  return (
    <InsideMain value>
      <main id="main" tabIndex={-1} ref={ref} className={cn('outline-hidden', className)} {...rest}>
        {children}
      </main>
    </InsideMain>
  );
}
