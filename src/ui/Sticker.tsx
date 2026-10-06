'use client';

import type { LucideIcon } from 'lucide-react';
import { useId, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { clamp } from '@/lib/math';
import { CATEGORY_ICON } from './categoryIcons';
import { STICKER_SHAPES } from './stickerShapes';
import { CATEGORY, restRotation, type CategoryId } from './tokens';

export type StickerSize = 32 | 44 | 66 | 96;

const COLUMN: Record<StickerSize, string> = {
  32: 'w-11',
  44: 'w-14',
  66: 'w-[74px]',
  96: 'w-[104px]',
};

const INK = 'var(--color-ink)';
const WHITE = 'var(--color-sticker)';

interface StickerArtProps {
  category: CategoryId;
  icon?: LucideIcon;
  size: StickerSize;
  rotate: number;
  ghost: boolean;
  dimmed: boolean;
  selected: boolean;
  interactive: boolean;
  title?: string;
  className?: string;
}

/** The SVG itself: silhouette painted four times (shadow, cut line, margin, body), then the icon. */
function StickerArt({
  category,
  icon,
  size,
  rotate,
  ghost,
  dimmed,
  selected,
  interactive,
  title,
  className,
}: StickerArtProps) {
  const pathId = useId();
  const shape = STICKER_SHAPES[category];
  const Icon = icon ?? CATEGORY_ICON[category];
  const outline = ghost || dimmed;

  return (
    <svg
      viewBox="0 0 66 66"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-shape={shape.name}
      className={cn(
        'block shrink-0 overflow-visible transition-[rotate,translate] duration-(--dur-fast) ease-out',
        interactive &&
          'group-aria-disabled/sticker:translate-y-0 fine:group-hover/sticker:-translate-y-0.5 fine:group-hover/sticker:rotate-0',
        className,
      )}
      style={{ rotate: `${rotate}deg` } as CSSProperties}
    >
      <defs>
        <path id={pathId} d={shape.d} />
      </defs>
      {outline ? (
        <>
          <use
            href={`#${pathId}`}
            fill="none"
            stroke="var(--color-ink-4)"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinejoin="round"
          />
          {dimmed ? (
            <Icon
              x={20 + shape.iconDx}
              y={20 + shape.iconDy}
              width={26}
              height={26}
              strokeWidth={2.25}
              color="var(--color-ink-4)"
            />
          ) : null}
        </>
      ) : (
        <>
          <use
            href={`#${pathId}`}
            transform="translate(3 3)"
            fill={INK}
            stroke={INK}
            strokeWidth={10}
            strokeLinejoin="round"
          />
          <g
            className={cn(
              'transition-[translate] duration-(--dur-press) ease-out',
              interactive &&
                'group-active/sticker:translate-[3px] group-data-[pressed=true]/sticker:translate-[3px]',
            )}
          >
            <use
              href={`#${pathId}`}
              fill={INK}
              stroke={INK}
              strokeWidth={10}
              strokeLinejoin="round"
            />
            <use
              href={`#${pathId}`}
              fill={WHITE}
              stroke={WHITE}
              strokeWidth={7}
              strokeLinejoin="round"
            />
            <use
              href={`#${pathId}`}
              fill={CATEGORY[category].fillVar}
              stroke={INK}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            {category === 'nature' ? (
              <use
                href={`#${pathId}`}
                fill="none"
                stroke={INK}
                strokeOpacity={0.18}
                strokeWidth={2}
                transform="translate(33 33) scale(0.82) translate(-33 -33)"
              />
            ) : null}
            {shape.hole ? (
              <circle
                cx={shape.hole.cx}
                cy={shape.hole.cy}
                r={shape.hole.r}
                fill={WHITE}
                stroke={INK}
                strokeWidth={2.5}
              />
            ) : null}
            <Icon
              x={20 + shape.iconDx}
              y={20 + shape.iconDy}
              width={26}
              height={26}
              strokeWidth={2.25}
              color={INK}
            />
            {selected ? (
              <g>
                <circle
                  cx={56}
                  cy={9}
                  r={10}
                  fill="var(--color-yellow)"
                  stroke={INK}
                  strokeWidth={2}
                />
                <path
                  d="M51.5 9.2l3.2 3.2 5.8-6.2"
                  fill="none"
                  stroke={INK}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
          </g>
        </>
      )}
    </svg>
  );
}

export type StickerProps = Omit<ComponentProps<'button'>, 'children' | 'onClick'> & {
  category: CategoryId;
  /** Overrides the category's default glyph. */
  icon?: LucideIcon;
  size?: StickerSize;
  /** Resting rotation in degrees (clamped to ±5). Defaults to a stable pick from the label. */
  rotate?: number;
  /** The empty album slot: only the dashed silhouette. */
  ghost?: boolean;
  /** Visible caption under an interactive sticker; the accessible name of a static one. */
  label?: string;
  /** Hides the caption visually (it stays the accessible name). */
  hideLabel?: boolean;
  /** Makes the sticker a button. */
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** A small tag pinned under the sticker ("MAXED"). */
  badge?: ReactNode;
};

/**
 * The shape-coded action sticker. Category is coded three ways: silhouette, glyph and colour.
 * With `onClick` it is a button that rotates upright on hover and presses onto its shadow.
 */
export function Sticker({
  category,
  icon,
  size = 66,
  rotate,
  ghost = false,
  label,
  hideLabel = false,
  onClick,
  selected = false,
  disabled = false,
  badge,
  className,
  ...rest
}: StickerProps) {
  const turn = clamp(rotate ?? restRotation(`${category}:${label ?? ''}`, 4), -5, 5);
  const art = (interactive: boolean, title?: string) => (
    <StickerArt
      category={category}
      icon={icon}
      size={size}
      rotate={ghost ? 0 : turn}
      ghost={ghost}
      dimmed={disabled && !ghost}
      selected={selected}
      interactive={interactive}
      title={title}
    />
  );

  if (!onClick) {
    if (!badge) {
      return (
        <span className={cn('inline-block align-middle', className)}>{art(false, label)}</span>
      );
    }
    return (
      <span className={cn('relative inline-flex flex-col items-center gap-1.5', className)}>
        {art(false, label)}
        {badge}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected || undefined}
      aria-disabled={disabled || undefined}
      aria-label={hideLabel ? label : undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={cn(
        'group/sticker inline-flex shrink-0 flex-col items-center gap-2 rounded-sm text-center text-body-sm leading-[1.2] font-semibold text-ink aria-disabled:cursor-not-allowed aria-disabled:text-ink-3',
        COLUMN[size],
        className,
      )}
      {...rest}
    >
      {art(!disabled)}
      {label && !hideLabel ? <span className="text-balance">{label}</span> : null}
      {badge}
    </button>
  );
}
