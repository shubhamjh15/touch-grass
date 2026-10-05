'use client';

import { Check } from 'lucide-react';
import { useRef, useState, type ComponentProps, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { clamp } from '@/lib/math';
import { Card } from './Card';
import { Meter } from './Meter';
import { Tag } from './Tag';
import type { CategoryId, Swatch } from './tokens';

export type QuestKind = 'daily' | 'weekly' | 'epic';
export type TearStubState = 'active' | 'claimable' | 'claimed' | 'expired';

const KIND: Record<QuestKind, { label: string; hue: Swatch }> = {
  daily: { label: 'Daily', hue: 'blue' },
  weekly: { label: 'Weekly', hue: 'yellow' },
  epic: { label: 'Epic', hue: 'pink' },
};

/** How far (px) the stub must be dragged along the tear before letting go claims it. */
const TEAR_DISTANCE = 28;
const MAX_PULL = 44;

export type TearStubProps = Omit<ComponentProps<'div'>, 'children' | 'title'> & {
  title: string;
  description?: string;
  category?: CategoryId;
  kind?: QuestKind;
  progress: { value: number; max: number };
  /** The reward as printed on the stub: "+50 XP". */
  reward: string;
  state: TearStubState;
  /** Mono meta on the tag row: "9 H LEFT". */
  timeLeft?: string;
  /** Called once when the stub is torn off (click, Enter, Space, or a drag along the perforation). */
  onClaim?: () => void;
  /** The first claimable card of a list takes the second colour plate. One per viewport. */
  featured?: boolean;
  /** The surface the row sits on, for the perforation notches. */
  surface?: 'mat' | 'card' | 'paper';
};

const NOTCH = {
  mat: '[--notch-bg:var(--color-mat)]',
  card: '[--notch-bg:var(--color-card)]',
  paper: '[--notch-bg:var(--color-paper)]',
} as const;

/**
 * The quest row: a ticket whose reward is a perforated stub you tear off. The stub is a real button,
 * so Enter and Space tear it too; dragging it sideways is an optional flourish, never the only way.
 */
export function TearStub({
  title,
  description,
  category,
  kind,
  progress,
  reward,
  state,
  timeLeft,
  onClaim,
  featured = false,
  surface = 'mat',
  className,
  ...rest
}: TearStubProps) {
  const [torn, setTorn] = useState(false);
  const [pull, setPull] = useState(0);
  const [seenState, setSeenState] = useState(state);
  const drag = useRef<{ startX: number; moved: boolean; pull: number } | null>(null);
  // A drag ends with a click event; this keeps a cancelled drag from claiming.
  const suppressClick = useRef(false);

  // An undone claim makes the stub tearable again.
  if (seenState !== state) {
    setSeenState(state);
    if (state !== 'claimed') setTorn(false);
  }

  const claimed = state === 'claimed';
  const expired = state === 'expired';
  const claimable = state === 'claimable';
  const amount = reward.replace(/\s*XP$/i, '');

  const claim = () => {
    if (!claimable || torn) return;
    setTorn(true);
    setPull(0);
    onClaim?.();
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { startX: event.clientX, moved: false, pull: 0 };
    suppressClick.current = false;
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const distance = clamp(event.clientX - current.startX, 0, MAX_PULL);
    if (distance > 4) current.moved = true;
    if (current.moved) {
      current.pull = distance;
      setPull(distance);
    }
  };
  const endDrag = (released: boolean) => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) return;
    suppressClick.current = released;
    if (released && current.pull >= TEAR_DISTANCE) claim();
    else setPull(0);
  };

  const stubBase =
    'perf-l relative grid w-[84px] shrink-0 place-items-center rounded-r-[9px] px-1 text-center lg:w-24 md:rounded-r-[12px]';

  return (
    <Card
      padded={false}
      featured={featured && claimable}
      data-state={state}
      className={cn(
        'flex items-stretch [--notch-bw:3px] md:[--notch-bw:4px]',
        NOTCH[surface],
        claimed && 'bg-green',
        expired && 'dieline text-ink-3 shadow-none md:border-2',
        className,
      )}
      {...rest}
    >
      <div className="min-w-0 flex-1 py-2.5 pr-3 pl-3.5 md:py-3 md:pl-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {kind ? <Tag hue={expired ? 'white' : KIND[kind].hue}>{KIND[kind].label}</Tag> : null}
          {category ? (
            <Tag category={category} hue="white" className={expired ? 'bg-white' : undefined} />
          ) : null}
          {claimed ? (
            <span className="type-slug text-ink">Claimed · {reward}</span>
          ) : (
            <Tag>{reward}</Tag>
          )}
          {timeLeft && !claimed ? <span className="type-slug text-ink-3">{timeLeft}</span> : null}
        </div>
        <h4 className="mt-1.5 text-h4">
          <span className="relative inline-block">
            {title}
            {claimed ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-[55%] h-0.5 origin-left animate-strike bg-ink"
              />
            ) : null}
          </span>
          {claimed ? <span className="sr-only"> (claimed)</span> : null}
          {expired ? <span className="sr-only"> (expired)</span> : null}
        </h4>
        {description ? (
          <p
            className={cn(
              'mt-0.5 text-body-sm',
              expired ? 'text-ink-3' : claimed ? 'text-ink' : 'text-ink-2',
            )}
          >
            {description}
          </p>
        ) : null}
        {claimed ? null : (
          <div className="mt-2 flex items-center gap-2">
            {progress.max <= 7 ? (
              <Meter pips value={progress.value} max={progress.max} label={`${title} progress`} />
            ) : (
              <Meter
                size="sm"
                value={progress.value}
                max={progress.max}
                label={`${title} progress`}
                className="w-24"
              />
            )}
            <span className="font-mono text-data-sm leading-none text-ink-2" aria-hidden="true">
              {Math.min(progress.value, progress.max)} / {progress.max}
            </span>
          </div>
        )}
      </div>

      {claimable ? (
        <button
          type="button"
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            claim();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          onPointerLeave={() => endDrag(false)}
          data-pulling={pull > 0 || undefined}
          className={cn(
            stubBase,
            'origin-top-left touch-pan-y bg-yellow text-button-sm text-ink focus-inset transition-[transform,background-color] duration-(--dur-fast) ease-peel active:bg-yellow-tint data-pulling:transition-none fine:hover:bg-yellow-tint',
          )}
          style={
            pull > 0
              ? {
                  transform: `translate(${pull * 0.4}px, ${-pull * 0.14}px) rotate(${pull * 0.32}deg)`,
                }
              : undefined
          }
        >
          <span>
            Claim <span className="whitespace-nowrap">{amount}</span>
            <span className="sr-only"> XP for {title}</span>
          </span>
        </button>
      ) : claimed ? (
        <div className={cn(stubBase, 'text-ink')}>
          <Check
            size={24}
            strokeWidth={3}
            aria-hidden="true"
            className={torn ? 'animate-pop' : undefined}
          />
          {torn ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid origin-top-left animate-tear place-items-center rounded-r-[9px] border-l-2 border-dashed border-ink bg-yellow text-button-sm calm:hidden"
            >
              {amount}
            </span>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            expired
              ? 'grid w-[84px] shrink-0 place-items-center border-l-2 border-dashed border-ink-4 px-1 text-center lg:w-24'
              : [stubBase, 'bg-white'],
          )}
        >
          <span className="font-mono text-data font-semibold text-ink-3">{reward}</span>
        </div>
      )}

      <span role="status" className="sr-only">
        {torn && claimed ? `Claimed. Plus ${amount.replace(/^\+/, '')} XP.` : ''}
      </span>
    </Card>
  );
}
