/**
 * The 33 badges and the island props they unlock. Data only: progress and unlock
 * detection live in `src/game/badges.ts`. Every prop of the world contract is unlocked
 * by exactly one badge tier, so the island can always be rebuilt from earned badges.
 */
import type { IslandPropId } from '@/world/contract';

/** What a badge counts. The engine derives every metric from saved state. */
export type BadgeMetric =
  | 'acts:move'
  | 'acts:eat'
  | 'acts:power'
  | 'acts:water'
  | 'acts:stuff'
  | 'acts:waste'
  | 'acts:nature'
  | 'rings'
  | 'best-streak'
  | 'full-rings'
  | 'factor-kg'
  | 'quests-claimed'
  | 'lessons-passed'
  | 'breaks-kept'
  | 'journal-notes'
  | 'rewarded-acts'
  | 'baseline-taken'
  | 'categories-tried'
  | 'clean-sweeps'
  | 'epics-claimed'
  | 'myths-flipped'
  | 'perfect-first-attempts'
  | 'share-exports'
  | 'challenges-won'
  | 'night-logs'
  | 'dawn-check-ins'
  | 'rings-after-rain'
  | 'rings-after-dormancy'
  | 'perfect-weeks'
  | 'earth-day-logs'
  | 'categories-in-a-day'
  | 'weekly-hat-tricks'
  | 'legacy-import';

export type BadgeTier = 1 | 2 | 3;

export interface BadgeDef {
  id: string;
  name: string;
  emoji: string;
  /** How it is earned, shown on the card once it is not a secret any more. */
  description: string;
  metric: BadgeMetric;
  /** One threshold per tier: three for tiered badges, one otherwise. */
  thresholds: readonly number[];
  /** XP per tier, same length as `thresholds`. */
  xp: readonly number[];
  /** Noun for the progress line, e.g. "34 / 50 acts". */
  unit: string;
  secret: boolean;
  /** One-line hint shown while a secret badge is locked. */
  riddle: string | null;
}

const TIER_XP = [20, 40, 80] as const;
const SECRET_XP = [50] as const;

function tiered(
  id: string,
  name: string,
  emoji: string,
  metric: BadgeMetric,
  thresholds: readonly [number, number, number],
  unit: string,
  description: string,
): BadgeDef {
  return {
    id,
    name,
    emoji,
    description,
    metric,
    thresholds,
    xp: TIER_XP,
    unit,
    secret: false,
    riddle: null,
  };
}

function single(
  id: string,
  name: string,
  emoji: string,
  metric: BadgeMetric,
  threshold: number,
  xp: number,
  unit: string,
  description: string,
): BadgeDef {
  return {
    id,
    name,
    emoji,
    description,
    metric,
    thresholds: [threshold],
    xp: [xp],
    unit,
    secret: false,
    riddle: null,
  };
}

function secret(
  id: string,
  name: string,
  emoji: string,
  metric: BadgeMetric,
  threshold: number,
  unit: string,
  description: string,
  riddle: string,
): BadgeDef {
  return {
    id,
    name,
    emoji,
    description,
    metric,
    thresholds: [threshold],
    xp: SECRET_XP,
    unit,
    secret: true,
    riddle,
  };
}

export const BADGES: readonly BadgeDef[] = [
  tiered('trailblazer', 'Trailblazer', '🥾', 'acts:move', [10, 50, 200], 'acts', 'Move actions'),
  tiered('plant-plate', 'Plant Plate', '🥗', 'acts:eat', [10, 50, 200], 'acts', 'Eat actions'),
  tiered(
    'watt-watcher',
    'Watt Watcher',
    '⚡',
    'acts:power',
    [10, 50, 200],
    'acts',
    'Power actions',
  ),
  tiered('drop-saver', 'Drop Saver', '💧', 'acts:water', [10, 50, 200], 'acts', 'Water actions'),
  tiered('loop-maker', 'Loop Maker', '🧵', 'acts:stuff', [5, 20, 60], 'acts', 'Stuff actions'),
  tiered('bin-boss', 'Bin Boss', '♻️', 'acts:waste', [10, 50, 200], 'acts', 'Waste actions'),
  tiered(
    'wild-heart',
    'Wild Heart',
    '🐝',
    'acts:nature',
    [10, 50, 200],
    'acts',
    'Nature & Voice actions',
  ),
  tiered(
    'ring-collector',
    'Ring Collector',
    '🪵',
    'rings',
    [7, 30, 150],
    'rings',
    'Days you showed up',
  ),
  tiered('on-a-roll', 'On a Roll', '🔥', 'best-streak', [7, 30, 100], 'days', 'Your best streak'),
  tiered(
    'full-circle',
    'Full Circle',
    '⭕',
    'full-rings',
    [5, 25, 100],
    'full rings',
    'Days with a closed ring',
  ),
  tiered(
    'kept-out',
    'Kept Out',
    '🌍',
    'factor-kg',
    [10, 100, 500],
    'kg',
    'Estimated CO2e avoided, from sourced factors only',
  ),
  tiered(
    'quest-hand',
    'Quest Hand',
    '🧭',
    'quests-claimed',
    [10, 50, 200],
    'quests',
    'Quests claimed',
  ),
  tiered(
    'bookworm',
    'Bookworm',
    '📚',
    'lessons-passed',
    [1, 5, 10],
    'lessons',
    'Lesson quizzes passed',
  ),
  tiered(
    'grass-toucher',
    'Grass Toucher',
    '🌿',
    'breaks-kept',
    [1, 10, 40],
    'breaks',
    'Touch Grass breaks kept',
  ),
  tiered(
    'dear-diary',
    'Dear Diary',
    '📓',
    'journal-notes',
    [1, 10, 30],
    'notes',
    'Journal notes written',
  ),
  single(
    'first-leaf',
    'First Leaf',
    '🍃',
    'rewarded-acts',
    1,
    20,
    'acts',
    'Your first logged action',
  ),
  single(
    'rooted',
    'Rooted',
    '🌱',
    'baseline-taken',
    1,
    20,
    'quiz',
    'Finished the starting-line quiz',
  ),
  single(
    'well-rounded',
    'Well Rounded',
    '🎡',
    'categories-tried',
    7,
    40,
    'categories',
    'An action in all seven categories',
  ),
  single(
    'clean-sweep',
    'Clean Sweep',
    '🧹',
    'clean-sweeps',
    1,
    40,
    'sweeps',
    'Claimed all three dailies in one day',
  ),
  single('epic-tale', 'Epic Tale', '📜', 'epics-claimed', 1, 40, 'epics', 'Your first epic'),
  single(
    'myth-buster',
    'Myth Buster',
    '🃏',
    'myths-flipped',
    10,
    40,
    'cards',
    'Flipped all ten myth cards',
  ),
  single(
    'sharpshooter',
    'Sharpshooter',
    '🎯',
    'perfect-first-attempts',
    5,
    80,
    'lessons',
    '3 out of 3 on the first attempt in five lessons',
  ),
  single(
    'show-and-tell',
    'Show & Tell',
    '🖼️',
    'share-exports',
    1,
    20,
    'cards',
    'Exported a share card',
  ),
  single(
    'challenger',
    'Challenger',
    '🤝',
    'challenges-won',
    1,
    40,
    'challenges',
    'Completed a friend challenge',
  ),
  secret(
    'night-owl',
    'Night Owl',
    '🦉',
    'night-logs',
    1,
    'logs',
    'Logged between midnight and 04:00',
    'Some things only happen after midnight.',
  ),
  secret(
    'dawn-chorus',
    'Dawn Chorus',
    '🐦',
    'dawn-check-ins',
    3,
    'mornings',
    'Checked in before 06:00 on three days',
    'The early birds know this one.',
  ),
  secret(
    'rain-dancer',
    'Rain Dancer',
    '🌧️',
    'rings-after-rain',
    1,
    'rings',
    'Closed the ring on the day you returned after rain',
    'What do you do when the rain stops?',
  ),
  secret(
    'comeback-kid',
    'Comeback Kid',
    '🌤️',
    'rings-after-dormancy',
    1,
    'rings',
    'Returned after a week or more away and closed the ring',
    'A long sleep, then a full day.',
  ),
  secret(
    'perfect-week',
    'Perfect Week',
    '🗓️',
    'perfect-weeks',
    1,
    'weeks',
    'Seven full rings, Monday to Sunday',
    'Seven for seven.',
  ),
  secret(
    'earth-day',
    'Earth Day',
    '🌎',
    'earth-day-logs',
    1,
    'logs',
    'Logged on 22 April',
    'One day a year belongs to the planet.',
  ),
  secret(
    'polymath',
    'Polymath',
    '🧠',
    'categories-in-a-day',
    5,
    'categories',
    'Actions in five categories in one day',
    'A little of nearly everything, all at once.',
  ),
  secret(
    'hat-trick',
    'Hat Trick',
    '🎩',
    'weekly-hat-tricks',
    1,
    'weeks',
    'Claimed all three weeklies in one week',
    'Three out of three, the long way round.',
  ),
  secret(
    'old-growth',
    'Old Growth',
    '🌲',
    'legacy-import',
    1,
    'imports',
    'Brought real logs over from the earlier version of the app',
    'For those who were here before.',
  ),
];

export const BADGE_BY_ID: ReadonlyMap<string, BadgeDef> = new Map(
  BADGES.map((badge) => [badge.id, badge]),
);

export interface PropUnlock {
  badge: string;
  tier: BadgeTier;
  /** The line written to the Island log. `{Tree}` is replaced with the tree's name. */
  logLine: string;
}

/** Which badge tier unlocks each island prop. Exhaustive over the world contract. */
export const PROP_UNLOCK: Readonly<Record<IslandPropId, PropUnlock>> = {
  flowers: {
    badge: 'first-leaf',
    tier: 1,
    logLine: 'The first flowers opened beside {Tree}.',
  },
  birdhouse: { badge: 'ring-collector', tier: 1, logLine: 'A birdhouse went up — 7 rings.' },
  fireflies: { badge: 'on-a-roll', tier: 1, logLine: 'Fireflies arrived — a 7-day streak.' },
  signpost: {
    badge: 'trailblazer',
    tier: 1,
    logLine: 'A signpost marks your path — 10 Move actions.',
  },
  'veggie-patch': {
    badge: 'plant-plate',
    tier: 1,
    logLine: 'A veggie patch took root — 10 Eat actions.',
  },
  lantern: { badge: 'bookworm', tier: 1, logLine: 'A lantern to read by — your first lesson.' },
  swing: { badge: 'grass-toucher', tier: 1, logLine: 'A swing for when you step outside.' },
  compost: {
    badge: 'bin-boss',
    tier: 1,
    logLine: 'A compost heap is cooking — 10 Waste actions.',
  },
  solar: {
    badge: 'watt-watcher',
    tier: 1,
    logLine: 'A solar panel caught the sun — 10 Power actions.',
  },
  pond: { badge: 'drop-saver', tier: 1, logLine: 'A pond filled up — 10 Water actions.' },
  bench: {
    badge: 'loop-maker',
    tier: 1,
    logLine: 'A bench from reclaimed planks — 5 Stuff actions.',
  },
  beehive: {
    badge: 'wild-heart',
    tier: 1,
    logLine: 'Bees moved in — 10 Nature & Voice actions.',
  },
  butterflies: {
    badge: 'well-rounded',
    tier: 1,
    logLine: 'Butterflies came for the variety — all seven categories.',
  },
  birds: { badge: 'ring-collector', tier: 2, logLine: 'Birds found the birdhouse — 30 rings.' },
  turbine: {
    badge: 'watt-watcher',
    tier: 2,
    logLine: 'A wind turbine is turning — 50 Power actions.',
  },
  mushrooms: {
    badge: 'bin-boss',
    tier: 2,
    logLine: 'Mushrooms sprouted in the shade — 50 Waste actions.',
  },
};

/**
 * The world contract's prop order. The game may only import types from the world, so the
 * order is repeated here; a test asserts it equals `ISLAND_PROPS` exactly.
 */
export const ISLAND_PROP_ORDER: readonly IslandPropId[] = [
  'flowers',
  'mushrooms',
  'pond',
  'bench',
  'lantern',
  'turbine',
  'solar',
  'compost',
  'veggie-patch',
  'beehive',
  'birdhouse',
  'birds',
  'butterflies',
  'fireflies',
  'swing',
  'signpost',
];
