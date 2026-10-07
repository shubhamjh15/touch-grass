import type { BaselineQuestionId, BaselineSegment } from '@/data/catalogue';
import type { DayKey } from '@/lib/dates';
import { formatNumber, formatStampDate, pluralize } from '@/lib/format';
import type { Species } from '@/world';

/** Words of the first-run flow, in one place so the voice stays consistent (design bible, section 9). */

export const SPECIES_COPY: Readonly<Record<Species, { name: string; line: string; noun: string }>> =
  {
    oak: { name: 'Oak', line: 'Steady and broad.', noun: 'oak' },
    cherry: { name: 'Cherry blossom', line: 'The show-off.', noun: 'cherry blossom' },
    pine: { name: 'Pine', line: 'Evergreen and upright.', noun: 'pine' },
  };

/** The suggester's names (product spec 11.3). Every one fits the 16-character limit. */
export const TREE_NAMES = [
  'Juniper',
  'Pip',
  'Sol',
  'Willow',
  'Bean',
  'Fig',
  'Sage',
  'Twig',
  'Maple',
  'Kodama',
  'Pico',
  'Moss Jr.',
] as const;

/** What the quiz asks about, as a short slug above each question. */
export const QUESTION_SLUG: Readonly<Record<BaselineQuestionId, string>> = {
  diet: 'Food',
  transportMode: 'Getting around',
  weeklyDistance: 'Distance',
  flights: 'Flights',
  homeEnergy: 'Home',
  shopping: 'Stuff',
};

/** One plain sentence per segment for "Your biggest levers". No judgement, only where the weight sits. */
export const LEVER_COPY: Readonly<Record<BaselineSegment, string>> = {
  food: 'What is on your plate carries the most weight. A few plant-based meals a week move this number.',
  transport:
    'Everyday trips add up. Swapping some of them for feet, pedals or a shared seat is the lever here.',
  flights:
    'Flying is a big slice. One trip by train, or one trip fewer, changes it more than most habits.',
  home: 'Heating, cooling and hot water lead here. A degree on the thermostat and cooler washes help.',
  stuff:
    'New things carry their making with them. Mending, borrowing and second-hand shrink this slice.',
};

/** Quiz answers are long sentences in the evidence base: "Title - detail". Split them for a two-line button. */
export function splitOptionLabel(raw: string): { title: string; detail: string | null } {
  const label = raw.replace(/(\d)-(\d)/g, '$1–$2');
  const dash = label.indexOf(' - ');
  if (dash > 0) return { title: label.slice(0, dash), detail: sentence(label.slice(dash + 3)) };
  const paren = /^(.*?)\s*\((.+)\)$/.exec(label);
  if (paren && paren[1] && paren[2]) return { title: paren[1], detail: sentence(paren[2]) };
  const comma = label.indexOf(', ');
  if (comma > 0 && label.length > 34) {
    return { title: label.slice(0, comma), detail: sentence(label.slice(comma + 2)) };
  }
  return { title: label, detail: null };
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Kilometres with miles alongside, for the distance question's hint. */
export const KM_PER_MILE = 1.609344;

/**
 * "25–75 km" → "About 15–45 miles": the same band for people who think in miles. Rounded to
 * the nearest five, because the bands themselves are rough.
 */
export function milesHint(kmLabel: string): string | null {
  const numbers = kmLabel.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  const miles = numbers.map((value) =>
    formatNumber(Math.max(5, Math.round(Number(value) / KM_PER_MILE / 5) * 5)),
  );
  if (miles.length >= 2) return `About ${miles[0]}–${miles[1]} miles`;
  const lead = /^(under|over)\b/i.exec(kmLabel.trim())?.[1];
  return lead
    ? `${sentence(lead.toLowerCase())} about ${miles[0]} miles`
    : `About ${miles[0]} miles`;
}

/** "06 OCT 2026": the stamp's date, from a local day key. */
export function labelDate(day: DayKey): string {
  return formatStampDate(day);
}

/** The three promises of the first screen (product spec 11.3). */
export const PROMISES = [
  { id: 'private', title: 'Private', line: 'Everything stays on this device. No account.' },
  { id: 'honest', title: 'Honest', line: 'Estimates come with their sources.' },
  { id: 'kind', title: 'Kind', line: 'Miss a day and it rains. Your tree never dies.' },
] as const;

export const COPY = {
  back: 'Back',
  next: 'Next',
  storage: "Private window: progress won't be saved.",
  challenge: (from: string | null) =>
    from
      ? `${from}'s challenge is waiting. It opens once your tree is planted.`
      : 'A challenge is waiting. It opens once your tree is planted.',
  legacy: {
    slug: 'Welcome back',
    title: 'Bring your old logs along?',
    body: (count: number) =>
      `We found ${pluralize(count, 'action')} from the earlier version of this app on this device. They come along without a CO2e figure.`,
    placeholders: 'Entries that were placeholders are left out.',
    bring: 'Bring them',
    fresh: 'Start fresh',
  },
  promise: {
    slug: 'Seed in the soil',
    lettering: "Let's plant.",
    lead: 'Grow a living tree by shrinking your footprint. It takes about a minute.',
    foot: 'Welcome',
    cta: "Let's plant",
  },
  you: {
    slug: 'About you',
    title: 'What should we call you?',
    nameLabel: 'Your name',
    nameHint: 'Optional. Stays on this device. Never sent anywhere.',
    namePlaceholder: 'Friend',
    homeLabel: "Where's home?",
    homeReason: 'Electricity is cleaner in some places than others, so we use your grid.',
  },
  tree: {
    slug: 'Your tree',
    title: 'Pick a tree',
    nameLabel: 'Name it',
    nameHint: 'Up to 16 characters. You can rename it later.',
    suggest: 'Suggest a name',
  },
  line: {
    slug: 'Starting line',
    title: 'Know where you start?',
    lead: 'A quick quiz gives you a rough yearly footprint to measure your progress against. It is optional and never graded.',
    take: 'Take the 60-second quiz',
    // The quiz opens with "Where's home?" when no region was picked: its counter then reads "1 / 7".
    takeLine: (screens: number) =>
      `${screens === 7 ? 'Seven' : screens === 6 ? 'Six' : screens} questions. Tap an answer and it moves on.`,
    resume: 'Carry on with the quiz',
    review: 'See your result',
    reviewLine: 'Your answers are kept.',
    skip: 'Skip for now',
    skipLine: 'No penalty. You can take it any time from Me.',
  },
  quiz: {
    slug: 'Starting line',
    later: 'Finish later',
    regionTitle: "Where's home?",
    regionLead: 'Electricity is cleaner in some places than others, so we use your grid.',
  },
  result: {
    slug: 'Starting line',
    title: 'Your starting line',
    unit: 'tonnes',
    perYear: 'a year',
    caption: "A rough estimate, give or take 40%. It's a starting line, not a grade.",
    scope:
      'It covers food, getting around, flights, home energy and stuff. It leaves out public services and infrastructure, about a quarter to a third of a full footprint.',
    compared: 'Starting-line model, world-average electricity unless you chose a region',
    source: 'Starting-line model, version 1',
    levers: 'Your biggest levers',
    light: 'You already live light. Keep it up and keep it growing.',
    useThese: 'Use these as my focus',
    pickOwn: 'Pick my own',
    how: 'How this is calculated',
  },
  focus: {
    slug: 'Focus areas',
    title: 'Pick up to three.',
    caption: "We'll tilt your quests toward these.",
    limit: 'Three is the limit. Peel one off first.',
    none: 'Pick at least one area.',
  },
  comfort: {
    slug: 'Comfort',
    title: 'Set it up your way',
    cta: 'Go plant',
    later: 'All of this lives in Me, any time.',
    sound: 'Sound',
    soundLine: 'Soft paper sounds when you stick, peel and plant.',
    motion: 'Motion',
    motionLine: {
      system: 'Follows your device setting.',
      reduced: 'Calm: fades instead of flourishes.',
      full: 'Full: everything moves.',
    },
    graphics: 'The grove',
    graphicsLine: {
      auto: 'The living 3D island, tuned to your device.',
      low: 'A lighter 3D island that is easier on battery.',
      off: 'A still illustration. No 3D at all.',
    },
    noWebgl: "This browser can't draw the 3D island, so the illustration is shown.",
  },
  ceremony: {
    slug: 'The seed',
    // A name that ends in a full stop ("Moss Jr.") already closes the sentence.
    hold: (tree: string) => `Press and hold to plant ${tree}${tree.endsWith('.') ? '' : '.'}`,
    holdHint: 'Hold for one and a half seconds. Or use the Plant button.',
    plant: 'Plant',
    planting: 'Planting…',
    stamp: 'Planted',
    planted: (tree: string) => `${tree} is planted.`,
    ring: 'Ring 1 is yours.',
    firstLeaf: (tree: string) => `Give ${tree} its first leaf`,
    onward: 'Carry on',
    challenge: 'Your challenge is next.',
  },
} as const;
