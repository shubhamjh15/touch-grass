'use client';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { UiLink } from './Link';

export type FabProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & {
  /** The words on the button, and its accessible name: "Ask Moss". */
  label: string;
  icon?: LucideIcon;
  /** Drawn art in place of the icon (Moss's face). */
  art?: ReactNode;
  /** Hides the words visually, leaving a round 56 px button. */
  iconOnly?: boolean;
  /** `secondary` (white) by default: the page already has its one green button. */
  variant?: 'secondary' | 'primary';
  /** Renders a link. */
  href?: string;
  /**
   * `corner` pins it bottom-right, above the tab bar and the home indicator on phones.
   * `inline` leaves the placement to the caller.
   */
  placement?: 'corner' | 'inline';
};

/** A floating action button: one per screen, for the thing that is always within reach. */
export function Fab({
  label,
  icon: Icon,
  art,
  iconOnly = false,
  variant = 'secondary',
  href,
  placement = 'corner',
  className,
  type,
  ...rest
}: FabProps) {
  const look = cn(
    'inline-flex h-14 hard items-center justify-center gap-2 rounded-pill border-2 border-ink text-button text-ink lift-3',
    iconOnly ? 'w-14' : 'px-5',
    variant === 'primary' ? 'bg-green fine:hover:bg-primary-hover' : 'bg-white fine:hover:bg-mat',
    placement === 'corner' &&
      'fixed right-[max(var(--gutter),var(--safe-r))] bottom-[calc(var(--tabbar-h)+var(--safe-b)+16px)] z-(--z-fab) lg:right-6 lg:bottom-6',
    className,
  );
  const content = (
    <>
      {art ?? (Icon ? <Icon size={20} strokeWidth={2} aria-hidden="true" /> : null)}
      <span className={cn(iconOnly && 'sr-only')}>{label}</span>
    </>
  );

  if (href) {
    return (
      <UiLink href={href} className={look}>
        {content}
      </UiLink>
    );
  }
  return (
    <button type={type ?? 'button'} className={look} {...rest}>
      {content}
    </button>
  );
}
