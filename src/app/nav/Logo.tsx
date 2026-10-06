'use client';

import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { LeafMark, UiLink } from '@/ui';

/** The leaf mark and the product name: the way home from anywhere. */
export function Logo({ href, className }: { href: string; className?: string }) {
  return (
    <UiLink
      href={href}
      aria-label={`${BRAND.name}, home`}
      className={cn('flex shrink-0 items-center gap-2 rounded-ctl', className)}
    >
      <span className="grid size-8 place-items-center rounded-ctl border-2 border-ink bg-green">
        <LeafMark size={18} />
      </span>
      <span className="text-h4 whitespace-nowrap">{BRAND.name}</span>
    </UiLink>
  );
}
