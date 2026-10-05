'use client';

import type { LucideIcon } from 'lucide-react';
import { useId, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { clamp01 } from '@/lib/math';
import { hashString } from '@/lib/rng';
import { DEEP_TEXT, type Hue } from './tokens';

export type BadgeSize = 72 | 96 | 160;
export type BadgeState = 'earned' | 'locked' | 'secret';

const CAPTION: Record<BadgeSize, string> = {
  72: 'w-[88px]',
  96: 'w-28',
  160: 'w-44',
};

export type BadgeMedalProps = Omit<ComponentProps<'div'>, 'children' | 'onClick' | 'slot'> & {
  name: string;
  icon: LucideIcon;
  hue: Hue;
  tier?: 1 | 2 | 3;
  state: BadgeState;
  /** Locked: how far along, e.g. `{ value: 34, max: 50, unit: 'logs' }`. */
  progress?: { value: number; max: number; unit: string };
  /** Earned: label-maker date, "06 OCT 2026". */
  earnedOn?: string;
  /** Album slot number, shown as "Nº 07" on locked badges. */
  slot?: number;
  /** Secret: a one-line riddle. */
  hint?: string;
  size?: BadgeSize;
  /** Makes an earned badge a button (opens it large in a Modal). */
  onOpen?: () => void;
};

function star(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.45;
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

/**
 * A badge. Earned = a round rubber-stamp impression in the hue's deep ink. Locked = a dashed, numbered
 * album slot with a progress arc (no padlock: an empty circle already says "not yet"). Secret = "???".
 */
export function BadgeMedal({
  name,
  icon: Icon,
  hue,
  tier,
  state,
  progress,
  earnedOn,
  slot,
  hint,
  size = 96,
  onOpen,
  className,
  ...rest
}: BadgeMedalProps) {
  const id = useId();
  const slotLabel = slot === undefined ? null : `Nº ${String(slot).padStart(2, '0')}`;
  const turn = ((hashString(name) % 17) - 8) as number;
  const stars = tier ?? 0;

  let medal;
  let caption;
  let detail: string | null;

  if (state === 'earned') {
    caption = name;
    detail = earnedOn ?? null;
    medal = (
      <span
        className={cn('grid place-items-center rounded-full bg-paper', DEEP_TEXT[hue])}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
          className="block overflow-visible stamp-ink"
          style={{ rotate: `${turn}deg` }}
        >
          <defs>
            <path id={`${id}-top`} d="M19 50a31 31 0 0 1 62 0" />
            <path id={`${id}-bottom`} d="M12 50a38 38 0 0 0 76 0" />
          </defs>
          <circle cx={50} cy={50} r={47} fill="none" stroke="currentColor" strokeWidth={3} />
          <circle cx={50} cy={50} r={42.5} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <text
            fill="currentColor"
            fontSize={8.5}
            fontWeight={700}
            letterSpacing="0.1em"
            className="font-mono uppercase [font-stretch:75%]"
          >
            <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
              {name}
            </textPath>
          </text>
          {earnedOn ? (
            <text
              fill="currentColor"
              fontSize={6.5}
              fontWeight={600}
              letterSpacing="0.12em"
              className="font-mono uppercase [font-stretch:75%]"
            >
              <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
                {earnedOn}
              </textPath>
            </text>
          ) : null}
          <Icon
            x={36}
            y={stars > 0 ? 31 : 35}
            width={28}
            height={28}
            strokeWidth={2.25}
            color="currentColor"
          />
          {Array.from({ length: stars }, (_, index) => (
            <polygon
              key={index}
              points={star(50 + (index - (stars - 1) / 2) * 9, 67, 3.6)}
              fill="currentColor"
            />
          ))}
        </svg>
      </span>
    );
  } else if (state === 'locked') {
    const fraction = progress ? clamp01(progress.value / Math.max(progress.max, 1)) : 0;
    const radius = 44;
    const circumference = 2 * Math.PI * radius;
    caption = name;
    detail = progress ? `${progress.value} / ${progress.max} ${progress.unit}` : 'Not yet';
    medal = (
      <span
        className="relative grid place-items-center text-ink-3"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0"
        >
          <circle
            cx={50}
            cy={50}
            r={48}
            fill="none"
            stroke="var(--color-ink-4)"
            strokeWidth={1.6}
            strokeDasharray="5 4"
          />
          {fraction > 0 ? (
            <circle
              cx={50}
              cy={50}
              r={radius}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={4}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - fraction)}
              transform="rotate(-90 50 50)"
            />
          ) : null}
        </svg>
        <span className="relative grid place-items-center gap-1">
          <Icon size={Math.round(size * 0.3)} strokeWidth={2.25} aria-hidden="true" />
          {slotLabel ? <span className="type-tick">{slotLabel}</span> : null}
        </span>
      </span>
    );
  } else {
    caption = 'Secret badge';
    detail = hint ?? null;
    medal = (
      <span
        className="grid place-items-center rounded-full dieline text-ink-3"
        style={{ width: size, height: size }}
      >
        <span className="grid place-items-center gap-1">
          <span
            className={cn('type-figure', size === 72 ? 'text-display-xs' : 'text-display-sm')}
            aria-hidden="true"
          >
            ???
          </span>
          {slotLabel ? <span className="type-tick">{slotLabel}</span> : null}
        </span>
      </span>
    );
  }

  const text = (
    <span className={cn('mt-2 block text-center', CAPTION[size])}>
      <span
        className={cn(
          'block text-caption leading-[1.25] font-bold text-balance',
          state === 'earned' ? 'text-ink' : 'text-ink-3',
        )}
      >
        {caption}
        {state === 'locked' ? <span className="sr-only"> (not earned yet)</span> : null}
      </span>
      {detail ? (
        <span
          className={cn(
            'mt-1 block text-ink-3',
            state === 'secret' ? 'text-caption' : 'type-tick leading-[1.3]',
          )}
        >
          {detail}
        </span>
      ) : null}
    </span>
  );

  if (state === 'earned' && onOpen) {
    return (
      <div className={cn('inline-flex flex-col items-center', className)} {...rest}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${name}, earned${earnedOn ? ` ${earnedOn}` : ''}. Open badge`}
          className="rounded-full transition-transform duration-(--dur-fast) ease-out active:translate-0.5 fine:hover:-translate-0.5"
        >
          {medal}
        </button>
        {text}
      </div>
    );
  }

  return (
    <div className={cn('inline-flex flex-col items-center', className)} {...rest}>
      {medal}
      {text}
    </div>
  );
}
