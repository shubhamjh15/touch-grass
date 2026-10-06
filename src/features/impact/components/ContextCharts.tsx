'use client';

import { useMemo, useState } from 'react';
import { DATASET_BY_ID, type Dataset } from '@/data/datasets';
import { formatLongDate } from '@/lib/format';
import { Tag } from '@/ui';
import { COPY } from '../copy';
import { WORLD_CHARTS, datasetSeries, seriesTable, type WorldChartSpec } from '../model';
import { ChartCard } from './ChartCard';
import { LineLegend } from './LineLegend';
import { LazyLineSeriesChart } from './plots';

const BUNDLED_TAG = (
  <Tag hue="yellow" aria-label={COPY.planet.bundled}>
    {COPY.planet.bundled}
  </Tag>
);

/** Where the numbers come from: who, which years, when we fetched them, and what to be careful of. */
function SourceNote({ dataset, years }: { dataset: Dataset; years?: string }) {
  return (
    <div className="grid gap-2">
      <p>
        <span className="type-slug">{COPY.chart.source}</span> {dataset.source}
        {years ? ` · ${years}` : ''} · {COPY.chart.retrieved} {formatLongDate(dataset.retrieved)}
      </p>
      {dataset.notes.length > 0 ? (
        <details className="group/notes">
          <summary className="inline-flex min-h-11 cursor-pointer items-center type-slug text-ink-2 underline-offset-4 focus-inset hover:underline">
            {COPY.chart.notes}
          </summary>
          <ul className="mt-1 grid list-disc gap-1.5 pl-5 text-ink-2">
            {dataset.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li>{dataset.citation}</li>
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ContextChart({
  spec,
  dataset,
  fig,
}: {
  spec: WorldChartSpec;
  dataset: Dataset;
  fig: string;
}) {
  const series = useMemo(() => datasetSeries(dataset), [dataset]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        spec.visible
          ? series.filter((line) => !spec.visible?.includes(line.id)).map((line) => line.id)
          : [],
      ),
  );
  const toggle = (id: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (series.length - next.size > 1) next.add(id);
      return next;
    });
  };
  const lines = useMemo(
    () =>
      series
        .map((line, index) => ({ ...line, style: index }))
        .filter((line) => !hidden.has(line.id)),
    [series, hidden],
  );
  const decimals = dataset.kind === 'snapshot' ? 1 : dataset.decimals;
  const table = useMemo(
    () => seriesTable(lines, decimals, spec.unit),
    [lines, decimals, spec.unit],
  );
  const first = series[0]?.points[0]?.x;
  const last = series[0]?.points.at(-1)?.x;

  return (
    <ChartCard
      fig={fig}
      title={spec.title}
      unit={spec.unit}
      tag={BUNDLED_TAG}
      legend={
        series.length > 1 ? (
          <LineLegend series={series} hidden={hidden} onToggle={toggle} decimals={decimals} />
        ) : undefined
      }
      plot={
        <LazyLineSeriesChart
          lines={lines}
          decimals={decimals}
          unit={spec.unit}
          fromZero={spec.fromZero}
          label={`${spec.title}, ${spec.unit}, ${first ?? ''} to ${last ?? ''}`}
        />
      }
      table={table}
      tableCaption={`${spec.title}, ${spec.unit}, one row per year`}
      caption={dataset.takeaway}
      footer={
        <SourceNote dataset={dataset} years={first && last ? `${first}–${last}` : undefined} />
      }
    />
  );
}

/**
 * The slower-moving background to the live readings: public datasets saved with the app, so
 * they work offline. Each wears a yellow "saved with the app" tag so nobody takes them for live.
 */
export function ContextCharts({ firstFig }: { firstFig: number }) {
  const charts = WORLD_CHARTS.flatMap((spec) => {
    const dataset = DATASET_BY_ID.get(spec.id);
    return dataset ? [{ spec, dataset }] : [];
  });
  return (
    <div className="grid gap-8">
      {(['problem', 'turn'] as const).map((group) => (
        <section key={group} aria-label={COPY.planet.groups[group].title} className="grid gap-4">
          <div>
            <h3 className="text-h3">{COPY.planet.groups[group].title}</h3>
            <p className="mt-1 text-body-sm text-ink-2">{COPY.planet.groups[group].lead}</p>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {charts.map(({ spec, dataset }, index) =>
              spec.group === group ? (
                <ContextChart
                  key={spec.id}
                  spec={spec}
                  dataset={dataset}
                  fig={`FIG. ${String(firstFig + index).padStart(2, '0')}`}
                />
              ) : null,
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
