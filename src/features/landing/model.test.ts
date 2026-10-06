import { describe, expect, it } from 'vitest';
import { ACTION_BY_ID } from '@/data/catalogue';
import { STAGES, growthOf } from '@/game';
import {
  DEMO_ACTIONS,
  DEMO_TAPS_TO_SAPLING,
  demoEstimate,
  demoGrowth,
  demoStatus,
  stageAtGrowth,
  type DemoAction,
} from './model';

describe('demo actions', () => {
  it('are real catalogue actions with a creditable factor', () => {
    for (const demo of DEMO_ACTIONS) {
      const action = ACTION_BY_ID.get(demo.actionId);
      expect(action, demo.actionId).toBeDefined();
      expect(action?.credit).toBe('log');
      expect(action?.category).toBe(demo.category);
      expect(demo.qty).toBeLessThanOrEqual(action?.dailyCap ?? 0);
    }
  });

  it('show the figures the product spec promises, from the factor table', () => {
    const text = DEMO_ACTIONS.map((demo) => demoEstimate(demo)?.text);
    expect(text).toEqual(['1.5 kg', '1 kg', '100 g']);
  });

  it('explain each figure: formula, comparison, range, source and a methodology anchor', () => {
    for (const demo of DEMO_ACTIONS) {
      const estimate = demoEstimate(demo);
      expect(estimate).not.toBeNull();
      if (!estimate) continue;
      expect(estimate.source.kind).toBe('factor');
      expect(estimate.source.formula).toContain(estimate.text);
      expect(estimate.source.comparedWith).toContain(estimate.comparedWith);
      expect(estimate.source.range).toMatch(/ to /);
      expect(estimate.source.sourceLabel.length).toBeGreaterThan(3);
      expect(estimate.source.href).toBe(`/methodology#action-${demo.actionId}`);
    }
  });

  it('never claims more than the published high value', () => {
    for (const demo of DEMO_ACTIONS) {
      const action = ACTION_BY_ID.get(demo.actionId);
      const estimate = demoEstimate(demo);
      expect(estimate?.kg ?? 0).toBeLessThanOrEqual((action?.factor?.high ?? 0) * demo.qty);
    }
  });

  it('returns nothing rather than a made-up number for an unknown action', () => {
    const ghost: DemoAction = {
      id: 'biked-5-km',
      actionId: 'not-in-the-catalogue',
      qty: 5,
      label: 'Ghost',
      category: 'move',
    };
    expect(demoEstimate(ghost)).toBeNull();
  });
});

describe('demo growth', () => {
  it('starts as a Seedling and is a Sapling after exactly five stickers', () => {
    expect(demoStatus(0).stage).toBe('Seedling');
    expect(demoStatus(DEMO_TAPS_TO_SAPLING - 1).stage).toBe('Seedling');
    expect(demoStatus(DEMO_TAPS_TO_SAPLING).stage).toBe('Sapling');
    expect(demoStatus(7).stage).toBe('Sapling');
  });

  it('grows with every sticker and never reaches a Young tree', () => {
    let previous = demoGrowth(0);
    for (let taps = 1; taps <= 60; taps += 1) {
      const growth = demoGrowth(taps);
      expect(growth).toBeGreaterThan(previous);
      previous = growth;
    }
    expect(stageAtGrowth(demoGrowth(5000))).toBe('Sapling');
  });

  it('treats nonsense tap counts as none', () => {
    expect(demoGrowth(-3)).toBe(demoGrowth(0));
    expect(demoGrowth(2.9)).toBe(demoGrowth(2));
  });
});

describe('stageAtGrowth', () => {
  it('agrees with the stage table of the engine at and just below every threshold', () => {
    STAGES.forEach(([name, gp], index) => {
      expect(stageAtGrowth(growthOf(gp))).toBe(name);
      const before = STAGES[index - 1];
      if (before) expect(stageAtGrowth(growthOf(gp) - 1e-4)).toBe(before[0]);
    });
  });
});
