'use client';

import { Table2, ChartColumn } from 'lucide-react';
import { Component, Suspense, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useInViewOnce } from '@/lib/hooks';
import { Button, Card, Skeleton } from '@/ui';
import { COPY } from '../copy';
import type { TableData } from '../model';

/** A real `<table>`: the alternative to every plot, and what a failed chart falls back to. */
export function DataTable({ data, caption }: { data: TableData; caption: string }) {
  return (
    <div className="max-h-72 overflow-auto rounded-sm border-2 border-ink bg-white" tabIndex={0}>
      <table className="w-full border-collapse text-left font-mono text-data">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-paper">
          <tr>
            {data.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="border-b-[1.5px] border-ink px-3 py-2 type-slug font-semibold text-ink-3"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.join('|')} className="border-b border-line last:border-b-0">
              {row.map((cell, index) => (
                <td
                  key={data.columns[index] ?? index}
                  className={cn('px-3 py-1.5', index === 0 ? 'font-semibold' : 'text-ink-2')}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Catches a plot that throws or whose chunk will not load, and shows the table instead. */
class PlotBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface ChartCardProps {
  /** "FIG. 03": printed at the right of the header. */
  fig: string;
  title: string;
  /** What the figure measures, one quiet line. */
  unit?: string;
  /** The plot: a lazy chart component. It is not mounted until the card is near the screen. */
  plot: ReactNode;
  table: TableData;
  tableCaption: string;
  /** The honest sentence under the plot. */
  caption: ReactNode;
  /** Source line, tag and notes. */
  footer?: ReactNode;
  /** Controls above the plot (a legend that toggles lines). */
  legend?: ReactNode;
  /** False for a plot that is plain markup rather than a lazy chart: it renders at once, without a skeleton. */
  lazyPlot?: boolean;
  /** Tailwind height classes of the plot area: reserved so nothing shifts when the chunk lands. */
  plotClassName?: string;
  /** A tag printed next to the figure number ("SAVED WITH THE APP"). */
  tag?: ReactNode;
  /** What the table button says when the table holds more than the plot ("All places"). */
  tableLabel?: string;
  className?: string;
}

/**
 * One figure: header, plot (or its table), caption, footer. The plot area has a fixed height
 * so the page never shifts, shows a hatched skeleton while the chart chunk loads, and swaps to
 * the table when the chart fails or the person asks for it.
 */
export function ChartCard({
  fig,
  title,
  unit,
  plot,
  table,
  tableCaption,
  caption,
  footer,
  legend,
  lazyPlot = true,
  plotClassName = 'h-56 sm:h-64',
  tag,
  tableLabel = COPY.chart.asTable,
  className,
}: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  const [ref, near] = useInViewOnce<HTMLDivElement>(0.01);
  const tableView = <DataTable data={table} caption={tableCaption} />;

  return (
    <Card className={cn('grid content-start gap-3', className)}>
      <header className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">{tag}</span>
          <span className="shrink-0 type-slug text-ink-3">{fig}</span>
        </div>
        <div className="min-w-0">
          <h3 className="text-h3">{title}</h3>
          {unit ? <p className="mt-1 type-slug text-ink-3">{unit}</p> : null}
        </div>
      </header>
      {legend}
      <div ref={ref}>
        {asTable ? (
          tableView
        ) : (
          <div className={cn('relative', plotClassName)}>
            {!lazyPlot ? (
              plot
            ) : near ? (
              <PlotBoundary
                fallback={
                  <div className="grid gap-2">
                    <p role="status" className="text-body-sm text-ink-2">
                      {COPY.chart.unavailable}
                    </p>
                    {tableView}
                  </div>
                }
              >
                <Suspense
                  fallback={
                    <Skeleton
                      shape="block"
                      className="h-full w-full"
                      role="status"
                      aria-label={COPY.chart.loading}
                    />
                  }
                >
                  {plot}
                </Suspense>
              </PlotBoundary>
            ) : (
              <Skeleton shape="block" className="h-full w-full" />
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 basis-56 text-body-sm text-ink-2">{caption}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAsTable((value) => !value)}
          aria-pressed={asTable}
          className="shrink-0"
        >
          {asTable ? (
            <ChartColumn size={16} aria-hidden="true" />
          ) : (
            <Table2 size={16} aria-hidden="true" />
          )}
          {asTable ? COPY.chart.asChart : tableLabel}
        </Button>
      </div>
      {footer ? (
        <div className="border-t-[1.5px] border-ink pt-3 text-caption text-ink-3">{footer}</div>
      ) : null}
    </Card>
  );
}
