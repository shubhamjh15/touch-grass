import type { GameEvent, XpReason } from '@/game';
import { formatNumber, pluralize } from '@/lib/format';
import type { SfxName, SfxOptions } from '@/lib/sfx';
import type { ToastTone } from '@/ui';
import { ROUTES } from '../routes';

/**
 * What the shell does about a batch of game events: which toasts show, whether the level-up
 * dialog opens, which sounds play. Pure, so the mapping is tested without a browser; the
 * `<Feedback>` component carries the plan out.
 *
 * The rules are the calm ones: one toast per event, Undo on a log, and never a pile. One user
 * action can set off several events (a log that finishes a quest and earns a badge), so a
 * batch shows its receipt plus the two things most worth knowing; the rest is on the pages.
 */

/** What a toast's button does. Data, not a closure, so plans can be compared in tests. */
export type ToastAction =
  { kind: 'undo-log'; label: string; logId: string } | { kind: 'go'; label: string; href: string };

export type ToastIcon = 'xp' | 'quest' | 'rain' | 'streak' | 'stage' | 'badge' | 'data';

export interface ToastSpec {
  /** Stable per subject, so a later event replaces the toast instead of stacking a second one. */
  id: string;
  title: string;
  /** A second, quieter line. */
  meta?: string;
  icon?: ToastIcon;
  tone?: ToastTone;
  action?: ToastAction;
}

export interface SoundCue {
  name: SfxName;
  options?: SfxOptions;
  /** Milliseconds after the events arrived. */
  delayMs: number;
}

export interface FeedbackPlan {
  toasts: ToastSpec[];
  /** Ids of toasts that no longer apply (the receipt of a log that was undone). */
  dismiss: string[];
  /** The level reached, when one was: the dialog shows the highest of the batch. */
  levelUp: { level: number; title: string } | null;
  /** How long the dialog waits, so the log moment finishes first. */
  levelUpDelayMs: number;
  sounds: SoundCue[];
}

export interface FeedbackContext {
  treeName: string;
}

/** The log moment (sheet closing, the tree's pop): rewards that follow wait for it. */
export const LOG_MOMENT_MS = 600;

/** Toasts a batch may show besides its receipts. */
export const MAX_EXTRA_TOASTS = 2;

/** XP that has no event of its own to hang a toast on. */
const PLAIN_XP_LABEL: Partial<Record<XpReason, string>> = {
  ceremony: 'Tree planted',
  'check-in': 'Daily visit',
  ring: 'Daily goal reached',
  epic: 'Big quest finished',
  journal: 'Journal note',
  dev: 'Granted',
};

const xp = (amount: number): string => `+${formatNumber(amount)} XP`;

export function logToastId(logId: string): string {
  return `log-${logId}`;
}

interface Ranked {
  spec: ToastSpec;
  /** Higher survives the cap. Receipts are never ranked: they always show. */
  rank: number;
}

export function planFeedback(events: readonly GameEvent[], context: FeedbackContext): FeedbackPlan {
  const tree = context.treeName.trim() || 'Your tree';
  const receipts: ToastSpec[] = [];
  const extras: Ranked[] = [];
  const dismiss: string[] = [];
  const sounds: SoundCue[] = [];
  const plainXp: { amount: number; label: string }[] = [];
  let levelUp: FeedbackPlan['levelUp'] = null;

  const logged = events.filter((event) => event.type === 'action-logged');
  const hasLog = logged.length > 0;
  const afterLog = hasLog ? LOG_MOMENT_MS : 0;
  const extra = (rank: number, spec: ToastSpec) => extras.push({ spec, rank });

  for (const event of events) {
    switch (event.type) {
      case 'action-logged': {
        const { log } = event;
        receipts.push({
          id: logToastId(log.id),
          title:
            event.rewarded && log.xp > 0
              ? `${xp(log.xp)} · ${tree} grew`
              : 'Logged. No more XP for this one today.',
          action: { kind: 'undo-log', label: 'Undo', logId: log.id },
        });
        if (event.rewarded) sounds.push({ name: 'leaf', delayMs: 0 });
        break;
      }
      case 'action-undone':
        dismiss.push(logToastId(event.log.id));
        receipts.push({ id: `undone-${event.log.id}`, title: 'Undone.' });
        sounds.push({ name: 'peel', delayMs: 0 });
        break;
      case 'xp-gained': {
        const label = PLAIN_XP_LABEL[event.reason];
        if (label) plainXp.push({ amount: event.amount, label });
        break;
      }
      case 'level-up':
        if (event.first && (!levelUp || event.level > levelUp.level)) {
          levelUp = { level: event.level, title: event.title };
        }
        break;
      case 'stage-up':
        if (event.first) {
          extra(4, {
            id: `stage-${event.stageIndex}`,
            title: `New stage: ${event.stage}`,
            meta: `${tree} is growing up.`,
            icon: 'stage',
            tone: 'success',
          });
          sounds.push({ name: 'cheer', delayMs: afterLog });
        }
        break;
      case 'badge-unlocked':
        extra(5, {
          id: `badge-${event.badgeId}`,
          title: `New badge: ${event.name}`,
          meta: event.xp > 0 ? xp(event.xp) : undefined,
          icon: 'badge',
          tone: 'success',
          action: { kind: 'go', label: 'See it', href: ROUTES.me },
        });
        sounds.push({ name: 'stamp', delayMs: afterLog });
        break;
      case 'streak-milestone':
        extra(4, {
          id: 'streak-milestone',
          title: `${formatNumber(event.days)} days in a row.`,
          meta: event.xp > 0 ? xp(event.xp) : undefined,
          icon: 'streak',
          tone: 'success',
        });
        sounds.push({ name: 'streak', delayMs: afterLog });
        break;
      case 'streak-rested':
        if (event.announced) {
          extra(2, {
            id: 'streak-rested',
            title: `Your streak ended at ${pluralize(event.days, 'day')}.`,
            meta: `${tree} kept everything. Start a new one today.`,
            icon: 'streak',
          });
        }
        break;
      case 'freeze-used':
        extra(2, {
          id: 'freeze-used',
          title:
            event.days.length === 1
              ? 'You missed a day. Your streak is safe.'
              : `You missed ${formatNumber(event.days.length)} days. Your streak is safe.`,
          meta: `${pluralize(event.bank, 'rain cloud')} left`,
          icon: 'rain',
          tone: 'info',
        });
        break;
      case 'rain-earned':
        extra(1, {
          id: 'rain-earned',
          title: 'You earned a rain cloud.',
          meta: 'It covers one missed day.',
          icon: 'rain',
          tone: 'info',
        });
        break;
      case 'quest-claimable':
        extra(3, {
          id: `quest-${event.questId}`,
          title: `Quest done: ${event.title}`,
          icon: 'quest',
          tone: 'success',
          action: { kind: 'go', label: 'Claim', href: ROUTES.quests },
        });
        break;
      case 'quest-claimed':
        extra(3, {
          id: `quest-${event.questId}`,
          title: `${xp(event.xp)} · ${event.title}`,
          meta: event.auto ? 'Claimed for you' : undefined,
          icon: 'quest',
          tone: 'success',
        });
        if (!event.auto) sounds.push({ name: 'boop', delayMs: 0 });
        break;
      case 'clean-sweep':
        extra(3, {
          id: `sweep-${event.day}`,
          title: 'All three daily quests done.',
          meta: xp(event.xp),
          icon: 'quest',
          tone: 'success',
        });
        break;
      case 'lesson-completed':
        if (event.passed && event.firstPass) {
          extra(3, {
            id: `lesson-${event.slug}`,
            title: event.perfect ? 'Lesson passed. Every answer right.' : 'Lesson passed.',
            meta: xp(event.xp),
            icon: 'xp',
            tone: 'success',
          });
          sounds.push({ name: 'cheer', delayMs: 0 });
        }
        break;
      case 'myth-flipped':
        if (event.first && event.xp > 0) {
          extra(1, {
            id: `myth-${event.myth}`,
            title: `${xp(event.xp)} · Myth busted`,
            icon: 'xp',
          });
        }
        break;
      case 'break-finished':
        if (event.kept) sounds.push({ name: 'chime', delayMs: 0 });
        if (event.rewarded) {
          extra(3, {
            id: 'break-finished',
            title: event.outcome === 'outside' ? 'You touched grass.' : 'Break kept.',
            meta: `${formatNumber(event.keptMin)} min away · ${xp(event.xp)}`,
            icon: 'xp',
            tone: 'success',
          });
        }
        break;
      case 'challenge-accepted':
        extra(3, { id: 'challenge', title: 'Challenge accepted.', icon: 'quest' });
        break;
      case 'challenge-completed':
        extra(3, {
          id: 'challenge',
          title: 'Challenge complete.',
          meta: `${formatNumber(event.done)} of ${formatNumber(event.of)} · ${xp(event.xp)}`,
          icon: 'quest',
          tone: 'success',
        });
        break;
      case 'legacy-imported':
        extra(3, {
          id: 'legacy-imported',
          title: `Brought ${pluralize(event.logs, 'log')} along.`,
          meta: xp(event.xp),
          icon: 'data',
          tone: 'success',
        });
        break;
      case 'state-imported':
        extra(3, { id: 'state-imported', title: 'Import done.', icon: 'data', tone: 'success' });
        break;
      default:
        break;
    }
  }

  // XP with no event of its own. Beside a log it is added to the receipt; alone it gets one line.
  if (plainXp.length > 0) {
    const amount = plainXp.reduce((sum, entry) => sum + entry.amount, 0);
    const receipt = receipts.find((toast) => toast.action?.kind === 'undo-log');
    if (receipt) {
      const own = logged.reduce((sum, event) => sum + event.log.xp, 0);
      receipt.title = `${xp(own + amount)} · ${tree} grew`;
    } else {
      extra(1, {
        id: 'xp',
        title: xp(amount),
        meta: [...new Set(plainXp.map((entry) => entry.label))].join(' · '),
        icon: 'xp',
      });
    }
  }

  // Stable sort: equal ranks keep the order the events arrived in.
  const kept = [...extras]
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_EXTRA_TOASTS)
    .map((entry) => entry.spec);

  if (levelUp) sounds.push({ name: 'level', delayMs: afterLog });

  return { toasts: [...receipts, ...kept], dismiss, levelUp, levelUpDelayMs: afterLog, sounds };
}
