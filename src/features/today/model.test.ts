import { describe, expect, it } from 'vitest';
import { ACTIONS } from '@/data/catalogue';
import type { BreakFinishResult } from '@/game';
import { BREAK_COPY } from './copy';
import {
  FLIGHT,
  arcPoints,
  breakParam,
  breakRewardPreview,
  breakSummary,
  flightFrames,
  greeting,
  leavesFor,
  markWord,
  partOfDay,
  printDate,
  printSlug,
  quantityLabel,
  questOrder,
  recapDelta,
  recapGrowth,
  recapRange,
  rhythmLine,
  serial,
  todayEstimateSource,
  weekEstimateSource,
  weekdayLabel,
} from './model';
import { stickerLabel } from './stickerLabels';

const at = (hour: number) => new Date(2026, 9, 6, hour, 32).getTime();

type Kept = Extract<BreakFinishResult, { ok: true }>;

function finished(overrides: {
  kept: boolean;
  keptMin?: number;
  xp?: number;
  rewarded?: boolean;
  why?: Kept['verdict']['why'];
  recorded?: boolean;
}): Kept {
  const keptMin = overrides.keptMin ?? 0;
  const verdict: Kept['verdict'] = {
    elapsedMin: 20,
    awayMs: 0,
    keptMin,
    kept: overrides.kept,
    complete: true,
    why: overrides.why ?? (overrides.kept ? 'kept' : 'not-away'),
  };
  if (overrides.recorded === false) return { ok: true, entry: null, verdict, rewarded: false };
  return {
    ok: true,
    verdict,
    rewarded: overrides.rewarded ?? false,
    entry: {
      id: 'b1',
      startTs: at(14),
      endTs: at(15),
      day: '2026-10-06',
      plannedMin: 20,
      keptMin,
      awayMs: 0,
      kept: overrides.kept,
      outcome: 'outside',
      xp: overrides.xp ?? 0,
      gp: 0,
    },
  };
}

describe('greeting and dates', () => {
  it('greets by the hour and asks a question late at night', () => {
    expect(greeting(at(8), 'Sam')).toBe('Morning, Sam.');
    expect(greeting(at(14), 'Sam')).toBe('Afternoon, Sam.');
    expect(greeting(at(19), 'Sam')).toBe('Evening, Sam.');
    expect(greeting(at(23), 'Sam')).toBe('Up late, Sam?');
    expect(greeting(at(3), '  ')).toBe('Up late?');
  });

  it('splits the day at 05:00, 12:00, 17:00 and 22:00', () => {
    expect([4, 5, 11, 12, 16, 17, 21, 22].map((hour) => partOfDay(at(hour)))).toEqual([
      'night',
      'morning',
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
      'night',
    ]);
  });

  it('prints the date line and the grove slug', () => {
    expect(printDate('2026-10-06')).toBe('Tuesday 06 October');
    expect(serial(12)).toBe('0012');
    expect(printSlug(12, '2026-10-06', at(14))).toMatch(/^Grove Nº 0012 · Tue 06 Oct 2026 · /);
  });
});

describe('sticker captions and quantities', () => {
  it('has a caption of at most 18 characters for every catalogue action', () => {
    for (const action of ACTIONS) {
      const label = stickerLabel(action);
      expect(label.length, action.id).toBeGreaterThan(0);
      expect(label.length, action.id).toBeLessThanOrEqual(18);
    }
  });

  it('cuts an unknown title at a word', () => {
    expect(stickerLabel({ id: 'new-thing', title: 'Mended a pair of walking boots' })).toBe(
      'Mended a pair of',
    );
  });

  it('writes quantities with their unit', () => {
    expect(quantityLabel(2, 'km')).toBe('2 km');
    expect(quantityLabel(1, 'meal')).toBe('1 meal');
    expect(quantityLabel(3, 'meal')).toBe('3 meals');
    expect(quantityLabel(5, 'minute')).toBe('5 min');
  });

  it('turns a grow strength into three to eight leaves', () => {
    expect(leavesFor(0.2)).toBe(3);
    expect(leavesFor(1)).toBe(8);
    expect(leavesFor(0)).toBe(3);
    expect(leavesFor(0.6)).toBeGreaterThan(3);
    expect(leavesFor(0.6)).toBeLessThan(8);
  });
});

describe('the log moment', () => {
  const from = { x: 100, y: 600 };
  const to = { x: 500, y: 200 };

  it('carries the sticker on an arc that rises above the straight line', () => {
    const points = arcPoints(from, to, 80, 8);
    expect(points[0]).toEqual(from);
    expect(points.at(-1)).toEqual(to);
    const middle = points[4];
    expect(middle?.x).toBeCloseTo(300);
    // Halfway along a straight line would be y = 400; the control point lifts it by 40.
    expect(middle?.y).toBeCloseTo(360);
  });

  it('peels, carries and presses inside 520 ms, landing at 440', () => {
    const frames = flightFrames(from, to);
    const count = frames.times.length;
    for (const track of [frames.x, frames.y, frames.scale, frames.rotate, frames.opacity]) {
      expect(track).toHaveLength(count);
    }
    expect(frames.duration).toBeCloseTo(FLIGHT.press / 1000);
    expect(frames.times[1]).toBeCloseTo(FLIGHT.peel / FLIGHT.press);
    expect(frames.times.at(-2)).toBeCloseTo(FLIGHT.land / FLIGHT.press);
    expect([...frames.times].sort((a, b) => a - b)).toEqual(frames.times);
    expect(frames.x[0]).toBe(from.x);
    expect(frames.x.at(-1)).toBe(to.x);
    expect(frames.scale[1]).toBeCloseTo(1.15);
    expect(frames.opacity.at(-1)).toBe(0);
  });

  it('flies back to the slot at full size for an undo', () => {
    const frames = flightFrames(to, from, true);
    expect(frames.duration).toBeCloseTo(FLIGHT.back / 1000);
    expect(frames.x.at(-1)).toBe(from.x);
    expect(frames.y.at(-1)).toBe(from.y);
    expect(frames.scale.at(-1)).toBeCloseTo(1);
    expect(frames.opacity.at(-1)).toBe(1);
  });
});

describe('the week strip', () => {
  it('names the marks that are something, and stays quiet about the rest', () => {
    expect(markWord('full')).toBe('Full');
    expect(markWord('ring')).toBe('Ring');
    expect(markWord('rain')).toBe('Rain');
    expect(markWord('rest')).toBe('Rest');
    expect(markWord('missed')).toBe('');
    expect(weekdayLabel(0)).toBe('Mon');
    expect(weekdayLabel(6)).toBe('Sun');
  });

  it('puts the rhythm in one line, with singulars', () => {
    expect(rhythmLine({ activeThisWeek: 3, current: 12, rainBank: 2 }, 12)).toBe(
      '3 of 7 this week · 12-day streak · 2 rain days banked · 12 rings',
    );
    expect(rhythmLine({ activeThisWeek: 1, current: 1, rainBank: 1 }, 1)).toBe(
      '1 of 7 this week · 1-day streak · 1 rain day banked · 1 ring',
    );
  });
});

describe('quests', () => {
  it('puts claimable quests first and claimed ones last, keeping slot order', () => {
    const quest = (id: string, slot: number, claimable: boolean, claimed: boolean) =>
      ({ id, slot, claimable, claimed }) as Parameters<typeof questOrder>[0][number];
    expect(
      questOrder([
        quest('a', 0, false, true),
        quest('b', 1, false, false),
        quest('c', 2, true, false),
      ]),
    ).toEqual(['c', 'b', 'a']);
  });
});

describe('estimates', () => {
  it('explains a day with nothing sourced without inventing a sum', () => {
    const source = todayEstimateSource({ logs: [], kg: 0, aiKg: 0 });
    expect(source.kind).toBe('factor');
    expect(source.formula).toMatch(/^Nothing with a sourced estimate/);
    expect(source.href).toBe('/methodology');
  });

  it('keeps AI estimates out of the week total and says so', () => {
    const source = weekEstimateSource({ logs: 9, kg: 12.4, aiKg: 0.5 });
    expect(source.formula).toContain('9 logged actions that week');
    expect(source.comparedWith).toContain('kept out of this total');
  });
});

describe('the Touch grass break', () => {
  it('reads the break length from the URL only when the engine offers it', () => {
    expect(breakParam(null)).toEqual({ open: false, minutes: null });
    expect(breakParam('1')).toEqual({ open: true, minutes: null });
    expect(breakParam('20')).toEqual({ open: true, minutes: 20 });
    expect(breakParam('500')).toEqual({ open: true, minutes: null });
  });

  it('previews the reward of the first kept break, and none after it', () => {
    expect(breakRewardPreview(10, false)).toMatch(/^\+15 XP · \+2 sunlight/);
    expect(breakRewardPreview(30, false)).toMatch(/^\+25 XP/);
    expect(breakRewardPreview(30, true)).toBe(BREAK_COPY.alreadyRewarded);
  });

  it('closes a rewarded break with the XP and the tree by name', () => {
    const summary = breakSummary(
      finished({ kept: true, keptMin: 20, xp: 25, rewarded: true }),
      'Fern',
    );
    expect(summary).toMatchObject({ tone: 'reward', minutes: 20, xp: 25 });
    expect(summary.line).toBe('+25 XP · Fern soaked up the sun you brought back.');
  });

  it('records a second break of the day without XP', () => {
    const summary = breakSummary(finished({ kept: true, keptMin: 10 }), 'Fern');
    expect(summary.tone).toBe('recorded');
    expect(summary.line).toContain('10 minutes outside');
  });

  it('is kind about a break that did not count', () => {
    expect(breakSummary(finished({ kept: false, why: 'too-short' }), 'Fern').line).toBe(
      BREAK_COPY.tooShort,
    );
    expect(breakSummary(finished({ kept: false, why: 'not-away' }), 'Fern').line).toBe(
      BREAK_COPY.notAway,
    );
    expect(breakSummary(finished({ kept: false, recorded: false }), 'Fern').line).toBe(
      BREAK_COPY.noneReply,
    );
  });
});

describe('the weekly recap', () => {
  it('names the span and the change from the week before', () => {
    expect(recapRange({ monday: '2026-09-28', sunday: '2026-10-04' })).toBe('28 Sep – 04 Oct');
    expect(recapDelta({ kg: 5, previousKg: null })).toBeNull();
    expect(recapDelta({ kg: 5, previousKg: 5.01 })?.dir).toBe('flat');
    expect(recapDelta({ kg: 7.5, previousKg: 5 })).toEqual({
      dir: 'up',
      text: '2.5 kg more than the week before',
    });
    expect(recapDelta({ kg: 4, previousKg: 5 })?.dir).toBe('down');
  });

  it('describes growth inside one stage and across two', () => {
    expect(
      recapGrowth({
        stageBefore: 'Sapling',
        stageAfter: 'Sapling',
        stageProgressBefore: 0.12,
        stageProgressAfter: 0.43,
      }),
    ).toBe('Sapling, 12% → 43%');
    expect(
      recapGrowth({
        stageBefore: 'Sapling',
        stageAfter: 'Young tree',
        stageProgressBefore: 0.9,
        stageProgressAfter: 0.04,
      }),
    ).toBe('Sapling 90% → Young tree 4%');
  });
});
