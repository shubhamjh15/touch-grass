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
import { LogScreen } from './LogPage';

let search = '';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/log',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// The stage is a transparent box the 3D world draws into; the page's logic does not need it.
vi.mock('@/world', async (original) => ({
  ...(await original<typeof import('@/world')>()),
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

/** The whole saved state, minus the clock's bookkeeping of when the last event happened. */
const snapshot = () =>
  JSON.stringify({ ...getGameState(), clock: { ...getGameState().clock, lastEventTs: 0 } });
const today = () => selectTodaySummary(getGameState(), now);
const tile = (name: RegExp) => screen.getByRole('button', { name });
const sheet = () => screen.getByRole('dialog');
const stickButton = () => within(sheet()).getByRole('button', { name: 'Stick it on' });
const ledger = () => screen.getByRole('list', { name: 'Actions logged today' });

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
  it('shows every action under For you and one kind per tab', async () => {
    const { user } = setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Log' })).toBeInTheDocument();
    expect(screen.getByText(/51 actions · 7 kinds/i)).toBeInTheDocument();
    for (const name of ['For you', 'Move', 'Eat', 'Power', 'Water', 'Stuff', 'Waste', 'Nature']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    // 51 actions on 46 stickers: recycling, second-hand and the flight swap are one tile each.
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(46);

    await user.click(screen.getByRole('tab', { name: 'Move' }));
    const move = within(screen.getByRole('tabpanel'));
    expect(move.getAllByRole('listitem')).toHaveLength(9);
    expect(move.getByRole('button', { name: /^Bus:/ })).toBeInTheDocument();
    expect(move.queryByRole('button', { name: /^Plant-based meal:/ })).not.toBeInTheDocument();
  });

  it('finds an action by a synonym and offers a custom action when nothing matches', async () => {
    const { user } = setup();
    const field = screen.getByRole('searchbox', { name: 'Search actions' });
    await user.type(field, 'subway');
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
    expect(tile(/^Train or metro:/)).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'unicycle hockey');
    expect(
      screen.getByText('Not in the catalogue. Log it as a custom action?'),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Log a custom action' }),
    );
    expect(within(sheet()).getByLabelText('What did you do?')).toHaveValue('unicycle hockey');
  });

  it('leaves the search when a kind is picked', async () => {
    const { user } = setup();
    const field = screen.getByRole('searchbox', { name: 'Search actions' });
    await user.type(field, 'bus');
    await user.click(screen.getByRole('tab', { name: 'Eat' }));
    expect(field).toHaveValue('');
    expect(screen.queryByRole('tab', { name: /Results/ })).not.toBeInTheDocument();
    expect(tile(/^Plant-based meal:/)).toBeInTheDocument();
  });
});

describe('logging from the grid', () => {
  it('takes two taps and prints the log in today’s ledger with time, estimate and XP', async () => {
    const { user } = setup();
    expect(
      screen.getByText('Nothing stuck yet today. Your first action is one tap away.'),
    ).toBeInTheDocument();

    await user.click(tile(/^Bus:/));
    const preview = within(sheet()).getByTestId('log-preview');
    expect(preview).toHaveTextContent('approximately');
    expect(preview).toHaveTextContent('vs. driving it alone, minus the bus’s own emissions');
    expect(preview).toHaveTextContent('+12 XP');
    expect(
      within(sheet()).getByRole('button', { name: 'About this estimate' }),
    ).toBeInTheDocument();
    expect(within(sheet()).getByRole('link', { name: /How we estimate this/ })).toHaveAttribute(
      'href',
      '/methodology#action-bus-instead-of-car',
    );
    await user.click(stickButton());

    const logs = today().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actionId: 'bus-instead-of-car', qty: 5, source: 'log' });
    const row = within(ledger()).getByRole('listitem');
    expect(row).toHaveTextContent('Bus');
    expect(row).toHaveTextContent('12:00 PM · 5 km · +12 XP');
    expect(row).toHaveTextContent('approximately');
    expect(within(row).getByRole('button', { name: 'Undo: Bus' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('logs the preset that was picked', async () => {
    const { user } = setup();
    await user.click(tile(/^Bus:/));
    await user.click(within(sheet()).getByRole('radio', { name: '10 km' }));
    await user.click(stickButton());
    expect(today().logs[0]).toMatchObject({ qty: 10 });
  });

  it('refuses more than a day can hold, before saving', async () => {
    const { user } = setup();
    await user.click(tile(/^Bus:/));
    await user.click(within(sheet()).getByRole('radio', { name: 'Custom' }));
    const amount = within(sheet()).getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '999');
    expect(within(sheet()).getByRole('alert')).toHaveTextContent(
      "That's more than a day can hold. Typo?",
    );
    await user.click(stickButton());
    expect(today().logs).toHaveLength(0);

    await user.clear(amount);
    await user.type(amount, '7.5');
    await user.click(stickButton());
    expect(today().logs[0]).toMatchObject({ qty: 7.5 });
  });

  it('never shows a number for an action that is not quantified', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Move' }));
    await user.click(tile(/^Car-free day:/));
    const preview = within(sheet()).getByTestId('log-preview');
    expect(preview).toHaveTextContent('Impact not quantified. XP for showing up.');
    expect(preview).not.toHaveTextContent('approximately');
    expect(within(sheet()).queryByRole('button', { name: 'About this estimate' })).toBeNull();
    await user.click(stickButton());
    expect(today().logs[0]).toMatchObject({ actionId: 'car-free-day', co2eKg: null, xp: 10 });
    expect(within(ledger()).getByRole('listitem')).toHaveTextContent('Not quantified');
  });
});

describe('caps and overlap groups', () => {
  it('marks a maxed tile and says a further log adds kilograms, not XP', async () => {
    seed('bus-instead-of-car', 2);
    seed('bus-instead-of-car', 3);
    const { user } = setup();
    const bus = tile(/^Bus:/);
    expect(bus).toHaveAccessibleName(/Maxed for today/);
    expect(within(bus).getByText('Maxed')).toBeInTheDocument();

    await user.click(bus);
    expect(within(sheet()).getByTestId('log-preview')).toHaveTextContent(
      'Maxed for today. This one adds kilograms, not XP.',
    );
    wait(5000);
    await user.click(stickButton());
    const newest = today().logs[0];
    expect(newest).toMatchObject({ actionId: 'bus-instead-of-car', xp: 0, rewardedActs: 0 });
    expect(newest?.co2eKg).toBeGreaterThan(0);
  });

  it('closes a tile whose hard daily cap is used up', async () => {
    seed('thermostat-down-1c');
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Power' }));
    const heating = tile(/^Heating down:/);
    expect(within(heating).getByText('Done')).toBeInTheDocument();
    await user.click(heating);
    expect(within(sheet()).getByRole('status')).toHaveTextContent('Maxed for today');
    await user.click(stickButton());
    expect(today().logs).toHaveLength(1);
  });

  it('covers the meal tiles once a diet day is logged', async () => {
    seed('vegetarian-day');
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Eat' }));
    const meal = tile(/^Plant-based meal:/);
    expect(within(meal).getByText('Covered')).toBeInTheDocument();
    await user.click(meal);
    expect(within(sheet()).getByRole('status')).toHaveTextContent(
      'Covered by your vegetarian day.',
    );
  });

  it('shows the group hint and the rough-estimate label where they apply', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Eat' }));
    await user.click(tile(/^Plant-based meal:/));
    expect(within(sheet()).getByText('One tile per meal — pick the best fit.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'Stuff' }));
    await user.click(tile(/^Borrowed it:/));
    expect(
      within(sheet()).getByText('Rough estimate: depends a lot on your situation'),
    ).toBeInTheDocument();
    expect(within(sheet()).getByText(/^Likely between /)).toBeInTheDocument();
  });

  it('writes one log per material from the recycling tile', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Waste' }));
    await user.click(tile(/^Sorted recycling:/));
    expect(stickButton()).toHaveAttribute('aria-disabled', 'true');
    const more = (material: string) =>
      within(sheet()).getByRole('button', { name: `More: ${material}` });
    await user.click(more('Aluminium cans'));
    await user.click(more('Aluminium cans'));
    await user.click(more('Glass bottles or jars'));
    expect(within(sheet()).getByTestId('log-preview')).toHaveTextContent('+20 XP');
    await user.click(stickButton());
    const logs = today().logs;
    expect(logs.map((log) => [log.actionId, log.qty]).sort()).toEqual([
      ['recycle-aluminium-can', 2],
      ['recycle-glass-bottle', 1],
    ]);
    expect(within(ledger()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('lets the second-hand tile choose which garment it was', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Stuff' }));
    await user.click(tile(/^Second-hand:/));
    await user.click(within(sheet()).getByRole('radio', { name: 'Jeans or heavier' }));
    await user.click(stickButton());
    expect(today().logs[0]).toMatchObject({ actionId: 'second-hand-jeans', qty: 1 });
  });

  it('logs the flight swap by trip when the distance is unknown', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Move' }));
    await user.click(tile(/^Train, not plane:/));
    await user.click(within(sheet()).getByRole('switch', { name: "I don't know the distance" }));
    await user.click(stickButton());
    expect(today().logs[0]).toMatchObject({
      actionId: 'train-instead-of-short-flight-trip',
      qty: 1,
    });
  });
});

describe('undo and delete', () => {
  it('restores the exact previous state when a fresh log is undone', async () => {
    gameActions.checkIn();
    // The first log of all earns a badge and a level, which stay earned; a later log is a clean undo.
    seed('plant-based-meal');
    wait(60_000);
    const before = snapshot();
    const { user } = setup();
    await user.click(tile(/^Bus:/));
    await user.click(stickButton());
    expect(snapshot()).not.toBe(before);

    await user.click(within(ledger()).getByRole('button', { name: 'Undo: Bus' }));
    expect(snapshot()).toBe(before);
    expect(within(ledger()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('asks before deleting once the undo window has passed', async () => {
    seed('bus-instead-of-car', 5);
    wait(9000);
    const { user } = setup();
    expect(within(ledger()).queryByRole('button', { name: 'Undo: Bus' })).toBeNull();
    await user.click(within(ledger()).getByRole('button', { name: 'Delete: Bus' }));
    const dialog = screen.getByRole('dialog', { name: 'Peel this one off?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(today().logs).toHaveLength(1);

    await user.click(within(ledger()).getByRole('button', { name: 'Delete: Bus' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Peel this one off?' })).getByRole('button', {
        name: 'Peel it off',
      }),
    );
    expect(today().logs).toHaveLength(0);
  });

  it('totals the day on the receipt and keeps AI estimates on their own line', async () => {
    seed('bus-instead-of-car', 10);
    wait(5000);
    gameActions.logCustom({ title: 'Mended a tent', category: 'stuff', effort: 2, co2eKg: 0.4 });
    setup();
    const receipt = screen.getByText(/touch grass · today/i).closest('div');
    expect(receipt).toHaveTextContent('Actions2');
    expect(receipt).toHaveTextContent('AI estimatesapproximately 400 g');
    expect(receipt).toHaveTextContent('Est. CO2e avoided');
    expect(receipt).toHaveTextContent('820 g');
  });
});

describe('“Not for me”', () => {
  it('hides a tile from the sheet and brings it back', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Move' }));
    await user.click(tile(/^Drove electric:/));
    await user.click(within(sheet()).getByRole('button', { name: 'Not for me' }));
    const confirm = await screen.findByRole('dialog', { name: 'Hide “Drove electric”?' });
    await user.click(within(confirm).getByRole('button', { name: 'Hide it' }));

    expect(getGameState().settings.hiddenActions).toContain('ev-instead-of-petrol-car');
    expect(screen.queryByRole('button', { name: /^Drove electric:/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 hidden here')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));
    await user.click(
      screen.getByRole('button', { name: 'Bring back: Drove electric instead of petrol' }),
    );
    expect(getGameState().settings.hiddenActions).not.toContain('ev-instead-of-petrol-car');
    expect(tile(/^Drove electric:/)).toBeInTheDocument();
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
    await user.click(screen.getByRole('tab', { name: 'Power' }));
    expect(screen.getByText("You've hidden everything here.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage hidden actions' })).toHaveAttribute(
      'href',
      '/me',
    );
  });
});

describe('links into the page', () => {
  it('opens a prefilled sheet from ?a=…&q=… without logging anything', async () => {
    search = 'a=bus-instead-of-car&q=12&src=coach';
    const { user } = setup();
    const dialog = await screen.findByRole('dialog', {
      name: 'Took the bus instead of driving',
    });
    expect(within(dialog).getByLabelText('Amount')).toHaveValue('12');
    expect(today().logs).toHaveLength(0);
    await user.click(stickButton());
    expect(today().logs[0]).toMatchObject({ qty: 12, source: 'coach' });
  });

  it('falls back to the grid with a toast for an unknown id', async () => {
    search = 'a=bike-instead-of-car';
    setup();
    expect(
      await screen.findByText("That action isn't in the catalogue any more."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(46);
  });

  it('opens the custom flow from ?custom=1', async () => {
    search = 'custom=1';
    setup();
    expect(await screen.findByRole('dialog', { name: 'Log a custom action' })).toBeInTheDocument();
  });
});

describe('custom actions', () => {
  async function describeIt(user: ReturnType<typeof userEvent.setup>, text: string) {
    await user.click(screen.getByRole('button', { name: 'Log a custom action' }));
    await user.type(within(sheet()).getByLabelText('What did you do?'), text);
    await user.click(within(sheet()).getByRole('button', { name: 'Look it up' }));
  }

  it('asks for at least three characters', async () => {
    const { user } = setup(client(READY));
    await describeIt(user, 'ab');
    expect(within(sheet()).getByRole('alert')).toHaveTextContent(
      'Describe it in at least three characters.',
    );
  });

  it('uses the AI estimate when the server has one, labelled and editable', async () => {
    const ai = client(READY);
    const { user } = setup(ai);
    await describeIt(user, 'Taught a darning class');

    const preview = await within(sheet()).findByTestId('custom-preview');
    expect(ai.estimateAction).toHaveBeenCalledTimes(1);
    expect(ai.estimateAction.mock.calls[0]?.[0]).toBe('Taught a darning class');
    expect(preview).toHaveTextContent('approximately 400 g');
    expect(preview).toHaveTextContent('AI estimate, low confidence');
    expect(preview).toHaveTextContent('+12 XP');
    expect(within(sheet()).getByText('Filled in by the AI. Change anything.')).toBeInTheDocument();

    // Always editable: a smaller effort changes the XP, and the kind can be changed.
    await user.click(within(sheet()).getByRole('radio', { name: 'Tiny' }));
    expect(preview).toHaveTextContent('+8 XP');
    await user.click(within(sheet()).getByRole('button', { name: 'Nature' }));
    await user.click(within(sheet()).getByRole('checkbox', { name: /Keep in My actions/ }));
    await user.click(stickButton());

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
    expect(screen.getByRole('list', { name: 'My actions' })).toHaveTextContent(
      'Taught a darning class',
    );
  });

  it('lets the number be dropped before saving', async () => {
    const { user } = setup(client(READY));
    await describeIt(user, 'Taught a darning class');
    await within(sheet()).findByTestId('custom-preview');
    await user.click(within(sheet()).getByRole('button', { name: 'Log without a number' }));
    expect(within(sheet()).getByTestId('custom-preview')).toHaveTextContent(
      'Impact not quantified. XP for showing up.',
    );
    await user.click(stickButton());
    expect(today().logs[0]).toMatchObject({ estimate: 'none', co2eKg: null });
  });

  it('without a live AI offers a labelled built-in guess and never a number', async () => {
    const ai = client(NOT_CONFIGURED);
    const { user } = setup(ai);
    await describeIt(user, 'Taught a workshop about beeswax wraps');
    const preview = await within(sheet()).findByTestId('custom-preview');
    expect(ai.estimateAction).not.toHaveBeenCalled();
    expect(preview).toHaveTextContent('Impact not quantified. XP for showing up.');
    expect(preview).not.toHaveTextContent('approximately');
    expect(
      within(sheet()).getByText('No live AI on this server, so there is no kilogram figure.'),
    ).toBeInTheDocument();
    await user.click(stickButton());
    expect(today().logs[0]).toMatchObject({ actionId: 'custom', estimate: 'none', co2eKg: null });
  });

  it('falls back to the manual picker, said plainly, when the estimate fails', async () => {
    const ai = client(READY, () => Promise.reject(new AiError('timeout', 'too slow')));
    const { user } = setup(ai);
    await describeIt(user, 'Taught a workshop about beeswax wraps');
    expect(
      await within(sheet()).findByText(
        'The estimate didn’t come through. Pick a kind and an effort yourself.',
      ),
    ).toBeInTheDocument();
    expect(within(sheet()).getByRole('radio', { name: 'Small' })).toBeChecked();
    expect(within(sheet()).getByRole('button', { name: 'Stuff' })).toBeInTheDocument();
  });

  it('offline never calls the server and says the estimate needs a connection', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const ai = client(READY);
    const { user } = setup(ai);
    await describeIt(user, 'Taught a workshop about beeswax wraps');
    expect(await within(sheet()).findByText('AI estimate needs a connection.')).toBeInTheDocument();
    expect(ai.getAiStatus).not.toHaveBeenCalled();
    expect(ai.estimateAction).not.toHaveBeenCalled();
  });

  it('hands a description the catalogue knows to that action’s own sheet', async () => {
    const ai = client(READY);
    const { user } = setup(ai);
    await describeIt(user, 'Fixed the toaster');
    expect(within(sheet()).getByText('Looks like something on the sheet.')).toBeInTheDocument();
    expect(ai.estimateAction).not.toHaveBeenCalled();
    await user.click(
      within(sheet()).getByRole('button', { name: /Repaired instead of replacing/ }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Repaired instead of replacing' }),
    ).toBeInTheDocument();
  });

  it('respects “No, something else” and does not let a declined match carry a number', async () => {
    const ai = client(READY, () =>
      Promise.resolve({ ...AI_ESTIMATE, matchedActionId: 'repair-instead-of-replace' }),
    );
    const { user } = setup(ai);
    await describeIt(user, 'Fixed the toaster');
    await user.click(within(sheet()).getByRole('button', { name: 'No, something else' }));
    const preview = await within(sheet()).findByTestId('custom-preview');
    expect(preview).toHaveTextContent('Impact not quantified. XP for showing up.');
  });

  it('says when two custom actions have already earned XP today', async () => {
    for (const title of ['Mended a tent', 'Shared a lawnmower']) {
      wait(5000);
      gameActions.logCustom({ title, category: 'stuff', effort: 2 });
    }
    const { user } = setup(client(NOT_CONFIGURED));
    await describeIt(user, 'Taught a workshop about beeswax wraps');
    const preview = await within(sheet()).findByTestId('custom-preview');
    expect(preview).toHaveTextContent('Two custom actions already earned XP today.');
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
    expect(within(ledger()).getAllByRole('listitem')).toHaveLength(before);
    await user.click(screen.getByRole('tab', { name: 'Nature' }));
    await user.click(tile(/^Litter pick:/));
    await user.click(stickButton());
    expect(today().logs).toHaveLength(before + 1);
    expect(within(ledger()).getAllByRole('listitem')).toHaveLength(before + 1);
  });
});
