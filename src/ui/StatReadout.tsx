'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Approx } from './Approx';
import type { EstimateSource } from './estimate';
import { HonestyMark } from './HonestyMark';
import { NumberTicker } from './NumberTicker';

const FIGURE = {
  md: 'text-h2',
  lg: 'text-h1',
  hero: 'text-display-xl',
} as const;

const DELTA_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

export type StatReadoutProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** What the number is, in plain words. It sits under the figure. */
  label: string;
  /** A number rolls like an odometer; a string is printed as is. */
  value: number | string;
  /** Formats a numeric value (use `@/lib/format`). */
  format?: (value: number) => string;
  unit?: ReactNode;
  /** An estimate without an openable source: wears the plain drawn "≈". */
  approx?: boolean;
  /** An estimate with its source: wears the interactive honesty mark. */
  source?: EstimateSource;
  /** Change since last time. Ink with an arrow, never red or green type. */
  delta?: { dir: keyof typeof DELTA_ICON; text: string };
  /** One `hero` readout per view. */
  size?: keyof typeof FIGURE;
};

/** One number and what it means. A screen shows three at most. */
export function StatReadout({
  label,
  value,
  format,
  unit,
  approx = false,
  source,
  delta,
  size = 'md',
  className,
  ...rest
}: StatReadoutProps) {
  const DeltaIcon = delta ? DELTA_ICON[delta.dir] : null;
  const notEstimated = source?.kind === 'none';
  const estimate = !notEstimated && (approx || Boolean(source));

  return (
    <div className={cn('min-w-0 text-left', className)} {...rest}>
      {notEstimated ? (
        <p className="text-body font-semibold text-ink-3">Not estimated</p>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          {source ? <HonestyMark source={source} className="mr-0.5 self-center" /> : null}
          <span className={cn('type-figure whitespace-nowrap', FIGURE[size])}>
            {estimate && !source ? <Approx /> : null}
            {estimate && source ? <span className="sr-only">approximately </span> : null}
            {typeof value === 'number' ? <NumberTicker value={value} format={format} /> : value}
          </span>
          {unit ? <span className="text-body-sm font-semibold text-ink-2">{unit}</span> : null}
        </p>
      )}
      <p className="mt-1 text-body-sm text-ink-2">{label}</p>
      {delta && DeltaIcon ? (
        <p className="mt-1 flex items-center gap-1 text-body-sm text-ink-2">
          <DeltaIcon size={16} strokeWidth={2} aria-hidden="true" />
          {delta.text}
        </p>
      ) : null}
    </div>
  );
}
