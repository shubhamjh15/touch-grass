import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  buildExport,
  checkInvariants,
  growthInfo,
  parseImport,
  selectImpact,
  selectQuests,
  selectStreak,
  selectTreeStatus,
  selectWorldSnapshot,
  validateState,
  type GameState,
} from '@/game';
import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import { ISLAND_PROPS } from '@/world';
import { DEMO_DAYS, DEMO_TREE_NAME, buildDemoState, playDemoWorld } from './demoWorld';

/** A local wall-clock moment on a fixed day, so the suite does not depend on when it runs. */
function at(day: string, hour: number, minute = 0, second = 0): number {
  const date = parseDayKey(day);
  date.setHours(hour, minute, second, 0);
  return date.getTime();
}

// Growing the world plays two hundred days through the engine: seconds, on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DAY = '2026-10-06';
const NOW = at(DAY, 18, 20);

describe('the demo world', () => {
  let state: GameState;
  beforeAll(() => {
    state = buildDemoState(NOW);
  });

  it('is a state the game itself accepts', () => {
    expect(checkInvariants(state)).toEqual([]);
    // What the sandbox saves must load again through the app's own validation.
    expect(validateState(JSON.parse(JSON.stringify(state))).ok).toBe(true);
  });

  it('ends today: planted two hundred days ago, opened a moment ago, nothing in the future', () => {
    expect(state.clock.today).toBe(DAY);
    expect(state.profile.plantedDay).toBe(addDays(DAY, -(DEMO_DAYS - 1)));
    expect(dayKey(state.clock.lastEventTs)).toBe(DAY);
    expect(state.clock.lastEventTs).toBeLessThanOrEqual(NOW);
    for (const log of state.logs) expect(log.ts).toBeLessThanOrEqual(NOW);
    const newest = state.logs[state.logs.length - 1];
    expect(newest?.day).toBe(DAY);
  });

  it('is rich: a mature tree, most of the island, a long log, a long streak', () => {
    const world = selectWorldSnapshot(state, NOW);
    expect(growthInfo(state.tree.gp).stage).toBe('Mature tree');
    expect(world.props.length).toBeGreaterThanOrEqual(Math.ceil(ISLAND_PROPS.length * 0.6));
    expect(state.logs.length).toBeGreaterThan(400);
    expect(state.tree.vitality).toBe('thriving');
    expect(selectStreak(state, NOW).current).toBeGreaterThanOrEqual(60);
    expect(state.journal.length).toBeGreaterThan(5);
    expect(state.baseline).not.toBeNull();
  });

  it('leaves today open: watered, two things logged, one more closes the ring', () => {
    const tree = selectTreeStatus(state, NOW);
    expect(tree.ringClosedToday).toBe(false);
    expect(tree.actsToRing).toBe(1);
    expect(state.logs.filter((log) => log.day === DAY)).toHaveLength(2);
  });

  it('has quests in progress and something to claim', () => {
    const board = selectQuests(state, NOW);
    const open = [...board.daily, ...board.weekly].filter((quest) => !quest.claimed);
    expect(open.length).toBeGreaterThanOrEqual(4);
    expect(open.some((quest) => quest.ratio > 0 && quest.ratio < 1)).toBe(true);
    expect(board.claimableCount).toBeGreaterThanOrEqual(1);
    expect(board.epics.some((epic) => epic.claimed)).toBe(true);
    expect(board.epics.some((epic) => !epic.claimed)).toBe(true);
  });

  it('invents nobody: one unnamed gardener, a tree, and totals that are sums of its own log', () => {
    expect(state.profile.name).toBe('Friend');
    expect(state.profile.treeName).toBe(DEMO_TREE_NAME);
    expect(state.challenge.active).toBeNull();
    const fromLogs = state.logs.reduce(
      (sum, log) => sum + (log.estimate === 'factor' ? (log.co2eKg ?? 0) : 0),
      0,
    );
    expect(selectImpact(state, NOW).kg).toBeCloseTo(fromLogs, 6);
    // Every estimate is the catalogue's own: nothing typed in, nothing from an AI.
    expect(state.logs.every((log) => log.estimate !== 'ai')).toBe(true);
  });

  it('grows the same world for the same moment', () => {
    expect(buildDemoState(NOW)).toEqual(state);
  });

  it('can be exported and imported like any real save', () => {
    const result = parseImport(JSON.stringify(buildExport(state, NOW)));
    expect(result.ok).toBe(true);
  });
});

describe('the demo world at the edges of a day', () => {
  it.each([
    ['half a minute after midnight', at(DAY, 0, 0, 30)],
    ['a minute before midnight', at(DAY, 23, 59)],
  ])('ends today %s', (_label, now) => {
    const state = buildDemoState(now);
    expect(checkInvariants(state)).toEqual([]);
    expect(state.clock.today).toBe(DAY);
    const todays = state.logs.filter((log) => log.day === DAY);
    expect(todays).toHaveLength(2);
    for (const log of state.logs) expect(log.ts).toBeLessThanOrEqual(now);
    expect(selectTreeStatus(state, now).actsToRing).toBe(1);
  });

  it('reports its progress one day at a time and finishes on the last', () => {
    const play = playDemoWorld(NOW);
    let last = 0;
    for (;;) {
      const step = play.next();
      if (step.done) break;
      expect(step.value.days).toBe(DEMO_DAYS);
      expect(step.value.day).toBeGreaterThanOrEqual(last);
      last = step.value.day;
    }
    expect(last).toBe(DEMO_DAYS);
  });
});
