/**
 * Calendar helpers. The game thinks in the user's *local* days: a streak ticks
 * at local midnight, not at UTC midnight. A day is identified by a `DayKey`.
 */

/** A local calendar day, formatted `YYYY-MM-DD`. Sorts correctly as a string. */
export type DayKey = string;

const MS_PER_DAY = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The local day containing the given moment. */
export function dayKey(moment: Date | number = Date.now()): DayKey {
  const date = typeof moment === 'number' ? new Date(moment) : moment;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The given day as a Date at local noon. Noon keeps day arithmetic safe across
 * daylight-saving changes, where a local day can last 23 or 25 hours.
 */
export function parseDayKey(key: DayKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

export function addDays(key: DayKey, amount: number): DayKey {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((parseDayKey(to).getTime() - parseDayKey(from).getTime()) / MS_PER_DAY);
}

/** Every day from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const length = diffDays(from, to) + 1;
  return length <= 0 ? [] : Array.from({ length }, (_, index) => addDays(from, index));
}

/** The Monday that starts the week containing `key`. */
export function startOfWeek(key: DayKey): DayKey {
  const weekday = parseDayKey(key).getDay(); // 0 = Sunday
  return addDays(key, -((weekday + 6) % 7));
}

/** Identifies a Monday-to-Sunday week by its Monday, e.g. `W2026-10-05`. */
export function weekKey(moment: Date | number | DayKey = Date.now()): string {
  const key = typeof moment === 'string' ? moment : dayKey(moment);
  return `W${startOfWeek(key)}`;
}

/** Local time of day as a fractional hour, 0..24. */
export function hourOfDay(moment: Date | number = Date.now()): number {
  const date = typeof moment === 'number' ? new Date(moment) : moment;
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/** Milliseconds until the next local midnight. */
export function msUntilTomorrow(now: number = Date.now()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now;
}
