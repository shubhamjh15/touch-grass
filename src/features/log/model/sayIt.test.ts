import { beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateLocally, type ActionEstimate, type AiClient, type ClientAiStatus } from '@/ai';
import { ACTIONS, ACTION_BY_ID } from '@/data/catalogue';
import {
  createEventBus,
  createGame,
  previewAction,
  selectActionStates,
  selectToday,
  type Game,
} from '@/game';
import { localTime } from '@/game/testkit';
import {
  SAY_IT_MAX_PARTS,
  proposeFromSentence,
  splitSentence,
  type SayItOptions,
  type SayItProposal,
} from './sayIt';
import { tileStates, type TileState } from './tiles';

type TestClient = Pick<AiClient, 'getAiStatus' | 'estimateAction'>;

const NO_AI: ClientAiStatus = {
  configured: false,
  provider: null,
  model: null,
  reason: 'not_configured',
};
const AI_READY: ClientAiStatus = {
  configured: true,
  provider: 'test',
  model: 'test',
  reason: 'ready',
};

const noAi = (): TestClient => ({
  getAiStatus: vi.fn(() => Promise.resolve(NO_AI)),
  estimateAction: vi.fn(() => Promise.reject(new Error('never asked'))),
});

const NOW = localTime('2026-10-06', 12);
let game: Game;

const tiles = (): TileState[] => {
  const { game: state, runtime } = game.store.getState();
  return tileStates(selectActionStates(state, runtime.now));
};

const options = (client: TestClient = noAi(), extra: Partial<SayItOptions> = {}): SayItOptions => ({
  region: 'WORLD',
  units: 'metric',
  online: true,
  client,
  ...extra,
});

/** "action-id × qty" for a match, "?" for a part nothing claimed. */
const brief = (items: readonly SayItProposal[]): string[] =>
  items.map((item) => (item.kind === 'action' ? `${item.actionId} × ${item.qty}` : '?'));

beforeEach(() => {
  game = createGame({ persist: false, now: () => NOW, events: createEventBus(), seed: () => 7 });
  game.actions.onboard({ treeName: 'Fern', species: 'oak' });
});

describe('splitSentence', () => {
  it('cuts a sentence into the things it says were done', () => {
    expect(splitSentence('I cycled to work and skipped meat today')).toEqual([
      'I cycled to work',
      'skipped meat today',
    ]);
    expect(splitSentence('Fixed my jeans, then a short shower.')).toEqual([
      'Fixed my jeans',
      'a short shower',
    ]);
    expect(splitSentence('took the bus; air-dried the laundry & recycled paper')).toEqual([
      'took the bus',
      'air-dried the laundry',
      'recycled paper',
    ]);
  });

  it('keeps an amount with the thing it measures', () => {
    expect(splitSentence('Took the bus, 8 km, and air-dried the laundry')).toEqual([
      'Took the bus 8 km',
      'air-dried the laundry',
    ]);
  });

  it('drops parts that only say when', () => {
    expect(splitSentence('today, I walked to the shop, and also this morning')).toEqual([
      'I walked to the shop',
    ]);
    expect(splitSentence('   ')).toEqual([]);
    expect(splitSentence('today')).toEqual([]);
  });
});

describe('proposeFromSentence without an AI', () => {
  it('turns the sentence from the brief into two catalogue actions', async () => {
    const found = await proposeFromSentence(
      'I cycled to work and skipped meat today',
      tiles(),
      options(),
    );
    expect(found).toMatchObject([
      { kind: 'action', actionId: 'walk-cycle-instead-of-car', by: 'built-in', sure: true },
      { kind: 'action', actionId: 'vegetarian-day', by: 'built-in', sure: true },
    ]);
    expect(found.map((item) => item.said)).toEqual(['I cycled to work', 'skipped meat today']);
  });

  it('proposes only what the engine would accept, with the estimate the engine gives', async () => {
    const found = await proposeFromSentence('took the bus and fixed my jeans', tiles(), options());
    const { game: state, runtime } = game.store.getState();
    for (const item of found) {
      if (item.kind !== 'action') throw new Error(`no match for “${item.said}”`);
      const preview = previewAction(
        state,
        { actionId: item.actionId, qty: item.qty },
        selectToday(state, runtime.now),
      );
      expect(preview.ok).toBe(true);
      expect(preview.kg?.kg).toBeGreaterThan(0);
    }
    // Proposing logs nothing.
    expect(state.logs).toEqual([]);
  });

  it('reads an amount in the person’s own units, and distrusts one a day cannot hold', async () => {
    expect(brief(await proposeFromSentence('took the bus 8 km', tiles(), options()))).toEqual([
      'bus-instead-of-car × 8',
    ]);
    const miles = await proposeFromSentence(
      'cycled 5 miles to work',
      tiles(),
      options(noAi(), { units: 'imperial' }),
    );
    expect(miles[0]).toMatchObject({ actionId: 'walk-cycle-instead-of-car' });
    expect(miles[0]?.kind === 'action' && miles[0].qty).toBeCloseTo(8, 0);

    // "30" is a temperature here, not thirty loads.
    const wash = await proposeFromSentence('washed at 30 degrees', tiles(), options());
    expect(wash[0]).toMatchObject({ actionId: 'wash-30-instead-of-40' });
    const cap = ACTION_BY_ID.get('wash-30-instead-of-40')?.dailyCap ?? 0;
    expect(wash[0]?.kind === 'action' && wash[0].qty).toBeLessThanOrEqual(cap);
  });

  it('says so when part of the sentence is not on the sheet', async () => {
    const found = await proposeFromSentence(
      'walked the dog and took a short shower',
      tiles(),
      options(),
    );
    expect(brief(found)).toEqual(['?', 'shorter-shower × 2']);
    expect(found[0]).toEqual({ kind: 'unknown', said: 'walked the dog' });
  });

  it('offers a nearest match without assuming it', async () => {
    // A vegetarian lunch is not a vegetarian day: the catalogue has no single vegetarian meal.
    const found = await proposeFromSentence('had a vegetarian lunch', tiles(), options());
    expect(found).toMatchObject([{ kind: 'action', actionId: 'vegetarian-day', sure: false }]);
  });

  it('still shows a match the day cannot take, so the engine can say why', async () => {
    game.actions.logAction({ actionId: 'plant-based-meal', qty: 1 });
    const found = await proposeFromSentence('skipped meat today', tiles(), options());
    expect(found).toMatchObject([{ kind: 'action', actionId: 'vegetarian-day' }]);
    const { game: state, runtime } = game.store.getState();
    const preview = previewAction(
      state,
      { actionId: 'vegetarian-day', qty: 1 },
      selectToday(state, runtime.now),
    );
    expect(preview.refusal?.reason).toBe('meals-logged');
  });

  it('makes one proposal of two parts that name the same action', async () => {
    const found = await proposeFromSentence(
      'cycled to work and cycled back home',
      tiles(),
      options(),
    );
    expect(found.filter((item) => item.kind === 'action')).toHaveLength(1);
  });

  it('looks up a few parts and hands the rest back', async () => {
    const found = await proposeFromSentence(
      'took the bus, fixed my jeans, a short shower, composted scraps, recycled paper, refilled my bottle',
      tiles(),
      options(),
    );
    expect(found).toHaveLength(6);
    expect(found.slice(SAY_IT_MAX_PARTS).every((item) => item.kind === 'unknown')).toBe(true);
  });

  it('never offers an action the person hid', async () => {
    game.actions.hideAction('walk-cycle-instead-of-car');
    expect(brief(await proposeFromSentence('I cycled to work', tiles(), options()))).toEqual(['?']);
  });
});

describe('proposeFromSentence with the live AI', () => {
  const estimate = (patch: Partial<ActionEstimate>): ActionEstimate => ({
    isClimateAction: true,
    matchedActionId: null,
    variant: null,
    title: 'Something',
    emoji: '✨',
    category: 'move',
    effort: 2,
    qty: 1,
    unit: 'time',
    co2eKg: null,
    confidence: 'low',
    rationale: '',
    ...patch,
  });

  it('asks about each part and trusts a catalogue match it names', async () => {
    const client: TestClient = {
      getAiStatus: vi.fn(() => Promise.resolve(AI_READY)),
      estimateAction: vi.fn((text: string) =>
        Promise.resolve(
          text.includes('tram')
            ? estimate({ matchedActionId: 'train-metro-instead-of-car', qty: 6 })
            : estimate({ isClimateAction: false }),
        ),
      ),
    };
    const found = await proposeFromSentence(
      'rode the tram across town and watched a film',
      tiles(),
      options(client),
    );
    expect(client.estimateAction).toHaveBeenCalledTimes(2);
    expect(found).toMatchObject([
      { kind: 'action', actionId: 'train-metro-instead-of-car', qty: 6, by: 'ai', sure: true },
      { kind: 'unknown', said: 'watched a film' },
    ]);
  });

  it('falls back to the built-in list when the AI fails', async () => {
    const client: TestClient = {
      getAiStatus: vi.fn(() => Promise.resolve(AI_READY)),
      estimateAction: vi.fn(() => Promise.reject(new Error('down'))),
    };
    const found = await proposeFromSentence('I cycled to work', tiles(), options(client));
    expect(found).toMatchObject([{ actionId: 'walk-cycle-instead-of-car', by: 'built-in' }]);
  });

  it('does not touch the network offline', async () => {
    const client = noAi();
    await proposeFromSentence('I cycled to work', tiles(), options(client, { online: false }));
    expect(client.getAiStatus).not.toHaveBeenCalled();
  });
});

describe('the built-in list and the real catalogue', () => {
  const catalogue = ACTIONS.map(({ id, title, unit }) => ({ id, title, unit }));
  const match = (text: string) =>
    estimateLocally(text, { actions: catalogue }).estimate.matchedActionId;

  it.each([
    ['I cycled to work', 'walk-cycle-instead-of-car'],
    ['walked to the shop', 'walk-cycle-instead-of-car'],
    ['took the bus', 'bus-instead-of-car'],
    ['took the metro', 'train-metro-instead-of-car'],
    ['skipped meat today', 'vegetarian-day'],
    ['ate vegan', 'plant-based-meal'],
    ['took a short shower', 'shorter-shower'],
    ['line dried my laundry', 'line-dry-instead-of-tumble'],
    ['brought my own cup', 'refuse-single-use-cup'],
    ['refilled my bottle', 'refuse-single-use-bottle'],
    ['fixed my jeans', 'repair-instead-of-replace'],
    ['turned the heating down', 'thermostat-down-1c'],
  ])('“%s” is %s', (text, actionId) => {
    expect(match(text)).toBe(actionId);
    expect(ACTION_BY_ID.has(actionId)).toBe(true);
  });

  it('does not take a walk with the dog for a trip that replaced a drive', () => {
    expect(estimateLocally('walked the dog', { actions: catalogue }).recognised).toBe(false);
  });
});
