'use client';

import type { WeekStripDay } from '@/game';
import { cn } from '@/lib/cn';
import { CloudGlyph } from '@/ui';
import { markWord, weekdayLabel } from '../model';

/** One day of the week as a shape: thick ring, thin ring, cloud, rest bar, or an empty slot. */
function DayMark({ mark, future }: { mark: WeekStripDay['mark']; future: boolean }) {
  if (mark === 'rain') return <CloudGlyph size={30} aria-hidden="true" />;
  if (mark === 'full') {
    return (
      <span className="grid size-7 place-items-center rounded-full border-[6px] border-ink bg-yellow">
        <span className="size-1.5 rounded-full bg-ink" />
      </span>
    );
  }
  if (mark === 'ring') {
    return <span className="size-7 rounded-full border-2 border-ink bg-white" />;
  }
  if (mark === 'rest') {
    return (
      <span className="grid size-7 place-items-center rounded-full border-2 border-dashed border-ink-3 bg-paper">
        <span className="h-0.5 w-3 rounded-full bg-ink-3" />
      </span>
    );
  }
  if (mark === 'today') {
    return <span className="size-7 rounded-full border-2 border-dashed border-ink bg-white" />;
  }
  return (
    <span className="grid size-7 place-items-center">
      <span className={cn('rounded-full bg-ink-4', future ? 'size-1' : 'size-1.5')} />
    </span>
  );
}

export interface WeekStripProps {
  days: readonly WeekStripDay[];
  /** What the list is, for assistive tech: "This week" or "Last week". */
  label: string;
  className?: string;
}

/**
 * Seven days, Monday first. Every mark is a distinct shape with its name as text, so the
 * strip reads without colour: a thick ring is a full day, a thin one a day you showed up,
 * a cloud a rain day, a dashed bar a planned rest day.
 */
export function WeekStrip({ days, label, className }: WeekStripProps) {
  return (
    <ol aria-label={label} className={cn('grid grid-cols-7 gap-1', className)}>
      {days.map((day) => {
        const word = markWord(day.mark);
        return (
          <li
            key={day.day}
            aria-current={day.isToday ? 'date' : undefined}
            className="flex min-w-0 flex-col items-center gap-1"
          >
            <span
              className={cn(
                'type-tick',
                day.isToday ? 'rounded-xs bg-ink px-1 text-white' : 'text-ink-3',
              )}
            >
              {weekdayLabel(day.index)}
            </span>
            <span aria-hidden="true" className="grid h-8 place-items-center">
              <DayMark mark={day.mark} future={day.isFuture} />
            </span>
            <span className="sr-only">{day.isFuture ? 'Still to come' : day.label}</span>
            <span aria-hidden="true" className="h-3 type-tick text-ink-2">
              {day.isFuture ? '' : word}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
