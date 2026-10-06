'use client';

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { MossFace, SproutGlyph, TreeGlyph, type MossMood, type TreeSpecies } from './glyphs';
import { UiLink } from './Link';

export type AvatarSize = 32 | 42 | 44 | 64;

const SIZE: Record<AvatarSize, string> = {
  32: 'size-8',
  42: 'size-[42px]',
  44: 'size-11',
  64: 'size-16',
};
const GLYPH: Record<AvatarSize, number> = { 32: 18, 42: 24, 44: 24, 64: 36 };
const LETTER: Record<AvatarSize, string> = {
  32: 'text-[1rem]',
  42: 'text-display-xs',
  44: 'text-display-xs',
  64: 'text-display-md',
};

export type AvatarProps = Omit<ComponentProps<'span'>, 'children' | 'onClick'> & {
  /** There are no photos anywhere in the product: a tree, Moss, or one letter. */
  kind: 'tree' | 'moss' | 'initial';
  /** `tree`: the species silhouette (a sprout until one is chosen). */
  species?: TreeSpecies;
  /** `initial`: the name whose first letter is shown. Also used in the accessible name. */
  name?: string;
  mood?: MossMood;
  size?: AvatarSize;
  /** A small chip at the bottom-right, e.g. the level number. */
  badge?: ReactNode;
  /** Accessible name. Required when the avatar is a link or a button. */
  label?: string;
  href?: string;
  onClick?: () => void;
};

/** A round identity disc. As a link or a button it tints on hover. */
export function Avatar({
  kind,
  species,
  name,
  mood,
  size = 44,
  badge,
  label,
  href,
  onClick,
  className,
  ...rest
}: AvatarProps) {
  const glyph = GLYPH[size];
  let face: ReactNode;
  if (kind === 'moss') {
    face = <MossFace bare mood={mood} size={Math.round(size * 0.86)} />;
  } else if (kind === 'tree') {
    face = species ? <TreeGlyph species={species} size={glyph} /> : <SproutGlyph size={glyph} />;
  } else {
    face = (
      <span className={cn('type-figure', LETTER[size])} aria-hidden="true">
        {(name ?? '?').trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }

  const interactive = Boolean(href ?? onClick);
  const look = cn(
    'relative grid shrink-0 place-items-center rounded-full border-2 border-ink',
    kind === 'moss' ? 'bg-green text-ink' : 'bg-white',
    kind === 'tree' && 'text-green-deep',
    kind === 'initial' && 'text-ink',
    SIZE[size],
    interactive &&
      'transition-transform duration-(--dur-fast) ease-out active:translate-y-px fine:hover:bg-mat-deep',
    className,
  );

  const content = (
    <>
      {face}
      {badge !== undefined && badge !== null ? (
        <span className="absolute -right-2 -bottom-2 grid h-6 min-w-6 place-items-center rounded-pill border-2 border-ink bg-white px-1 text-body-sm leading-none font-bold text-ink tabular-nums">
          {badge}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <UiLink href={href} aria-label={label} className={look}>
        {content}
      </UiLink>
    );
  }
  if (onClick) {
    return (
      <button type="button" aria-label={label} onClick={onClick} className={look}>
        {content}
      </button>
    );
  }
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={look}
      {...rest}
    >
      {content}
    </span>
  );
}
