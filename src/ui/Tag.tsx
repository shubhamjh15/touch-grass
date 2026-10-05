'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { UiLink } from './Link';
import { CATEGORY, FILL_BG, type CategoryId, type Swatch } from './tokens';

export type TagProps = Omit<ComponentProps<'span'>, 'title'> & {
  /** `label`: a printed slug. `specimen`: the tree's hang tag. */
  variant?: 'label' | 'specimen';
  hue?: Swatch;
  /** Colours the tag with a category fill and, without children, prints its name. */
  category?: CategoryId;
  icon?: LucideIcon;
  /** Slight print misregistration (label only). */
  misreg?: boolean;
  /** Specimen: the tree's name. */
  title?: string;
  /** Specimen: "OAK · YOUNG TREE · DAY 12 · THRIVING". */
  meta?: string;
  /** Specimen: makes the tag a link (to the passport). */
  href?: string;
  children?: ReactNode;
};

/**
 * `label`: the mono slug in a box ("DAILY", "+50 XP", a category name). Printed, so it has no shadow
 * and is never interactive. `specimen`: the paper hang tag tied to the tree.
 */
export function Tag({
  variant = 'label',
  hue = 'white',
  category,
  icon: Icon,
  misreg = false,
  title,
  meta,
  href,
  className,
  children,
  ...rest
}: TagProps) {
  if (variant === 'specimen') {
    const body = (
      <>
        <span className="block type-figure text-display-sm text-ink lg:text-display-md">
          {title}
        </span>
        {meta ? <span className="mt-1.5 block type-slug text-ink-2 lg:mt-2">{meta}</span> : null}
        {children}
      </>
    );
    const look = cn(
      'relative inline-block -rotate-3 rounded-sm border-3 border-ink bg-paper py-2 pr-2.5 pl-6 text-left lg:rounded-ctl lg:border-4 lg:py-3 lg:pr-[18px] lg:pl-9',
      // The punched hole shows what is behind the tag: the horizon band of the sky.
      'before:absolute before:top-1/2 before:left-2 before:size-[7px] before:-translate-y-1/2 before:rounded-full before:border-2 before:border-ink before:bg-(--sky-3) lg:before:left-3 lg:before:size-2.5',
      href ? 'hard lift-3' : 'shadow-2 lg:shadow-3',
      className,
    );
    if (href) {
      return (
        <UiLink href={href} className={look}>
          {body}
        </UiLink>
      );
    }
    return (
      <span className={look} {...rest}>
        {body}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-xs border-2 border-ink px-[7px] type-slug font-semibold whitespace-nowrap',
        category ? CATEGORY[category].bg : FILL_BG[hue],
        misreg && 'inset-shadow-misreg',
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon size={12} strokeWidth={2.5} aria-hidden="true" /> : null}
      {children ?? (category ? CATEGORY[category].label : null)}
    </span>
  );
}
