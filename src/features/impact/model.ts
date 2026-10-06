/**
 * Pure helpers for /impact: the words and small derivations between the game's read models and
 * the screen. Nothing here touches the store, the DOM or Recharts.
 */
import { ROUTES } from '@/app/routes';
import { FACTORS_VERSION } from '@/data/content';
import type { Dataset, MultiSeriesDataset, SeriesDataset } from '@/data/datasets';
import type { DayImpact, Equivalence, Impact, PaceResult, WeekImpact } from '@/game';
import { addDays, parseDayKey, startOfWeek, type DayKey } from '@/lib/dates';
import { formatCo2Estimate, formatDecimal, formatNumber, pluralize } from '@/lib/format';
import { CATEGORY, CATEGORY_ORDER, type CategoryId, type EstimateSource } from '@/ui';

const LOCALE = 'en-US';
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const monthShort = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const sinceFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

// ── The two views ───────────────────────────────────────────────────────────

export type ImpactView = 'you' | 'planet';
export const VIEW_PARAM = 'view';

export function parseView(value: string | null): ImpactView {
  // `world` was this view's first name: links that still say it keep working.
  return value === 'planet' || value === 'world' ? 'planet' : 'you';
}

/** The link for a view, keeping any other query parameters. */
export function viewHref(view: ImpactView, query: string): string {
  const params = new URLSearchParams(query);
  if (view === 'you') params.delete(VIEW_PARAM);
  else params.set(VIEW_PARAM, view);
  const text = params.toString();
  return text ? `${ROUTES.impact}?${text}` : ROUTES.impact;
}

/** "SINCE 24 SEP 2026": the slug above the title. */
export function sinceSlug(plantedDay: DayKey | null): string {
  return plantedDay
    ? `SINCE ${sinceFormat.format(parseDayKey(plantedDay)).toUpperCase()}`
    : 'YOUR IMPACT';
}

/** "28 Sep": a short date for chart ticks and week labels. */
export function shortDate(day: DayKey): string {
  return dayMonth.format(parseDayKey(day));
}

/** "28 Sep – 4 Oct". */
export function weekRange(monday: DayKey): string {
  return `${shortDate(monday)} – ${shortDate(addDays(monday, 6))}`;
}

// ── The honest slip behind every total ──────────────────────────────────────

/** How the headline total is made: what the mark beside the hero figure opens. */
export function totalsSource(
  impact: Pick<Impact, 'kg' | 'aiKg' | 'logs' | 'byCategory'>,
): EstimateSource {
  const counted = impact.byCategory.reduce((sum, row) => sum + row.acts, 0);
  const aiNote =
    impact.aiKg > 0
      ? ` AI estimates of custom actions (${formatCo2Estimate(impact.aiKg)}) are kept apart and never added in.`
      : '';
  return {
    code: `FACTORS ${FACTORS_VERSION}`,
    kind: 'factor',
    formula:
      impact.kg > 0
        ? `${pluralize(impact.logs, 'log')}, each quantity × its factor = ${formatCo2Estimate(impact.kg)}`
        : 'Nothing with a sourced estimate is logged yet.',
    comparedWith: `Each action is compared with what it replaced: the drive not taken, the dryer left off. You report it, we estimate it. ${pluralize(counted, 'act')} counted so far.${aiNote}`,
    sourceLabel: 'Our factor table',
    href: ROUTES.methodology,
  };
}

// ── Charts: data in, plain rows out ─────────────────────────────────────────

export interface CategoryRow {
  id: CategoryId;
  label: string;
  kg: number;
  acts: number;
  /** Chart ink for the bar. */
  fill: string;
  /** What prints at the end of the bar. */
  text: string;
}

/** The seven categories in the canonical order, so neighbouring colours always separate. */
export function categoryRows(impact: Pick<Impact, 'byCategory'>): CategoryRow[] {
  return CATEGORY_ORDER.map((id) => {
    const row = impact.byCategory.find((entry) => entry.category === id);
    const kg = row?.kg ?? 0;
    const acts = row?.acts ?? 0;
    const style = CATEGORY[id];
    return {
      id,
      label: style.label,
      kg,
      acts,
      fill: style.markVar,
      text: kg > 0 ? formatCo2Estimate(kg) : acts > 0 ? 'not quantified' : '',
    };
  });
}

export interface TrendRow {
  x: string;
  label: string;
  kg: number;
  rings: number;
  acts: number;
}

export function trendRows(weeks: readonly WeekImpact[]): TrendRow[] {
  return weeks.map((week) => ({
    x: week.monday,
    label: shortDate(week.monday),
    kg: Math.round(week.kg * 100) / 100,
    rings: week.rings,
    acts: week.acts,
  }));
}

// ── The activity heatmap ────────────────────────────────────────────────────

export type HeatKind = 'full' | 'ring' | 'rain' | 'rest' | 'none';

export interface HeatCell {
  day: DayKey;
  kind: HeatKind;
  kg: number;
  logs: number;
  /** Position in the flat list of real days, for arrow-key moves. */
  index: number;
}

export function heatKind(entry: Pick<DayImpact, 'mark'>): HeatKind {
  switch (entry.mark) {
    case 'full':
    case 'ring':
    case 'rain':
    case 'rest':
      return entry.mark;
    case 'missed':
    case 'none':
      return 'none';
  }
}

export interface HeatGrid {
  /** Seven rows by N columns, Monday first, in column order. `null` pads the first and last week. */
  slots: (HeatCell | null)[];
  columns: number;
  cells: HeatCell[];
  /** Where a month's name goes: the first column that starts it. */
  months: { column: number; label: string }[];
}

export function heatGrid(heatmap: readonly DayImpact[]): HeatGrid {
  const cells: HeatCell[] = heatmap.map((entry, index) => ({
    day: entry.day,
    kind: heatKind(entry),
    kg: entry.kg,
    logs: entry.logs,
    index,
  }));
  const first = cells[0];
  if (!first) return { slots: [], columns: 0, cells, months: [] };
  const lead = (parseDayKey(first.day).getDay() + 6) % 7;
  const slots: (HeatCell | null)[] = [...Array.from({ length: lead }, () => null), ...cells];
  while (slots.length % 7 !== 0) slots.push(null);
  const columns = slots.length / 7;
  const months: HeatGrid['months'] = [];
  let lastMonth = -1;
  for (let column = 0; column < columns; column += 1) {
    const monday = parseDayKey(addDays(startOfWeek(first.day), column * 7));
    if (monday.getMonth() !== lastMonth) {
      months.push({ column, label: monthShort.format(monday) });
      lastMonth = monday.getMonth();
    }
  }
  return { slots, columns, cells, months };
}

const HEAT_WORDS: Record<HeatKind, string> = {
  full: 'full ring',
  ring: 'ring',
  rain: 'rain day',
  rest: 'rest day',
  none: 'no ring',
};

export function heatWord(kind: HeatKind): string {
  return HEAT_WORDS[kind];
}

/** "Mon 5 Oct". */
export function heatDay(day: DayKey): string {
  const date = parseDayKey(day);
  return `${weekdayShort.format(date)} ${dayMonth.format(date)}`;
}

/** "Mon 5 Oct, full ring, 3 logs, about 1.2 kg". Spoken, so no drawn glyph. */
export function heatLabel(cell: HeatCell): string {
  const parts = [heatDay(cell.day), HEAT_WORDS[cell.kind]];
  if (cell.logs > 0) parts.push(pluralize(cell.logs, 'log'));
  if (cell.kg > 0) parts.push(`about ${formatCo2Estimate(cell.kg)}`);
  return parts.join(', ');
}

/** The days worth a row in the heatmap's table: anything that happened, newest first. */
export function heatTableRows(cells: readonly HeatCell[], limit = 60): HeatCell[] {
  return cells
    .filter((cell) => cell.kind !== 'none' || cell.logs > 0)
    .slice(-limit)
    .reverse();
}

// ── Pace ────────────────────────────────────────────────────────────────────

export type PaceCard =
  | { kind: 'quiz' }
  | { kind: 'waiting'; active: number; needed: number }
  | {
      kind: 'ok';
      /** Share of the starting line already logged, 0..1. */
      measured: number;
      /** Share the year would reach at this pace, 0..1; `null` above one half. */
      projected: number | null;
      baselineTonnes: number;
    };

export function paceCard(pace: PaceResult): PaceCard {
  switch (pace.status) {
    case 'no-baseline':
      return { kind: 'quiz' };
    case 'not-enough-data':
      return {
        kind: 'waiting',
        active: Math.min(pace.activeDays, pace.neededActiveDays),
        needed: pace.neededActiveDays,
      };
    case 'ok': {
      const baselineKg = pace.baselineTonnes * 1000;
      const logged = pace.recurringKg + pace.occasionalKg;
      return {
        kind: 'ok',
        measured: baselineKg > 0 ? Math.min(1, logged / baselineKg) : 0,
        projected: pace.pacePct > 0.5 ? null : pace.pacePct,
        baselineTonnes: pace.baselineTonnes,
      };
    }
  }
}

// ── The world charts ────────────────────────────────────────────────────────

export interface ChartSeries {
  id: string;
  label: string;
  points: { x: number; y: number }[];
}

export interface WorldChartSpec {
  id: string;
  title: string;
  /** The unit printed under the title and on the table's value column. */
  unit: string;
  group: 'problem' | 'turn';
  /** The value axis starts at zero (shares, prices, capacity); the others zoom on their own range. */
  fromZero: boolean;
  /** Series ids shown at first; the legend toggles the rest. */
  visible?: readonly string[];
}

/**
 * Friendly names for the bundled datasets, in the order the page shows them. The bundled
 * temperature record is not listed: the live NASA series on the same page covers it.
 */
export const WORLD_CHARTS: readonly WorldChartSpec[] = [
  {
    id: 'atmospheric_co2_mauna_loa',
    title: 'CO2 at Mauna Loa since 1959',
    unit: 'ppm, yearly mean',
    group: 'problem',
    fromZero: false,
  },
  {
    id: 'fossil_co2_emissions_world',
    title: 'CO2 from fossil fuels',
    unit: 'Gt CO2 a year',
    group: 'problem',
    fromZero: true,
  },
  {
    id: 'electricity_mix_world',
    title: 'Clean power’s share',
    unit: '% of electricity',
    group: 'turn',
    fromZero: true,
    visible: ['renewables', 'windAndSolar', 'coal'],
  },
  {
    id: 'solar_module_price',
    title: 'Solar got cheap',
    unit: 'US$ per watt, 2025 dollars',
    group: 'turn',
    fromZero: true,
  },
  {
    id: 'solar_capacity_world',
    title: 'Solar keeps growing',
    unit: 'GW installed',
    group: 'turn',
    fromZero: true,
  },
  {
    id: 'ev_sales_share',
    title: 'Electric cars in new sales',
    unit: '% of new cars',
    group: 'turn',
    fromZero: true,
    visible: ['world', 'china', 'european-union', 'united-states'],
  },
];

const ELECTRICITY_FIELDS = ['renewables', 'windAndSolar', 'solar', 'wind', 'coal'] as const;

/** The lines a dataset can draw. Percent shares and TWh never share one axis, so only percent fields are offered. */
export function datasetSeries(dataset: Dataset): ChartSeries[] {
  switch (dataset.kind) {
    case 'series':
      return seriesOf(dataset);
    case 'multi':
      return multiOf(dataset);
    case 'snapshot':
      return [];
  }
}

function seriesOf(dataset: SeriesDataset): ChartSeries[] {
  const hasComparisons = dataset.comparisons.length > 0;
  return [
    {
      id: hasComparisons ? 'world' : 'main',
      label: hasComparisons ? 'World' : dataset.title,
      points: dataset.series.map((point) => ({ x: point.year, y: point.value })),
    },
    ...dataset.comparisons.map((entry) => ({
      id: entry.id,
      label: entry.label,
      points: entry.series.map((point) => ({ x: point.year, y: point.value })),
    })),
  ];
}

function multiOf(dataset: MultiSeriesDataset): ChartSeries[] {
  return ELECTRICITY_FIELDS.flatMap((key) => {
    const field = dataset.fields.find((entry) => entry.key === key);
    if (!field) return [];
    return [
      {
        id: key,
        label: field.label,
        points: dataset.series.flatMap((point) => {
          const value = point[key];
          return typeof value === 'number' ? [{ x: point.year, y: value }] : [];
        }),
      },
    ];
  });
}

export function formatValue(value: number, decimals: number): string {
  return Math.abs(value) >= 1000 ? formatNumber(Math.round(value)) : formatDecimal(value, decimals);
}

export interface TableData {
  columns: string[];
  rows: string[][];
}

/** One row per year with a column per line: the real `<table>` that stands in for the plot. */
export function seriesTable(
  series: readonly ChartSeries[],
  decimals: number,
  unit: string,
): TableData {
  const years = [...new Set(series.flatMap((line) => line.points.map((point) => point.x)))].sort(
    (a, b) => b - a,
  );
  const lookups = series.map((line) => new Map(line.points.map((point) => [point.x, point.y])));
  return {
    columns: [
      'Year',
      ...series.map((line) => (series.length === 1 ? unit : `${line.label} (${unit})`)),
    ],
    rows: years.map((year) => [
      String(year),
      ...lookups.map((lookup) => {
        const value = lookup.get(year);
        return value === undefined ? '—' : formatValue(value, decimals);
      }),
    ]),
  };
}

// ── History ─────────────────────────────────────────────────────────────────

export const HISTORY_PAGE = 25;

// ── Small figures ───────────────────────────────────────────────────────────

/** A mass at two significant figures, split into number and unit: "48" and "kg". */
export function kgParts(kg: number): { value: string; unit: string } {
  const text = formatCo2Estimate(kg);
  const split = text.lastIndexOf(' ');
  return { value: text.slice(0, split), unit: text.slice(split + 1) };
}

const EQUIVALENCE_LABEL: Record<string, string> = {
  'car-km': 'Driving an average car',
  'flight-km': 'Flying short-haul, economy',
  'smartphone-charges': 'Charging a smartphone',
  'kettle-boils': 'Boiling a kettle',
  'hot-shower-minutes': 'A hot shower, gas-heated',
  'beef-grams': 'Eating beef',
  'daily-1p5-budget': 'A 1.5 °C lifestyle budget',
  'world-average-person-day': 'The average person’s day',
};

/** One receipt line for an equivalence: what it is and the amount, without the leading "≈". */
export function equivalenceRow(item: Pick<Equivalence, 'id' | 'short'>): {
  label: string;
  value: string;
} {
  const body = item.short.replace(/^≈\s*/, '');
  const match = /^([\d.,]+%?)\s*(.*)$/.exec(body);
  const amount = match?.[1] ?? body;
  const rest = match?.[2] ?? '';
  const unit = (() => {
    switch (item.id) {
      case 'car-km':
      case 'flight-km':
        return ' km';
      case 'smartphone-charges':
        return amount === '1' ? ' charge' : ' charges';
      case 'kettle-boils':
        return ' L';
      case 'hot-shower-minutes':
        return ' min';
      case 'beef-grams':
        return rest.startsWith('kg') ? ' kg' : ' g';
      case 'daily-1p5-budget':
        return amount.endsWith('%') ? ' of a day' : amount === '1' ? ' day' : ' days';
      case 'world-average-person-day':
        return amount === '1' ? ' day' : ' days';
      default:
        return '';
    }
  })();
  return { label: EQUIVALENCE_LABEL[item.id] ?? rest, value: `${amount}${unit}` };
}

/** The heat mark a week-strip day wears. */
export function stripKind(mark: string): HeatKind {
  return mark === 'full' || mark === 'ring' || mark === 'rain' || mark === 'rest' ? mark : 'none';
}

/** "TUE 06 OCT 2026 · 14:32": the date line on the receipt, label-maker style. */
export function stampLine(moment: number, time: string): string {
  const date = new Date(moment);
  const day = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  return `${day} · ${time}`.toUpperCase();
}
