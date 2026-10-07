'use client';

import { ChevronRight } from 'lucide-react';
import { Fragment, type ComponentProps, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { ColorBar } from './ColorBar';
import { Lettering, type LetteringFill } from './Lettering';
import { UiLink } from './Link';
import { FILL_BG, type Hue } from './tokens';

export type SectionHeadingProps = Omit<ComponentProps<'div'>, 'title'> & {
  title: string;
  /** Mono meta on the right: "RESETS IN 9 H 28 M". */
  meta?: string;
  /** A mono link on the right: "ALL 42 ACTIONS". Replaces `meta`. */
  action?: { label: string; href: string };
  as?: 'h2' | 'h3';
};

/** A section title inside the app, with optional mono meta or a link on the right. */
export function SectionHeading({
  title,
  meta,
  action,
  as: Heading = 'h2',
  className,
  ...rest
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'mt-5 mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
        className,
      )}
      {...rest}
    >
      <Heading className="max-w-full text-h3 text-balance">{title}</Heading>
      {action ? (
        <UiLink
          href={action.href}
          className="hit-3 inline-flex shrink-0 items-center gap-0.5 rounded-xs type-slug text-ink underline-offset-4 fine:hover:underline"
        >
          {action.label}
          <ChevronRight size={12} strokeWidth={2.5} aria-hidden="true" />
        </UiLink>
      ) : meta ? (
        <span className="max-w-full type-slug text-ink-3">{meta}</span>
      ) : null}
    </div>
  );
}

const TICKER_FILL: Record<Hue | 'white' | 'ink', string> = FILL_BG;

export type MarqueeProps = Omit<ComponentProps<'div'>, 'title'> & {
  /** `title`: the page header. `ticker`: the landing strip of words. */
  variant?: 'title' | 'ticker';
  /** `title`: the page's `h1`, at most two lines of sticker lettering. `ticker`: its accessible name. */
  title: string;
  /** Mono line above the title: "TUESDAY 06 OCTOBER". */
  slug?: string;
  lead?: string;
  /** Lettering fill (`title`) or strip colour (`ticker`). */
  fill?: 'ink' | Hue | 'white';
  /** `ticker`: the words. */
  items?: string[];
};

const LETTERING_FILLS: readonly string[] = ['ink', 'white', 'green', 'yellow', 'pink', 'blue'];

/**
 * `title`: slug, the die-cut page title (the route's one `h1`) and an optional lead.
 * `ticker`: a full-width strip of words between colour bars, stepping along at 12 fps. It pauses on
 * hover and focus and stands still under reduced motion. Landing only.
 */
export function Marquee({
  variant = 'title',
  title,
  slug,
  lead,
  fill,
  items = [],
  className,
  ...rest
}: MarqueeProps) {
  if (variant === 'ticker') {
    // About 40 px/s: the strip's width is estimated from its text, then stepped at 12 fps.
    const width = items.reduce((sum, item) => sum + item.length * 17 + 130, 0);
    const seconds = Math.max(8, Math.round(width / 40));
    const strip = (hidden: boolean) => (
      <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
        {items.map((item, index) => (
          <Fragment key={`${item}-${index}`}>
            <span className="px-6 type-figure text-display-sm whitespace-nowrap">{item}</span>
            <ColorBar size="sm" />
          </Fragment>
        ))}
      </div>
    );
    return (
      <div
        role="group"
        aria-label={title}
        tabIndex={0}
        className={cn(
          'group/ticker flex h-14 items-center overflow-hidden border-y-4 border-ink focus-inset',
          TICKER_FILL[fill ?? 'yellow'],
          className,
        )}
        {...rest}
      >
        <div
          className="flex w-max animate-ticker group-focus-within/ticker:[animation-play-state:paused] group-hover/ticker:[animation-play-state:paused] group-focus/ticker:[animation-play-state:paused] calm:animate-none"
          style={{ '--ticker-dur': `${seconds}s`, '--ticker-steps': seconds * 12 } as CSSProperties}
        >
          {strip(false)}
          {strip(true)}
        </div>
      </div>
    );
  }

  const letteringFill: LetteringFill =
    fill && LETTERING_FILLS.includes(fill) ? (fill as LetteringFill) : 'ink';
  return (
    <div className={cn('min-w-0', className)} {...rest}>
      {slug ? <p className="mb-3 type-slug text-ink-3">{slug}</p> : null}
      <h1 className="text-display-lg">
        <Lettering fill={letteringFill}>{title}</Lettering>
      </h1>
      {lead ? <p className="mt-3 max-w-[60ch] text-lead text-ink-2">{lead}</p> : null}
    </div>
  );
}
