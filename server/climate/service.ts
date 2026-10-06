/**
 * Puts the climate answer together. Every reading has a chain of sources, the publisher's own
 * file first and a mirror second. A reading that cannot be fetched or does not validate falls
 * back to the last good one this server saw, and failing that to the snapshot bundled with the
 * app, so the answer is always complete. Only a reading that really was fetched recently is
 * marked live. Platform-free: the caller supplies `fetch` (and with it the caching policy).
 */
import {
  isLive,
  type ClimatePayload,
  type ClimateSource,
  type Co2Signal,
  type GasSignal,
  type PerPersonSignal,
  type SignalMeta,
  type TemperatureSignal,
} from './contract';
import {
  METHANE,
  NITROUS_OXIDE,
  parseCo2Mirror,
  parseGasMirror,
  parseGistempCsv,
  parseGistempMirror,
  parseNoaaCo2Csv,
  parseWorldBank,
} from './sources';

export type Fetcher = (url: string) => Promise<Response>;

const MIRROR = 'global-warming.org';

export const SOURCES = {
  gistemp: {
    name: 'GISTEMP v4, land-ocean temperature index',
    publisher: 'NASA Goddard Institute for Space Studies',
    url: 'https://data.giss.nasa.gov/gistemp/',
  },
  co2: {
    name: 'Trends in atmospheric CO2, global daily',
    publisher: 'NOAA Global Monitoring Laboratory',
    url: 'https://gml.noaa.gov/ccgg/trends/gl_trend.html',
  },
  methane: {
    name: 'Trends in atmospheric methane, global monthly',
    publisher: 'NOAA Global Monitoring Laboratory',
    url: 'https://gml.noaa.gov/ccgg/trends_ch4/',
  },
  nitrousOxide: {
    name: 'Trends in atmospheric nitrous oxide, global monthly',
    publisher: 'NOAA Global Monitoring Laboratory',
    url: 'https://gml.noaa.gov/ccgg/trends_n2o/',
  },
  worldBank: {
    name: 'CO2 emissions per capita, excluding land use (EN.GHG.CO2.PC.CE.AR5)',
    publisher: 'World Bank, World Development Indicators',
    url: 'https://data.worldbank.org/indicator/EN.GHG.CO2.PC.CE.AR5',
  },
} as const satisfies Record<string, ClimateSource>;

export const ENDPOINTS = {
  gistempCsv: 'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv',
  gistempMirror: 'https://global-warming.org/api/temperature-api',
  co2Csv: 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_trend_gl.csv',
  co2Mirror: 'https://global-warming.org/api/co2-api',
  methaneMirror: 'https://global-warming.org/api/methane-api',
  nitrousMirror: 'https://global-warming.org/api/nitrous-oxide-api',
  worldBank:
    'https://api.worldbank.org/v2/country/all/indicator/EN.GHG.CO2.PC.CE.AR5?format=json&mrnev=1&per_page=400',
} as const;

/** How long a good reading is reused before the source chain is asked again. */
const MEMO_MS = 60 * 60 * 1000;
/** After every source of a reading failed, how long before trying them again. */
const RETRY_MS = 5 * 60 * 1000;
const MAX_BODY_CHARS = 2_000_000;

type Body<S extends SignalMeta> = Omit<S, keyof SignalMeta>;

interface SourceStep<S extends SignalMeta> {
  url: string;
  source: ClimateSource;
  parse: (body: string, now: number) => Body<S>;
}

/**
 * When the publisher's answer was received. A cached upstream response keeps its original
 * `Date` header, so an answer replayed from a day-old cache is dated a day ago, not now.
 */
function receivedAt(response: Response, now: number): number {
  const header = response.headers.get('date');
  const stamped = header ? Date.parse(header) : Number.NaN;
  return Number.isFinite(stamped) && stamped <= now ? stamped : now;
}

function reader<S extends SignalMeta>(
  steps: readonly SourceStep<S>[],
  fallback: S,
  fetcher: Fetcher,
): (now: number) => Promise<S> {
  let kept: { at: number; signal: S } | null = null;
  let failedAt: number | null = null;

  const stamped = (signal: S, now: number): S => ({
    ...signal,
    status: isLive({ status: 'live', fetchedAt: signal.fetchedAt }, now) ? 'live' : 'snapshot',
  });
  const settle = (now: number): S =>
    kept ? stamped(kept.signal, now) : { ...fallback, status: 'snapshot' };

  return async (now) => {
    if (kept && now - kept.at < MEMO_MS) return stamped(kept.signal, now);
    if (failedAt !== null && now - failedAt < RETRY_MS) return settle(now);
    for (const step of steps) {
      try {
        const response = await fetcher(step.url);
        if (!response.ok) continue;
        const text = await response.text();
        if (text.length > MAX_BODY_CHARS) continue;
        // Spread order matters: the parsed body first, so it can never overwrite the stamp.
        const signal = {
          ...step.parse(text, now),
          status: 'live',
          fetchedAt: new Date(receivedAt(response, now)).toISOString(),
          source: step.source,
        } as S;
        kept = { at: now, signal };
        failedAt = null;
        return stamped(signal, now);
      } catch {
        continue;
      }
    }
    failedAt = now;
    return settle(now);
  };
}

export interface ClimateService {
  load(): Promise<ClimatePayload>;
}

export interface ClimateServiceDeps {
  fetch: Fetcher;
  /** The bundled answer used for any reading that cannot be fetched. */
  snapshot: ClimatePayload;
  now?: () => number;
}

export function createClimateService(deps: ClimateServiceDeps): ClimateService {
  const now = deps.now ?? (() => Date.now());
  const { snapshot } = deps;
  const viaMirror = (source: ClimateSource): ClimateSource => ({ ...source, via: MIRROR });

  const temperature = reader<TemperatureSignal>(
    [
      { url: ENDPOINTS.gistempCsv, source: SOURCES.gistemp, parse: parseGistempCsv },
      {
        url: ENDPOINTS.gistempMirror,
        source: viaMirror(SOURCES.gistemp),
        parse: parseGistempMirror,
      },
    ],
    snapshot.temperature,
    deps.fetch,
  );
  const co2 = reader<Co2Signal>(
    [
      { url: ENDPOINTS.co2Csv, source: SOURCES.co2, parse: parseNoaaCo2Csv },
      { url: ENDPOINTS.co2Mirror, source: viaMirror(SOURCES.co2), parse: parseCo2Mirror },
    ],
    snapshot.co2,
    deps.fetch,
  );
  const methane = reader<GasSignal>(
    [
      {
        url: ENDPOINTS.methaneMirror,
        source: viaMirror(SOURCES.methane),
        parse: (body, at) => parseGasMirror(body, METHANE, at),
      },
    ],
    snapshot.methane,
    deps.fetch,
  );
  const nitrousOxide = reader<GasSignal>(
    [
      {
        url: ENDPOINTS.nitrousMirror,
        source: viaMirror(SOURCES.nitrousOxide),
        parse: (body, at) => parseGasMirror(body, NITROUS_OXIDE, at),
      },
    ],
    snapshot.nitrousOxide,
    deps.fetch,
  );
  const perPerson = reader<PerPersonSignal>(
    [{ url: ENDPOINTS.worldBank, source: SOURCES.worldBank, parse: parseWorldBank }],
    snapshot.perPerson,
    deps.fetch,
  );

  let inflight: Promise<ClimatePayload> | null = null;

  const build = async (): Promise<ClimatePayload> => {
    const at = now();
    const [t, c, m, n, p] = await Promise.all([
      temperature(at),
      co2(at),
      methane(at),
      nitrousOxide(at),
      perPerson(at),
    ]);
    return {
      version: 1,
      generatedAt: new Date(at).toISOString(),
      temperature: t,
      co2: c,
      methane: m,
      nitrousOxide: n,
      perPerson: p,
    };
  };

  return {
    load() {
      // Simultaneous requests share one round of upstream calls.
      inflight ??= build().finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}
