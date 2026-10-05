import { describe, expect, it } from 'vitest';
import {
  GP_BY_ACT,
  GP_CHECK_IN,
  GP_DAILY_CAP,
  GP_RING_CLOSED,
  GP_SUNLIGHT,
  GROWTH_TABLE,
  STAGES,
  XP_CEREMONY,
  XP_CHECK_IN,
} from './economy';
import {
  growPulseStrength,
  growthInfo,
  growthOf,
  stageIndexOf,
  stageOf,
  stageProgress,
  stageProgressLabel,
} from './growth';
import { LEVEL_TABLE, levelInfo, levelOf, levelTitle, xpForLevel } from './levels';
import { vitalityAfterMissed, vitalityCopy, vitalityLabel, vitalityValue } from './vitality';

describe('levels', () => {
  it('reproduces the published table for levels 1 to 30', () => {
    const formula = (level: number) => Math.round((60 * Math.pow(level - 1, 1.8)) / 10) * 10;
    expect(LEVEL_TABLE).toHaveLength(30);
    for (let level = 1; level <= 30; level += 1) {
      expect(xpForLevel(level)).toBe(formula(level));
    }
    expect(xpForLevel(2)).toBe(60);
    expect(xpForLevel(5)).toBe(730);
    expect(xpForLevel(10)).toBe(3130);
    expect(xpForLevel(30)).toBe(25730);
  });

  it('continues with the formula above level 30', () => {
    expect(xpForLevel(31)).toBe(Math.round((60 * Math.pow(30, 1.8)) / 10) * 10);
    expect(xpForLevel(61)).toBeLessThanOrEqual(97090);
    expect(xpForLevel(62)).toBeGreaterThan(97090);
  });

  it('inverts the curve at every boundary, one XP either side', () => {
    for (let level = 2; level <= 80; level += 1) {
      const threshold = xpForLevel(level);
      expect(levelOf(threshold)).toBe(level);
      expect(levelOf(threshold - 1)).toBe(level - 1);
      expect(levelOf(threshold + 1)).toBe(level);
    }
    expect(levelOf(0)).toBe(1);
    expect(levelOf(-50)).toBe(1);
    expect(levelOf(27947)).toBe(31);
    expect(levelOf(97090)).toBe(61);
  });

  it('guarantees level 2 on the first log', () => {
    const firstSession = XP_CEREMONY + XP_CHECK_IN;
    expect(levelOf(firstSession)).toBe(1);
    expect(levelOf(firstSession + 8 + 20)).toBe(2);
  });

  it('names the player by level band and adds stars from level 40', () => {
    expect(levelTitle(1)).toBe('Seed Sower');
    expect(levelTitle(4)).toBe('Seed Sower');
    expect(levelTitle(5)).toBe('Sprout Scout');
    expect(levelTitle(10)).toBe('Grove Tender');
    expect(levelTitle(15)).toBe('Canopy Keeper');
    expect(levelTitle(20)).toBe('Forest Guardian');
    expect(levelTitle(25)).toBe('Wildwood Warden');
    expect(levelTitle(30)).toBe('Grove Elder');
    expect(levelTitle(39)).toBe('Grove Elder');
    expect(levelTitle(40)).toBe('Grove Elder ★');
    expect(levelTitle(50)).toBe('Grove Elder ★★');
  });

  it('describes progress through the current level', () => {
    const info = levelInfo(910);
    expect(info).toMatchObject({
      level: 5,
      title: 'Sprout Scout',
      levelStartXp: 730,
      nextLevelXp: 1090,
      xpIntoLevel: 180,
      xpToNext: 180,
    });
    expect(info.progress).toBeCloseTo(0.5, 10);
    expect(levelInfo(-5).xp).toBe(0);
  });
});

describe('growth', () => {
  it('hits every anchor of the table exactly', () => {
    for (const [gp, growth] of GROWTH_TABLE) expect(growthOf(gp)).toBeCloseTo(growth, 12);
  });

  it('is strictly increasing and never reaches 1', () => {
    let previous = -1;
    for (let gp = 0; gp <= 40000; gp += 7) {
      const value = growthOf(gp);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    for (const gp of [1e5, 1e6, 1e7]) {
      expect(growthOf(gp)).toBeLessThan(1);
      expect(growthOf(gp)).toBeGreaterThan(previous);
      previous = growthOf(gp);
    }
    expect(growthOf(36000)).toBeCloseTo(0.98, 10);
    expect(growthOf(-10)).toBe(0);
  });

  it('caps a day at 30 growth points, the sum of its sources', () => {
    const sum = GP_CHECK_IN + GP_BY_ACT.reduce((a, b) => a + b, 0) + GP_RING_CLOSED + GP_SUNLIGHT;
    expect(sum).toBe(GP_DAILY_CAP);
  });

  it('can never reach Seedling on day one', () => {
    expect(GP_DAILY_CAP).toBeLessThan(32);
    expect(stageOf(GP_DAILY_CAP)).toBe('Sprout');
    expect(stageOf(24 + GP_CHECK_IN)).toBe('Seedling');
    expect(growthOf(8)).toBeCloseTo(0.03, 12);
    expect(growthOf(13)).toBeCloseTo(0.0383, 4);
  });

  it('makes the first act of a day visible until the tree is young', () => {
    for (let gp = 8; gp + GP_BY_ACT[0] <= 600; gp += 1) {
      expect(growthOf(gp + GP_BY_ACT[0]) - growthOf(gp)).toBeGreaterThanOrEqual(0.002);
    }
  });

  it('names stages at their thresholds', () => {
    for (const [name, min] of STAGES) {
      expect(stageOf(min)).toBe(name);
      if (min > 0) expect(stageOf(min - 1)).not.toBe(name);
    }
    expect(stageIndexOf(0)).toBe(0);
    expect(stageIndexOf(1e9)).toBe(STAGES.length - 1);
  });

  it('measures progress through a stage', () => {
    expect(stageProgress(150)).toBe(0);
    expect(stageProgress(375)).toBeCloseTo(0.5, 10);
    expect(stageProgress(18000)).toBe(0);
    expect(stageProgress(36000)).toBeCloseTo(0.5, 10);
    expect(stageProgress(1e9)).toBeLessThan(1);
    const info = growthInfo(169);
    expect(info).toMatchObject({ stage: 'Sapling', nextStage: 'Young tree', gpToNextStage: 431 });
    expect(growthInfo(20000).nextStage).toBeNull();
    expect(stageProgressLabel(344)).toBe('Sapling → Young tree 43.1%');
    expect(stageProgressLabel(20000)).toMatch(/^Ancient \d+\.\d%$/);
  });

  it('scales the grow pulse between 0.2 and 1', () => {
    expect(growPulseStrength(0)).toBe(0.2);
    expect(growPulseStrength(3)).toBeCloseTo(0.6, 10);
    expect(growPulseStrength(12)).toBe(1);
  });
});

describe('vitality', () => {
  it('maps missed days to the values the world draws', () => {
    expect(vitalityValue('thriving', 0)).toBe(1);
    expect([1, 2, 3, 4, 5, 6].map((missed) => vitalityValue('thirsty', missed))).toEqual([
      0.7, 0.62, 0.54, 0.46, 0.38, 0.3,
    ]);
    expect(vitalityValue('dormant', 7)).toBe(0);
    expect(vitalityValue('dormant', 40)).toBe(0);
    expect(vitalityValue('waking', 0)).toBe(0.6);
  });

  it('derives the state from consecutive missed days', () => {
    expect(vitalityAfterMissed(0)).toBe('thriving');
    expect(vitalityAfterMissed(1)).toBe('thirsty');
    expect(vitalityAfterMissed(6)).toBe('thirsty');
    expect(vitalityAfterMissed(7)).toBe('dormant');
  });

  it('never uses the words the product bans', () => {
    const banned = /died|dead|lost|failed|broke/i;
    for (const state of ['thriving', 'thirsty', 'dormant', 'waking'] as const) {
      expect(vitalityCopy(state, 'Fern', true)).not.toMatch(banned);
      expect(vitalityCopy(state, 'Fern', false)).not.toMatch(banned);
      expect(vitalityLabel(state)).not.toMatch(banned);
    }
    expect(vitalityCopy('thriving', 'Fern', false)).toBe('Fern could use a drink.');
    expect(vitalityCopy('thriving', 'Fern', true)).toBe('Fern is thriving.');
  });
});
