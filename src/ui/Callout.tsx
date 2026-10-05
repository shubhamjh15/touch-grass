'use client';

import type { LucideIcon } from 'lucide-react';
import { createElement, isValidElement, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { UiLink } from './Link';
import { FILL_BG, type Hue } from './tokens';

export interface CalloutProps {
  /** Which column the chip sits in. Its leader leaves from the inner edge (left chip → right edge). */
  side: 'left' | 'right';
  /** A lucide icon, or any drawn node (Moss's face). */
  icon: LucideIcon | ReactNode;
  hue: Hue | 'white' | 'paper';
  label: string;
  /** Mono meta after the label: "1/3", "12 rings". */
  meta?: string;
  href?: string;
  onClick?: () => void;
  /** The anchor is hidden behind something: its dot becomes a hollow ring. */
  occluded?: boolean;
  /**
   * Draws the leader line: the vector in px from the middle of the chip's inner edge to the anchor.
   * Omit it where a stage draws all leaders in one shared SVG.
   */
  leader?: { dx: number; dy: number };
  /** Plays the entrance: the line draws out from the dot, then the chip sticks. */
  animate?: boolean;
  /** Seconds to wait before the entrance (stagger siblings by 28 ms). */
  delay?: number;
  className?: string;
}

/**
 * The leader-line label: a pill chip with an icon disc, tied to a point by a straight ink line that
 * ends in a dot. A real link or button. Serves the landing explainers and onboarding coach-marks;
 * the island hotspots reproduce this recipe inside `src/world`.
 */
export function Callout({
  side,
  icon,
  hue,
  label,
  meta,
  href,
  onClick,
  occluded = false,
  leader,
  animate = false,
  delay = 0,
  className,
}: CalloutProps) {
  const disc =
    isValidElement(icon) ||
    typeof icon === 'string' ||
    typeof icon === 'number' ||
    icon === null ||
    icon === undefined
      ? icon
      : createElement(icon as LucideIcon, { size: 16, strokeWidth: 2.6, 'aria-hidden': true });

  const chipClass = cn(
    'inline-flex h-9 hard items-center gap-2 rounded-pill border-3 border-ink bg-white pr-3.5 pl-1 text-body-sm font-bold whitespace-nowrap text-ink lift-3 md:h-10',
    'relative after:absolute after:inset-x-0 after:-inset-y-1',
    animate && 'animate-stick',
  );
  const chipStyle: CSSProperties | undefined = animate
    ? { animationDelay: `${delay + 0.22}s` }
    : undefined;
  const content = (
    <>
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink',
          FILL_BG[hue],
        )}
        aria-hidden="true"
      >
        {disc}
      </span>
      {label}
      {meta ? <span className="type-tick text-ink-3">{meta}</span> : null}
    </>
  );

  const chip = href ? (
    <UiLink href={href} className={chipClass} style={chipStyle}>
      {content}
    </UiLink>
  ) : onClick ? (
    <button type="button" onClick={onClick} className={chipClass} style={chipStyle}>
      {content}
    </button>
  ) : (
    <span className={cn(chipClass, 'cursor-default')} style={chipStyle}>
      {content}
    </span>
  );

  return (
    <span className={cn('relative inline-flex', className)} data-side={side}>
      {leader ? (
        <svg
          aria-hidden="true"
          focusable="false"
          width={1}
          height={1}
          className={cn(
            'pointer-events-none absolute top-1/2 overflow-visible',
            side === 'left' ? 'left-full' : 'left-0',
          )}
        >
          <line
            x1={0}
            y1={0}
            x2={leader.dx}
            y2={leader.dy}
            stroke="var(--color-ink)"
            strokeWidth={2}
            className={animate ? 'animate-leader' : undefined}
            style={
              {
                transformOrigin: `${leader.dx}px ${leader.dy}px`,
                animationDelay: animate ? `${delay}s` : undefined,
              } as CSSProperties
            }
          />
          <circle
            cx={leader.dx}
            cy={leader.dy}
            r={occluded ? 5 : 6.5}
            fill={occluded ? 'var(--color-white)' : 'var(--color-ink)'}
            stroke={occluded ? 'var(--color-ink)' : 'var(--color-white)'}
            strokeWidth={3}
          />
        </svg>
      ) : null}
      {chip}
    </span>
  );
}
