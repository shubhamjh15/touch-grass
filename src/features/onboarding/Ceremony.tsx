'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { XP_CEREMONY, gameActions, getGameState, useGameNow } from '@/game';
import { cn } from '@/lib/cn';
import { dayKey } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { useReducedMotion } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { Button, Card, ColorBar, IconButton, Lettering, Stamp } from '@/ui';
import { WorldStage, useWorldStore } from '@/world';
import { HoldButton } from './components/HoldButton';
import { COPY, SPECIES_COPY, labelDate } from './copy';
import { plantInput, treeNameOr } from './flow';
import { hasPendingDestination, pendingChallenge, takeDestination } from './handover';
import type { OnboardingFlow } from './useOnboardingFlow';

/** Beats of the planting, in milliseconds after the hold completes (design bible 7.8). */
const BEATS = { stamp: 1900, lettering: 2200, cta: 2400 } as const;
/** Without the 3D sequence there is nothing to wait for: a short cross-fade instead. */
const CALM_BEATS = { stamp: 300, lettering: 300, cta: 300 } as const;
/** Sticker lettering holds at most 24 glyphs. */
const LETTERING_MAX = 24;

type Phase = 'ready' | 'planting' | 'planted';

/**
 * The last screen: the grove takes the whole viewport and one card asks for a press and
 * hold. Completing it (or pressing the plain Plant button) hands the draft to the engine,
 * exactly once: profile, seed, ring 1 and the ceremony's XP. The world plays the planting;
 * this card stamps the date and offers the way on.
 */
export function Ceremony({ flow }: { flow: OnboardingFlow }) {
  const { draft } = flow;
  const router = useRouter();
  const reduced = useReducedMotion();
  const worldReady = useWorldStore((state) => state.status === 'ready');
  const today = dayKey(useGameNow());

  const [phase, setPhase] = useState<Phase>('ready');
  const [beat, setBeat] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Fixed at planting, so the finale never changes under the reader.
  const [planted, setPlanted] = useState<{ name: string; day: string } | null>(null);
  const [onward] = useState(() => ({
    elsewhere: hasPendingDestination(),
    challenge: pendingChallenge() !== null,
  }));

  const started = useRef(false);
  const timers = useRef<number[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const name = planted?.name ?? treeNameOr(draft);

  const plant = useCallback(() => {
    if (started.current) return;
    started.current = true;
    // "Start fresh" only now becomes final: until here, Back could still change it.
    if (draft.legacy === 'fresh') gameActions.declineLegacy();
    const result = gameActions.onboard(plantInput(draft));
    if (!result.ok && result.reason !== 'already-onboarded') {
      started.current = false;
      play('error');
      setError(result.message);
      return;
    }
    flow.finish();
    setError(null);
    setPlanted({ name: getGameState().profile.treeName, day: today });
    setPhase('planting');
    cardRef.current?.focus({ preventScroll: true });

    const beats = reduced || !worldReady ? CALM_BEATS : BEATS;
    const at = (delay: number, run: () => void) => {
      timers.current.push(window.setTimeout(run, delay));
    };
    at(beats.stamp, () => {
      play('stamp');
      setPhase('planted');
      setBeat(1);
    });
    at(beats.lettering, () => setBeat(2));
    at(beats.cta, () => setBeat(3));
  }, [draft, flow, reduced, today, worldReady]);

  // The way on appears last; it takes the focus the hold button gave up.
  useEffect(() => {
    if (beat === 3) ctaRef.current?.focus({ preventScroll: true });
  }, [beat]);

  const leave = () => router.replace(takeDestination());

  const species = SPECIES_COPY[draft.species].noun;
  const plantedLine = COPY.ceremony.planted(name);
  const reward = `+${formatNumber(XP_CEREMONY)} XP · Ring 1`;

  return (
    <div className="relative h-dvh min-h-[600px] overflow-hidden">
      <WorldStage
        mode="ceremony"
        preview={{ species: draft.species }}
        label={
          phase === 'ready'
            ? `${name}'s seed, hanging on a thread above the soil.`
            : `${name}, a freshly planted ${species} sprout with its first ring.`
        }
        className="h-full w-full"
      />

      {phase === 'ready' && flow.canGoBack ? (
        <div className="absolute top-0 left-0 z-20 p-3 pt-[calc(var(--safe-t)+12px)] lg:p-6">
          <IconButton label={COPY.back} icon={ArrowLeft} tooltipSide="right" onClick={flow.back} />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-gutter pb-[max(16px,var(--safe-b))] lg:pb-10">
        <Card
          ref={cardRef}
          tabIndex={-1}
          className="pointer-events-auto relative mx-auto flex min-h-[272px] w-full max-w-[440px] flex-col items-center justify-center text-center outline-hidden motion-safe:animate-stick"
        >
          {phase === 'ready' ? (
            <>
              <p className="type-slug text-ink-3">{COPY.ceremony.slug}</p>
              <h1 className="mt-2.5 text-h2 text-balance text-ink">{COPY.ceremony.hold(name)}</h1>
              <HoldButton
                className="mt-5"
                label={COPY.ceremony.hold(name)}
                hint={COPY.ceremony.holdHint}
                onComplete={plant}
              />
              <Button type="button" variant="ghost" size="md" className="mt-2" onClick={plant}>
                {COPY.ceremony.plant}
              </Button>
              {error ? (
                <p role="alert" className="mt-1 text-caption font-semibold text-tomato-deep">
                  {error}
                </p>
              ) : null}
            </>
          ) : null}

          {phase === 'planting' ? (
            <>
              <p className="type-slug text-ink-3">{COPY.ceremony.planting}</p>
              <ColorBar loading label={COPY.ceremony.planting} className="mt-4" />
            </>
          ) : null}

          {phase === 'planted' ? (
            <>
              <Stamp
                label={COPY.ceremony.stamp}
                date={labelDate(planted?.day ?? today)}
                hue="pink"
                rotate={8}
                animate={!reduced}
                className="absolute -top-5 right-3 bg-card lg:-right-4"
              />
              <h1
                className={cn(
                  'max-w-full text-ink transition-opacity duration-(--dur-base) ease-linear',
                  beat >= 2 ? 'opacity-100' : 'opacity-0',
                )}
              >
                {plantedLine.length <= LETTERING_MAX ? (
                  <Lettering
                    key={beat >= 2 ? 'in' : 'out'}
                    fill="green"
                    sweep={beat >= 2 && !reduced}
                    className="text-display-md sm:text-display-lg"
                  >
                    {plantedLine}
                  </Lettering>
                ) : (
                  <span className="block text-h1 break-words">{plantedLine}</span>
                )}
              </h1>
              <p
                className={cn(
                  'mt-4 text-body font-semibold text-ink transition-opacity duration-(--dur-base) ease-linear',
                  beat >= 2 ? 'opacity-100' : 'opacity-0',
                )}
              >
                {COPY.ceremony.ring}
              </p>
              <p
                className={cn(
                  'mt-1.5 font-mono text-data text-ink-2 transition-opacity duration-(--dur-base) ease-linear',
                  beat >= 2 ? 'opacity-100' : 'opacity-0',
                )}
              >
                {reward}
              </p>
              <div
                className={cn('mt-5 w-full', beat >= 3 ? 'motion-safe:animate-stick' : 'invisible')}
              >
                <Button
                  ref={ctaRef}
                  type="button"
                  variant="primary"
                  size="lg"
                  iconRight={ArrowRight}
                  fullWidth
                  onClick={leave}
                >
                  {onward.elsewhere ? COPY.ceremony.onward : COPY.ceremony.firstLeaf(name)}
                </Button>
                {onward.challenge ? (
                  <p className="mt-2 text-caption text-ink-3">{COPY.ceremony.challenge}</p>
                ) : null}
              </div>
            </>
          ) : null}
        </Card>
        <p role="status" className="sr-only">
          {phase === 'planting' ? COPY.ceremony.planting : null}
          {phase === 'planted' && beat >= 2
            ? `${plantedLine} ${COPY.ceremony.ring} Plus ${formatNumber(XP_CEREMONY)} XP.`
            : null}
        </p>
      </div>
    </div>
  );
}
