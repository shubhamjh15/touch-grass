'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CATEGORY, TINT_BG, type CategoryId, type Swatch } from './tokens';

const TONE: Record<Swatch, string> = {
  ...TINT_BG,
  white: 'bg-mat-deep',
  paper: 'bg-paper',
  ink: 'bg-ink text-white',
};

export type TagProps = ComponentProps<'span'> & {
  /** The label sits on this hue's tint. */
  hue?: Swatch;
  /** Tints the tag with a category colour and, without children, prints its name. */
  category?: CategoryId;
  icon?: LucideIcon;
  children?: ReactNode;
};

/**
 * A short word on a tint: "Daily", "+50 XP", "Read", a category name. Never interactive, never
 * above a heading, and one per row at most.
 */
export function Tag({
  hue = 'white',
  category,
  icon: Icon,
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-pill px-2.5 text-body-sm font-medium whitespace-nowrap text-ink',
        category ? CATEGORY[category].tintBg : TONE[hue],
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon size={14} strokeWidth={2} aria-hidden="true" /> : null}
      {children ?? (category ? CATEGORY[category].label : null)}
    </span>
  );
}
