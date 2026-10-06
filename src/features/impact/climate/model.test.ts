import { describe, expect, it } from 'vitest';
import { REGION_IDS } from '@/data/catalogue';
import { CLIMATE_REGIONS } from '../../../../server/climate/regions';
import { CLIMATE_SNAPSHOT } from '../../../../server/climate/snapshot';
import {
  againstWorld,
  co2Series,
  co2Ticks,
  dayLabel,
  freshness,
  freshnessText,
  headlineReadings,
  monthLabel,
  monthX,
  monthXLabel,
  perPersonTable,
  personBars,
  signed,
  sourceLine,
  temperatureCaption,
} from './model';

const NOW = Date.UTC(2026, 9, 6, 12);
const HOUR = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

describe('live or snapshot', () => {
  it('says Live only for a live reading fetched within a day and a half', () => {
    expect(freshness({ status: 'live', fetchedAt: iso(NOW - HOUR) }, NOW)).toEqual({
      kind: 'live',
      date: '6 Oct 2026',
    });
    const stale = freshness({ status: 'live', fetchedAt: iso(NOW - 40 * HOUR) }, NOW);
    expect(freshnessText(stale)).toBe('Snapshot from 4 Oct 2026');
    const saved = freshness({ status: 'snapshot', fetchedAt: iso(NOW - HOUR) }, NOW);
    expect(saved.kind).toBe('snapshot');
  });

  it('never calls the bundled copy live, whatever its fields say', () => {
    const state = freshness({ status: 'live', fetchedAt: iso(NOW - HOUR) }, NOW, true);
    expect(freshnessText(state)).toBe('Snapshot from 6 Oct 2026');
  });

  it('names the mirror when a reading came through one', () => {
    const source = { name: 'GISTEMP v4', publisher: 'NASA GISS', url: 'https://example.org' };
    expect(sourceLine({ source })).toBe('NASA GISS');
    expect(sourceLine({ source: { ...source, via: 'global-warming.org' } })).toBe(
      'NASA GISS, via global-warming.org',
    );
  });
});

describe('wording', () => {
  it('formats months, days and signed figures', () => {
    expect(monthLabel('2026-08')).toBe('Aug 2026');
    expect(dayLabel('2026-10-05')).toBe('5 Oct 2026');
    expect(signed(1.4, 2)).toBe('+1.4');
    expect(signed(-0.2, 2)).toBe('-0.2');
    expect(signed(0, 1)).toBe('0');
  });

  it('places a country against the world in plain words', () => {
    expect(againstWorld(2.17, 4.69)).toBe('54% below the world average');
    expect(againstWorld(13.62, 4.69)).toBe('2.9 times the world average');
    expect(againstWorld(5.47, 4.69)).toBe('17% above the world average');
    expect(againstWorld(4.7, 4.69)).toBe('About the world average');
  });

  it('puts months evenly on a year axis and reads them back', () => {
    expect(monthXLabel(monthX('2026-01'))).toBe('Jan 2026');
    expect(monthXLabel(monthX('2026-08'))).toBe('Aug 2026');
    expect(monthXLabel(monthX('2025-12'))).toBe('Dec 2025');
    expect(monthXLabel(2024)).toBe('2024');
  });
});

describe('the snapshot, as the page reads it', () => {
  const payload = CLIMATE_SNAPSHOT;

  it('leads with temperature, CO2 and the user’s own country', () => {
    const [temperature, co2, person] = headlineReadings(payload, 'IN');
    expect(temperature?.unit).toBe('°C');
    expect(temperature?.context).toContain('against the 1951 to 1980 average');
    expect(co2?.unit).toBe('ppm');
    expect(co2?.change).toMatch(/ppm in a year$/);
    expect(person?.label).toBe('CO2 per person, India');
    expect(person?.change).toContain('below the world average');
  });

  it('shows the world alone when the region has no World Bank figure', () => {
    for (const region of ['WORLD', 'ASIA', 'OCEANIA']) {
      const person = headlineReadings(payload, region)[2];
      expect(person?.label).toBe('CO2 per person, world');
      expect(person?.change).toBeNull();
      expect(personBars(payload.perPerson, region, null).map((bar) => bar.role)).toEqual(['world']);
    }
  });

  it('adds the user’s starting line as its own bar only when there is one', () => {
    expect(personBars(payload.perPerson, 'IN', 6.8).map((bar) => bar.role)).toEqual([
      'you',
      'region',
      'world',
    ]);
    expect(personBars(payload.perPerson, 'IN', null).map((bar) => bar.role)).toEqual([
      'region',
      'world',
    ]);
  });

  it('lists every place, highest first, with the world in its rank', () => {
    const rows = perPersonTable(payload.perPerson).rows;
    expect(rows).toHaveLength(payload.perPerson.rows.length + 1);
    const values = rows.map((row) => Number(row[1]));
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    expect(rows.some((row) => row[0] === 'World')).toBe(true);
  });

  it('states only what the temperature record says', () => {
    const warmest = payload.temperature.annual.reduce((a, b) => (b.value > a.value ? b : a));
    expect(temperatureCaption(payload.temperature)).toContain(
      `${warmest.year} is the warmest year on record`,
    );
  });

  it('draws the CO2 trend and the seasonal line on whole-year ticks', () => {
    const [trend, cycle] = co2Series(payload.co2);
    expect(trend?.points).toHaveLength(payload.co2.monthly.length);
    expect(cycle?.points.at(-1)?.y).toBe(payload.co2.monthly.at(-1)?.cycle);
    for (const tick of co2Ticks(payload.co2)) expect(Number.isInteger(tick)).toBe(true);
  });
});

describe('regions', () => {
  it('maps every region of the app to the World Bank, or leaves it out on purpose', () => {
    const mapped = new Set(CLIMATE_REGIONS.map((region) => region.id));
    const unmapped = REGION_IDS.filter((id) => !mapped.has(id));
    expect(unmapped).toEqual(['WORLD', 'ASIA', 'OCEANIA']);
    for (const region of CLIMATE_REGIONS) expect(REGION_IDS).toContain(region.id);
    expect(new Set(CLIMATE_REGIONS.map((region) => region.iso3)).size).toBe(CLIMATE_REGIONS.length);
  });
});
