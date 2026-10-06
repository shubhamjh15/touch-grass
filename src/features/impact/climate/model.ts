/**
 * Pure helpers between a climate payload and the screen: what a badge says, how a reading is
 * worded, which rows a chart draws. No store, no DOM, no network.
 */
import { formatDecimal, formatPercent } from '@/lib/format';
import type { ChartSeries, TableData } from '../model';
import {
  isLive,
  type ClimatePayload,
  type Co2Signal,
  type GasSignal,
  type PerPersonRow,
  type PerPersonSignal,
  type SignalMeta,
  type TemperatureSignal,
} from './contract';

const LOCALE = 'en-US';
const UTC = { timeZone: 'UTC' } as const;
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: 'numeric', ...UTC });
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  ...UTC,
});

function utc(key: string): Date {
  const [year = 1970, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "Aug 2026" from `2026-08`. */
export function monthLabel(month: string): string {
  return monthYear.format(utc(month));
}

/** "5 Oct 2026" from `2026-10-05` or an ISO timestamp. */
export function dayLabel(day: string): string {
  const [, monthName = '', dayNumber = '', year = ''] =
    /^(\w+) (\d+), (\d+)$/.exec(dayMonthYear.format(day.length > 10 ? new Date(day) : utc(day))) ??
    [];
  return `${dayNumber} ${monthName} ${year}`;
}

/** A change or an anomaly with its sign always printed: "+1.40", "-0.20", "0.00". */
export function signed(value: number, decimals: number): string {
  const text = formatDecimal(value, decimals);
  return value > 0 && Number(text) !== 0 ? `+${text}` : text;
}

// ── Live or snapshot ────────────────────────────────────────────────────────

export type Freshness =
  { kind: 'live'; /** "6 Oct 2026" */ date: string } | { kind: 'snapshot'; date: string };

/**
 * What the badge on a reading says at `now`. `bundled` is true when the page is showing the
 * copy saved with the app: nothing from it is live, whatever its fields say.
 */
export function freshness(
  signal: Pick<SignalMeta, 'status' | 'fetchedAt'>,
  now: number,
  bundled = false,
): Freshness {
  const date = dayLabel(signal.fetchedAt);
  return !bundled && isLive(signal, now) ? { kind: 'live', date } : { kind: 'snapshot', date };
}

export function freshnessText(state: Freshness): string {
  return state.kind === 'live' ? 'Live' : `Snapshot from ${state.date}`;
}

/** "NASA Goddard Institute for Space Studies, via global-warming.org". */
export function sourceLine(signal: Pick<SignalMeta, 'source'>): string {
  const { publisher, via } = signal.source;
  return via ? `${publisher}, via ${via}` : publisher;
}

// ── Tiles ───────────────────────────────────────────────────────────────────

export interface Reading {
  id: string;
  label: string;
  /** The figure, already formatted: "+1.40". */
  value: string;
  unit: string;
  /** What exactly was measured, and when: "Aug 2026, against the 1951 to 1980 average". */
  context: string;
  /** How it moved: "+0.22 °C on Aug 2025". */
  change: string | null;
  signal: SignalMeta;
}

export function temperatureReading(signal: TemperatureSignal): Reading {
  const { latest, yearAgo } = signal;
  return {
    id: 'temperature',
    label: 'Global temperature',
    value: signed(latest.value, 2),
    unit: '°C',
    context: `${monthLabel(latest.month)}, against the 1951 to 1980 average`,
    change: yearAgo
      ? `${signed(latest.value - yearAgo.value, 2)} °C on ${monthLabel(yearAgo.month)}`
      : `Last 12 months: ${signed(signal.lastTwelve, 2)} °C`,
    signal,
  };
}

export function co2Reading(signal: Co2Signal): Reading {
  const { latest, yearAgo } = signal;
  return {
    id: 'co2',
    label: 'CO2 in the air',
    value: formatDecimal(latest.trend, 1),
    unit: 'ppm',
    context: `${dayLabel(latest.day)}, global average with the seasons removed`,
    change: yearAgo ? `${signed(latest.trend - yearAgo.trend, 1)} ppm in a year` : null,
    signal,
  };
}

export function gasReading(id: string, label: string, signal: GasSignal): Reading {
  const { latest, yearAgo } = signal;
  return {
    id,
    label,
    value: formatDecimal(latest.value, 1),
    unit: 'ppb',
    context: `${monthLabel(latest.month)}, global monthly mean`,
    change: yearAgo ? `${signed(latest.value - yearAgo.value, 1)} ppb in a year` : null,
    signal,
  };
}

/** The user's place, when the World Bank has a figure for it. `WORLD` has none of its own. */
export function ownRow(signal: PerPersonSignal, regionId: string): PerPersonRow | null {
  return signal.rows.find((row) => row.id === regionId) ?? null;
}

/** "54% below the world average", "2.9 times the world average", "About the world average". */
export function againstWorld(value: number, world: number): string {
  if (world <= 0) return '';
  const ratio = value / world;
  if (Math.abs(ratio - 1) < 0.03) return 'About the world average';
  if (ratio >= 1.5) return `${formatDecimal(ratio, 1)} times the world average`;
  return ratio > 1
    ? `${formatPercent(ratio - 1)} above the world average`
    : `${formatPercent(1 - ratio)} below the world average`;
}

export function perPersonReading(signal: PerPersonSignal, regionId: string): Reading {
  const own = ownRow(signal, regionId);
  const row = own ?? signal.world;
  return {
    id: 'perPerson',
    label: own ? `CO2 per person, ${own.name}` : 'CO2 per person, world',
    value: formatDecimal(row.value, 1),
    unit: 't a year',
    context: `${row.year}, from fuel and industry, without land use`,
    change: own
      ? `${againstWorld(own.value, signal.world.value)} (${formatDecimal(signal.world.value, 1)} t)`
      : null,
    signal,
  };
}

export function headlineReadings(payload: ClimatePayload, regionId: string): Reading[] {
  return [
    temperatureReading(payload.temperature),
    co2Reading(payload.co2),
    perPersonReading(payload.perPerson, regionId),
  ];
}

export function gasReadings(payload: ClimatePayload): Reading[] {
  return [
    gasReading('methane', 'Methane', payload.methane),
    gasReading('nitrousOxide', 'Nitrous oxide', payload.nitrousOxide),
  ];
}

// ── Charts ──────────────────────────────────────────────────────────────────

export function temperatureSeries(signal: TemperatureSignal): ChartSeries[] {
  return [
    {
      id: 'anomaly',
      label: 'Annual mean',
      points: signal.annual.map((entry) => ({ x: entry.year, y: entry.value })),
    },
  ];
}

/** The warmest complete year, and the latest one: the two facts the caption states. */
export function temperatureCaption(signal: TemperatureSignal): string {
  const latest = signal.annual.at(-1);
  if (!latest) return '';
  const warmest = signal.annual.reduce((best, entry) => (entry.value > best.value ? entry : best));
  const first = signal.annual[0];
  const record = `${warmest.year} is the warmest year on record at ${signed(warmest.value, 2)} °C.`;
  const tail =
    warmest.year === latest.year
      ? ''
      : ` The latest full year, ${latest.year}, came in at ${signed(latest.value, 2)} °C.`;
  return `Each point is one year${first ? ` since ${first.year}` : ''}, against the 1951 to 1980 average. ${record}${tail}`;
}

/** The middle of a month as a fraction of its year, so months sit evenly on a year axis. */
export function monthX(month: string): number {
  return Number(month.slice(0, 4)) + (Number(month.slice(5, 7)) - 0.5) / 12;
}

/** The axis prints whole years; a point between them is a month: "Aug 2026". */
export function monthXLabel(x: number): string {
  if (Number.isInteger(x)) return String(x);
  const year = Math.floor(x);
  const month = Math.min(12, Math.max(1, Math.round((x - year) * 12 + 0.5)));
  return monthLabel(`${year}-${String(month).padStart(2, '0')}`);
}

export function co2Series(signal: Co2Signal): ChartSeries[] {
  return [
    {
      id: 'trend',
      label: 'Trend',
      points: signal.monthly.map((entry) => ({ x: monthX(entry.month), y: entry.trend })),
    },
    {
      id: 'cycle',
      label: 'With the seasons',
      points: signal.monthly.map((entry) => ({ x: monthX(entry.month), y: entry.cycle })),
    },
  ];
}

/** Every other whole year inside the series, for the bottom axis. */
export function co2Ticks(signal: Co2Signal): number[] {
  const first = signal.monthly[0];
  const last = signal.monthly.at(-1);
  if (!first || !last) return [];
  const from = Math.ceil(monthX(first.month));
  const to = Math.floor(monthX(last.month));
  const ticks: number[] = [];
  for (let year = from; year <= to; year += 2) ticks.push(year);
  return ticks;
}

export function co2Caption(signal: Co2Signal): string {
  const first = signal.monthly[0];
  const last = signal.monthly.at(-1);
  if (!first || !last) return '';
  const rise = `${signed(last.trend - first.trend, 1)} ppm since ${monthLabel(first.month)}.`;
  return `${rise} The wavy line is the planet breathing: northern forests take CO2 in each summer and give it back each winter. The trend under it only goes one way.`;
}

export function temperatureTable(signal: TemperatureSignal): TableData {
  return {
    columns: ['Year', '°C against 1951 to 1980'],
    rows: [...signal.annual].reverse().map((entry) => [String(entry.year), signed(entry.value, 2)]),
  };
}

export function co2Table(signal: Co2Signal): TableData {
  return {
    columns: ['Month', 'Trend (ppm)', 'With the seasons (ppm)'],
    rows: [...signal.monthly]
      .reverse()
      .map((entry) => [
        monthLabel(entry.month),
        formatDecimal(entry.trend, 2),
        formatDecimal(entry.cycle, 2),
      ]),
  };
}

// ── Per person ──────────────────────────────────────────────────────────────

export interface PersonBar {
  id: string;
  label: string;
  value: number;
  year: number | null;
  role: 'you' | 'region' | 'world';
}

/**
 * The user's own starting line (when they took the quiz), their place and the world. The
 * starting line is a lifestyle estimate and the other two are national averages, so the page
 * says they are neighbours on a chart, not a like-for-like comparison.
 */
export function personBars(
  signal: PerPersonSignal,
  regionId: string,
  baselineTonnes: number | null,
): PersonBar[] {
  const own = ownRow(signal, regionId);
  const bars: PersonBar[] = [];
  if (baselineTonnes !== null && baselineTonnes > 0)
    bars.push({ id: 'you', label: 'You', value: baselineTonnes, year: null, role: 'you' });
  if (own)
    bars.push({ id: own.id, label: own.name, value: own.value, year: own.year, role: 'region' });
  bars.push({
    id: 'WORLD',
    label: 'World',
    value: signal.world.value,
    year: signal.world.year,
    role: 'world',
  });
  return bars;
}

/** Every place the World Bank answered for, highest first, with the world in its rank. */
export function perPersonTable(signal: PerPersonSignal): TableData {
  return {
    columns: ['Place', 't CO2 per person', 'Year'],
    rows: [...signal.rows, signal.world]
      .sort((a, b) => b.value - a.value)
      .map((row) => [row.name, formatDecimal(row.value, 1), String(row.year)]),
  };
}
