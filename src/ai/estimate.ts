/**
 * Custom-action estimation: the server first (when a live AI is configured),
 * then a transparent local heuristic. The result says which path produced it,
 * so the UI can label it truthfully ("AI estimate" or "Rough local estimate")
 * and never present a guess as a measurement.
 *
 * The local heuristic is deliberately modest: it recognises a few common
 * actions by keyword, uses numbers on the low side of published ranges,
 * and always reports "low" confidence. When it recognises nothing it says so
 * and gives no number.
 */
import {
  AI_LIMITS,
  type ActionEstimate,
  type EstimateCatalogueEntry,
  type EstimateCategory,
  type EstimateOutcome,
} from './contract';
import {
  getAiStatus as defaultGetAiStatus,
  estimateAction as defaultEstimateAction,
  isAiError,
  type AiClient,
} from './client';
import { normalise } from './offline/intents';

export interface EstimateOptions {
  /** The loggable catalogue: used to match the text to an existing action. */
  actions?: readonly EstimateCatalogueEntry[];
  region?: string;
  /** Quantity the user typed, if any. */
  quantity?: number;
  signal?: AbortSignal;
  /** Test seam. */
  client?: Pick<AiClient, 'getAiStatus' | 'estimateAction'>;
}

interface Rule {
  re: RegExp;
  category: EstimateCategory;
  title: string;
  emoji: string;
  unit: string;
  effort: ActionEstimate['effort'];
  /** Conservative kg CO2e avoided per unit, or null when no honest number exists. */
  perUnitKg: number | null;
  defaultQuantity: number;
  /**
   * Catalogue ids this most likely corresponds to, best first. The product's own ids come
   * first; where a phrase could mean several catalogue actions of different size, the
   * smaller one is named, or none.
   */
  actionIds: readonly string[];
  basis: string;
}

/** Numbers sit at the low end of published ranges: better to under-claim than over-claim. */
const RULES: readonly Rule[] = [
  {
    re: /\b(cycl\w*|biked|biking|rode (my|a|the) bike|bike (ride|trip|to))\b/,
    category: 'move',
    title: 'Cycled instead of driving',
    emoji: '🚲',
    unit: 'km',
    effort: 2,
    perUnitKg: 0.1,
    defaultQuantity: 3,
    actionIds: ['walk-cycle-instead-of-car', 'move_bike_trip'],
    basis: 'a car trip of the same length (about 0.17 kg per km, taken on the low side)',
  },
  {
    // Walking somewhere, not walking the dog: only a trip can stand in for a drive.
    re: /\b(walk\w* (to|into|home|there|back|instead|it|\d+)|on foot)\b/,
    category: 'move',
    title: 'Walked instead of driving',
    emoji: '🚶',
    unit: 'km',
    effort: 2,
    perUnitKg: 0.1,
    defaultQuantity: 2,
    actionIds: ['walk-cycle-instead-of-car', 'move_walk_trip'],
    basis: 'a car trip of the same length (about 0.17 kg per km, taken on the low side)',
  },
  {
    re: /\b(tram|metro|subway|underground)\b/,
    category: 'move',
    title: 'Took public transport',
    emoji: '🚇',
    unit: 'km',
    effort: 2,
    perUnitKg: 0.05,
    defaultQuantity: 5,
    actionIds: ['train-metro-instead-of-car', 'move_transit_trip'],
    basis: 'driving the same distance alone, minus what the tram or metro emits per passenger',
  },
  {
    re: /\b(bus|transit)\b/,
    category: 'move',
    title: 'Took public transport',
    emoji: '🚌',
    unit: 'km',
    effort: 2,
    perUnitKg: 0.05,
    defaultQuantity: 5,
    actionIds: ['bus-instead-of-car', 'move_transit_trip'],
    basis: 'driving the same distance alone, minus what the bus or tram emits per passenger',
  },
  {
    re: /\b(train|rail)\b/,
    category: 'move',
    title: 'Took the train',
    emoji: '🚆',
    unit: 'km',
    effort: 3,
    perUnitKg: 0.1,
    defaultQuantity: 50,
    actionIds: ['train-metro-instead-of-car', 'move_train_trip'],
    basis: 'driving the same distance alone, minus what rail emits per passenger',
  },
  {
    re: /\b(carpool\w*|shared (a |the )?(ride|car)|lift share)\b/,
    category: 'move',
    title: 'Shared the ride',
    emoji: '🚗',
    unit: 'km',
    effort: 2,
    perUnitKg: 0.05,
    defaultQuantity: 10,
    actionIds: ['carpool', 'move_carpool'],
    basis: 'driving alone, with the trip split between two people',
  },
  {
    re: /\b(vegan|plant based|fully plant)\b/,
    category: 'eat',
    title: 'Plant-based meal',
    emoji: '🌱',
    unit: 'meals',
    effort: 2,
    perUnitKg: 1,
    defaultQuantity: 1,
    actionIds: ['plant-based-meal', 'eat_plant_meal'],
    basis: 'an average meal with meat, on the low side',
  },
  {
    // A whole day without meat is its own catalogue action; a single meal (below) is not.
    re: /\b((skipp?ed|skip|no|without|zero|off) (the )?meat|(vegetarian|veggie|meat ?free|meatless) day)\b/,
    category: 'eat',
    title: 'Meat-free day',
    emoji: '🥗',
    unit: 'days',
    effort: 2,
    perUnitKg: 1.5,
    defaultQuantity: 1,
    actionIds: ['vegetarian-day'],
    basis: 'a day of average meals with meat, on the low side',
  },
  {
    re: /\b(vegetarian|veggie|meat ?free|meatless)\b/,
    category: 'eat',
    title: 'Vegetarian meal',
    emoji: '🥗',
    unit: 'meals',
    effort: 2,
    perUnitKg: 0.8,
    defaultQuantity: 1,
    actionIds: ['eat_veg_meal'],
    basis: 'an average meal with meat, on the low side',
  },
  {
    re: /\b(instead of|skipped|no|swapped) (beef|lamb)\b|\b(beef|lamb) (swap|free)\b/,
    category: 'eat',
    title: 'Swapped beef or lamb',
    emoji: '🫘',
    unit: 'meals',
    effort: 2,
    perUnitKg: 1,
    defaultQuantity: 1,
    actionIds: ['eat_beef_swap'],
    basis: 'the beef version of the meal, on the low side',
  },
  {
    re: /\b(leftovers?|used up|food scraps|saved (the )?food|stale bread)\b/,
    category: 'eat',
    title: 'Used up leftovers',
    emoji: '🍲',
    unit: 'portions',
    effort: 2,
    perUnitKg: 0.4,
    defaultQuantity: 1,
    actionIds: ['meal-saved-from-waste', 'eat_use_it_up'],
    basis: 'food that would have been thrown away and then replaced',
  },
  {
    re: /\b(line ?dr\w*|air ?dr\w*|drying rack|clothes ?line|hung (my )?(washing|laundry|clothes))\b/,
    category: 'power',
    title: 'Air-dried laundry',
    emoji: '🧺',
    unit: 'loads',
    effort: 2,
    perUnitKg: 0.5,
    defaultQuantity: 1,
    actionIds: ['line-dry-instead-of-tumble', 'power_line_dry'],
    basis: 'running a tumble dryer for the same load, on the low side',
  },
  {
    re: /\b(cold wash|washed cold|cooler wash|30 ?(degrees|c)\b)/,
    category: 'water',
    title: 'Washed laundry cool',
    emoji: '🫧',
    unit: 'loads',
    effort: 1,
    perUnitKg: 0.2,
    defaultQuantity: 1,
    actionIds: ['wash-30-instead-of-40', 'water_cold_wash'],
    basis: 'a warmer wash, since most of the energy heats the water',
  },
  {
    re: /\b(short shower|quick shower|shorter shower|shower (under|less))\b/,
    category: 'water',
    title: 'Took a short shower',
    emoji: '🚿',
    unit: 'showers',
    effort: 1,
    perUnitKg: 0.2,
    defaultQuantity: 1,
    actionIds: ['shorter-shower', 'water_short_shower'],
    basis: 'a longer shower, since most of the energy heats the water',
  },
  {
    re: /\b(thermostat|heating (down|lower|off)|turned (the )?heating|lowered (the )?heating)\b/,
    category: 'power',
    title: 'Turned the heating down',
    emoji: '🌡️',
    unit: '°C',
    effort: 2,
    perUnitKg: 0.2,
    defaultQuantity: 1,
    actionIds: ['thermostat-down-1c', 'power_heat_down'],
    basis: 'your usual setting, on the low side',
  },
  {
    re: /\b((reusable|own|travel) (cup|mug)|keep ?cup)\b/,
    category: 'waste',
    title: 'Used my own cup',
    emoji: '☕',
    unit: 'times',
    effort: 1,
    perUnitKg: 0.02,
    defaultQuantity: 1,
    actionIds: ['refuse-single-use-cup'],
    basis: 'a single-use cup, on the low side',
  },
  {
    re: /\b(refill\w*|reusable (bottle|cup)|own (cup|bottle)|keep ?cup)\b/,
    category: 'waste',
    title: 'Used a refillable bottle or cup',
    emoji: '🚰',
    unit: 'times',
    effort: 1,
    perUnitKg: 0.05,
    defaultQuantity: 1,
    actionIds: ['refuse-single-use-bottle', 'stuff_refill'],
    basis: 'a single-use bottle or cup, on the low side',
  },
  {
    re: /\b(second ?hand|thrift\w*|vintage|pre ?owned|charity shop|op shop)\b/,
    category: 'stuff',
    title: 'Bought second-hand',
    emoji: '👕',
    unit: 'item',
    effort: 3,
    perUnitKg: 2,
    defaultQuantity: 1,
    actionIds: ['stuff_secondhand'],
    basis: 'buying the same item new, on the low side',
  },
  {
    re: /\b(repair\w*|fixed|mended|patched|resoled)\b/,
    category: 'stuff',
    title: 'Repaired instead of replacing',
    emoji: '🧵',
    unit: 'item',
    effort: 3,
    perUnitKg: 1,
    defaultQuantity: 1,
    actionIds: ['repair-instead-of-replace', 'stuff_repair'],
    basis: 'buying a replacement, on the low side',
  },
  {
    re: /\b(borrow\w*|rented|lent|swapped|shared (a |my )?(tool|drill|ladder))\b/,
    category: 'stuff',
    title: 'Borrowed instead of buying',
    emoji: '🤝',
    unit: 'item',
    effort: 2,
    perUnitKg: null,
    defaultQuantity: 1,
    actionIds: ['borrow-instead-of-buy', 'stuff_borrow'],
    basis: 'no honest per-item figure',
  },
  {
    re: /\b(recycl\w*|sorted (the )?(bins?|rubbish|trash))\b/,
    category: 'waste',
    title: 'Sorted recycling',
    emoji: '♻️',
    unit: 'bag',
    effort: 1,
    perUnitKg: null,
    defaultQuantity: 1,
    actionIds: ['waste_recycle'],
    basis: 'it depends too much on what was recycled',
  },
  {
    re: /\b(compost\w*)\b/,
    category: 'waste',
    title: 'Composted food scraps',
    emoji: '🍂',
    unit: 'bowl',
    effort: 1,
    perUnitKg: null,
    defaultQuantity: 1,
    actionIds: ['compost-food-waste', 'waste_compost'],
    basis: 'it depends too much on what was composted',
  },
  {
    re: /\b(litter|trash pick\w*|clean ?up|cleanup|volunteer\w*|planted|planting|garden\w*|petition|wildlife|bees?|pollinators?)\b/,
    category: 'nature',
    title: 'Did something good for nature',
    emoji: '🌼',
    unit: 'once',
    effort: 2,
    perUnitKg: null,
    defaultQuantity: 1,
    actionIds: [
      'nature_plant',
      'nature_garden',
      'nature_wildlife',
      'nature_volunteer',
      'waste_litter_pick',
    ],
    basis: 'we do not claim CO2e for this kind of action',
  },
];

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'my',
  'i',
  'of',
  'to',
  'for',
  'and',
  'in',
  'on',
  'at',
  'with',
  'instead',
  'did',
  'just',
  'some',
  'got',
]);

function words(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** How much of the shorter word list the two share. 1 means one contains the other. */
function overlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(b);
  const shared = a.filter((word) => set.has(word)).length;
  return shared / Math.min(a.length, b.length);
}

function parseQuantity(text: string, unit: string): number | undefined {
  const lowered = text.toLowerCase();
  const match =
    /(\d+(?:[.,]\d+)?)\s*(km|kilomet\w*|miles?|mi|k|meals?|loads?|times?|items?|portions?|showers?|x)?\b/.exec(
      lowered,
    );
  if (!match) return undefined;
  const value = Number((match[1] ?? '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0 || value > 10_000) return undefined;
  const suffix = match[2];
  if (unit === 'km') {
    if (suffix === undefined) return undefined;
    if (/^(mi|mile)/.test(suffix)) return Math.round(value * 1.609 * 10) / 10;
    return /^(km|k|kilomet)/.test(suffix) ? value : undefined;
  }
  return suffix === undefined || /^(meal|load|time|item|portion|shower|x)/.test(suffix)
    ? value
    : undefined;
}

function title60(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const capitalised = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return [...capitalised].slice(0, 60).join('');
}

function matchCatalogue(
  rule: Rule | undefined,
  text: string,
  actions: readonly EstimateCatalogueEntry[],
): EstimateCatalogueEntry | null {
  if (rule) {
    for (const id of rule.actionIds) {
      const hit = actions.find((action) => action.id === id);
      if (hit) return hit;
    }
  }
  const mine = words(text);
  let best: { action: EstimateCatalogueEntry; score: number } | null = null;
  for (const action of actions) {
    const score = overlap(mine, words(action.title));
    if (score >= 0.6 && (!best || score > best.score)) best = { action, score };
  }
  return best?.action ?? null;
}

/** The local estimate. Pure and synchronous; never throws. */
export function estimateLocally(text: string, options: EstimateOptions = {}): EstimateOutcome {
  const actions = options.actions ?? [];
  const normalised = normalise(text);
  const rule = RULES.find((candidate) => candidate.re.test(normalised));
  const matched = matchCatalogue(rule, text, actions);

  if (!rule) {
    const estimate: ActionEstimate = {
      isClimateAction: true,
      matchedActionId: matched?.id ?? null,
      variant: null,
      title: title60(text) || 'Something else',
      emoji: '🌱',
      category: 'nature',
      effort: 2,
      qty: options.quantity ?? 1,
      unit: matched?.unit ?? 'once',
      co2eKg: null,
      confidence: 'low',
      rationale:
        'Nothing in the built-in list matches, so there is no number. Pick a category and effort yourself.',
    };
    return { estimate, source: 'heuristic', recognised: false };
  }

  const quantity = options.quantity ?? parseQuantity(text, rule.unit) ?? rule.defaultQuantity;
  const raw = rule.perUnitKg === null ? null : rule.perUnitKg * quantity;
  const co2eKg =
    raw === null ? null : Math.round(Math.min(AI_LIMITS.maxEstimateKg, raw) * 100) / 100;
  const estimate: ActionEstimate = {
    isClimateAction: true,
    matchedActionId: matched?.id ?? null,
    variant: null,
    title: rule.title,
    emoji: rule.emoji,
    category: rule.category,
    effort: rule.effort,
    qty: quantity,
    unit: matched?.unit ?? rule.unit,
    co2eKg: matched ? null : co2eKg,
    confidence: 'low',
    rationale:
      rule.perUnitKg === null
        ? `Recognised from your words; no number given: ${rule.basis}.`
        : `A rough guess compared with ${rule.basis}.`,
  };
  return { estimate, source: 'heuristic', recognised: true };
}

/**
 * Estimates a custom action: the server when a live AI is configured, the
 * local heuristic otherwise or on any failure. Only an abort is re-thrown.
 */
export async function estimateCustomAction(
  text: string,
  options: EstimateOptions = {},
): Promise<EstimateOutcome> {
  const client = options.client ?? {
    getAiStatus: defaultGetAiStatus,
    estimateAction: defaultEstimateAction,
  };
  try {
    const status = await client.getAiStatus({ signal: options.signal });
    if (status.configured) {
      const estimate = await client.estimateAction(text, options.region ?? 'global', {
        quantity: options.quantity,
        catalogue: options.actions,
        signal: options.signal,
      });
      return { estimate, source: 'ai', recognised: true };
    }
  } catch (error) {
    if (isAiError(error) && error.code === 'aborted') throw error;
  }
  return estimateLocally(text, options);
}

/** Honest labels for the review card. */
export function estimateSourceLabel(outcome: EstimateOutcome): string {
  return outcome.source === 'ai' ? 'AI estimate' : 'Rough local estimate';
}
