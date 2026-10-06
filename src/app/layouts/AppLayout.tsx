'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { prefersReducedMotion, useBreakpoint } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { DURATIONS } from '@/ui';
import { useWorldStore } from '@/world';
import { Main } from '../Main';
import { AppBar } from '../nav/AppBar';
import { MoreSheet } from '../nav/MoreSheet';
import { TabBar } from '../nav/TabBar';
import { TopBar } from '../nav/TopBar';
import { AppOverlays } from '../overlays/AppOverlays';
import { GroveRail } from '../page/GroveRail';
import { routeInfo, type AppFrame } from '../routes';
import { useShellStore } from '../shellStore';
import { RouteTransition } from '../transitions/RouteTransition';

/** The box each frame gives its page (bible 3.4 and 3.5). `bleed` pages lay themselves out. */
const FRAME: Record<AppFrame, { outer: string; content: string }> = {
  bleed: { outer: '', content: '' },
  rail: {
    outer:
      'mx-auto grid w-full max-w-[1392px] gap-6 px-gutter pt-2 lg:grid-cols-12 lg:px-6 lg:pt-28 lg:pb-12',
    content: 'min-w-0 lg:col-span-9',
  },
  reading: {
    outer: 'mx-auto w-full max-w-[728px] px-gutter pt-2 lg:px-6 lg:pt-28 lg:pb-12',
    content: 'min-w-0',
  },
};

/** The grove lands with a soft thud after a long carry (Today to a rail page and back). */
function useCarryThud(frame: AppFrame): boolean {
  const previous = useRef(frame);
  const carried =
    previous.current !== frame && frame !== 'reading' && previous.current !== 'reading';

  useEffect(() => {
    const from = previous.current;
    previous.current = frame;
    if (from === frame || from === 'reading' || frame === 'reading') return undefined;
    if (prefersReducedMotion() || useWorldStore.getState().status !== 'ready') return undefined;
    const timer = window.setTimeout(() => play('thup'), (DURATIONS.scene - DURATIONS.press) * 1000);
    return () => window.clearTimeout(timer);
  }, [frame]);

  return carried;
}

/**
 * The shell of the product: top bar and HUD on desktop, app bar and tab bar on a phone, the
 * grove rail beside every page that has no stage of its own, and the overlays that can open
 * from anywhere (palette, coach, celebrations).
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const info = routeInfo(pathname);
  const desktop = useBreakpoint('lg');
  const chromeHidden = useShellStore((state) => state.chromeHidden > 0);
  const frame = FRAME[info.frame];
  const carry = useCarryThud(info.frame);

  return (
    <div className="relative min-h-dvh">
      {chromeHidden ? null : (
        <>
          <TopBar section={info.section} />
          <AppBar overlay={info.frame === 'bleed'} />
        </>
      )}

      <Main className={cn(!chromeHidden && 'max-lg:pb-tabbar')}>
        <div className={frame.outer}>
          {info.frame === 'rail' && desktop ? (
            <div className="lg:col-span-3">
              <GroveRail />
            </div>
          ) : null}
          <div className={frame.content}>
            <RouteTransition routeKey={pathname} carry={carry}>
              {children}
            </RouteTransition>
          </div>
        </div>
      </Main>

      {chromeHidden ? null : <TabBar section={info.section} />}
      <MoreSheet section={info.section} />
      <AppOverlays />
    </div>
  );
}
