'use client';

import { Chip } from '@/ui';
import { COPY } from '../copy';
import { lineStyle } from '../charts/style';
import { formatValue, type ChartSeries } from '../model';

export interface LineLegendProps {
  series: readonly ChartSeries[];
  hidden: ReadonlySet<string>;
  /** Without it the legend is a plain key: every line stays on. */
  onToggle?: (id: string) => void;
  decimals: number;
}

/**
 * The legend above a multi-line plot: each entry shows its own dash and its latest value, and is
 * a toggle when the plot lets lines be hidden.
 */
export function LineLegend({ series, hidden, onToggle, decimals }: LineLegendProps) {
  return (
    <div
      role="group"
      aria-label={COPY.chart.legend}
      className={onToggle ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-x-4 gap-y-1.5'}
    >
      {series.map((line, index) => {
        const style = lineStyle(index);
        const end = line.points.at(-1);
        const shown = !hidden.has(line.id);
        const body = (
          <>
            <svg width="20" height="8" aria-hidden="true" className="shrink-0">
              <line
                x1="0"
                x2="20"
                y1="4"
                y2="4"
                stroke={style.stroke}
                strokeWidth="2.5"
                strokeDasharray={style.dash || undefined}
              />
            </svg>
            {line.label}
            {end ? (
              <span className="font-mono text-[0.6875rem] font-medium text-ink-3">
                {formatValue(end.y, decimals)}
              </span>
            ) : null}
          </>
        );
        return onToggle ? (
          <Chip key={line.id} selected={shown} onSelectedChange={() => onToggle(line.id)}>
            {body}
          </Chip>
        ) : (
          <span
            key={line.id}
            className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-ink"
          >
            {body}
          </span>
        );
      })}
    </div>
  );
}
