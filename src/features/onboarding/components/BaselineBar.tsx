'use client';

import type { BaselineSegment } from '@/data/catalogue';
import {
  BASELINE_SEGMENTS,
  BASELINE_SEGMENT_LABELS,
  type BaselineReference,
  type BaselineTonnes,
} from '@/game';
import { cn } from '@/lib/cn';
import { formatPercent, formatTonnes } from '@/lib/format';

/**
 * One flat ink per segment, none of them a verdict: no red, no green. The order is fixed, so
 * the bar reads the same for everyone, and every segment is named again in the list below it.
 */
export const SEGMENT_FILL: Readonly<Record<BaselineSegment, string>> = {
  food: 'bg-orange',
  transport: 'bg-violet',
  flights: 'bg-blue',
  home: 'bg-yellow',
  stuff: 'bg-pink',
};

/** A letter printed on each segment: a second signal besides colour. */
export const SEGMENT_MARK: Readonly<Record<BaselineSegment, string>> = {
  food: 'F',
  transport: 'G',
  flights: 'A',
  home: 'H',
  stuff: 'S',
};

export interface BaselineBarProps {
  tonnes: BaselineTonnes;
  references: readonly BaselineReference[];
  className?: string;
}

/**
 * The stacked bar of the starting line, with reference ticks on the same scale. The picture
 * is a summary: every figure it shows is also printed as text right under it.
 */
export function BaselineBar({ tonnes, references, className }: BaselineBarProps) {
  // The scale always fits the user and every reference, with a little air at the end.
  const scaleMax = Math.max(tonnes.total, ...references.map((tick) => tick.tonnes), 0.1) * 1.06;
  const share = (value: number) => `${(Math.max(0, value) / scaleMax) * 100}%`;
  const summary = BASELINE_SEGMENTS.map(
    (segment) =>
      `${BASELINE_SEGMENT_LABELS[segment]} about ${formatTonnes(tonnes[segment])}, ${formatPercent(
        tonnes.total > 0 ? tonnes[segment] / tonnes.total : 0,
      )}`,
  ).join('; ');

  return (
    <div className={cn('min-w-0', className)}>
      <div
        role="img"
        aria-label={`Your starting line by part: ${summary}.`}
        className="relative pt-7"
      >
        {references.map((tick, index) => (
          <span
            key={tick.label}
            aria-hidden="true"
            className="absolute top-0 bottom-0 z-10 w-0"
            style={{ left: share(tick.tonnes) }}
          >
            <span className="absolute top-0 left-0 grid size-5 -translate-x-1/2 place-items-center rounded-full border-2 border-ink bg-white font-mono text-[0.6875rem] leading-none font-bold text-ink">
              {index + 1}
            </span>
            <span className="absolute top-5 bottom-0 left-0 -translate-x-1/2 border-l-2 border-dashed border-ink" />
          </span>
        ))}
        <div className="flex h-11 overflow-hidden rounded-sm border-3 border-ink bg-white hatch">
          {BASELINE_SEGMENTS.map((segment) => {
            const wide = tonnes.total > 0 && tonnes[segment] / scaleMax > 0.07;
            return tonnes[segment] > 0 ? (
              <span
                key={segment}
                className={cn(
                  'grid h-full shrink-0 place-items-center border-r-2 border-ink font-mono text-data-sm font-bold text-ink last:border-r-2',
                  SEGMENT_FILL[segment],
                )}
                style={{ width: share(tonnes[segment]) }}
              >
                {wide ? SEGMENT_MARK[segment] : null}
              </span>
            ) : null;
          })}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mt-1.5 flex justify-between font-mono text-data-sm text-ink-3"
      >
        <span>0</span>
        <span>{formatTonnes(scaleMax)}</span>
      </div>
    </div>
  );
}
