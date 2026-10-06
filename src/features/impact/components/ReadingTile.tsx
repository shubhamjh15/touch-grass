'use client';

import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/ui';
import { sourceLine, type Freshness, type Reading } from '../climate/model';
import { LiveBadge } from './LiveBadge';

const CELL =
  'grid min-w-0 content-start gap-2 px-4 py-4 not-first:border-t-2 not-first:border-dashed not-first:border-ink md:px-5 md:py-5';
/** From `md` the cells sit side by side, so the dashed rule moves from the top to the left. */
const CELL_WIDE = 'md:not-first:border-t-0 md:not-first:border-l-2';

export interface ReadingTileProps {
  reading: Reading;
  state: Freshness;
  /** `lg`: a headline figure. `md`: a supporting one. */
  size?: 'lg' | 'md';
  /** Cells stay stacked at every width (inside a narrow column). */
  stacked?: boolean;
}

/**
 * One measurement of the planet: what it is, the figure, exactly what and when it measures, how
 * it moved, who published it and whether it is live. A measurement is not an estimate, so it
 * carries its source instead of the drawn approximate mark.
 */
export function ReadingTile({ reading, state, size = 'lg', stacked = false }: ReadingTileProps) {
  return (
    <div className={cn(CELL, !stacked && CELL_WIDE)}>
      <dt className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="type-slug text-ink-2">{reading.label}</span>
        <LiveBadge state={state} />
      </dt>
      <dd className="grid gap-1.5">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span
            className={cn(
              'type-figure',
              size === 'lg' ? 'text-display-md lg:text-display-lg' : 'text-display-sm',
            )}
          >
            {reading.value}
          </span>
          <span className="text-body font-semibold">{reading.unit}</span>
        </span>
        <span className="text-body-sm text-ink-2">{reading.context}</span>
        {reading.change ? (
          <span className="font-mono text-data font-semibold text-ink">{reading.change}</span>
        ) : null}
        <a
          href={reading.signal.source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="justify-self-start py-1.5 text-caption text-ink-3 underline decoration-ink-4 underline-offset-4 focus-inset hover:text-ink hover:decoration-ink"
        >
          {sourceLine(reading.signal)}
          <ArrowUpRight size={14} aria-hidden="true" className="ml-1 inline-block align-[-2px]" />
          <span className="sr-only">(opens the source in a new tab)</span>
        </a>
      </dd>
    </div>
  );
}

/** The same cell while the readings load: fixed heights, so nothing moves when they land. */
export function ReadingTileSkeleton({
  size = 'lg',
  stacked = false,
}: Omit<ReadingTileProps, 'reading' | 'state'>) {
  return (
    <div className={cn(CELL, !stacked && CELL_WIDE)}>
      <Skeleton shape="block" className="h-5 w-40" />
      <Skeleton shape="block" className={cn('w-36', size === 'lg' ? 'h-12 lg:h-14' : 'h-9')} />
      <Skeleton shape="text" lines={2} />
    </div>
  );
}
