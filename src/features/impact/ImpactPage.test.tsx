import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS, game, gameActions, getGameState, selectImpact } from '@/game';
import { formatCo2Estimate } from '@/lib/format';
import { SIGNAL_IDS, type ClimatePayload } from '../../../server/climate/contract';
import { CLIMATE_SNAPSHOT } from '../../../server/climate/snapshot';
import { CLIMATE_ENDPOINT, resetClimateMemory } from './climate/useClimate';
import ImpactPage from './ImpactPage';
import { kgParts } from './model';

// A tiny stand-in for the router: `replace` and `push` change the query string and re-render readers.
const nav = vi.hoisted(() => {
  let search = '';
  const listeners = new Set<() => void>();
  return {
    read: () => search,
    set(next: string) {
      search = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hrefs: [] as string[],
  };
});

vi.mock('next/navigation', async () => {
  const React = await import('react');
  const go = (href: string) => {
    nav.hrefs.push(href);
    nav.set(href.split('?')[1] ?? '');
  };
  const router = { replace: go, push: go };
  return {
    useRouter: () => router,
    usePathname: () => '/impact',
    useSearchParams: () => {
      const search = React.useSyncExternalStore(nav.subscribe, nav.read, nav.read);
      return React.useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

vi.mock('@/world', () => ({
  WorldStage: ({ label }: { label?: string }) => <div role="img" aria-label={label} />,
  getStickingPoint: () => null,
}));

type Fixture = Record<string, { state: ReturnType<typeof getGameState>; version: number }>;

/** Fixtures are anchored to this morning. */
const NOW = new Date(2026, 9, 6, 10, 31).getTime();
const HOUR = 60 * 60 * 1000;

function seed(name: string, patch?: (state: ReturnType<typeof getGameState>) => void): void {
  const file = path.resolve('scripts/fixtures', `${name}.json`);
  const saved = (JSON.parse(readFileSync(file, 'utf8')) as Fixture)[STORAGE_KEYS.game];
  if (!saved) throw new Error(`fixture ${name} has no saved game`);
  patch?.(saved.state);
  localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
  game.rehydrate();
  gameActions.tick();
}

/** The bundled readings, re-stamped as if our server had fetched them `ageHours` ago. */
function answer(ageHours = 1): ClimatePayload {
  const payload = JSON.parse(JSON.stringify(CLIMATE_SNAPSHOT)) as ClimatePayload;
  for (const id of SIGNAL_IDS) {
    payload[id].status = 'live';
    payload[id].fetchedAt = new Date(NOW - ageHours * HOUR).toISOString();
  }
  return payload;
}

const fetchMock = vi.fn<typeof fetch>();
const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const headline = () => screen.findByRole('group', { name: 'The planet right now' });
const openPlanet = () => nav.set('view=planet');

beforeEach(() => {
  nav.set('');
  nav.hrefs.length = 0;
  resetClimateMemory();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => respond(answer()));
  vi.stubGlobal('fetch', fetchMock);
  game.setClock(() => NOW);
});

afterEach(() => {
  vi.unstubAllGlobals();
  game.setClock(() => Date.now());
  gameActions.resetAll();
});

describe('your impact', () => {
  it('shows the total, the counts and the categories from the user’s own log', async () => {
    seed('day200');
    const impact = selectImpact(getGameState(), NOW);
    render(<ImpactPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Impact' })).toBeInTheDocument();
    const totals = screen.getByRole('group', { name: 'Totals so far' });
    expect(within(totals).getByText(kgParts(impact.kg).value)).toBeInTheDocument();
    expect(within(totals).getByText('Logs')).toBeInTheDocument();
    // The honest picture of the total sits next to it, worded as a comparison.
    expect(within(totals).getByText(/roughly/i)).toBeInTheDocument();

    const section = screen.getByRole('region', { name: 'Where it comes from' });
    expect(within(section).getByRole('heading', { name: 'By category' })).toBeInTheDocument();
    await userEvent.click(within(section).getAllByRole('button', { name: 'View as table' })[0]!);
    const table = within(section).getByRole('table');
    expect(
      within(table).getByRole('columnheader', { name: 'kg avoided (est.)' }),
    ).toBeInTheDocument();
    // A header and the seven categories, each with its own estimate from the log.
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    const top = [...impact.byCategory].sort((a, b) => b.kg - a.kg)[0];
    expect(top && top.kg > 0).toBe(true);
    expect(
      within(table).getByRole('cell', { name: formatCo2Estimate(top?.kg ?? 0) }),
    ).toBeInTheDocument();
  });

  it('invites a first log instead of showing a page of zeros, and still shows the planet', async () => {
    // Planted this morning, nothing logged yet.
    seed('day1', (state) => {
      state.logs = [];
      state.days = {};
    });
    render(<ImpactPage />);

    expect(screen.getByText(/Log one action and this page wakes up/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log an action' })).toHaveAttribute('href', '/log');
    expect(screen.queryByRole('group', { name: 'Totals so far' })).not.toBeInTheDocument();
    expect(await screen.findByText('Global temperature')).toBeInTheDocument();
  });

  it('carries a strip of the planet’s readings that opens the other half', async () => {
    seed('day200');
    render(<ImpactPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'See the planet' }));
    expect(nav.hrefs).toEqual(['/impact?view=planet']);
    expect(await headline()).toBeInTheDocument();
  });
});

describe('the planet right now', () => {
  it('asks only our own server, and marks freshly fetched readings live', async () => {
    seed('day200');
    openPlanet();
    render(<ImpactPage />);

    const card = await headline();
    const { temperature, co2, perPerson } = CLIMATE_SNAPSHOT;
    expect(within(card).getByText('Global temperature')).toBeInTheDocument();
    expect(within(card).getByText(`+${temperature.latest.value}`)).toBeInTheDocument();
    expect(
      within(card).getByText(co2.latest.trend.toFixed(1).replace(/\.0$/, '')),
    ).toBeInTheDocument();
    expect(within(card).getByText(perPerson.world.value.toFixed(1))).toBeInTheDocument();
    expect(within(card).getAllByText('Live')).toHaveLength(3);
    expect(within(card).queryByText(/Snapshot from/)).not.toBeInTheDocument();
    // Every figure names its publisher and links to it.
    expect(
      within(card).getByRole('link', { name: /NASA Goddard Institute for Space Studies/ }),
    ).toHaveAttribute('href', temperature.source.url);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(CLIMATE_ENDPOINT);
  });

  it('never says Live for readings that were fetched days ago', async () => {
    fetchMock.mockImplementation(() => respond(answer(72)));
    seed('day200');
    openPlanet();
    render(<ImpactPage />);

    const card = await headline();
    expect(within(card).queryByText('Live')).not.toBeInTheDocument();
    expect(within(card).getAllByText('Snapshot from 3 Oct 2026')).toHaveLength(3);
  });

  it('marks only the reading whose source was down as a snapshot', async () => {
    const mixed = answer();
    mixed.perPerson.status = 'snapshot';
    fetchMock.mockImplementation(() => respond(mixed));
    seed('day200');
    openPlanet();
    render(<ImpactPage />);

    const card = await headline();
    expect(within(card).getAllByText('Live')).toHaveLength(2);
    expect(within(card).getAllByText(/^Snapshot from/)).toHaveLength(1);
  });

  it('falls back to the readings saved with the app, says so, and recovers on retry', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    seed('day200');
    openPlanet();
    render(<ImpactPage />);

    const card = await headline();
    expect(within(card).getByRole('status')).toHaveTextContent(
      'The live feed could not be reached, so these are the readings saved with the app.',
    );
    expect(within(card).queryByText('Live')).not.toBeInTheDocument();
    expect(within(card).getAllByText(/^Snapshot from/)).toHaveLength(3);
    expect(
      within(card).getByText(`+${CLIMATE_SNAPSHOT.temperature.latest.value}`),
    ).toBeInTheDocument();

    fetchMock.mockImplementation(() => respond(answer()));
    await userEvent.click(within(card).getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByText('Live')).not.toHaveLength(0);
    expect(screen.queryByText(/could not be reached/)).not.toBeInTheDocument();
  });

  it('treats a server error or a mangled answer like an outage', async () => {
    fetchMock.mockImplementationOnce(() => respond({ error: 'boom' }, 500));
    seed('day200');
    openPlanet();
    const first = render(<ImpactPage />);
    expect(within(await headline()).getAllByText(/^Snapshot from/)).toHaveLength(3);
    first.unmount();

    resetClimateMemory();
    fetchMock.mockImplementationOnce(() => respond({ version: 1, temperature: { latest: 99 } }));
    render(<ImpactPage />);
    expect(within(await headline()).getAllByText(/^Snapshot from/)).toHaveLength(3);
  });

  it('puts the user’s country next to the world, with every place one tap away', async () => {
    seed('day200', (state) => {
      state.profile.region = 'IN';
    });
    openPlanet();
    render(<ImpactPage />);

    const card = await headline();
    expect(within(card).getByText('CO2 per person, India')).toBeInTheDocument();
    expect(within(card).getByText(/below the world average/)).toBeInTheDocument();

    const section = screen.getByRole('region', { name: 'Per person' });
    expect(
      within(section).getByRole('heading', { name: 'India and the world' }),
    ).toBeInTheDocument();
    // The user's own bar is their starting line, and the page says it is not like for like.
    expect(within(section).getByText(/not as a like-for-like comparison/)).toBeInTheDocument();
    await userEvent.click(within(section).getByRole('button', { name: 'All places' }));
    const table = within(section).getByRole('table');
    expect(within(table).getByRole('cell', { name: 'India' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'World' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(40);
  });

  it('invites the quiz instead of drawing a bar for someone without a starting line', async () => {
    seed('day200', (state) => {
      state.baseline = { current: null, history: [] };
    });
    openPlanet();
    render(<ImpactPage />);

    const section = await screen.findByRole('region', { name: 'Per person' });
    expect(
      within(section).getByRole('link', { name: 'Take the starting-line quiz' }),
    ).toHaveAttribute('href', '/me#starting-line');
    expect(within(section).queryByText(/Your bar is your starting line/)).not.toBeInTheDocument();
  });

  it('keeps the slower bundled charts behind one button, labelled as saved with the app', async () => {
    seed('day200');
    openPlanet();
    render(<ImpactPage />);

    await headline();
    expect(screen.queryByRole('heading', { name: 'Solar got cheap' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /Show the charts/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('heading', { name: 'Solar got cheap' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('SAVED WITH THE APP').length).toBeGreaterThan(3);
    expect(screen.getByRole('button', { name: 'Hide the charts' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('switches halves from the tabs and keeps the choice in the address', async () => {
    seed('day200');
    render(<ImpactPage />);

    await userEvent.click(screen.getByRole('radio', { name: 'The planet now' }));
    expect(nav.hrefs).toEqual(['/impact?view=planet']);
    expect(await headline()).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Your impact' }));
    expect(nav.hrefs.at(-1)).toBe('/impact');
    expect(screen.getByRole('group', { name: 'Totals so far' })).toBeInTheDocument();
    // One fetch served both halves.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
