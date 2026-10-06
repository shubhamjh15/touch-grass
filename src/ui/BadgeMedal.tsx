'use client';

import { Star, type LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { FILL_BG, type Hue } from './tokens';

export type BadgeSize = 72 | 96 | 160;
export type BadgeState = 'earned' | 'locked' | 'secret';

const CAPTION: Record<BadgeSize, string> = {
  72: 'w-[88px]',
  96: 'w-28',
  160: 'w-44',
};

/** The white die-cut margin scales with the medal. */
const MARGIN: Record<BadgeSize, string> = { 72: 'dc-3', 96: 'dc-4', 160: 'dc-6' };

export type BadgeMedalProps = Omit<ComponentProps<'div'>, 'children' | 'onClick' | 'slot'> & {
  name: string;
  icon: LucideIcon;
  hue: Hue;
  tier?: 1 | 2 | 3;
  state: BadgeState;
  /** Locked: how far along, e.g. `{ value: 34, max: 50, unit: 'logs' }`. */
  progress?: { value: number; max: number; unit: string };
  /** Earned: a short date for the caption, "6 Oct 2026". */
  earnedOn?: string;
  /** Retired: medals are not numbered. Accepted and ignored. */
  slot?: number;
  /** Secret: a one-line riddle. */
  hint?: string;
  size?: BadgeSize;
  /** Makes the medal a button that opens its detail sheet. Works in every state. */
  onOpen?: () => void;
};

/**
 * A badge. Earned = a die-cut medal in its hue with its icon. Locked = the same medal greyed, with
 * how far along it is underneath. Secret = a grey medal with a question mark. The state is always
 * in the words too, never in the colour alone.
 */
export function BadgeMedal({
  name,
  icon: Icon,
  hue,
  tier,
  state,
  progress,
  earnedOn,
  slot: _slot,
  hint,
  size = 96,
  onOpen,
  className,
  ...rest
}: BadgeMedalProps) {
  const earned = state === 'earned';
  const secret = state === 'secret';
  const stars = earned ? (tier ?? 0) : 0;

  const caption = secret ? 'Secret badge' : name;
  let detail: string | null;
  if (earned) detail = earnedOn ?? null;
  else if (secret) detail = hint ?? null;
  else detail = progress ? `${progress.value} / ${progress.max} ${progress.unit}` : 'Not yet';

  const medal = (
    <span
      data-state={state}
      className={cn(
        'relative grid place-items-center rounded-full border-2',
        earned
          ? ['diecut border-ink', FILL_BG[hue], MARGIN[size]]
          : 'border-dashed border-ink-4 bg-line text-ink-4',
      )}
      style={{ width: size, height: size }}
    >
      {secret ? (
        <span aria-hidden="true" className="text-h1 leading-none">
          ?
        </span>
      ) : (
        <Icon size={Math.round(size * 0.4)} strokeWidth={1.75} aria-hidden="true" />
      )}
      {stars > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-2 flex gap-0.5 rounded-pill border-2 border-ink bg-white px-1.5 py-0.5"
        >
          {Array.from({ length: stars }, (_, index) => (
            <Star key={index} size={10} strokeWidth={0} fill="var(--color-ink)" />
          ))}
        </span>
      ) : null}
    </span>
  );

  const text = (
    <span className={cn('mt-3 block text-center', CAPTION[size])}>
      <span
        className={cn(
          'block text-body-sm font-semibold text-balance',
          earned ? 'text-ink' : 'text-ink-3',
        )}
      >
        {caption}
        {state === 'locked' ? <span className="sr-only"> (not earned yet)</span> : null}
        {stars > 0 ? <span className="sr-only">, tier {stars}</span> : null}
      </span>
      {detail ? <span className="mt-0.5 block text-body-sm text-ink-3">{detail}</span> : null}
    </span>
  );

  if (onOpen) {
    return (
      <div className={cn('inline-flex flex-col items-center', className)} {...rest}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${caption}${earned ? ', earned' : ''}. Open badge`}
          className="rounded-full transition-transform duration-(--dur-fast) ease-out active:translate-y-px"
        >
          {medal}
        </button>
        {text}
      </div>
    );
  }

  return (
    <div className={cn('inline-flex flex-col items-center', className)} {...rest}>
      {medal}
      {text}
    </div>
  );
}
