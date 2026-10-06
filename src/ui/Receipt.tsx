'use client';

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ReceiptRow {
  label: string;
  /** Every kg value starts with `<Approx weight="mono" />`. */
  value: ReactNode;
}

export type ReceiptProps = Omit<ComponentProps<'div'>, 'title' | 'children'> & {
  title: string;
  /** The date line, label-maker style: "TUE 06 OCT 2026 · 14:32". */
  meta?: string;
  rows: ReceiptRow[];
  total?: ReceiptRow;
};

function Line({
  label,
  value,
  strong = false,
  className,
}: ReceiptRow & { strong?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline gap-1.5', strong && 'font-semibold', className)}>
      <dt className="min-w-0 truncate">{label}</dt>
      <span
        aria-hidden="true"
        className="min-w-3 flex-1 -translate-y-1 border-b-2 border-dotted border-ink-4"
      />
      <dd className="shrink-0 whitespace-nowrap">{value}</dd>
    </div>
  );
}

/** Totals printed on a till receipt with a pinked bottom edge. */
export function Receipt({ title, meta, rows, total, className, ...rest }: ReceiptProps) {
  return (
    <div
      className={cn(
        // The one allowed filter: a static drop shadow that follows the pinked silhouette.
        'edge-pinked-b mb-3 rounded-t-sm border-3 border-b-0 border-ink bg-paper px-3.5 pt-3.5 pb-2.5 font-mono text-data-sm text-ink [filter:drop-shadow(5px_5px_0_var(--color-ink))]',
        className,
      )}
      {...rest}
    >
      <p className="text-center font-semibold tracking-[0.08em] uppercase">{title}</p>
      {meta ? <p className="mt-0.5 text-center text-ink-3 uppercase">{meta}</p> : null}
      <dl className="mt-2.5">
        {rows.map((row) => (
          <Line key={row.label} {...row} />
        ))}
        {total ? (
          // One div per term and definition: a wrapper around the line would nest a div in a div,
          // which a description list does not allow.
          <Line {...total} strong className="mt-2 border-t-2 border-dashed border-ink pt-2" />
        ) : null}
      </dl>
    </div>
  );
}
