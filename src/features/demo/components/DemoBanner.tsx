'use client';

import { Signpost } from 'lucide-react';
import { cn } from '@/lib/cn';
import { UiLink } from '@/ui';
import { COPY } from '../copy';
import { leaveLink } from '../demo';
import { tourShow, useDemoStore } from '../demoStore';
import { isTourOpen } from '../model/tour';

/** A text action on the ink strip: a full-height target on a phone, slim on a wide screen. */
const ACTION =
  'inline-flex h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2.5 text-button-sm whitespace-nowrap text-white underline decoration-2 underline-offset-4 fine:hover:bg-white/15 lg:h-[26px] lg:px-2 lg:text-caption lg:font-bold';

/**
 * Says, on every app page, that this is the demo world and that nothing in it is saved, and
 * offers the way out. On a phone it is a strip at the very top that the app starts below (it
 * stays put while the page scrolls); on a wide screen it is a tag hanging from the top bar,
 * in the gap above the page. Either way it covers neither the tab bar, a page's main action
 * nor the tree.
 */
export function DemoBanner() {
  const tourOpen = useDemoStore((state) => isTourOpen(state.tour));

  return (
    <aside
      aria-label={COPY.banner.region}
      className={cn(
        'sticky top-0 z-(--z-sticky) flex h-[calc(48px+var(--safe-t))] items-center bg-ink pt-(--safe-t) pr-[max(4px,var(--safe-r))] pl-[max(14px,var(--safe-l))] text-white',
        // The top bar ends at 80 px and its hard shadow at 85; pages begin at 112.
        'lg:fixed lg:top-20 lg:left-1/2 lg:z-29 lg:h-[31px] lg:-translate-x-1/2 lg:gap-1 lg:rounded-b-md lg:pt-[5px] lg:pr-1.5 lg:pl-3.5',
      )}
    >
      <p className="mr-auto min-w-0 lg:mr-2 lg:flex lg:items-baseline lg:gap-2.5">
        <span className="block type-slug text-yellow">{COPY.banner.label}</span>
        <span className="mt-1.5 block truncate text-[0.6875rem] leading-none font-medium lg:mt-0 lg:text-caption lg:leading-none">
          {COPY.banner.note}
        </span>
      </p>

      <button
        type="button"
        onClick={tourShow}
        data-demo-tour-button=""
        aria-label={tourOpen ? COPY.banner.tourResume : COPY.banner.tourRestart}
        className={ACTION}
      >
        <Signpost size={16} strokeWidth={2.25} aria-hidden="true" />
        <span className="max-[359px]:sr-only">{COPY.banner.tour}</span>
      </button>
      <UiLink
        href={leaveLink('start')}
        className="relative mx-1 inline-flex h-8 shrink-0 items-center rounded-pill bg-yellow px-3 text-button-sm whitespace-nowrap text-ink after:absolute after:inset-x-0 after:-inset-y-2 lg:h-[22px] lg:px-2.5 lg:text-caption lg:font-bold lg:after:hidden fine:hover:bg-white"
      >
        {COPY.banner.own}
      </UiLink>
      <UiLink href={leaveLink('home')} aria-label={COPY.banner.exitLabel} className={ACTION}>
        {COPY.banner.exit}
      </UiLink>
    </aside>
  );
}
