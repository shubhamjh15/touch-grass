'use client';

import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { DEEP_TEXT, TINT_BG, type Hue } from './tokens';

export type StampProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** The words: "Planted", "Claimed", "Done". */
  label: string;
  /** A short date after the words: "6 Oct 2026". */
  date?: string;
  /** The label sits on this hue's tint, in its deep ink. */
  hue?: Hue;
  /** Retired: every mark is the same pill. Accepted and ignored. */
  shape?: 'rect' | 'round';
  /** Retired: marks sit straight. Accepted and ignored. */
  rotate?: number;
  /** Plays the check landing once. */
  animate?: boolean;
  /**
   * Marks are decoration by default: the words also exist as plain text nearby. Set false when the
   * mark is the only place the words appear.
   */
  decorative?: boolean;
};

/**
 * A small "done" mark: a check and a word on a tint. Retired as a rubber stamp: no double border,
 * no uneven ink, no tilt.
 */
export function Stamp({
  label,
  date,
  hue = 'green',
  shape: _shape,
  rotate: _rotate,
  animate = false,
  decorative = true,
  className,
  ...rest
}: StampProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-pill px-2.5 text-body-sm font-semibold whitespace-nowrap',
        TINT_BG[hue],
        DEEP_TEXT[hue],
        className,
      )}
      {...rest}
    >
      <Check
        size={16}
        strokeWidth={2.5}
        aria-hidden="true"
        className={animate ? 'animate-pop' : undefined}
      />
      {label}
      {date ? <span className="font-normal">{date}</span> : null}
    </span>
  );
}
