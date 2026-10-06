/**
 * Pure helpers for /methodology: the words and the small derivations between the data module and
 * the screen. No React, no store, no DOM, so the page can be built on the server and tested alone.
 */
import {
  ACTION_SOURCE_ROWS,
  SOURCE_ROWS,
  contentSourceRows,
  type ActionSourceRow,
  type SourceRow,
} from '@/data/content';
import { ROUTES } from '@/app/routes';
import { formatCo2Estimate, formatDecimal } from '@/lib/format';
import type { CategoryId, EstimateSource } from '@/ui';

export type FactorConfidence = ActionSourceRow['confidence'];

export interface FactorSourceLink {
  key: string;
  /** "UK Department for Energy Security and Net Zero, 2026". */
  label: string;
  /** The publisher alone (or the title when there is none), for narrow cells. */
  publisher: string;
  /** The full title, for a tooltip. */
  title: string;
  year: number;
  anchor: string;
}

/** One row of the factor table, with every number already in words. */
export interface FactorRow {
  id: string;
  anchor: string;
  title: string;
  emoji: string;
  category: CategoryId;
  categoryLabel: string;
  /** "0.21 kg CO2e", "12 g CO2e", or null when no figure exists. */
  value: string | null;
  /** "per km": the unit the value is for. */
  per: string;
  /** "0.14 to 0.34 kg", or null. */
  range: string | null;
  regional: boolean;
  comparedWith: string;
  comparedWithDetail: string | null;
  confidence: FactorConfidence;
  confidenceLabel: string;
  formula: string | null;
  notes: string | null;
  sources: readonly FactorSourceLink[];
  /** Lower-case text the search box looks in. */
  haystack: string;
}

/** A per-unit value at two significant figures, in grams below 0.1 kg (the wording rule). */
export function perUnitText(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '0 kg';
  if (kg < 0.1) return formatCo2Estimate(kg);
  return `${formatDecimal(Number(kg.toPrecision(2)), 2)} kg`;
}

/** "0.14 to 0.34 kg": one unit when both ends share it, so the range reads on one line. */
export function rangeText(low: number, high: number): string {
  const a = perUnitText(low);
  const b = perUnitText(high);
  const unitA = a.slice(a.lastIndexOf(' ') + 1);
  const unitB = b.slice(b.lastIndexOf(' ') + 1);
  return unitA === unitB ? `${a.slice(0, a.lastIndexOf(' '))} to ${b}` : `${a} to ${b}`;
}

/** "bulb-day" reads as "bulb day"; the rest are already words. */
export function unitText(unit: string): string {
  return unit.replace(/-/g, ' ');
}

function sourceLabel(source: { publisher: string | null; title: string; year: number }): string {
  return `${source.publisher ?? source.title}, ${source.year}`;
}

function toFactorRow(row: ActionSourceRow): FactorRow {
  const value = row.kgPerUnit === null ? null : `${perUnitText(row.kgPerUnit)} CO2e`;
  const range =
    row.low === null || row.high === null || row.low === row.high
      ? null
      : rangeText(row.low, row.high);
  const sources = row.sources.map((source) => ({
    key: source.key,
    label: sourceLabel(source),
    publisher: source.publisher ?? source.title,
    title: source.title,
    year: source.year,
    anchor: `source-${source.key}`,
  }));
  return {
    id: row.id,
    anchor: row.anchor,
    title: row.title,
    emoji: row.emoji,
    category: row.category as CategoryId,
    categoryLabel: row.categoryLabel,
    value,
    per: `per ${unitText(row.unit)}`,
    range,
    regional: row.regional,
    comparedWith: row.comparedWith,
    comparedWithDetail: row.comparedWithDetail,
    confidence: row.confidence,
    confidenceLabel: row.confidenceLabel,
    formula: row.formula,
    notes: row.notes,
    sources,
    haystack: [row.title, row.categoryLabel, row.comparedWith, ...sources.map((s) => s.label)]
      .join(' ')
      .toLowerCase(),
  };
}

/** The factor table, in catalogue order. */
export function factorRows(): readonly FactorRow[] {
  return ACTION_SOURCE_ROWS.map(toFactorRow);
}

export interface FactorFilter {
  category: CategoryId | 'all';
  query: string;
}

export function filterFactorRows(
  rows: readonly FactorRow[],
  filter: FactorFilter,
): readonly FactorRow[] {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(
    (row) =>
      (filter.category === 'all' || row.category === filter.category) &&
      words.every((word) => row.haystack.includes(word)),
  );
}

/** How many rows each category holds, for the chip counts. */
export function countByCategory(rows: readonly FactorRow[]): Record<CategoryId | 'all', number> {
  const counts: Record<string, number> = { all: rows.length };
  for (const row of rows) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return counts as Record<CategoryId | 'all', number>;
}

/**
 * Which row a bare hash means. Older links use `#walk-cycle-instead-of-car` or a source key
 * without the prefix; the page prints `action-…` and `source-…`.
 */
export function resolveAnchor(hash: string, has: (id: string) => boolean): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  if (!id) return null;
  for (const candidate of [id, `action-${id}`, `source-${id}`]) {
    if (has(candidate)) return candidate;
  }
  return null;
}

export interface SourceListRow {
  key: string;
  anchor: string;
  title: string;
  publisher: string | null;
  year: number;
  url: string;
  /** Catalogue actions that cite it: id and title. */
  actions: readonly { id: string; title: string; anchor: string }[];
  /** "Also cited by 1 starting-line question, 2 lessons and 1 chart." or null. */
  alsoCitedBy: string | null;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Every source of the factor table, with who cites it, sorted by title. */
export function sourceListRows(): readonly SourceListRow[] {
  const titleOf = new Map(ACTION_SOURCE_ROWS.map((row) => [row.id, row.title]));
  const extra = new Map(contentSourceRows().map((row) => [row.key, row]));
  return SOURCE_ROWS.map((row: SourceRow) => {
    const content = extra.get(row.key);
    const parts: string[] = [];
    if (row.baselineQuestions.length) {
      parts.push(plural(row.baselineQuestions.length, 'starting-line question'));
    }
    if (row.equivalences.length) parts.push(plural(row.equivalences.length, 'equivalence'));
    if (content) {
      const lessons = content.usedBy.filter((use) => use.startsWith('lesson:')).length;
      const other = content.usedBy.length - lessons;
      if (lessons) parts.push(plural(lessons, 'lesson'));
      if (other) parts.push(plural(other, 'fact or post', 'facts and posts'));
      if (content.datasets.length) parts.push(plural(content.datasets.length, 'chart'));
    }
    return {
      key: row.key,
      anchor: row.anchor,
      title: row.title,
      publisher: row.publisher,
      year: row.year,
      url: row.url,
      actions: row.actions.map((id) => ({
        id,
        title: titleOf.get(id) ?? id,
        anchor: `action-${id}`,
      })),
      alsoCitedBy: parts.length ? `Also cited by ${parts.join(', ')}.` : null,
    };
  });
}

/** Sources that only Learn, Impact or the posts cite, so the factor sources are not repeated. */
export function contentOnlySourceRows() {
  return contentSourceRows().filter((row) => !row.inCatalogue);
}

/** The estimate the page's "try it" mark opens: a real catalogue action at its default quantity. */
export function demoEstimate(): {
  title: string;
  quantity: string;
  kg: string;
  source: EstimateSource;
} {
  const row =
    ACTION_SOURCE_ROWS.find((candidate) => candidate.id === 'walk-cycle-instead-of-car') ??
    ACTION_SOURCE_ROWS.find((candidate) => candidate.kgPerUnit !== null);
  if (!row || row.kgPerUnit === null || row.low === null || row.high === null) {
    throw new Error('methodology: the catalogue has no quantified action to demonstrate');
  }
  const quantity = 5;
  const kg = quantity * row.kgPerUnit;
  const first = row.sources[0];
  const text = formatCo2Estimate(kg);
  return {
    title: row.title,
    quantity: `${quantity} ${row.unit}`,
    kg: text,
    source: {
      code: row.id,
      kind: 'factor',
      formula: `${quantity} ${row.unit} × ${formatDecimal(row.kgPerUnit, 3)} kg = ${text}`,
      comparedWith: `Compared with ${row.comparedWith}.`,
      range: `${formatCo2Estimate(quantity * row.low)} to ${formatCo2Estimate(quantity * row.high)}`,
      sourceLabel: first?.publisher ?? first?.title ?? 'Evidence base',
      year: first?.year,
      href: `${ROUTES.methodology}#${row.anchor}`,
    },
  };
}
