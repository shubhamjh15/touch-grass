/**
 * "Say it in your own words": a plain sentence becomes a short list of proposed logs.
 *
 * Nothing here understands language by itself. The sentence is cut into its parts ("I cycled
 * to work" / "skipped meat today") and each part is handed to the matchers the product
 * already has, in order of trust: the live AI behind the custom-action flow when the server
 * has one, the built-in keyword list of `@/ai`, and the sticker sheet's own word index. What
 * comes back is a proposal and nothing more: the person sees every action with its estimate
 * and confirms before anything is logged.
 */
import { estimateLocally, type AiClient } from '@/ai';
import { ACTIONS } from '@/data/catalogue';
import type { ActionState } from '@/game';
import { estimateCustom } from './customEstimate';
import { guessCatalogueTiles } from './search';
import { tileFor, type Tile, type TileState } from './tiles';
import { snapQty, toStoredQty, type UnitSystem } from './units';

/** A sentence longer than this is a story, not a log. */
export const SAY_IT_MAX_CHARS = 200;
/** Parts of one sentence that are looked up; the rest is handed back as "not matched". */
export const SAY_IT_MAX_PARTS = 4;

const CATALOGUE = ACTIONS.map(({ id, title, unit }) => ({ id, title, unit }));

/** Words that say when or how, never what. A part made only of these is dropped. */
const FILLER = new Set([
  'i',
  'we',
  'also',
  'today',
  'yesterday',
  'tonight',
  'this',
  'morning',
  'afternoon',
  'evening',
  'week',
  'again',
  'just',
  'too',
  'as',
  'well',
  'earlier',
  'later',
  'my',
  'our',
  'the',
  'a',
]);

const BARE_AMOUNT = /^\d+(?:[.,]\d+)?\s*[a-z°]{0,12}$/i;

/**
 * Cuts a sentence into the things it says were done: at full stops, commas, semicolons and
 * the joining words. An amount left on its own ("…, 12 km") goes back to the part before it.
 */
export function splitSentence(text: string): string[] {
  const pieces = text
    .replace(/\s+/g, ' ')
    .slice(0, SAY_IT_MAX_CHARS)
    .split(/\s*(?:[.;!?\n]+|,|&|\+|\band then\b|\bthen\b|\band also\b|\band\b|\bplus\b)\s*/i)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');

  const parts: string[] = [];
  for (const piece of pieces) {
    const previous = parts[parts.length - 1];
    if (previous !== undefined && BARE_AMOUNT.test(piece)) {
      parts[parts.length - 1] = `${previous} ${piece}`;
      continue;
    }
    const meaning = piece
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 1 && !FILLER.has(word));
    if (meaning.length > 0) parts.push(piece);
  }
  return parts;
}

export type SayItProposal =
  | {
      kind: 'action';
      /** The words this came from. */
      said: string;
      tile: Tile;
      actionId: string;
      /** In stored (metric) units: the amount said, or the person's usual one. */
      qty: number;
      /** Who matched it, so the row can say so truthfully. */
      by: 'ai' | 'built-in';
      /**
       * False for a nearest match from the sticker sheet's word index: offered, but not
       * ticked until the person says that is what they meant.
       */
      sure: boolean;
    }
  | {
      kind: 'unknown';
      said: string;
    };

export interface SayItOptions {
  region: string;
  units: UnitSystem;
  online: boolean;
  signal?: AbortSignal;
  /** Test seam for the AI client of the custom-action flow. */
  client?: Pick<AiClient, 'getAiStatus' | 'estimateAction'>;
}

/** The first number in a part, read as an amount of this action. */
function typedAmount(said: string, state: ActionState, units: UnitSystem): number | null {
  const match = /(\d+(?:[.,]\d+)?)/.exec(said);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const { unit, decimals } = state.action;
  const stored = snapQty(toStoredQty(value, unit, units, decimals), decimals);
  return stored > 0 ? stored : null;
}

/**
 * The member of the tile a proposal stands for: the named one if it can be logged now, else
 * the first that can. When none can (a day tile after meals were logged, a cap reached) the
 * match is still shown, so the row can give the engine's own reason instead of "no match".
 */
function memberOf(state: TileState, actionId: string | null): ActionState | null {
  const named = state.members.find((member) => member.action.id === actionId);
  const open = state.members.filter((member) => member.blocked === null && member.unitsLeft > 0);
  if (named && open.includes(named)) return named;
  return open[0] ?? named ?? state.members[0] ?? null;
}

function proposal(
  said: string,
  state: TileState | undefined,
  actionId: string | null,
  amount: number | null,
  by: 'ai' | 'built-in',
  sure: boolean,
  units: UnitSystem,
): SayItProposal | null {
  if (!state || state.hidden) return null;
  const member = memberOf(state, actionId);
  if (!member) return null;
  const usual = member.quickQty > 0 ? member.quickQty : member.action.defaultQty;
  const wanted = amount ?? typedAmount(said, member, units) ?? usual;
  // More than a day can hold is most likely a number that meant something else.
  const fits = wanted <= member.unitsLeft || member.unitsLeft <= 0;
  const qty = fits ? wanted : Math.min(usual, member.unitsLeft);
  return { kind: 'action', said, tile: state.tile, actionId: member.action.id, qty, by, sure };
}

async function proposeOne(
  said: string,
  states: readonly TileState[],
  options: SayItOptions,
): Promise<SayItProposal> {
  const stateOf = (tile: Tile | undefined) =>
    tile ? states.find((state) => state.tile.id === tile.id) : undefined;

  // 1. The live AI, when the server has one: the same call the custom-action flow makes.
  const outcome = await estimateCustom(said, {
    region: options.region,
    online: options.online,
    signal: options.signal,
    client: options.client,
  });
  if (outcome.kind === 'catalogue') {
    const made = proposal(
      said,
      stateOf(outcome.tile),
      outcome.actionId,
      outcome.qty,
      'ai',
      true,
      options.units,
    );
    if (made) return made;
  }

  // 2. The built-in keyword list.
  const local = estimateLocally(said, { actions: CATALOGUE });
  if (local.recognised && local.estimate.matchedActionId) {
    const actionId = local.estimate.matchedActionId;
    const made = proposal(
      said,
      stateOf(tileFor(actionId)),
      actionId,
      null,
      'built-in',
      true,
      options.units,
    );
    if (made) return made;
  }

  // 3. The sticker sheet's own words: a nearest match, offered but not assumed.
  for (const guess of guessCatalogueTiles(said, states)) {
    const made = proposal(said, stateOf(guess.tile), null, null, 'built-in', false, options.units);
    if (made) return made;
  }
  return { kind: 'unknown', said };
}

/**
 * Turns a sentence into proposals, in the order it was said. Two parts that name the same
 * action become one. Never throws except for an abort the caller started.
 */
export async function proposeFromSentence(
  text: string,
  states: readonly TileState[],
  options: SayItOptions,
): Promise<SayItProposal[]> {
  const parts = splitSentence(text);
  const looked = await Promise.all(
    parts.slice(0, SAY_IT_MAX_PARTS).map((part) => proposeOne(part, states, options)),
  );
  const seen = new Set<string>();
  const proposals: SayItProposal[] = [];
  for (const item of looked) {
    if (item.kind === 'action') {
      if (seen.has(item.actionId)) continue;
      seen.add(item.actionId);
    }
    proposals.push(item);
  }
  for (const said of parts.slice(SAY_IT_MAX_PARTS)) proposals.push({ kind: 'unknown', said });
  return proposals;
}
