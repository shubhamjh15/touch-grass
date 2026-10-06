import { BADGE_BY_ID, PROP_UNLOCK } from '@/data/badges';
import { ISLAND_PROPS, type IslandPropId } from '@/world';
import { numeral, thresholdText } from './labels';

/** What each of the sixteen island props is called in the interface. */
export const PROP_NAME: Readonly<Record<IslandPropId, string>> = {
  flowers: 'Flowers',
  mushrooms: 'Mushrooms',
  pond: 'Pond',
  bench: 'Bench',
  lantern: 'Lantern',
  turbine: 'Wind turbine',
  solar: 'Solar panel',
  compost: 'Compost heap',
  'veggie-patch': 'Veggie patch',
  beehive: 'Beehive',
  birdhouse: 'Birdhouse',
  birds: 'Birds',
  butterflies: 'Butterflies',
  fireflies: 'Fireflies',
  swing: 'Swing',
  signpost: 'Signpost',
};

export interface PendingProp {
  prop: IslandPropId;
  name: string;
  /** What earns it: "Ring Collector II · 30 rings". */
  requirement: string;
}

/** The props the island does not have yet, with the badge tier that brings each one. */
export function pendingProps(unlocked: readonly IslandPropId[]): PendingProp[] {
  const have = new Set<IslandPropId>(unlocked);
  return ISLAND_PROPS.filter((prop) => !have.has(prop)).map((prop) => {
    const { badge: badgeId, tier } = PROP_UNLOCK[prop];
    const badge = BADGE_BY_ID.get(badgeId);
    if (!badge) return { prop, name: PROP_NAME[prop], requirement: '' };
    const maxTier = badge.thresholds.length;
    const label = maxTier > 1 ? `${badge.name} ${numeral(tier, maxTier)}` : badge.name;
    const need = badge.thresholds[tier - 1];
    const requirement =
      maxTier > 1 && need !== undefined
        ? `${label} · ${thresholdText(badge.unit, need)}`
        : `${label} · ${badge.description}`;
    return { prop, name: PROP_NAME[prop], requirement };
  });
}

const DAY_LINE = /^Day (\d+) · (.*)$/;

/** Splits an Island log line, "Day 9 · Fireflies arrived", into its day number and the words. */
export function splitLogLine(text: string): { day: number | null; words: string } {
  const match = DAY_LINE.exec(text);
  if (!match) return { day: null, words: text };
  return { day: Number(match[1]), words: match[2] ?? '' };
}
