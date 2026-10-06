'use client';

import type { ComponentProps, ElementType, ReactNode, Ref } from 'react';
import { cn } from '@/lib/cn';
import { UiLink } from './Link';
import { looseTag } from './polymorphic';
import { TINT_BG, type Hue } from './tokens';

export type CardTone = 'card' | 'paper' | Hue;

const TONE: Record<CardTone, string> = { card: 'bg-card', paper: 'bg-paper', ...TINT_BG };

export type CardProps = Omit<ComponentProps<'div'>, 'ref'> & {
  ref?: Ref<HTMLElement>;
  /** The element to render. Interactive cards default to `button` (or a link when `href` is set). */
  as?: ElementType;
  /** A hue uses its tint, never the fill, so secondary text keeps its contrast. One tinted card per screen. */
  tone?: CardTone;
  /** The whole card is one control: it carries a 2 px hard shadow and presses into it. */
  interactive?: boolean;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Retired: cards no longer take a second colour plate. Accepted so older callers keep compiling. */
  featured?: boolean;
  /** Retired with `featured`. */
  plate?: Hue;
  /** 20 px of padding on phones, 24 px from `md`. */
  padded?: boolean;
};

/** The one card: white, a 2 px ink border, a 16 px radius and no shadow. */
export function Card({
  as,
  tone = 'card',
  interactive = false,
  href,
  featured: _featured,
  plate: _plate,
  padded = true,
  className,
  type,
  ...rest
}: CardProps) {
  const tag: ElementType = as ?? (href ? UiLink : interactive ? 'button' : 'div');
  const Comp = looseTag(tag);
  return (
    <Comp
      href={href}
      type={tag === 'button' ? (type ?? 'button') : type}
      data-padded={padded}
      className={cn(
        'group/card relative block min-w-0 rounded-lg border-2 border-ink text-left text-ink',
        TONE[tone],
        padded && 'p-5 md:p-6',
        (interactive || href) &&
          'w-full hard hard-card lift-2 off:border-ink-4 off:bg-line off:text-ink-3',
        className,
      )}
      {...rest}
    />
  );
}

export type CardHeaderProps = Omit<ComponentProps<'div'>, 'title'> & {
  /** Retired: there are no labels above titles any more. Accepted and not shown. */
  slug?: string;
  title: ReactNode;
  /** Heading level of the title. */
  as?: 'h2' | 'h3' | 'h4';
  /** Right-aligned control or meta. */
  action?: ReactNode;
};

export function CardHeader({
  slug: _slug,
  title,
  as: Heading = 'h3',
  action,
  className,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 group-data-[padded=false]/card:px-5 group-data-[padded=false]/card:pt-5',
        className,
      )}
      {...rest}
    >
      <Heading className="min-w-0 text-h2">{title}</Heading>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mt-3 group-data-[padded=false]/card:px-5 group-data-[padded=false]/card:pb-5 first:mt-0',
        className,
      )}
      {...rest}
    />
  );
}

export function CardFooter({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mt-5 border-t border-line pt-4 text-body-sm text-ink-2 group-data-[padded=false]/card:mt-0 group-data-[padded=false]/card:px-5 group-data-[padded=false]/card:pb-4',
        className,
      )}
      {...rest}
    />
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
