/**
 * Every sentence the Log page says (design bible section 9; product spec 3.3, 3.4, 3.6 and
 * 12.1). Kept in one place so the voice stays one voice: paper verbs for what the app does,
 * plain verbs for what the person did, "≈" and "avoided" for every figure.
 */
import type { CatalogueActionId, CategoryId } from '@/data/catalogue';
import type { HeatSource, LogKind } from '@/game';
import { formatNumber } from '@/lib/format';

export const COPY = {
  title: 'Log',
  lead: (tree: string) => `Peel one, pick an amount, stick it on ${tree}.`,
  slug: (actions: number, kinds: number) =>
    `${formatNumber(actions)} actions · ${formatNumber(kinds)} kinds`,
  search: {
    label: 'Search actions',
    placeholder: (actions: number) => `Search ${formatNumber(actions)} actions`,
    tab: 'Results',
    count: (count: number) =>
      count === 1 ? '1 action found' : `${formatNumber(count)} actions found`,
    missSlug: 'Not on the sheet',
    miss: 'Not in the catalogue. Log it as a custom action?',
    missAction: 'Log a custom action',
    clear: 'Clear search',
  },
  tabs: {
    label: 'Kinds of action',
    forYou: 'For you',
  },
  sheet: {
    label: 'Sticker sheet',
    maxed: 'Maxed',
    done: 'Done',
    covered: 'Covered',
    resting: 'Later',
    hiddenAllSlug: 'Nothing on this page',
    hiddenAll: "You've hidden everything here.",
    manageHidden: 'Manage hidden actions',
    hiddenToggle: (count: number) =>
      count === 1 ? '1 hidden here' : `${formatNumber(count)} hidden here`,
    show: 'Show',
    hide: 'Tuck away',
    bringBack: 'Bring back',
    maxedName: (title: string) => `${title}. Maxed for today: adds kilograms, not XP.`,
    blockedName: (title: string, why: string) => `${title}. ${why}`,
  },
  notForMe: {
    button: 'Not for me',
    title: (label: string) => `Hide “${label}”?`,
    body: 'It leaves the sheet, the quick row and Moss’s suggestions, and quests stop asking for it. Bring it back any time.',
    confirm: 'Hide it',
    cancel: 'Keep it',
    done: (label: string) => `“${label}” is tucked away.`,
    undo: 'Bring back',
  },
  custom: {
    slotTitle: 'Something else?',
    slotBody: 'Log a custom action.',
    slotButton: 'Log a custom action',
    title: 'Log a custom action',
    whatLabel: 'What did you do?',
    whatHint: '3 to 80 characters. Plain words are fine.',
    whatPlaceholder: 'Mended a tent, shared a lawnmower…',
    tooShort: 'Describe it in at least three characters.',
    privacy: 'Only this sentence is sent for an estimate, and only when an AI coach is set up.',
    qtyLabel: 'How many or how far? (optional)',
    qtyError: 'Enter a number above zero, or leave it empty.',
    next: 'Look it up',
    looksLike: 'Looks like something on the sheet.',
    looksLikeBody: 'Catalogue actions come with a sourced estimate, so pick one if it fits.',
    logThat: (label: string) => `Log “${label}”`,
    somethingElse: 'No, something else',
    estimating: 'Asking for an estimate…',
    back: 'Back',
    reviewTitle: 'Check it over',
    nameLabel: 'Name on the sticker',
    categoryLabel: 'Kind',
    effortLabel: 'Effort',
    effort: ['Tiny', 'Small', 'Solid', 'Big'] as const,
    effortHint: [
      'Seconds.',
      'Minutes, mildly inconvenient.',
      'A real choice.',
      'Planning, or half an hour and more.',
    ] as const,
    keep: 'Keep in My actions',
    keepHint: 'One tap next time, with the same estimate.',
    keepFull: 'My actions is full (12). Remove one to keep another.',
    stick: 'Stick it on',
    notQuantified: 'Impact not quantified. XP for showing up.',
    aiLabel: 'AI estimate, low confidence',
    aiNote: 'Kept out of your headline total. Capped at 2 kg a log.',
    dropNumber: 'Log without a number',
    restoreNumber: 'Use the estimate',
    sourceAi: 'Filled in by the AI. Change anything.',
    sourceLocal: 'A built-in guess from your words, not an AI estimate. Change anything.',
    sourceManual: 'Pick a kind and an effort.',
    offline: 'AI estimate needs a connection.',
    failed: 'The estimate didn’t come through. Pick a kind and an effort yourself.',
    noAi: 'No live AI on this server, so there is no kilogram figure.',
    notClimate:
      'The AI doesn’t see a climate action in that. Log it by hand if you do, or save it for your journal.',
    capReached: 'Two custom actions already earned XP today. This one adds no XP.',
    saved: 'Kept in My actions.',
  },
  mine: {
    title: 'My actions',
    meta: (count: number, max: number) => `${formatNumber(count)} of ${formatNumber(max)}`,
    stick: 'Stick on',
    remove: 'Remove',
    removed: (title: string) => `“${title}” removed from My actions.`,
    notQuantified: 'Not quantified',
  },
  ledger: {
    title: 'Stuck today',
    label: 'Actions logged today',
    emptySlug: 'Nothing stuck yet',
    empty: 'Nothing stuck yet today. Your first action is one tap away.',
    undo: 'Undo',
    delete: 'Delete',
    notQuantified: 'Not quantified',
    kgOnly: 'No XP',
    deleteTitle: 'Peel this one off?',
    deleteBody: (title: string) =>
      `“${title}” leaves today’s list, and its XP and kilograms go with it. Today is re-counted.`,
    deleteConfirm: 'Peel it off',
    deleteCancel: 'Keep it',
    receiptActions: 'Actions',
    receiptXp: 'XP from logs',
    receiptAi: 'AI estimates',
    receiptTotal: 'Est. CO2e avoided',
    receiptNote: 'Estimates, compared with what each action replaced.',
    methodology: 'How we estimate',
  },
  quick: {
    stick: 'Stick it on',
    amount: 'How much?',
    custom: 'Custom',
    amountLabel: 'Amount',
    less: 'Less',
    more: 'More',
    avoided: 'avoided',
    versus: (counterfactual: string) => `vs. ${counterfactual}`,
    notQuantified: 'Impact not quantified. XP for showing up.',
    rough: 'Rough estimate: depends a lot on your situation',
    likely: (low: string, high: string) => `Likely between ${low} and ${high}.`,
    how: 'How we estimate this',
    maxed: 'Maxed for today. This one adds kilograms, not XP.',
    overCap: "That's more than a day can hold. Typo?",
    capLeft: (left: string) => `Up to ${left} more today.`,
    invalid: 'Enter an amount above zero.',
    household: 'One log covers the whole household.',
    once: (unit: string) => `Once a day: ${unit}.`,
    zeroCommute:
      'Careful: at this distance working from home may not cut emissions (home energy outweighs the short drive).',
    people: 'People in the car',
    peopleOption: (count: number) => `${formatNumber(count)} people`,
    commute: 'Round-trip commute by car',
    commuteCustom: 'Other',
    commuteError: 'Between 1 and 300 km.',
    heatingOn: 'Heating or cooling was on at home',
    heatingOnHint: 'It usually is. Switch it off only if the house ran on a laptop and a kettle.',
    variant: 'What kind?',
    heat: 'How is your heating and hot water powered?',
    heatHint: 'Asked once. It changes the estimate; change it any time under Me.',
    secondhand: 'What was it?',
    secondhandTop: 'A top',
    secondhandJeans: 'Jeans or heavier',
    flightUnknown: "I don't know the distance",
    flightUnknownHint: 'Counts a one-way short flight of about 500 km.',
    recyclingLead: 'Count what went in the right bin. One log per material.',
    recyclingRewarded: 'The first two materials a day earn XP; the rest add kilograms.',
    recyclingNothing: 'Add at least one thing.',
    total: 'Total',
    kind: { swap: 'Swap', keep: 'Keep', unrated: '' } satisfies Record<LogKind, string>,
  },
  toast: {
    unknown: "That action isn't in the catalogue any more.",
    refused: 'That one didn’t stick.',
    saveFailed: 'This device is full, so the log is only in memory for now.',
    saveFailedAction: 'Export my data',
    exportFailed: 'The export didn’t start. Try again from Me.',
  },
} as const;

/** Notes the sheet always shows for an action, beyond the catalogue's own `sheetNote`. */
export const EXTRA_NOTES: Partial<Record<CatalogueActionId, string>> = {
  'ebike-escooter-instead-of-car':
    'Shared scooters often replace walking. Log those only if they replaced a car trip.',
  'thermostat-down-1c': 'One log covers the whole household.',
};

/** Litres a person leaves running if the tap stays on while brushing, for the tap action's headline. */
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

/** The category words used in running text ("a Move action"). */
export const KIND_WORD: Readonly<Record<CategoryId, string>> = {
  move: 'Move',
  eat: 'Eat',
  power: 'Power',
  water: 'Water',
  stuff: 'Stuff',
  waste: 'Waste',
  nature: 'Nature',
};
