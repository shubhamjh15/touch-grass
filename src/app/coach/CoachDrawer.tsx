'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useBreakpoint } from '@/lib/hooks';
import { ColorBar, Sheet } from '@/ui';
import { normalizePath, PARAMS, ROUTES } from '../routes';
import { openCoach, useShellStore } from '../shellStore';

function PanelLoading() {
  return (
    <div className="grid flex-1 place-items-center p-6" aria-busy="true">
      <ColorBar loading size="md" label="Waking Moss" />
    </div>
  );
}

// The conversation (markdown, the AI client) is the coach team's chunk: it loads on first open.
const CoachPanel = dynamic(() => import('@/features/coach/CoachPanel'), {
  ssr: false,
  loading: PanelLoading,
});

/**
 * `?coach=1` on any app route opens the drawer; the parameter is then removed, so Back and a
 * reload do not reopen it. Search parameters are only known in the browser, hence the Suspense.
 */
function CoachDeepLink() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const params = useSearchParams();
  const wanted = params?.get(PARAMS.coach) === '1';

  useEffect(() => {
    if (!wanted) return;
    const rest = new URLSearchParams(params?.toString() ?? '');
    rest.delete(PARAMS.coach);
    const query = rest.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}${window.location.hash}`, {
      scroll: false,
    });
    openCoach();
  }, [wanted, params, pathname, router]);

  return null;
}

/**
 * Moss, reachable from every app route: a drawer beside the page on desktop (not modal, so the
 * page stays usable and F6 moves between the two), a tall bottom sheet on a phone. On `/coach`
 * the conversation is the page itself, so the drawer stays shut there.
 */
export function CoachDrawer() {
  const pathname = normalizePath(usePathname() ?? '/');
  const desktop = useBreakpoint('lg');
  const open = useShellStore((state) => state.coachOpen);
  const ask = useShellStore((state) => state.coachAsk);
  const setOpen = useShellStore((state) => state.setCoachOpen);
  const onCoachPage = pathname === ROUTES.coach;

  // Mounted from the first opening on, so the draft and the scroll position survive closing.
  const [loaded, setLoaded] = useState(false);
  if (open && !loaded) setLoaded(true);

  useEffect(() => {
    // Two panels would share one conversation and fight over it.
    if (onCoachPage && open) setOpen(false);
  }, [onCoachPage, open, setOpen]);

  return (
    <>
      <Suspense fallback={null}>
        <CoachDeepLink />
      </Suspense>
      {loaded && !onCoachPage ? (
        <Sheet
          open={open}
          onOpenChange={(next) => setOpen(next)}
          side={desktop ? 'right' : 'bottom'}
          modal={!desktop}
          tall
          title="Moss"
          description="Your coach. It can be wrong; estimates link to their sources."
          bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
        >
          <CoachPanel
            variant="drawer"
            ask={ask ?? undefined}
            onNavigate={() => {
              // On a phone the sheet covers the page it is about to change.
              if (!desktop) setOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </>
  );
}
