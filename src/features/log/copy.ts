/**
 * Every sentence the Log page says (product spec 3.3, 3.4 and 3.6, in the calm voice of the
 * UX directive). Kept in one place so the voice stays one voice: short words, plain verbs,
 * "≈" and "avoided" for every figure.
 */
import type { CatalogueActionId } from '@/data/catalogue';
import type { HeatSource } from '@/game';
import { formatNumber } from '@/lib/format';

export const COPY = {
  title: 'What did you do?',
  lead: 'Pick an action. Your tree grows with each one.',
  search: {
    label: 'Search actions',
    placeholder: 'Search actions',
    results: (count: number) =>
      count === 1 ? '1 action found' : `${formatNumber(count)} actions found`,
    miss: (query: string) => `Nothing matches “${query}”. You can still log it.`,
  },
  chips: {
    label: 'Filter by kind',
  },
  grid: {
    label: 'Actions',
    showAll: (count: number) => `Show all ${formatNumber(count)} actions`,
    showFewer: 'Show fewer',
    allHidden: 'You have hidden every action of this kind.',
  },
  hidden: {
    link: (count: number) =>
      count === 1 ? '1 hidden action' : `${formatNumber(count)} hidden actions`,
    title: 'Hidden actions',
    body: 'Hidden actions stay out of your list and your quests.',
    show: 'Show again',
    hide: 'Hide this action',
    done: (label: string) => `“${label}” is hidden.`,
    undo: 'Undo',
  },
  custom: {
    tile: 'Something else',
    title: 'Something else',
    whatLabel: 'What did you do?',
    whatHint: 'A few plain words are enough.',
    whatPlaceholder: 'Mended a tent',
    privacy: 'Only this sentence is sent for an estimate, and only when an AI coach is set up.',
    tooShort: 'Use at least three characters.',
    next: 'Continue',
    looksLike: 'Is it one of these?',
    looksLikeBody: 'These come with a sourced estimate.',
    somethingElse: 'No, something else',
    estimating: 'Working out an estimate…',
    back: 'Back',
    reviewTitle: 'Check and log',
    nameLabel: 'Name',
    categoryLabel: 'Kind',
    effortLabel: 'Effort',
    effort: ['Tiny', 'Small', 'Solid', 'Big'] as const,
    keep: 'Save for next time',
    keepFull: 'Your saved list is full (12). Remove one first.',
    log: 'Log it',
    notQuantified: 'Impact not estimated. You still earn XP.',
    aiLabel: 'AI estimate, low confidence. Kept out of your total.',
    dropNumber: 'Log without a number',
    restoreNumber: 'Use the estimate',
    sourceAi: 'Estimated by AI. Change anything.',
    sourceLocal: 'A built-in guess, not an AI estimate. Change anything.',
    sourceManual: 'Pick a kind and an effort.',
    offline: 'You are offline, so there is no AI estimate. Pick a kind and an effort.',
    failed: 'The estimate did not arrive. Pick a kind and an effort.',
    noAi: 'No AI coach is set up, so there is no kilogram figure.',
    notClimate: 'The AI does not see a climate action here. Log it by hand if you do.',
    capReached: 'Two custom actions earned XP today. This one adds none.',
    saved: 'Saved for next time.',
    savedTitle: 'Saved actions',
    logSaved: (title: string) => `Log “${title}”`,
    removeSaved: (title: string) => `Remove “${title}”`,
    removed: (title: string) => `“${title}” removed.`,
  },
  today: {
    title: (count: number) => `Logged today (${formatNumber(count)})`,
    label: 'Actions logged today',
    empty: 'Nothing logged yet today.',
    undo: 'Undo',
    undoName: (title: string) => `Undo ${title}`,
    notQuantified: 'Not estimated',
    deleteTitle: 'Remove this log?',
    deleteBody: (title: string) => `“${title}” leaves today, with its XP and kilograms.`,
    deleteConfirm: 'Remove it',
    deleteCancel: 'Keep it',
    impact: 'See your impact',
  },
  quick: {
    log: 'Log it',
    amount: 'How much?',
    presets: 'Quick amounts',
    less: 'Less',
    more: 'More',
    avoided: 'avoided',
    versus: (counterfactual: string) => `Compared with ${counterfactual}.`,
    notQuantified: 'Impact not estimated. You still earn XP.',
    context: 'Shown as context, never added to your total. You still earn XP.',
    rough: (low: string, high: string) => `Rough estimate: likely between ${low} and ${high}.`,
    maxed: 'Maxed for today. This adds kilograms, not XP.',
    noXp: 'No XP',
    overCap: 'That is more than a day can hold.',
    capLeft: (left: string) => `Up to ${left} more today.`,
    invalid: 'Enter an amount above zero.',
    household: 'One log covers the whole household.',
    zeroCommute:
      'Careful: at this distance working from home may not cut emissions (home energy outweighs the short drive).',
    people: 'People in the car',
    commute: 'Round trip by car',
    commuteError: 'Between 1 and 300 km.',
    heatingOn: 'Heating or cooling was on at home',
    variant: 'What kind?',
    heat: 'How is your home heated?',
    heatHint: 'Asked once. It changes the estimate.',
    secondhand: 'What was it?',
    secondhandTop: 'A top',
    secondhandJeans: 'Jeans or heavier',
    flightUnknown: 'I do not know the distance',
    flightUnknownHint: 'Counts a one-way short flight of about 500 km.',
    recyclingLead: 'Count what went in the right bin.',
    recyclingRewarded: 'The first two materials a day earn XP. The rest add kilograms.',
    recyclingNothing: 'Add at least one thing.',
    water: 'litres of water',
  },
  toast: {
    unknown: 'That action is not in the list any more.',
    saveFailed: 'This device is full, so the log is only in memory for now.',
    saveFailedAction: 'Export my data',
    exportFailed: 'The export did not start. Try again from Me.',
  },
} as const;

/** Notes the sheet always shows for an action, beyond the catalogue's own `sheetNote`. */
export const EXTRA_NOTES: Partial<Record<CatalogueActionId, string>> = {
  'ebike-escooter-instead-of-car':
    'Shared scooters often replace walking. Log those only if they replaced a car trip.',
  'thermostat-down-1c': 'One log covers the whole household.',
};

/**
 * Water a day kept in the pipes by turning the tap off while brushing: the catalogue's own
 * figure for this action (8 US gallons, EPA WaterSense), rounded as its evidence note says.
 */
export const TAP_LITRES_PER_DAY = 30;

export const HEAT_OPTIONS: readonly { value: HeatSource; label: string }[] = [
  { value: 'gas', label: 'Gas or oil' },
  { value: 'electric', label: 'Electricity' },
  { value: 'heat-pump', label: 'Heat pump' },
  { value: 'none', label: "We don't heat" },
  { value: 'unknown', label: 'Not sure' },
];

/** Short names for the materials of the recycling tile. */
export const MATERIAL_LABEL: Readonly<Record<string, string>> = {
  'recycle-aluminium-can': 'Aluminium cans',
  'recycle-glass-bottle': 'Glass bottles or jars',
  'recycle-plastic-bottle': 'Plastic bottles',
  'recycle-paper': 'Paper or cardboard',
};
