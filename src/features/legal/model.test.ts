import { describe, expect, it } from 'vitest';
import { ACTIONS, SOURCES } from '@/data/catalogue';
import {
  countByCategory,
  demoEstimate,
  factorRows,
  filterFactorRows,
  perUnitText,
  rangeText,
  resolveAnchor,
  sourceListRows,
} from './model';

describe('the factor table rows', () => {
  const rows = factorRows();

  it('has one row for every catalogue action, each with its own anchor', () => {
    expect(rows).toHaveLength(ACTIONS.length);
    expect(new Set(rows.map((row) => row.anchor)).size).toBe(rows.length);
    expect(rows[0]?.anchor).toBe(`action-${ACTIONS[0]?.id}`);
  });

  it('prints no number for an action that has no sourced factor', () => {
    const unquantified = rows.filter((row) => row.confidence === 'not_quantified');
    expect(unquantified.length).toBeGreaterThan(0);
    for (const row of unquantified) {
      expect(row.value).toBeNull();
      expect(row.range).toBeNull();
    }
  });

  it('links every source of a row to an anchor in the source list', () => {
    const anchors = new Set(sourceListRows().map((source) => source.anchor));
    for (const row of rows) {
      for (const source of row.sources) expect(anchors).toContain(source.anchor);
    }
  });

  it('filters by category and by every word of the search', () => {
    const counts = countByCategory(rows);
    expect(counts.all).toBe(rows.length);
    const moves = filterFactorRows(rows, { category: 'move', query: '' });
    expect(moves).toHaveLength(counts.move);
    expect(moves.every((row) => row.category === 'move')).toBe(true);
    const bus = filterFactorRows(rows, { category: 'all', query: 'bus  driving' });
    expect(bus.length).toBeGreaterThan(0);
    expect(
      bus.every((row) => row.haystack.includes('bus') && row.haystack.includes('driving')),
    ).toBe(true);
    expect(filterFactorRows(rows, { category: 'eat', query: 'zzzz' })).toHaveLength(0);
  });
});

describe('number words', () => {
  it('uses grams below 0.1 kg and two significant figures above', () => {
    expect(perUnitText(0.0123)).toBe('12 g');
    expect(perUnitText(0.2099)).toBe('0.21 kg');
    expect(perUnitText(6.34)).toBe('6.3 kg');
  });

  it('writes a range with one unit when both ends share it', () => {
    expect(rangeText(0.14, 0.34)).toBe('0.14 to 0.34 kg');
    expect(rangeText(0.053, 0.16)).toBe('53 g to 0.16 kg');
  });
});

describe('links to a row', () => {
  const known = new Set(['action-walk-cycle-instead-of-car', 'source-desnz2026']);
  const has = (id: string) => known.has(id);

  it('accepts the printed anchor and the bare id older links use', () => {
    expect(resolveAnchor('#action-walk-cycle-instead-of-car', has)).toBe(
      'action-walk-cycle-instead-of-car',
    );
    expect(resolveAnchor('#walk-cycle-instead-of-car', has)).toBe(
      'action-walk-cycle-instead-of-car',
    );
    expect(resolveAnchor('#desnz2026', has)).toBe('source-desnz2026');
    expect(resolveAnchor('#nothing-here', has)).toBeNull();
    expect(resolveAnchor('', has)).toBeNull();
  });
});

describe('the sources', () => {
  it('lists every source the catalogue defines, and some are cited by actions', () => {
    const list = sourceListRows();
    expect(list).toHaveLength(Object.keys(SOURCES).length);
    expect(list.some((row) => row.actions.length > 0)).toBe(true);
  });
});

describe('the demonstration estimate', () => {
  it('shows a real action with its formula, comparison, range and a methodology link', () => {
    const demo = demoEstimate();
    expect(demo.source.kind).toBe('factor');
    expect(demo.source.formula).toContain('×');
    expect(demo.source.comparedWith).toMatch(/^Compared with /);
    expect(demo.source.range).toMatch(/ to /);
    expect(demo.source.href).toMatch(/^\/methodology#action-/);
  });
});
