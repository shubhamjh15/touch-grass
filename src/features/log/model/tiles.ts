/**
 * The sticker sheet's tiles. The catalogue has 51 actions; three overlap groups are drawn as
 * one tile each (spec 3.3: sorted recycling, second-hand clothes, the train-not-plane swap),
 * which leaves 46 tiles. A tile knows which actions it stands for and how it is doing today.
 */
import type { LucideIcon } from 'lucide-react';
import {
  ACTIONS,
  ACTION_BY_ID,
  CATEGORY_IDS,
  type CatalogueActionId,
  type CategoryId,
} from '@/data/catalogue';
import type { ActionState, LogRefusal } from '@/game';
import { ACTION_META, MERGED_TILE_META } from './actionMeta';

export type TileKind = 'single' | 'recycling' | 'secondhand' | 'flight-swap';
export type MergedTileId = keyof typeof MERGED_TILE_META;

export interface Tile {
  /** The action's id, or the overlap group's id for a merged tile. */
  id: string;
  kind: TileKind;
  category: CategoryId;
  /** The caption under the sticker. */
  label: string;
  /** The full sentence, as the sheet's title and the accessible name. */
  title: string;
  icon: LucideIcon;
  /** The actions this tile can log, in catalogue order. */
  actionIds: readonly CatalogueActionId[];
  /** Lower-case search words beyond the title. */
  synonyms: readonly string[];
  /** Position on the sheet in catalogue order. */
  order: number;
}

const MERGED: Readonly<Record<MergedTileId, readonly CatalogueActionId[]>> = {
  recycling: [
    'recycle-aluminium-can',
    'recycle-glass-bottle',
    'recycle-plastic-bottle',
    'recycle-paper',
  ],
  secondhand: ['second-hand-tshirt', 'second-hand-jeans'],
  'flight-swap': ['train-instead-of-short-flight-km', 'train-instead-of-short-flight-trip'],
};

const MERGED_BY_ACTION = new Map<string, MergedTileId>();
for (const [tileId, members] of Object.entries(MERGED) as [
  MergedTileId,
  readonly CatalogueActionId[],
][]) {
  for (const member of members) MERGED_BY_ACTION.set(member, tileId);
}

function unique(words: readonly string[]): string[] {
  return [...new Set(words)];
}

function buildTiles(): Tile[] {
  const tiles: Tile[] = [];
  const done = new Set<MergedTileId>();
  for (const action of ACTIONS) {
    const mergedId = MERGED_BY_ACTION.get(action.id);
    if (!mergedId) {
      const meta = ACTION_META[action.id];
      tiles.push({
        id: action.id,
        kind: 'single',
        category: action.category,
        label: meta.label,
        title: action.title,
        icon: meta.icon,
        actionIds: [action.id],
        synonyms: meta.synonyms,
        order: tiles.length,
      });
      continue;
    }
    if (done.has(mergedId)) continue;
    done.add(mergedId);
    const meta = MERGED_TILE_META[mergedId];
    const members = MERGED[mergedId];
    tiles.push({
      id: mergedId,
      kind: mergedId,
      category: action.category,
      label: meta.label,
      title: meta.title,
      icon: meta.icon,
      actionIds: members,
      // A merged tile answers to every word its members answer to, and to each member's own title.
      synonyms: unique([
        ...meta.synonyms,
        ...members.flatMap((member) => ACTION_META[member].synonyms),
        ...members.flatMap((member) => {
          const title = ACTION_BY_ID.get(member)?.title;
          return title ? [title.toLowerCase()] : [];
        }),
      ]),
      order: tiles.length,
    });
  }
  return tiles;
}

/** Every tile of the sheet, in catalogue order. */
export const TILES: readonly Tile[] = buildTiles();

export const TILE_BY_ID: ReadonlyMap<string, Tile> = new Map(TILES.map((tile) => [tile.id, tile]));

const TILE_BY_ACTION: ReadonlyMap<string, Tile> = new Map(
  TILES.flatMap((tile) => tile.actionIds.map((actionId) => [actionId, tile] as const)),
);

/** The tile that logs an action. Accepts a catalogue action id or a merged tile's own id. */
export function tileFor(id: string): Tile | undefined {
  return TILE_BY_ACTION.get(id) ?? TILE_BY_ID.get(id);
}

/** How many actions there are to browse: the number the search field and the slug print. */
export const ACTION_COUNT = ACTIONS.length;

export interface TileState {
  tile: Tile;
  /** Today's state of each member that is not hidden (all members when every one is hidden). */
  members: readonly ActionState[];
  /** Every member is hidden ("Not for me", or a heat action in a home without heating). */
  hidden: boolean;
  /** No rewarded acts left today: a log adds kilograms only. */
  maxed: boolean;
  /** Nothing on this tile can be logged right now, and why. */
  blocked: LogRefusal | null;
  /** Logs in the last 14 days, across the members. */
  recentLogs: number;
  inFocus: boolean;
}

/** Joins the engine's per-action states into per-tile states, in catalogue order. */
export function tileStates(states: readonly ActionState[]): TileState[] {
  const byId = new Map(states.map((state) => [state.action.id, state]));
  const result: TileState[] = [];
  for (const tile of TILES) {
    const all = tile.actionIds
      .map((actionId) => byId.get(actionId))
      .filter((state): state is ActionState => state !== undefined);
    if (all.length === 0) continue;
    const visible = all.filter((state) => !state.hidden);
    const members = visible.length > 0 ? visible : all;
    const open = members.filter((state) => state.blocked === null);
    result.push({
      tile,
      members,
      hidden: visible.length === 0,
      maxed: members.every((state) => state.maxed),
      blocked: open.length === 0 ? (members[0]?.blocked ?? null) : null,
      recentLogs: all.reduce((sum, state) => sum + state.recentLogs, 0),
      inFocus: all.some((state) => state.inFocus),
    });
  }
  return result;
}

export type LogTab = 'for-you' | CategoryId;

export const LOG_TABS: readonly LogTab[] = ['for-you', ...CATEGORY_IDS];

export function isLogTab(value: string): value is LogTab {
  return (LOG_TABS as readonly string[]).includes(value);
}

/** A tile that can still earn something today sorts before one that cannot. */
function spent(state: TileState): number {
  if (state.blocked) return 2;
  return state.maxed ? 1 : 0;
}

/**
 * The tiles a tab shows, hidden ones left out.
 * - A category: catalogue order, with maxed and unavailable tiles sunk to the end.
 * - For you: focus categories first, then what you log most, then catalogue order;
 *   maxed and unavailable tiles sink to the end here too.
 */
export function tilesForTab(states: readonly TileState[], tab: LogTab): TileState[] {
  const shown = states.filter((state) => !state.hidden);
  if (tab !== 'for-you') {
    return shown
      .filter((state) => state.tile.category === tab)
      .sort((a, b) => spent(a) - spent(b) || a.tile.order - b.tile.order);
  }
  return [...shown].sort(
    (a, b) =>
      spent(a) - spent(b) ||
      Number(b.inFocus) - Number(a.inFocus) ||
      b.recentLogs - a.recentLogs ||
      a.tile.order - b.tile.order,
  );
}

/** Tiles per tab, hidden ones included: an empty tab can then say "you've hidden everything here". */
export function hiddenCount(states: readonly TileState[], tab: LogTab): number {
  return states.filter(
    (state) => state.hidden && (tab === 'for-you' || state.tile.category === tab),
  ).length;
}
