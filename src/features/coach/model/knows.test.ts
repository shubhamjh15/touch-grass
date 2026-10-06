import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gameActions } from '@/game';
import { restoreClock, seedGame } from '../test/harness';
import { readCoachContext } from '../useCoachSession';
import { describeContext } from './knows';

beforeEach(() => {
  seedGame('day12');
});
afterEach(restoreClock);

describe('describeContext', () => {
  it('lists what the request carries, and never the name of the user', () => {
    const lines = describeContext(readCoachContext());
    const labels = lines.map((line) => line.label);
    expect(labels).toEqual(
      expect.arrayContaining(['Region', 'Tree', 'Progress', 'Focus', 'Totals', 'Action list']),
    );
    expect(lines.find((line) => line.label === 'Tree')?.value).toContain('Fern');
    expect(JSON.stringify(lines)).not.toContain('Maya');
  });

  it('shrinks to the region and the lists when sharing is off', () => {
    gameActions.updateSettings({ shareStatsWithCoach: false });
    const labels = describeContext(readCoachContext()).map((line) => line.label);
    expect(labels).toEqual(['Region', 'Action list', 'Lesson list']);
  });

  it('quotes no CO2e figure: totals are named, not numbered', () => {
    const totals = describeContext(readCoachContext()).find((line) => line.label === 'Totals');
    expect(totals?.value).not.toMatch(/\d\s?kg/);
  });
});
