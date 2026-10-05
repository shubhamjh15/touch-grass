'use client';

import type { ComponentProps, CSSProperties, ElementType, ReactNode, Ref } from 'react';
import { cn } from '@/lib/cn';
import { UiLink } from './Link';
import { looseTag } from './polymorphic';
import { HUE_VAR, TINT_BG, type Hue } from './tokens';

export type CardTone = 'card' | 'paper' | Hue;

const TONE: Record<CardTone, string> = { card: 'bg-card', paper: 'bg-paper', ...TINT_BG };

export type CardProps = Omit<ComponentProps<'div'>, 'ref'> & {
  ref?: Ref<HTMLElement>;
  /** The element to render. Interactive cards default to `button` (or a link when `href` is set). */
  as?: ElementType;
  /** A hue uses its tint, never the fill, so secondary text keeps its contrast. */
  tone?: CardTone;
  /** The whole card is one control: it lifts on hover and presses into its shadow. */
  interactive?: boolean;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** The second colour plate under the shadow. One per viewport. */
  featured?: boolean;
  /** Colour of the plate when `featured` (default yellow). */
  plate?: Hue;
  padded?: boolean;
};

/** The white card on the mat: 3 px ink below `md`, 4 px and a larger radius from `md` up. */
export function Card({
  as,
  tone = 'card',
  interactive = false,
  href,
  featured = false,
  plate = 'yellow',
  padded = true,
  className,
  style,
  type,
  ...rest
}: CardProps) {
  const tag: ElementType = as ?? (href ? UiLink : interactive ? 'button' : 'div');
  const Comp = looseTag(tag);
  const plateStyle = featured ? ({ '--plate': HUE_VAR[plate], ...style } as CSSProperties) : style;
  return (
    <Comp
      href={href}
      type={tag === 'button' ? (type ?? 'button') : type}
      data-padded={padded}
      className={cn(
        'group/card relative block min-w-0 rounded-md border-3 border-ink text-left text-ink md:rounded-lg md:border-4',
        TONE[tone],
        padded && 'p-4 md:p-5 lg:p-6',
        interactive || href
          ? 'w-full hard hard-card lift-5 off:border-2 off:border-dashed off:border-ink-4 off:bg-line off:text-ink-3 md:off:border-2'
          : featured
            ? 'shadow-plate'
            : 'shadow-3',
        className,
      )}
      style={plateStyle}
      {...rest}
    />
  );
}

export type CardHeaderProps = Omit<ComponentProps<'div'>, 'title'> & {
  /** Mono meta above or beside the title ("FIG. 03", "DAILY"). */
  slug?: string;
  title: ReactNode;
  /** Heading level of the title. */
  as?: 'h2' | 'h3' | 'h4';
  /** Right-aligned control or meta. */
  action?: ReactNode;
};

export function CardHeader({
  slug,
  title,
  as: Heading = 'h3',
  action,
  className,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 group-data-[padded=false]/card:px-4 group-data-[padded=false]/card:pt-4',
        className,
      )}
      {...rest}
    >
      <div className="min-w-0">
        {slug ? <p className="mb-1.5 type-slug text-ink-3">{slug}</p> : null}
        <Heading className="text-h3">{title}</Heading>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mt-3 group-data-[padded=false]/card:px-4 group-data-[padded=false]/card:pb-4 first:mt-0',
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
        'mt-4 border-t-[1.5px] border-ink pt-3 text-caption text-ink-3 group-data-[padded=false]/card:mt-0 group-data-[padded=false]/card:px-4 group-data-[padded=false]/card:pb-3',
        className,
      )}
      {...rest}
    />
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
