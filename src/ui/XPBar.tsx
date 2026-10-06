'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { clamp01 } from '@/lib/math';
import { NumberTicker } from './NumberTicker';

const FRESH_MS = 600;

export type XPBarProps = Omit<ComponentProps<'div'>, 'children'> & {
  level: number;
  /** XP earned inside the current level. */
  xp: number;
  /** XP the current level needs in total. */
  xpForNext: number;
  /** XP from the action that just happened: drawn yellow for 600 ms, then it turns green. */
  justEarned?: number;
  /** The top-bar form: a 96 px bar, no level figure, no count. */
  compact?: boolean;
  /** Hide the level figure when a neighbour already shows it. */
  hideLevel?: boolean;
  /** Hide the "425/600" count when a neighbour already shows it. */
  hideCount?: boolean;
};

/** Level and XP. Exact game values: they never wear the "≈". */
export function XPBar({
  level,
  xp,
  xpForNext,
  justEarned = 0,
  compact = false,
  hideLevel = false,
  hideCount = false,
  className,
  ...rest
}: XPBarProps) {
  // The xp total whose fresh (yellow) span has already settled to green.
  const [settledXp, setSettledXp] = useState(xp);
  const fresh = justEarned > 0 && settledXp !== xp;

  useEffect(() => {
    if (justEarned <= 0) return;
    const timer = window.setTimeout(() => setSettledXp(xp), FRESH_MS);
    return () => window.clearTimeout(timer);
  }, [xp, justEarned]);

  const total = Math.max(xpForNext, 1);
  const now = clamp01(xp / total);
  const before = fresh ? clamp01((xp - justEarned) / total) : now;

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)} {...rest}>
      {compact || hideLevel ? null : (
        <span className="shrink-0 text-body font-bold whitespace-nowrap">
          Level <NumberTicker value={level} />
        </span>
      )}
      <div
        role="progressbar"
        aria-label="Experience"
        aria-valuemin={0}
        aria-valuemax={xpForNext}
        aria-valuenow={Math.min(xp, xpForNext)}
        aria-valuetext={`Level ${level}, ${formatNumber(xp)} of ${formatNumber(xpForNext)} XP`}
        className={cn(
          'relative h-3 overflow-hidden rounded-pill border-2 border-ink bg-white',
          compact ? 'w-24 shrink-0' : 'min-w-12 flex-1',
        )}
      >
        <span
          className="absolute inset-0 rounded-pill bg-yellow transition-transform duration-(--dur-slow) ease-mech"
          style={{ transform: `translateX(${-(1 - now) * 100}%)` }}
        />
        <span
          className="absolute inset-0 rounded-pill bg-green transition-transform duration-(--dur-slow) ease-mech"
          style={{ transform: `translateX(${-(1 - before) * 100}%)` }}
        />
      </div>
      {compact || hideCount ? null : (
        <span className="shrink-0 text-body-sm text-ink-2 tabular-nums" aria-hidden="true">
          {formatNumber(xp)} / {formatNumber(xpForNext)} XP
        </span>
      )}
    </div>
  );
}
