import { describe, expect, it } from 'vitest';
import { ACTION_BY_ID } from '@/data/catalogue';
import { STAGES, growthOf } from '@/game';
import {
  DEMO_ACTIONS,
  DEMO_TAPS_TO_SAPLING,
  TIMELAPSE_FRAMES,
  TIMELAPSE_STEPS,
  TYPICAL_PACE,
  demoEstimate,
  demoGrowth,
  demoStatus,
  gpAtGrowth,
  listProgress,
  pinnedProgress,
  stageAtGrowth,
  timelapseAt,
  timelapseEngaged,
  type DemoAction,
  type TimelapseFrame,
} from './model';

const frameAt = (index: number): TimelapseFrame => {
  const frame = TIMELAPSE_FRAMES[index];
  if (!frame) throw new Error(`no time-lapse frame ${index}`);
  return frame;
};

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
    expect(demoStatus(0).tapsToSapling).toBe(5);
    expect(demoStatus(7).tapsToSapling).toBe(0);
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

describe('time-lapse frames', () => {
  it('are eight moments in order, named with real stage names', () => {
    expect(TIMELAPSE_FRAMES).toHaveLength(8);
    const names = STAGES.map(([name]) => name as string);
    TIMELAPSE_FRAMES.forEach((frame, index) => {
      expect(names).toContain(frame.stage);
      expect(stageAtGrowth(frame.growth)).toBe(frame.stage);
      if (index > 0) {
        expect(frame.growth).toBeGreaterThan(frameAt(index - 1).growth);
        expect(frame.day).toBeGreaterThanOrEqual(frameAt(index - 1).day);
      }
    });
    expect(frameAt(0).stage).toBe('Seed');
    expect(frameAt(7).stage).toBe('Grand tree');
  });

  it('prints day counts a typical pace can really reach (the honesty check)', () => {
    // Day 1 holds the planting; from the fourth frame on the weekly pace band applies.
    for (const frame of TIMELAPSE_FRAMES.slice(3)) {
      const gp = gpAtGrowth(frame.growth);
      const activeDays = (frame.day * TYPICAL_PACE.activeDaysPerWeek) / 7;
      expect(gp, frame.id).toBeGreaterThanOrEqual(TYPICAL_PACE.gpLow * (activeDays - 1));
      expect(gp, frame.id).toBeLessThanOrEqual(TYPICAL_PACE.gpHigh * (activeDays + 1));
    }
  });
});

describe('timelapseAt', () => {
  it('runs from a seed at dawn to a grand tree at night', () => {
    const start = timelapseAt(0);
    const end = timelapseAt(1);
    expect(start).toMatchObject({ stage: 'Seed', hour: 6, frame: 0, label: 'Day 1 · Seed' });
    expect(end).toMatchObject({ stage: 'Grand tree', hour: 22, frame: 7 });
    expect(end.label).toBe('Year 1 · Grand tree');
    expect(end.growth).toBeLessThan(growthOf(9000));
  });

  it('is monotonic, so scrolling back rewinds exactly', () => {
    let previous = timelapseAt(0);
    for (let step = 1; step <= TIMELAPSE_STEPS; step += 1) {
      const moment = timelapseAt(step / TIMELAPSE_STEPS);
      expect(moment.growth).toBeGreaterThanOrEqual(previous.growth);
      expect(moment.day).toBeGreaterThanOrEqual(previous.day);
      expect(moment.hour).toBeGreaterThan(previous.hour);
      previous = moment;
    }
    expect(timelapseAt(0.4)).toEqual(timelapseAt(0.4));
  });

  it('quantises progress and clamps anything out of range', () => {
    expect(timelapseAt(0.5004).progress).toBe(timelapseAt(0.5).progress);
    expect(timelapseAt(-2)).toEqual(timelapseAt(0));
    expect(timelapseAt(9)).toEqual(timelapseAt(1));
  });

  it('gives every frame the same share of the scroll', () => {
    TIMELAPSE_FRAMES.forEach((frame, index) => {
      const moment = timelapseAt(index / (TIMELAPSE_FRAMES.length - 1), { still: true });
      expect(moment.frame).toBe(index);
      expect(moment.growth).toBeCloseTo(frame.growth, 10);
      expect(moment.day).toBe(frame.day);
    });
  });

  it('shows only the eight stills in the calm version', () => {
    const seen = new Set<number>();
    for (let step = 0; step <= 200; step += 1) {
      seen.add(timelapseAt(step / 200, { still: true }).growth);
    }
    expect(seen.size).toBe(8);
  });
});

describe('scroll maths', () => {
  it('pins: 0 at the top of the section, 1 on its last screenful', () => {
    expect(pinnedProgress({ top: 300, height: 2000 }, 800)).toBe(0);
    expect(pinnedProgress({ top: 0, height: 2000 }, 800)).toBe(0);
    expect(pinnedProgress({ top: -600, height: 2000 }, 800)).toBeCloseTo(0.5);
    expect(pinnedProgress({ top: -1200, height: 2000 }, 800)).toBe(1);
    expect(pinnedProgress({ top: -5000, height: 2000 }, 800)).toBe(1);
    expect(pinnedProgress({ top: 0, height: 500 }, 800)).toBe(0);
  });

  it('lists: caption i is centred at i / (count - 1)', () => {
    const viewport = 800;
    const row = 300;
    const count = 8;
    for (let index = 0; index < count; index += 1) {
      const top = viewport / 2 - (index + 0.5) * row;
      expect(listProgress({ top, height: row * count }, viewport, count)).toBeCloseTo(
        index / (count - 1),
      );
    }
    expect(listProgress({ top: 0, height: 0 }, viewport, count)).toBe(0);
  });

  it('hands the stage to the time-lapse half a caption before the first one is centred', () => {
    const count = 8;
    expect(timelapseEngaged(-0.5, count)).toBe(false);
    expect(timelapseEngaged(-0.5 / 7, count)).toBe(true);
    expect(timelapseEngaged(0, count)).toBe(true);
  });
});
