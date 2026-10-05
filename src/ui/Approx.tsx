'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type ApproxProps = Omit<ComponentProps<'svg'>, 'children'> & {
  /** Use `mono` next to Martian Mono figures: a slightly lighter stroke. */
  weight?: 'display' | 'mono';
  /** Set false when a neighbouring element already says "approximately". */
  spoken?: boolean;
};

/**
 * The drawn "≈". Never typed: the glyph is missing from the self-hosted font subsets and would fall
 * back to a system font. It takes the colour of the figure it precedes and sits immediately before it.
 */
export function Approx({ weight = 'display', spoken = true, className, ...rest }: ApproxProps) {
  return (
    <>
      <svg
        viewBox="0 0 20 14"
        aria-hidden="true"
        focusable="false"
        className={cn(
          'mr-[0.08em] inline-block h-[0.44em] w-[0.62em] overflow-visible align-[0.16em]',
          className,
        )}
        {...rest}
      >
        <path
          d="M2 4.2c2.6-3 5.3-3 8 0s5.4 3 8 0M2 10.8c2.6-3 5.3-3 8 0s5.4 3 8 0"
          fill="none"
          stroke="currentColor"
          strokeWidth={weight === 'mono' ? 2.4 : 2.8}
          strokeLinecap="round"
        />
      </svg>
      {spoken ? <span className="sr-only">approximately </span> : null}
    </>
  );
}
