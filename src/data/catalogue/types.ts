/**
 * Shapes of the evidence-backed catalogue. Data only: every number in the generated
 * modules of this folder is copied by `scripts/build-catalogue.mjs` from the evidence
 * base and the product overlay, never typed by hand. Rules live in `src/game`.
 */

export const CATEGORY_IDS = ['move', 'eat', 'power', 'water', 'stuff', 'waste', 'nature'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryDef {
  id: CategoryId;
  /** Tab and chip label. */
  label: string;
  emoji: string;
  /** One line under the tab title. */
  blurb: string;
  /** The evidence base files its actions under these headings. */
  evidenceCategories: readonly string[];
}

export type Confidence = 'high' | 'medium' | 'low' | 'not_quantified';

/**
 * How a log turns into acts, the unit of effort:
 * `unit` = one act per whole unit, `log` = one act per entry, a number = that many acts per entry.
 */
export type ActsRule = 'unit' | 'log' | number;

/** `recurring` actions are annualised by the pace metric; `occasional` ones never are. */
export type Cadence = 'recurring' | 'occasional';

/**
 * `log` = kilograms are credited when the action is logged, `context` = the figure is shown
 * as context and never added to a total, `none` = no figure exists.
 */
export type Credit = 'log' | 'context' | 'none';

/** How the evidence base says a factor depends on where and how the user lives. */
export type Regionalisation = 'none' | 'grid' | 'vehicle' | 'grid+vehicle' | 'heat';

export interface ActionFactor {
  /** Central estimate in kg CO2e per unit on the world-average grid, rounded as published. */
  central: number;
  low: number;
  high: number;
  /** Electricity saved per unit; negative when the action uses electricity. */
  kWhPerUnit: number | null;
  /** The part of the central value that does not scale with the grid. */
  nonGridKgPerUnit: number;
  /** Heat saved per unit, for heating and hot-water actions. */
  heatKWhPerUnit: number | null;
  regionalisation: Regionalisation;
}

export interface ActionVariant {
  id: string;
  label: string;
  kgPerUnit: number;
  basis: string | null;
}

export interface ActionDef {
  id: string;
  category: CategoryId;
  emoji: string;
  title: string;
  unit: string;
  /** The evidence base's longer unit wording, e.g. "km not driven". */
  unitLabel: string;
  presets: readonly number[];
  defaultQty: number;
  /** Hard ceiling on quantity per day. */
  dailyCap: number;
  /** Decimals a quantity may carry. */
  decimals: 0 | 1 | 2;
  /** XP per rewarded act. */
  xp: number;
  acts: ActsRule;
  /** Rewarded acts per day for this action alone. */
  maxActs: number;
  group: string | null;
  cadence: Cadence;
  credit: Credit;
  /** Short comparison shown beside every figure: "vs. {counterfactual}". */
  counterfactual: string;
  /** The evidence base's full statement of the alternative, for the methodology page. */
  counterfactualDetail: string | null;
  confidence: Confidence;
  factor: ActionFactor | null;
  /** One log covers the whole household. */
  perHousehold: boolean;
  formula: string | null;
  evidenceNotes: string | null;
  /** A line the log sheet always shows for this action. */
  sheetNote: string | null;
  variants: readonly ActionVariant[];
  defaultVariant: string | null;
  sources: readonly string[];
}

export interface GroupDef {
  id: string;
  label: string;
  /** Rewarded acts per day across every action of the group. */
  maxActs: number;
  hint: string | null;
  /** Combined hard cap on quantity per day, where the group has one. */
  unitCap: number | null;
  actions: readonly string[];
}

export interface GridRegion {
  id: string;
  name: string;
  type: 'world' | 'country' | 'region';
  /** Shown first in pickers. */
  primary: boolean;
  year: number;
  kgCO2ePerKWh: number;
  renewablesSharePct: number;
  cleanSharePct: number;
}

export interface SourceDef {
  title: string;
  publisher: string | null;
  url: string;
  year: number;
  /** How the figure was verified, in the evidence base's own vocabulary. */
  evidence: string;
}

export interface EquivalenceDef {
  id: string;
  label: string;
  kgCO2ePerUnit: number;
  /** Set when the equivalence scales with the user's grid. */
  kWhPerUnit: number | null;
  gridScaled: boolean;
  formula: string;
  notes: string | null;
  sources: readonly string[];
}

export interface BaselineOption {
  id: string;
  label: string;
  note: string | null;
  /** Diet, flights, shopping. */
  tCO2ePerYear?: number;
  /** Transport modes. */
  kgCO2ePerKm?: number;
  kWhPerKm?: number;
  gridScaled?: boolean;
  regional?: Readonly<Record<string, number>>;
  /** Weekly distance. */
  kmPerWeek?: number;
  /** Home energy, per person per year. */
  electricityKWh?: number;
  gasKWh?: number;
}

export type BaselineQuestionId =
  'diet' | 'transportMode' | 'weeklyDistance' | 'flights' | 'homeEnergy' | 'shopping';

export type BaselineSegment = 'food' | 'transport' | 'flights' | 'home' | 'stuff';

export interface BaselineQuestion {
  id: BaselineQuestionId;
  segment: BaselineSegment;
  prompt: string;
  options: readonly BaselineOption[];
  uncertainty: string;
  sources: readonly string[];
}

export interface BaselineWorkedExample {
  region: string;
  answers: Readonly<Record<BaselineQuestionId, string>>;
  result: Readonly<Record<BaselineSegment | 'total', number>>;
}
