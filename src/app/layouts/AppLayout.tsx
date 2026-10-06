'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useBreakpoint } from '@/lib/hooks';
import { OfflineBanner } from '@/ui';
import { CoachDrawer } from '../coach/CoachDrawer';
import { Main } from '../Main';
import { AskMoss } from '../nav/AskMoss';
import { TabBar } from '../nav/TabBar';
import { TopBar } from '../nav/TopBar';
import { PageContainer } from '../page/PageContainer';
import { Palette } from '../palette/Palette';
import { routeInfo } from '../routes';
import { useShellStore } from '../shellStore';
import { RouteTransition } from '../transitions/RouteTransition';

/**
 * The shell of the product: a light top bar, the page in its container, the tab bar on a
 * phone, and the two things that can open from anywhere (the coach and the command palette).
 * The document scrolls; nothing in here has a scrollbar of its own.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const info = routeInfo(pathname);
  const desktop = useBreakpoint('lg');
  const chromeHidden = useShellStore((state) => state.chromeHidden > 0);
  const coachOpen = useShellStore((state) => state.coachOpen);
  // On `/coach` the conversation is the page, and an open drawer needs no button.
  const mossButton = !chromeHidden && !coachOpen && info.id !== 'coach';

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      {chromeHidden ? null : <TopBar section={info.section} desktop={desktop} />}
      <OfflineBanner className="flex justify-center pt-4" />

      <Main className="flex-1">
        {/* Room below for the tab bar and the Ask Moss button, so the last row is never under them. */}
        <PageContainer className="pb-[calc(var(--tabbar-h)+var(--safe-b)+72px)] lg:pb-24">
          <RouteTransition routeKey={pathname}>{children}</RouteTransition>
        </PageContainer>
      </Main>

      {chromeHidden || desktop ? null : <TabBar section={info.section} />}
      {mossButton ? <AskMoss /> : null}
      <CoachDrawer />
      <Palette />
    </div>
  );
}
