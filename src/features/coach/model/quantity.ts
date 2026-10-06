/**
 * How a quantity reads on a coach chip: "5 km", "2 meals", "3.1 mi". Storage is metric;
 * miles exist only at the display edge, for people who chose imperial units.
 */
import { formatDecimal } from '@/lib/format';

export type UnitSystem = 'metric' | 'imperial';

const KM_PER_MILE = 1.609344;

/** Singular and plural wording of the catalogue's unit ids. */
const UNIT_WORDS: Readonly<Record<string, readonly [one: string, many: string]>> = {
  km: ['km', 'km'],
  mi: ['mi', 'mi'],
  meal: ['meal', 'meals'],
  serving: ['serving', 'servings'],
  day: ['day', 'days'],
  litre: ['litre', 'litres'],
  kg: ['kg', 'kg'],
  load: ['load', 'loads'],
  'bulb-day': ['bulb', 'bulbs'],
  minute: ['min', 'min'],
  item: ['item', 'items'],
  year: ['year', 'years'],
  'tree-year': ['tree', 'trees'],
  session: ['session', 'sessions'],
  hour: ['hour', 'hours'],
  conversation: ['chat', 'chats'],
  action: ['action', 'actions'],
  trip: ['trip', 'trips'],
};

/** "5 km", "1 meal", "0.5 kg"; distances in miles for imperial users. */
export function formatQuantity(qty: number, unit: string, system: UnitSystem = 'metric'): string {
  const imperial = unit === 'km' && system === 'imperial';
  const shown = imperial ? Math.round((qty / KM_PER_MILE) * 10) / 10 : qty;
  const words = UNIT_WORDS[imperial ? 'mi' : unit] ?? [unit, unit];
  return `${formatDecimal(shown, 2)} ${shown === 1 ? words[0] : words[1]}`;
}
