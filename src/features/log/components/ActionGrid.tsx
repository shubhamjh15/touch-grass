'use client';

import { Plus } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/cn';
import { Sticker } from '@/ui';
import { COPY } from '../copy';
import type { Tile, TileState } from '../model/tiles';

/** One white tile: a card that is itself a button. It moves on hover and press, nothing else. */
const TILE =
  'flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-ink bg-card px-3 py-4 text-center text-body-sm font-semibold text-ink transition-transform duration-(--dur-fast) ease-out active:translate-y-px fine:hover:-translate-y-0.5';

const ActionTile = memo(function ActionTile({
  tile,
  onOpen,
}: {
  tile: Tile;
  onOpen: (tile: Tile) => void;
}) {
  return (
    <li>
      <button type="button" data-tile={tile.id} className={TILE} onClick={() => onOpen(tile)}>
        <Sticker category={tile.category} icon={tile.icon} rotate={0} />
        <span className="text-balance">{tile.label}</span>
      </button>
    </li>
  );
});

export interface ActionGridProps {
  tiles: readonly TileState[];
  onOpen: (tile: Tile) => void;
  /** The "Something else" tile, always last. */
  onCustom: () => void;
  /** Accessible name of the list. */
  label?: string;
}

/**
 * The action stickers: two across on a phone, three from `sm`, four from `lg` (twelve tiles fill whole rows of 2, 3 and 4).
 * A tile shows what the action is and nothing about today's caps; the sheet says those.
 */
export function ActionGrid({ tiles, onOpen, onCustom, label = COPY.grid.label }: ActionGridProps) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4"
    >
      {tiles.map(({ tile }) => (
        <ActionTile key={tile.id} tile={tile} onOpen={onOpen} />
      ))}
      <li>
        <button
          type="button"
          data-log-custom=""
          className={cn(TILE, 'border-dashed bg-transparent')}
          onClick={onCustom}
        >
          <span
            aria-hidden="true"
            className="grid size-[66px] place-items-center rounded-full border-2 border-ink bg-card"
          >
            <Plus size={28} strokeWidth={2} />
          </span>
          <span>{COPY.custom.tile}</span>
        </button>
      </li>
    </ul>
  );
}
