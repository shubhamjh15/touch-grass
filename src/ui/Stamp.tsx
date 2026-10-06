'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { DEEP_TEXT, type Hue } from './tokens';

export type StampProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** The stamped words: "PLANTED", "CLAIMED", "TOUCHED GRASS". */
  label: string;
  /** Label-maker date under the words: "06 OCT 2026". */
  date?: string;
  /** Ink colour: always the hue's deep on paper or card. */
  hue?: Hue;
  shape?: 'rect' | 'round';
  /** Degrees. */
  rotate?: number;
  /** Plays the stamp coming down once. Pair it with the `stamp` sound in the caller. */
  animate?: boolean;
  /**
   * Stamps are decoration by default: the words also exist as plain text nearby. Set false when the
   * stamp is the only place the words appear.
   */
  decorative?: boolean;
};

/** A rubber-stamp impression with uneven inking. */
export function Stamp({
  label,
  date,
  hue = 'pink',
  shape = 'rect',
  rotate = -6,
  animate = false,
  decorative = true,
  className,
  style,
  ...rest
}: StampProps) {
  // The entrance keyframes own `transform`, so the resting turn travels with them as a variable.
  const turn: CSSProperties = animate
    ? ({ '--stamp-rot': `${rotate}deg` } as CSSProperties)
    : { rotate: `${rotate}deg` };
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        'inline-flex flex-col items-center justify-center gap-[3px] border-[3px] border-double border-current stamp-ink px-3 py-2 type-slug font-bold outline-2 outline-offset-2 outline-current',
        shape === 'round' ? 'aspect-square min-w-20 rounded-full px-2 text-center' : 'rounded-sm',
        DEEP_TEXT[hue],
        animate && 'animate-stamp',
        className,
      )}
      style={{ ...turn, ...style }}
      {...rest}
    >
      <span className="text-[0.75rem] tracking-[0.1em]">{label}</span>
      {date ? (
        <span className="text-[0.6875rem] font-semibold tracking-[0.1em]">{date}</span>
      ) : null}
    </span>
  );
}
