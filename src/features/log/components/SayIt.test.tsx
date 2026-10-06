import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiClient, ClientAiStatus } from '@/ai';
import { game, gameActions, getGameState } from '@/game';
import { localTime } from '@/game/testkit';
import { Toaster } from '@/ui';
import { COPY } from '../copy';
import { LogScreen } from '../LogPage';

// The whole Log page with the real store; a busy machine needs more than five seconds.
vi.setConfig({ testTimeout: 30_000 });

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/log',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/world', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  WorldStage: () => null,
}));

const NOT_CONFIGURED: ClientAiStatus = {
  configured: false,
  provider: null,
  model: null,
  reason: 'not_configured',
};

/** No live AI: the path a judge without a key sees. */
const builtIn = (): Pick<AiClient, 'getAiStatus' | 'estimateAction'> => ({
  getAiStatus: vi.fn(() => Promise.resolve(NOT_CONFIGURED)),
  estimateAction: vi.fn(() => Promise.reject(new Error('never asked'))),
});

const SENTENCE = 'I cycled to work and skipped meat today';
const now = localTime('2026-10-06', 12);

function setup() {
  const user = userEvent.setup();
  render(
    <>
      <LogScreen aiClient={builtIn()} />
      <Toaster />
    </>,
  );
  return user;
}

const sheet = () => within(screen.getByRole('dialog'));
const logged = () => getGameState().logs.map((log) => log.actionId);

async function say(user: ReturnType<typeof userEvent.setup>, sentence: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(COPY.sayIt.entry) }));
  await user.type(sheet().getByLabelText(COPY.sayIt.label), `${sentence}{Enter}`);
  await sheet().findByRole('heading', { name: /sounds like|matches that yet/ });
}

beforeEach(() => {
  game.setClock(() => now);
  gameActions.resetAll();
  const planted = gameActions.onboard({ name: 'Maya', treeName: 'Fern', species: 'oak' });
  if (!planted.ok) throw new Error(planted.reason);
});

afterEach(() => {
  game.setClock(() => Date.now());
});

describe('say it in your own words', () => {
  it('is one entry on the page that opens a sheet with a field and examples', async () => {
    const user = setup();
    const entry = screen.getByRole('button', { name: new RegExp(COPY.sayIt.entry) });
    expect(entry).toHaveTextContent(COPY.sayIt.example);
    await user.click(entry);
    expect(sheet().getByLabelText(COPY.sayIt.label)).toHaveFocus();
    for (const example of COPY.sayIt.examples) {
      expect(sheet().getByRole('button', { name: COPY.sayIt.said(example) })).toBeInTheDocument();
    }
  });

  it('proposes actions with honest estimates and logs nothing until they are stuck on', async () => {
    const user = setup();
    await say(user, SENTENCE);

    const rows = sheet().getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const [ride, meat] = rows.map((row) => within(row));
    if (!ride || !meat) throw new Error('two proposals expected');
    expect(
      ride.getByRole('checkbox', { name: /Walked or cycled instead of driving/ }),
    ).toBeChecked();
    expect(ride.getByText(/“I cycled to work”/)).toHaveTextContent(COPY.sayIt.byList);
    expect(meat.getByRole('checkbox', { name: /Vegetarian day/ })).toBeChecked();
    // Every figure is an estimate, marked as one, with its source behind the mark.
    for (const row of [ride, meat]) {
      expect(row.getByText(/approximately/)).toBeInTheDocument();
      expect(row.getByText(/avoided/)).toBeInTheDocument();
      expect(row.getByText(/\+\d+ XP/)).toBeInTheDocument();
    }
    expect(sheet().getByText(COPY.sayIt.total)).toBeInTheDocument();
    expect(logged()).toEqual([]);

    await user.click(sheet().getByRole('button', { name: COPY.sayIt.stick(2) }));
    await waitFor(() => expect(logged()).toEqual(['walk-cycle-instead-of-car', 'vegetarian-day']));
    const [first, second] = getGameState().logs;
    expect(first).toMatchObject({ source: 'log', estimate: 'factor' });
    expect(second?.co2eKg).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sticks on only what stays ticked, with the amount that was set', async () => {
    const user = setup();
    await say(user, SENTENCE);
    await user.click(sheet().getByRole('checkbox', { name: /Vegetarian day/ }));
    await user.click(
      sheet().getByRole('button', {
        name: COPY.sayIt.more('Walked or cycled instead of driving'),
      }),
    );
    await user.click(sheet().getByRole('button', { name: COPY.sayIt.stick(1) }));
    await waitFor(() => expect(logged()).toEqual(['walk-cycle-instead-of-car']));
    expect(getGameState().logs[0]?.qty).toBe(3);
  });

  it('gives the engine’s reason when a match cannot be logged today', async () => {
    gameActions.logAction({ actionId: 'plant-based-meal', qty: 1 });
    const user = setup();
    await say(user, 'skipped meat today');
    const box = sheet().getByRole('checkbox', { name: /Vegetarian day/ });
    expect(box).not.toBeChecked();
    expect(box).toBeDisabled();
    expect(sheet().getByText(/a day tile would count them twice/)).toBeInTheDocument();
    expect(sheet().getByRole('button', { name: COPY.sayIt.stick(1) })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('hands what the sheet does not know to the custom-action flow', async () => {
    const user = setup();
    await say(user, 'taught a darning class');
    expect(sheet().getByRole('heading', { name: COPY.sayIt.nothing })).toBeInTheDocument();
    await user.click(sheet().getByRole('button', { name: COPY.sayIt.custom }));
    await waitFor(() =>
      expect(sheet().getByLabelText('What did you do?')).toHaveValue('taught a darning class'),
    );
    expect(logged()).toEqual([]);
  });

  it('does not tick a nearest match for the person', async () => {
    const user = setup();
    await say(user, 'had a vegetarian lunch');
    expect(sheet().getByRole('checkbox', { name: /Vegetarian day/ })).not.toBeChecked();
    expect(sheet().getByText(new RegExp(COPY.sayIt.closest))).toBeInTheDocument();
  });
});
