import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionEstimate, AiClient, ClientAiStatus } from '@/ai';
import { AiError } from '@/ai';
import { STORAGE_KEYS, game, gameActions, getGameState, selectTodaySummary } from '@/game';
import { localTime } from '@/game/testkit';
import { Toaster } from '@/ui';
import type * as World from '@/world';
import { LogScreen } from './LogPage';

let search = '';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/log',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// The stage draws the tree; the page's logic does not need it.
vi.mock('@/world', async (original) => ({
  ...(await original<typeof World>()),
  WorldStage: () => null,
}));

const DAY = '2026-10-06';
let now = localTime(DAY, 12);

type TestClient = Pick<AiClient, 'getAiStatus' | 'estimateAction'>;

const READY: ClientAiStatus = {
  configured: true,
  provider: 'test',
  model: 'test',
  reason: 'ready',
};
const NOT_CONFIGURED: ClientAiStatus = {
  configured: false,
  provider: null,
  model: null,
  reason: 'not_configured',
};

const AI_ESTIMATE: ActionEstimate = {
  isClimateAction: true,
  matchedActionId: null,
  variant: null,
  title: 'Taught a darning class',
  emoji: '🧶',
  category: 'stuff',
  effort: 3,
  qty: 1,
  unit: 'time',
  co2eKg: 0.4,
  confidence: 'low',
  rationale: 'A few garments kept in use a little longer.',
};

function client(
  status: ClientAiStatus,
  estimate: () => Promise<ActionEstimate> = () => Promise.resolve(AI_ESTIMATE),
): TestClient & { estimateAction: ReturnType<typeof vi.fn> } {
  return {
    getAiStatus: vi.fn(() => Promise.resolve(status)),
    estimateAction: vi.fn(estimate),
  };
}

function setup(aiClient?: TestClient) {
  const user = userEvent.setup();
  const view = render(
    <>
      <LogScreen aiClient={aiClient} />
      <Toaster />
    </>,
  );
  return { user, ...view };
}

/** Moves the game clock; identical logs within two seconds count as a double tap. */
function wait(ms: number): void {
  now += ms;
  gameActions.tick(now);
}

function seed(actionId: string, qty?: number): void {
  wait(5000);
  const result = gameActions.logAction({ actionId, qty });
  if (!result.ok) throw new Error(`${actionId}: ${result.message}`);
}

const today = () => selectTodaySummary(getGameState(), now);
const grid = () => screen.getByRole('list', { name: 'Actions' });
const tile = (name: string) => within(grid()).getByRole('button', { name });
const chip = (name: string) =>
  within(screen.getByRole('group', { name: 'Filter by kind' })).getByRole('button', { name });
const sheet = () => screen.getByRole('dialog');
const logButton = () => within(sheet()).getByRole('button', { name: 'Log it' });
const logged = () => screen.getByRole('list', { name: 'Actions logged today' });
const treePop = () => document.querySelector('[data-tree-pop]');

async function openLogged(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Logged today/ }));
}

// The whole page renders in jsdom with its dialogs: generous, but still a real bound.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  search = '';
  now = localTime(DAY, 12);
  game.setClock(() => now);
  gameActions.resetAll();
  const planted = gameActions.onboard({ name: 'Maya', treeName: 'Fern', species: 'oak' });
  if (!planted.ok) throw new Error(planted.reason);
});

afterEach(() => {
  game.setClock(() => Date.now());
});

describe('browsing', () => {
  it('shows a first handful, then every action, with “Something else” always last', async () => {
    const { user } = setup();
    expect(screen.getByRole('heading', { level: 1, name: 'What did you do?' })).toBeInTheDocument();
    for (const name of ['Move', 'Eat', 'Power', 'Water', 'Stuff', 'Waste', 'Nature']) {
      expect(chip(name)).toHaveAttribute('aria-pressed', 'false');
    }
    const first = within(grid()).getAllByRole('button');
    expect(first).toHaveLength(12);
    expect(first.at(-1)).toHaveAccessibleName('Something else');

    // 51 actions on 46 stickers: recycling, second-hand and the flight swap are one tile each.
    await user.click(screen.getByRole('button', { name: 'Show all 46 actions' }));
    const all = within(grid()).getAllByRole('button');
    expect(all).toHaveLength(47);
    expect(all.at(-1)).toHaveAccessibleName('Something else');
    await user.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(within(grid()).getAllByRole('button')).toHaveLength(12);
  });

  it('filters by one kind, and shows everything again when the chip is pressed twice', async () => {
    const { user } = setup();
    await user.click(chip('Move'));
    expect(chip('Move')).toHaveAttribute('aria-pressed', 'true');
    expect(within(grid()).getAllByRole('button')).toHaveLength(10);
    expect(tile('Bus')).toBeInTheDocument();
    expect(within(grid()).queryByRole('button', { name: 'Plant-based meal' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Show all/ })).toBeNull();

    await user.click(chip('Move'));
    expect(chip('Move')).toHaveAttribute('aria-pressed', 'false');
    expect(within(grid()).getAllByRole('button')).toHaveLength(12);
  });

  it('finds an action by a synonym, and offers “Something else” when nothing matches', async () => {
    const { user } = setup();
    const field = screen.getByRole('searchbox', { name: 'Search actions' });
    await user.type(field, 'subway');
    expect(tile('Train or metro')).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'unicycle hockey');
    expect(
      screen.getByText('Nothing matches “unicycle hockey”. You can still log it.'),
    ).toBeInTheDocument();
    expect(within(grid()).getAllByRole('button')).toHaveLength(1);
    await user.click(tile('Something else'));
    expect(await screen.findByLabelText('What did you do?')).toHaveValue('unicycle hockey');
  });

  it('keeps the field and the chips from disagreeing', async () => {
    const { user } = setup();
    const field = screen.getByRole('searchbox', { name: 'Search actions' });
    await user.click(chip('Eat'));
    await user.type(field, 'bus');
    expect(chip('Eat')).toHaveAttribute('aria-pressed', 'false');
    expect(tile('Bus')).toBeInTheDocument();

    await user.click(chip('Eat'));
    expect(field).toHaveValue('');
    expect(tile('Plant-based meal')).toBeInTheDocument();
  });
});

describe('logging from the grid', () => {
  it('takes two taps, pops the tree and lists the log under “Logged today”', async () => {
    const { user } = setup();
    expect(screen.getByText('Nothing logged yet today.')).toBeInTheDocument();
    expect(treePop()).toBeNull();

    await user.click(tile('Bus'));
    expect(sheet()).toHaveAccessibleName('Bus');
    expect(sheet()).toHaveTextContent('Took the bus instead of driving');
    const preview = within(sheet()).getByTestId('log-preview');
    expect(preview).toHaveTextContent('approximately');
    expect(preview).toHaveTextContent(
      'Compared with driving it alone, minus the bus’s own emissions.',
    );
    expect(preview).toHaveTextContent('+12 XP');
    expect(
      within(sheet()).getByRole('button', { name: 'About this estimate' }),
    ).toBeInTheDocument();
    await user.click(logButton());

    const logs = today().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actionId: 'bus-instead-of-car', qty: 5, source: 'log' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(treePop()).not.toBeNull();

    // Closed until asked for.
    expect(screen.queryByRole('list', { name: 'Actions logged today' })).toBeNull();
    await openLogged(user);
    const row = within(logged()).getByRole('listitem');
    expect(row).toHaveTextContent('Bus');
    expect(row).toHaveTextContent('5 km');
    expect(row).toHaveTextContent('approximately');
    expect(within(row).getByRole('button', { name: 'Undo Bus' })).toBeInTheDocument();
  });

  it('logs the preset that was picked', async () => {
    const { user } = setup();
    await user.click(tile('Bus'));
    await user.click(within(sheet()).getByRole('radio', { name: '10 km' }));
    expect(within(sheet()).getByLabelText('How much?')).toHaveValue('10');
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({ qty: 10 });
  });

  it('steps the amount up and down', async () => {
    const { user } = setup();
    await user.click(tile('Bus'));
    const amount = within(sheet()).getByLabelText('How much?');
    expect(amount).toHaveValue('5');
    await user.click(within(sheet()).getByRole('button', { name: 'More' }));
    await user.click(within(sheet()).getByRole('button', { name: 'More' }));
    await user.click(within(sheet()).getByRole('button', { name: 'Less' }));
    expect(amount).toHaveValue('6');
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({ qty: 6 });
  });

  it('refuses more than a day can hold, before saving', async () => {
    const { user } = setup();
    await user.click(tile('Bus'));
    const amount = within(sheet()).getByLabelText('How much?');
    await user.clear(amount);
    await user.type(amount, '999');
    expect(within(sheet()).getByRole('alert')).toHaveTextContent(
      'That is more than a day can hold.',
    );
    await user.click(logButton());
    expect(today().logs).toHaveLength(0);
    expect(treePop()).toBeNull();

    await user.clear(amount);
    await user.type(amount, '7.5');
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({ qty: 7.5 });
  });

  it('never shows a number for an action that is not estimated', async () => {
    const { user } = setup();
    await user.click(chip('Move'));
    await user.click(tile('Car-free day'));
    const preview = within(sheet()).getByTestId('log-preview');
    expect(preview).toHaveTextContent('Impact not estimated. You still earn XP.');
    expect(preview).not.toHaveTextContent('approximately');
    expect(within(sheet()).queryByRole('button', { name: 'About this estimate' })).toBeNull();
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({ actionId: 'car-free-day', co2eKg: null, xp: 10 });
    await openLogged(user);
    expect(within(logged()).getByRole('listitem')).toHaveTextContent('Not estimated');
  });
});

describe('caps and overlap groups', () => {
  it('keeps a maxed tile plain in the grid and says so in the sheet', async () => {
    seed('bus-instead-of-car', 2);
    seed('bus-instead-of-car', 3);
    const { user } = setup();
    await user.click(chip('Move'));
    const bus = tile('Bus');
    expect(bus).toHaveTextContent(/^Bus$/);
    // Spent tiles sink to the end of their kind.
    expect(within(grid()).getAllByRole('button').at(-2)).toBe(bus);

    await user.click(bus);
    const preview = within(sheet()).getByTestId('log-preview');
    expect(preview).toHaveTextContent('Maxed for today. This adds kilograms, not XP.');
    expect(preview).toHaveTextContent('No XP');
    wait(5000);
    await user.click(logButton());
    const newest = today().logs[0];
    expect(newest).toMatchObject({ actionId: 'bus-instead-of-car', xp: 0, rewardedActs: 0 });
    expect(newest?.co2eKg).toBeGreaterThan(0);
  });

  it('will not log a tile whose hard daily cap is used up', async () => {
    seed('thermostat-down-1c');
    const { user } = setup();
    await user.click(chip('Power'));
    await user.click(tile('Heating down'));
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Maxed for today');
    expect(logButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(logButton());
    expect(today().logs).toHaveLength(1);
  });

  it('covers the meal tiles once a diet day is logged', async () => {
    seed('vegetarian-day');
    const { user } = setup();
    await user.click(chip('Eat'));
    await user.click(tile('Plant-based meal'));
    expect(within(sheet()).getByRole('status')).toHaveTextContent(
      'Covered by your vegetarian day.',
    );
    expect(logButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the group hint and the rough-estimate range where they apply', async () => {
    const { user } = setup();
    await user.click(chip('Eat'));
    await user.click(tile('Plant-based meal'));
    expect(within(sheet()).getByText('One tile per meal — pick the best fit.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(chip('Stuff'));
    await user.click(tile('Borrowed it'));
    expect(
      within(sheet()).getByText(/^Rough estimate: likely between .+ and .+\.$/),
    ).toBeInTheDocument();
  });

  it('writes one log per material from the recycling tile', async () => {
    const { user } = setup();
    await user.click(chip('Waste'));
    await user.click(tile('Sorted recycling'));
    expect(logButton()).toHaveAttribute('aria-disabled', 'true');
    const more = (material: string) =>
      within(sheet()).getByRole('button', { name: `More: ${material}` });
    await user.click(more('Aluminium cans'));
    await user.click(more('Aluminium cans'));
    await user.click(more('Glass bottles or jars'));
    expect(within(sheet()).getByTestId('log-preview')).toHaveTextContent('+20 XP');
    await user.click(logButton());
    const logs = today().logs;
    expect(logs.map((log) => [log.actionId, log.qty]).sort()).toEqual([
      ['recycle-aluminium-can', 2],
      ['recycle-glass-bottle', 1],
    ]);
    await openLogged(user);
    expect(within(logged()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('lets the second-hand tile choose which garment it was', async () => {
    const { user } = setup();
    await user.click(chip('Stuff'));
    await user.click(tile('Second-hand'));
    await user.click(within(sheet()).getByRole('radio', { name: 'Jeans or heavier' }));
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({ actionId: 'second-hand-jeans', qty: 1 });
  });

  it('logs the flight swap by trip when the distance is unknown', async () => {
    const { user } = setup();
    await user.click(chip('Move'));
    await user.click(tile('Train, not plane'));
    await user.click(within(sheet()).getByRole('switch', { name: 'I do not know the distance' }));
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({
      actionId: 'train-instead-of-short-flight-trip',
      qty: 1,
    });
  });
});

describe('undo', () => {
  it('restores the exact previous state when a fresh log is undone', async () => {
    // An earlier log has already earned what stays earned (the first badge, the check-in).
    seed('walk-cycle-instead-of-car', 2);
    wait(60_000);
    // Everything the engine persists, except its record of when it last ran.
    const snapshot = () => JSON.stringify({ ...getGameState(), clock: null });
    const before = snapshot();
    const { user } = setup();
    await user.click(tile('Bus'));
    await user.click(logButton());
    expect(snapshot()).not.toBe(before);
    await openLogged(user);
    expect(within(logged()).getAllByRole('listitem')).toHaveLength(2);

    await user.click(within(logged()).getByRole('button', { name: 'Undo Bus' }));
    expect(snapshot()).toBe(before);
    expect(within(logged()).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Logged today (1)' })).toBeInTheDocument();
  });

  it('asks first once the undo window has passed', async () => {
    seed('bus-instead-of-car', 5);
    wait(9000);
    const { user } = setup();
    await openLogged(user);
    await user.click(within(logged()).getByRole('button', { name: 'Undo Bus' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove this log?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(today().logs).toHaveLength(1);

    await user.click(within(logged()).getByRole('button', { name: 'Undo Bus' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Remove this log?' })).getByRole('button', {
        name: 'Remove it',
      }),
    );
    expect(today().logs).toHaveLength(0);
    expect(screen.getByText('Nothing logged yet today.')).toBeInTheDocument();
  });

  it('marks an AI estimate apart from sourced ones in the list', async () => {
    seed('bus-instead-of-car', 10);
    wait(5000);
    gameActions.logCustom({ title: 'Mended a tent', category: 'stuff', effort: 2, co2eKg: 0.4 });
    const { user } = setup();
    await openLogged(user);
    const rows = within(logged()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const custom = rows.find((row) => row.textContent?.includes('Mended a tent'));
    if (!custom) throw new Error('the custom log is listed');
    expect(custom).toHaveTextContent('approximately 400 g');
    expect(within(custom).getByText('400 g')).toHaveClass('decoration-dotted');
    expect(screen.getByRole('link', { name: 'See your impact' })).toHaveAttribute(
      'href',
      '/impact',
    );
  });
});

describe('hiding an action', () => {
  it('hides a tile from the sheet and brings it back', async () => {
    const { user } = setup();
    await user.click(chip('Move'));
    await user.click(tile('Drove electric'));
    await user.click(within(sheet()).getByRole('button', { name: 'Hide this action' }));

    expect(getGameState().settings.hiddenActions).toContain('ev-instead-of-petrol-car');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(grid()).queryByRole('button', { name: 'Drove electric' })).toBeNull();
    expect(await screen.findByText('“Drove electric” is hidden.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1 hidden action' }));
    const dialog = screen.getByRole('dialog', { name: 'Hidden actions' });
    await user.click(within(dialog).getByRole('button', { name: 'Show again: Drove electric' }));
    expect(getGameState().settings.hiddenActions).not.toContain('ev-instead-of-petrol-car');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(tile('Drove electric')).toBeInTheDocument();
  });

  it('says so when a whole kind is hidden', async () => {
    for (const id of [
      'thermostat-down-1c',
      'line-dry-instead-of-tumble',
      'standby-off',
      'led-bulb-swap',
      'ac-up-1c',
    ]) {
      gameActions.hideAction(id);
    }
    const { user } = setup();
    await user.click(chip('Power'));
    expect(screen.getByText('You have hidden every action of this kind.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 hidden actions' })).toBeInTheDocument();
  });
});

describe('links into the page', () => {
  it('opens a prefilled sheet from ?a=…&q=… without logging anything', async () => {
    search = 'a=bus-instead-of-car&q=12&src=coach';
    const { user } = setup();
    const dialog = await screen.findByRole('dialog', { name: 'Bus' });
    expect(within(dialog).getByLabelText('How much?')).toHaveValue('12');
    expect(today().logs).toHaveLength(0);
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({ qty: 12, source: 'coach' });
  });

  it('opens the member a link names inside a merged tile', async () => {
    search = 'a=second-hand-jeans';
    setup();
    const dialog = await screen.findByRole('dialog', { name: 'Second-hand' });
    expect(within(dialog).getByRole('radio', { name: 'Jeans or heavier' })).toBeChecked();
  });

  it('falls back to the grid with a toast for an unknown id', async () => {
    search = 'a=bike-instead-of-car';
    setup();
    expect(await screen.findByText('That action is not in the list any more.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(grid()).getAllByRole('button')).toHaveLength(12);
  });

  it('opens the custom flow from ?custom=1', async () => {
    search = 'custom=1';
    setup();
    expect(await screen.findByRole('dialog', { name: 'Something else' })).toBeInTheDocument();
  });
});

describe('something else', () => {
  async function describeIt(user: ReturnType<typeof userEvent.setup>, text: string) {
    await user.click(tile('Something else'));
    // Pasted rather than typed: the flow under test starts at "Continue".
    await user.click(await screen.findByLabelText('What did you do?'));
    await user.paste(text);
    await user.click(within(sheet()).getByRole('button', { name: 'Continue' }));
  }

  it('asks for at least three characters', async () => {
    const { user } = setup(client(READY));
    await describeIt(user, 'ab');
    expect(within(sheet()).getByRole('alert')).toHaveTextContent('Use at least three characters.');
  });

  it('uses the AI estimate when one is set up, labelled and editable', async () => {
    const ai = client(READY);
    const { user } = setup(ai);
    await describeIt(user, 'Taught a darning class');

    const preview = await within(sheet()).findByTestId('custom-preview');
    expect(ai.estimateAction).toHaveBeenCalledTimes(1);
    expect(ai.estimateAction.mock.calls[0]?.[0]).toBe('Taught a darning class');
    expect(preview).toHaveTextContent('approximately 400 g');
    expect(preview).toHaveTextContent('AI estimate, low confidence');
    expect(preview).toHaveTextContent('+12 XP');
    expect(within(sheet()).getByText('Estimated by AI. Change anything.')).toBeInTheDocument();

    // Always editable: a smaller effort changes the XP, and the kind can be changed.
    await user.click(within(sheet()).getByRole('radio', { name: 'Tiny' }));
    expect(preview).toHaveTextContent('+8 XP');
    await user.click(within(sheet()).getByRole('button', { name: 'Nature' }));
    await user.click(within(sheet()).getByRole('checkbox', { name: /Save for next time/ }));
    await user.click(logButton());

    expect(today().logs[0]).toMatchObject({
      actionId: 'custom',
      title: 'Taught a darning class',
      category: 'nature',
      effort: 1,
      estimate: 'ai',
      co2eKg: 0.4,
      kind: 'unrated',
      xp: 8,
    });
    expect(today().aiKg).toBeCloseTo(0.4);
    expect(today().kg).toBe(0);
    expect(getGameState().customActions).toHaveLength(1);
    expect(treePop()).not.toBeNull();
  });

  it('logs a saved action again in one tap, and can remove it', async () => {
    gameActions.logCustom({
      title: 'Mended a tent',
      category: 'stuff',
      effort: 2,
      co2eKg: null,
      save: true,
    });
    wait(5000);
    const { user } = setup(client(NOT_CONFIGURED));
    await user.click(tile('Something else'));
    const saved = await screen.findByRole('region', { name: 'Saved actions' });
    await user.click(within(saved).getByRole('button', { name: 'Log “Mended a tent”' }));
    expect(today().logs).toHaveLength(2);
    expect(today().logs[0]).toMatchObject({ actionId: 'custom', title: 'Mended a tent' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(tile('Something else'));
    await user.click(await screen.findByRole('button', { name: 'Remove “Mended a tent”' }));
    expect(getGameState().customActions).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Saved actions' })).toBeNull();
  });

  it('lets the number be dropped before saving', async () => {
    const { user } = setup(client(READY));
    await describeIt(user, 'Taught a darning class');
    await within(sheet()).findByTestId('custom-preview');
    await user.click(within(sheet()).getByRole('button', { name: 'Log without a number' }));
    expect(within(sheet()).getByTestId('custom-preview')).toHaveTextContent(
      'Impact not estimated. You still earn XP.',
    );
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({ estimate: 'none', co2eKg: null });
  });

  it('without an AI offers a labelled built-in guess and never a number', async () => {
    const ai = client(NOT_CONFIGURED);
    const { user } = setup(ai);
    await describeIt(user, 'Taught a workshop about beeswax wraps');
    const preview = await within(sheet()).findByTestId('custom-preview');
    expect(ai.estimateAction).not.toHaveBeenCalled();
    expect(preview).toHaveTextContent('Impact not estimated. You still earn XP.');
    expect(preview).not.toHaveTextContent('approximately');
    expect(
      within(sheet()).getByText('No AI coach is set up, so there is no kilogram figure.'),
    ).toBeInTheDocument();
    await user.click(logButton());
    expect(today().logs[0]).toMatchObject({ actionId: 'custom', estimate: 'none', co2eKg: null });
  });

  it('falls back to picking by hand, said plainly, when the estimate fails', async () => {
    const ai = client(READY, () => Promise.reject(new AiError('timeout', 'too slow')));
    const { user } = setup(ai);
    await describeIt(user, 'Taught a workshop about beeswax wraps');
    expect(
      await within(sheet()).findByText('The estimate did not arrive. Pick a kind and an effort.'),
    ).toBeInTheDocument();
    expect(within(sheet()).getByRole('radio', { name: 'Small' })).toBeChecked();
    expect(within(sheet()).getByRole('button', { name: 'Stuff' })).toBeInTheDocument();
  });

  it('offline never calls the server and says why there is no estimate', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const ai = client(READY);
    const { user } = setup(ai);
    await describeIt(user, 'Taught a workshop about beeswax wraps');
    expect(
      await within(sheet()).findByText(
        'You are offline, so there is no AI estimate. Pick a kind and an effort.',
      ),
    ).toBeInTheDocument();
    expect(ai.getAiStatus).not.toHaveBeenCalled();
    expect(ai.estimateAction).not.toHaveBeenCalled();
  });

  it('hands a description the list knows to that action’s own sheet', async () => {
    const ai = client(READY);
    const { user } = setup(ai);
    await describeIt(user, 'Fixed the toaster');
    expect(within(sheet()).getByText('Is it one of these?')).toBeInTheDocument();
    expect(ai.estimateAction).not.toHaveBeenCalled();
    await user.click(
      within(sheet()).getByRole('button', { name: /Repaired instead of replacing/ }),
    );
    expect(await screen.findByRole('dialog', { name: 'Repaired it' })).toBeInTheDocument();
  });

  it('respects “No, something else” and does not let a declined match carry a number', async () => {
    const ai = client(READY, () =>
      Promise.resolve({ ...AI_ESTIMATE, matchedActionId: 'repair-instead-of-replace' }),
    );
    const { user } = setup(ai);
    await describeIt(user, 'Fixed the toaster');
    await user.click(within(sheet()).getByRole('button', { name: 'No, something else' }));
    const preview = await within(sheet()).findByTestId('custom-preview');
    expect(preview).toHaveTextContent('Impact not estimated. You still earn XP.');
  });

  it('says when two custom actions have already earned XP today', async () => {
    for (const title of ['Mended a tent', 'Shared a lawnmower']) {
      wait(5000);
      gameActions.logCustom({ title, category: 'stuff', effort: 2 });
    }
    const { user } = setup(client(NOT_CONFIGURED));
    await describeIt(user, 'Taught a workshop about beeswax wraps');
    const preview = await within(sheet()).findByTestId('custom-preview');
    expect(preview).toHaveTextContent('Two custom actions earned XP today. This one adds none.');
    expect(preview).toHaveTextContent('No XP');
  });
});

describe('seeded from a saved-state fixture', () => {
  it('renders a twelve-day history and logs on top of it', async () => {
    const fixture = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'scripts/fixtures/day12.json'), 'utf8'),
    ) as Record<string, unknown>;
    const saved = fixture[STORAGE_KEYS.game];
    localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(saved));
    game.rehydrate();
    const state = getGameState();
    expect(state.profile.treeName).not.toBe('');
    // The fixture is anchored to the day it was built on: stand on its last day.
    const last = state.logs.at(-1);
    if (!last) throw new Error('the fixture has logs');
    now = last.ts + 60_000;
    gameActions.tick(now);

    const { user } = setup();
    const before = today().logs.length;
    expect(screen.getByRole('button', { name: `Logged today (${before})` })).toBeInTheDocument();
    await user.click(chip('Nature'));
    await user.click(tile('Litter pick'));
    await user.click(logButton());
    expect(today().logs).toHaveLength(before + 1);
    await openLogged(user);
    expect(within(logged()).getAllByRole('listitem')).toHaveLength(before + 1);
  });
});
