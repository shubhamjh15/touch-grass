import { formatNumber, formatStampDate } from '@/lib/format';

const NUMERALS = ['I', 'II', 'III'] as const;

/** "II" for tier 2; empty for a badge that has a single tier. */
export function numeral(tier: number, maxTier: number): string {
  return maxTier > 1 ? (NUMERALS[tier - 1] ?? '') : '';
}

/** The label-maker date on a stamp: "06 OCT 2026". */
export function stampDate(moment: number): string {
  return formatStampDate(moment);
}

/** "10 acts", "1 lesson": the unit loses its plural s when the number is one. */
export function thresholdText(unit: string, count: number): string {
  const word = count === 1 && unit.endsWith('s') && !unit.endsWith('ss') ? unit.slice(0, -1) : unit;
  return `${formatNumber(count)} ${word}`;
}
