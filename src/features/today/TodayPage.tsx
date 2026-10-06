'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PARAMS, PageStack, ROUTES, useHideChrome } from '@/app/shell';
import {
  exportFileName,
  game,
  gameActions,
  useGameClockStatus,
  useGameEvent,
  useGameHydrated,
  useGameRuntime,
  useNotices,
  useRecap,
} from '@/game';
import { cn } from '@/lib/cn';
import { ErrorState, Panel, Skeleton, TapeNote } from '@/ui';
import { CoachMarks } from './components/CoachMarks';
import { DayDock } from './components/DayDock';
import { NextUp } from './components/NextUp';
import { QuickStickers } from './components/QuickStickers';
import { RecentActivity } from './components/RecentActivity';
import { ReturnNotices } from './components/ReturnNotices';
import { StatusTicket } from './components/StatusTicket';
import { TodayQuests } from './components/TodayQuests';
import { STAGE_BOX, TodayStage } from './components/TodayStage';
import { BreakAway, BreakResult, BreakStartSheet, TouchGrassCard } from './components/TouchGrass';
import { WeeklyRecap } from './components/WeeklyRecap';
import { COPY } from './copy';
import { breakParam } from './model';
import { useBreakFlow } from './useBreakFlow';

/** The mat under the stage, and the same content width as every other page of the app. */
const DESK = 'pt-6 pb-10 lg:pt-8 lg:pb-16';
const CONTENT = 'mx-auto w-full max-w-[1392px] px-gutter lg:px-6';
/** The day's headline row: the dock with the primary action, and the figures beside it. */
const HEADLINE = 'grid gap-4 lg:grid-cols-12 lg:items-center lg:gap-6';
/** Two columns of groups on a desk; one column, in reading order, on a phone. */
const GROUPS = 'grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-x-6';
const COLUMN = 'grid min-w-0 gap-8 lg:gap-10';
/** One calm column for the break screens. */
const FOCUS = 'mx-auto grid w-full max-w-[640px] gap-6';

/** Hands the saved state to the browser as a file: the way out when storage is full. */
function downloadExport(): void {
  const blob = new Blob([gameActions.exportState()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(game.now());
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The frame before saved state has been read: the same boxes, so nothing shifts. */
function TodaySkeleton() {
  return (
    <div aria-busy="true">
      <div className={STAGE_BOX} />
      <Panel variant="mat" edge="pinked-t" className={DESK}>
        <div className={CONTENT}>
          <p className="sr-only" role="status">
            Loading today
          </p>
          <PageStack>
            <div className={HEADLINE}>
              <Skeleton shape="block" className="h-28 lg:col-span-7" />
              <Skeleton shape="block" className="h-20 lg:col-span-5" />
            </div>
            <div className={GROUPS}>
              <div className={cn(COLUMN, 'lg:col-span-7')}>
                <Skeleton shape="block" className="h-36" />
                <Skeleton shape="row" />
                <Skeleton shape="row" />
              </div>
              <div className={cn(COLUMN, 'lg:col-span-5')}>
                <Skeleton shape="block" className="h-36" />
                <Skeleton shape="row" />
              </div>
            </div>
          </PageStack>
        </div>
      </Panel>
    </div>
  );
}

/**
 * What needs saying before the day's groups: a clock that was set back, storage trouble, the
 * one-time messages of a return, last week's recap. Most days there is nothing, and then
 * this takes no room at all.
 */
function Notices() {
  const runtime = useGameRuntime();
  const clock = useGameClockStatus();
  const notices = useNotices();
  const recap = useRecap();

  const storageTrouble = runtime.saveFailed || runtime.storage === 'memory';
  if (!clock.skewed && !storageTrouble && notices.length === 0 && !recap.pending) return null;

  return (
    <div className="grid gap-4">
      {clock.skewed ? (
        <TapeNote tone="blue" tape="yellow" rotate={0} role="status" className="mx-1 mt-2">
          {COPY.clockSkew}
        </TapeNote>
      ) : null}
      {runtime.saveFailed ? (
        <ErrorState
          title={COPY.saveFailedTitle}
          body={COPY.saveFailedBody}
          onExport={downloadExport}
        />
      ) : runtime.storage === 'memory' ? (
        <TapeNote tone="pink" tape="blue" rotate={0} role="status" className="mx-1 mt-2">
          {COPY.memoryOnly}
        </TapeNote>
      ) : null}
      <ReturnNotices />
      <WeeklyRecap />
    </div>
  );
}

function Today() {
  const router = useRouter();
  const params = useSearchParams();
  const flow = useBreakFlow();
  const [exploring, setExploring] = useState(false);
  const [xpJustEarned, setXpJustEarned] = useState(0);

  useGameEvent('xp-gained', (event) => setXpJustEarned(event.amount));

  // `/today?break=1` (palette, More sheet, coach chip): open the break sheet, then tidy the URL.
  // Each request is answered once: the URL is replaced asynchronously, so the same value can
  // still be in the query on the next render.
  const breakRequest = params.get(PARAMS.touchGrass);
  const answered = useRef<string | null>(null);
  const { phase, openSheet } = flow;
  useEffect(() => {
    if (breakRequest === null) {
      answered.current = null;
      return;
    }
    if (answered.current === breakRequest) return;
    answered.current = breakRequest;
    if (phase === 'idle') openSheet(breakParam(breakRequest).minutes);
    router.replace(ROUTES.today, { scroll: false });
  }, [breakRequest, phase, openSheet, router]);

  const onExploring = useCallback((next: boolean) => {
    setExploring(next);
    // The island is the top of the page: bring it back into view to explore it.
    if (next) window.scrollTo({ top: 0 });
  }, []);

  const away = phase === 'away' || phase === 'returning';
  const looking = exploring && phase === 'idle';
  // A break and Explore each take the whole screen: the shell puts its bars away meanwhile.
  useHideChrome(away || looking);

  return (
    <div>
      <TodayStage exploring={looking} onExploringChange={onExploring} away={away} />

      <Panel variant="mat" edge="pinked-t" className={DESK} data-today-desk="">
        <div className={CONTENT}>
          {away ? (
            <div className={FOCUS}>
              <BreakAway flow={flow} />
            </div>
          ) : phase === 'result' ? (
            <div className={FOCUS}>
              <BreakResult flow={flow} />
            </div>
          ) : (
            <PageStack>
              <div className={HEADLINE}>
                <div className="min-w-0 lg:col-span-7">
                  <DayDock />
                </div>
                <div className="min-w-0 lg:col-span-5">
                  <StatusTicket xpJustEarned={xpJustEarned} />
                </div>
              </div>

              <div className={GROUPS}>
                <div className={cn(COLUMN, 'lg:col-span-7')}>
                  <Notices />
                  <QuickStickers />
                  <TodayQuests />
                </div>
                <div className={cn(COLUMN, 'lg:col-span-5')}>
                  <NextUp onBreak={(minutes) => openSheet(minutes)} />
                  <TouchGrassCard flow={flow} />
                  <RecentActivity />
                </div>
              </div>
            </PageStack>
          )}
        </div>
      </Panel>

      {away ? null : <BreakStartSheet flow={flow} />}
      {phase === 'idle' ? <CoachMarks /> : null}
    </div>
  );
}

/** `/today`, the app home: the grove as the hero, one thing to do next, then the day in groups. */
export default function TodayPage() {
  const hydrated = useGameHydrated();
  return hydrated ? <Today /> : <TodaySkeleton />;
}
