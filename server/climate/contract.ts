/**
 * The shape of GET /api/climate: a handful of public climate readings, each with where it came
 * from, when our server fetched it and whether that fetch is recent enough to be called live.
 * Dependency-free on purpose: the server, the bundled snapshot and the Impact page all read it.
 */

/** `live`: fetched from the publisher within the last day and a half. Anything else is a snapshot. */
export type ClimateStatus = 'live' | 'snapshot';

export interface ClimateSource {
  /** The dataset, as its publisher names it: "GISTEMP v4". */
  name: string;
  /** Who publishes it: "NASA GISS". */
  publisher: string;
  /** A page a person can read about the dataset. */
  url: string;
  /** Set when the numbers reached us through a mirror rather than the publisher's own file. */
  via?: string;
}

export interface SignalMeta {
  status: ClimateStatus;
  /** ISO timestamp of the moment our server received these numbers from the publisher. */
  fetchedAt: string;
  source: ClimateSource;
}

/** `YYYY-MM`. */
export type MonthKey = string;
/** `YYYY-MM-DD`. */
export type DateKey = string;

export interface MonthValue {
  month: MonthKey;
  value: number;
}

/** Global surface temperature against the 1951 to 1980 average, in degrees Celsius. */
export interface TemperatureSignal extends SignalMeta {
  baseline: '1951-1980';
  latest: MonthValue;
  /** The same month one year earlier, when the series has it. */
  yearAgo: MonthValue | null;
  /** The mean of the latest twelve months: steadier than one month. */
  lastTwelve: number;
  /** One mean per complete calendar year. */
  annual: { year: number; value: number }[];
}

/** CO2 in the atmosphere, global marine surface average, in parts per million. */
export interface Co2Signal extends SignalMeta {
  /** `trend` has the seasons removed; `cycle` keeps them. */
  latest: { day: DateKey; trend: number; cycle: number };
  yearAgo: { day: DateKey; trend: number } | null;
  /** Monthly means of the daily values. */
  monthly: { month: MonthKey; trend: number; cycle: number }[];
}

/** A long-lived greenhouse gas other than CO2, global monthly mean, in parts per billion. */
export interface GasSignal extends SignalMeta {
  latest: MonthValue;
  yearAgo: MonthValue | null;
}

export interface PerPersonRow {
  /** The app's region id (`IN`, `EU27`) or `WORLD`. */
  id: string;
  name: string;
  /** Tonnes of CO2 per person per year. */
  value: number;
  year: number;
}

/** CO2 per person by country: territorial emissions, without land-use change. */
export interface PerPersonSignal extends SignalMeta {
  world: PerPersonRow;
  rows: PerPersonRow[];
}

export interface ClimatePayload {
  version: 1;
  /** ISO timestamp of when this response was put together. */
  generatedAt: string;
  temperature: TemperatureSignal;
  co2: Co2Signal;
  methane: GasSignal;
  nitrousOxide: GasSignal;
  perPerson: PerPersonSignal;
}

export type SignalId = Exclude<keyof ClimatePayload, 'version' | 'generatedAt'>;

export const SIGNAL_IDS: readonly SignalId[] = [
  'temperature',
  'co2',
  'methane',
  'nitrousOxide',
  'perPerson',
];

/** Upstream answers are kept for a day; a little slack covers the refresh itself. */
export const LIVE_MAX_AGE_MS = 36 * 60 * 60 * 1000;

/**
 * Whether a reading may wear the "Live" badge at `now`. Both ends ask: the server when it
 * builds the answer, and the page when it shows one that sat in a cache.
 */
export function isLive(signal: Pick<SignalMeta, 'status' | 'fetchedAt'>, now: number): boolean {
  if (signal.status !== 'live') return false;
  const fetched = Date.parse(signal.fetchedAt);
  return Number.isFinite(fetched) && now - fetched <= LIVE_MAX_AGE_MS && fetched - now < 60_000;
}
