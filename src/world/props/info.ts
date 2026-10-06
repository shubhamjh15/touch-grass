import { ISLAND_PROPS, LANDMARKS, type IslandPropId, type LandmarkId } from '../contract';

/**
 * What each thing on the island is called and what earned it (product spec 5.2), in the
 * plain words of the callout a tap shows and of the description screen readers get. The
 * world does not know the game: these lines state the rule, never the user's own numbers.
 */

export interface PartInfo {
  name: string;
  /** One short sentence: what earned it, or where the landmark leads. */
  note: string;
}

export const PROP_INFO: Record<IslandPropId, PartInfo> = {
  flowers: { name: 'Flowers', note: 'Opened with your first action.' },
  mushrooms: { name: 'Mushrooms', note: 'Sprouted in the shade after 50 Waste actions.' },
  pond: { name: 'Pond life', note: 'Lilies and a duck moved in after 10 Water actions.' },
  bench: { name: 'Bench', note: 'Built from reclaimed planks after 5 Stuff actions.' },
  lantern: { name: 'Lantern', note: 'A light to read by, for your first lesson passed.' },
  turbine: { name: 'Wind turbine', note: 'Turning since 50 Power actions.' },
  solar: { name: 'Solar panel', note: 'Caught the sun after 10 Power actions.' },
  compost: { name: 'Compost heap', note: 'Cooking since 10 Waste actions.' },
  'veggie-patch': { name: 'Veggie patch', note: 'Took root after 10 Eat actions.' },
  beehive: { name: 'Beehive', note: 'Bees moved in after 10 Nature actions.' },
  birdhouse: { name: 'Birdhouse', note: 'Went up at 7 rings: seven days you showed up.' },
  birds: { name: 'Birds', note: 'Found the birdhouse at 30 rings.' },
  butterflies: {
    name: 'Butterflies',
    note: 'Came for the variety: an action in all seven categories.',
  },
  fireflies: { name: 'Fireflies', note: 'Arrived with a 7-day streak. Look for them after dark.' },
  swing: { name: 'Swing', note: 'For stepping outside: your first Touch grass break.' },
  signpost: { name: 'Signpost', note: 'Marks your path after 10 Move actions.' },
};

export const LANDMARK_INFO: Record<LandmarkId, PartInfo & { action: string }> = {
  log: { name: 'Watering can', note: 'Log something you did today.', action: 'Log an action' },
  quests: { name: 'Notice board', note: 'Today’s quests are pinned here.', action: 'See quests' },
  learn: { name: 'Book stack', note: 'Short lessons and myth-busters.', action: 'Open Learn' },
  impact: {
    name: 'Ring medallion',
    note: 'One growth ring for every milestone of days you showed up.',
    action: 'See your impact',
  },
  community: { name: 'Mailbox', note: 'Notes from the community.', action: 'Open Community' },
  coach: { name: 'Moss', note: 'Your coach. Ask anything.', action: 'Ask Moss' },
  me: {
    name: 'Passport tag',
    note: 'Your passport, badges and settings.',
    action: 'Open passport',
  },
};

const isProp = (id: string): id is IslandPropId => (ISLAND_PROPS as readonly string[]).includes(id);
const isLandmark = (id: string): id is LandmarkId => (LANDMARKS as readonly string[]).includes(id);

export type PartRef =
  | { kind: 'prop'; id: IslandPropId; info: PartInfo }
  | { kind: 'landmark'; id: LandmarkId; info: PartInfo & { action: string } };

/** Reads a hit-test part name (`prop:bench`, `landmark:coach`); `null` for tree, ground, water. */
export function describePart(part: string): PartRef | null {
  const [kind, id] = part.split(':');
  if (kind === 'prop' && id !== undefined && isProp(id)) {
    return { kind, id, info: PROP_INFO[id] };
  }
  if (kind === 'landmark' && id !== undefined && isLandmark(id)) {
    return { kind, id, info: LANDMARK_INFO[id] };
  }
  return null;
}

/** One sentence listing what stands on the island, for the stage's text alternative. */
export function describeIsland(props: readonly IslandPropId[]): string {
  if (props.length === 0) return 'The island is bare for now: props arrive as you earn badges.';
  const names = ISLAND_PROPS.filter((id) => props.includes(id)).map((id) =>
    PROP_INFO[id].name.toLowerCase(),
  );
  const last = names.pop();
  return names.length === 0
    ? `On the island: ${last}.`
    : `On the island: ${names.join(', ')} and ${last}.`;
}
