'use client';

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './Card';
import { UiLink } from './Link';
import { TINT_BG, type Hue } from './tokens';

export type LedgerProps = Omit<ComponentProps<'ul'>, 'aria-label'> & {
  'aria-label': string;
  /** Classes for the surrounding card. */
  cardClassName?: string;
};

/** One card whose rows are separated by hairlines. A list is never one bordered card per row. */
export function Ledger({ className, cardClassName, children, ...rest }: LedgerProps) {
  return (
    <Card padded={false} className={cardClassName}>
      <ul
        className={cn('divide-y divide-line overflow-hidden rounded-[14px]', className)}
        {...rest}
      >
        {children}
      </ul>
    </Card>
  );
}

/** The 40 px tinted tile that leads a row when there is no sticker. */
export function IconTile({ hue, className, ...rest }: ComponentProps<'span'> & { hue: Hue }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-md text-ink',
        TINT_BG[hue],
        className,
      )}
      {...rest}
    />
  );
}

export type ListRowProps = Omit<ComponentProps<'li'>, 'title' | 'onClick' | 'value'> & {
  /** A 32 px `Sticker` or an `IconTile`. */
  leading?: ReactNode;
  title: string;
  /** A quiet line under the title: "08:42 · 5 km". */
  meta?: string;
  /** Sentence under the title (settings rows). Use instead of `meta`. */
  description?: string;
  /** Right-aligned figure; estimates start with `<Approx />`. */
  value?: ReactNode;
  /** A visible control: `IconButton sm` (undo, delete), a `Switch`, or a chevron. */
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
};

/**
 * A row in a Ledger. With `href` or `onClick` the main area is one control; `trailing` stays a
 * separate, always-visible control beside it (undo and delete are never swipe-only).
 */
export function ListRow({
  leading,
  title,
  meta,
  description,
  value,
  trailing,
  href,
  onClick,
  selected = false,
  className,
  ...rest
}: ListRowProps) {
  const main = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold">{title}</span>
        {meta ? (
          <span className="mt-0.5 block truncate text-body-sm text-ink-3">{meta}</span>
        ) : null}
        {description ? (
          <span className="mt-0.5 block text-body-sm text-ink-3">{description}</span>
        ) : null}
      </span>
      {value !== undefined && value !== null ? (
        <span className="shrink-0 text-right text-body font-semibold whitespace-nowrap tabular-nums">
          {value}
        </span>
      ) : null}
    </>
  );

  const mainClass =
    'flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pl-5 text-left text-ink focus-inset last:pr-5';
  const interactive = Boolean(href ?? onClick);

  return (
    <li
      data-selected={selected || undefined}
      className={cn(
        'flex min-h-16 items-center gap-3 bg-card transition-colors duration-(--dur-fast)',
        interactive &&
          'has-[[data-row-main]:active]:bg-mat-deep fine:has-[[data-row-main]:hover]:bg-mat',
        selected && 'bg-mat-deep fine:has-[[data-row-main]:hover]:bg-mat-deep',
        className,
      )}
      {...rest}
    >
      {href ? (
        <UiLink
          href={href}
          data-row-main=""
          aria-current={selected ? 'true' : undefined}
          className={mainClass}
        >
          {main}
        </UiLink>
      ) : onClick ? (
        <button
          type="button"
          data-row-main=""
          aria-pressed={selected || undefined}
          onClick={onClick}
          className={mainClass}
        >
          {main}
        </button>
      ) : (
        <div className={mainClass}>{main}</div>
      )}
      {trailing ? <div className="flex shrink-0 items-center gap-2 pr-5">{trailing}</div> : null}
    </li>
  );
}
