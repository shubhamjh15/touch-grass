'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TextLink } from '@/ui';

export interface PageSectionProps {
  /** The section's `h2`. Required: an unlabelled group is a group nobody can find. */
  title: string;
  /** One quiet line under the title. */
  lead?: string;
  /** The "See all" door to the rest of a long list. */
  seeAll?: { href: string; label?: string };
  /** A control at the right of the heading (a segmented filter, a small button). */
  aside?: ReactNode;
  id?: string;
  children: ReactNode;
  className?: string;
}

/**
 * One titled group on a page. Every page is a column of these, so spacing, heading size and the
 * "See all" door look the same everywhere (directive 4.2, 4.3 and 4.8). It renders a labelled
 * `<section>`; the title is the `h2`, because `<PageHeader>` owns the `h1`.
 */
export function PageSection({
  title,
  lead,
  seeAll,
  aside,
  id,
  children,
  className,
}: PageSectionProps) {
  const generated = useId();
  const headingId = `${id ?? generated}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn('grid gap-3 lg:gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="grid min-w-0 gap-0.5">
          <h2 id={headingId} className="text-h3">
            {title}
          </h2>
          {lead ? <p className="max-w-prose text-body-sm text-ink-2">{lead}</p> : null}
        </div>
        {seeAll ? (
          <TextLink
            href={seeAll.href}
            className="hit-3 inline-flex shrink-0 items-center text-body-sm font-semibold"
          >
            {seeAll.label ?? 'See all'}
          </TextLink>
        ) : (
          aside
        )}
      </div>
      {children}
    </section>
  );
}

/** The vertical rhythm between sections: the same on every page, tighter on a phone. */
export function PageStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-8 lg:gap-10', className)}>{children}</div>;
}
