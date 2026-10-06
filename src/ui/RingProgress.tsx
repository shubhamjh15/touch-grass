'use client';

import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { clamp01 } from '@/lib/math';
import { HUE_DEEP_VAR, type Hue } from './tokens';

export type RingSize = 32 | 48 | 64 | 96 | 160;

const THICKNESS: Record<RingSize, number> = { 32: 4, 48: 5, 64: 6, 96: 8, 160: 10 };
const CHECK: Record<RingSize, number> = { 32: 16, 48: 22, 64: 28, 96: 40, 160: 60 };

export type RingProgressProps = Omit<ComponentProps<'div'>, 'children'> & {
  value: number;
  max: number;
  size?: RingSize;
  tone?: Hue;
  /** Accessible name, e.g. "Today's ring". */
  label: string;
  /** Spoken value. Defaults to "value of max". */
  valueText?: string;
  /** Centre content: a short "2/3" or one figure. Replaced by a check when complete. */
  children?: ReactNode;
  /** Keep the children instead of the check when the ring completes (timers). */
  keepChildren?: boolean;
};

/**
 * A thin ring: a pale track and one arc from 12 o'clock. Complete = the disc fills green and a
 * check lands. Lesson progress, the day's ring, the break timer.
 */
export function RingProgress({
  value,
  max,
  size = 64,
  tone = 'green',
  label,
  valueText,
  children,
  keepChildren = false,
  className,
  ...rest
}: RingProgressProps) {
  const t = THICKNESS[size];
  const centre = size / 2;
  const radius = centre - t / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = clamp01(value / Math.max(max, 1));
  const complete = fraction >= 1;
  const showCheck = complete && !keepChildren;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={valueText ?? `${value} of ${max}`}
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0"
      >
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill={showCheck ? 'var(--color-green)' : 'none'}
          stroke="var(--color-line)"
          strokeWidth={t}
        />
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke={HUE_DEEP_VAR[tone]}
          strokeWidth={t}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${centre} ${centre})`}
          opacity={fraction > 0 ? 1 : 0}
        />
      </svg>
      <span className="relative grid place-items-center text-center text-body-sm leading-none font-semibold text-ink tabular-nums">
        {showCheck ? (
          <Check size={CHECK[size]} strokeWidth={2.5} aria-hidden="true" className="animate-pop" />
        ) : (
          children
        )}
      </span>
    </div>
  );
}
