'use client';

import { useEffect, useState } from 'react';
import { useGameNow } from '@/game';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useBreakpoint } from '@/lib/hooks';
import { buzz, play } from '@/lib/sfx';
import { Lettering, Stamp, StickerPill, toast } from '@/ui';
import { emitPulse } from '@/world';
import { Flame } from 'lucide-react';
import { useShellStore } from '../shellStore';
import { useCelebrationStore } from './celebrationStore';
import type { Celebration } from './eventFeedback';
import { celebrationPulse } from './plan';

const LEVEL_UP_MS = 2400;
const BADGE_STICK_MS = 220;
const BADGE_IMPACT_MS = 400;
const BADGE_HOLD_MS = 4400;
const STREAK_MS = 3000;

const CONFETTI_INKS = [
  '--color-green',
  '--color-blue',
  '--color-yellow',
  '--color-pink',
  '--color-ink',
];

/** Colour-bar confetti: flat squares in the five brand inks, no gradients (bible 7.7). */
async function throwConfetti(particleCount: number): Promise<void> {
  const { default: confetti } = await import('canvas-confetti');
  const style = getComputedStyle(document.documentElement);
  const colors = CONFETTI_INKS.map((token) => style.getPropertyValue(token).trim()).filter(Boolean);
  await confetti({
    particleCount,
    colors,
    shapes: ['square'],
    flat: true,
    spread: 80,
    startVelocity: 38,
    gravity: 1.1,
    ticks: 140,
    scalar: 1.15,
    origin: { x: 0.5, y: 0.42 },
    zIndex: 89,
    disableForReducedMotion: true,
  });
}

/** Dismisses on Esc and after `ms`. */
function useAutoDismiss(onDone: () => void, ms: number): void {
  useEffect(() => {
    const timer = window.setTimeout(onDone, ms);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDone, ms]);
}

/** "LEVEL 6" sweeps in over the page. Not a modal: the page stays usable and a tap sends it away. */
function LevelUp({
  celebration,
  onDone,
}: {
  celebration: Extract<Celebration, { kind: 'level-up' }>;
  onDone: () => void;
}) {
  const desktop = useBreakpoint('lg');
  useAutoDismiss(onDone, LEVEL_UP_MS);

  useEffect(() => {
    play('level');
    void throwConfetti(desktop ? 60 : 30).catch(() => undefined);
    // Thrown once when the lettering lands; a resize must not throw it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-(--z-fx) grid place-items-center p-6">
      <button
        type="button"
        onClick={onDone}
        data-celebration="level-up"
        className="pointer-events-auto grid cursor-pointer justify-items-center gap-4 rounded-xl p-4"
      >
        <Lettering sweep fill="yellow" tilt="none" className="text-display-xl">
          {`LEVEL ${formatNumber(celebration.level)}`}
        </Lettering>
        <StickerPill hue="white" rotate={-2} className="animate-stick type-slug calm:animate-none">
          {celebration.title}
        </StickerPill>
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}

const labelDate = (now: number): string =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(now)
    .toUpperCase();

/** A passport page sticks in at the centre and the stamp comes down on it (bible 7.6). */
function BadgeStamp({
  celebration,
  onDone,
}: {
  celebration: Extract<Celebration, { kind: 'badge' }>;
  onDone: () => void;
}) {
  const now = useGameNow();
  const [phase, setPhase] = useState<'page' | 'stamp' | 'impact' | 'rest'>('page');
  useAutoDismiss(onDone, BADGE_HOLD_MS);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase('stamp'), BADGE_STICK_MS),
      window.setTimeout(() => {
        setPhase('impact');
        play('stamp');
        buzz(12);
      }, BADGE_IMPACT_MS),
      window.setTimeout(() => setPhase('rest'), BADGE_IMPACT_MS + 80),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-(--z-fx) grid place-items-center p-6">
      <button
        type="button"
        onClick={onDone}
        data-celebration="badge"
        className={cn(
          'pointer-events-auto grid w-[min(100%,320px)] animate-stick cursor-pointer justify-items-center gap-2 rounded-paper border-3 border-ink bg-paper p-5 text-center shadow-5 calm:animate-none',
          // The jolt of the impact: three pixels down-right for one beat.
          phase === 'impact' && 'translate-x-[3px] translate-y-[3px] calm:translate-0',
        )}
      >
        <span className="type-slug text-ink-3">Passport · new stamp</span>
        <span className="my-1 grid h-36 w-full place-items-center rounded-lg dieline">
          {phase === 'page' ? null : (
            <Stamp
              label={celebration.name}
              date={labelDate(now)}
              shape="round"
              hue="green"
              rotate={-8}
              animate
            />
          )}
        </span>
        <span className="text-h3">
          <span aria-hidden="true">{celebration.emoji} </span>
          {celebration.name}
        </span>
        <span className="font-mono text-data text-ink-2">
          {celebration.tiers > 1
            ? `Tier ${formatNumber(celebration.tier)} of ${formatNumber(celebration.tiers)} · `
            : ''}
          +{formatNumber(celebration.xp)} XP
        </span>
        <span className="type-tick text-ink-3">Tap to keep going</span>
      </button>
    </div>
  );
}

/** A milestone has no overlay: the flame pops, a pill sticks beside it and a receipt prints. */
function StreakMilestone({
  celebration,
  onDone,
}: {
  celebration: Extract<Celebration, { kind: 'streak' }>;
  onDone: () => void;
}) {
  useEffect(() => {
    play('streak');
    useShellStore.getState().flashStreak(celebration.days);
    toast({
      id: 'streak-milestone',
      title: `${formatNumber(celebration.days)} days running.`,
      meta: celebration.xp > 0 ? `+${formatNumber(celebration.xp)} XP` : undefined,
      icon: Flame,
      tone: 'success',
    });
    const timer = window.setTimeout(onDone, STREAK_MS);
    return () => window.clearTimeout(timer);
  }, [celebration, onDone]);
  return null;
}

function announcementFor(celebration: Celebration | undefined): string {
  if (!celebration) return '';
  switch (celebration.kind) {
    case 'level-up':
      return `Level ${formatNumber(celebration.level)}. ${celebration.title}.`;
    case 'badge':
      return `New badge: ${celebration.name}. Plus ${formatNumber(celebration.xp)} XP.`;
    case 'streak':
      return `${formatNumber(celebration.days)} days running.`;
  }
}

/**
 * Plays the queued celebrations one at a time (bible 7.1, rule 5). None of them traps focus or
 * blocks the page; each can be skipped with a tap or Esc, and each is announced politely.
 */
export function Celebrations() {
  const current = useCelebrationStore((state) => state.queue[0]);
  const advance = useCelebrationStore((state) => state.advance);

  // The world answers on the celebration's own beat, once per celebration.
  useEffect(() => {
    if (current) emitPulse(celebrationPulse(current));
  }, [current]);

  let overlay = null;
  if (current) {
    // Keyed by the celebration object, so two of a kind in a row each get their own entrance.
    switch (current.kind) {
      case 'level-up':
        overlay = <LevelUp key={`level-${current.level}`} celebration={current} onDone={advance} />;
        break;
      case 'badge':
        overlay = (
          <BadgeStamp
            key={`badge-${current.name}-${current.tier}`}
            celebration={current}
            onDone={advance}
          />
        );
        break;
      case 'streak':
        overlay = (
          <StreakMilestone key={`streak-${current.days}`} celebration={current} onDone={advance} />
        );
        break;
    }
  }

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcementFor(current)}
      </p>
      {overlay}
    </>
  );
}
