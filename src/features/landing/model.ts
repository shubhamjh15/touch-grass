/**
 * The landing page's rules, kept pure so they can be tested without a browser: the three
 * demo actions and their real estimates, how fast the demo tree grows, the frames of the
 * scroll time-lapse and the maths that turns a scroll position into a moment in a tree's
 * first year.
 *
 * Nothing here is saved, and nothing here invents a number: kilograms come from the same
 * factor table the app logs with, stage names and thresholds from the engine's growth
 * curve, and the time-lapse's day counts from the product spec's typical-pace table.
 */
import { ROUTES } from '@/app/routes';
import { ACTION_BY_ID, DEFAULT_REGION, SOURCES, type ActionDef } from '@/data/catalogue';
import { FACTORS_VERSION, actionAnchor } from '@/data/pointers';
import { GROWTH_TABLE, STAGES, estimateKg, growthOf, type KgContext, type StageName } from '@/game';
import { formatCo2Estimate, formatNumber, pluralize } from '@/lib/format';
import { clamp01, lerp, smoothstep } from '@/lib/math';
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

/** The three stickers of the hero's demo strip (spec 11.1). One tap = one real catalogue log. */
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

/** Where "Try it first" jumps without JavaScript: the demo's readout. */
export const DEMO_ANCHOR = 'try-it';
/** Marks the first demo sticker, which "Try it first" focuses. */
export const FIRST_STICKER_ATTR = 'data-demo-first';

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

/** Estimates never change while the page is open: each sticker's is computed once. */
const ESTIMATES = new Map(DEMO_ACTIONS.map((action) => [action.id, demoEstimate(action)]));

export const estimateFor = (action: DemoAction): DemoEstimate | null =>
  ESTIMATES.get(action.id) ?? null;

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
  /** Taps still missing for Sapling; 0 once it is one. */
  tapsToSapling: number;
}

export function demoStatus(taps: number): DemoStatus {
  const growth = demoGrowth(taps);
  return {
    growth,
    stage: stageAtGrowth(growth),
    tapsToSapling: Math.max(0, DEMO_TAPS_TO_SAPLING - Math.max(0, Math.floor(taps))),
  };
}

// --- The time-lapse --------------------------------------------------------------------------

export type TimelapseFrameId =
  'seed' | 'sprout' | 'seedling' | 'sapling' | 'young' | 'mature' | 'grand' | 'year-one';

export interface TimelapseFrame {
  id: TimelapseFrameId;
  stage: StageName;
  /** Growth value the world is shown at this frame. */
  growth: number;
  /** First day a typical user's tree looks like this. */
  day: number;
}

/**
 * The pace the day counts assume, from the product spec's growth table (section 2.5, the
 * "Typical" column, generated by the economy simulation): six active days a week, earning
 * 17 growth points (show up + two actions) to 24 (a closed ring) on each.
 */
export const TYPICAL_PACE = { activeDaysPerWeek: 6, gpLow: 17, gpHigh: 24 } as const;

const YEAR = 365;
/** Growth of the typical tree after one year (spec 2.5): a Grand tree, a little past its threshold. */
const YEAR_ONE_GROWTH = 0.845;

const frame = (id: TimelapseFrameId, stage: StageName, day: number): TimelapseFrame => ({
  id,
  stage,
  growth: growthAtStage(stage),
  day,
});

/** Eight moments of a first year. Reduced motion shows exactly these, as still frames. */
export const TIMELAPSE_FRAMES: readonly TimelapseFrame[] = [
  // A seed has no growth yet; a sliver of it shows the soil mound the ceremony leaves behind.
  { id: 'seed', stage: 'Seed', growth: growthAtStage('Sprout') * (2 / 3), day: 1 },
  frame('sprout', 'Sprout', 1),
  frame('seedling', 'Seedling', 2),
  frame('sapling', 'Sapling', 9),
  frame('young', 'Young tree', 33),
  frame('mature', 'Mature tree', 111),
  frame('grand', 'Grand tree', 251),
  { id: 'year-one', stage: 'Grand tree', growth: YEAR_ONE_GROWTH, day: YEAR },
];

/**
 * Scroll progress is quantised so canopy units pop discretely and the sky re-inks in steps
 * (bible 7.9). Nine steps per caption: a centred caption is always exactly its own frame.
 */
export const TIMELAPSE_STEPS = 63;
const DAWN_HOUR = 6;
const NIGHT_HOUR = 22;

export interface TimelapseMoment {
  /** Quantised progress, 0..1. */
  progress: number;
  growth: number;
  /** Hour of the sky: one day runs from dawn to night across the whole time-lapse. */
  hour: number;
  day: number;
  stage: StageName;
  /** Index of the caption that belongs to this moment. */
  frame: number;
  /** "Day 33 · Young tree", "Year 1 · Grand tree". */
  label: string;
}

/** "Day 33 · Young tree"; from day 365 on it reads "Year 1". */
export function timelapseLabel(day: number, stage: StageName): string {
  return day >= YEAR ? `Year 1 · ${stage}` : `Day ${formatNumber(day)} · ${stage}`;
}

/**
 * The moment of the first year that a scroll progress of 0..1 stands for. Each frame gets
 * the same share of the scroll, so the quick early stages are not over in a blink.
 * `still` snaps to the nearest frame: the calm version cross-fades eight stills.
 */
export function timelapseAt(progress: number, options: { still?: boolean } = {}): TimelapseMoment {
  const last = TIMELAPSE_FRAMES.length - 1;
  const steps = options.still ? last : TIMELAPSE_STEPS;
  const quantised = Math.round(clamp01(progress) * steps) / steps;
  const position = quantised * last;
  const index = Math.min(last - 1, Math.floor(position));
  const from = TIMELAPSE_FRAMES[index] as TimelapseFrame;
  const to = TIMELAPSE_FRAMES[index + 1] as TimelapseFrame;
  const eased = smoothstep(0, 1, position - index);
  const growth = lerp(from.growth, to.growth, eased);
  const day = Math.round(lerp(from.day, to.day, eased));
  const stage = stageAtGrowth(growth);
  return {
    progress: quantised,
    growth,
    hour: lerp(DAWN_HOUR, NIGHT_HOUR, quantised),
    day,
    stage,
    frame: Math.round(position),
    label: timelapseLabel(day, stage),
  };
}

/** A box on screen, as `getBoundingClientRect` reports it. */
export interface ScrollBox {
  top: number;
  height: number;
}

/**
 * Progress through a pinned scene: 0 when the tall section reaches the top of the viewport,
 * 1 when its last screenful is showing. Used on phones, where stage and caption are pinned.
 */
export function pinnedProgress(section: ScrollBox, viewport: number): number {
  const travel = section.height - viewport;
  if (travel <= 0) return 0;
  return clamp01(-section.top / travel);
}

/**
 * Progress through a list of `count` equally tall captions that scrolls normally: caption i
 * is exactly at the middle of the viewport at i / (count - 1). Not clamped, so the caller can
 * tell "not there yet" (below 0) from "at the first caption". Used beside the desktop stage.
 */
export function listProgress(list: ScrollBox, viewport: number, count: number): number {
  if (count < 2 || list.height <= 0) return 0;
  const row = list.height / count;
  return ((viewport / 2 - list.top) / row - 0.5) / (count - 1);
}

/** Half a caption before the first one is centred, the time-lapse takes the stage over from the demo. */
export function timelapseEngaged(rawProgress: number, count: number): boolean {
  return rawProgress >= -0.5 / Math.max(1, count - 1);
}

/** For tests and the honesty check: growth points a tree of this growth value holds. */
export function gpAtGrowth(growth: number): number {
  for (let index = 1; index < GROWTH_TABLE.length; index += 1) {
    const [x0, y0] = GROWTH_TABLE[index - 1] as readonly [number, number];
    const [x1, y1] = GROWTH_TABLE[index] as readonly [number, number];
    if (growth <= y1) return x0 + ((growth - y0) / (y1 - y0)) * (x1 - x0);
  }
  return (GROWTH_TABLE[GROWTH_TABLE.length - 1] as readonly [number, number])[0];
}
