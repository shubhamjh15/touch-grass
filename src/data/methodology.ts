/**
 * Content of the /methodology page: how the estimates work, in plain language, plus the data
 * for the two tables the page prints, joined by source key:
 *
 * - `ACTION_SOURCE_ROWS`: one row per catalogue action (value, unit, compared with, confidence,
 *   formula and every source with its year), the factor table the engine reads from.
 * - `SOURCE_ROWS`: one row per source of the catalogue, with the actions, baseline questions and
 *   equivalences that cite it, so each source has an anchor to link to.
 * - `CONTENT_SOURCE_ROWS`: the sources behind Learn, Impact and the community posts.
 *
 * Numbers that appear in the prose are read from the catalogue and the evidence meta, never
 * typed here, so the page cannot drift from what the app computes.
 */
import {
  ACTIONS,
  BASELINE_MODEL,
  BASELINE_QUESTIONS,
  CATEGORY_BY_ID,
  EQUIVALENCES,
  EVIDENCE_META,
  GRID,
  GRID_BY_ID,
  REFERENCE_FACTORS,
  SOURCES,
  type Confidence,
  type SourceDef,
} from './catalogue';
import { allContentItems } from './contentItems';
import { DATASETS } from './datasets';
import { CONTENT_SOURCES } from './lessons/sources';
import type { SourceRef } from './lessons/types';
import { FACTORS_VERSION, actionAnchor } from './pointers';

export type MethodologyBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: readonly string[] }
  /** A short formula or worked line, shown in a monospace block. */
  | { kind: 'formula'; text: string }
  /** A boxed caveat. */
  | { kind: 'note'; text: string };

export interface MethodologySection {
  id: string;
  heading: string;
  /** One line shown under the heading and in the page's contents list. */
  summary: string;
  blocks: readonly MethodologyBlock[];
}

export interface ConfidenceLevel {
  id: Confidence;
  label: string;
  meaning: string;
  /** How wrong the central number can plausibly be. */
  typicalRange: string;
}

export interface WordingRules {
  always: readonly string[];
  never: readonly string[];
  /** Strings with `{placeholders}` the UI fills in. */
  templates: Readonly<Record<string, string>>;
}

export { FACTORS_VERSION, actionAnchor };
export const FACTORS_DATE = EVIDENCE_META.generated;

const worldGrid = GRID_BY_ID.get(EVIDENCE_META.defaultRegion);
const france = GRID_BY_ID.get('FR');
const india = GRID_BY_ID.get('IN');
if (!worldGrid || !france || !india) {
  throw new Error('methodology: the grid table is missing WORLD, FR or IN');
}

const fixed = (value: number, decimals: number) => value.toFixed(decimals);
const grams = (kgPerKWh: number) => Math.round(kgPerKWh * 1000);

const CAR = REFERENCE_FACTORS.carKgPerKm;
const WORLD_G = grams(worldGrid.kgCO2ePerKWh);
const REGION_COUNT = GRID.length;
const MODEL_VERSION = BASELINE_MODEL.version;

export const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = [
  {
    id: 'high',
    label: 'High',
    meaning: 'An official or peer-reviewed factor and a simple, well-defined comparison.',
    typicalRange: 'Typically within about ±30%.',
  },
  {
    id: 'medium',
    label: 'Medium',
    meaning:
      'Good sources, but the answer depends on your circumstances: your vehicle, your grid, your diet, what you would otherwise have done.',
    typicalRange: 'Often ±50%.',
  },
  {
    id: 'low',
    label: 'Low',
    meaning:
      'Assumption-heavy, context-dependent, or the sources disagree. For some people the true figure could be zero or negative.',
    typicalRange: 'Could be out by a factor of two or more.',
  },
  {
    id: 'not_quantified',
    label: 'Not quantified',
    meaning:
      'No credible CO2e figure exists. The action earns XP for showing up, and Touch Grass never prints a number for it.',
    typicalRange: 'No number is shown.',
  },
];

export const CAN_CLAIM: readonly string[] = [
  'An approximate amount of CO2e avoided by one action, compared with a stated alternative.',
  'Which actions are large (flights, car travel, beef, heating) and which are small (bags, cups, standby, tap water).',
  'A running personal total, labelled "estimated CO2e avoided".',
];

export const CANNOT_CLAIM: readonly string[] = [
  'That your footprint fell by exactly this amount. Nobody measured what you would otherwise have done.',
  'That a personal total "offsets", "neutralises" or "cancels" any emissions.',
  'That figures apply everywhere. Most transport, waste and home-energy factors are UK or US values.',
  'Any CO2e benefit for litter picking, volunteering or other actions that are not quantified.',
  'That planting a tree removes carbon today, or permanently.',
];

export const DOUBLE_COUNTING: readonly string[] = [
  'One trip, one action: do not log "walked instead of driving" and "took the bus instead of driving" for the same journey.',
  'Diet: log a vegetarian or vegan day, or individual plant-based meals, not both. "Chicken instead of beef" and "plant-based meal" overlap too.',
  'Food waste: "food waste avoided (kg)" and "meal saved" are the same thing in two units. Composting applies only to scraps that were not eaten.',
  'Laundry: one load is either 30 °C or cold, plus optionally line-dried.',
  'Hot water: "shorter shower" and "hot water saved" overlap.',
  'Carpooling: the saving belongs to the car. Share it between the riders, do not give it to each.',
  'Household actions such as the thermostat and standby: one log per household per day.',
  'Recycling versus buying recycled: the benefit is credited to the recycler here, so do not also credit recycled-content purchases.',
  'Recycling a bottle and refusing a bottle are alternatives for the same bottle.',
  'Second-hand and repair use displacement rates, because not every purchase or repair replaces a new item.',
  'One-off actions such as an LED bulb, a tree or keeping a phone count per day or per year going forward. They are never a lump sum and never back-dated.',
  'The starting-line quiz and the action log use different methods. Subtracting one from the other gives an indication, not a new footprint.',
];

export const WHY_RANGES_ARE_WIDE: readonly string[] = [
  'The alternative is unknown: which car, how full the bus, what you would have eaten.',
  `Electricity varies about 15-fold between countries (France ${grams(france.kgCO2ePerKWh)} against India ${grams(india.kgCO2ePerKWh)} gCO2e per kWh in ${france.year}) and by the hour.`,
  'Farm-level food footprints vary several-fold for the same product. Beef from a dairy herd and beef from a beef herd differ by a factor of three.',
  'Method choices matter: with or without the non-CO2 effects of flying, with or without land-use change, average or marginal electricity, who gets credit for recycling.',
  'Some studies are old or narrow. The carrier-bag study uses 2006 UK data, the appliance measurements come from 251 English homes in 2010 and 2011, and the India transport factors date from 2015.',
  'Item sizes are assumed: a can, a bottle, a T-shirt, a meal.',
];

export const WORDING_RULES: WordingRules = {
  always: [
    'Put an approximately-equal sign or the word "about" in front of every number.',
    'Say "estimated CO2e avoided", never "saved the planet", "offset" or "removed".',
    'Name the comparison: "vs driving an average car".',
    'Link every figure to this page and its sources.',
    'Round honestly: two significant figures at most ("about 1.5 kg", "about 20 g").',
    'Use grams below 0.1 kg, so tiny actions look tiny.',
  ],
  never: [
    '"You saved X kg of CO2" as a bare fact.',
    '"Carbon neutral", "net zero", "offset" or "cancelled out".',
    'More than two significant figures.',
    'A CO2e number for an action that is not quantified.',
    'Comparisons that shame, such as "you emitted…".',
    'Equivalences presented as outcomes, such as "you planted 3 trees".',
  ],
  templates: {
    logToast: 'about {value} {unit} CO2e avoided vs {counterfactualShort}',
    lowConfidence: 'rough estimate: depends a lot on your situation',
    tiny: 'tiny for the climate, still a good habit. Here is why.',
    notQuantified: 'Impact not measured in CO2e. XP earned for showing up.',
    total:
      'Estimated CO2e avoided so far: about {value}. Based on typical values, not measurements.',
    equivalence: 'That is roughly the CO2 from {n} {thing}.',
    range: 'Likely between {low} and {high}.',
    negative: 'Careful: in your situation this may not reduce emissions ({reason}).',
  },
};

export const METHODOLOGY_SECTIONS: readonly MethodologySection[] = [
  {
    id: 'what-it-is',
    heading: 'What the numbers are',
    summary: 'Estimates of CO2e avoided against a stated alternative, good for scale and ranking.',
    blocks: [
      {
        kind: 'p',
        text: 'Every figure in Touch Grass is an estimate of the greenhouse gases you avoided compared with a stated alternative, called the counterfactual. The alternative is assumed, never observed, so the numbers are indicative. They are good for ranking actions and showing rough scale. They are not carbon accounting.',
      },
      {
        kind: 'p',
        text: 'The unit is CO2e, carbon dioxide equivalent: all greenhouse gases expressed as the amount of CO2 with the same warming effect over 100 years. Each factor comes from a published source, listed in the table at the bottom of this page.',
      },
      {
        kind: 'formula',
        text: 'estimated kg CO2e avoided = quantity × kg CO2e avoided per unit',
      },
    ],
  },
  {
    id: 'counterfactuals',
    heading: 'The comparison behind every number',
    summary:
      'Each figure says what it is compared with. Log only what you would otherwise have done.',
    blocks: [
      {
        kind: 'p',
        text: `A figure only means something next to its comparison. "Walked instead of driving" is compared with driving an average car, which emits about ${fixed(CAR.default, 2)} kg CO2e per kilometre in the UK government factors, including fuel production. If you would not have driven, there is nothing to avoid, so please do not log it.`,
      },
      {
        kind: 'p',
        text: 'The comparison is written next to every figure in the app ("vs driving an average car") and in full in the table below, under "Compared with".',
      },
    ],
  },
  {
    id: 'ranges',
    heading: 'Ranges and confidence',
    summary: 'Every factor carries a confidence level and a plausible range.',
    blocks: [
      {
        kind: 'p',
        text: 'Each action has a central value, a low and a high value, and a confidence level. The ranges are published where the source gives one and judged where it does not. The app shows one central number, rounded to two significant figures, and the range when you open the details.',
      },
      {
        kind: 'list',
        items: CONFIDENCE_LEVELS.map(
          (level) => `${level.label}: ${level.meaning} ${level.typicalRange}`,
        ),
      },
      {
        kind: 'note',
        text: 'A logged value is never above the published high value for the action, and never negative. When a published value could be negative in your situation, the app says so rather than showing a flattering number.',
      },
    ],
  },
  {
    id: 'regional',
    heading: 'Where you live changes the number',
    summary: `Electricity, car and public-transport factors adjust to one of ${REGION_COUNT} regions.`,
    blocks: [
      {
        kind: 'p',
        text: `One kilowatt-hour of electricity does not always mean the same CO2. Touch Grass holds the average carbon intensity of the grid for ${REGION_COUNT} countries and regions, from Ember's yearly data on a life-cycle basis. The default, "World average", is about ${WORLD_G} g CO2e per kWh. France is about ${grams(france.kgCO2ePerKWh)} g and India about ${grams(india.kgCO2ePerKWh)} g (${france.year}).`,
      },
      {
        kind: 'formula',
        text: 'kg per unit = non-grid part + kWh per unit × grid kg CO2e per kWh of your region',
      },
      {
        kind: 'p',
        text: `Car, bus and rail factors also change by region where we have regional values: the average car is ${fixed(CAR.default, 4)} kg CO2e per km by default, ${fixed(CAR.byRegion.US, 4)} for the United States and ${fixed(CAR.byRegion.IN, 2)} for India. Heating and hot-water actions depend on how your home is heated. A heat pump is modelled with a coefficient of performance of ${REFERENCE_FACTORS.heatPumpCop}, and gas at ${fixed(REFERENCE_FACTORS.gasKgPerKWh, 3)} kg CO2e per kWh.`,
      },
      {
        kind: 'p',
        text: 'Actions about food, waste and stuff do not depend on the grid and are the same everywhere. Annual grid averages are used, not hourly values, and a logged value is stored at the factor version in force on the day, so a later update never rewrites your history.',
      },
    ],
  },
  {
    id: 'double-counting',
    heading: 'Counting each thing once',
    summary: 'Overlapping actions and daily caps stop one habit being counted twice.',
    blocks: [
      {
        kind: 'p',
        text: 'Some actions describe the same thing in different words. The Log screen applies caps and overlap groups to keep the total honest. These are the rules behind them, and a good habit to follow even without the caps.',
      },
      { kind: 'list', items: DOUBLE_COUNTING },
    ],
  },
  {
    id: 'baseline',
    heading: 'The starting line and your pace',
    summary: 'A one-minute lifestyle estimate, and a projection that is not your new footprint.',
    blocks: [
      {
        kind: 'p',
        text: `The optional starting-line quiz asks ${BASELINE_QUESTIONS.length} questions about food, getting around, flights, home energy and shopping. It adds up published per-diet, per-mode and per-home values, and shows tonnes of CO2e a year to one decimal place (model version ${MODEL_VERSION}). Treat it as accurate to about ±40% for a typical person, and worse at the extremes.`,
      },
      {
        kind: 'p',
        text: 'It covers the parts of a footprint you steer day to day. It leaves out public services, infrastructure, leisure and services, which together are about a quarter to a third of a full footprint. That is why it is not comparable with national per-person figures.',
      },
      {
        kind: 'p',
        text: 'Your pace compares what you have logged over the last four weeks, projected to a year, with your starting line. It needs 14 days since your first log and at least 7 active days before it shows anything. It counts only recurring swaps beyond the habits you told us you already had, and one-off actions are added once, never multiplied.',
      },
      {
        kind: 'note',
        text: 'The pace is a projection, not a measurement. The quiz and the action log use different methods, so the result is an indication of where your effort is going, not your new footprint. If you log less, it falls. That is information, not a verdict.',
      },
    ],
  },
  {
    id: 'custom-ai',
    heading: 'Custom actions and AI estimates',
    summary:
      'Estimates for things we did not list are labelled and kept out of your headline total.',
    blocks: [
      {
        kind: 'p',
        text: 'For something that is not in the catalogue, Touch Grass first looks for a close match. If there is none and the live AI is connected, the model gives a conservative guess for the action you typed. Otherwise you choose a category and an effort level and no CO2e is claimed.',
      },
      {
        kind: 'list',
        items: [
          'AI estimates are always marked as low confidence and carry a dotted underline wherever they appear.',
          'They are capped at 2 kg per log and 5 kg per day.',
          'They are kept out of the headline total, the share card and the pace metric. The total shows them on a separate line.',
        ],
      },
    ],
  },
  {
    id: 'equivalences',
    heading: 'Equivalences',
    summary: 'Comparisons are meant to give scale, not to describe outcomes.',
    blocks: [
      {
        kind: 'p',
        text: `The Impact page translates your total into everyday units, such as kilometres in an average car. There are ${EQUIVALENCES.length} in the catalogue, and each is phrased "That is roughly the CO2 from…". It is a way to feel the size of a number, never a claim about what you achieved.`,
      },
      {
        kind: 'p',
        text: 'We do not turn your total into "trees". In an app with a tree as its mascot, "that is 3 trees" would sound like trees planted, which is not true.',
      },
    ],
  },
  {
    id: 'not-claimed',
    heading: 'What we do not claim',
    summary: 'The limits of a self-reported estimate.',
    blocks: [
      { kind: 'p', text: 'We can claim:' },
      { kind: 'list', items: CAN_CLAIM },
      { kind: 'p', text: 'We cannot claim:' },
      { kind: 'list', items: CANNOT_CLAIM },
    ],
  },
  {
    id: 'wording',
    heading: 'How we word numbers',
    summary: 'The writing rules the whole app follows.',
    blocks: [
      { kind: 'p', text: 'Always:' },
      { kind: 'list', items: WORDING_RULES.always },
      { kind: 'p', text: 'Never:' },
      { kind: 'list', items: WORDING_RULES.never },
    ],
  },
  {
    id: 'gaps',
    heading: 'Known gaps',
    summary: 'Why ranges are wide, and what this release does not model.',
    blocks: [
      { kind: 'list', items: WHY_RANGES_ARE_WIDE },
      {
        kind: 'p',
        text: 'Not modelled in this release: hourly or live grid intensity, your own vehicle or energy bills, and any CO2e claim for air-conditioning. Where we use annual averages or three regional car factors, the number is an approximation of your real situation.',
      },
    ],
  },
  {
    id: 'versions',
    heading: 'Versions and updates',
    summary: 'Which factors are in use, how they are rounded and when they change.',
    blocks: [
      {
        kind: 'p',
        text: `Factor version ${FACTORS_VERSION}, built on ${FACTORS_DATE}. Central values are rounded to two significant figures, ranges likewise. Full precision is kept internally and a figure is shown to two significant figures at most.`,
      },
      {
        kind: 'p',
        text: 'CO2e uses 100-year global warming potentials as embedded in each source: the UK 2026 factors and the US EPA use IPCC AR5, Poore and Nemecek use AR5 with climate-carbon feedbacks, and Apple uses AR6. We do not re-harmonise them. The differences are small next to the other uncertainties.',
      },
      {
        kind: 'p',
        text: 'Factors are refreshed after each annual release: the UK conversion factors in June, Ember in spring, the Global Carbon Budget in November, and NASA and NOAA in January. New logs use the new version. Old logs keep the version they were saved with.',
      },
    ],
  },
];

export interface FactorsChangelogEntry {
  version: string;
  date: string;
  changes: readonly string[];
}

export const FACTORS_CHANGELOG: readonly FactorsChangelogEntry[] = [
  {
    version: FACTORS_VERSION,
    date: FACTORS_DATE,
    changes: [
      `First release: ${ACTIONS.length} actions in 7 categories, ${REGION_COUNT} grid regions, ${EQUIVALENCES.length} equivalences and the starting-line model version ${MODEL_VERSION}.`,
      'Factors built from the UK Government 2026 conversion factors, Ember 2025 grid data, Poore and Nemecek 2018, US EPA and WRAP sources, and manufacturer life-cycle reports.',
    ],
  },
];

export interface ActionSourceRow {
  id: string;
  title: string;
  emoji: string;
  category: string;
  categoryLabel: string;
  unit: string;
  /** Central kg CO2e per unit on the world-average grid, or null when not quantified. */
  kgPerUnit: number | null;
  low: number | null;
  high: number | null;
  /** True when the figure shifts with your region's grid, vehicle or heating. */
  regional: boolean;
  comparedWith: string;
  comparedWithDetail: string | null;
  confidence: Confidence;
  confidenceLabel: string;
  formula: string | null;
  notes: string | null;
  sourceKeys: readonly string[];
  sources: readonly (SourceDef & { key: string })[];
  /** Newest year among the sources, for the "year" column. */
  latestSourceYear: number | null;
  anchor: string;
}

export const sourceAnchor = (key: string) => `source-${key}`;

const CONFIDENCE_LABEL: Readonly<Record<Confidence, string>> = Object.fromEntries(
  CONFIDENCE_LEVELS.map((level) => [level.id, level.label]),
) as Record<Confidence, string>;

/** The factor table: one row per catalogue action, sources joined by key. */
export const ACTION_SOURCE_ROWS: readonly ActionSourceRow[] = ACTIONS.map((action) => {
  const sources = action.sources.map((key) => {
    const source = SOURCES[key];
    if (!source) throw new Error(`methodology: action ${action.id} cites unknown source ${key}`);
    return { key, ...source };
  });
  return {
    id: action.id,
    title: action.title,
    emoji: action.emoji,
    category: action.category,
    categoryLabel: CATEGORY_BY_ID[action.category].label,
    unit: action.unit,
    kgPerUnit: action.factor ? action.factor.central : null,
    low: action.factor ? action.factor.low : null,
    high: action.factor ? action.factor.high : null,
    regional: action.factor ? action.factor.regionalisation !== 'none' : false,
    comparedWith: action.counterfactual,
    comparedWithDetail: action.counterfactualDetail,
    confidence: action.confidence,
    confidenceLabel: CONFIDENCE_LABEL[action.confidence],
    formula: action.formula,
    notes: action.evidenceNotes,
    sourceKeys: action.sources,
    sources,
    latestSourceYear: sources.length ? Math.max(...sources.map((source) => source.year)) : null,
    anchor: actionAnchor(action.id),
  };
});

export interface SourceRow extends SourceDef {
  key: string;
  /** Catalogue actions that cite this source. */
  actions: readonly string[];
  /** Baseline question ids that cite it. */
  baselineQuestions: readonly string[];
  /** Equivalence ids that cite it. */
  equivalences: readonly string[];
  anchor: string;
}

/** Every source the catalogue cites, with who cites it. Sorted by title. */
export const SOURCE_ROWS: readonly SourceRow[] = Object.entries(SOURCES)
  .map(([key, source]) => ({
    key,
    ...source,
    actions: ACTIONS.filter((action) => action.sources.includes(key)).map((action) => action.id),
    baselineQuestions: BASELINE_QUESTIONS.filter((question) => question.sources.includes(key)).map(
      (question) => question.id,
    ),
    equivalences: EQUIVALENCES.filter((equivalence) => equivalence.sources.includes(key)).map(
      (equivalence) => equivalence.id,
    ),
    anchor: sourceAnchor(key),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));

export interface ContentSourceRow extends SourceRef {
  /** Lessons, myths, facts and posts that cite it, as `kind:id`. */
  usedBy: readonly string[];
  /** Bundled datasets that come from it. */
  datasets: readonly string[];
  /** True when the catalogue cites the same key: the page prints that row once, with this extra use. */
  inCatalogue: boolean;
  anchor: string;
}

/** The sources behind Learn, the community posts and the Impact charts, by key. */
export function contentSourceRows(): readonly ContentSourceRow[] {
  const items = allContentItems();
  return Object.values(CONTENT_SOURCES)
    .map((source) => ({
      ...source,
      usedBy: items
        .filter((item) => item.sourceKeys.includes(source.key))
        .map((item) => `${item.kind}:${item.id}`),
      datasets: DATASETS.filter((dataset) => dataset.sourceKey === source.key).map(
        (dataset) => dataset.id,
      ),
      inCatalogue: source.key in SOURCES,
      anchor: sourceAnchor(source.key),
    }))
    .filter((row) => row.usedBy.length > 0 || row.datasets.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}
