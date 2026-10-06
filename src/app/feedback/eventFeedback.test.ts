import { describe, expect, it } from 'vitest';
import type { GameEvent, GameEventOf, LogEntry } from '@/game';
import { ROUTES } from '../routes';
import {
  LOG_MOMENT_MS,
  MAX_EXTRA_TOASTS,
  logToastId,
  planFeedback,
  type FeedbackContext,
} from './eventFeedback';

const context: FeedbackContext = { treeName: 'Fern' };

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

const badge = (overrides: Partial<GameEventOf<'badge-unlocked'>> = {}): GameEvent => ({
  type: 'badge-unlocked',
  badgeId: 'first-steps',
  name: 'First steps',
  emoji: '👣',
  tier: 1,
  tiers: 3,
  xp: 20,
  secret: false,
  prop: null,
  ...overrides,
});

const levelUp = (level: number, first = true): GameEvent => ({
  type: 'level-up',
  level,
  from: level - 1,
  title: `Title ${level}`,
  first,
});

describe('planFeedback', () => {
  it('answers a log with one toast: the XP, the tree, and Undo', () => {
    const plan = planFeedback([logged(), xp(30, 'log')], context);

    expect(plan.toasts).toEqual([
      {
        id: logToastId('log-1'),
        title: '+30 XP · Fern grew',
        action: { kind: 'undo-log', label: 'Undo', logId: 'log-1' },
      },
    ]);
    expect(plan.levelUp).toBeNull();
    expect(plan.sounds).toEqual([{ name: 'leaf', delayMs: 0 }]);
  });

  it('says so when an action is past its cap and plays no sound', () => {
    const plan = planFeedback([logged({ rewarded: false, log: log({ xp: 0 }) })], context);
    expect(plan.toasts[0]?.title).toBe('Logged. No more XP for this one today.');
    expect(plan.toasts[0]?.action).toMatchObject({ kind: 'undo-log' });
    expect(plan.sounds).toEqual([]);
  });

  it('adds the XP of the same moment (daily visit, daily goal) to the receipt', () => {
    const plan = planFeedback(
      [
        logged(),
        xp(30, 'log'),
        xp(5, 'check-in'),
        { type: 'ring', day: '2026-10-06', state: 'closed', rings: 4, fullRings: 2, first: true },
        xp(20, 'ring'),
      ],
      context,
    );
    expect(plan.toasts).toHaveLength(1);
    expect(plan.toasts[0]?.title).toBe('+55 XP · Fern grew');
  });

  it('reports XP that has no event of its own in one line', () => {
    const plan = planFeedback([xp(5, 'check-in'), xp(10, 'journal')], context);
    expect(plan.toasts).toEqual([
      { id: 'xp', title: '+15 XP', meta: 'Daily visit · Journal note', icon: 'xp' },
    ]);
  });

  it('replaces the receipt with one line when a log is undone', () => {
    const plan = planFeedback(
      [
        { type: 'action-undone', log: log(), live: true },
        { type: 'xp-removed', amount: 30, reason: 'log', total: 970 },
      ],
      context,
    );
    expect(plan.dismiss).toEqual([logToastId('log-1')]);
    expect(plan.toasts).toEqual([{ id: 'undone-log-1', title: 'Undone.' }]);
  });

  it('shows a badge as a toast that leads to Me', () => {
    const plan = planFeedback([badge()], context);
    expect(plan.toasts).toEqual([
      {
        id: 'badge-first-steps',
        title: 'New badge: First steps',
        meta: '+20 XP',
        icon: 'badge',
        tone: 'success',
        action: { kind: 'go', label: 'See it', href: ROUTES.me },
      },
    ]);
    expect(plan.levelUp).toBeNull();
  });

  it('opens the level-up dialog for the highest new level, after the log moment', () => {
    const plan = planFeedback([logged(), xp(30, 'log'), levelUp(5), levelUp(6)], context);
    expect(plan.levelUp).toEqual({ level: 6, title: 'Title 6' });
    expect(plan.levelUpDelayMs).toBe(LOG_MOMENT_MS);
    expect(plan.sounds).toContainEqual({ name: 'level', delayMs: LOG_MOMENT_MS });
    // The level has its dialog: it adds no toast of its own.
    expect(plan.toasts).toHaveLength(1);
  });

  it('opens the dialog at once when no log came with the level', () => {
    const plan = planFeedback([levelUp(3)], context);
    expect(plan.levelUp).toEqual({ level: 3, title: 'Title 3' });
    expect(plan.levelUpDelayMs).toBe(0);
  });

  it('stays silent for a level or a stage regained after an undo', () => {
    const plan = planFeedback(
      [levelUp(6, false), { type: 'stage-up', stage: 'Sapling', stageIndex: 3, first: false }],
      context,
    );
    expect(plan.levelUp).toBeNull();
    expect(plan.toasts).toEqual([]);
    expect(plan.sounds).toEqual([]);
  });

  it('offers to claim a finished quest, and the claim replaces that toast', () => {
    const claimable = planFeedback(
      [{ type: 'quest-claimable', questId: 'q1', kind: 'daily', title: 'Two meat-free meals' }],
      context,
    );
    expect(claimable.toasts[0]).toMatchObject({
      id: 'quest-q1',
      title: 'Quest done: Two meat-free meals',
      action: { kind: 'go', label: 'Claim', href: ROUTES.quests },
    });

    const claimed = planFeedback(
      [
        {
          type: 'quest-claimed',
          questId: 'q1',
          kind: 'daily',
          title: 'Two meat-free meals',
          xp: 40,
          auto: false,
        },
        xp(40, 'quest'),
      ],
      context,
    );
    expect(claimed.toasts).toEqual([
      { id: 'quest-q1', title: '+40 XP · Two meat-free meals', icon: 'quest', tone: 'success' },
    ]);
  });

  it('tells the user when a rain cloud covered a missed day', () => {
    const plan = planFeedback(
      [{ type: 'freeze-used', days: ['2026-10-05'], bank: 1, streak: 12 }],
      context,
    );
    expect(plan.toasts[0]).toMatchObject({
      id: 'freeze-used',
      title: 'You missed a day. Your streak is safe.',
      meta: '1 rain cloud left',
    });
  });

  it('never piles toasts up: the receipt plus the two that matter most', () => {
    const plan = planFeedback(
      [
        logged(),
        xp(30, 'log'),
        { type: 'rain-earned', reason: 'rings', bank: 2 },
        { type: 'quest-claimable', questId: 'q1', kind: 'daily', title: 'Walk 2 km' },
        { type: 'stage-up', stage: 'Sapling', stageIndex: 3, first: true },
        badge(),
        { type: 'streak-milestone', days: 7, xp: 50 },
      ],
      context,
    );
    expect(plan.toasts).toHaveLength(1 + MAX_EXTRA_TOASTS);
    expect(plan.toasts.map((toast) => toast.id)).toEqual([
      logToastId('log-1'),
      'badge-first-steps',
      'stage-3',
    ]);
  });

  it('falls back to a neutral name before the tree has one', () => {
    const plan = planFeedback([logged()], { treeName: '  ' });
    expect(plan.toasts[0]?.title).toBe('+30 XP · Your tree grew');
  });

  it('has nothing to say about bookkeeping events', () => {
    const plan = planFeedback(
      [
        { type: 'streak', current: 4, previous: 3, best: 9 },
        { type: 'quest-progress', questId: 'q1', kind: 'daily', current: 1, target: 2 },
        { type: 'lesson-opened', slug: 'the-blanket' },
        { type: 'streak-rested', days: 2, announced: false },
        xp(40, 'quest'),
      ],
      context,
    );
    expect(plan).toEqual({ toasts: [], dismiss: [], levelUp: null, levelUpDelayMs: 0, sounds: [] });
  });
});
