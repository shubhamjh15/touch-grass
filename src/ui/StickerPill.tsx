'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { FILL_BG, ROTATE, type Hue, type Rotation } from './tokens';

const MARGIN = { 3: 'dc-3', 4: 'dc-4', 6: 'dc-6' } as const;

export type StickerPillProps = ComponentProps<'span'> & {
  hue: Hue | 'white';
  rotate?: Rotation;
  icon?: LucideIcon;
  /** Width of the white die-cut margin: 3 for small things, 4 by default, 6 for a hero. */
  margin?: keyof typeof MARGIN;
};

/**
 * The die-cut voice sticker (the legacy "Hey Earthling!" chip). Expressive, never interactive, at most
 * two per viewport.
 */
export function StickerPill({
  hue,
  rotate = -2,
  icon: Icon,
  margin = 4,
  className,
  children,
  ...rest
}: StickerPillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-8 diecut items-center gap-1.5 rounded-pill border-3 border-ink px-3 text-body-sm font-bold whitespace-nowrap',
        FILL_BG[hue],
        MARGIN[margin],
        ROTATE[rotate],
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon size={16} strokeWidth={2.25} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
