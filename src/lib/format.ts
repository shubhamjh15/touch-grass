import { addDays, diffDays, parseDayKey, type DayKey } from './dates';

/** Text formatting for numbers the user sees. One place, so the product reads consistently. */

const LOCALE = 'en-US';
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const longDate = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const clock = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });

export function formatNumber(value: number): string {
  return integer.format(value);
}

/** 1,234 → "1.2K". Use where space is tight (HUD, chips). */
export function formatCompact(value: number): string {
  return compact.format(value);
}

/** Rounds to two significant figures: 819 → 820, 86.4 → 86, 4.6 → 5. */
function twoFigures(value: number): number {
  const abs = Math.abs(value);
  if (abs < 10) return Math.round(value);
  const magnitude = 10 ** (Math.floor(Math.log10(abs)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

/**
 * A mass of CO2e with a unit that fits its size: grams below 1 kg, kilograms
 * up to a tonne, tonnes beyond. Always an estimate, so precision stays modest: grams
 * keep two significant figures (819 g reads "820 g"), the same as one decimal of a kilogram,
 * so one logged action shows one figure on every page.
 */
export function formatCo2(kg: number): string {
  const abs = Math.abs(kg);
  if (abs === 0) return '0 kg';
  if (abs < 0.995) return `${integer.format(twoFigures(kg * 1000))} g`;
  if (abs < 10) return `${oneDecimal.format(kg)} kg`;
  if (abs < 1000) return `${integer.format(kg)} kg`;
  return `${twoDecimals.format(kg / 1000)} t`;
}

/** Splits `formatCo2` into number and unit, for layouts that style them separately. */
export function formatCo2Parts(kg: number): { value: string; unit: string } {
  const text = formatCo2(kg);
  const split = text.lastIndexOf(' ');
  return { value: text.slice(0, split), unit: text.slice(split + 1) };
}

export function formatPercent(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** A plain number with at most `decimals` decimals: 7.84 → "7.8", 12 → "12". */
export function formatDecimal(value: number, decimals = 1): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: decimals }).format(value);
}

const tonnesFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A yearly footprint in tonnes, always to one decimal: "7.8 t", "8.0 t". */
export function formatTonnes(tonnes: number): string {
  return `${tonnesFormat.format(tonnes)} t`;
}

/**
 * A mass of CO2e rounded to two significant figures before it is formatted, which is
 * the most precision an estimate may claim: 0.1234 → "120 g", 48.7 → "49 kg".
 */
export function formatCo2Estimate(kg: number): string {
  if (!Number.isFinite(kg) || kg === 0) return formatCo2(0);
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(kg))) - 1);
  return formatCo2(Math.round(kg / magnitude) * magnitude);
}

/**
 * `formatCo2Estimate` split into number and unit. Every place that shows a running total
 * uses this, so the top bar and Impact print the same figure ("550 kg", never "554 kg").
 */
export function formatCo2EstimateParts(kg: number): { value: string; unit: string } {
  const text = formatCo2Estimate(kg);
  const split = text.lastIndexOf(' ');
  return { value: text.slice(0, split), unit: text.slice(split + 1) };
}

/** "1 day", "3 days". Pass `plural` for irregular nouns. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** "Today", "Yesterday", or "Mon, Oct 5". */
export function formatDay(key: DayKey, today: DayKey): string {
  const distance = diffDays(key, today);
  if (distance === 0) return 'Today';
  if (distance === 1) return 'Yesterday';
  if (distance === -1) return 'Tomorrow';
  return shortDate.format(parseDayKey(key));
}

export function formatLongDate(key: DayKey): string {
  return longDate.format(parseDayKey(key));
}

export function formatTime(moment: number): string {
  return clock.format(new Date(moment));
}

/** "45 sec", "12 min", "1 h 30 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The last `count` days ending today, oldest first. Handy for charts and heatmaps. */
export function lastDays(today: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

const stampMonth = new Intl.DateTimeFormat(LOCALE, { month: 'short' });

/**
 * The label-maker date on a slug or stamp: "25 SEP 2026". The one print format for a date,
 * from a day key or a moment (local time).
 */
export function formatStampDate(when: DayKey | number | Date): string {
  const date = typeof when === 'string' ? parseDayKey(when) : new Date(when);
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${stampMonth.format(date).replace('.', '').toUpperCase()} ${date.getFullYear()}`;
}
