import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as game from './index';

const source = readFileSync(path.resolve(process.cwd(), 'src', 'game', 'index.ts'), 'utf8');
const header = source.slice(0, source.indexOf('*/'));

describe('the @/game barrel', () => {
  it('opens with the API index page teams read first', () => {
    expect(source.startsWith('/**')).toBe(true);
    for (const heading of ['ACTIONS', 'HOOKS', 'SELECTORS', 'EVENTS'])
      expect(header).toContain(heading);
  });

  it('documents every action the store offers', () => {
    const undocumented = Object.keys(game.gameActions).filter(
      (name) => !name.startsWith('dev') && !header.includes(name),
    );
    expect(undocumented).toEqual([]);
  });

  it('documents every hook and exports what it documents', () => {
    const exported = Object.keys(game);
    const hooks = exported.filter((name) => /^use[A-Z]/.test(name));
    expect(hooks.length).toBeGreaterThan(25);
    expect(hooks.filter((name) => !header.includes(name))).toEqual([]);
    const selectors = exported.filter((name) => /^select[A-Z]/.test(name));
    const optional = new Set([
      'selectIsOnboarded',
      'selectActionStatesById',
      'selectCustomActions',
      'selectActivity',
      'selectWeekRecap',
    ]);
    expect(selectors.filter((name) => !optional.has(name) && !header.includes(name))).toEqual([]);
    // Hooks are written with their parentheses, which keeps option names out of the match.
    const documented = [...header.matchAll(/\b(use[A-Z]\w+(?=\()|select[A-Z]\w+)\b/g)].map(
      (match) => match[1],
    );
    expect(documented.filter((name) => name && !exported.includes(name))).toEqual([]);
  });

  it('documents every event type', () => {
    const seen = new Set<string>();
    const session = game.createGame({
      storage: game.createMemoryStorage(),
      events: game.createEventBus(),
    });
    expect(session.store.getState().game.schemaVersion).toBe(1);
    // The union is compile-time only, so the list is checked against the events module's source.
    const events = readFileSync(path.resolve(process.cwd(), 'src', 'game', 'events.ts'), 'utf8');
    for (const match of events.matchAll(/type: '([a-z-]+)'/g)) seen.add(match[1] as string);
    expect(seen.size).toBeGreaterThan(40);
    expect([...seen].filter((type) => !header.includes(type))).toEqual([]);
  });

  it('exposes the seams other modules build on', () => {
    expect(typeof game.selectWorldSnapshot).toBe('function');
    expect(typeof game.selectCoachContext).toBe('function');
    expect(typeof game.getCoachContext).toBe('function');
    expect(typeof game.worldPulsesFor).toBe('function');
    expect(typeof game.startGameClock).toBe('function');
    expect(game.STORAGE_KEYS.game).toBe('touchgrass:game');
    expect(game.DAILY_GOAL).toBe(3);
    expect(game.growthOf(8)).toBeCloseTo(0.03, 12);
  });
});
