import { describe, expect, it } from 'vitest';
import type { GameEvent, GameEventOf, LogEntry } from '@/game';
import { ROUTES } from '../routes';
import { LOG_MOMENT_MS, logToastId, planFeedback, type FeedbackContext } from './eventFeedback';

const context: FeedbackContext = { treeName: 'Fern', calm: false };
const calm: FeedbackContext = { treeName: 'Fern', calm: true };

function log(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log-1',
    ts: 0,
    day: '2026-10-06',
    tzOffsetMin: 0,
    actionId: 'walk-cycle-instead-of-car',
    variant: null,
    title: 'Walked or cycled instead of driving',
    emoji: '🚲',
    category: 'move',
    qty: 5,
    unit: 'km',
    co2eKg: 1.02,
    kgLow: 0.8,
    kgHigh: 1.3,
    estimate: 'factor',
    factorsVersion: '2026.10',
    kind: 'catalogue',
    cadence: 'daily',
    rewardedActs: 1,
    xp: 30,
    gp: 10,
    source: 'log',
    effort: null,
    ...overrides,
  } as LogEntry;
}

const logged = (overrides: Partial<GameEventOf<'action-logged'>> = {}): GameEvent => ({
  type: 'action-logged',
  log: log(),
  rewarded: true,
  strength: 0.5,
  firstActToday: false,
  ...overrides,
});

const xp = (amount: number, reason: GameEventOf<'xp-gained'>['reason']): GameEvent => ({
  type: 'xp-gained',
  amount,
  reason,
  total: 1000,
});

describe('planFeedback', () => {
  it('prints a receipt with the estimate, the XP and an Undo for a log', () => {
    const plan = planFeedback([logged(), xp(30, 'log')], context);

    expect(plan.toasts).toHaveLength(1);
    expect(plan.toasts[0]).toMatchObject({
      id: logToastId('log-1'),
      title: 'Stuck. Fern grew.',
      meta: '+30 XP',
      kg: 1.02,
      category: 'move',
      action: { kind: 'undo-log', label: 'Undo', logId: 'log-1' },
    });
    expect(plan.xpEarned).toBe(30);
    expect(plan.sounds).toEqual([{ name: 'leaf', options: { count: 5 }, delayMs: 0 }]);
  });

  it('never shows a number for an action that is not quantified', () => {
    const plan = planFeedback([logged({ log: log({ co2eKg: null }) })], context);
    expect(plan.toasts[0]?.kg).toBeUndefined();
  });

  it('says so when an action is past its cap and plays no leaves', () => {
    const plan = planFeedback([logged({ rewarded: false, log: log({ xp: 0 }) })], context);
    expect(plan.toasts[0]?.title).toMatch(/kilograms, not XP/);
    expect(plan.toasts[0]?.meta).toBeUndefined();
    expect(plan.sounds).toEqual([]);
  });

  it('folds the check-in and ring XP of the same moment into the receipt', () => {
    const plan = planFeedback(
      [
        logged(),
        xp(30, 'log'),
        xp(5, 'check-in'),
        { type: 'ring', day: '2026-10-06', state: 'closed', rings: 12, fullRings: 9, first: true },
        xp(10, 'ring'),
      ],
      context,
    );
    expect(plan.toasts).toHaveLength(1);
    expect(plan.toasts[0]?.meta).toBe('+45 XP · ring closed');
    expect(plan.sounds.map((cue) => cue.name)).toEqual(['leaf', 'ring']);
    expect(plan.xpEarned).toBe(45);
  });

  it('reports XP that has no event of its own in one line', () => {
    const plan = planFeedback([xp(5, 'check-in'), xp(15, 'journal')], context);
    expect(plan.toasts).toEqual([
      { id: 'xp', title: '+20 XP', meta: 'Watered · Journal note', icon: 'xp' },
    ]);
  });

  it('replaces the receipt with the undo line and dismisses it', () => {
    const plan = planFeedback([{ type: 'action-undone', log: log(), live: true }], context);
    expect(plan.dismiss).toEqual([logToastId('log-1')]);
    expect(plan.toasts[0]?.title).toBe('Peeled off. Back to how it was.');
    expect(plan.sounds[0]?.name).toBe('peel');
  });

  it('never announces XP that an undo took back', () => {
    const plan = planFeedback(
      [{ type: 'xp-removed', amount: 30, reason: 'log', total: 970 }],
      context,
    );
    expect(plan.toasts).toEqual([]);
    expect(plan.xpEarned).toBe(0);
  });

  it('offers to claim a quest that just became claimable', () => {
    const plan = planFeedback(
      [{ type: 'quest-claimable', questId: 'first-light', kind: 'daily', title: 'First light' }],
      context,
    );
    expect(plan.toasts[0]).toMatchObject({
      id: 'quest-first-light',
      title: 'Ready to tear: First light',
      action: { kind: 'go', label: 'Claim', href: ROUTES.quests },
    });
  });

  it('uses the same toast id for a claim, so it replaces the invitation', () => {
    const claimed = planFeedback(
      [
        {
          type: 'quest-claimed',
          questId: 'first-light',
          kind: 'daily',
          title: 'First light',
          xp: 15,
          auto: false,
        },
        xp(15, 'quest'),
      ],
      context,
    );
    expect(claimed.toasts).toHaveLength(1);
    expect(claimed.toasts[0]).toMatchObject({ id: 'quest-first-light', meta: '+15 XP' });
    expect(claimed.sounds[0]?.name).toBe('tear');

    const auto = planFeedback(
      [
        {
          type: 'quest-claimed',
          questId: 'cold-snap',
          kind: 'weekly',
          title: 'Cold Snap',
          xp: 40,
          auto: true,
        },
      ],
      context,
    );
    expect(auto.toasts[0]?.title).toBe('Claimed for you: Cold Snap');
    expect(auto.sounds).toEqual([]);
  });

  it('tells the user when rain covered a gap', () => {
    const plan = planFeedback(
      [{ type: 'freeze-used', days: ['2026-10-04', '2026-10-05'], bank: 1, streak: 12 }],
      context,
    );
    expect(plan.toasts[0]).toMatchObject({
      id: 'freeze-used',
      title: 'It rained for 2 days. Your streak is safe.',
      meta: '12 days · 1 cloud left',
      icon: 'rain',
      tone: 'info',
    });
    expect(plan.sounds[0]?.name).toBe('water');
  });

  it('queues celebrations badge, level, streak, after the log moment', () => {
    const plan = planFeedback(
      [
        logged(),
        { type: 'streak-milestone', days: 7, xp: 50 },
        { type: 'level-up', level: 6, from: 5, title: 'Sprout Scout', first: true },
        {
          type: 'badge-unlocked',
          badgeId: 'bookworm',
          name: 'Bookworm',
          emoji: '📚',
          tier: 1,
          tiers: 3,
          xp: 20,
          secret: false,
          prop: 'fireflies',
        },
      ],
      context,
    );
    expect(plan.celebrations.map((entry) => entry.kind)).toEqual(['badge', 'level-up', 'streak']);
    expect(plan.celebrationDelayMs).toBe(LOG_MOMENT_MS);
    expect(plan.toasts.map((toast) => toast.title)).toContain('Fireflies arrived.');
  });

  it('stays silent for a level regained after an undo', () => {
    const plan = planFeedback(
      [{ type: 'level-up', level: 6, from: 5, title: 'Sprout Scout', first: false }],
      context,
    );
    expect(plan.celebrations).toEqual([]);
    expect(plan.toasts).toEqual([]);
  });

  it('turns the whole queue into one summary toast when calm', () => {
    const plan = planFeedback(
      [
        { type: 'level-up', level: 6, from: 5, title: 'Sprout Scout', first: true },
        { type: 'streak-milestone', days: 7, xp: 50 },
      ],
      calm,
    );
    expect(plan.celebrations).toEqual([]);
    expect(plan.celebrationDelayMs).toBe(0);
    expect(plan.toasts).toEqual([
      {
        id: 'celebrations',
        title: 'Level 6 · 7 days running.',
        meta: 'Sprout Scout · +50 XP',
        icon: 'badge',
        tone: 'success',
      },
    ]);
    expect(plan.sounds).toEqual([{ name: 'level', delayMs: 0 }]);
  });

  it('falls back to a neutral name before the tree has one', () => {
    const plan = planFeedback([logged()], { treeName: '  ', calm: false });
    expect(plan.toasts[0]?.title).toBe('Stuck. Your tree grew.');
  });

  it('has nothing to say about bookkeeping events', () => {
    const plan = planFeedback(
      [
        { type: 'day-rolled', from: '2026-10-05', to: '2026-10-06', rain: 0, rest: 0, missed: 0 },
        { type: 'quest-progress', questId: 'a', kind: 'daily', current: 1, target: 2 },
        { type: 'state-reset' },
      ],
      context,
    );
    expect(plan).toEqual({
      toasts: [],
      dismiss: [],
      celebrations: [],
      celebrationDelayMs: 0,
      sounds: [],
      xpEarned: 0,
    });
  });
});
