'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useReducedMotion } from '@/lib/hooks';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const STAGGER_MS = 18;

export type NumberTickerProps = Omit<ComponentProps<'span'>, 'children'> & {
  value: number;
  /** Turns the number into text. Defaults to the product's integer format. */
  format?: (value: number) => string;
  /** Milliseconds each digit takes to roll. */
  duration?: number;
};

function DigitColumn({
  digit,
  delay,
  duration,
}: {
  digit: number;
  delay: number;
  duration: number;
}) {
  return (
    <span className="relative inline-block [clip-path:inset(-0.08em_0)]">
      {/* In-flow twin: gives the column its width and baseline. */}
      <span className="invisible">{digit}</span>
      <span
        className="absolute top-0 left-0 flex flex-col transition-transform ease-mech will-change-transform"
        style={
          {
            transform: `translateY(${-digit * 10}%)`,
            transitionDuration: `${duration}ms`,
            transitionDelay: `${delay}ms`,
          } as CSSProperties
        }
      >
        {DIGITS.map((glyph) => (
          <span key={glyph} className="block h-[1lh]">
            {glyph}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * An odometer: each digit column rolls to its new value, staggered from the right. Mechanical, never
 * bouncy. The real value is in the DOM as text; the rolling columns are hidden from assistive tech.
 * It is not a live region: announce changes in words elsewhere (a toast).
 */
export function NumberTicker({
  value,
  format = formatNumber,
  duration = 600,
  className,
  ...rest
}: NumberTickerProps) {
  const reduced = useReducedMotion();
  const text = format(value);

  if (reduced) {
    return (
      <span className={cn('tabular-nums', className)} {...rest}>
        {text}
      </span>
    );
  }

  const glyphs = Array.from(text);
  return (
    <span className={cn('inline-block whitespace-nowrap tabular-nums', className)} {...rest}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" data-ticker="">
        {glyphs.map((glyph, index) => {
          // Keyed from the right so the units column keeps its identity when the number grows a digit.
          const place = glyphs.length - 1 - index;
          return glyph >= '0' && glyph <= '9' ? (
            <DigitColumn
              key={`digit-${place}`}
              digit={Number(glyph)}
              delay={place * STAGGER_MS}
              duration={duration}
            />
          ) : (
            <span key={`mark-${place}`}>{glyph}</span>
          );
        })}
      </span>
    </span>
  );
}
