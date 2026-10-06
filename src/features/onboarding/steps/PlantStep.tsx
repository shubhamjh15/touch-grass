'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { gameActions, getGameState } from '@/game';
import { useReducedMotion } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { Button } from '@/ui';
import { WorldStage, type WorldSnapshot } from '@/world';
import { StepActions } from '../components/StepFrame';
import { StepHeadingContext } from '../components/stepHeading';
import { COPY, SPECIES_COPY } from '../copy';
import { plantInput, treeNameOr } from '../flow';
import { hasPendingDestination, pendingChallenge, takeDestination } from '../handover';
import type { OnboardingFlow } from '../useOnboardingFlow';

/** How long the planting is watched before the app opens. */
export const PLANT_MS = 3000;
/** Without the animation there is nothing to watch: long enough to read one line. */
export const PLANT_CALM_MS = 1200;
/** The second half of a double click must not skip the moment it has just started. */
const SETTLE_MS = 700;

/**
 * The last screen: the tree-to-be and one button. Pressing it hands the draft to the engine
 * exactly once (profile, seed, ring 1 and the planting XP). The world plays its planting
 * moment in the stage, and the app opens by itself about three seconds later; the button
 * turns into the way on for anyone who would rather not wait.
 */
export function PlantStep({ flow }: { flow: OnboardingFlow }) {
  const { draft } = flow;
  const headingRef = use(StepHeadingContext);
  const router = useRouter();
  const reduced = useReducedMotion();

  // Fixed at planting, so the line never changes under the reader.
  const [planted, setPlanted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onward] = useState(() =>
    pendingChallenge() !== null
      ? COPY.plant.toChallenge
      : hasPendingDestination()
        ? COPY.plant.toElsewhere
        : COPY.plant.toToday,
  );

  const started = useRef(false);
  const plantedAt = useRef(0);
  const left = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    router.replace(takeDestination());
  }, [router]);

  const plant = useCallback(() => {
    if (started.current) return;
    started.current = true;
    // "Start fresh" only now becomes final: until here, Back could still change it.
    if (draft.legacy === 'fresh') gameActions.declineLegacy();
    const result = gameActions.onboard(plantInput(draft, getGameState().profile.region));
    if (!result.ok && result.reason !== 'already-onboarded') {
      started.current = false;
      setError(result.message);
      return;
    }
    play('plant');
    flow.finish();
    setError(null);
    plantedAt.current = performance.now();
    setPlanted(getGameState().profile.treeName);
    headingRef?.current?.focus({ preventScroll: true });
    timer.current = window.setTimeout(leave, reduced ? PLANT_CALM_MS : PLANT_MS);
  }, [draft, flow, headingRef, leave, reduced]);

  const name = planted ?? treeNameOr(draft);
  const species = SPECIES_COPY[draft.species].noun;
  // Before planting the stage shows this draft's seed; afterwards, the tree the game now holds.
  const preview: Partial<WorldSnapshot> | undefined =
    planted === null
      ? { species: draft.species, growth: 0, vitality: 1, ageDays: 0, props: [] }
      : undefined;

  return (
    <form
      noValidate
      className="flex min-w-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (planted === null) plant();
        else if (performance.now() - plantedAt.current >= SETTLE_MS) leave();
      }}
    >
      <WorldStage
        mode="ceremony"
        interactive={false}
        preview={preview}
        label={
          planted === null
            ? `A small island with the seed of ${name}, your ${species}.`
            : `${name}, a freshly planted ${species}.`
        }
        className="mx-auto h-[300px] w-full max-w-[440px] sm:h-[380px]"
      />
      <header className="mt-6 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="text-h1 text-balance text-ink outline-hidden">
          <span
            key={planted === null ? 'ready' : 'planted'}
            className="block transition-opacity duration-(--dur-slow) ease-linear starting:opacity-0"
          >
            {planted === null ? COPY.plant.title(name) : COPY.plant.planted(name)}
          </span>
        </h1>
        <p className="mt-3 text-body text-pretty text-ink-2">
          {planted === null ? COPY.plant.lead : onward}
        </p>
      </header>
      <StepActions>
        {error ? (
          <p role="alert" className="text-center text-body-sm font-semibold text-tomato-deep">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" fullWidth>
          {planted === null ? COPY.plant.cta(name) : COPY.plant.onward}
        </Button>
      </StepActions>
      <p role="status" className="sr-only">
        {planted === null ? null : COPY.plant.planted(name)}
      </p>
    </form>
  );
}
