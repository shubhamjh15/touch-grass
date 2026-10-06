import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  gameActions,
  getGameState,
  selectActionStatesById,
  selectQuests,
  type ActionState,
} from '@/game';
import { restoreClock, seedGame } from '../test/harness';
import { chipLabel, quantityOptions, readMessage, toChipView, type ChipWorld } from './chips';

let now = 0;

function world(overrides: Partial<ChipWorld> = {}): ChipWorld {
  const state = getGameState();
  const board = selectQuests(state, now);
  return {
    actions: selectActionStatesById(state, now),
    quests: [...board.daily, ...board.weekly],
    breakAvailable: true,
    units: 'metric',
    ...overrides,
  };
}

const log = (actionId: string, quantity: number | null = null) =>
  ({ type: 'chip', kind: 'log', actionId, quantity }) as const;

beforeEach(() => {
  now = seedGame('day12');
});
afterEach(restoreClock);

describe('log chips', () => {
  it('offers a catalogue action with the quantity Moss named', () => {
    const chip = toChipView(log('walk-cycle-instead-of-car', 5), world());
    expect(chip).toMatchObject({
      kind: 'log',
      actionId: 'walk-cycle-instead-of-car',
      qty: 5,
      qtyLabel: '5 km',
      href: '/log?a=walk-cycle-instead-of-car&q=5&src=coach',
    });
    expect(chip && chipLabel(chip)).toBe('Walked or cycled instead of driving · 5 km');
  });

  it('starts from the usual quantity when Moss names none, and links without one', () => {
    const chip = toChipView(log('walk-cycle-instead-of-car'), world());
    const usual = world().actions.get('walk-cycle-instead-of-car')?.quickQty;
    expect(chip).toMatchObject({ qty: usual, qtyLabel: null });
    expect(chip?.kind === 'log' && chip.href).toBe('/log?a=walk-cycle-instead-of-car&src=coach');
  });

  it('drops an id that is not in the catalogue', () => {
    expect(toChipView(log('teleport-to-work'), world())).toBeNull();
  });

  it('drops an action the user hid with "Not for me"', () => {
    gameActions.hideAction('walk-cycle-instead-of-car');
    expect(toChipView(log('walk-cycle-instead-of-car'), world())).toBeNull();
  });

  it('drops a quantity above what is left of the day, or finer than the action allows', () => {
    expect(toChipView(log('walk-cycle-instead-of-car', 61), world())).toBeNull();
    expect(toChipView(log('plant-based-meal', 1.5), world())).toBeNull();
  });

  it('drops an action that is maxed today, unless the user stuck it from this very chip', () => {
    // One log a day is all this action holds.
    const result = gameActions.logAction({ actionId: 'standby-off', qty: 1 });
    expect(result.ok).toBe(true);
    expect(toChipView(log('standby-off'), world())).toBeNull();
    expect(toChipView(log('standby-off'), world(), true)).toMatchObject({ kind: 'log' });
  });

  it('offers only quantities that still fit today', () => {
    const state = world().actions.get('walk-cycle-instead-of-car') as ActionState;
    const options = quantityOptions(state, 7);
    expect(options).toContain(7);
    expect(options).toEqual([...options].sort((a, b) => a - b));
    expect(options.every((qty) => qty <= state.unitsLeft)).toBe(true);
    expect(quantityOptions({ ...state, unitsLeft: 3 }, 7).every((qty) => qty <= 3)).toBe(true);
  });

  it('shows distances in miles to people who chose imperial units', () => {
    const chip = toChipView(log('walk-cycle-instead-of-car', 8), world({ units: 'imperial' }));
    expect(chip?.kind === 'log' && chip.qtyLabel).toBe('5 mi');
  });
});

describe('other chips', () => {
  it('links a lesson that exists and drops one that does not', () => {
    const chip = toChipView({ type: 'chip', kind: 'learn', slug: 'the-blanket' }, world());
    expect(chip).toMatchObject({ kind: 'learn', href: '/learn/the-blanket' });
    expect(chip && chipLabel(chip)).toMatch(/^Read: /);
    expect(toChipView({ type: 'chip', kind: 'learn', slug: 'nope' }, world())).toBeNull();
  });

  it('links a quest on the board, and drops unknown or claimed ones', () => {
    const [quest] = world().quests;
    expect(quest).toBeDefined();
    if (!quest) return;
    expect(toChipView({ type: 'chip', kind: 'quest', questId: quest.id }, world())).toMatchObject({
      kind: 'quest',
      title: quest.title,
      href: '/quests',
    });
    expect(
      toChipView(
        { type: 'chip', kind: 'quest', questId: quest.id },
        world({ quests: [{ ...quest, claimed: true }] }),
      ),
    ).toBeNull();
    expect(toChipView({ type: 'chip', kind: 'quest', questId: 'd_nope' }, world())).toBeNull();
  });

  it('offers a break only when one can start', () => {
    const chip = { type: 'chip', kind: 'break', minutes: 10 } as const;
    expect(toChipView(chip, world())).toMatchObject({ kind: 'break', href: '/today?break=1' });
    expect(toChipView(chip, world({ breakAvailable: false }))).toBeNull();
  });
});

describe('readMessage', () => {
  const message = {
    id: 'm1',
    content:
      'Try a ride.\n\n[[log:walk-cycle-instead-of-car?qty=5]]\n[[log:made-up]]\n[[break:10]]',
    status: 'complete' as const,
  };

  it('separates the words from the chips and drops the invalid token silently', () => {
    const read = readMessage(message, world());
    expect(read.text).toBe('Try a ride.');
    expect(read.chips.map((chip) => chip.kind)).toEqual(['log', 'break']);
  });

  it('holds chips back, and hides a half-received token, while the answer streams', () => {
    const read = readMessage(
      { ...message, content: 'Try a ride.\n\n[[log:walk-cyc', status: 'streaming' },
      world(),
    );
    expect(read).toEqual({ text: 'Try a ride.', chips: [] });
  });
});
