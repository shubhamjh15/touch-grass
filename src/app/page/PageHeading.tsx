'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Marquee, type MarqueeProps } from '@/ui';

export interface PageHeadingProps {
  /** Mono line above the title: "TUESDAY 06 OCTOBER", "42 ACTIONS". */
  slug?: string;
  /** The `h1` of the page. The shell moves focus here on navigation. */
  title: string;
  lead?: string;
  fill?: MarqueeProps['fill'];
  /** What sits to the right of the title; the app's header puts the grove sticker here. */
  aside?: ReactNode;
  /** A control or two under the title (a filter, a primary button). */
  children?: ReactNode;
  className?: string;
}

/**
 * Slug, die-cut title and lead: the text half of every page header. The public reading pages
 * use it directly, so they do not download the grove's stage for a header that never shows it;
 * app pages use `PageHeader`, which adds the grove sticker.
 */
export function PageHeading({
  slug,
  title,
  lead,
  fill,
  aside,
  children,
  className,
}: PageHeadingProps) {
  return (
    <header className={cn('grid gap-3 pb-5 lg:pb-7', className)}>
      <div className="flex items-start justify-between gap-3">
        <Marquee slug={slug} title={title} lead={lead} fill={fill} className="min-w-0 flex-1" />
        {aside}
      </div>
      {children}
    </header>
  );
}
