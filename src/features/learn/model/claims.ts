import { ROUTES } from '@/app/routes';
import {
  CONTENT_SOURCES,
  sourceAnchor,
  type Claim,
  type ClaimBasis,
  type LessonBlock,
  type SourceRef,
} from '@/data/content';
import { formatLongDate } from '@/lib/format';
import type { EstimateSource } from '@/ui';

/**
 * The paper trail behind a lesson's pull-stat. Every figure in the content has a claim that says
 * what it states, which source it came from and how it was checked; this turns that record into
 * what the honesty mark opens, so "where does this number come from?" is one tap away.
 */

type FactBlock = Extract<LessonBlock, { kind: 'fact' }>;

const SOURCES: Readonly<Record<string, SourceRef | undefined>> = CONTENT_SOURCES;

/** How each kind of check is named on the mark's tag, and explained under the statement. */
const BASIS: Readonly<Record<ClaimBasis, { tag: string; how: string }>> = {
  dataset: {
    tag: 'Dataset',
    how: 'Read from a public dataset that ships with the app.',
  },
  'evidence-base': {
    tag: 'Evidence base',
    how: 'Read from the evidence base, the same files the action catalogue is built from.',
  },
  web: {
    tag: 'Publisher',
    how: "Checked against the publisher's own page, or a report of it.",
  },
  derived: {
    tag: 'Arithmetic',
    how: 'Simple arithmetic on other figures in the same piece.',
  },
};

/** A source by its key; `null` when the content names one the registry does not hold. */
export function sourceByKey(key: string): SourceRef | null {
  return SOURCES[key] ?? null;
}

/** Where a source is written up on the methodology page. */
export function sourceHref(key: string): string {
  return `${ROUTES.methodology}#${sourceAnchor(key)}`;
}

/** "IPCC, 2022": the short way to name a source next to a figure. */
export function sourceShortLabel(source: Pick<SourceRef, 'publisher' | 'year'>): string {
  return `${source.publisher}, ${source.year}`;
}

// "≈ 33 °C" and "33 °C" are the same figure; so are "40–70%" and "40 – 70 %".
const squash = (text: string) => text.replace(/[≈\s]/g, '').toLowerCase();

/**
 * The claim that backs a pull-stat: one from the same source whose figure is printed in the stat
 * itself, else in its caption, else the first claim from that source. `null` when the content
 * has no claim for the block's source (the stat is then shown with its source link only).
 */
export function claimForFact(claims: readonly Claim[], block: FactBlock): Claim | null {
  const sameSource = claims.filter((claim) => claim.source === block.source);
  if (sameSource.length === 0) return null;
  const stat = squash(block.stat);
  const caption = squash(block.text);
  return (
    sameSource.find((claim) => stat.includes(squash(claim.figure))) ??
    sameSource.find((claim) => caption.includes(squash(claim.figure))) ??
    (sameSource[0] as Claim)
  );
}

/** What the honesty mark opens for a claim. `null` when its source is not in the registry. */
export function claimEstimate(claim: Claim, reviewBy: string): EstimateSource | null {
  const source = sourceByKey(claim.source);
  if (!source) return null;
  const basis = BASIS[claim.basis];
  const checked = `${basis.how} Next review by ${formatLongDate(reviewBy)}.`;
  return {
    code: basis.tag,
    kind: 'factor',
    formula: claim.statement,
    comparedWith: claim.note ? `${claim.note} ${checked}` : checked,
    sourceLabel: source.publisher,
    year: source.year,
    href: sourceHref(claim.source),
  };
}

/** A pull-stat without its leading "≈": the honesty mark in front of it already is one. */
export function statWithoutApprox(stat: string): string {
  return stat.replace(/^≈\s*/, '');
}
