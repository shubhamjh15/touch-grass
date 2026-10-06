'use client';

import { useMemo } from 'react';
import type { Impact } from '@/game';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import { COPY } from '../copy';
import { categoryRows, type TableData } from '../model';
import { ChartCard } from './ChartCard';
import { LazyHBarChart } from './plots';

/** Where the estimated savings come from: seven bars in the canonical category order. */
export function CategoryCard({ impact }: { impact: Impact }) {
  const rows = useMemo(() => categoryRows(impact), [impact]);
  // A stable array: a new one on every render would restart the bars' entrance and hide their labels.
  const bars = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        label: row.label,
        value: row.kg,
        fill: row.fill,
        text: row.text,
        detail: `${formatNumber(row.acts)} ${row.acts === 1 ? 'act' : 'acts'}`,
      })),
    [rows],
  );
  const table: TableData = useMemo(
    () => ({
      columns: ['Category', 'kg avoided (est.)', 'Acts'],
      rows: rows.map((row) => [
        row.label,
        row.kg > 0 ? formatCo2Estimate(row.kg) : row.acts > 0 ? COPY.categories.unquantified : '—',
        formatNumber(row.acts),
      ]),
    }),
    [rows],
  );
  return (
    <ChartCard
      fig="FIG. 01"
      title={COPY.categories.title}
      unit="Estimated kg CO2e avoided"
      plotClassName="h-64"
      plot={<LazyHBarChart label="Estimated kilograms avoided, by category" rows={bars} />}
      table={table}
      tableCaption="Estimated kilograms avoided and acts, by category"
      caption={COPY.categories.caption}
    />
  );
}
