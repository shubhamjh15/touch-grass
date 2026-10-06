'use client';

import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { UiLink } from './Link';

export type SectionHeadingProps = Omit<ComponentProps<'div'>, 'title'> & {
  title: string;
  /** One quiet line on the right: "Resets in 9 h". */
  meta?: string;
  /** A text link on the right: "See all". Replaces `meta`. */
  action?: { label: string; href: string };
  as?: 'h2' | 'h3';
  /** Id for the heading element, so a region can be labelled by it. */
  headingId?: string;
};

/**
 * A section title with one optional line or link on the right. It opens a new section, so it keeps
 * the section rhythm above itself (40 px, 56 px from `md`) unless it is the first thing in its parent.
 */
export function SectionHeading({
  title,
  meta,
  action,
  as: Heading = 'h2',
  headingId,
  className,
  ...rest
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'mt-(--space-section) mb-4 flex items-baseline justify-between gap-4 first:mt-0',
        className,
      )}
      {...rest}
    >
      <Heading id={headingId} className="min-w-0 text-h2">
        {title}
      </Heading>
      {action ? (
        <UiLink
          href={action.href}
          className="hit-2 inline-flex shrink-0 items-center gap-0.5 link-quiet text-body-sm"
        >
          {action.label}
          <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </UiLink>
      ) : meta ? (
        <span className="shrink-0 text-body-sm text-ink-3">{meta}</span>
      ) : null}
    </div>
  );
}

export type PageHeaderProps = Omit<ComponentProps<'header'>, 'title'> & {
  /** The page's one `h1`: six words or fewer. */
  title: string;
  /** One or two lines under the title. */
  lead?: ReactNode;
  /** A way back, shown above the title: `{ label: 'Learn', href: '/learn' }`. */
  back?: { label: string; href: string };
  /** One control on the right (a secondary button, a menu). */
  action?: ReactNode;
  /** `display` is the larger size for a landing or a celebration; pages use `h1`. */
  size?: 'h1' | 'display';
  align?: 'start' | 'center';
};

/** The top of a page: a title, at most two lines of lead, an optional way back and one action. */
export function PageHeader({
  title,
  lead,
  back,
  action,
  size = 'h1',
  align = 'start',
  className,
  ...rest
}: PageHeaderProps) {
  const centred = align === 'center';
  return (
    <header className={cn('min-w-0', centred && 'text-center', className)} {...rest}>
      {back ? (
        <UiLink
          href={back.href}
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 link-quiet text-body-sm"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          {back.label}
        </UiLink>
      ) : null}
      <div className={cn('flex items-start gap-4', centred ? 'justify-center' : 'justify-between')}>
        <h1 className={cn('min-w-0', size === 'display' ? 'text-display-xl' : 'text-h1')}>
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {lead ? (
        <p className={cn('mt-2 measure text-lead text-ink-2', centred && 'mx-auto')}>{lead}</p>
      ) : null}
    </header>
  );
}
