/**
 * Readers for the public sources behind /api/climate. Each one takes the raw body a publisher
 * sent and returns our own small shape, or throws: a body that is the wrong shape, too short,
 * out of a physically sensible range or too old is treated exactly like a source that is down.
 * Pure functions: no network, no clock of their own.
 */
import type {
  Co2Signal,
  GasSignal,
  MonthValue,
  PerPersonRow,
  PerPersonSignal,
  TemperatureSignal,
} from './contract';
import { CLIMATE_REGIONS, WORLD_ISO3 } from './regions';

const DAY_MS = 24 * 60 * 60 * 1000;

export class ClimateDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClimateDataError';
  }
}

function fail(message: string): never {
  throw new ClimateDataError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(body: string): unknown {
  try {
    // The World Bank sends a byte-order mark before its JSON.
    return JSON.parse(body.charCodeAt(0) === 0xfeff ? body.slice(1) : body);
  } catch {
    return fail('not JSON');
  }
}

/** A number from a number or a numeric string; `null` for anything else. */
function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

function monthStart(key: string): number {
  return Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
}

function previousYear(key: string): string {
  return `${Number(key.slice(0, 4)) - 1}${key.slice(4)}`;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Throws unless the newest reading is recent enough to be worth calling current. */
function assertFresh(latestMs: number, now: number, maxAgeDays: number, what: string): void {
  if (latestMs - now > 2 * DAY_MS) fail(`${what}: newest reading is in the future`);
  if (now - latestMs > maxAgeDays * DAY_MS) fail(`${what}: newest reading is too old`);
}

// ── Temperature (NASA GISTEMP v4, land-ocean index) ─────────────────────────

export type TemperatureBody = Omit<TemperatureSignal, 'status' | 'fetchedAt' | 'source'>;

function temperatureFromMonths(input: readonly MonthValue[], now: number): TemperatureBody {
  const months = [...input].sort((a, b) => a.month.localeCompare(b.month));
  if (months.length < 1200) fail('temperature: series too short');
  for (const entry of months)
    if (entry.value < -2 || entry.value > 4) fail('temperature: value out of range');
  const first = months[0];
  const latest = months[months.length - 1];
  if (!first || !latest) fail('temperature: empty');
  if (Number(first.month.slice(0, 4)) > 1900) fail('temperature: series starts too late');
  assertFresh(monthStart(latest.month), now, 150, 'temperature');

  const byMonth = new Map(months.map((entry) => [entry.month, entry.value]));
  const byYear = new Map<number, number[]>();
  for (const entry of months) {
    const year = Number(entry.month.slice(0, 4));
    byYear.set(year, [...(byYear.get(year) ?? []), entry.value]);
  }
  const annual = [...byYear.entries()]
    .filter(([, values]) => values.length === 12)
    .map(([year, values]) => ({ year, value: round(mean(values), 2) }))
    .sort((a, b) => a.year - b.year);
  const before = byMonth.get(previousYear(latest.month));
  return {
    baseline: '1951-1980',
    latest,
    yearAgo: before === undefined ? null : { month: previousYear(latest.month), value: before },
    lastTwelve: round(mean(months.slice(-12).map((entry) => entry.value)), 2),
    annual,
  };
}

/** NASA's own table: `Year,Jan,…,Dec,J-D,…`, with `***` for months not published yet. */
export function parseGistempCsv(body: string, now: number): TemperatureBody {
  const months: MonthValue[] = [];
  for (const line of body.split(/\r?\n/)) {
    const cells = line.split(',');
    const year = numeric(cells[0]);
    if (year === null || !Number.isInteger(year) || year < 1850 || cells.length < 13) continue;
    for (let month = 1; month <= 12; month += 1) {
      const value = numeric(cells[month]);
      if (value !== null) months.push({ month: monthKey(year, month), value });
    }
  }
  return temperatureFromMonths(months, now);
}

/** The global-warming.org mirror: `{ result: [{ time: "2026.63", land: "1.40" }] }`. */
export function parseGistempMirror(body: string, now: number): TemperatureBody {
  const json = parseJson(body);
  const rows = isRecord(json) && Array.isArray(json.result) ? json.result : fail('temperature');
  const months: MonthValue[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const time = numeric(row.time);
    const value = numeric(row.land);
    if (time === null || value === null) continue;
    const year = Math.floor(time);
    // The mirror writes the middle of the month as a fraction of the year.
    const month = Math.min(12, Math.max(1, Math.round((time - year) * 12 + 0.5)));
    months.push({ month: monthKey(year, month), value });
  }
  return temperatureFromMonths(months, now);
}

// ── CO2 in the air (NOAA GML, global daily trend) ───────────────────────────

export type Co2Body = Omit<Co2Signal, 'status' | 'fetchedAt' | 'source'>;

interface Co2Day {
  year: number;
  month: number;
  day: number;
  cycle: number;
  trend: number;
}

function co2FromDays(input: readonly Co2Day[], now: number): Co2Body {
  const key = (entry: Co2Day) => `${entry.year}-${pad(entry.month)}-${pad(entry.day)}`;
  const days = [...input].sort((a, b) => key(a).localeCompare(key(b)));
  if (days.length < 1000) fail('co2: series too short');
  for (const entry of days) {
    if (entry.trend < 300 || entry.trend > 600 || entry.cycle < 300 || entry.cycle > 600)
      fail('co2: value out of range');
    if (entry.month < 1 || entry.month > 12 || entry.day < 1 || entry.day > 31)
      fail('co2: bad date');
  }
  const latest = days[days.length - 1];
  if (!latest) fail('co2: empty');
  assertFresh(Date.UTC(latest.year, latest.month - 1, latest.day), now, 45, 'co2');

  const byMonth = new Map<string, Co2Day[]>();
  for (const entry of days) {
    const month = monthKey(entry.year, entry.month);
    byMonth.set(month, [...(byMonth.get(month) ?? []), entry]);
  }
  const monthly = [...byMonth.entries()].map(([month, entries]) => ({
    month,
    trend: round(mean(entries.map((entry) => entry.trend)), 2),
    cycle: round(mean(entries.map((entry) => entry.cycle)), 2),
  }));
  const before = days.find(
    (entry) =>
      entry.year === latest.year - 1 && entry.month === latest.month && entry.day === latest.day,
  );
  return {
    latest: { day: key(latest), trend: latest.trend, cycle: latest.cycle },
    yearAgo: before ? { day: key(before), trend: before.trend } : null,
    monthly,
  };
}

/** NOAA's own file: comment lines, then `year,month,day,smoothed,trend`. */
export function parseNoaaCo2Csv(body: string, now: number): Co2Body {
  const days: Co2Day[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith('#')) continue;
    const [year, month, day, cycle, trend] = line.split(',').map((cell) => numeric(cell));
    if (year == null || month == null || day == null || cycle == null || trend == null) continue;
    days.push({ year, month, day, cycle, trend });
  }
  return co2FromDays(days, now);
}

/** The mirror: `{ co2: [{ year, month, day, cycle, trend }] }`, every field a string. */
export function parseCo2Mirror(body: string, now: number): Co2Body {
  const json = parseJson(body);
  const rows = isRecord(json) && Array.isArray(json.co2) ? json.co2 : fail('co2');
  const days: Co2Day[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const year = numeric(row.year);
    const month = numeric(row.month);
    const day = numeric(row.day);
    const cycle = numeric(row.cycle);
    const trend = numeric(row.trend);
    if (year === null || month === null || day === null || cycle === null || trend === null)
      continue;
    days.push({ year, month, day, cycle, trend });
  }
  return co2FromDays(days, now);
}

// ── Methane and nitrous oxide (NOAA GML, global monthly means) ──────────────

export type GasBody = Omit<GasSignal, 'status' | 'fetchedAt' | 'source'>;

export interface GasSpec {
  /** The array's key in the mirror's answer. */
  key: 'methane' | 'nitrous';
  /** Parts per billion outside this range are not this gas. */
  min: number;
  max: number;
}

export const METHANE: GasSpec = { key: 'methane', min: 1500, max: 2500 };
export const NITROUS_OXIDE: GasSpec = { key: 'nitrous', min: 280, max: 420 };

/** The mirror: `{ methane: [{ date: "2026.5", average: "1939.44" }] }`; the date is year.month. */
export function parseGasMirror(body: string, spec: GasSpec, now: number): GasBody {
  const json = parseJson(body);
  const list = isRecord(json) ? json[spec.key] : undefined;
  const rows = Array.isArray(list) ? list : fail(spec.key);
  const months: MonthValue[] = [];
  for (const row of rows) {
    if (!isRecord(row) || typeof row.date !== 'string') continue;
    const [yearText, monthText] = row.date.split('.');
    const year = Number(yearText);
    const month = Number(monthText);
    const value = numeric(row.average);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) continue;
    if (value === null) continue;
    if (value < spec.min || value > spec.max) fail(`${spec.key}: value out of range`);
    months.push({ month: monthKey(year, month), value: round(value, 1) });
  }
  months.sort((a, b) => a.month.localeCompare(b.month));
  if (months.length < 120) fail(`${spec.key}: series too short`);
  const latest = months[months.length - 1];
  if (!latest) fail(`${spec.key}: empty`);
  assertFresh(monthStart(latest.month), now, 400, spec.key);
  const before = months.find((entry) => entry.month === previousYear(latest.month));
  return { latest, yearAgo: before ?? null };
}

// ── CO2 per person (World Bank, EN.GHG.CO2.PC.CE.AR5) ───────────────────────

export type PerPersonBody = Omit<PerPersonSignal, 'status' | 'fetchedAt' | 'source'>;

/** The World Bank answers `[paging, rows]`; a row has an ISO code, a year and a value. */
export function parseWorldBank(body: string, now: number): PerPersonBody {
  const json = parseJson(body);
  const list: unknown = Array.isArray(json) ? json[1] : undefined;
  const rows = Array.isArray(list) ? list : fail('per person');
  // Only the places the app knows are read: a tiny state with an outsized figure is not our concern.
  const wanted = new Set([WORLD_ISO3, ...CLIMATE_REGIONS.map((region) => region.iso3)]);
  const byIso = new Map<string, { name: string; value: number; year: number }>();
  for (const row of rows) {
    if (!isRecord(row) || typeof row.countryiso3code !== 'string') continue;
    if (!wanted.has(row.countryiso3code)) continue;
    const value = numeric(row.value);
    const year = numeric(row.date);
    const name = isRecord(row.country) ? row.country.value : undefined;
    if (value === null || year === null || typeof name !== 'string') continue;
    if (value < 0 || value > 80) fail('per person: value out of range');
    byIso.set(row.countryiso3code, { name, value: round(value, 2), year });
  }
  const world = byIso.get(WORLD_ISO3);
  if (!world || world.value < 2 || world.value > 10) fail('per person: no world average');
  const thisYear = new Date(now).getUTCFullYear();
  if (world.year > thisYear || thisYear - world.year > 4) fail('per person: year out of range');

  const regions: PerPersonRow[] = CLIMATE_REGIONS.flatMap((region) => {
    const found = byIso.get(region.iso3);
    return found
      ? [{ id: region.id, name: region.name ?? found.name, value: found.value, year: found.year }]
      : [];
  });
  if (regions.length < 20) fail('per person: too few countries');
  return {
    world: { id: 'WORLD', name: 'World', value: world.value, year: world.year },
    rows: regions,
  };
}
