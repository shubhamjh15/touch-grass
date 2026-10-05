/**
 * The claims test. Every item of learning content lists the figures it prints, each with a
 * source key and how it was checked. This test fails when a figure is printed without a claim,
 * when a claim names a figure that is not in the text, or when a claim points at a source that
 * does not exist. Run with `-t "claims table"` to print the full table of figures and sources.
 */
import { describe, expect, it } from 'vitest';
import { allContentItems, claimsRegister, type ContentItem } from './contentItems';
import { DATASETS } from './datasets';
import { CONTENT_SOURCES } from './lessons';

/** Digits of every number in a string, without thousands separators. */
function numbersIn(text: string): string[] {
  const plain = text.replace(/CO2e?|N2O|CH4/g, 'gas').replace(/(\d),(\d{3})/g, '$1$2');
  return plain.match(/\d+(?:\.\d+)?/g) ?? [];
}

/** Four-digit calendar years are references to dates, not claims. */
const isYear = (token: string) => /^(18|19|20)\d{2}$/.test(token);

const ITEMS = allContentItems();

describe('claims', () => {
  it('has content to check', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(58);
  });

  it.each(ITEMS.map((item) => [item.label, item] as const))(
    '%s: every claim figure appears in the text',
    (_label, item) => {
      for (const claim of item.claims) {
        expect(item.text, `${item.label}: claim ${claim.id} "${claim.figure}"`).toContain(
          claim.figure,
        );
      }
    },
  );

  it.each(ITEMS.map((item) => [item.label, item] as const))(
    '%s: every printed number is covered by a claim',
    (_label, item) => {
      const covered = new Set(item.claims.flatMap((claim) => numbersIn(claim.figure)));
      const uncovered = [...new Set(numbersIn(item.text))].filter(
        (token) => !isYear(token) && !covered.has(token),
      );
      expect(uncovered, `${item.label}: numbers with no claim`).toEqual([]);
    },
  );

  it.each(ITEMS.map((item) => [item.label, item] as const))(
    '%s: claims name real sources and have unique ids',
    (_label, item: ContentItem) => {
      const ids = new Set<string>();
      for (const claim of item.claims) {
        expect(CONTENT_SOURCES, `${item.label}: ${claim.id}`).toHaveProperty(claim.source);
        expect(ids.has(claim.id), `duplicate claim id ${claim.id}`).toBe(false);
        ids.add(claim.id);
        expect(claim.statement.trim().length).toBeGreaterThan(10);
      }
    },
  );

  it('uses a source that exists for every callout', () => {
    for (const item of ITEMS) {
      for (const key of item.sourceKeys) {
        expect(CONTENT_SOURCES, `${item.label} cites ${key}`).toHaveProperty(key);
      }
    }
  });

  it('lists every numeric claim with its source key', () => {
    const register = claimsRegister();
    const numeric = register.filter((row) => /[0-9]/.test(row.figure));
    expect(numeric.length).toBeGreaterThan(150);
    for (const row of numeric) {
      expect(row.source, `${row.item}: ${row.figure}`).toBeTruthy();
      expect(CONTENT_SOURCES).toHaveProperty(row.source);
      expect(['dataset', 'evidence-base', 'web', 'derived']).toContain(row.basis);
    }
    const printed = new Set(ITEMS.flatMap((item) => item.claims.map((claim) => claim.figure)));
    expect(printed.size).toBeGreaterThan(100);
  });

  it('has a dataset-backed claim for every figure drawn from a bundled dataset', () => {
    const fromDatasets = claimsRegister().filter((row) => row.basis === 'dataset');
    expect(fromDatasets.length).toBeGreaterThan(5);
    const datasetKeys = new Set(DATASETS.map((dataset) => dataset.sourceKey));
    for (const row of fromDatasets) {
      expect(
        datasetKeys.has(row.source),
        `${row.item}: ${row.source} is not a dataset source`,
      ).toBe(true);
    }
  });

  it('keeps the review dates in the future', () => {
    const today = '2026-10-06';
    for (const item of ITEMS) {
      expect(item.reviewBy > today, `${item.label} reviewBy ${item.reviewBy}`).toBe(true);
    }
  });
});
