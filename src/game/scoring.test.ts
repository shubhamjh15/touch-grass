import { describe, expect, it } from 'vitest';
import { ACTIONS, GROUPS } from '@/data/catalogue';
import { createRng, randomInt } from '@/lib/rng';
import { DAILY_GOAL, GP_BY_ACT, HALF_XP_ACTS, LOG_XP_DAILY_CAP } from './economy';
import {
  actsOf,
  customXp,
  previewLog,
  scoreDay,
  scoringRuleFor,
  type ScorableLog,
} from './scoring';

const log = (actionId: string, qty = 1, effort?: 1 | 2 | 3 | 4): ScorableLog => ({
  actionId,
  qty,
  effort,
});

describe('scoreDay', () => {
  it('counts acts, not log entries', () => {
    expect(actsOf(scoringRuleFor(log('plant-based-meal')), 3)).toBe(3);
    expect(actsOf(scoringRuleFor(log('walk-cycle-instead-of-car')), 40)).toBe(1);
    expect(actsOf(scoringRuleFor(log('vegan-day')), 1)).toBe(3);
    expect(actsOf(scoringRuleFor(log('plant-milk-instead-of-dairy')), 0.2)).toBe(1);
  });

  it('pays flat XP per act whatever the quantity', () => {
    const short = scoreDay([log('walk-cycle-instead-of-car', 4)]);
    const long = scoreDay([log('walk-cycle-instead-of-car', 40)]);
    expect(short.logXp).toBe(15);
    expect(long.logXp).toBe(15);
    expect(long.logGp).toBe(5);
  });

  it('never pays more for a split log than for one log', () => {
    const whole = scoreDay([log('plant-based-meal', 3)]);
    const split = scoreDay([
      log('plant-based-meal'),
      log('plant-based-meal'),
      log('plant-based-meal'),
    ]);
    expect(split.logXp).toBe(whole.logXp);
    expect(split.logGp).toBe(whole.logGp);
    expect(split.rewardedActs).toBe(whole.rewardedActs);
    expect(whole).toMatchObject({ rewardedActs: 3, logXp: 45, logGp: 12, ringClosed: true });

    const kmWhole = scoreDay([log('walk-cycle-instead-of-car', 10)]);
    const kmSplit = scoreDay(Array.from({ length: 10 }, () => log('walk-cycle-instead-of-car')));
    expect(kmSplit.logXp).toBeGreaterThanOrEqual(kmWhole.logXp);
    expect(kmSplit.rewardedActs).toBe(2);
    expect(kmSplit.logXp).toBe(30);
  });

  it('gives growth points 5, 4, 3, 2, 1, 1 and then nothing', () => {
    const logs = [
      log('walk-cycle-instead-of-car'),
      log('plant-based-meal', 3),
      log('shorter-shower'),
      log('wash-cold-instead-of-40'),
      log('standby-off'),
      log('refuse-single-use-bottle', 2),
      log('tap-off-while-brushing'),
    ];
    const score = scoreDay(logs);
    expect(score.logs.map((entry) => entry.gp)).toEqual([5, 9, 1, 1, 0, 0, 0]);
    expect(score.logGp).toBe(GP_BY_ACT.reduce((a, b) => a + b, 0));
    expect(score.rewardedActs).toBe(10);
    expect(score.logs.map((entry) => entry.xp)).toEqual([15, 45, 12, 12, 4, 8, 4]);
    expect(score.logXp).toBe(100);
  });

  it('pays half from act 7 and nothing from act 13', () => {
    const logs = [
      log('plant-based-meal', 3),
      log('refuse-single-use-bottle', 3),
      log('walk-cycle-instead-of-car'),
      log('walk-cycle-instead-of-car'),
      log('line-dry-instead-of-tumble', 2),
      log('second-hand-tshirt', 2),
      log('standby-off'),
      log('litter-pick'),
    ];
    const score = scoreDay(logs);
    expect(score.rewardedActs).toBe(HALF_XP_ACTS);
    expect(score.logs[2]?.xp).toBe(7);
    expect(score.logs[3]?.xp).toBe(7);
    expect(score.logs[4]?.xp).toBe(12);
    expect(score.logs[5]?.xp).toBe(18);
    expect(score.logs[6]).toEqual({ rewardedActs: 0, xp: 0, gp: 0 });
    expect(score.logs[7]).toEqual({ rewardedActs: 0, xp: 0, gp: 0 });
  });

  it('holds every group cap', () => {
    const plate = scoreDay([
      log('plant-based-meal', 2),
      log('plant-based-instead-of-beef', 2),
      log('chicken-instead-of-beef'),
    ]);
    expect(plate.logs.map((entry) => entry.rewardedActs)).toEqual([2, 1, 0]);
    expect(plate.usedByGroup.plate).toBe(3);

    const recycling = scoreDay([
      log('recycle-aluminium-can', 6),
      log('recycle-glass-bottle', 2),
      log('recycle-plastic-bottle', 2),
      log('recycle-paper', 1),
    ]);
    expect(recycling.logs.map((entry) => entry.rewardedActs)).toEqual([1, 1, 0, 0]);

    for (const group of GROUPS) {
      if (group.actions.length === 0) continue;
      const flood = group.actions.flatMap((id) => Array.from({ length: 6 }, () => log(id, 3)));
      expect(scoreDay(flood).usedByGroup[group.id]).toBeLessThanOrEqual(group.maxActs);
    }
  });

  it('holds every per-action cap', () => {
    for (const action of ACTIONS) {
      const score = scoreDay(Array.from({ length: 8 }, () => log(action.id, action.dailyCap)));
      expect(score.usedByAction[action.id]).toBeLessThanOrEqual(action.maxActs);
    }
  });

  it('caps custom actions at two a day with XP by effort', () => {
    expect([1, 2, 3, 4].map((effort) => customXp(effort as 1 | 2 | 3 | 4))).toEqual([
      8, 10, 12, 15,
    ]);
    const score = scoreDay([log('custom', 1, 4), log('custom', 1, 1), log('custom', 1, 4)]);
    expect(score.logs.map((entry) => entry.xp)).toEqual([15, 8, 0]);
    expect(score.usedByGroup.custom).toBe(2);
    expect(scoreDay([log('no-such-action', 1)]).logs[0]?.xp).toBe(10);
  });

  it('never exceeds the daily log XP cap, whatever is thrown at it', () => {
    const rng = createRng('scoring-fuzz');
    for (let round = 0; round < 300; round += 1) {
      const logs = Array.from({ length: randomInt(rng, 1, 40) }, () => {
        const action = ACTIONS[randomInt(rng, 0, ACTIONS.length - 1)];
        return log(action?.id ?? 'custom', randomInt(rng, 1, 5));
      });
      const score = scoreDay(logs);
      expect(score.logXp).toBeLessThanOrEqual(LOG_XP_DAILY_CAP);
      expect(score.rewardedActs).toBeLessThanOrEqual(HALF_XP_ACTS);
      expect(score.logGp).toBeLessThanOrEqual(16);
      expect(score.ringClosed).toBe(score.rewardedActs >= DAILY_GOAL);
      expect(score.logs.reduce((sum, entry) => sum + entry.xp, 0)).toBe(score.logXp);
    }
  });

  it('reaches the theoretical maximum without passing 150', () => {
    const best = scoreDay([
      log('train-instead-of-short-flight-km', 500),
      log('keep-phone-one-more-year'),
      log('habitat-volunteering'),
      log('civic-action'),
      log('repair-instead-of-replace', 2),
      log('plant-a-tree'),
      log('second-hand-tshirt', 2),
      log('thermostat-down-1c'),
      log('plant-based-meal', 2),
    ]);
    expect(best.logXp).toBe(LOG_XP_DAILY_CAP);
  });

  it('previews what one more log would earn', () => {
    const day = [log('plant-based-meal', 2)];
    expect(previewLog(day, log('plant-based-meal', 2))).toEqual({ rewardedActs: 1, xp: 15, gp: 3 });
    expect(previewLog(day, log('vegan-day'))).toEqual({ rewardedActs: 1, xp: 15, gp: 3 });
    expect(previewLog([], log('vegetarian-day'))).toEqual({ rewardedActs: 3, xp: 36, gp: 12 });
  });
});
