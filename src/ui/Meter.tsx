'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { clamp01 } from '@/lib/math';
import type { CategoryId, Hue } from './tokens';

export type MeterTone = Hue | CategoryId;

const METER_FILL: Record<MeterTone, string> = {
  green: 'bg-green',
  blue: 'bg-blue',
  yellow: 'bg-yellow',
  pink: 'bg-pink',
  orange: 'bg-orange',
  teal: 'bg-teal',
  violet: 'bg-violet',
  tomato: 'bg-tomato',
  move: 'bg-cat-move',
  eat: 'bg-cat-eat',
  power: 'bg-cat-power',
  water: 'bg-cat-water',
  stuff: 'bg-cat-stuff',
  waste: 'bg-cat-waste',
  nature: 'bg-cat-nature',
};

const HEIGHT = { sm: 'h-2', md: 'h-2.5', lg: 'h-3.5' } as const;

export type MeterProps = Omit<ComponentProps<'div'>, 'children'> & {
  value: number;
  max: number;
  tone?: MeterTone;
  size?: keyof typeof HEIGHT;
  /** Discrete segments instead of a bar (quest progress, daily caps). `max` at most 7. */
  pips?: boolean;
  /** A hatched span up to this value: solid = measured, hatch = projected. */
  projected?: number;
  /** Accessible name, e.g. "Vampire Slayer progress". */
  label: string;
  /** Spoken value. Defaults to "value of max". */
  valueText?: string;
};

/** A thin outlined bar that moves by transform only, or a row of pips. */
export function Meter({
  value,
  max,
  tone = 'green',
  size = 'md',
  pips = false,
  projected,
  label,
  valueText,
  className,
  ...rest
}: MeterProps) {
  const safeMax = Math.max(max, 1);
  const fraction = clamp01(value / safeMax);
  const aria = {
    role: 'meter',
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': max,
    'aria-valuenow': Math.min(value, max),
    'aria-valuetext': valueText ?? `${value} of ${max}`,
  } as const;

  if (pips) {
    const count = Math.min(Math.max(Math.round(max), 1), 7);
    return (
      <div {...aria} className={cn('inline-flex items-center gap-[3px]', className)} {...rest}>
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-2 w-3.5 rounded-pill border-2 border-ink transition-colors duration-(--dur-fast)',
              index < value ? METER_FILL[tone] : 'bg-white',
            )}
          />
        ))}
      </div>
    );
  }

  const projectedFraction = projected === undefined ? 0 : clamp01(projected / safeMax);
  return (
    <div
      {...aria}
      className={cn(
        'relative overflow-hidden rounded-pill border-2 border-ink bg-white',
        HEIGHT[size],
        className,
      )}
      {...rest}
    >
      {projectedFraction > fraction ? (
        <span
          className="absolute inset-y-0 left-0 hatch [--hatch:var(--color-ink-4)]"
          style={{ width: `${projectedFraction * 100}%` }}
        />
      ) : null}
      <span
        className={cn(
          'absolute inset-0 rounded-pill transition-transform duration-(--dur-slow) ease-mech',
          METER_FILL[tone],
        )}
        style={{ transform: `translateX(${-(1 - fraction) * 100}%)` }}
      />
    </div>
  );
}
