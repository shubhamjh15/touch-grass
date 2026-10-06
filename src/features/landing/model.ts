/**
 * The landing page's rules, kept pure so they can be tested without a browser: the three
 * demo actions with their real estimates, and how fast the demo tree grows.
 *
 * Nothing here is saved, and nothing here invents a number: kilograms come from the same
 * factor table the app logs with, stage names and thresholds from the engine's growth curve.
 */
import { ROUTES } from '@/app/routes';
import { ACTION_BY_ID, DEFAULT_REGION, SOURCES, type ActionDef } from '@/data/catalogue';
import { FACTORS_VERSION, actionAnchor } from '@/data/content';
import { STAGES, estimateKg, growthOf, type KgContext, type StageName } from '@/game';
import { formatCo2Estimate, formatNumber, pluralize } from '@/lib/format';
import { lerp } from '@/lib/math';
import type { CategoryId, EstimateSource } from '@/ui';

// --- The demo ------------------------------------------------------------------------------

export interface DemoAction {
  /** Stable id of the demo sticker. */
  id: 'plant-based-lunch' | 'biked-5-km' | 'shorter-shower';
  /** The catalogue action behind it. */
  actionId: string;
  /** What one tap stands for, in the action's own unit. */
  qty: number;
  /** Caption under the sticker. */
  label: string;
  category: CategoryId;
}

/** The three stickers of the demo (spec 11.2). One tap stands for one real catalogue log. */
export const DEMO_ACTIONS: readonly DemoAction[] = [
  {
    id: 'plant-based-lunch',
    actionId: 'plant-based-meal',
    qty: 1,
    label: 'Plant-based lunch',
    category: 'eat',
  },
  {
    id: 'biked-5-km',
    actionId: 'walk-cycle-instead-of-car',
    qty: 5,
    label: 'Biked 5 km',
    category: 'move',
  },
  {
    id: 'shorter-shower',
    actionId: 'shorter-shower',
    qty: 2,
    label: 'Shorter shower',
    category: 'water',
  },
];

/**
 * A visitor has told us nothing yet, so the demo uses what the app itself assumes before
 * onboarding: the world-average grid and car, and a gas-heated shower.
 */
export const DEMO_CONTEXT: KgContext = { region: DEFAULT_REGION, heat: 'unknown' };

export interface DemoEstimate {
  kg: number;
  /** Two significant figures with a fitting unit: "1.5 kg", "100 g". */
  text: string;
  /** "a typical meal with meat": what the action is compared with. */
  comparedWith: string;
  /** Everything the honesty mark opens for this figure. */
  source: EstimateSource;
}

function quantityText(action: ActionDef, qty: number): string {
  // "km" is a symbol and never takes a plural; "meal" and "minute" are words and do.
  return action.unit.length <= 3
    ? `${formatNumber(qty)} ${action.unit}`
    : pluralize(qty, action.unit);
}

/** The estimate the real log sheet would show for this sticker, or `null` if the catalogue lost it. */
export function demoEstimate(demo: DemoAction): DemoEstimate | null {
  const action = ACTION_BY_ID.get(demo.actionId);
  if (!action) return null;
  const estimate = estimateKg(action, demo.qty, DEMO_CONTEXT);
  if (!estimate) return null;

  const firstSource = action.sources.map((key) => SOURCES[key]).find(Boolean);
  const regional = action.factor !== null && action.factor.regionalisation !== 'none';
  const text = formatCo2Estimate(estimate.kg);
  return {
    kg: estimate.kg,
    text,
    comparedWith: action.counterfactual,
    source: {
      code: `Factors ${FACTORS_VERSION}`,
      kind: 'factor',
      formula: `${quantityText(action, demo.qty)} × ${formatCo2Estimate(estimate.perUnit)} per ${action.unit} = ${text}`,
      comparedWith: regional
        ? `Compared with ${action.counterfactual}. The demo uses world-average assumptions; your own numbers follow your region.`
        : `Compared with ${action.counterfactual}.`,
      range: `${formatCo2Estimate(estimate.low)} to ${formatCo2Estimate(estimate.high)}`,
      sourceLabel: firstSource ? (firstSource.publisher ?? firstSource.title) : 'Our factor table',
      year: firstSource?.year,
      href: `${ROUTES.methodology}#${actionAnchor(action.id)}`,
    },
  };
}

const ESTIMATES = new Map<string, DemoEstimate | null>();

/** `demoEstimate`, computed once per sticker: the factors cannot change while the page is open. */
export function estimateFor(demo: DemoAction): DemoEstimate | null {
  if (!ESTIMATES.has(demo.id)) ESTIMATES.set(demo.id, demoEstimate(demo));
  return ESTIMATES.get(demo.id) ?? null;
}

// --- Stages: the engine's growth curve, read by growth value ---------------------------------

const STAGE_GROWTH: readonly { name: StageName; growth: number }[] = STAGES.map(([name, gp]) => ({
  name,
  growth: growthOf(gp),
}));

/** Growth value at which a stage begins, straight from the engine's table. */
export function growthAtStage(stage: StageName): number {
  return STAGE_GROWTH.find((entry) => entry.name === stage)?.growth ?? 0;
}

/** The stage a tree of this growth value is in: the same answer the app would print. */
export function stageAtGrowth(growth: number): StageName {
  let current: StageName = 'Seed';
  for (const entry of STAGE_GROWTH) {
    if (growth + 1e-9 >= entry.growth) current = entry.name;
  }
  return current;
}

/** The demo tree starts as a Seedling and five taps make it a Sapling (spec 11.2). */
export const DEMO_TAPS_TO_SAPLING = 5;
const DEMO_START = growthAtStage('Seedling');
const DEMO_SAPLING = growthAtStage('Sapling');
/** Past the goal the demo keeps growing, ever more slowly, and stays well short of a Young tree. */
const DEMO_CEILING = lerp(DEMO_SAPLING, growthAtStage('Young tree'), 0.7);

/**
 * Growth of the demo tree after `taps` stickers. Deliberately sped up (the page says so):
 * a real action moves a real tree by a few leaves, not by a fifth of a stage.
 */
export function demoGrowth(taps: number): number {
  const count = Math.max(0, Math.floor(taps));
  if (count <= DEMO_TAPS_TO_SAPLING) {
    return lerp(DEMO_START, DEMO_SAPLING, count / DEMO_TAPS_TO_SAPLING);
  }
  const extra = count - DEMO_TAPS_TO_SAPLING;
  return DEMO_SAPLING + (DEMO_CEILING - DEMO_SAPLING) * (1 - Math.exp(-extra / 8));
}

export interface DemoStatus {
  growth: number;
  stage: StageName;
}

export function demoStatus(taps: number): DemoStatus {
  const growth = demoGrowth(taps);
  return { growth, stage: stageAtGrowth(growth) };
}
