import { describe, expect, it } from 'vitest';
import { LIVE_MAX_AGE_MS, SIGNAL_IDS, isLive, type ClimatePayload } from './contract';
import { createClimateHandler } from './handler';
import { CLIMATE_REGIONS } from './regions';
import { ENDPOINTS, createClimateService, type Fetcher } from './service';
import { CLIMATE_SNAPSHOT } from './snapshot';
import {
  ClimateDataError,
  METHANE,
  parseCo2Mirror,
  parseGasMirror,
  parseGistempCsv,
  parseGistempMirror,
  parseNoaaCo2Csv,
  parseWorldBank,
} from './sources';
import { parseClimatePayload } from './validate';

const NOW = Date.UTC(2026, 9, 6, 12);
const HOUR = 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** NASA's table from 1880 to August 2026: every month of year Y reads (Y - 1880) / 100. */
function gistempCsv(lastYear = 2026, lastMonth = 8): string {
  const rows = ['Land-Ocean: Global Means', `Year,${MONTHS.join(',')},J-D,D-N`];
  for (let year = 1880; year <= lastYear; year += 1) {
    const value = ((year - 1880) / 100).toFixed(2);
    const cells = MONTHS.map((_, index) =>
      year === lastYear && index + 1 > lastMonth ? '***' : value,
    );
    rows.push(`${year},${cells.join(',')},${value},***`);
  }
  return rows.join('\n');
}

function gistempMirror(): string {
  const result = [];
  for (let year = 1880; year <= 2026; year += 1)
    for (let month = 1; month <= (year === 2026 ? 8 : 12); month += 1)
      result.push({
        time: (year + (month - 0.5) / 12).toFixed(2),
        station: '9.99',
        land: (month / 100).toFixed(2),
      });
  return JSON.stringify({ error: null, result });
}

/** Daily CO2 for the 1,200 days up to `last`: the trend climbs 0.01 ppm a day to 428. */
function co2Days(last = Date.UTC(2026, 9, 5)) {
  return Array.from({ length: 1200 }, (_, index) => {
    const date = new Date(last - (1199 - index) * 24 * HOUR);
    const trend = 428 - (1199 - index) * 0.01;
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      cycle: (trend - 2).toFixed(2),
      trend: trend.toFixed(2),
    };
  });
}

function noaaCsv(last?: number): string {
  const rows = co2Days(last).map(
    (entry) => `${entry.year},${entry.month},${entry.day},  ${entry.cycle},  ${entry.trend}`,
  );
  return ['# NOAA comment', '# another', 'year,month,day,smoothed,trend', ...rows].join('\n');
}

function co2Mirror(): string {
  return JSON.stringify({
    co2: co2Days().map((entry) => ({
      ...entry,
      year: String(entry.year),
      month: String(entry.month),
      day: String(entry.day),
    })),
  });
}

function gasMirror(key: 'methane' | 'nitrous', base: number): string {
  const rows = [];
  for (let year = 2010; year <= 2026; year += 1)
    for (let month = 1; month <= (year === 2026 ? 5 : 12); month += 1)
      rows.push({
        date: `${year}.${month}`,
        average: (base + (year - 2010) + month / 100).toFixed(2),
        trend: String(base),
      });
  return JSON.stringify({ [key]: rows });
}

function worldBank(): string {
  const row = (iso: string, name: string, value: number | null) => ({
    countryiso3code: iso,
    country: { id: iso.slice(0, 2), value: name },
    date: '2024',
    value,
  });
  const rows = [
    row('WLD', 'World', 4.6938),
    row('PLW', 'Palau', 82.8),
    row('ABW', 'Aruba', null),
    ...CLIMATE_REGIONS.map((region, index) =>
      row(region.iso3, `WB ${region.iso3}`, 1 + index / 10),
    ),
  ];
  return `${String.fromCharCode(0xfeff)}${JSON.stringify([{ page: 1, pages: 1, total: rows.length }, rows])}`;
}

const BODIES: Record<string, () => string> = {
  [ENDPOINTS.gistempCsv]: gistempCsv,
  [ENDPOINTS.gistempMirror]: gistempMirror,
  [ENDPOINTS.co2Csv]: noaaCsv,
  [ENDPOINTS.co2Mirror]: co2Mirror,
  [ENDPOINTS.methaneMirror]: () => gasMirror('methane', 1900),
  [ENDPOINTS.nitrousMirror]: () => gasMirror('nitrous', 320),
  [ENDPOINTS.worldBank]: worldBank,
};

/** A scripted internet: every source answers unless it is listed as down. */
function internet(options: { down?: readonly string[]; date?: () => number } = {}) {
  const calls: string[] = [];
  const state = { down: new Set(options.down ?? []) };
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const body = BODIES[url];
    if (state.down.has(url) || !body) return new Response('gateway timeout', { status: 504 });
    const headers = options.date ? { date: new Date(options.date()).toUTCString() } : undefined;
    return new Response(body(), { status: 200, headers });
  };
  return { calls, state, fetcher };
}

const ALL = Object.keys(BODIES);

describe('reading NASA GISTEMP', () => {
  it('reads months, skips the unpublished ones and averages only complete years', () => {
    const body = parseGistempCsv(gistempCsv(), NOW);
    expect(body.latest).toEqual({ month: '2026-08', value: 1.46 });
    expect(body.yearAgo).toEqual({ month: '2025-08', value: 1.45 });
    expect(body.annual[0]).toEqual({ year: 1880, value: 0 });
    expect(body.annual.at(-1)).toEqual({ year: 2025, value: 1.45 });
    // Eight months at 1.46 and four at 1.45.
    expect(body.lastTwelve).toBe(1.46);
  });

  it('turns the mirror’s fraction of a year into the right month, January to December', () => {
    const body = parseGistempMirror(gistempMirror(), NOW);
    expect(body.latest).toEqual({ month: '2026-08', value: 0.08 });
    expect(body.yearAgo).toEqual({ month: '2025-08', value: 0.08 });
    // Months 1 to 12 at 0.01 to 0.12 average 0.065 only if none was dropped or doubled.
    expect(body.annual.at(-1)).toEqual({ year: 2025, value: 0.07 });
    expect(body.annual).toHaveLength(146);
  });

  it('refuses a series that stops too long ago, is too short or is not a temperature', () => {
    expect(() => parseGistempCsv(gistempCsv(2025, 12), NOW)).toThrow(ClimateDataError);
    expect(() => parseGistempCsv('Year,Jan\n2026,1.2', NOW)).toThrow(ClimateDataError);
    expect(() => parseGistempCsv(gistempCsv().replace(/1\.46/g, '14.6'), NOW)).toThrow(
      /out of range/,
    );
    expect(() => parseGistempMirror('<html>busy</html>', NOW)).toThrow(ClimateDataError);
  });
});

describe('reading NOAA CO2', () => {
  it('reads the newest day, the same day a year before and monthly means', () => {
    const body = parseNoaaCo2Csv(noaaCsv(), NOW);
    expect(body.latest).toEqual({ day: '2026-10-05', trend: 428, cycle: 426 });
    expect(body.yearAgo).toEqual({ day: '2025-10-05', trend: 424.35 });
    expect(body.monthly.at(-1)).toEqual({ month: '2026-10', trend: 427.98, cycle: 425.98 });
    expect(body.monthly.map((entry) => entry.month)).toContain('2025-02');
  });

  it('reads the mirror, whose fields are all strings, to the same answer', () => {
    expect(parseCo2Mirror(co2Mirror(), NOW)).toEqual(parseNoaaCo2Csv(noaaCsv(), NOW));
  });

  it('refuses a file whose newest day is months old', () => {
    expect(() => parseNoaaCo2Csv(noaaCsv(Date.UTC(2026, 5, 1)), NOW)).toThrow(/too old/);
  });
});

describe('reading the monthly gases', () => {
  it('reads "2025.10" as October and "2025.1" as January', () => {
    const body = parseGasMirror(gasMirror('methane', 1900), METHANE, NOW);
    expect(body.latest).toEqual({ month: '2026-05', value: 1916.1 });
    expect(body.yearAgo).toEqual({ month: '2025-05', value: 1915.1 });
  });

  it('refuses a body for a different gas', () => {
    expect(() => parseGasMirror(gasMirror('nitrous', 320), METHANE, NOW)).toThrow(ClimateDataError);
    expect(() => parseGasMirror(gasMirror('methane', 320), METHANE, NOW)).toThrow(/out of range/);
  });
});

describe('reading the World Bank', () => {
  it('keeps the world and the app’s regions, and ignores everywhere else', () => {
    const body = parseWorldBank(worldBank(), NOW);
    expect(body.world).toEqual({ id: 'WORLD', name: 'World', value: 4.69, year: 2024 });
    expect(body.rows).toHaveLength(CLIMATE_REGIONS.length);
    expect(body.rows[0]).toEqual({ id: 'IN', name: 'India', value: 1, year: 2024 });
    // A grouping keeps the bank's own name, because its borders are the bank's.
    expect(body.rows.find((row) => row.id === 'EUROPE')?.name).toBe('WB ECS');
  });

  it('refuses an answer without a believable world average', () => {
    expect(() => parseWorldBank(worldBank().replace('4.6938', '46.938'), NOW)).toThrow(
      ClimateDataError,
    );
    expect(() => parseWorldBank('[{"message":[{"id":"120"}]}]', NOW)).toThrow(ClimateDataError);
  });
});

describe('the climate service', () => {
  const service = (net: ReturnType<typeof internet>, clock: { now: number }) =>
    createClimateService({ fetch: net.fetcher, snapshot: CLIMATE_SNAPSHOT, now: () => clock.now });

  it('marks every reading live when the publishers answer, from their own files first', async () => {
    const net = internet();
    const payload = await service(net, { now: NOW }).load();
    for (const id of SIGNAL_IDS) expect(payload[id].status).toBe('live');
    expect(payload.temperature.source.via).toBeUndefined();
    expect(payload.co2.source.via).toBeUndefined();
    expect(payload.temperature.fetchedAt).toBe(new Date(NOW).toISOString());
    expect(net.calls).not.toContain(ENDPOINTS.gistempMirror);
    expect(parseClimatePayload(JSON.parse(JSON.stringify(payload)))).not.toBeNull();
  });

  it('falls back to the mirror, and says so, when a publisher’s own file is down', async () => {
    const net = internet({ down: [ENDPOINTS.gistempCsv, ENDPOINTS.co2Csv] });
    const payload = await service(net, { now: NOW }).load();
    expect(payload.temperature.status).toBe('live');
    expect(payload.temperature.source.via).toBe('global-warming.org');
    expect(payload.co2.source.via).toBe('global-warming.org');
    expect(payload.co2.latest.trend).toBe(428);
  });

  it('serves the bundled snapshot, never called live, when nothing can be reached', async () => {
    const payload = await service(internet({ down: ALL }), { now: NOW }).load();
    for (const id of SIGNAL_IDS) {
      expect(payload[id].status).toBe('snapshot');
      expect(payload[id].fetchedAt).toBe(CLIMATE_SNAPSHOT[id].fetchedAt);
    }
    expect(payload.co2.latest).toEqual(CLIMATE_SNAPSHOT.co2.latest);
  });

  it('mixes live readings with a snapshot for the one source that is down', async () => {
    const payload = await service(internet({ down: [ENDPOINTS.worldBank] }), { now: NOW }).load();
    expect(payload.perPerson.status).toBe('snapshot');
    expect(payload.temperature.status).toBe('live');
  });

  it('asks the publishers once an hour, not on every request', async () => {
    const net = internet();
    const clock = { now: NOW };
    const climate = service(net, clock);
    await climate.load();
    const first = net.calls.length;
    clock.now += 59 * 60 * 1000;
    await climate.load();
    expect(net.calls).toHaveLength(first);
    clock.now += 2 * 60 * 1000;
    await climate.load();
    expect(net.calls).toHaveLength(first * 2);
  });

  it('shares one round of upstream calls between simultaneous requests', async () => {
    const net = internet();
    const climate = service(net, { now: NOW });
    const [a, b] = await Promise.all([climate.load(), climate.load()]);
    expect(a).toBe(b);
    expect(net.calls).toHaveLength(5);
  });

  it('waits five minutes before retrying a source that failed', async () => {
    const net = internet({ down: [ENDPOINTS.worldBank] });
    const clock = { now: NOW };
    const climate = service(net, clock);
    await climate.load();
    const asked = () => net.calls.filter((url) => url === ENDPOINTS.worldBank).length;
    expect(asked()).toBe(1);
    net.state.down.clear();
    clock.now += 4 * 60 * 1000;
    expect((await climate.load()).perPerson.status).toBe('snapshot');
    expect(asked()).toBe(1);
    clock.now += 2 * 60 * 1000;
    expect((await climate.load()).perPerson.status).toBe('live');
    expect(asked()).toBe(2);
  });

  it('keeps the last good reading through an outage, and stops calling it live after a day and a half', async () => {
    const net = internet();
    const clock = { now: NOW };
    const climate = service(net, clock);
    await climate.load();
    net.state.down = new Set(ALL);
    clock.now = NOW + 2 * HOUR;
    const soon = await climate.load();
    expect(soon.co2.status).toBe('live');
    expect(soon.co2.fetchedAt).toBe(new Date(NOW).toISOString());
    clock.now = NOW + LIVE_MAX_AGE_MS + HOUR;
    const later = await climate.load();
    expect(later.co2.status).toBe('snapshot');
    // Still the reading this server fetched itself, not the older bundled one.
    expect(later.co2.latest.trend).toBe(428);
    expect(later.co2.fetchedAt).toBe(new Date(NOW).toISOString());
  });

  it('dates a reading by the publisher’s Date header, so a replayed cache entry is not called fresh', async () => {
    const twoDaysAgo = NOW - 48 * HOUR;
    const payload = await service(internet({ date: () => twoDaysAgo }), { now: NOW }).load();
    expect(payload.temperature.fetchedAt).toBe(new Date(twoDaysAgo).toISOString());
    expect(payload.temperature.status).toBe('snapshot');
    const recent = await service(internet({ date: () => NOW - 20 * HOUR }), { now: NOW }).load();
    expect(recent.temperature.status).toBe('live');
  });
});

describe('the live rule', () => {
  it('needs both a live status and a recent fetch', () => {
    const fetchedAt = new Date(NOW).toISOString();
    expect(isLive({ status: 'live', fetchedAt }, NOW + HOUR)).toBe(true);
    expect(isLive({ status: 'live', fetchedAt }, NOW + LIVE_MAX_AGE_MS + 1)).toBe(false);
    expect(isLive({ status: 'snapshot', fetchedAt }, NOW)).toBe(false);
    expect(isLive({ status: 'live', fetchedAt: 'yesterday' }, NOW)).toBe(false);
    // A reading dated in the future is a broken clock, not fresh data.
    expect(isLive({ status: 'live', fetchedAt }, NOW - HOUR)).toBe(false);
  });
});

describe('the bundled snapshot', () => {
  it('is a complete payload whose readings are all snapshots', () => {
    for (const id of SIGNAL_IDS) expect(CLIMATE_SNAPSHOT[id].status).toBe('snapshot');
    expect(CLIMATE_SNAPSHOT.temperature.annual[0]?.year).toBe(1880);
    expect(CLIMATE_SNAPSHOT.co2.monthly.length).toBeGreaterThan(100);
    expect(CLIMATE_SNAPSHOT.perPerson.rows.length).toBeGreaterThanOrEqual(40);
  });

  it('is rejected by the validator once a part is missing or mangled', () => {
    const copy = JSON.parse(JSON.stringify(CLIMATE_SNAPSHOT)) as Record<string, unknown>;
    expect(parseClimatePayload(copy)).not.toBeNull();
    expect(parseClimatePayload({ ...copy, co2: undefined })).toBeNull();
    expect(parseClimatePayload({ ...copy, version: 2 })).toBeNull();
    const temperature = { ...(copy.temperature as object), annual: [] };
    expect(parseClimatePayload({ ...copy, temperature })).toBeNull();
    expect(parseClimatePayload('<html>')).toBeNull();
  });
});

describe('GET /api/climate', () => {
  const handlerFor = (net: ReturnType<typeof internet>) =>
    createClimateHandler({
      service: createClimateService({
        fetch: net.fetcher,
        snapshot: CLIMATE_SNAPSHOT,
        now: () => NOW,
      }),
      snapshot: CLIMATE_SNAPSHOT,
      now: () => NOW,
    });
  const get = () => new Request('https://touchgrass.test/api/climate');

  it('answers with a full payload that a shared cache may keep for an hour', async () => {
    const response = await handlerFor(internet())(get());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(response.headers.get('content-type')).toContain('application/json');
    const payload = parseClimatePayload(await response.json());
    expect(payload?.co2.status).toBe('live');
  });

  it('still answers 200 with snapshots, cached only briefly, when every source is down', async () => {
    const response = await handlerFor(internet({ down: ALL }))(get());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=300');
    const payload = (await response.json()) as ClimatePayload;
    expect(payload.temperature.status).toBe('snapshot');
    expect(JSON.stringify(payload)).not.toContain('gateway timeout');
  });

  it('falls back to the snapshot if the service itself throws', async () => {
    const handler = createClimateHandler({
      service: { load: () => Promise.reject(new Error('boom')) },
      snapshot: CLIMATE_SNAPSHOT,
      now: () => NOW,
    });
    const response = await handler(get());
    expect(response.status).toBe(200);
    expect(parseClimatePayload(await response.json())?.perPerson.status).toBe('snapshot');
  });

  it('refuses anything but GET and HEAD', async () => {
    const handler = handlerFor(internet());
    const post = await handler(
      new Request('https://touchgrass.test/api/climate', { method: 'POST' }),
    );
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
    const head = await handler(
      new Request('https://touchgrass.test/api/climate', { method: 'HEAD' }),
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });
});
