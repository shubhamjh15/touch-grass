'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** A key cap. Arrow keys take a lucide icon as children, never an arrow character. */
export function Kbd({ className, ...rest }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-xs border border-ink-4 bg-white px-1.5 font-sans text-body-sm leading-none font-medium text-ink-2',
        className,
      )}
      {...rest}
    />
  );
}
