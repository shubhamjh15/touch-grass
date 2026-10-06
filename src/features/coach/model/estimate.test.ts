import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getGameState, previewAction, selectToday } from '@/game';
import { restoreClock, seedGame } from '../test/harness';
import { previewLine } from './estimate';

let now = 0;
beforeEach(() => {
  now = seedGame('day12');
});
afterEach(restoreClock);

function preview(actionId: string, qty: number) {
  const state = getGameState();
  return previewAction(state, { actionId, qty }, selectToday(state, now));
}

describe('previewLine', () => {
  it('prints the estimate of the engine, its comparison and where it comes from', () => {
    const line = previewLine('walk-cycle-instead-of-car', preview('walk-cycle-instead-of-car', 5));
    expect(line).not.toBeNull();
    expect(line?.kgText).toMatch(/^\d[\d.,]* (g|kg)$/);
    expect(line?.comparedWith).toBe('the same trip in an average car');
    expect(line?.xp).toBeGreaterThan(0);
    expect(line?.source).toMatchObject({
      kind: 'factor',
      code: 'walk-cycle-instead-of-car',
      href: '/methodology#walk-cycle-instead-of-car',
    });
    expect(line?.source.formula).toMatch(/^5 km × /);
    expect(line?.source.sourceLabel).not.toBe('');
  });

  it('never shows a number for an action without a sourced figure', () => {
    const line = previewLine('car-free-day', preview('car-free-day', 1));
    expect(line?.kgText).toBeNull();
    expect(line?.unquantified).toBe('The kilograms come from the trips you log.');
    expect(line?.source.kind).toBe('none');
  });

  it('returns nothing for an action that is not in the catalogue', () => {
    expect(previewLine('made-up', preview('made-up', 1))).toBeNull();
  });
});
