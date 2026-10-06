/**
 * A structural check of a whole climate answer. The server runs the bundled snapshot through
 * it, and the page runs whatever /api/climate returned through it, so a truncated or mangled
 * body can never reach a chart.
 */
import type {
  ClimatePayload,
  ClimateSource,
  Co2Signal,
  GasSignal,
  MonthValue,
  PerPersonRow,
  PerPersonSignal,
  SignalMeta,
  TemperatureSignal,
} from './contract';

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isSource(value: unknown): value is ClimateSource {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.publisher === 'string' &&
    typeof value.url === 'string' &&
    value.url.startsWith('https://') &&
    (value.via === undefined || typeof value.via === 'string')
  );
}

function isMeta(value: unknown): value is Rec & SignalMeta {
  return (
    isRecord(value) &&
    (value.status === 'live' || value.status === 'snapshot') &&
    typeof value.fetchedAt === 'string' &&
    Number.isFinite(Date.parse(value.fetchedAt)) &&
    isSource(value.source)
  );
}

function isMonthValue(value: unknown): value is MonthValue {
  return isRecord(value) && isMonth(value.month) && isNumber(value.value);
}

function isTemperature(value: unknown): value is TemperatureSignal {
  return (
    isMeta(value) &&
    value.baseline === '1951-1980' &&
    isMonthValue(value.latest) &&
    (value.yearAgo === null || isMonthValue(value.yearAgo)) &&
    isNumber(value.lastTwelve) &&
    Array.isArray(value.annual) &&
    value.annual.length >= 100 &&
    value.annual.every((entry) => isRecord(entry) && isNumber(entry.year) && isNumber(entry.value))
  );
}

function isCo2(value: unknown): value is Co2Signal {
  if (!isMeta(value) || !isRecord(value.latest)) return false;
  const before = value.yearAgo;
  return (
    isDay(value.latest.day) &&
    isNumber(value.latest.trend) &&
    isNumber(value.latest.cycle) &&
    (before === null || (isRecord(before) && isDay(before.day) && isNumber(before.trend))) &&
    Array.isArray(value.monthly) &&
    value.monthly.length >= 24 &&
    value.monthly.every(
      (entry) =>
        isRecord(entry) && isMonth(entry.month) && isNumber(entry.trend) && isNumber(entry.cycle),
    )
  );
}

function isGas(value: unknown): value is GasSignal {
  return (
    isMeta(value) &&
    isMonthValue(value.latest) &&
    (value.yearAgo === null || isMonthValue(value.yearAgo))
  );
}

function isRow(value: unknown): value is PerPersonRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNumber(value.value) &&
    isNumber(value.year)
  );
}

function isPerPerson(value: unknown): value is PerPersonSignal {
  return (
    isMeta(value) && isRow(value.world) && Array.isArray(value.rows) && value.rows.every(isRow)
  );
}

/** The payload when `value` is a complete, well-formed climate answer; otherwise `null`. */
export function parseClimatePayload(value: unknown): ClimatePayload | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.generatedAt !== 'string') return null;
  const { temperature, co2, methane, nitrousOxide, perPerson } = value;
  if (!isTemperature(temperature) || !isCo2(co2) || !isGas(methane) || !isGas(nitrousOxide))
    return null;
  if (!isPerPerson(perPerson)) return null;
  return {
    version: 1,
    generatedAt: value.generatedAt,
    temperature,
    co2,
    methane,
    nitrousOxide,
    perPerson,
  };
}
