'use client';

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ROUTES } from '@/app/routes';
import { gameActions } from '@/game';
import { cn } from '@/lib/cn';
import { Button, EmptyState, Sticker, Tag, TextLink, enterDelay } from '@/ui';
import { COPY } from '../copy';
import type { Tile, TileState } from '../model/tiles';

const LONG_PRESS_MS = 550;
/** A finger that travels further than this is scrolling, not pressing. */
const LONG_PRESS_SLOP = 10;

function badgeFor(state: TileState) {
  if (state.blocked) {
    const label =
      state.blocked.reason === 'covered-by-day' || state.blocked.reason === 'meals-logged'
        ? COPY.sheet.covered
        : state.blocked.reason === 'cooldown'
          ? COPY.sheet.resting
          : COPY.sheet.done;
    return <Tag hue="white">{label}</Tag>;
  }
  if (state.maxed) return <Tag hue="green">{COPY.sheet.maxed}</Tag>;
  return undefined;
}

function nameFor(state: TileState): string {
  const base = `${state.tile.label}: ${state.tile.title}`;
  if (state.blocked) return COPY.sheet.blockedName(base, state.blocked.message);
  if (state.maxed) return COPY.sheet.maxedName(base);
  return base;
}

interface CellProps {
  state: TileState;
  index: number;
  onOpen: (tile: Tile) => void;
  onNotForMe: (tile: Tile) => void;
}

/**
 * One slot of the sheet. A tap opens the quick-log sheet; a long press or the context menu
 * offers "Not for me" (the sheet itself offers it too, so neither gesture is the only way).
 */
function Cell({ state, index, onOpen, onNotForMe }: CellProps) {
  const { tile } = state;
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  /** Set when a long press fired, so the click that follows the release is swallowed. */
  const held = useRef(false);

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  const onPointerDown = (event: PointerEvent<HTMLLIElement>) => {
    if (event.pointerType === 'mouse') return;
    held.current = false;
    cancel();
    press.current = {
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => {
        press.current = null;
        held.current = true;
        onNotForMe(tile);
      }, LONG_PRESS_MS),
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLLIElement>) => {
    const start = press.current;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP) cancel();
  };

  return (
    <li
      className="flex animate-scrim-in justify-center [&_button]:scroll-mt-6 lg:[&_button]:scroll-mt-32 border-r-2 border-b-2 border-dashed border-ink-4 px-0.5 pt-3.5 pb-3 select-none [-webkit-touch-callout:none]"
      style={{ animationDelay: `${enterDelay(index) * 1000}ms` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(event) => {
        event.preventDefault();
        cancel();
        if (held.current) return;
        held.current = true;
        onNotForMe(tile);
      }}
    >
      <Sticker
        category={tile.category}
        icon={tile.icon}
        label={tile.label}
        aria-label={nameFor(state)}
        badge={badgeFor(state)}
        data-tile={tile.id}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          onOpen(tile);
        }}
      />
    </li>
  );
}

export interface StickerGridProps {
  tiles: readonly TileState[];
  onOpen: (tile: Tile) => void;
  onNotForMe: (tile: Tile) => void;
  /** Accessible name of the list: "Move actions", "Results for bus". */
  label: string;
}

/**
 * The kiss-cut grid: four slots across on a phone, five from `sm`, six from `xl`. The dashed
 * guides are each slot's right and bottom edge; the frame clips the outermost ones away.
 */
export function StickerGrid({ tiles, onOpen, onNotForMe, label }: StickerGridProps) {
  return (
    <div className="overflow-hidden">
      <ul
        aria-label={label}
        className="-mr-0.5 -mb-0.5 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6"
      >
        {tiles.map((state, index) => (
          <Cell
            key={state.tile.id}
            state={state}
            index={index}
            onOpen={onOpen}
            onNotForMe={onNotForMe}
          />
        ))}
      </ul>
    </div>
  );
}

export interface HiddenTrayProps {
  hidden: readonly TileState[];
  /** Nothing else is on this page: say so instead of showing a bare toggle. */
  alone: boolean;
}

/** The tiles tucked away by "Not for me", with a way to bring each back without leaving the page. */
export function HiddenTray({ hidden, alone }: HiddenTrayProps) {
  const [open, setOpen] = useState(false);
  if (hidden.length === 0) return null;

  const list = (
    <ul className="mt-3 grid gap-2">
      {hidden.map(({ tile }) => (
        <li
          key={tile.id}
          className="flex min-h-12 items-center gap-3 rounded-sm dieline py-1.5 pr-1.5 pl-3"
        >
          <Sticker category={tile.category} icon={tile.icon} size={32} disabled />
          <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink-2">
            {tile.title}
          </span>
          <Button
            size="sm"
            variant="neutral"
            aria-label={`${COPY.sheet.bringBack}: ${tile.title}`}
            onClick={() => {
              for (const actionId of tile.actionIds) gameActions.unhideAction(actionId);
            }}
          >
            {COPY.sheet.bringBack}
          </Button>
        </li>
      ))}
    </ul>
  );

  if (alone) {
    return (
      <div>
        <EmptyState
          slug={COPY.sheet.hiddenAllSlug}
          title={COPY.sheet.hiddenAll}
          action={<TextLink href={ROUTES.me}>{COPY.sheet.manageHidden}</TextLink>}
          className="min-h-[180px]"
        />
        {list}
      </div>
    );
  }

  return (
    <div className={cn('mt-3 border-t-[1.5px] border-ink pt-2')}>
      <div className="flex items-center justify-between gap-3">
        <p className="type-slug text-ink-3">{COPY.sheet.hiddenToggle(hidden.length)}</p>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? COPY.sheet.hide : COPY.sheet.show}
        </Button>
      </div>
      {open ? list : null}
    </div>
  );
}
