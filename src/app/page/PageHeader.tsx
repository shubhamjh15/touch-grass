'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useBreakpoint } from '@/lib/hooks';
import { Marquee, type MarqueeProps } from '@/ui';
import { WorldStage } from '@/world';
import { useBootSceneLabel } from '../boot/bootStore';

export interface PageHeaderProps {
  /** Mono line above the title: "TUESDAY 06 OCTOBER", "42 ACTIONS". */
  slug?: string;
  /** The `h1` of the page. The shell moves focus here on navigation. */
  title: string;
  lead?: string;
  fill?: MarqueeProps['fill'];
  /** Below `lg` the header carries the 112 px bare grove sticker. Pass false on reading routes. */
  grove?: boolean;
  /** A control or two under the title (a filter, a primary button). */
  children?: ReactNode;
  className?: string;
}

/**
 * The header of every app page except Today: slug, die-cut title, lead. On a phone it also
 * holds the small grove sticker, so the tree is on every screen; on desktop the left rail of
 * the shell shows the grove instead and this header is text only.
 */
export function PageHeader({
  slug,
  title,
  lead,
  fill,
  grove = true,
  children,
  className,
}: PageHeaderProps) {
  const desktop = useBreakpoint('lg');
  // From the boot store, not the game: the public reading pages use this header too, and must not
  // load the rules engine for one label. Without a tree of their own they describe the island.
  const sceneLabel = useBootSceneLabel() ?? 'A small floating island with a young tree.';

  return (
    <header className={cn('grid gap-3 pb-5 lg:pb-7', className)}>
      <div className="flex items-start justify-between gap-3">
        <Marquee slug={slug} title={title} lead={lead} fill={fill} className="min-w-0 flex-1" />
        {grove && !desktop ? (
          <WorldStage mode="companion" label={sceneLabel} className="size-28 shrink-0" />
        ) : null}
      </div>
      {children}
    </header>
  );
}
