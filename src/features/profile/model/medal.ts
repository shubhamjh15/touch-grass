import type { BadgeStatus } from '@/game';
import { COPY } from '../copy';
import { badgeLook } from './badgeLook';
import { latestEarnedTs } from './badges';
import { stampDate } from './labels';

/** How a badge's medal is drawn: earned, locked with its progress, or a secret. */
export function medalOf(status: BadgeStatus, slot: number) {
  const { badge } = status;
  const look = badgeLook(badge.id);
  const earnedTs = latestEarnedTs(status);
  const base = { icon: look.icon, hue: look.hue, slot } as const;
  if (status.tier > 0) {
    return {
      ...base,
      state: 'earned' as const,
      name: badge.name,
      tier: status.maxTier > 1 ? (Math.min(status.tier, 3) as 1 | 2 | 3) : undefined,
      earnedOn: earnedTs === null ? undefined : stampDate(earnedTs),
    };
  }
  if (status.hidden) {
    return {
      ...base,
      state: 'secret' as const,
      name: COPY.badges.secretName,
      hint: badge.riddle ?? undefined,
    };
  }
  return {
    ...base,
    state: 'locked' as const,
    name: badge.name,
    progress:
      status.nextThreshold === null
        ? undefined
        : { value: Math.floor(status.value), max: status.nextThreshold, unit: badge.unit },
  };
}
