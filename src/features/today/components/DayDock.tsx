'use client';

import { ArrowRight, Droplet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ROUTES } from '@/app/shell';
import { gameActions, useGameEvent, useGameNow, useProfile, useToday, useTreeStatus } from '@/game';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useReducedMotion } from '@/lib/hooks';
import { buzz, play } from '@/lib/sfx';
import { Button, Card, RingProgress } from '@/ui';
import { COPY, waterLabel, wateredAnnouncement } from '../copy';
import { greeting, printDate } from '../model';

const WATER_BEAT_MS = 600;
const RING_MOMENT_MS = 1200;

/**
 * The one thing to do next, docked under the stage: the day's ring, a sentence that says
 * where the day stands, and a single primary button. It reads *Water* until the day's
 * check-in and *Log an action* after it, so there is never a second button to weigh. The
 * sentence comes from the game, so a thirsty or resting tree is described in the same words
 * everywhere.
 */
export function DayDock() {
  const tree = useTreeStatus();
  const today = useToday();
  const profile = useProfile();
  const now = useGameNow();
  const reduced = useReducedMotion();
  const [watering, setWatering] = useState(false);
  const [ringMoment, setRingMoment] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
      pending.length = 0;
    };
  }, []);

  const after = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  };

  useGameEvent('checked-in', (event) => {
    if (event.via === 'ceremony') return;
    setAnnouncement(wateredAnnouncement(tree.name, event.ringNumber, event.implicit));
  });

  useGameEvent('ring', (event) => {
    if (event.state !== 'closed' || !event.first) return;
    setAnnouncement('Ring closed. See you tomorrow?');
    if (reduced) return;
    setRingMoment(true);
    after(RING_MOMENT_MS, () => setRingMoment(false));
  });

  const water = () => {
    play('tap');
    buzz(10);
    if (!reduced) {
      // The button holds its success beat before it turns into the Log button.
      setWatering(true);
      after(WATER_BEAT_MS, () => setWatering(false));
    }
    gameActions.checkIn();
  };

  const showWater = !today.checkedIn || watering;
  const dormant = tree.vitality === 'dormant';
  const acts = Math.min(today.rewardedActs, today.ringGoal);

  return (
    <Card
      as="section"
      aria-label={COPY.dockLabel}
      data-coachmark="ring"
      data-vitality={tree.vitality}
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5 lg:px-6 lg:py-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5 lg:gap-5">
        <RingProgress
          size={64}
          value={acts}
          max={today.ringGoal}
          tone={today.ringClosed ? 'yellow' : 'green'}
          label="Today's ring"
          valueText={
            today.ringClosed
              ? 'Closed'
              : `${formatNumber(acts)} of ${formatNumber(today.ringGoal)} actions${today.checkedIn ? '' : ', not watered yet'}`
          }
          className={cn('shrink-0', ringMoment && 'animate-pop')}
        >
          <span className="font-mono text-data">
            {formatNumber(acts)}/{formatNumber(today.ringGoal)}
          </span>
        </RingProgress>
        <div className="min-w-0 flex-1">
          <p className="type-slug text-ink-3 max-lg:hidden">{printDate(today.day)}</p>
          <h1 className="text-h3 text-ink lg:mt-1 lg:text-h2">{greeting(now, profile.name)}</h1>
          <p className="mt-1 text-body text-ink-2" data-testid="status-line">
            {tree.statusLine}
          </p>
          {today.dayOneCopy && today.logs.length > 0 ? (
            <p className="mt-1 text-caption text-ink-2">{today.dayOneCopy}</p>
          ) : null}
        </div>
      </div>

      {showWater ? (
        <Button
          variant="primary"
          size="lg"
          icon={Droplet}
          success={watering}
          className="w-full sm:w-auto sm:min-w-56"
          onClick={today.checkedIn ? undefined : water}
        >
          {waterLabel(tree.name, dormant)}
        </Button>
      ) : (
        <Button
          asChild
          variant="primary"
          size="lg"
          iconRight={ArrowRight}
          className="w-full sm:w-auto sm:min-w-56"
        >
          <Link href={ROUTES.log}>{COPY.logAction}</Link>
        </Button>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </Card>
  );
}
