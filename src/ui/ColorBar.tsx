'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

const INKS = ['bg-green', 'bg-blue', 'bg-yellow', 'bg-pink', 'bg-ink'] as const;

const CELL: Record<NonNullable<ColorBarProps['size']>, string> = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
};

const SPINNER_SIZE = { xs: 16, sm: 20, md: 24 } as const;

export type ColorBarProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** Loading: renders the product's one spinner instead of the dots. */
  loading?: boolean;
  /** Stepper mode: how many dots are filled (with `steps`). */
  step?: number;
  /** Number of dots. Defaults to the five brand inks. */
  steps?: number;
  size?: 'xs' | 'sm' | 'md';
  /** Accessible name. Defaults to "Loading" for the loader and "Step n of m" for the stepper; decorative otherwise. */
  label?: string;
};

/**
 * Five small dots in the brand inks: a quiet sign-off, or a short stepper. With `loading` it is the
 * spinner, so there is one loading indicator in the product. Prefer `ProgressBar` for steps and
 * `Spinner` for loading in new code.
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
  if (loading) {
    return (
      <Spinner
        size={SPINNER_SIZE[size]}
        label={label ?? 'Loading'}
        className={className}
        {...rest}
      />
    );
  }

  const stepper = step !== undefined;
  const name = label ?? (stepper ? `Step ${step} of ${steps}` : '');

  return (
    <span
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      className={cn('inline-flex shrink-0 items-center gap-1 align-middle', className)}
      {...rest}
    >
      {Array.from({ length: steps }, (_, index) => {
        const filled = !stepper || index < step;
        return (
          <span
            key={index}
            className={cn(
              'block rounded-full',
              CELL[size],
              filled ? INKS[index % INKS.length] : 'bg-line',
            )}
          />
        );
      })}
    </span>
  );
}
