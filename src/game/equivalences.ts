/**
 * Equivalences make a mass of CO2e imaginable (product spec section 3.7). They are
 * always phrased "That is roughly the CO2 from …" and never as an outcome.
 */
import { BASELINE_MODEL, EQUIVALENCES, type EquivalenceDef } from '@/data/catalogue';
import { formatDecimal, formatNumber } from '@/lib/format';
import { gridIntensity } from './co2';
import type { RegionId } from './types';

export interface Equivalence {
  id: string;
  /** How many of the thing, in the unit the text uses. */
  amount: number;
  /** "≈ 42 km driven in an average car". */
  short: string;
  /** The full sentence. */
  text: string;
  sources: readonly string[];
}

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 999;
/** Amounts near this read best ("about 30 km" beats "1.1 km" and "950 km"). */
const IDEAL_AMOUNT = 30;

function kgPerUnitFor(item: EquivalenceDef, region: RegionId): number {
  return item.gridScaled && item.kWhPerUnit !== null
    ? item.kWhPerUnit * gridIntensity(region)
    : item.kgCO2ePerUnit;
}

function formatAmount(amount: number): string {
  return amount < 10 ? formatDecimal(amount, 1) : formatNumber(Math.round(amount));
}

function make(item: EquivalenceDef, amount: number, short: string, text: string): Equivalence {
  return { id: item.id, amount, short: `≈ ${short}`, text, sources: item.sources };
}

function describe(item: EquivalenceDef, kg: number, region: RegionId): Equivalence | null {
  const perUnit = kgPerUnitFor(item, region);
  if (perUnit <= 0) return null;
  const amount = kg / perUnit;

  if (item.id === 'daily-1p5-budget') {
    const budget = `≈ ${formatDecimal(BASELINE_MODEL.dailyBudgetKg2030, 2)} kg`;
    if (amount >= 1) {
      const days = `${formatAmount(amount)} ${formatAmount(amount) === '1' ? 'day' : 'days'} of a 1.5 °C lifestyle budget`;
      return make(item, amount, days, `That is roughly ${days} (${budget} a day).`);
    }
    const share = `${formatAmount(amount * 100)}% of one day's 1.5 °C lifestyle budget`;
    return make(item, amount * 100, share, `That is roughly ${share} of ${budget}.`);
  }

  if (item.id === 'beef-grams' && amount >= 1000) {
    const kilos = `${formatAmount(amount / 1000)} kg of beef`;
    return make(item, amount / 1000, kilos, `That is roughly the CO2 from ${kilos}.`);
  }

  const phrase = `${formatAmount(amount)} ${item.label}`;
  return make(item, amount, phrase, `That is roughly the CO2 from ${phrase}.`);
}

/** One equivalence by id, or `null` when the id is unknown or the mass is not positive. */
export function equivalenceFor(id: string, kg: number, region: RegionId): Equivalence | null {
  const item = EQUIVALENCES.find((entry) => entry.id === id);
  return item && kg > 0 ? describe(item, kg, region) : null;
}

/** Every shipped equivalence for a mass, in catalogue order. */
export function allEquivalences(kg: number, region: RegionId): Equivalence[] {
  if (!(kg > 0)) return [];
  return EQUIVALENCES.flatMap((item) => describe(item, kg, region) ?? []);
}

/**
 * The equivalences to show for a total: those whose amount lands between 1 and 999 and
 * reads most naturally come first; when too few fit, the closest of the rest fill in.
 */
export function pickEquivalences(kg: number, region: RegionId, count = 2): Equivalence[] {
  const distance = (item: Equivalence) => Math.abs(Math.log10(item.amount / IDEAL_AMOUNT));
  const all = allEquivalences(kg, region).sort((a, b) => distance(a) - distance(b));
  const fits = (item: Equivalence) => item.amount >= MIN_AMOUNT && item.amount <= MAX_AMOUNT;
  return [...all.filter(fits), ...all.filter((item) => !fits(item))].slice(0, count);
}
