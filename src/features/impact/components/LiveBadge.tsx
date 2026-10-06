'use client';

import { cn } from '@/lib/cn';
import { freshnessText, type Freshness } from '../climate/model';

/**
 * Says whether a reading is live or a saved copy. "Live" is only ever printed for numbers our
 * server fetched from the publisher within the last day and a half; everything else is named a
 * snapshot, with its date. The words carry the meaning; the dot and the dashes only repeat it.
 */
export function LiveBadge({ state, className }: { state: Freshness; className?: string }) {
  const live = state.kind === 'live';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 border-2 px-2 py-0.5 type-slug whitespace-nowrap',
        live
          ? 'rounded-full border-ink bg-green-tint text-ink'
          : 'rounded-sm border-dashed border-ink-3 bg-white text-ink-2',
        className,
      )}
      title={live ? `Fetched from the source on ${state.date}` : undefined}
    >
      {live ? (
        <span
          aria-hidden="true"
          className="size-2 rounded-full border-[1.5px] border-ink bg-green motion-safe:animate-hatch"
        />
      ) : null}
      {freshnessText(state)}
    </span>
  );
}
