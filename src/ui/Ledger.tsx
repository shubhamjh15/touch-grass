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

/**
 * One card whose rows are separated by hairline ink rules. A ledger is never one bordered card per row.
 */
export function Ledger({ className, cardClassName, children, ...rest }: LedgerProps) {
  return (
    <Card padded={false} className={cardClassName}>
      <ul
        className={cn(
          'divide-y-[1.5px] divide-ink overflow-hidden rounded-[9px] md:rounded-[12px]',
          className,
        )}
        {...rest}
      >
        {children}
      </ul>
    </Card>
  );
}

/** The 40 px icon tile that leads a row when there is no sticker. */
export function IconTile({ hue, className, ...rest }: ComponentProps<'span'> & { hue: Hue }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-sm border-2 border-ink text-ink',
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
  /** Mono meta under the title: "08:42 · 5 KM · SWAP". */
  meta?: string;
  /** Sentence under the title (settings rows). Use instead of `meta`. */
  description?: string;
  /** Right-aligned mono figure; estimates start with `<Approx weight="mono" />`. */
  value?: ReactNode;
  /** A visible control: `IconButton sm` (undo, delete), a `Switch`, a `Tag`, or a chevron. */
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
        <span
          className={cn('block truncate text-body', description ? 'font-semibold' : 'font-bold')}
        >
          {title}
        </span>
        {meta ? (
          <span className="mt-1 block truncate type-slug leading-[1.3] text-ink-3">{meta}</span>
        ) : null}
        {description ? (
          <span className="mt-0.5 block text-body-sm text-ink-2">{description}</span>
        ) : null}
      </span>
      {value !== undefined && value !== null ? (
        <span className="shrink-0 text-right font-mono text-data-lg whitespace-nowrap">
          {value}
        </span>
      ) : null}
    </>
  );

  const mainClass =
    'flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pl-4 text-left text-ink focus-inset last:pr-4';
  const interactive = Boolean(href ?? onClick);

  return (
    <li
      data-selected={selected || undefined}
      className={cn(
        'flex min-h-16 items-center gap-3 bg-card transition-colors duration-(--dur-fast) lg:min-h-14',
        interactive &&
          'has-[[data-row-main]:active]:bg-yellow/50 fine:has-[[data-row-main]:hover]:bg-yellow-tint',
        selected && 'bg-yellow fine:has-[[data-row-main]:hover]:bg-yellow',
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
      {trailing ? <div className="flex shrink-0 items-center gap-2 pr-4">{trailing}</div> : null}
    </li>
  );
}
