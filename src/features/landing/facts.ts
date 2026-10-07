/**
 * The handful of real values the landing page quotes, copied out of the catalogue, the factor
 * engine, the quest pool and the myths so a first-time visitor does not download all of those
 * for five estimates, two quests, one myth and three counts.
 *
 * Nothing here is authored: `facts.test.ts` recomputes every value from the real data and fails
 * when one drifts. After changing a factor, a quest or a myth, copy the new value from that
 * test's failure.
 */

/** What the app assumes before onboarding: the world-average grid and car, unknown water heating. */
export const DEMO_CONTEXT = { region: 'WORLD', heat: 'unknown' } as const;

export const ACTION_COUNT = 51;
export const CATEGORY_COUNT = 7;
export const MYTH_COUNT = 10;

/** One catalogue action at one quantity, estimated under `DEMO_CONTEXT`. */
export interface EstimateFact {
  actionId: string;
  qty: number;
  /** The action's unit, singular: "km", "meal", "minute". */
  unit: string;
  /** Effort the action earns. */
  xp: number;
  /** What the action is compared with. */
  counterfactual: string;
  /** True when the factor follows the user's region. */
  regional: boolean;
  kg: number;
  perUnit: number;
  low: number;
  high: number;
  /** Publisher (or title) of the action's first source; `null` when it lists none. */
  sourceLabel: string | null;
  sourceYear: number | null;
}

const CAR_KM = {
  actionId: 'walk-cycle-instead-of-car',
  unit: 'km',
  xp: 15,
  counterfactual: 'the same trip in an average car',
  regional: true,
  perUnit: 0.2099,
  sourceLabel: 'UK Department for Energy Security and Net Zero',
  sourceYear: 2026,
} as const;

export const ESTIMATE_FACTS: readonly EstimateFact[] = [
  {
    actionId: 'plant-based-meal',
    qty: 1,
    unit: 'meal',
    xp: 15,
    counterfactual: 'a typical meal with meat',
    regional: false,
    kg: 1.52,
    perUnit: 1.52,
    low: 0.97,
    high: 2.6,
    sourceLabel: 'Nature Food',
    sourceYear: 2023,
  },
  { ...CAR_KM, qty: 1, kg: 0.2099, low: 0.14, high: 0.34 },
  { ...CAR_KM, qty: 4, kg: 0.8396, low: 0.56, high: 1.36 },
  { ...CAR_KM, qty: 5, kg: 1.0495, low: 0.7, high: 1.7 },
  {
    actionId: 'shorter-shower',
    qty: 2,
    unit: 'minute',
    xp: 12,
    counterfactual: 'the same shower, that many minutes longer',
    regional: true,
    kg: 0.1038987,
    perUnit: 0.0519493,
    low: 0.062,
    high: 0.3,
    sourceLabel: 'US Environmental Protection Agency',
    sourceYear: 2026,
  },
];

/** The estimate for this action and quantity, or `null` when the page has no copy of it. */
export function estimateFact(actionId: string, qty: number): EstimateFact | null {
  return ESTIMATE_FACTS.find((fact) => fact.actionId === actionId && fact.qty === qty) ?? null;
}

/** A daily quest as its card shows it. */
export interface QuestFact {
  id: string;
  title: string;
  copy: string;
  /** The quest's pool; a category id when the quest belongs to one. */
  pool: string;
  xp: number;
}

export const QUEST_FACTS = {
  fiveK: {
    id: 'd_five_k',
    title: 'Five by muscle',
    copy: "Walk or cycle 5 km you'd have driven",
    pool: 'move',
    xp: 25,
  },
  plantPlate: {
    id: 'd_plant_plate',
    title: 'Plant plate',
    copy: 'One plant-based meal',
    pool: 'eat',
    xp: 15,
  },
} as const satisfies Record<string, QuestFact>;

/** The one myth card the tour flips. */
export const MYTH_FACT = {
  id: 'recycling-best',
  verdictLabel: 'False.',
  myth: '"Recycling is the best thing I can do for the climate."',
  explanation:
    'Recycling everything saves about 0.2 t CO2e a year. Living car-free saves about 2.4 t, and a plant-based diet about 0.8 t. Recycle, and then look at travel, heat and food.',
  source: { publisher: 'Wynes and Nicholas', year: 2017 },
} as const;
