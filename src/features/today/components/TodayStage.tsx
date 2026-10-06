'use client';

import { Check, ChevronLeft, ChevronRight, Compass, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ROUTES, openCoach } from '@/app/shell';
import { useGameNow, useQuests, useToday, useTreeStatus } from '@/game';
import { cn } from '@/lib/cn';
import { useBreakpoint } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { Button, IconButton, StickerPill, Tag } from '@/ui';
import { WorldStage, useWorldStore, type LandmarkId } from '@/world';
import { BREAK_COPY, COPY } from '../copy';
import { worldExplore } from '../explore';
import { LANDMARK_ROUTE, landmarkMeta, printSlug, sceneLabel, specimenLines } from '../model';

/** The stage box at rest and while Today's own Explore mode has it. Skeleton and page share it. */
export const STAGE_BOX =
  'relative w-full h-[clamp(340px,56dvh,560px)] lg:h-[clamp(500px,74dvh,840px)]';
const STAGE_BOX_EXPLORING =
  'relative w-full h-[calc(100dvh-var(--tabbar-h)-var(--safe-b))] min-h-[420px] lg:h-dvh';

/** Chips sit below the shell's bars: the floating app bar on a phone, the top bar on a desk. */
const BELOW_BARS = 'top-[calc(var(--safe-t)+72px)] lg:top-28';

export interface TodayStageProps {
  /** Today's own Explore mode (used until the world brings its full-screen one). */
  exploring: boolean;
  onExploringChange: (exploring: boolean) => void;
  /** A break is running: the grove goes quiet, with no doors and no controls. */
  away?: boolean;
}

/**
 * The hero of the app home: the grove in hub mode, as large as the first screen allows, with
 * a heads-up display at its edges and nothing over the tree. Top left, the hang tag (name,
 * species, stage, day, mood). Bottom right, Explore. The shell's own bars carry level and
 * streak along the top edge. The world draws the scene; this component only places chips in
 * front of it and turns a landmark into a route.
 */
export function TodayStage({ exploring, onExploringChange, away = false }: TodayStageProps) {
  const router = useRouter();
  const tree = useTreeStatus();
  const quests = useQuests();
  const today = useToday();
  const now = useGameNow();
  const desktop = useBreakpoint('lg');
  const worldStatus = useWorldStore((state) => state.status);
  const frame = useRef<HTMLDivElement>(null);

  const landmarks = exploring && !away;
  // Without WebGL the world lists the landmarks along the bottom edge, so the controls move up.
  const listed = landmarks && worldStatus === 'fallback';
  const lines = specimenLines(tree);

  useEffect(() => {
    if (!exploring) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExploringChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exploring, onExploringChange]);

  const onLandmark = (id: LandmarkId) => {
    play('tap');
    if (id === 'coach') openCoach();
    else router.push(LANDMARK_ROUTE[id]);
  };

  // The world turns the island on the arrow keys of its stage box. The turn buttons press
  // those keys for people who can neither drag nor reach a keyboard.
  const turn = (key: 'ArrowLeft' | 'ArrowRight') => {
    const stage = frame.current?.querySelector<HTMLElement>('[data-world-stage]');
    if (!stage) return;
    play('tick');
    stage.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };

  const toggleExplore = () => {
    play('toggle');
    const open = exploring ? null : worldExplore();
    if (open) open();
    else onExploringChange(!exploring);
  };

  return (
    <div
      ref={frame}
      data-coachmark="tree"
      data-exploring={exploring ? '' : undefined}
      className={exploring ? STAGE_BOX_EXPLORING : STAGE_BOX}
    >
      <WorldStage
        mode="hub"
        interactive={!away}
        landmarks={landmarks}
        onLandmark={onLandmark}
        landmarkMeta={landmarkMeta(quests, tree)}
        label={sceneLabel(tree, now)}
        className="size-full"
      >
        {away ? (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-ink/35" />
            <div className={cn('absolute left-3 lg:left-8', BELOW_BARS)}>
              <StickerPill hue="yellow" icon={Timer} rotate={-2}>
                <span className="text-button-sm">{BREAK_COPY.slug}</span>
              </StickerPill>
            </div>
          </>
        ) : (
          <>
            <div className={cn('absolute left-3 lg:left-8', BELOW_BARS)}>
              <Tag
                variant="specimen"
                title={tree.name}
                meta={desktop ? `${lines.kind} · ${lines.state}` : lines.state}
                href={ROUTES.me}
                aria-label={`${tree.name}: ${lines.kind}, ${lines.state}. Open the passport.`}
              />
            </div>

            {exploring ? (
              <p
                role="status"
                className={cn(
                  'absolute inset-x-3 mx-auto w-fit max-w-[calc(100%-24px)] rounded-sm border-2 border-ink bg-paper px-2.5 py-1 text-center text-caption text-ink shadow-2',
                  listed ? 'bottom-44' : 'bottom-20 lg:bottom-24',
                )}
              >
                {COPY.exploreHint}
              </p>
            ) : null}

            <div
              className={cn(
                'absolute right-3 flex items-center gap-2 lg:right-8 lg:gap-3',
                listed ? 'bottom-28' : 'bottom-5 lg:bottom-8',
              )}
            >
              {exploring ? (
                <>
                  <IconButton
                    label="Turn left"
                    icon={ChevronLeft}
                    onClick={() => turn('ArrowLeft')}
                  />
                  <IconButton
                    label="Turn right"
                    icon={ChevronRight}
                    onClick={() => turn('ArrowRight')}
                  />
                </>
              ) : null}
              <Button
                size={desktop ? 'md' : 'sm'}
                variant={exploring ? 'ink' : 'neutral'}
                icon={exploring ? Check : Compass}
                aria-pressed={exploring}
                onClick={toggleExplore}
              >
                {exploring ? COPY.exploreDone : desktop ? COPY.explore : COPY.exploreShort}
              </Button>
            </div>

            {desktop && !exploring ? (
              <p
                aria-hidden="true"
                className="pointer-events-none absolute bottom-9 left-8 rounded-xs border-2 border-ink bg-paper px-2 py-1 type-tick text-ink-2"
              >
                {printSlug(tree.rings, today.day, now)}
              </p>
            ) : null}
          </>
        )}
      </WorldStage>
    </div>
  );
}
