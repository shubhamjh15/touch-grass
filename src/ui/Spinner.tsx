'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type SpinnerProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** Pixel size of the ring. */
  size?: 16 | 20 | 24 | 32;
  /** Accessible name. Pass an empty string when a neighbour already says what is loading. */
  label?: string;
};

/**
 * The one loading indicator: a ring that turns on the compositor. Show it only while something is
 * really loading; it stands still under reduced motion.
 */
export function Spinner({ size = 20, label = 'Loading', className, ...rest }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-grid shrink-0 place-items-center text-ink', className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        aria-hidden="true"
        focusable="false"
        className="animate-spin"
      >
        <circle cx={12} cy={12} r={9} stroke="currentColor" strokeOpacity={0.2} strokeWidth={3} />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
