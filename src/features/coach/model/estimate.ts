/**
 * The honest line under a log confirmation: what the estimate is, what it is compared with
 * and where it comes from. Built from the engine's own preview, so the coach never shows a
 * number the Log sheet would not show.
 */
import { ACTION_BY_ID, SOURCES } from '@/data/catalogue';
import type { LogPreview } from '@/game';
import { ROUTES } from '@/app/routes';
import { formatCo2Estimate, formatDecimal } from '@/lib/format';
import type { EstimateSource } from '@/ui';
import { formatQuantity, type UnitSystem } from './quantity';

export interface PreviewLine {
  /** `null` when the action has no sourced figure: the line says so instead of a number. */
  kgText: string | null;
  /** "the same trip in an average car" */
  comparedWith: string | null;
  /** Why there is no number, when there is none. */
  unquantified: string | null;
  xp: number;
  /** No rewarded acts left today: kilograms only. */
  maxed: boolean;
  source: EstimateSource;
}

const NOT_QUANTIFIED = /^not quantified:?\s*/i;

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Everything the confirmation prints about one would-be log. */
export function previewLine(
  actionId: string,
  preview: LogPreview,
  units: UnitSystem = 'metric',
): PreviewLine | null {
  const action = ACTION_BY_ID.get(actionId);
  if (!action) return null;
  const href = `${ROUTES.methodology}#${action.id}`;
  const firstSource = action.sources
    .map((key) => SOURCES[key])
    .find((entry) => entry !== undefined);
  const quantified = preview.kg !== null && action.credit === 'log';

  if (!quantified || preview.kg === null) {
    const reason = action.counterfactual.replace(NOT_QUANTIFIED, '').trim();
    return {
      kgText: null,
      comparedWith: null,
      unquantified:
        reason === '' ? 'No sourced figure exists for this yet.' : `${capitalise(reason)}.`,
      xp: preview.xp,
      maxed: preview.maxed,
      source: {
        code: action.id,
        kind: 'none',
        formula: '',
        comparedWith: '',
        sourceLabel: '',
        href,
      },
    };
  }

  const { kg, perUnit, low, high } = preview.kg;
  const quantity = formatQuantity(preview.qty, action.unit, units);
  return {
    kgText: formatCo2Estimate(kg),
    comparedWith: action.counterfactual,
    unquantified: null,
    xp: preview.xp,
    maxed: preview.maxed,
    source: {
      code: action.id,
      kind: 'factor',
      formula: `${quantity} × ${formatDecimal(perUnit, 3)} kg = ${formatCo2Estimate(kg)}`,
      comparedWith: `Compared with ${action.counterfactual}.`,
      range: low === high ? undefined : `${formatCo2Estimate(low)} to ${formatCo2Estimate(high)}`,
      sourceLabel: firstSource?.publisher ?? firstSource?.title ?? 'Evidence base',
      year: firstSource?.year,
      href,
    },
  };
}
