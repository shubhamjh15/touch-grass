'use client';

import { ChevronDown, RefreshCw } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ROUTES } from '@/app/routes';
import { PageSection } from '@/app/shell';
import { useBaseline, useGameNow, useProfile } from '@/game';
import { BRAND } from '@/lib/brand';
import { formatDecimal } from '@/lib/format';
import { Button, Card, ErrorState, TextLink } from '@/ui';
import type { ClimatePayload, SignalMeta } from '../climate/contract';
import {
  co2Caption,
  co2Series,
  co2Table,
  co2Ticks,
  freshness,
  gasReadings,
  headlineReadings,
  monthXLabel,
  ownRow,
  perPersonTable,
  personBars,
  sourceLine,
  temperatureCaption,
  temperatureSeries,
  temperatureTable,
  type PersonBar,
} from '../climate/model';
import type { ClimateState } from '../climate/useClimate';
import { COPY } from '../copy';
import { WORLD_CHARTS } from '../model';
import { ChartCard } from './ChartCard';
import { ContextCharts } from './ContextCharts';
import { LineLegend } from './LineLegend';
import { LiveBadge } from './LiveBadge';
import { LazyHBarChart, LazyLineSeriesChart } from './plots';
import { ReadingTile, ReadingTileSkeleton } from './ReadingTile';

const NONE: ReadonlySet<string> = new Set();

/** Who published a figure, with a link, and whether this copy of it is live. */
function LiveSource({
  signal,
  now,
  bundled,
}: {
  signal: SignalMeta;
  now: number;
  bundled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="min-w-0">
        <span className="type-slug">{COPY.chart.source}</span>{' '}
        <a
          href={signal.source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-ink-4 underline-offset-4 focus-inset hover:text-ink hover:decoration-ink"
        >
          {sourceLine(signal)}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        {' · '}
        {signal.source.name}
      </p>
      <LiveBadge state={freshness(signal, now, bundled)} />
    </div>
  );
}

function Headline({
  payload,
  regionId,
  now,
  bundled,
  notice,
}: {
  payload: ClimatePayload;
  regionId: string;
  now: number;
  bundled: boolean;
  notice: ReactNode;
}) {
  const readings = useMemo(() => headlineReadings(payload, regionId), [payload, regionId]);
  return (
    <Card padded={false} featured plate="blue" role="group" aria-label={COPY.planet.title}>
      <div className="grid gap-2 px-4 pt-4 pb-4 md:px-5 md:pt-5">
        <p className="type-slug text-ink-3">{COPY.planet.slug}</p>
        <p className="max-w-prose text-body-sm text-ink-2">
          {COPY.planet.intro} {BRAND.name}.
        </p>
        {notice}
      </div>
      <dl className="grid border-t-2 border-dashed border-ink md:grid-cols-3">
        {readings.map((reading) => (
          <ReadingTile
            key={reading.id}
            reading={reading}
            state={freshness(reading.signal, now, bundled)}
          />
        ))}
      </dl>
    </Card>
  );
}

function HeadlineSkeleton() {
  return (
    <Card padded={false} featured plate="blue" aria-busy="true" aria-label={COPY.planet.loading}>
      <div className="grid gap-2 px-4 pt-4 pb-4 md:px-5 md:pt-5">
        <p className="type-slug text-ink-3">{COPY.planet.slug}</p>
        <p role="status" className="max-w-prose text-body-sm text-ink-2">
          {COPY.planet.loading}
        </p>
      </div>
      <div className="grid border-t-2 border-dashed border-ink md:grid-cols-3">
        <ReadingTileSkeleton />
        <ReadingTileSkeleton />
        <ReadingTileSkeleton />
      </div>
    </Card>
  );
}

const BAR_FILL: Record<PersonBar['role'], string> = {
  you: 'var(--color-yellow)',
  region: 'var(--color-green-deep)',
  world: 'var(--color-blue-deep)',
};

const BAR_DETAIL: Record<PersonBar['role'], string> = {
  you: 'Your starting line, from the quiz',
  region: 'Average per person',
  world: 'World average per person',
};

function PerPerson({
  payload,
  regionId,
  now,
  bundled,
}: {
  payload: ClimatePayload;
  regionId: string;
  now: number;
  bundled: boolean;
}) {
  const baseline = useBaseline();
  const signal = payload.perPerson;
  const tonnes = baseline?.result.tonnes.total ?? null;
  const bars = useMemo(() => personBars(signal, regionId, tonnes), [signal, regionId, tonnes]);
  const table = useMemo(() => perPersonTable(signal), [signal]);
  const own = ownRow(signal, regionId);
  // A stable array: a new one on every render would restart the bars' entrance and hide their labels.
  const rows = useMemo(
    () =>
      bars.map((bar) => ({
        id: bar.id,
        label: bar.label.length > 18 ? `${bar.label.slice(0, 17)}…` : bar.label,
        value: bar.value,
        fill: BAR_FILL[bar.role],
        // The drawn approximate mark cannot go inside the plot, so the estimate says so in letters.
        text: `${bar.role === 'you' ? 'est. ' : ''}${formatDecimal(bar.value, 1)} t`,
        detail: BAR_DETAIL[bar.role],
      })),
    [bars],
  );
  return (
    <ChartCard
      fig="FIG. 03"
      title={own ? `${own.name} and the world` : 'The world average'}
      unit={`t CO2 per person a year · ${signal.world.year}`}
      plotClassName={bars.length > 2 ? 'h-40' : 'h-32'}
      plot={
        <LazyHBarChart
          label={`CO2 per person a year: ${bars
            .map((bar) => `${bar.label} ${formatDecimal(bar.value, 1)} tonnes`)
            .join(', ')}`}
          nameWidth={own && own.name.length > 14 ? 132 : 96}
          labelRoom={84}
          barSize={22}
          rows={rows}
        />
      }
      table={table}
      tableCaption="CO2 per person a year by place, tonnes, highest first"
      tableLabel={COPY.planet.allPlaces}
      caption={
        <>
          {tonnes === null ? (
            <>
              {COPY.planet.noBaseline}{' '}
              <TextLink href={`${ROUTES.me}#starting-line`}>{COPY.pace.quizAction}</TextLink>.{' '}
            </>
          ) : (
            `${COPY.planet.youNote} `
          )}
          {own ? '' : `${COPY.planet.noRegion} `}
          {COPY.planet.perPersonNote}
        </>
      }
      footer={<LiveSource signal={signal} now={now} bundled={bundled} />}
    />
  );
}

function Gases({
  payload,
  now,
  bundled,
}: {
  payload: ClimatePayload;
  now: number;
  bundled: boolean;
}) {
  const readings = useMemo(() => gasReadings(payload), [payload]);
  return (
    <Card padded={false}>
      <dl className="grid md:grid-cols-2">
        {readings.map((reading) => (
          <ReadingTile
            key={reading.id}
            size="md"
            reading={reading}
            state={freshness(reading.signal, now, bundled)}
          />
        ))}
      </dl>
    </Card>
  );
}

/** The slower background charts stay one tap away: there, not in the way. */
function Context() {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-5">
      <div>
        <Button
          variant="neutral"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="impact-context-charts"
        >
          {open ? COPY.planet.hideContext : `${COPY.planet.showContext} (${WORLD_CHARTS.length})`}
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </Button>
      </div>
      <div id="impact-context-charts" hidden={!open}>
        {open ? <ContextCharts firstFig={4} /> : null}
      </div>
    </div>
  );
}

/**
 * "The planet right now": three live readings from NASA, NOAA and the World Bank, the long
 * record behind two of them, where the user's country and their own starting line sit, two more
 * gases, and the bundled background charts on request. The numbers come through our own server;
 * each one says who published it, what date it is for, and whether it is live or a saved copy.
 */
export function PlanetView({ climate, onRetry }: { climate: ClimateState; onRetry: () => void }) {
  const profile = useProfile();
  const now = useGameNow();

  if (climate.phase === 'error')
    return (
      <div className="grid gap-8 lg:gap-10">
        <ErrorState title={COPY.planet.errorTitle} body={COPY.planet.errorBody} onRetry={onRetry} />
        <PageSection title={COPY.planet.contextTitle} lead={COPY.planet.contextLead}>
          <Context />
        </PageSection>
      </div>
    );

  if (climate.phase === 'loading')
    return (
      <div className="grid gap-8 lg:gap-10">
        <HeadlineSkeleton />
        <PageSection title={COPY.planet.contextTitle} lead={COPY.planet.contextLead}>
          <Context />
        </PageSection>
      </div>
    );

  const { payload } = climate;
  const bundled = climate.origin === 'bundled';
  const notice = bundled ? (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm border-2 border-dashed border-ink-3 bg-paper px-3 py-2"
    >
      <p className="min-w-0 flex-1 basis-56 text-body-sm">{COPY.planet.bundledNotice}</p>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" />
        {COPY.planet.retry}
      </Button>
    </div>
  ) : null;

  return (
    <div className="grid gap-8 lg:gap-10">
      <Headline
        payload={payload}
        regionId={profile.region}
        now={now}
        bundled={bundled}
        notice={notice}
      />
      <PageSection title={COPY.planet.recordTitle} lead={COPY.planet.recordLead}>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <TemperatureChart payload={payload} now={now} bundled={bundled} />
          <Co2Chart payload={payload} now={now} bundled={bundled} />
        </div>
      </PageSection>
      <PageSection title={COPY.planet.personTitle} lead={COPY.planet.personLead}>
        <PerPerson payload={payload} regionId={profile.region} now={now} bundled={bundled} />
      </PageSection>
      <PageSection title={COPY.planet.gasesTitle} lead={COPY.planet.gasesLead}>
        <Gases payload={payload} now={now} bundled={bundled} />
      </PageSection>
      <PageSection title={COPY.planet.contextTitle} lead={COPY.planet.contextLead}>
        <Context />
      </PageSection>
    </div>
  );
}

interface ChartProps {
  payload: ClimatePayload;
  now: number;
  bundled: boolean;
}

function TemperatureChart({ payload, now, bundled }: ChartProps) {
  const signal = payload.temperature;
  const lines = useMemo(
    () => temperatureSeries(signal).map((line, index) => ({ ...line, style: index })),
    [signal],
  );
  const table = useMemo(() => temperatureTable(signal), [signal]);
  const first = signal.annual[0]?.year;
  const last = signal.annual.at(-1)?.year;
  return (
    <ChartCard
      fig="FIG. 01"
      title="A warmer planet"
      unit="°C against the 1951 to 1980 average"
      plot={
        <LazyLineSeriesChart
          lines={lines}
          decimals={2}
          unit="°C"
          zeroLine
          label={`Global temperature, one point a year from ${first ?? ''} to ${last ?? ''}, in degrees Celsius against the 1951 to 1980 average`}
        />
      }
      table={table}
      tableCaption="Global temperature by year, degrees Celsius against the 1951 to 1980 average, newest first"
      caption={temperatureCaption(signal)}
      footer={<LiveSource signal={signal} now={now} bundled={bundled} />}
    />
  );
}

function Co2Chart({ payload, now, bundled }: ChartProps) {
  const signal = payload.co2;
  const series = useMemo(() => co2Series(signal), [signal]);
  const lines = useMemo(() => series.map((line, index) => ({ ...line, style: index })), [series]);
  const ticks = useMemo(() => co2Ticks(signal), [signal]);
  const table = useMemo(() => co2Table(signal), [signal]);
  return (
    <ChartCard
      fig="FIG. 02"
      title="CO2 in the air"
      unit="ppm, global monthly mean"
      legend={<LineLegend series={series} hidden={NONE} decimals={1} />}
      plot={
        <LazyLineSeriesChart
          lines={lines}
          decimals={1}
          unit="ppm"
          xTicks={ticks}
          xLabel={monthXLabel}
          label="CO2 in the atmosphere by month, in parts per million: the trend and the seasonal cycle"
        />
      }
      table={table}
      tableCaption="CO2 in the atmosphere by month, parts per million, newest first"
      caption={co2Caption(signal)}
      footer={<LiveSource signal={signal} now={now} bundled={bundled} />}
    />
  );
}
