import { describe, expect, it } from 'vitest';
import { ACTION_BY_ID } from './catalogue';
import { DAILY_QUESTS, EPICS, WEEKLY_QUESTS, type ActionSet, type QuestCondition } from './quests';

function actionSets(condition: QuestCondition): ActionSet[] {
  switch (condition.kind) {
    case 'acts':
    case 'units':
      return [condition.actions];
    case 'days':
      return actionSets(condition.of);
    case 'all':
    case 'any':
      return condition.of.flatMap(actionSets);
    default:
      return [];
  }
}

function countBy<T extends { pool: string }>(quests: readonly T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const quest of quests) out[quest.pool] = (out[quest.pool] ?? 0) + 1;
  return out;
}

describe('quest pool', () => {
  it('has 32 dailies in the published pools', () => {
    expect(DAILY_QUESTS).toHaveLength(32);
    expect(countBy(DAILY_QUESTS)).toEqual({
      easy: 6,
      move: 4,
      eat: 4,
      power: 3,
      water: 3,
      stuff: 3,
      waste: 3,
      nature: 3,
      any: 3,
    });
    for (const quest of DAILY_QUESTS) expect([15, 20, 25]).toContain(quest.xp);
  });

  it('has 24 weeklies in the published pools', () => {
    expect(WEEKLY_QUESTS).toHaveLength(24);
    expect(countBy(WEEKLY_QUESTS)).toEqual({
      consistency: 5,
      move: 3,
      eat: 3,
      power: 2,
      water: 2,
      stuff: 2,
      waste: 3,
      nature: 3,
      any: 1,
    });
    for (const quest of WEEKLY_QUESTS) expect([60, 80, 100]).toContain(quest.xp);
  });

  it('has 12 epics worth 3,400 XP, 1,600 of it self-attested', () => {
    expect(EPICS).toHaveLength(12);
    expect(EPICS.reduce((sum, epic) => sum + epic.xp, 0)).toBe(3400);
    const attested = EPICS.filter((epic) => epic.attestation !== null);
    expect(attested).toHaveLength(6);
    expect(attested.reduce((sum, epic) => sum + epic.xp, 0)).toBe(1600);
  });

  it('uses unique ids with the right prefix', () => {
    const ids = [...DAILY_QUESTS, ...WEEKLY_QUESTS, ...EPICS].map((quest) => quest.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DAILY_QUESTS.every((quest) => quest.id.startsWith('d_'))).toBe(true);
    expect(WEEKLY_QUESTS.every((quest) => quest.id.startsWith('w_'))).toBe(true);
    expect(EPICS.every((epic) => epic.id.startsWith('e_'))).toBe(true);
  });

  it('only references actions that exist', () => {
    const sets = [
      ...[...DAILY_QUESTS, ...WEEKLY_QUESTS].flatMap((quest) => actionSets(quest.condition)),
      ...EPICS.flatMap((epic) =>
        epic.requirement && 'actions' in epic.requirement ? [epic.requirement.actions] : [],
      ),
    ];
    for (const set of sets) {
      if (set === '*') continue;
      expect(set.length).toBeGreaterThan(0);
      for (const id of set) expect(ACTION_BY_ID.has(id)).toBe(true);
    }
  });

  it('never asks anyone to buy something without a no-purchase alternative', () => {
    const purchase = new Set(['second-hand-tshirt', 'second-hand-jeans']);
    for (const quest of [...DAILY_QUESTS, ...WEEKLY_QUESTS]) {
      for (const set of actionSets(quest.condition)) {
        if (set === '*' || !set.some((id) => purchase.has(id))) continue;
        expect(set.some((id) => !purchase.has(id))).toBe(true);
      }
    }
  });
});
