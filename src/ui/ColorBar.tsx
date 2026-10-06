'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { cn } from '@/lib/cn';

const INKS = ['bg-green', 'bg-blue', 'bg-yellow', 'bg-pink', 'bg-ink'] as const;

const CELL: Record<NonNullable<ColorBarProps['size']>, string> = {
  xs: 'h-2.5 w-[3px]',
  sm: 'size-2',
  md: 'size-3',
};

export type ColorBarProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** The loader: squares fill in sequence, then start over. */
  loading?: boolean;
  /** Stepper mode: how many squares are filled (with `steps`). */
  step?: number;
  /** Number of squares. Defaults to the five brand inks. */
  steps?: number;
  size?: 'xs' | 'sm' | 'md';
  /** Accessible name. Defaults to "Loading" for the loader and "Step n of m" for the stepper; decorative otherwise. */
  label?: string;
};

/**
 * The printer's colour bar: green, blue, yellow, pink, ink. A divider, a sign-off, the onboarding
 * stepper, and the one loader in the product.
 */
export function ColorBar({
  loading = false,
  step,
  steps = 5,
  size = 'md',
  label,
  className,
  ...rest
}: ColorBarProps) {
  const stepper = step !== undefined;
  const fallback = loading ? 'Loading' : stepper ? `Step ${step} of ${steps}` : '';
  const name = label ?? fallback;

  return (
    <span
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      className={cn(
        'inline-flex shrink-0 border-2 border-ink bg-white align-middle',
        size !== 'xs' && 'divide-x-2 divide-ink',
        loading && 'animate-colorbar',
        className,
      )}
      {...rest}
    >
      {Array.from({ length: steps }, (_, index) => {
        const style: CSSProperties | undefined = loading
          ? { opacity: `clamp(0, calc(var(--bar) - ${index}), 1)` }
          : undefined;
        const filled = !stepper || index < step;
        return (
          <span key={index} className={cn('block', CELL[size])}>
            {filled ? (
              <span className={cn('block size-full', INKS[index % INKS.length])} style={style} />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
