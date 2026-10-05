import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/dates';
import { addPost } from './community';
import { setBaseline, water } from './engine';
import { completeLesson } from './lessons';
import { logAction, logCustom } from './logging';
import {
  CSV_COLUMNS,
  MIGRATIONS,
  buildExport,
  checksumOf,
  exportFileName,
  loadState,
  logsToCsv,
  parseImport,
  parseStoredGame,
  serializeStoredGame,
  type Migration,
} from './persist';
import { validateState, withDefaults } from './schema';
import { createInitialState } from './state';
import { localTime, plantedSession } from './testkit';
import type { GameState } from './types';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);
const NOW = noon(20);

function playedState(): GameState {
  const session = plantedSession(noon(0));
  session.at(noon(0) + 1000, (ctx) =>
    setBaseline(ctx, {
      diet: 'medium-meat',
      transportMode: 'car-alone',
      weeklyDistance: '150-300',
      flights: 'short-1-2',
      homeEnergy: 'gas-typical',
      shopping: 'regular',
    }),
  );
  for (let offset = 0; offset < 12; offset += 1) {
    session.at(noon(offset) + 2000, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal', qty: 2 }),
    );
    session.at(noon(offset) + 6000, (ctx) =>
      logAction(ctx, { actionId: 'bus-instead-of-car', qty: 5 }),
    );
    if (offset % 3 === 0)
      session.at(noon(offset) + 9000, (ctx) => logAction(ctx, { actionId: 'standby-off' }));
  }
  session.at(noon(3), (ctx) => completeLesson(ctx, 'the-blanket', 3));
  session.at(noon(4), (ctx) =>
    addPost(ctx, { text: 'A note, "quoted", with a comma.', tag: 'win' }),
  );
  session.at(noon(5), (ctx) =>
    logCustom(ctx, { title: '=SUM(A1:A9)', category: 'nature', effort: 2, co2eKg: 0.4 }),
  );
  session.at(noon(14), water);
  return session.state;
}

describe('schema', () => {
  it('accepts a fresh state and a played one', () => {
    expect(validateState(createInitialState(NOW)).ok).toBe(true);
    expect(validateState(playedState()).ok).toBe(true);
  });

  it('survives a JSON round trip unchanged', () => {
    const state = playedState();
    const restored = JSON.parse(JSON.stringify(state)) as unknown;
    expect(restored).toEqual(state);
    expect(validateState(restored).ok).toBe(true);
  });

  it('names the first field that is wrong', () => {
    const state = playedState();
    const broken: [unknown, RegExp][] = [
      [{ ...state, xp: -5 }, /^xp:/],
      [{ ...state, xp: 12.5 }, /^xp:/],
      [{ ...state, profile: { ...state.profile, species: 'baobab' } }, /^profile\.species:/],
      [{ ...state, profile: { ...state.profile, focus: [] } }, /^profile\.focus:/],
      [{ ...state, profile: { ...state.profile, focus: ['eat', 'eat'] } }, /^profile\.focus:/],
      [
        { ...state, profile: { ...state.profile, treeName: 'x'.repeat(40) } },
        /^profile\.treeName:/,
      ],
      [{ ...state, rain: { ...state.rain, bank: 3 } }, /^rain\.bank:/],
      [{ ...state, logs: [{ ...state.logs[0], qty: 'lots' }] }, /^logs\[0\]\.qty:/],
      [{ ...state, logs: [{ ...state.logs[0], co2eKg: -1 }] }, /^logs\[0\]\.co2eKg:/],
      [{ ...state, marks: { 'not-a-day': 'ring' } }, /^marks key "not-a-day":/],
      [{ ...state, marks: { [MON]: 'gold' } }, /^marks\.2026-10-05:/],
      [{ ...state, clock: { today: '2026-02-31', lastEventTs: 0 } }, /^clock\.today:/],
      [
        {
          ...state,
          quests: {
            ...state.quests,
            daily: { key: MON, slots: ['a', 'b'], swapsUsed: 0, swapOffsets: [0, 0, 0] },
          },
        },
        /^quests\.daily\.slots:/,
      ],
      [{ ...state, settings: undefined }, /^settings:/],
      [null, /expected an object/],
      ['a string', /expected an object/],
      [[], /expected an object/],
    ];
    for (const [value, pattern] of broken) {
      const result = validateState(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(pattern);
    }
  });

  it('fills in fields an earlier build did not save', () => {
    const state = playedState();
    const { reactions: _reactions, notices: _notices, ...older } = state;
    const stripped = {
      ...older,
      seen: { messages: [], recapWeek: null, coachPrivacyNotice: false },
      days: Object.fromEntries(
        Object.entries(state.days).map(([key, { ringCelebrated: _a, ringRain: _b, ...record }]) => [
          key,
          record,
        ]),
      ),
      logs: state.logs.map(({ effort: _effort, ...log }) => log),
    };
    expect(validateState(stripped).ok).toBe(false);
    const filled = validateState(withDefaults(stripped));
    expect(filled.ok).toBe(true);
    if (!filled.ok) return;
    expect(filled.state.reactions).toEqual({});
    expect(filled.state.seen).toMatchObject({ maxLevel: 1, maxStage: 0, shareExports: 0 });
    const closed = Object.values(filled.state.days).filter((record) => record.ringClosed);
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.every((record) => record.ringCelebrated)).toBe(true);
  });
});

describe('loading a save', () => {
  it('round-trips the stored format', () => {
    const state = playedState();
    const loaded = parseStoredGame(serializeStoredGame(state));
    expect(loaded.ok && loaded.state).toEqual(state);
    expect(loaded.ok && loaded.migratedFrom).toBeNull();
  });

  it('reports why a save cannot be read', () => {
    const state = playedState();
    expect(parseStoredGame('{"state": {"xp": 1')).toMatchObject({
      ok: false,
      reason: 'not-json',
    });
    expect(parseStoredGame('[]')).toMatchObject({ ok: false, reason: 'not-a-save' });
    expect(parseStoredGame('{"version":1}')).toMatchObject({
      ok: false,
      reason: 'not-a-save',
    });
    expect(parseStoredGame(JSON.stringify({ state: { xp: 5 } }))).toMatchObject({
      ok: false,
      reason: 'not-a-save',
    });
    expect(parseStoredGame(JSON.stringify({ state, version: 7 }))).toMatchObject({
      ok: false,
      reason: 'newer-schema',
    });
    expect(
      parseStoredGame(JSON.stringify({ state: { ...state, xp: 'many' }, version: 1 })),
    ).toMatchObject({
      ok: false,
      reason: 'schema',
    });
    const cheated = { ...state, tree: { ...state.tree, rings: 999 } };
    const result = parseStoredGame(JSON.stringify({ state: cheated, version: 1 }));
    expect(result).toMatchObject({ ok: false, reason: 'invariants' });
    expect(!result.ok && result.detail).toMatch(/tree\.rings/);
  });

  it('re-bases celebration markers so a load never replays a level-up', () => {
    const state = playedState();
    const stale = { ...state, seen: { ...state.seen, maxLevel: 1, maxStage: 0 } };
    const loaded = loadState(JSON.parse(JSON.stringify(stale)), 1);
    expect(loaded.ok && loaded.state.seen.maxLevel).toBe(state.seen.maxLevel);
    expect(loaded.ok && loaded.state.seen.maxStage).toBe(state.seen.maxStage);
  });

  it('stamps a loaded save with this build’s content and factor versions', () => {
    const state = playedState();
    const old = { ...state, contentVersion: '2025.01', factorsVersion: '2025.01' };
    const loaded = loadState(JSON.parse(JSON.stringify(old)), 1);
    expect(loaded.ok && loaded.state.contentVersion).toBe(state.contentVersion);
    expect(loaded.ok && loaded.state.factorsVersion).toBe(state.factorsVersion);
    expect(loaded.ok && loaded.state.logs[0]?.factorsVersion).toBe(state.logs[0]?.factorsVersion);
  });

  it('walks an older save up through every migration, one version at a time', () => {
    expect(MIGRATIONS).toEqual({});
    const state = playedState();
    // A made-up older layout, to prove the pipeline: notes under `posts`, XP under `points`.
    const { journal, xp, ...rest } = state;
    const v0 = { ...rest, posts: journal, points: xp, schemaVersion: 0 };
    const order: number[] = [];
    const migrations: Record<number, Migration> = {
      0: ({ posts, ...old }) => {
        order.push(0);
        return { ...old, journal: posts };
      },
      1: ({ points, ...old }) => {
        order.push(1);
        return { ...old, xp: points, schemaVersion: 1 };
      },
    };
    const loaded = loadState(JSON.parse(JSON.stringify(v0)), 0, migrations, 2);
    expect(order).toEqual([0, 1]);
    expect(loaded.ok && loaded.state).toEqual(state);
    expect(loaded.ok && loaded.migratedFrom).toBe(0);
    expect(loadState(v0, 0, { 1: migrations[1] as Migration }, 2)).toMatchObject({
      ok: false,
      reason: 'schema',
    });
    expect(loadState(v0, 0)).toMatchObject({ ok: false, reason: 'schema' });
    expect(loadState(v0, -1)).toMatchObject({ ok: false, reason: 'not-a-save' });
  });
});

describe('export and import', () => {
  it('wraps the state in an envelope with a checksum', () => {
    const state = playedState();
    const envelope = buildExport(state, NOW);
    expect(envelope).toMatchObject({ app: 'ecoquest', coach: null, state });
    expect(envelope.exportedAt).toBe(new Date(NOW).toISOString());
    expect(envelope.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(envelope.checksum).toBe(checksumOf(state));
    expect(exportFileName(NOW)).toBe(`ecoquest-${day(20)}.json`);
    expect(exportFileName(NOW, 'csv')).toBe(`ecoquest-${day(20)}.csv`);
  });

  it('round-trips: export then import gives the same state', () => {
    const state = playedState();
    const text = JSON.stringify(
      buildExport(state, NOW, { coach: [{ role: 'user', content: 'hi' }] }),
      null,
      2,
    );
    const result = parseImport(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(state);
    expect(result.checksumMismatch).toBe(false);
    expect(result.coach).toEqual([{ role: 'user', content: 'hi' }]);
    expect(result.preview).toEqual({
      treeName: 'Fern',
      species: 'oak',
      rings: 13,
      logs: state.logs.length,
      firstLogDay: MON,
      lastLogDay: day(11),
      plantedDay: MON,
      exportedAt: new Date(NOW).toISOString(),
    });
  });

  it('warns about a file edited by hand but still reads it', () => {
    const state = playedState();
    const envelope = buildExport(state, NOW);
    const edited = {
      ...envelope,
      state: { ...state, profile: { ...state.profile, treeName: 'Edited' } },
    };
    const result = parseImport(JSON.stringify(edited));
    expect(result.ok && result.checksumMismatch).toBe(true);
    expect(result.ok && result.state.profile.treeName).toBe('Edited');
  });

  it('refuses with the specific reason and never trusts a broken file', () => {
    const state = playedState();
    const envelope = buildExport(state, NOW);
    expect(parseImport('not json at all')).toMatchObject({ ok: false, reason: 'not-json' });
    expect(parseImport('{"app":"someone-else","state":{}}')).toMatchObject({
      ok: false,
      reason: 'wrong-app',
    });
    expect(parseImport(JSON.stringify({ ...envelope, state: null }))).toMatchObject({
      ok: false,
      reason: 'wrong-app',
    });
    expect(
      parseImport(JSON.stringify({ ...envelope, state: { ...state, schemaVersion: 9 } })),
    ).toMatchObject({ ok: false, reason: 'newer-schema' });
    expect(
      parseImport(JSON.stringify({ ...envelope, state: { ...state, logs: 'none' } })),
    ).toMatchObject({
      ok: false,
      reason: 'schema',
    });
    const inflated = { ...state, tree: { ...state.tree, fullRings: 500 } };
    const result = parseImport(JSON.stringify({ ...envelope, state: inflated }));
    expect(result).toMatchObject({ ok: false, reason: 'invariants' });
    expect(!result.ok && result.message).toBe(
      'The numbers in this file do not add up, so it was not imported.',
    );
  });
});

describe('CSV of logs', () => {
  it('writes one row per log with the published columns', () => {
    const state = playedState();
    const lines = logsToCsv(state).split('\r\n');
    expect(lines[0]).toBe(
      'date,day,action_id,title,category,qty,unit,variant,co2e_kg,kg_low,kg_high,estimate,kind,xp,gp,source',
    );
    expect(CSV_COLUMNS).toHaveLength(16);
    expect(lines).toHaveLength(state.logs.length + 1);
    const first = lines[1]?.split(',') ?? [];
    expect(first.slice(1, 8)).toEqual([
      MON,
      'plant-based-meal',
      'Plant-based meal',
      'eat',
      '2',
      'meal',
      '',
    ]);
    expect(first[11]).toBe('factor');
    expect(first[12]).toBe('swap');
  });

  it('quotes awkward text and defuses spreadsheet formulas', () => {
    const state = playedState();
    const custom = logsToCsv(state)
      .split('\r\n')
      .find((line) => line.includes('custom'));
    expect(custom).toContain(",'=SUM(A1:A9),");
    const tricky = logsToCsv({
      logs: [{ ...(state.logs[0] as GameState['logs'][number]), title: 'Bus, then "train"\nhome' }],
    });
    expect(tricky).toContain('"Bus, then ""train""\nhome"');
    expect(logsToCsv({ logs: [] })).toBe(CSV_COLUMNS.join(','));
  });
});
