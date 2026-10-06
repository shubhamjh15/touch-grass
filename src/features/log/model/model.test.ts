import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PARAMS } from '@/app/routes';
import { ACTIONS, ACTION_BY_ID, ACTION_IDS } from '@/data/catalogue';
import {
  estimateKg,
  game,
  gameActions,
  getGameState,
  selectActionStates,
  selectTodaySummary,
} from '@/game';
import { localTime } from '@/game/testkit';
import { ACTION_META } from './actionMeta';
import { factorCode, logEstimateSource, methodologyHref, previewEstimateSource } from './estimate';
import { parseLogParams, withoutLogParams } from './params';
import {
  editDistance,
  guessCatalogueTiles,
  matchTier,
  normalise,
  quantityIn,
  searchTiles,
} from './search';
import { TILES, tileFor, tileStates, tilesFor, type TileState } from './tiles';
import {
  formatQty,
  hasQuantityChoice,
  parseQty,
  presetFor,
  presetOptions,
  stepFor,
  toStoredQty,
} from './units';

const DAY = '2026-10-06';
let now = localTime(DAY, 12);

beforeEach(() => {
  now = localTime(DAY, 12);
  game.setClock(() => now);
  gameActions.resetAll();
  const planted = gameActions.onboard({ name: 'Maya', treeName: 'Fern', species: 'oak' });
  if (!planted.ok) throw new Error(planted.reason);
});

afterEach(() => {
  game.setClock(() => Date.now());
});

const states = (): TileState[] => tileStates(selectActionStates(getGameState(), now));
const stateOf = (id: string): TileState => {
  const found = states().find((state) => state.tile.id === id);
  if (!found) throw new Error(`no tile ${id}`);
  return found;
};
const ids = (list: readonly TileState[]) => list.map((state) => state.tile.id);
const query = (text: string) => new URLSearchParams(text);

function log(actionId: string, qty?: number): void {
  // Identical logs within two seconds are treated as a double tap.
  now += 5000;
  const result = gameActions.logAction({ actionId, qty });
  if (!result.ok) throw new Error(`${actionId}: ${result.message}`);
}

describe('tiles', () => {
  it('covers all 51 actions with 46 tiles, each action exactly once', () => {
    expect(ACTIONS).toHaveLength(51);
    expect(TILES).toHaveLength(46);
    const covered = TILES.flatMap((tile) => tile.actionIds);
    expect([...covered].sort()).toEqual([...ACTION_IDS].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });

  it('draws the three overlap groups of spec 3.3 as one tile each', () => {
    expect(tileFor('recycling')?.actionIds).toHaveLength(4);
    expect(tileFor('recycle-paper')?.id).toBe('recycling');
    expect(tileFor('second-hand-jeans')?.id).toBe('secondhand');
    expect(tileFor('train-instead-of-short-flight-trip')?.id).toBe('flight-swap');
    expect(tileFor('walk-cycle-instead-of-car')?.kind).toBe('single');
    expect(tileFor('nope')).toBeUndefined();
  });

  it('gives every action four to eight synonyms and a caption that fits a sticker', () => {
    for (const action of ACTIONS) {
      const meta = ACTION_META[action.id];
      expect(meta.synonyms.length, action.id).toBeGreaterThanOrEqual(4);
      expect(meta.synonyms.length, action.id).toBeLessThanOrEqual(8);
      expect(meta.label.length, action.id).toBeLessThanOrEqual(18);
      for (const word of meta.synonyms) expect(word, action.id).toBe(word.toLowerCase());
    }
  });

  it('shows a category in catalogue order and sinks maxed tiles to the end', () => {
    expect(ids(tilesFor(states(), 'power'))).toEqual([
      'thermostat-down-1c',
      'line-dry-instead-of-tumble',
      'standby-off',
      'led-bulb-swap',
      'ac-up-1c',
    ]);
    log('thermostat-down-1c');
    const power = tilesFor(states(), 'power');
    expect(ids(power).at(-1)).toBe('thermostat-down-1c');
    expect(power.at(-1)?.blocked?.reason).toBe('over-cap');
  });

  it('puts focus categories and most-used actions first when every kind is shown', () => {
    gameActions.updateProfile({ focus: ['water'] });
    log('standby-off');
    const forYou = tilesFor(states(), null);
    expect(forYou[0]?.tile.category).toBe('water');
    const firstOther = forYou.find((state) => state.tile.category !== 'water');
    // Standby is spent for today, so the next most relevant tile leads the rest.
    expect(firstOther?.tile.id).not.toBe('standby-off');
    expect(forYou).toHaveLength(46);
  });

  it('hides a tile only when every member is hidden', () => {
    gameActions.hideAction('second-hand-tshirt');
    expect(stateOf('secondhand').hidden).toBe(false);
    expect(stateOf('secondhand').members.map((member) => member.action.id)).toEqual([
      'second-hand-jeans',
    ]);
    gameActions.hideAction('second-hand-jeans');
    expect(stateOf('secondhand').hidden).toBe(true);
    expect(ids(tilesFor(states(), 'stuff'))).not.toContain('secondhand');
    expect(ids(tilesFor(states(), null))).not.toContain('secondhand');
  });

  it('hides heat actions in a home without heating', () => {
    gameActions.updateProfile({ heat: 'none' });
    expect(stateOf('thermostat-down-1c').hidden).toBe(true);
    expect(stateOf('shorter-shower').hidden).toBe(true);
  });

  it('marks a group tile maxed once its shared acts are used', () => {
    log('recycle-aluminium-can', 1);
    log('recycle-glass-bottle', 1);
    const recycling = stateOf('recycling');
    expect(recycling.maxed).toBe(true);
    expect(recycling.blocked).toBeNull();
  });

  it('blocks the meal tiles once a diet day is logged, with the engine’s reason', () => {
    log('vegetarian-day');
    expect(stateOf('plant-based-meal').blocked?.reason).toBe('covered-by-day');
    expect(stateOf('vegan-day').blocked?.reason).toBe('covered-by-day');
  });
});

describe('search', () => {
  it('normalises case, accents and punctuation', () => {
    expect(normalise('  Café-run!  ')).toBe('cafe run');
    expect(editDistance('recyle', 'recycle', 1)).toBe(1);
    expect(editDistance('bus', 'train', 1)).toBeGreaterThan(1);
  });

  it('finds every action by its title and by each shipped synonym', () => {
    const all = states();
    for (const action of ACTIONS) {
      const tile = tileFor(action.id);
      expect(ids(searchTiles(all, action.title)), action.title).toContain(tile?.id);
      for (const word of ACTION_META[action.id].synonyms) {
        expect(ids(searchTiles(all, word)), `${action.id}: ${word}`).toContain(tile?.id);
      }
    }
  });

  it('answers the spec’s example words', () => {
    const all = states();
    expect(ids(searchTiles(all, 'subway'))).toContain('train-metro-instead-of-car');
    expect(ids(searchTiles(all, 'tram'))).toEqual(
      expect.arrayContaining(['bus-instead-of-car', 'train-metro-instead-of-car']),
    );
    expect(ids(searchTiles(all, 'thrift'))[0]).toBe('secondhand');
    expect(ids(searchTiles(all, 'bottle bank'))).toContain('recycling');
  });

  it('forgives a typo but not a different word', () => {
    const all = states();
    expect(ids(searchTiles(all, 'recyle'))).toContain('recycling');
    expect(ids(searchTiles(all, 'compst'))).toContain('compost-food-waste');
    expect(searchTiles(all, 'xylophone')).toEqual([]);
    expect(searchTiles(all, '   ')).toEqual([]);
  });

  it('ranks a prefix match first, then the person’s own frequency, then the alphabet', () => {
    expect(
      matchTier(
        TILES.find((tile) => tile.id === 'bus-instead-of-car')!,
        'bus',
      ),
    ).toBe(0);
    const before = ids(searchTiles(states(), 'commute'));
    expect(before.slice(0, 3)).toEqual([
      'bus-instead-of-car',
      'train-metro-instead-of-car',
      'walk-cycle-instead-of-car',
    ]);
    log('walk-cycle-instead-of-car', 2);
    log('walk-cycle-instead-of-car', 3);
    expect(ids(searchTiles(states(), 'commute'))[0]).toBe('walk-cycle-instead-of-car');
  });

  it('never returns a hidden tile', () => {
    gameActions.hideAction('bus-instead-of-car');
    expect(ids(searchTiles(states(), 'bus'))).not.toContain('bus-instead-of-car');
  });

  it('recognises a catalogue action in a free-text description', () => {
    const all = states();
    expect(guessCatalogueTiles('Fixed the toaster', all)[0]?.tile.id).toBe(
      'repair-instead-of-replace',
    );
    expect(guessCatalogueTiles('took the subway to work', all)[0]?.tile.id).toBe(
      'train-metro-instead-of-car',
    );
    expect(guessCatalogueTiles('refilled my water bottle at the gym', all)[0]?.tile.id).toBe(
      'refuse-single-use-bottle',
    );
    expect(guessCatalogueTiles('Taught my neighbour to darn socks', all)).toEqual([]);
    expect(guessCatalogueTiles('the', all)).toEqual([]);
    expect(guessCatalogueTiles('fixed my bike and took the bus', all).length).toBeLessThanOrEqual(
      2,
    );
  });

  it('reads a quantity out of a description', () => {
    expect(quantityIn('cycled 12 km')).toBe(12);
    expect(quantityIn('half a loaf, 0,5 kg')).toBe(0.5);
    expect(quantityIn('nothing here')).toBeNull();
  });
});

describe('URL parameters', () => {
  it('opens a catalogue action with a quantity and a source', () => {
    const intent = parseLogParams(query('a=bus-instead-of-car&q=12&src=coach'));
    expect(intent).toMatchObject({
      kind: 'action',
      actionId: 'bus-instead-of-car',
      qty: 12,
      source: 'coach',
    });
  });

  it('maps a member of a merged tile to that tile and remembers the member', () => {
    const intent = parseLogParams(query('a=recycle-paper&q=0.5'));
    expect(intent.kind === 'action' && intent.tile.id).toBe('recycling');
    expect(intent.kind === 'action' && intent.actionId).toBe('recycle-paper');
    const merged = parseLogParams(query('a=secondhand'));
    expect(merged.kind === 'action' && merged.actionId).toBeNull();
  });

  it('ignores a bad quantity or source instead of failing the link', () => {
    for (const q of ['abc', '-3', '0', 'Infinity', '']) {
      const intent = parseLogParams(query(`a=carpool&q=${q}&src=stranger`));
      expect(intent).toMatchObject({ kind: 'action', qty: null, source: 'log' });
    }
    expect(parseLogParams(query('a=carpool&q=2,5'))).toMatchObject({ qty: 2.5 });
  });

  it('reports an unknown id rather than guessing', () => {
    expect(parseLogParams(query('a=bike-instead-of-car'))).toEqual({
      kind: 'unknown',
      id: 'bike-instead-of-car',
    });
  });

  it('opens the custom flow, optionally with text', () => {
    expect(parseLogParams(query('custom=1'))).toEqual({ kind: 'custom', text: '' });
    expect(parseLogParams(query('custom=mended+a+tent'))).toEqual({
      kind: 'custom',
      text: 'mended a tent',
    });
    expect(parseLogParams(query('custom=0'))).toEqual({ kind: 'none' });
    expect(parseLogParams(query(''))).toEqual({ kind: 'none' });
  });

  it('strips only its own parameters', () => {
    expect(withoutLogParams(`?${PARAMS.logAction}=carpool&q=3&src=coach&coach=1`)).toBe('?coach=1');
    expect(withoutLogParams('?custom=1')).toBe('');
  });
});

describe('quantities', () => {
  const action = (id: string) => {
    const found = ACTION_BY_ID.get(id);
    if (!found) throw new Error(id);
    return found;
  };

  it('words quantities with their unit', () => {
    expect(formatQty(5, 'km')).toBe('5 km');
    expect(formatQty(1, 'meal')).toBe('1 meal');
    expect(formatQty(2, 'meal')).toBe('2 meals');
    expect(formatQty(0.5, 'kg')).toBe('0.5 kg');
    expect(formatQty(8, 'km', 'imperial')).toBe('5 mi');
  });

  it('offers presets in the chosen units and stores kilometres', () => {
    const walk = action('walk-cycle-instead-of-car');
    expect(presetOptions(walk, 'metric').map((option) => option.label)).toEqual([
      '1 km',
      '2 km',
      '5 km',
      '10 km',
    ]);
    const miles = presetOptions(walk, 'imperial');
    expect(miles.map((option) => option.label)).toEqual(['1 mi', '2 mi', '5 mi', '10 mi']);
    expect(miles[1]?.qty).toBeCloseTo(3.2, 5);
    expect(presetFor(3.2, miles)?.value).toBe('2');
    expect(presetFor(7, miles)).toBeNull();
    expect(toStoredQty(3, 'meal', 'imperial', 0)).toBe(3);
  });

  it('knows which actions need a quantity control and how far a step goes', () => {
    expect(hasQuantityChoice(action('standby-off'))).toBe(false);
    expect(hasQuantityChoice(action('plant-based-meal'))).toBe(true);
    expect(hasQuantityChoice(action('second-hand-jeans'))).toBe(true);
    expect(stepFor(action('walk-cycle-instead-of-car'))).toBe(1);
    expect(stepFor(action('recycle-paper'))).toBe(0.1);
    expect(stepFor(action('train-instead-of-short-flight-km'))).toBe(100);
  });

  it('reads typed amounts strictly', () => {
    expect(parseQty('2,5')).toBe(2.5);
    expect(parseQty(' 12 ')).toBe(12);
    expect(parseQty('.5')).toBe(0.5);
    for (const bad of ['', '0', '-1', '1e3', 'two', '1.2.3']) expect(parseQty(bad)).toBeNull();
  });
});

describe('estimate sources', () => {
  it('gives every action a unique code and its own methodology anchor', () => {
    const codes = ACTIONS.map((action) => factorCode(action.id));
    expect(new Set(codes).size).toBe(ACTIONS.length);
    expect(factorCode('walk-cycle-instead-of-car')).toBe('MOVE-01');
    expect(factorCode('custom')).toBe('CUSTOM');
    expect(methodologyHref('carpool')).toBe('/methodology#action-carpool');
    expect(methodologyHref('custom')).toBe('/methodology');
  });

  it('explains a preview with the formula, the comparison, the range and the source', () => {
    const walk = ACTION_BY_ID.get('walk-cycle-instead-of-car')!;
    const estimate = estimateKg(walk, 5, getGameState().profile);
    if (!estimate) throw new Error('walking has a factor');
    const source = previewEstimateSource(walk, 5, estimate);
    expect(source.kind).toBe('factor');
    expect(source.formula).toBe('5 km × 210 g per km = 1 kg');
    expect(source.comparedWith).toBe('Compared with the same trip in an average car.');
    expect(source.range).toBe('700 g–1.7 kg');
    expect(source.sourceLabel).toContain('UK Department for Energy Security');
    expect(source.year).toBe(2026);
  });

  it('says so when an estimate is rough', () => {
    const repair = ACTION_BY_ID.get('repair-instead-of-replace')!;
    const estimate = estimateKg(repair, 1, getGameState().profile);
    if (!estimate) throw new Error('repair has a factor');
    expect(previewEstimateSource(repair, 1, estimate).comparedWith).toContain('rough estimate');
  });

  it('explains a stored log from what was frozen on it, and labels AI estimates', () => {
    log('bus-instead-of-car', 10);
    const stuck = selectTodaySummary(getGameState(), now).logs[0]!;
    const source = logEstimateSource(stuck);
    expect(source.code).toBe('MOVE-02');
    expect(source.formula.startsWith('10 km × ')).toBe(true);
    expect(source.sourceLabel).toContain(stuck.factorsVersion);

    now += 5000;
    const custom = gameActions.logCustom({
      title: 'Mended a tent',
      category: 'stuff',
      effort: 2,
      co2eKg: 0.4,
    });
    if (!custom.ok) throw new Error(custom.message);
    const ai = logEstimateSource(custom.log);
    expect(ai.kind).toBe('ai');
    expect(ai.comparedWith).toContain('kept out of your headline total');
  });
});
