import { PROP_UNLOCK } from '@/data/badges';
import type { BadgeStatus } from '@/game';
import { PROP_NAME } from './island';
import { numeral, thresholdText } from './labels';

export type BadgeFilter = 'all' | 'earned' | 'locked';

export const BADGE_FILTERS: readonly BadgeFilter[] = ['all', 'earned', 'locked'];

export function isEarned(status: BadgeStatus): boolean {
  return status.tier > 0;
}

export function filterBadges(all: readonly BadgeStatus[], filter: BadgeFilter): BadgeStatus[] {
  if (filter === 'earned') return all.filter(isEarned);
  if (filter === 'locked') return all.filter((status) => !isEarned(status));
  return [...all];
}

export function filterCounts(all: readonly BadgeStatus[]): Record<BadgeFilter, number> {
  const earned = all.filter(isEarned).length;
  return { all: all.length, earned, locked: all.length - earned };
}

export interface TierRow {
  tier: number;
  numeral: string;
  /** What it takes: "50 acts". */
  need: string;
  xp: number;
  earnedTs: number | null;
  /** The island props this tier brings, by name. */
  props: string[];
}

/** One row per tier of a badge, with what it takes, what it pays and when it was earned. */
export function tierRows(status: BadgeStatus): TierRow[] {
  const { badge, earned, maxTier } = status;
  return badge.thresholds.map((threshold, index) => {
    const tier = index + 1;
    return {
      tier,
      numeral: numeral(tier, maxTier),
      need: thresholdText(badge.unit, threshold),
      xp: badge.xp[index] ?? 0,
      earnedTs: earned.find((entry) => entry.tier === tier)?.ts ?? null,
      props: status.props
        .filter((prop) => PROP_UNLOCK[prop].tier === tier)
        .map((prop) => PROP_NAME[prop]),
    };
  });
}

/** The newest tier a badge has earned, for the date on its stamp. */
export function latestEarnedTs(status: BadgeStatus): number | null {
  const stamps = status.earned.map((entry) => entry.ts);
  return stamps.length > 0 ? Math.max(...stamps) : null;
}
