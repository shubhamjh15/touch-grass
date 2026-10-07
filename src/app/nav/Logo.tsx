'use client';

import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { LeafMark, UiLink } from '@/ui';

/**
 * The logo tile and the product name. It lives apart from the top bar so the public pages and the
 * error page can show it without downloading the app's navigation, menus and HUD.
 */
export function Logo({
  href,
  className,
  nameClassName,
}: {
  href: string;
  className?: string;
  /** Lets a tight bar fold the wordmark away; the link keeps its accessible name. */
  nameClassName?: string;
}) {
  return (
    <UiLink
      href={href}
      aria-label={`${BRAND.name}, home`}
      className={cn('flex shrink-0 items-center gap-2.5 rounded-ctl', className)}
    >
      <span
        data-dock-target=""
        className="grid size-[38px] -rotate-4 place-items-center rounded-ctl border-3 border-ink bg-green shadow-1"
      >
        <LeafMark size={22} />
      </span>
      <span className={cn('text-h3 whitespace-nowrap', nameClassName)}>{BRAND.name}</span>
    </UiLink>
  );
}
