/**
 * Badge progress and unlock detection (product spec section 5). Every metric is derived
 * from saved state, so badges can always be recomputed. Badges are never revoked: an
 * undo that drops a count below a threshold keeps the badge and its island prop.
 */
import {
  BADGES,
  BADGE_BY_ID,
  ISLAND_PROP_ORDER,
  PROP_UNLOCK,
  type BadgeDef,
  type BadgeMetric,
  type BadgeTier,
} from '@/data/badges';
import { hourOfDay, weekKey } from '@/lib/dates';
import { formatDecimal, formatNumber } from '@/lib/format';
import type { IslandPropId } from '@/world/contract';
import { grantXp, writeActivity, type Ctx } from './ctx';
import { BREAKS_COUNTED_PER_DAY } from './economy';
import { lifetimeLogStats, memoize } from './indexes';
import type { BadgeProgress, GameState } from './types';

type MetricState = Pick<
  GameState,
  | 'logs'
  | 'tree'
  | 'streak'
  | 'quests'
  | 'learn'
  | 'breaks'
  | 'journal'
  | 'baseline'
  | 'days'
  | 'marks'
  | 'challenge'
  | 'seen'
  | 'onboarding'
>;

// Badges are re-checked after every mutation, so each collection is summarised once per
// identity: an unchanged collection costs a single map lookup.

const keptBreaks = memoize((breaks: GameState['breaks']): number => {
  const perDay = new Map<string, number>();
  for (const entry of breaks) {
    if (entry.kept) perDay.set(entry.day, (perDay.get(entry.day) ?? 0) + 1);
  }
  let total = 0;
  for (const count of perDay.values()) total += Math.min(BREAKS_COUNTED_PER_DAY, count);
  return total;
});

const perfectWeeks = memoize((marks: GameState['marks']): number => {
  const fullByWeek = new Map<string, number>();
  for (const [day, mark] of Object.entries(marks)) {
    if (mark !== 'full') continue;
    const week = weekKey(day);
    fullByWeek.set(week, (fullByWeek.get(week) ?? 0) + 1);
  }
  let weeks = 0;
  for (const count of fullByWeek.values()) if (count >= 7) weeks += 1;
  return weeks;
});

const claimStats = memoize((claims: GameState['quests']['claims']) => {
  const dailies = new Map<string, number>();
  const weeklies = new Map<string, number>();
  let epics = 0;
  for (const claim of claims) {
    if (claim.kind === 'daily') dailies.set(claim.period, (dailies.get(claim.period) ?? 0) + 1);
    else if (claim.kind === 'weekly') {
      weeklies.set(claim.period, (weeklies.get(claim.period) ?? 0) + 1);
    } else epics += 1;
  }
  const full = (counts: Map<string, number>) =>
    [...counts.values()].filter((count) => count >= 3).length;
  return { cleanSweeps: full(dailies), hatTricks: full(weeklies), epics };
});

const dayStats = memoize((days: GameState['days']) => {
  let dawn = 0;
  let afterRain = 0;
  let afterDormancy = 0;
  for (const record of Object.values(days)) {
    if (hourOfDay(record.checkInTs) < 6) dawn += 1;
    if (record.ringClosed && record.returnedFrom === 'rain') afterRain += 1;
    if (record.ringClosed && record.returnedFrom === 'dormant') afterDormancy += 1;
  }
  return { dawn, afterRain, afterDormancy };
});

/** The current value of what a badge counts. */
export function badgeMetric(state: MetricState, metric: BadgeMetric): number {
  const logs = lifetimeLogStats(state.logs);
  switch (metric) {
    case 'acts:move':
      return logs.actsByCategory.move;
    case 'acts:eat':
      return logs.actsByCategory.eat;
    case 'acts:power':
      return logs.actsByCategory.power;
    case 'acts:water':
      return logs.actsByCategory.water;
    case 'acts:stuff':
      return logs.actsByCategory.stuff;
    case 'acts:waste':
      return logs.actsByCategory.waste;
    case 'acts:nature':
      return logs.actsByCategory.nature;
    case 'rings':
      return state.tree.rings;
    case 'best-streak':
      return state.streak.best;
    case 'full-rings':
      return state.tree.fullRings;
    case 'factor-kg':
      return logs.factorKg;
    case 'quests-claimed':
      return state.quests.claims.length;
    case 'lessons-passed':
      return Object.values(state.learn.lessons).filter((lesson) => lesson.passedTs !== null).length;
    case 'breaks-kept':
      return keptBreaks(state.breaks);
    case 'journal-notes':
      return state.journal.length;
    case 'rewarded-acts':
      return logs.rewardedActs;
    case 'baseline-taken':
      return state.baseline.current ? 1 : 0;
    case 'categories-tried':
      return logs.categoriesTried;
    case 'clean-sweeps':
      return claimStats(state.quests.claims).cleanSweeps;
    case 'epics-claimed':
      return claimStats(state.quests.claims).epics;
    case 'myths-flipped':
      return state.learn.mythsFlipped.length;
    case 'perfect-first-attempts':
      return Object.values(state.learn.lessons).filter((lesson) => lesson.firstAttemptScore === 3)
        .length;
    case 'share-exports':
      return state.seen.shareExports;
    case 'challenges-won':
      return state.challenge.history.filter((entry) => entry.success).length;
    case 'night-logs':
      return logs.nightLogs;
    case 'dawn-check-ins':
      return dayStats(state.days).dawn;
    case 'rings-after-rain':
      return dayStats(state.days).afterRain;
    case 'rings-after-dormancy':
      return dayStats(state.days).afterDormancy;
    case 'perfect-weeks':
      return perfectWeeks(state.marks);
    case 'earth-day-logs':
      return logs.earthDayLogs;
    case 'categories-in-a-day':
      return logs.maxCategoriesInDay;
    case 'weekly-hat-tricks':
      return claimStats(state.quests.claims).hatTricks;
    case 'legacy-import':
      return state.onboarding.legacy === 'imported' ? 1 : 0;
  }
}

/** The highest tier whose threshold a value reaches; 0 when none. */
export function tierFor(badge: BadgeDef, value: number): number {
  let tier = 0;
  badge.thresholds.forEach((threshold, index) => {
    // A small tolerance keeps a kilogram total of 9.999999 from missing its 10 kg tier.
    if (value + 1e-9 >= threshold) tier = index + 1;
  });
  return tier;
}

export interface BadgeStatus {
  badge: BadgeDef;
  /** Tier earned so far: 0 when locked. */
  tier: number;
  maxTier: number;
  earned: BadgeProgress['earned'];
  value: number;
  /** Threshold of the next tier; `null` when every tier is earned. */
  nextThreshold: number | null;
  /** 0..1 towards the next tier. */
  progress: number;
  /** "34 / 50 acts", or the riddle of a locked secret. */
  progressText: string;
  /** A locked secret shows "???" and its riddle instead of its name. */
  hidden: boolean;
  props: IslandPropId[];
}

function propsOf(badgeId: string): { prop: IslandPropId; tier: BadgeTier }[] {
  return ISLAND_PROP_ORDER.filter((prop) => PROP_UNLOCK[prop].badge === badgeId).map((prop) => ({
    prop,
    tier: PROP_UNLOCK[prop].tier,
  }));
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? formatNumber(value) : formatDecimal(value, 1);
}

export function badgeStatus(
  state: MetricState & Pick<GameState, 'badges'>,
  badge: BadgeDef,
): BadgeStatus {
  const saved = state.badges[badge.id];
  const tier: number = saved?.tier ?? 0;
  const value = badgeMetric(state, badge.metric);
  const nextThreshold = badge.thresholds[tier] ?? null;
  const previousThreshold = tier > 0 ? (badge.thresholds[tier - 1] ?? 0) : 0;
  const hidden = badge.secret && tier === 0;
  const progress =
    nextThreshold === null
      ? 1
      : Math.min(1, Math.max(0, (value - previousThreshold) / (nextThreshold - previousThreshold)));
  const shown = nextThreshold === null ? value : Math.min(value, nextThreshold);
  return {
    badge,
    tier,
    maxTier: badge.thresholds.length,
    earned: saved?.earned ?? [],
    value,
    nextThreshold,
    progress,
    progressText: hidden
      ? (badge.riddle ?? '???')
      : nextThreshold === null
        ? `${formatMetric(value)} ${badge.unit}`
        : `${formatMetric(shown)} / ${formatMetric(nextThreshold)} ${badge.unit}`,
    hidden,
    props: propsOf(badge.id).map((entry) => entry.prop),
  };
}

export function allBadgeStatuses(state: MetricState & Pick<GameState, 'badges'>): BadgeStatus[] {
  return BADGES.map((badge) => badgeStatus(state, badge));
}

/** Island props whose badge tier is earned, in the world contract's order. */
export function unlockedProps(badges: GameState['badges']): IslandPropId[] {
  return ISLAND_PROP_ORDER.filter((prop) => {
    const unlock = PROP_UNLOCK[prop];
    return (badges[unlock.badge]?.tier ?? 0) >= unlock.tier;
  });
}

/** Grants one tier of a badge: XP, the activity line, the island prop and the event. */
function awardTier(ctx: Ctx, badge: BadgeDef, tier: BadgeTier): void {
  const s = ctx.s;
  const saved = s.badges[badge.id];
  if ((saved?.tier ?? 0) >= tier) return;
  const xp = badge.xp[tier - 1] ?? 0;
  s.badges = {
    ...s.badges,
    [badge.id]: { tier, earned: [...(saved?.earned ?? []), { tier, ts: ctx.now }] },
  };
  grantXp(ctx, xp, 'badge');
  const prop = propsOf(badge.id).find((entry) => entry.tier === tier)?.prop ?? null;
  const numeral = badge.thresholds.length > 1 ? ` ${'I'.repeat(tier)}` : '';
  writeActivity(ctx, 'badge', `Badge earned: ${badge.name}${numeral}.`);
  if (prop) writeActivity(ctx, 'island', PROP_UNLOCK[prop].logLine);
  ctx.events.push({
    type: 'badge-unlocked',
    badgeId: badge.id,
    name: badge.name,
    emoji: badge.emoji,
    tier,
    tiers: badge.thresholds.length,
    xp,
    secret: badge.secret,
    prop,
  });
}

/** Awards every badge tier the state now qualifies for. Runs at the end of each transaction. */
export function awardEarnedBadges(ctx: Ctx): void {
  for (const badge of BADGES) {
    if (ctx.options.badgeFilter && !ctx.options.badgeFilter(badge.id)) continue;
    const have = ctx.s.badges[badge.id]?.tier ?? 0;
    if (have >= badge.thresholds.length) continue;
    const reached = tierFor(badge, badgeMetric(ctx.s, badge.metric));
    for (let tier = have + 1; tier <= reached; tier += 1) awardTier(ctx, badge, tier as BadgeTier);
  }
}

/** Grants a badge tier outright. Only the QA helper uses this. */
export function forceBadge(ctx: Ctx, badgeId: string, tier: BadgeTier = 1): boolean {
  const badge = BADGE_BY_ID.get(badgeId);
  if (!badge || tier > badge.thresholds.length) return false;
  for (let step = (ctx.s.badges[badgeId]?.tier ?? 0) + 1; step <= tier; step += 1) {
    awardTier(ctx, badge, step as BadgeTier);
  }
  return true;
}
