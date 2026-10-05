'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** A key cap. Arrow keys take a lucide icon as children, never an arrow character. */
export function Kbd({ className, ...rest }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-sm border-2 border-ink bg-white px-1.5 font-mono text-[0.6875rem] leading-none font-semibold text-ink shadow-key',
        className,
      )}
      {...rest}
    />
  );
}
