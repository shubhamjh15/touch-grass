import type { BaselineQuestionId } from '@/data/catalogue';
import { pluralize } from '@/lib/format';
import type { Species } from '@/world';

/** Words of the first-run flow, in one place so the voice stays consistent: short and plain. */

export const SPECIES_COPY: Readonly<Record<Species, { name: string; line: string; noun: string }>> =
  {
    oak: { name: 'Oak', line: 'Steady and broad', noun: 'oak' },
    cherry: { name: 'Cherry', line: 'The show-off', noun: 'cherry blossom' },
    pine: { name: 'Pine', line: 'Evergreen and upright', noun: 'pine' },
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

/**
 * How each quiz question is asked on screen: a short headline and, where the evidence base's
 * own wording says more, one line under it. The answers and their values stay the evidence
 * base's own.
 */
export const QUESTION_COPY: Readonly<Record<BaselineQuestionId, { title: string; lead?: string }>> =
  {
    diet: { title: 'How do you eat?' },
    transportMode: { title: 'How do you get around?', lead: 'Most days.' },
    weeklyDistance: {
      title: 'How far in a week?',
      lead: 'All your everyday trips, roughly.',
    },
    flights: { title: 'How much do you fly?', lead: 'In a typical year.' },
    homeEnergy: { title: 'Which sounds like home?' },
    shopping: { title: 'How much new stuff?', lead: 'Clothes, gadgets, furniture, appliances.' },
  };

/**
 * Quiz answers are the evidence base's own sentences ("Title - detail"). The words stay as they
 * are; they are only laid out on two lines, and number ranges get a proper dash.
 */
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

/** "food", "food and flights", "food, flights and home". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`;
}

export const COPY = {
  legacy: {
    title: 'Bring your old logs along?',
    lead: (count: number) =>
      `We found ${pluralize(count, 'action')} from the earlier version of this app. They come without a CO2e figure.`,
    bring: 'Bring them',
    fresh: 'Start fresh',
  },
  name: {
    title: 'What should we call you?',
    label: 'Your name',
    hint: 'Optional. It stays on this device.',
    placeholder: 'Friend',
  },
  tree: {
    title: 'Pick your tree',
    species: 'Species',
    nameLabel: 'Name it',
    nameHint: 'You can rename it later.',
    suggest: 'Suggest a name',
  },
  line: {
    title: 'Want a starting line?',
    lead: 'A one-minute quiz gives you a rough yearly footprint to measure your progress against.',
    take: 'Take the quiz',
    resume: 'Carry on with the quiz',
    review: 'See your result',
    skip: 'Skip for now',
    later: 'You can take it any time from Me.',
  },
  quiz: {
    position: (index: number, total: number) => `Question ${index} of ${total}`,
    skip: 'Skip for now',
  },
  result: {
    title: 'Your starting line',
    unit: 'tonnes',
    perYear: 'a year',
    caption: "A rough estimate, give or take 40%. It's a starting line, not a grade.",
    parts: 'Where it comes from',
    scope: 'Day-to-day choices only. Public services and infrastructure are left out.',
    focus: (areas: string) => `Your quests will start with ${areas}.`,
    light: 'You already live light.',
    covers:
      'A coarse estimate from your answers, on the world-average electricity grid unless you set a region. It covers food, getting around, flights, home energy and stuff, and leaves out public services and infrastructure: about a quarter to a third of a full footprint.',
    source: 'Starting-line model, version 1',
  },
  plant: {
    title: (tree: string) => `Ready to plant ${tree}?`,
    lead: 'It starts as a seed and grows with every action you log.',
    cta: (tree: string) => `Plant ${tree}`,
    planted: (tree: string) => `${tree} is planted.`,
    toToday: 'Taking you to your tree.',
    toChallenge: 'Taking you to your challenge.',
    toElsewhere: 'Taking you where you were headed.',
    onward: 'Continue',
  },
  storage: "Private window: progress won't be saved.",
  challenge: (from: string | null) =>
    from
      ? `${from}'s challenge opens once your tree is planted.`
      : 'Your challenge opens once your tree is planted.',
  next: 'Continue',
  back: 'Back',
} as const;
