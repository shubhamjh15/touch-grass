/**
 * The custom-action estimate (spec 3.6, step 2): the live AI when the server has one, and a
 * labelled built-in guess when it does not, is offline, or fails. Whatever comes back is only
 * a starting point for the review card, which the person can always edit.
 *
 * A kilogram figure is carried only when the AI gave one. The built-in guess suggests a kind
 * and an effort and never a number: a stored figure is labelled "AI estimate" everywhere else
 * in the product, and a keyword match has not earned that label.
 */
import {
  AI_LIMITS,
  estimateAction,
  estimateLocally,
  getAiStatus,
  isAiError,
  type ActionEstimate,
  type AiClient,
} from '@/ai';
import { ACTIONS, CATEGORY_IDS, type CategoryId } from '@/data/catalogue';
import { tileFor, type Tile } from './tiles';

export type Effort = 1 | 2 | 3 | 4;

export interface CustomDraft {
  title: string;
  emoji: string;
  category: CategoryId;
  effort: Effort;
  /** A conservative AI estimate in kg, or `null`: impact not quantified. */
  kg: number | null;
  qty: number;
  unit: string;
}

/** Why the review card looks the way it does; each has one plain sentence in the copy. */
export type CustomNotice =
  'ai' | 'local' | 'manual' | 'offline' | 'failed' | 'no-ai' | 'not-climate';

export type CustomOutcome =
  | {
      kind: 'catalogue';
      tile: Tile;
      /** The member action the AI named. */
      actionId: string;
      qty: number | null;
    }
  | {
      kind: 'review';
      /** Who filled the draft in. */
      origin: 'ai' | 'local' | 'manual';
      notice: CustomNotice;
      draft: CustomDraft;
      /** The AI's one-line reasoning, shown beside its number. */
      rationale: string | null;
    };

export interface CustomEstimateOptions {
  region: string;
  /** Quantity the person typed, if any. */
  quantity?: number;
  online: boolean;
  signal?: AbortSignal;
  /** Leave catalogue suggestions out: the person already said it is something else. */
  skipCatalogue?: boolean;
  /** Test seam. */
  client?: Pick<AiClient, 'getAiStatus' | 'estimateAction'>;
}

const CATALOGUE = ACTIONS.map(({ id, title, unit }) => ({ id, title, unit }));

function isCategory(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

function isEffort(value: number): value is Effort {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** The person's own words as a sticker name: trimmed, single-spaced, capitalised. */
export function cleanTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return (clean.charAt(0).toUpperCase() + clean.slice(1)).slice(0, AI_LIMITS.maxEstimateChars);
}

export function blankDraft(text: string, quantity?: number): CustomDraft {
  return {
    title: cleanTitle(text),
    emoji: '✨',
    category: 'nature',
    effort: 2,
    kg: null,
    qty: quantity ?? 1,
    unit: 'time',
  };
}

function clampKg(kg: number | null): number | null {
  if (kg === null || !Number.isFinite(kg) || kg <= 0) return null;
  return Math.min(kg, AI_LIMITS.maxEstimateKg);
}

function draftFromAi(text: string, estimate: ActionEstimate, quantity?: number): CustomDraft {
  const qty = quantity ?? (Number.isFinite(estimate.qty) && estimate.qty > 0 ? estimate.qty : 1);
  return {
    title: cleanTitle(estimate.title || text),
    emoji: estimate.emoji.trim() || '✨',
    category: isCategory(estimate.category) ? estimate.category : 'nature',
    effort: isEffort(estimate.effort) ? estimate.effort : 2,
    kg: clampKg(estimate.co2eKg),
    qty: Math.min(qty, 1000),
    unit: estimate.unit.trim() || 'time',
  };
}

/** The built-in guess: a kind and an effort from keywords, the person's own title, no number. */
function localOutcome(
  text: string,
  notice: CustomNotice,
  quantity: number | undefined,
): CustomOutcome {
  const outcome = estimateLocally(text, { quantity });
  if (!outcome.recognised) {
    return {
      kind: 'review',
      origin: 'manual',
      notice: notice === 'local' ? 'manual' : notice,
      draft: blankDraft(text, quantity),
      rationale: null,
    };
  }
  const { estimate } = outcome;
  return {
    kind: 'review',
    origin: 'local',
    notice,
    draft: {
      ...blankDraft(text, quantity),
      emoji: estimate.emoji,
      category: isCategory(estimate.category) ? estimate.category : 'nature',
      effort: isEffort(estimate.effort) ? estimate.effort : 2,
    },
    rationale: null,
  };
}

/**
 * Estimates a custom action. Never throws except for an abort, which the caller started.
 * Offline it does not touch the network at all.
 */
export async function estimateCustom(
  text: string,
  options: CustomEstimateOptions,
): Promise<CustomOutcome> {
  const { quantity, signal } = options;
  if (!options.online) return localOutcome(text, 'offline', quantity);
  const client = options.client ?? { getAiStatus, estimateAction };

  let estimate: ActionEstimate;
  try {
    const status = await client.getAiStatus({ signal });
    if (!status.configured) {
      return localOutcome(text, status.reason === 'offline' ? 'offline' : 'no-ai', quantity);
    }
    estimate = await client.estimateAction(text, options.region, {
      quantity,
      catalogue: CATALOGUE,
      signal,
    });
  } catch (error) {
    if (isAiError(error) && error.code === 'aborted') throw error;
    if (signal?.aborted) throw error;
    return localOutcome(text, 'failed', quantity);
  }

  const matched = estimate.matchedActionId ? tileFor(estimate.matchedActionId) : undefined;
  if (matched && estimate.matchedActionId && !options.skipCatalogue) {
    return {
      kind: 'catalogue',
      tile: matched,
      actionId: estimate.matchedActionId,
      qty: quantity ?? (estimate.qty > 0 ? estimate.qty : null),
    };
  }
  if (!estimate.isClimateAction) {
    return {
      kind: 'review',
      origin: 'manual',
      notice: 'not-climate',
      draft: blankDraft(text, quantity),
      rationale: estimate.rationale.trim() || null,
    };
  }
  const draft = draftFromAi(text, estimate, quantity);
  return {
    kind: 'review',
    origin: 'ai',
    notice: 'ai',
    // A catalogue match the person turned down must not smuggle its number in as an "AI estimate".
    draft: matched ? { ...draft, kg: null } : draft,
    rationale: estimate.rationale.trim() || null,
  };
}
