'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type GlyphProps = Omit<ComponentProps<'svg'>, 'children'> & {
  /** Pixel size of the square glyph. */
  size?: number;
  /** Accessible name; decorative when omitted. */
  title?: string;
};

function frame({ size = 24, title, className, ...rest }: GlyphProps, extra?: string) {
  return {
    width: size,
    height: size,
    role: title ? ('img' as const) : undefined,
    'aria-label': title,
    'aria-hidden': title ? undefined : true,
    focusable: 'false' as const,
    className: cn('block shrink-0 overflow-visible', extra, className),
    ...rest,
  };
}

const INK = 'var(--color-ink)';

export type MossMood = 'happy' | 'thinking' | 'sleepy';

/**
 * Moss, the coach: a moss-green ball with a sprout. Hand-drawn so it reads the same on every
 * platform. `bare` drops the body, for use on a disc that is already green.
 */
export function MossFace({
  mood = 'happy',
  bare = false,
  ...props
}: GlyphProps & { mood?: MossMood; bare?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" {...frame(props)}>
      {bare ? null : (
        <>
          <path
            d="M16 6.5q-1-6-7-6.5q0.5 5.5 7 6.5Z"
            fill="var(--color-green-tint)"
            stroke={INK}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <circle cx={16} cy={18} r={12} fill="var(--color-moss)" stroke={INK} strokeWidth={2.4} />
        </>
      )}
      {mood === 'sleepy' ? (
        <path
          d="M8.6 17.2q2.4 2.2 4.8 0M18.6 17.2q2.4 2.2 4.8 0"
          fill="none"
          stroke={INK}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle
            cx={11}
            cy={16.6}
            r={3.1}
            fill="var(--color-white)"
            stroke={INK}
            strokeWidth={1.4}
          />
          <circle
            cx={21}
            cy={16.6}
            r={3.1}
            fill="var(--color-white)"
            stroke={INK}
            strokeWidth={1.4}
          />
          <circle
            cx={mood === 'thinking' ? 12 : 11.6}
            cy={mood === 'thinking' ? 15.6 : 17}
            r={1.5}
            fill={INK}
          />
          <circle
            cx={mood === 'thinking' ? 22 : 21.6}
            cy={mood === 'thinking' ? 15.6 : 17}
            r={1.5}
            fill={INK}
          />
        </>
      )}
      {mood === 'thinking' ? (
        <path d="M13.6 24h4.8" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      ) : (
        <path
          d="M12.6 22.6q3.4 3 6.8 0"
          fill="none"
          stroke={INK}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export type TreeSpecies = 'oak' | 'cherry' | 'pine';

/**
 * A species silhouette in one ink (currentColor), for the tree chip and passport. Distinct outlines:
 * round crown (oak), wide cloud (cherry), stacked tiers (pine).
 */
export function TreeGlyph({ species = 'oak', ...props }: GlyphProps & { species?: TreeSpecies }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg viewBox="0 0 24 24" {...frame(props)}>
      {species === 'oak' ? (
        <>
          <path d="M12 21.5v-7" {...stroke} />
          <path
            d="M12 14.5c-4.2 0-7-2.4-7-5.6S7.6 3 12 3s7 2.7 7 5.9-2.800 5.600-7 5.600z"
            {...stroke}
            fill="currentColor"
            fillOpacity={0.18}
          />
          <path d="M12 11.500l2.600-2.600M12 13.500L9.600 11" {...stroke} strokeWidth={1.8} />
        </>
      ) : null}
      {species === 'cherry' ? (
        <>
          <path d="M12 21.5v-6.500M12 17.500l-3.500-3.500" {...stroke} />
          <path
            d="M6.500 14a4 4 0 0 1-1-7.800A5 5 0 0 1 12 3.500a5 5 0 0 1 6.500 2.700 4 4 0 0 1-1 7.800z"
            {...stroke}
            fill="currentColor"
            fillOpacity={0.18}
          />
          <circle cx={9} cy={9} r={1} fill="currentColor" />
          <circle cx={14.5} cy={8} r={1} fill="currentColor" />
          <circle cx={12.5} cy={11.5} r={1} fill="currentColor" />
        </>
      ) : null}
      {species === 'pine' ? (
        <>
          <path d="M12 21.5V18" {...stroke} />
          <path
            d="M12 2.500l4 5.500h-2.200l3.700 5h-2.500L19 18H5l4-5H6.500l3.700-5H8z"
            {...stroke}
            fill="currentColor"
            fillOpacity={0.18}
          />
        </>
      ) : null}
    </svg>
  );
}

/** The sprout: the tree chip's glyph before the tree has a species, and the Today tab. */
export function SproutGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" {...frame(props)}>
      <path
        d="M12 21.500V11M12 11C12 7 9 5 5 5c0 4 3 6 7 6zM12 14c0-3 2.500-5 6-5 0 3.500-2.500 5-6 5z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The brand's leaf mark, drawn for the 38 px logo tile. */
export function LeafMark(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" {...frame(props)}>
      <path
        d="M5 19c-1.500-7 2.500-13.500 14.500-14.500C20.500 15 14 20.500 5 19z"
        fill="var(--color-white)"
        stroke={INK}
        strokeWidth={2.25}
        strokeLinejoin="round"
      />
      <path
        d="M4 20.500C7.500 15 11 11.500 15.500 9"
        fill="none"
        stroke={INK}
        strokeWidth={2.25}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A paper cloud on the sky, with its own ink outline and hard shadow. Decorative. */
export function CloudGlyph({ size = 96, className, ...rest }: GlyphProps) {
  const d =
    'M16 42H84A11 11 0 0 0 84 20H80A17 17 0 0 0 48 14A13 13 0 0 0 24 21H16A10.5 10.5 0 0 0 16 42Z';
  return (
    <svg
      viewBox="0 0 100 50"
      width={size}
      height={size / 2}
      aria-hidden="true"
      focusable="false"
      className={cn('block shrink-0 overflow-visible', className)}
      {...rest}
    >
      <path
        d={d}
        transform="translate(3.5 3.5)"
        fill={INK}
        stroke={INK}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="var(--cloud, var(--color-white))"
        stroke={INK}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
