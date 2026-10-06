/**
 * The words behind every "≈": what the honesty mark opens for a preview and for a log already
 * saved. Built from the same catalogue the engine computes with, so the explanation can never
 * drift from the number.
 */
import { ROUTES } from '@/app/routes';
import { ACTIONS, ACTION_BY_ID, SOURCES, type ActionDef } from '@/data/catalogue';
import { actionAnchor } from '@/data/content';
import type { KgEstimate, LogEntry } from '@/game';
import { formatCo2Estimate, formatNumber } from '@/lib/format';
import type { EstimateSource } from '@/ui';
import { formatQty, unitSuffix } from './units';

/** "MOVE-01": the category and the action's place in it. Printed on the estimate's slip. */
export function factorCode(actionId: string): string {
  const action = ACTION_BY_ID.get(actionId);
  if (!action) return 'CUSTOM';
  const siblings = ACTIONS.filter((candidate) => candidate.category === action.category);
  const position = siblings.findIndex((candidate) => candidate.id === action.id) + 1;
  return `${action.category.toUpperCase()}-${String(position).padStart(2, '0')}`;
}

/** The action's own entry on the methodology page. */
export function methodologyHref(actionId: string): string {
  return ACTION_BY_ID.has(actionId)
    ? `${ROUTES.methodology}#${actionAnchor(actionId)}`
    : ROUTES.methodology;
}

/** "970 g–2.6 kg": a likely range, each end to two significant figures. */
export function rangeText(low: number, high: number): string {
  return `${formatCo2Estimate(low)}–${formatCo2Estimate(high)}`;
}

function sourceOf(action: ActionDef): { label: string; year?: number } {
  const cited = action.sources.map((key) => SOURCES[key]).filter((source) => source !== undefined);
  const first = cited[0];
  if (!first) return { label: 'Our factor table' };
  const name = first.publisher ?? first.title;
  const more = cited.length - 1;
  return {
    label: more > 0 ? `${name} + ${formatNumber(more)} more` : name,
    year: Math.max(...cited.map((source) => source.year)),
  };
}

function comparison(action: ActionDef): string {
  const rough =
    action.confidence === 'low' ? ' A rough estimate: it depends a lot on your situation.' : '';
  return `Compared with ${action.counterfactual}.${rough}`;
}

/** One unit of an action, for a formula: "km", "meal", "load". */
function perUnitWord(unit: string): string {
  const suffix = unitSuffix(unit, 'metric');
  // Suffixes are plural ("meals"); a formula reads "per meal".
  return suffix.length > 3 && suffix.endsWith('s') ? suffix.slice(0, -1) : suffix;
}

/**
 * How the sheet's preview figure is made, for the action and quantity being logged. Formulas
 * stay metric whatever the display units: the factors are per kilometre.
 */
export function previewEstimateSource(
  action: ActionDef,
  qty: number,
  estimate: KgEstimate,
): EstimateSource {
  const source = sourceOf(action);
  return {
    code: factorCode(action.id),
    kind: 'factor',
    formula: `${formatQty(qty, action.unit)} × ${formatCo2Estimate(
      estimate.perUnit,
    )} per ${perUnitWord(action.unit)} = ${formatCo2Estimate(estimate.kg)}`,
    comparedWith: comparison(action),
    range: rangeText(estimate.low, estimate.high),
    sourceLabel: source.label,
    year: source.year,
    href: methodologyHref(action.id),
  };
}

/** How a stored log's figure was made. Reads only what was frozen on the log. */
export function logEstimateSource(log: LogEntry): EstimateSource {
  const kg = log.co2eKg ?? 0;
  if (log.estimate === 'ai') {
    return {
      code: 'CUSTOM',
      kind: 'ai',
      formula: `Estimated from your description = ${formatCo2Estimate(kg)}`,
      comparedWith:
        'A guess from a language model, capped at 2 kg a log and 5 kg a day. It is kept out of your headline total.',
      sourceLabel: 'AI estimate',
      href: ROUTES.methodology,
    };
  }
  const action = ACTION_BY_ID.get(log.actionId);
  const perUnit = log.qty > 0 ? kg / log.qty : kg;
  const source = action ? sourceOf(action) : { label: 'Our factor table' };
  return {
    code: factorCode(log.actionId),
    kind: log.estimate === 'factor' ? 'factor' : 'none',
    formula: `${formatQty(log.qty, log.unit)} × ${formatCo2Estimate(perUnit)} per ${perUnitWord(
      log.unit,
    )} = ${formatCo2Estimate(kg)}`,
    comparedWith: action
      ? comparison(action)
      : 'Compared with what this action replaced, using the factor in force when it was logged.',
    range: log.kgLow !== null && log.kgHigh !== null ? rangeText(log.kgLow, log.kgHigh) : undefined,
    sourceLabel: `${source.label} · factors ${log.factorsVersion}`,
    year: source.year,
    href: methodologyHref(log.actionId),
  };
}

export interface EstimatePart {
  action: ActionDef;
  qty: number;
  estimate: KgEstimate;
}

/** One slip for several logs saved together (the recycling tile writes one per material). */
export function combinedEstimateSource(parts: readonly EstimatePart[]): EstimateSource | null {
  const first = parts[0];
  if (!first) return null;
  if (parts.length === 1) return previewEstimateSource(first.action, first.qty, first.estimate);
  const total = parts.reduce((sum, part) => sum + part.estimate.kg, 0);
  const low = parts.reduce((sum, part) => sum + part.estimate.low, 0);
  const high = parts.reduce((sum, part) => sum + part.estimate.high, 0);
  const source = sourceOf(first.action);
  return {
    code: parts.map((part) => factorCode(part.action.id)).join(' + '),
    kind: 'factor',
    formula: `${parts
      .map(
        (part) =>
          `${formatQty(part.qty, part.action.unit)} × ${formatCo2Estimate(part.estimate.perUnit)}`,
      )
      .join(' + ')} = ${formatCo2Estimate(total)}`,
    comparedWith: `Compared with ${first.action.counterfactual}, material by material.`,
    range: rangeText(low, high),
    sourceLabel: source.label,
    year: source.year,
    href: methodologyHref(first.action.id),
  };
}
