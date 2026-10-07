import type { CategoryId, GameEvent, XpReason } from '@/game';
import { formatNumber, pluralize } from '@/lib/format';
import type { SfxName, SfxOptions } from '@/lib/sfx';
import type { ToastTone } from '@/ui';
import { ROUTES } from '../routes';

/**
 * What the shell does about a batch of game events (bible 7.4 to 7.7): which toasts print, which
 * celebrations queue, which sounds play. Pure, so the mapping is tested without a browser; the
 * `<Feedback>` component carries the plan out.
 */

/** What a toast's button does. Data, not a closure, so plans can be compared in tests. */
export type ToastAction =
  { kind: 'undo-log'; label: string; logId: string } | { kind: 'go'; label: string; href: string };

export type ToastIcon = 'xp' | 'quest' | 'rain' | 'streak' | 'stage' | 'badge' | 'island' | 'data';

export interface ToastSpec {
  /** Stable per subject, so a later event replaces the toast instead of stacking a second one. */
  id: string;
  title: string;
  /** Mono line under the title, without the estimate. */
  meta?: string;
  /** Estimated kg CO2e, printed before `meta` behind the "≈" glyph. */
  kg?: number;
  category?: CategoryId;
  icon?: ToastIcon;
  tone?: ToastTone;
  action?: ToastAction;
}

export type Celebration =
  | { kind: 'level-up'; level: number; title: string }
  | { kind: 'badge'; name: string; emoji: string; tier: number; tiers: number; xp: number }
  | { kind: 'streak'; days: number; xp: number };

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
  /** In queue order: badge, level-up, streak. Empty when `calm` (they become one toast). */
  celebrations: Celebration[];
  /** How long the celebrations wait, so the log moment finishes first. */
  celebrationDelayMs: number;
  sounds: SoundCue[];
  /** XP earned by this batch: the XP bar draws that span yellow for a moment. */
  xpEarned: number;
}

export interface FeedbackContext {
  treeName: string;
  /** Reduced motion, or Celebrations set to Subtle: no overlays, one summary toast instead. */
  calm: boolean;
}

/** The log moment's hard ceiling: follow-up rewards start after it (bible 7.4). */
export const LOG_MOMENT_MS = 1200;

/**
 * XP that has no toast of its own: it is reported in one line. The planting's own XP is not
 * here: the ceremony card prints "+25 XP · Ring 1", and a toast adding the watering to it read
 * "+35 XP" beside that card.
 */
const PLAIN_XP_LABEL: Partial<Record<XpReason, string>> = {
  'check-in': 'Watered',
  ring: 'Day ring closed',
  epic: 'Epic finished',
  journal: 'Journal note',
  dev: 'Granted',
};

const xp = (amount: number): string => `+${formatNumber(amount)} XP`;

const sentenceCase = (id: string): string => {
  const words = id.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function logToastId(logId: string): string {
  return `log-${logId}`;
}

/** One line for everything a calm user would otherwise have seen as overlays. */
function summarise(celebrations: readonly Celebration[]): ToastSpec | null {
  if (celebrations.length === 0) return null;
  const parts: string[] = [];
  let earned = 0;
  for (const celebration of celebrations) {
    switch (celebration.kind) {
      case 'level-up':
        parts.push(`Level ${formatNumber(celebration.level)}`);
        break;
      case 'badge':
        parts.push(`${celebration.name} stamped`);
        earned += celebration.xp;
        break;
      case 'streak':
        parts.push(`${formatNumber(celebration.days)} days running`);
        earned += celebration.xp;
        break;
    }
  }
  const level = celebrations.find((entry) => entry.kind === 'level-up');
  const meta = [level?.kind === 'level-up' ? level.title : null, earned > 0 ? xp(earned) : null]
    .filter(Boolean)
    .join(' · ');
  return {
    id: 'celebrations',
    title: `${parts.join(' · ')}.`,
    meta: meta || undefined,
    icon: celebrations[0]?.kind === 'streak' ? 'streak' : 'badge',
    tone: 'success',
  };
}

export function planFeedback(events: readonly GameEvent[], context: FeedbackContext): FeedbackPlan {
  const tree = context.treeName.trim() || 'Your tree';
  const toasts: ToastSpec[] = [];
  const dismiss: string[] = [];
  const sounds: SoundCue[] = [];
  const badges: Celebration[] = [];
  const levels: Celebration[] = [];
  const streaks: Celebration[] = [];
  const plainXp: { amount: number; label: string }[] = [];
  let xpEarned = 0;
  let ringClosed = false;

  const logged = events.filter((event) => event.type === 'action-logged');
  const hasLog = logged.length > 0;

  for (const event of events) {
    switch (event.type) {
      case 'action-logged': {
        const { log } = event;
        const meta = log.xp > 0 ? xp(log.xp) : undefined;
        toasts.push({
          id: logToastId(log.id),
          title: event.rewarded
            ? `Stuck. ${tree} grew.`
            : 'Stuck. Maxed for today, so this one adds kilograms, not XP.',
          meta,
          kg: log.co2eKg !== null && log.co2eKg > 0 ? log.co2eKg : undefined,
          category: log.category,
          action: { kind: 'undo-log', label: 'Undo', logId: log.id },
        });
        if (event.rewarded) {
          sounds.push({
            name: 'leaf',
            options: { count: 3 + Math.round(Math.min(1, Math.max(0, event.strength)) * 3) },
            delayMs: 0,
          });
        }
        break;
      }
      case 'action-undone':
        dismiss.push(logToastId(event.log.id));
        toasts.push({ id: `undone-${event.log.id}`, title: 'Peeled off. Back to how it was.' });
        sounds.push({ name: 'peel', delayMs: 0 });
        break;
      case 'checked-in':
        if (!event.implicit) sounds.push({ name: 'water', delayMs: 0 });
        break;
      case 'ring':
        if (event.state === 'closed' && event.first) {
          ringClosed = true;
          sounds.push({ name: 'ring', delayMs: hasLog ? 600 : 0 });
        }
        break;
      case 'xp-gained': {
        xpEarned += event.amount;
        const label = PLAIN_XP_LABEL[event.reason];
        if (label) plainXp.push({ amount: event.amount, label });
        break;
      }
      case 'level-up':
        if (event.first) levels.push({ kind: 'level-up', level: event.level, title: event.title });
        break;
      case 'stage-up':
        if (event.first) {
          toasts.push({
            id: `stage-${event.stageIndex}`,
            title: `${tree} reached a new stage: ${event.stage}.`,
            icon: 'stage',
            tone: 'success',
          });
          sounds.push({ name: 'cheer', delayMs: hasLog ? LOG_MOMENT_MS : 0 });
        }
        break;
      case 'streak-milestone':
        streaks.push({ kind: 'streak', days: event.days, xp: event.xp });
        break;
      case 'streak-rested':
        if (event.announced) {
          toasts.push({
            id: 'streak-rested',
            title: `Your streak rested at ${formatNumber(event.days)} days.`,
            meta: `Your best is safe. ${tree} kept everything.`,
            icon: 'streak',
          });
        }
        break;
      case 'freeze-used': {
        const days = event.days.length;
        toasts.push({
          id: 'freeze-used',
          title:
            days === 1
              ? 'It rained while you were away. Your streak is safe.'
              : `It rained for ${formatNumber(days)} days. Your streak is safe.`,
          meta: `${pluralize(event.streak, 'day')} · ${pluralize(event.bank, 'cloud')} left`,
          icon: 'rain',
          tone: 'info',
        });
        sounds.push({ name: 'water', delayMs: 0 });
        break;
      }
      case 'rain-earned':
        toasts.push({
          id: 'rain-earned',
          title: 'A rain cloud rolled in.',
          meta: `${formatNumber(event.bank)} banked · each covers a missed day`,
          icon: 'rain',
          tone: 'info',
        });
        break;
      case 'badge-unlocked':
        badges.push({
          kind: 'badge',
          name: event.name,
          emoji: event.emoji,
          tier: event.tier,
          tiers: event.tiers,
          xp: event.xp,
        });
        if (event.prop) {
          toasts.push({
            id: `island-${event.prop}`,
            title: `${sentenceCase(event.prop)} arrived.`,
            meta: 'New on the island',
            icon: 'island',
            tone: 'success',
          });
        }
        break;
      case 'quest-claimable':
        toasts.push({
          id: `quest-${event.questId}`,
          title: `Ready to tear: ${event.title}`,
          meta: event.kind === 'daily' ? 'Daily quest done' : 'Quest done',
          icon: 'quest',
          tone: 'success',
          action: { kind: 'go', label: 'Claim', href: ROUTES.quests },
        });
        break;
      case 'quest-claimed':
        toasts.push({
          id: `quest-${event.questId}`,
          title: event.auto ? `Claimed for you: ${event.title}` : `Claimed: ${event.title}`,
          meta: xp(event.xp),
          icon: 'quest',
          tone: 'success',
        });
        if (!event.auto) sounds.push({ name: 'tear', delayMs: 0 });
        break;
      case 'clean-sweep':
        toasts.push({
          id: `sweep-${event.day}`,
          title: 'Clean sweep. All three dailies done.',
          meta: xp(event.xp),
          icon: 'quest',
          tone: 'success',
        });
        break;
      case 'lesson-completed':
        if (event.passed && event.firstPass) {
          toasts.push({
            id: `lesson-${event.slug}`,
            title: event.perfect ? 'Lesson passed. Three out of three.' : 'Lesson passed.',
            meta: xp(event.xp),
            icon: 'xp',
            tone: 'success',
          });
          sounds.push({ name: 'cheer', delayMs: 0 });
        }
        break;
      case 'myth-flipped':
        if (event.first && event.xp > 0) {
          toasts.push({
            id: `myth-${event.myth}`,
            title: xp(event.xp),
            meta: 'Myth busted',
            icon: 'xp',
          });
        }
        break;
      case 'break-finished':
        if (event.kept) sounds.push({ name: 'chime', delayMs: 0 });
        if (event.rewarded) {
          toasts.push({
            id: 'break-finished',
            title: event.outcome === 'outside' ? 'Touched grass.' : 'Break kept.',
            meta: `${formatNumber(event.keptMin)} min away · ${xp(event.xp)}`,
            category: 'nature',
          });
        }
        break;
      case 'challenge-accepted':
        toasts.push({ id: 'challenge', title: 'Challenge accepted. It is on.', icon: 'quest' });
        break;
      case 'challenge-completed':
        toasts.push({
          id: 'challenge',
          title: 'Challenge complete.',
          meta: `${formatNumber(event.done)} of ${formatNumber(event.of)} · ${xp(event.xp)}`,
          icon: 'quest',
          tone: 'success',
        });
        break;
      case 'legacy-imported':
        toasts.push({
          id: 'legacy-imported',
          title: `Brought ${pluralize(event.logs, 'log')} along.`,
          meta: `${pluralize(event.rings, 'ring')} · ${xp(event.xp)}`,
          icon: 'data',
          tone: 'success',
        });
        break;
      case 'state-imported':
        toasts.push({
          id: 'state-imported',
          title: 'Import done. Everything is in place.',
          icon: 'data',
          tone: 'success',
        });
        break;
      default:
        break;
    }
  }

  // XP with no event of its own. Beside a log it rides on the receipt; alone it gets one line.
  if (plainXp.length > 0) {
    const amount = plainXp.reduce((sum, entry) => sum + entry.amount, 0);
    const receipt = toasts.find((toast) => toast.action?.kind === 'undo-log');
    if (receipt && hasLog) {
      const own = logged.reduce((sum, event) => sum + event.log.xp, 0);
      receipt.meta = [xp(own + amount), ringClosed ? 'ring closed' : null]
        .filter(Boolean)
        .join(' · ');
    } else {
      toasts.push({
        id: 'xp',
        title: xp(amount),
        meta: [...new Set(plainXp.map((entry) => entry.label))].join(' · '),
        icon: 'xp',
      });
    }
  }

  // Queue order (bible 7.7): badge, then level-up, then streak.
  const queue = [...badges, ...levels, ...streaks];
  let celebrations: Celebration[] = queue;
  if (context.calm) {
    const summary = summarise(queue);
    if (summary) toasts.push(summary);
    celebrations = [];
    if (badges.length > 0) sounds.push({ name: 'stamp', delayMs: hasLog ? LOG_MOMENT_MS : 0 });
    else if (levels.length > 0) sounds.push({ name: 'level', delayMs: hasLog ? LOG_MOMENT_MS : 0 });
    else if (streaks.length > 0)
      sounds.push({ name: 'streak', delayMs: hasLog ? LOG_MOMENT_MS : 0 });
  }

  return {
    toasts,
    dismiss,
    celebrations,
    celebrationDelayMs: hasLog ? LOG_MOMENT_MS : 0,
    sounds,
    xpEarned,
  };
}
