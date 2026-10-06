'use client';

import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { clamp01 } from '@/lib/math';
import { HUE_VAR, type Hue } from './tokens';

export type RingSize = 48 | 64 | 96 | 160;

const THICKNESS: Record<RingSize, number> = { 48: 6, 64: 8, 96: 10, 160: 14 };
const CHECK: Record<RingSize, number> = { 48: 18, 64: 24, 96: 36, 160: 56 };

export type RingProgressProps = Omit<ComponentProps<'div'>, 'children'> & {
  value: number;
  max: number;
  size?: RingSize;
  tone?: Hue;
  /** Accessible name, e.g. "Today's ring". */
  label: string;
  /** Spoken value. Defaults to "value of max". */
  valueText?: string;
  /** Centre content: a mono "2/3" or one proud figure. Replaced by a check when complete. */
  children?: ReactNode;
  /** Keep the children instead of the check when the ring completes (timers). */
  keepChildren?: boolean;
};

/**
 * The ring: an ink track, a white channel and a flat arc from 12 o'clock, ending in an ink tick.
 * Complete = the disc turns yellow and a check sticks in. The day ring, locked badges, the break timer.
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
  const radius = centre - (t + 4) / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const fraction = clamp01(value / Math.max(max, 1));
  const complete = fraction >= 1;

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
        className="absolute inset-0 overflow-visible"
      >
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill={complete ? 'var(--color-yellow)' : 'var(--color-white)'}
          stroke="var(--color-ink)"
          strokeWidth={t + 4}
        />
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke="var(--color-white)"
          strokeWidth={t}
        />
        <g transform={`rotate(-90 ${centre} ${centre})`}>
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke={HUE_VAR[tone]}
            strokeWidth={t}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className="transition-[stroke-dashoffset] duration-(--dur-slow) ease-mech"
          />
          {fraction > 0 && !complete ? (
            <line
              x1={centre + radius - t / 2}
              x2={centre + radius + t / 2}
              y1={centre}
              y2={centre}
              stroke="var(--color-ink)"
              strokeWidth={2}
              className="transition-transform duration-(--dur-slow) ease-mech"
              style={{
                transformOrigin: `${centre}px ${centre}px`,
                transform: `rotate(${fraction * 360}deg)`,
              }}
            />
          ) : null}
        </g>
      </svg>
      <span className="relative grid place-items-center text-center font-mono text-data leading-none text-ink">
        {complete && !keepChildren ? (
          <Check size={CHECK[size]} strokeWidth={3} aria-hidden="true" className="animate-pop" />
        ) : (
          children
        )}
      </span>
    </div>
  );
}
