'use client';

import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { ColorBar, LeafMark } from '@/ui';

/**
 * The first paint of the product: the logo tile on the cutting mat. It is part of the server's
 * HTML for app routes, and it stays exactly as long as the saved state and the fonts take to
 * arrive. There is no timer in here.
 */
export function Splash({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      role="status"
      aria-label={`${BRAND.name} is loading`}
      data-splash=""
      className={cn(
        'fixed inset-0 z-(--z-fx) grid place-items-center graph-paper bg-mat',
        leaving && 'pointer-events-none animate-peel calm:animate-none calm:opacity-0',
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <span className="grid size-20 -rotate-4 place-items-center rounded-lg border-4 border-ink bg-green shadow-3">
          <LeafMark size={48} />
        </span>
        <ColorBar loading size="md" label="Loading" />
      </div>
    </div>
  );
}
