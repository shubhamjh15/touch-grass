'use client';

import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './Card';

const NOTCH = {
  mat: '[--notch-bg:var(--color-mat)]',
  card: '[--notch-bg:var(--color-card)]',
  paper: '[--notch-bg:var(--color-paper)]',
} as const;

export type TicketProps = Omit<ComponentProps<'div'>, 'ref'> & {
  /** The surface the ticket sits on: the half-moon notches are painted in it. */
  surface?: keyof typeof NOTCH;
  /** A group label for assistive tech ("Today at a glance"). */
  label?: string;
};

/**
 * The perforated stat ticket: 2–4 stubs divided by lines you could tear. Readouts are grouped in one
 * ticket, never as a row of separate coloured cards.
 */
export function Ticket({ surface = 'mat', label, className, children, ...rest }: TicketProps) {
  return (
    <Card
      padded={false}
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn(
        'flex items-stretch [--notch-bw:3px] md:[--notch-bw:4px]',
        NOTCH[surface],
        className,
      )}
      {...rest}
    >
      {children}
    </Card>
  );
}

export type TicketStubProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** The key above the figure, set as a mono slug ("AVOIDED TODAY"). */
  label: string;
  /** The figure: usually a `NumberTicker`, preceded by `Approx` for an estimate. */
  value: ReactNode;
  unit?: ReactNode;
  /** Right-aligned mono meta on the label row ("425/600"). */
  meta?: ReactNode;
  /** Relative width; the first stub may take 1.45 on mobile to hold an XP bar. */
  flex?: number;
  /** Extra content on the figure row (an `XPBar`, a `Meter`). */
  children?: ReactNode;
};

export function TicketStub({
  label,
  value,
  unit,
  meta,
  flex = 1,
  className,
  style,
  children,
  ...rest
}: TicketStubProps) {
  return (
    <div
      className={cn('min-w-0 px-3 py-2.5 not-first:perf-l lg:px-4 lg:py-3', className)}
      style={{ flex: `${flex} 1 0%`, ...style } as CSSProperties}
      {...rest}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="shrink-0 type-slug text-ink-3">{label}</span>
        {meta ? (
          <span className="min-w-0 truncate font-mono text-data-sm leading-none text-ink-3 max-[379px]:hidden">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <p className="flex min-w-0 items-baseline whitespace-nowrap">
          <span className="type-figure text-display-sm lg:text-display-md">{value}</span>
          {unit ? (
            <span className="ml-1 text-[0.75rem] font-semibold lg:text-caption">{unit}</span>
          ) : null}
        </p>
        {children ? <div className="min-w-0 flex-1">{children}</div> : null}
      </div>
    </div>
  );
}

Ticket.Stub = TicketStub;
