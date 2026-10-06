'use client';

import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './Card';

export type TicketProps = Omit<ComponentProps<'div'>, 'ref'> & {
  /** Retired: there are no notches to paint. Accepted so older callers keep compiling. */
  surface?: 'mat' | 'card' | 'paper';
  /** A group label for assistive tech ("Today at a glance"). */
  label?: string;
};

/**
 * A row of two or three figures in one card, divided by hairlines. Retired as a "ticket": it has no
 * perforations or notches any more. A screen shows three numbers at most.
 */
export function Ticket({ surface: _surface, label, className, children, ...rest }: TicketProps) {
  return (
    <Card
      padded={false}
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn('flex items-stretch divide-x divide-line', className)}
      {...rest}
    >
      {children}
    </Card>
  );
}

export type TicketStubProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** What the figure is, in plain words. It sits under the figure. */
  label: string;
  /** The figure: usually a `NumberTicker`, preceded by `Approx` for an estimate. */
  value: ReactNode;
  unit?: ReactNode;
  /** A quiet note beside the label ("425 / 600"). */
  meta?: ReactNode;
  /** Relative width. */
  flex?: number;
  /** Extra content beside the figure (an `XPBar`, a `Meter`). */
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
      className={cn('min-w-0 px-5 py-4', className)}
      style={{ flex: `${flex} 1 0%`, ...style } as CSSProperties}
      {...rest}
    >
      <div className="flex items-center gap-3">
        <p className="flex min-w-0 items-baseline whitespace-nowrap">
          <span className="type-figure text-h1">{value}</span>
          {unit ? <span className="ml-1 text-body-sm font-semibold text-ink-2">{unit}</span> : null}
        </p>
        {children ? <div className="min-w-0 flex-1">{children}</div> : null}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-body-sm text-ink-2">
        <span className="truncate">{label}</span>
        {meta ? <span className="shrink-0 text-ink-3 tabular-nums">{meta}</span> : null}
      </div>
    </div>
  );
}

Ticket.Stub = TicketStub;
