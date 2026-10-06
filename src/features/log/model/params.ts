/**
 * The Log page's URL contract (`@/app/routes`): `/log?a=<id>&q=<qty>&src=<who>` opens the
 * sheet prefilled, `/log?custom=1` opens the custom flow. The page never logs from a URL:
 * a link can only prepare the sheet.
 */
import { PARAMS, type LogLinkSource } from '@/app/routes';
import type { LogSource } from '@/game';
import { tileFor, type Tile } from './tiles';

const LINK_SOURCES: readonly LogLinkSource[] = ['coach', 'quest', 'lesson', 'recap'];

export type LogIntent =
  | { kind: 'none' }
  | { kind: 'custom'; text: string }
  | {
      kind: 'action';
      tile: Tile;
      /** The member action the link named, when it named one (not a merged tile's own id). */
      actionId: string | null;
      qty: number | null;
      source: LogSource;
    }
  | { kind: 'unknown'; id: string };

interface ParamReader {
  get(name: string): string | null;
}

function readQty(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value <= 100_000 ? value : null;
}

/** What a set of query parameters asks the page to open. Unknown ids are reported, never guessed. */
export function parseLogParams(params: ParamReader): LogIntent {
  const id = params.get(PARAMS.logAction)?.trim() ?? '';
  if (id) {
    const tile = tileFor(id);
    if (!tile) return { kind: 'unknown', id };
    const rawSource = params.get(PARAMS.logSource);
    const source = LINK_SOURCES.find((candidate) => candidate === rawSource) ?? 'log';
    return {
      kind: 'action',
      tile,
      actionId: tile.actionIds.find((actionId) => actionId === id) ?? null,
      qty: readQty(params.get(PARAMS.logQty)),
      source,
    };
  }
  const custom = params.get(PARAMS.logCustom);
  if (custom !== null && custom !== '0' && custom !== 'false') {
    // `custom=1` only opens the flow; anything else is the text to start with.
    return { kind: 'custom', text: custom === '1' || custom === 'true' ? '' : custom.slice(0, 80) };
  }
  return { kind: 'none' };
}

/** The query string with the log parameters removed, so a reload or Back does not reopen the sheet. */
export function withoutLogParams(search: string): string {
  const next = new URLSearchParams(search);
  for (const name of [PARAMS.logAction, PARAMS.logQty, PARAMS.logSource, PARAMS.logCustom]) {
    next.delete(name);
  }
  const text = next.toString();
  return text ? `?${text}` : '';
}
