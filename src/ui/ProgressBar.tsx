'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { clamp01 } from '@/lib/math';

export type ProgressBarProps = Omit<ComponentProps<'div'>, 'children'> & {
  value: number;
  /** Defaults to 1, so `value` can be a fraction. */
  max?: number;
  /**
   * `thin`: a 6 px line with no outline (reading progress, onboarding steps).
   * `md`: the 10 px outlined bar of a quest row.
   */
  size?: 'thin' | 'md';
  /** Accessible name, e.g. "Step 2 of 4" or "Walk 5 km progress". */
  label: string;
  /** Spoken value. Defaults to a percentage. */
  valueText?: string;
};

/** A thin progress bar. The fill moves by transform only. */
export function ProgressBar({
  value,
  max = 1,
  size = 'md',
  label,
  valueText,
  className,
  ...rest
}: ProgressBarProps) {
  const fraction = clamp01(value / Math.max(max, Number.EPSILON));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, 0), max)}
      aria-valuetext={valueText ?? `${Math.round(fraction * 100)}%`}
      className={cn(
        'relative w-full overflow-hidden rounded-pill',
        size === 'thin' ? 'h-1.5 bg-line' : 'h-2.5 border-2 border-ink bg-white',
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'absolute inset-0 rounded-pill transition-transform duration-(--dur-slow) ease-mech',
          size === 'thin' ? 'bg-green-deep' : 'bg-green',
        )}
        style={{ transform: `translateX(${-(1 - fraction) * 100}%)` }}
      />
    </div>
  );
}
