import { BASELINE_MODEL, BASELINE_QUESTIONS, type BaselineQuestion } from '@/data/catalogue';
import type { BaselineAnswers, BaselineView } from '@/game';
import { formatTonnes } from '@/lib/format';
import type { EstimateSource } from '@/ui';

/** The quiz in the order it is asked. */
export const QUESTIONS: readonly BaselineQuestion[] = BASELINE_QUESTIONS;

/** "Food 2.1 t + Getting around 1.4 t + …": the sum behind the headline figure, for the honesty mark. */
export function startingLineSource(view: BaselineView): EstimateSource {
  const sum = view.segments
    .map((segment) => `${segment.label} ${formatTonnes(segment.tonnes)}`)
    .join(' + ');
  return {
    code: 'BASELINE',
    kind: 'factor',
    formula: `${sum} = ${formatTonnes(view.result.tonnes.total)} a year`,
    comparedWith:
      'A coarse lifestyle footprint from six answers, per person per year. It is accurate to about ±40% for a typical person, and worse at the extremes.',
    sourceLabel: `Starting-line model v${BASELINE_MODEL.version}`,
    href: '/methodology#baseline',
  };
}

/** Whether every question has an answer that exists. */
export function isComplete(answers: Partial<BaselineAnswers>): answers is BaselineAnswers {
  return QUESTIONS.every((question) => {
    const value = answers[question.id];
    return typeof value === 'string' && question.options.some((option) => option.id === value);
  });
}

/** Splits "Vegan - no animal products" into the short title and its detail. */
export function splitOption(label: string): { title: string; detail: string | null } {
  const at = label.indexOf(' - ');
  if (at < 0) return { title: label, detail: null };
  return { title: label.slice(0, at), detail: label.slice(at + 3) };
}
