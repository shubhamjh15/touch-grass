import { describe, expect, it } from 'vitest';
import { MAX_BANDS, daysPerBand, ringBands, ringGeometry } from './ringDisc';
import { describeImport, formatStorage, matchesTypedName } from './dataFiles';
import { stampDate, thresholdText } from './labels';
import { DEFAULT_TAB, parseTab, tabHref, targetFromHash } from './tabs';

describe('ring disc', () => {
  it('draws one band per day while there is room', () => {
    const bands = ringBands(['full', 'ring', 'full']);
    expect(bands.map((band) => band.kind)).toEqual(['full', 'ring', 'full']);
    expect(daysPerBand(3)).toBe(1);
  });

  it('merges days when there are more than the disc can draw, keeping every day counted', () => {
    const sequence = Array.from(
      { length: 200 },
      (_, i) => (i % 2 === 0 ? 'full' : 'ring') as 'full' | 'ring',
    );
    const bands = ringBands(sequence);
    expect(bands.length).toBeLessThanOrEqual(MAX_BANDS);
    expect(bands.reduce((sum, band) => sum + band.days, 0)).toBe(200);
  });

  it('fills the disc from pith to bark, thick bands twice as wide', () => {
    const geometry = ringGeometry([
      { kind: 'full', days: 1 },
      { kind: 'ring', days: 1 },
    ]);
    const [first, second] = geometry;
    expect(second?.radius).toBeCloseTo(45);
    expect((first?.radius ?? 0) - 3.5).toBeCloseTo(2 * (45 - (first?.radius ?? 0)));
  });

  it('has nothing to draw for an empty sequence', () => {
    expect(ringBands([])).toEqual([]);
    expect(ringGeometry([])).toEqual([]);
  });
});

describe('tabs and anchors', () => {
  it('knows the anchors other pages link to', () => {
    expect(targetFromHash('#data')?.tab).toBe('data');
    expect(targetFromHash('#starting-line')).toEqual({ tab: 'settings', anchor: 'starting-line' });
    expect(targetFromHash('#nonsense')).toBeNull();
  });

  it('falls back to Badges and keeps other parameters', () => {
    expect(parseTab('nope')).toBe(DEFAULT_TAB);
    expect(tabHref('settings', 'a=1')).toBe('/me?a=1&tab=settings');
    expect(tabHref('badges', 'tab=data')).toBe('/me');
  });
});

describe('labels and files', () => {
  it('writes stamp dates and singular units', () => {
    expect(stampDate(new Date(2026, 9, 6).getTime())).toMatch(/^06 OCT 2026$/);
    expect(thresholdText('lessons', 1)).toBe('1 lesson');
    expect(thresholdText('acts', 10)).toBe('10 acts');
  });

  it('describes an import before it replaces anything', () => {
    expect(
      describeImport({
        treeName: 'Juniper',
        species: 'oak',
        rings: 43,
        logs: 212,
        firstLogDay: '2026-10-06',
        lastLogDay: '2026-11-18',
        plantedDay: '2026-10-01',
        exportedAt: null,
      }),
    ).toBe('Juniper · 43 rings · 212 logs · 6 Oct – 18 Nov');
  });

  it('matches a typed name ignoring case and spaces, never an empty one', () => {
    expect(matchesTypedName('  fern ', 'Fern')).toBe(true);
    expect(matchesTypedName('fer', 'Fern')).toBe(false);
    expect(matchesTypedName('', '')).toBe(false);
  });

  it('never shows a tiny save as zero', () => {
    expect(formatStorage(10)).toBe('1 kB');
    expect(formatStorage(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
