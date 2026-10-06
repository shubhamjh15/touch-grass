'use client';

import { useMemo } from 'react';
import type { Impact } from '@/game';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import { COPY } from '../copy';
import { trendRows, type TableData } from '../model';
import { ChartCard } from './ChartCard';
import { LazyLineSeriesChart } from './plots';

const TICKS = [0, 2, 4, 6, 8, 11];

/** Twelve weeks of estimated kg avoided, the newest at the right with a yellow end marker. */
export function TrendCard({ impact }: { impact: Impact }) {
  const rows = useMemo(() => trendRows(impact.weeks), [impact.weeks]);
  const lines = useMemo(
    () => [
      {
        id: 'kg',
        label: 'Estimated kg avoided',
        style: 0,
        points: rows.map((row, index) => ({ x: index, y: row.kg })),
      },
    ],
    [rows],
  );
  const table: TableData = useMemo(
    () => ({
      columns: ['Week of', 'kg avoided (est.)', 'Rings', 'Acts'],
      rows: [...rows]
        .reverse()
        .map((row) => [
          row.label,
          row.kg > 0 ? formatCo2Estimate(row.kg) : '—',
          formatNumber(row.rings),
          formatNumber(row.acts),
        ]),
    }),
    [rows],
  );
  return (
    <ChartCard
      fig="FIG. 02"
      title={COPY.trend.title}
      unit="Estimated kg CO2e a week"
      plot={
        <LazyLineSeriesChart
          lines={lines}
          decimals={1}
          unit="kg a week"
          fromZero
          xTicks={TICKS}
          xLabel={(index) => rows[Math.round(index)]?.label ?? ''}
          label="Estimated kilograms avoided each week, last twelve weeks"
        />
      }
      table={table}
      tableCaption="Estimated kilograms avoided each week, newest first"
      caption={COPY.trend.caption}
    />
  );
}
