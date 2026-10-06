'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const BASE =
  'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border-2 border-ink bg-white px-3.5 text-body-sm font-semibold whitespace-nowrap text-ink';

const SELECTED = 'bg-ink text-white';

export interface ChipProps extends Omit<ComponentProps<'button'>, 'children'> {
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  icon?: LucideIcon;
  /** Result count shown after the label. */
  count?: number;
  /** `span` renders a static, non-interactive chip. */
  as?: 'button' | 'span';
  children: ReactNode;
}

/**
 * The filter pill. Chips filter what a list contains; they are toggle buttons (`aria-pressed`).
 * Selected is the inverse: ink fill, white text.
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
      {Icon ? <Icon size={16} strokeWidth={2} aria-hidden="true" /> : null}
      {children}
      {count !== undefined ? (
        <span className={cn('font-medium tabular-nums', selected ? 'text-white' : 'text-ink-3')}>
          {count}
        </span>
      ) : null}
    </>
  );

  if (as === 'span') {
    return <span className={cn(BASE, selected && SELECTED, className)}>{content}</span>;
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        BASE,
        // The pill is 36 px tall; the pseudo-element stretches its target to 44 px.
        'transition-colors duration-(--dur-fast) ease-out after:absolute after:inset-x-0 after:-inset-y-1',
        selected ? SELECTED : 'fine:hover:bg-mat-deep',
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
