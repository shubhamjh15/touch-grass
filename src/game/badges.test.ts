import { describe, expect, it } from 'vitest';
import { BADGES, BADGE_BY_ID, type PROP_UNLOCK } from '@/data/badges';
import { CATEGORY_IDS } from '@/data/catalogue';
import { addDays } from '@/lib/dates';
import { ISLAND_PROPS, type IslandPropId } from '@/world/contract';
import {
  allBadgeStatuses,
  badgeMetric,
  badgeStatus,
  forceBadge,
  tierFor,
  unlockedProps,
} from './badges';
import { recordShareExport, setBaseline, water } from './engine';
import { flipMyth } from './lessons';
import { logAction, removeLog } from './logging';
import { GameSession, localTime, plantedSession } from './testkit';
import type { GameState } from './types';

const MON = '2026-10-05';
const day = (offset: number) => addDays(MON, offset);
const noon = (offset: number) => localTime(day(offset), 12);

const statusOf = (state: GameState, id: string) => badgeStatus(state, BADGE_BY_ID.get(id)!);

/** Type-level check: PROP_UNLOCK has exactly the contract's keys. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const propKeysMatch: Exact<keyof typeof PROP_UNLOCK, IslandPropId> = true;

describe('island props', () => {
  it('covers exactly the contract and returns contract order', () => {
    expect(propKeysMatch).toBe(true);
    const everything: GameState['badges'] = Object.fromEntries(
      BADGES.map((badge) => [badge.id, { tier: badge.thresholds.length as 1 | 2 | 3, earned: [] }]),
    );
    expect(unlockedProps(everything)).toEqual([...ISLAND_PROPS]);
    expect(unlockedProps({})).toEqual([]);
    const some: GameState['badges'] = {
      'bin-boss': { tier: 2, earned: [] },
      'first-leaf': { tier: 1, earned: [] },
      'ring-collector': { tier: 1, earned: [] },
      'watt-watcher': { tier: 1, earned: [] },
    };
    expect(unlockedProps(some)).toEqual(['flowers', 'mushrooms', 'solar', 'compost', 'birdhouse']);
    for (const prop of unlockedProps(some)) expect(ISLAND_PROPS).toContain(prop);
  });

  it('delivers flowers on the first act and the birdhouse at seven rings', () => {
    const session = plantedSession(noon(0));
    expect(unlockedProps(session.state.badges)).toEqual([]);
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal' }));
    expect(session.eventsOf('badge-unlocked')[0]).toMatchObject({
      badgeId: 'first-leaf',
      tier: 1,
      xp: 20,
      prop: 'flowers',
    });
    expect(session.state.activity.map((entry) => entry.text)).toContain(
      'Day 1 · The first flowers opened beside Fern.',
    );
    for (let offset = 1; offset <= 6; offset += 1) session.at(noon(offset), water);
    const props = unlockedProps(session.state.badges);
    expect(props).toEqual(['flowers', 'birdhouse', 'fireflies']);
    expect(
      session
        .eventsOf('badge-unlocked')
        .map((event) => event.prop)
        .sort(),
    ).toEqual(['birdhouse', 'fireflies']);
  });
});

describe('badge progress', () => {
  it('counts rewarded acts per category and unlocks tiers in order', () => {
    const session = plantedSession(noon(0));
    for (let offset = 0; offset < 4; offset += 1) {
      session.at(noon(offset) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }),
      );
    }
    expect(badgeMetric(session.state, 'acts:eat')).toBe(12);
    expect(statusOf(session.state, 'plant-plate')).toMatchObject({
      tier: 1,
      maxTier: 3,
      nextThreshold: 50,
      progressText: '12 / 50 acts',
      props: ['veggie-patch'],
    });
    expect(statusOf(session.state, 'plant-plate').progress).toBeCloseTo(2 / 40, 10);
    expect(statusOf(session.state, 'trailblazer')).toMatchObject({
      tier: 0,
      progressText: '0 / 10 acts',
    });
    expect(session.state.badges['plant-plate']?.earned).toHaveLength(1);
  });

  it('awards several tiers at once when a count jumps', () => {
    const session = plantedSession(noon(0));
    session.state = { ...session.state, tree: { ...session.state.tree, rings: 31 } };
    session.tick(noon(0) + 1000);
    expect(session.state.badges['ring-collector']).toMatchObject({ tier: 2 });
    expect(
      session.eventsOf('badge-unlocked').map((event) => [event.tier, event.xp, event.prop]),
    ).toEqual([
      [1, 20, 'birdhouse'],
      [2, 40, 'birds'],
    ]);
  });

  it('never revokes a badge when an undo drops the count', () => {
    const session = plantedSession(noon(0));
    const result = session.at(noon(0) + 1000, (ctx) =>
      logAction(ctx, { actionId: 'plant-based-meal' }),
    );
    if (!result.ok) throw new Error('refused');
    session.at(noon(0) + 2000, (ctx) => removeLog(ctx, result.log.id));
    expect(badgeMetric(session.state, 'rewarded-acts')).toBe(0);
    expect(statusOf(session.state, 'first-leaf').tier).toBe(1);
    expect(unlockedProps(session.state.badges)).toEqual(['flowers']);
  });

  it('counts Kept Out from sourced factors only', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'second-hand-jeans' }));
    expect(badgeMetric(session.state, 'factor-kg')).toBeCloseTo(12.9, 10);
    expect(statusOf(session.state, 'kept-out')).toMatchObject({
      tier: 1,
      progressText: '12.9 / 100 kg',
    });
    expect(tierFor(BADGE_BY_ID.get('kept-out')!, 9.9999999999)).toBe(1);
    expect(tierFor(BADGE_BY_ID.get('kept-out')!, 9.9)).toBe(0);
  });

  it('awards the single badges for their events', () => {
    const session = plantedSession(noon(0));
    session.at(noon(0) + 1000, (ctx) =>
      setBaseline(ctx, {
        diet: 'low-meat',
        transportMode: 'bus',
        weeklyDistance: '25-75',
        flights: 'none',
        homeEnergy: 'electric-typical',
        shopping: 'modest',
      }),
    );
    expect(session.state.badges.rooted?.tier).toBe(1);
    session.at(noon(0) + 2000, recordShareExport);
    expect(session.state.badges['show-and-tell']?.tier).toBe(1);
    for (let myth = 1; myth <= 10; myth += 1)
      session.at(noon(0) + 3000 + myth, (ctx) => flipMyth(ctx, myth));
    expect(session.state.badges['myth-buster']?.tier).toBe(1);
    const acts = [
      'walk-cycle-instead-of-car',
      'plant-based-meal',
      'standby-off',
      'tap-off-while-brushing',
      'pass-it-on',
      'compost-food-waste',
      'litter-pick',
    ];
    acts.forEach((actionId, index) =>
      session.at(noon(0) + 10_000 + index * 3000, (ctx) => logAction(ctx, { actionId })),
    );
    expect(badgeMetric(session.state, 'categories-tried')).toBe(CATEGORY_IDS.length);
    expect(session.state.badges['well-rounded']?.tier).toBe(1);
    expect(session.state.badges.polymath?.tier).toBe(1);
    expect(unlockedProps(session.state.badges)).toContain('butterflies');
  });

  it('awards the secret badges', () => {
    const night = plantedSession(localTime(MON, 1, 30));
    night.at(localTime(MON, 2, 0), (ctx) => logAction(ctx, { actionId: 'tap-off-while-brushing' }));
    expect(night.state.badges['night-owl']?.tier).toBe(1);
    expect(
      night.eventsOf('badge-unlocked').find((event) => event.badgeId === 'night-owl'),
    ).toMatchObject({
      secret: true,
      xp: 50,
    });

    const dawn = plantedSession(localTime(MON, 5, 30));
    dawn.at(localTime(day(1), 5, 59), water);
    expect(dawn.state.badges['dawn-chorus']).toBeUndefined();
    dawn.at(localTime(day(2), 6, 0), water);
    expect(dawn.state.badges['dawn-chorus']).toBeUndefined();
    dawn.at(localTime(day(3), 4, 0), water);
    expect(dawn.state.badges['dawn-chorus']?.tier).toBe(1);

    const rain = plantedSession(noon(0));
    rain.at(noon(2), (ctx) => logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }));
    expect(rain.state.days[day(2)]).toMatchObject({ returnedFrom: 'rain', ringClosed: true });
    expect(rain.state.badges['rain-dancer']?.tier).toBe(1);

    const earth = plantedSession(localTime('2027-04-22', 12));
    earth.at(localTime('2027-04-22', 13), (ctx) => logAction(ctx, { actionId: 'litter-pick' }));
    expect(earth.state.badges['earth-day']?.tier).toBe(1);

    const week = plantedSession(noon(0));
    for (let offset = 0; offset < 7; offset += 1) {
      week.at(noon(offset) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }),
      );
    }
    expect(week.state.badges['perfect-week']?.tier).toBe(1);
    const offset = plantedSession(noon(2));
    for (let index = 2; index < 9; index += 1) {
      offset.at(noon(index) + 1000, (ctx) =>
        logAction(ctx, { actionId: 'plant-based-meal', qty: 3 }),
      );
    }
    expect(offset.state.badges['perfect-week']).toBeUndefined();
  });

  it('hides a locked secret behind its riddle', () => {
    const session = plantedSession(noon(0));
    expect(statusOf(session.state, 'night-owl')).toMatchObject({
      hidden: true,
      progressText: 'Some things only happen after midnight.',
    });
    session.at(noon(0) + 1000, (ctx) => forceBadge(ctx, 'night-owl'));
    expect(statusOf(session.state, 'night-owl')).toMatchObject({ hidden: false, tier: 1 });
    expect(session.at(noon(0) + 2000, (ctx) => forceBadge(ctx, 'nope'))).toBe(false);
    expect(session.at(noon(0) + 2000, (ctx) => forceBadge(ctx, 'night-owl', 2))).toBe(false);
  });

  it('lists all 33 with every tier reachable', () => {
    const session = plantedSession(noon(0));
    const statuses = allBadgeStatuses(session.state);
    expect(statuses).toHaveLength(33);
    for (const status of statuses) {
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(1);
      expect(status.progressText.length).toBeGreaterThan(0);
    }
  });

  it('respects the harness filter', () => {
    const session = new GameSession(plantedSession(noon(0)).state, {
      badgeFilter: (id) => id !== 'first-leaf',
    });
    session.at(noon(0) + 1000, (ctx) => logAction(ctx, { actionId: 'plant-based-meal' }));
    expect(session.state.badges['first-leaf']).toBeUndefined();
  });
});
