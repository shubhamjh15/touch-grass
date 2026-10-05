'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const BASE =
  'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border-2 border-ink bg-white px-3 text-caption font-semibold whitespace-nowrap text-ink';

export interface ChipProps extends Omit<ComponentProps<'button'>, 'children'> {
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  icon?: LucideIcon;
  /** Result count shown after the label in mono. */
  count?: number;
  /** `span` renders a static, non-interactive chip. */
  as?: 'button' | 'span';
  children: ReactNode;
}

/**
 * The filter pill. Chips filter what a panel contains; they are toggle buttons (`aria-pressed`).
 * Selected is yellow plus a shape change: a hard shadow and a −2° turn.
 */
export function Chip({
  selected = false,
  onSelectedChange,
  icon: Icon,
  count,
  as = 'button',
  className,
  children,
  onClick,
  ...rest
}: ChipProps) {
  const content = (
    <>
      {Icon ? <Icon size={14} strokeWidth={2.25} aria-hidden="true" /> : null}
      {children}
      {count !== undefined ? (
        <span className="font-mono text-[0.6875rem] font-medium text-ink-3">{count}</span>
      ) : null}
    </>
  );

  if (as === 'span') {
    return (
      <span className={cn(BASE, selected && '-rotate-2 bg-yellow font-bold shadow-1', className)}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        BASE,
        'transition-[rotate,background-color] duration-(--dur-fast) ease-out after:absolute after:inset-x-0 after:-inset-y-1.5 fine:hover:bg-mat-deep',
        selected && '-rotate-2 bg-yellow font-bold flat-2 fine:hover:bg-yellow',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelectedChange?.(!selected);
      }}
      {...rest}
    >
      {content}
    </button>
  );
}
