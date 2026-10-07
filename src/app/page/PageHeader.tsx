'use client';

import type { ReactNode } from 'react';
import { useBreakpoint } from '@/lib/hooks';
import type { MarqueeProps } from '@/ui';
import { WorldStage } from '@/world';
import { useBootSceneLabel } from '../boot/bootStore';
import { PageHeading } from './PageHeading';

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
  // From the boot store, not the game: a header must not load the rules engine for one label.
  // Without a tree of their own, visitors get a description of the island.
  const sceneLabel = useBootSceneLabel() ?? 'A small floating island with a young tree.';

  return (
    <PageHeading
      slug={slug}
      title={title}
      lead={lead}
      fill={fill}
      className={className}
      aside={
        grove && !desktop ? (
          <WorldStage mode="companion" label={sceneLabel} className="size-28 shrink-0" />
        ) : null
      }
    >
      {children}
    </PageHeading>
  );
}
