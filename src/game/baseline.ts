/**
 * The starting line: a coarse lifestyle footprint from six answers (product spec
 * section 6). The model, its options and its numbers come verbatim from the evidence
 * base; this module only evaluates them.
 */
import {
  BASELINE_MODEL,
  BASELINE_QUESTIONS,
  GROUP_BY_ID,
  type BaselineOption,
  type BaselineQuestionId,
  type BaselineSegment,
  type CategoryId,
} from '@/data/catalogue';
import type { DayKey } from '@/lib/dates';
import { gridIntensity } from './co2';
import { DEFAULT_FOCUS, LOW_FOOTPRINT_TONNES } from './economy';
import type {
  BaselineAnswers,
  BaselineResult,
  BaselineTonnes,
  HeatSource,
  LogKind,
  RegionId,
} from './types';

export const BASELINE_SEGMENTS: readonly BaselineSegment[] = [
  'food',
  'transport',
  'flights',
  'home',
  'stuff',
];

export const BASELINE_SEGMENT_LABELS: Readonly<Record<BaselineSegment, string>> = {
  food: 'Food',
  transport: 'Getting around',
  flights: 'Flights',
  home: 'Home',
  stuff: 'Stuff',
};

/** Segment to the categories a user would act in, most direct first. */
const SEGMENT_CATEGORIES: Readonly<Record<BaselineSegment, readonly CategoryId[]>> = {
  transport: ['move'],
  flights: ['move'],
  food: ['eat'],
  home: ['power', 'water'],
  stuff: ['stuff', 'waste'],
};

const QUESTION_IDS = BASELINE_QUESTIONS.map((question) => question.id);

function optionOf(id: BaselineQuestionId, answer: string): BaselineOption | undefined {
  return BASELINE_QUESTIONS.find((question) => question.id === id)?.options.find(
    (option) => option.id === answer,
  );
}

/** Narrows unknown input to a complete, valid set of answers; `null` when any is missing or unknown. */
export function parseBaselineAnswers(input: unknown): BaselineAnswers | null {
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  const answers: Partial<BaselineAnswers> = {};
  for (const id of QUESTION_IDS) {
    const value = record[id];
    if (typeof value !== 'string' || !optionOf(id, value)) return null;
    answers[id] = value;
  }
  return answers as BaselineAnswers;
}

/** Tonnes CO2e per person per year, unrounded. Shown to one decimal with "≈". */
export function computeBaseline(answers: BaselineAnswers, region: RegionId): BaselineTonnes {
  const grid = gridIntensity(region);
  const diet = optionOf('diet', answers.diet);
  const mode = optionOf('transportMode', answers.transportMode);
  const distance = optionOf('weeklyDistance', answers.weeklyDistance);
  const flying = optionOf('flights', answers.flights);
  const homeEnergy = optionOf('homeEnergy', answers.homeEnergy);
  const shopping = optionOf('shopping', answers.shopping);

  const modeFactor = mode?.gridScaled
    ? (mode.kWhPerKm ?? 0) * grid
    : (mode?.regional?.[region] ?? mode?.kgCO2ePerKm ?? 0);

  const food = diet?.tCO2ePerYear ?? 0;
  const transport = ((distance?.kmPerWeek ?? 0) * BASELINE_MODEL.weeksPerYear * modeFactor) / 1000;
  const flights = flying?.tCO2ePerYear ?? 0;
  const home =
    ((homeEnergy?.electricityKWh ?? 0) * grid +
      (homeEnergy?.gasKWh ?? 0) * BASELINE_MODEL.gasKgPerKWh) /
    1000;
  const stuff = shopping?.tCO2ePerYear ?? 0;
  return {
    food,
    transport,
    flights,
    home,
    stuff,
    total: food + transport + flights + home + stuff,
  };
}

export function buildBaselineResult(
  answers: BaselineAnswers,
  region: RegionId,
  takenDay: DayKey,
): BaselineResult {
  return {
    takenDay,
    region,
    modelVersion: 1,
    answers: { ...answers },
    tonnes: computeBaseline(answers, region),
  };
}

export interface BaselineSegmentShare {
  segment: BaselineSegment;
  label: string;
  tonnes: number;
  /** 0..1 of the total. */
  share: number;
  categories: readonly CategoryId[];
}

/** The five segments, largest first, for the stacked bar and its text list. */
export function baselineSegments(tonnes: BaselineTonnes): BaselineSegmentShare[] {
  return BASELINE_SEGMENTS.map((segment) => ({
    segment,
    label: BASELINE_SEGMENT_LABELS[segment],
    tonnes: tonnes[segment],
    share: tonnes.total > 0 ? tonnes[segment] / tonnes.total : 0,
    categories: SEGMENT_CATEGORIES[segment],
  })).sort((a, b) => b.tonnes - a.tonnes);
}

/** "Your biggest levers": the two largest segments. */
export function biggestLevers(tonnes: BaselineTonnes): BaselineSegmentShare[] {
  return baselineSegments(tonnes).slice(0, 2);
}

export function isLowFootprint(tonnes: BaselineTonnes): boolean {
  return tonnes.total <= LOW_FOOTPRINT_TONNES;
}

/**
 * Focus areas from a baseline: walk the segments from largest to smallest, adding their
 * categories until two are chosen; a light footprint adds Nature & Voice. No quiz: Eat + Move.
 */
export function suggestFocus(tonnes: BaselineTonnes | null): CategoryId[] {
  if (!tonnes) return [...DEFAULT_FOCUS];
  const focus: CategoryId[] = [];
  for (const { categories } of baselineSegments(tonnes)) {
    for (const category of categories) {
      if (focus.length < 2 && !focus.includes(category)) focus.push(category);
    }
  }
  if (isLowFootprint(tonnes) && !focus.includes('nature')) focus.push('nature');
  return focus;
}

/** How the home is heated, as far as the quiz says; used to prefill the heat question. */
export function heatFromAnswers(answers: BaselineAnswers): HeatSource {
  switch (answers.homeEnergy) {
    case 'gas-typical':
    case 'gas-high':
    case 'very-high':
      return 'gas';
    case 'electric-typical':
      return 'electric';
    default:
      return 'unknown';
  }
}

const groupActions = (id: string): readonly string[] => GROUP_BY_ID.get(id)?.actions ?? [];

const LOW_CARBON_TRIPS = [
  'walk-cycle-instead-of-car',
  'ebike-escooter-instead-of-car',
  'bus-instead-of-car',
  'train-metro-instead-of-car',
  'carpool',
  'work-from-home-day',
];
const FLIGHT_SWAPS = groupActions('flight-swap');
const PLATE = groupActions('plate');
const LOW_STUFF = [
  'second-hand-tshirt',
  'second-hand-jeans',
  'borrow-instead-of-buy',
  'repair-instead-of-replace',
  'keep-phone-one-more-year',
];

/** Actions that are already the user's norm according to the quiz (spec section 6.5). */
export function keptActions(answers: BaselineAnswers): Set<string> {
  const kept = new Set<string>();
  const add = (ids: readonly string[]) => ids.forEach((id) => kept.add(id));
  if (['walk-cycle', 'ebike', 'metro-tram', 'train', 'bus'].includes(answers.transportMode)) {
    add(LOW_CARBON_TRIPS);
  }
  if (answers.transportMode === 'car-shared') add(['carpool']);
  if (answers.transportMode === 'car-electric') add(['ev-instead-of-petrol-car']);
  if (answers.flights === 'none') add(FLIGHT_SWAPS);
  if (answers.diet === 'vegan') add([...PLATE, 'plant-milk-instead-of-dairy']);
  if (answers.diet === 'vegetarian') add(PLATE);
  if (answers.diet === 'pescatarian') {
    add(['chicken-instead-of-beef', 'plant-based-instead-of-beef']);
  }
  if (answers.shopping === 'minimal') add(LOW_STUFF);
  return kept;
}

/**
 * Tags a log at save time: `keep` when the action is already the user's norm, `swap`
 * when it is a new cut, `unrated` without a quiz or without a credited factor.
 */
export function classifyLog(
  actionId: string,
  quantified: boolean,
  baseline: BaselineResult | null,
): LogKind {
  if (!baseline || !quantified) return 'unrated';
  return keptActions(baseline.answers).has(actionId) ? 'keep' : 'swap';
}

export interface BaselineReference {
  label: string;
  tonnes: number;
}

/** Reference ticks for the result bar, each labelled with its basis. */
export function baselineReferences(region: RegionId, regionName: string): BaselineReference[] {
  const [low, high] = BASELINE_MODEL.target2030.range;
  const ticks: BaselineReference[] = [
    {
      label: `A 1.5 °C-compatible lifestyle by 2030 ≈ ${BASELINE_MODEL.target2030.tonnes} t (benchmark range ${low}–${high}; Hot or Cool Institute)`,
      tonnes: BASELINE_MODEL.target2030.tonnes,
    },
  ];
  const averages: Readonly<Record<string, number>> = BASELINE_MODEL.lifestyleFootprints2019;
  const average = averages[region];
  if (average !== undefined) {
    ticks.push({
      label: `Average lifestyle footprint in ${regionName}, 2019 ≈ ${average} t`,
      tonnes: average,
    });
  }
  return ticks;
}
