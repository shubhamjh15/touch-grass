import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type SkipLinkProps = Omit<ComponentProps<'a'>, 'children'> & {
  /** The id of the page's `<main>`. */
  targetId?: string;
};

/**
 * The first focusable element on every route: a yellow sticker that appears at the top-left on
 * focus. In a file of its own because every route loads it, and nothing else should come along.
 */
export function SkipLink({ targetId = 'main', className, ...rest }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only -rotate-2 diecut rounded-pill border-3 border-ink bg-yellow px-3 text-body-sm font-bold text-ink dc-4 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-(--z-skip) focus-visible:inline-flex focus-visible:h-8 focus-visible:items-center',
        className,
      )}
      {...rest}
    >
      Skip to content
    </a>
  );
}
