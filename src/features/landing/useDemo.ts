'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readDemoCarry, writeDemoCarry } from '@/lib/demoCarry';
import { prefersReducedMotion } from '@/lib/hooks';
import { buzz, play } from '@/lib/sfx';
import { emitPulse, getStickingPoint, type Species } from '@/world';
import { demoStatus, type DemoAction, type DemoStatus } from './model';

/** The log moment's carry lands 440 ms after the press (bible 7.4). */
export const FLIGHT_LAND_MS = 440;
/** How long a new stage's name stays stuck on the stage (bible 7.7). */
const STAGE_FLASH_MS = 2000;
/** The demo is sped up, so every sticker gets a generous burst of leaves. */
const GROW_STRENGTH = 0.8;

export interface Point {
  x: number;
  y: number;
}

export interface DemoFlight {
  key: number;
  action: DemoAction;
  from: Point;
  to: Point;
}

export interface DemoState {
  species: Species;
  setSpecies: (species: Species) => void;
  /** Stickers that have landed on the tree. */
  taps: number;
  status: DemoStatus;
  /** How often each demo action has landed, in the order they were first stuck. */
  tally: readonly { action: DemoAction; count: number }[];
  /** The sticker that landed last: its receipt is the one the page explains. */
  last: DemoAction | null;
  /** Stickers in the air right now. */
  flights: readonly DemoFlight[];
  /** A stage the demo tree has just reached, shown on the stage for a moment. */
  stageFlash: string | null;
  /** Peel a sticker off its slot and carry it to the tree. */
  stick: (action: DemoAction, origin: HTMLElement) => void;
  /** Called by a flight when its sticker reaches the tree. */
  landFlight: (key: number) => void;
  /** Called by a flight when its animation is over. */
  endFlight: (key: number) => void;
}

/** Where a flying sticker lands: the tree's sticking point, if it is on screen right now. */
function visibleStickingPoint(): Point | null {
  const point = getStickingPoint();
  if (!point) return null;
  const inside =
    point.x >= 0 && point.x <= window.innerWidth && point.y >= 0 && point.y <= window.innerHeight;
  return inside ? point : null;
}

function centreOf(element: HTMLElement): Point {
  const art = element.querySelector('svg') ?? element;
  const rect = art.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * The landing page's demo tree: in memory only. The one thing that outlives the page is the
 * carry in `sessionStorage` (species + the first sticker), so onboarding can offer that
 * action as the visitor's real first log. `onLand` is the page's chance to print a receipt.
 */
export function useDemo(onLand: (action: DemoAction, status: DemoStatus) => void): DemoState {
  const [species, setSpeciesState] = useState<Species>('oak');
  const [taps, setTaps] = useState(0);
  const [tally, setTally] = useState<readonly { action: DemoAction; count: number }[]>([]);
  const [last, setLast] = useState<DemoAction | null>(null);
  const [flights, setFlights] = useState<readonly DemoFlight[]>([]);
  const [stageFlash, setStageFlash] = useState<string | null>(null);

  // Handlers read the latest values from refs so they can stay stable while stickers fly.
  const tapsRef = useRef(0);
  const speciesRef = useRef<Species>('oak');
  const firstAction = useRef<DemoAction | null>(null);
  const flightsRef = useRef<readonly DemoFlight[]>([]);
  const flightSeq = useRef(0);
  const landedFlights = useRef(new Set<number>());
  const flashTimer = useRef<number | null>(null);
  const onLandRef = useRef(onLand);
  useEffect(() => {
    onLandRef.current = onLand;
  }, [onLand]);

  // A visitor who comes back from onboarding in the same tab finds the species they chose.
  useEffect(() => {
    const carry = readDemoCarry();
    if (!carry || carry.species === speciesRef.current) return;
    speciesRef.current = carry.species;
    setSpeciesState(carry.species);
  }, []);

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const carry = useCallback(() => {
    const first = firstAction.current;
    writeDemoCarry({
      species: speciesRef.current,
      actionId: first ? first.actionId : null,
      qty: first ? first.qty : null,
    });
  }, []);

  const setSpecies = useCallback(
    (next: Species) => {
      if (next === speciesRef.current) return;
      speciesRef.current = next;
      setSpeciesState(next);
      play('toggle');
      carry();
    },
    [carry],
  );

  const land = useCallback(
    (action: DemoAction) => {
      const before = demoStatus(tapsRef.current);
      tapsRef.current += 1;
      const after = demoStatus(tapsRef.current);
      setTaps(tapsRef.current);
      setLast(action);
      setTally((current) => {
        const found = current.some((entry) => entry.action.id === action.id);
        if (!found) return [...current, { action, count: 1 }];
        return current.map((entry) =>
          entry.action.id === action.id ? { ...entry, count: entry.count + 1 } : entry,
        );
      });

      if (!firstAction.current) {
        firstAction.current = action;
        carry();
      }

      emitPulse({ kind: 'grow', strength: GROW_STRENGTH });
      play('stick');
      play('leaf', { count: 4 });

      if (after.stage !== before.stage) {
        emitPulse({ kind: 'celebrate' });
        setStageFlash(after.stage);
        if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => {
          flashTimer.current = null;
          setStageFlash(null);
        }, STAGE_FLASH_MS);
      }

      onLandRef.current(action, after);
    },
    [carry],
  );

  const stick = useCallback(
    (action: DemoAction, origin: HTMLElement) => {
      play('tap');
      buzz(10);
      const target = prefersReducedMotion() ? null : visibleStickingPoint();
      if (!target) {
        // Calm mode, or the tree is off screen: no flight, the sticker simply lands.
        land(action);
        return;
      }
      play('peel');
      flightSeq.current += 1;
      const flight = { key: flightSeq.current, action, from: centreOf(origin), to: target };
      flightsRef.current = [...flightsRef.current, flight];
      setFlights(flightsRef.current);
    },
    [land],
  );

  const landFlight = useCallback(
    (key: number) => {
      // A flight reports its landing twice (its timer, then the end of its animation): count one.
      if (landedFlights.current.has(key)) return;
      const flight = flightsRef.current.find((entry) => entry.key === key);
      if (!flight) return;
      landedFlights.current.add(key);
      land(flight.action);
    },
    [land],
  );

  const endFlight = useCallback((key: number) => {
    landedFlights.current.delete(key);
    flightsRef.current = flightsRef.current.filter((entry) => entry.key !== key);
    setFlights(flightsRef.current);
  }, []);

  const status = useMemo(() => demoStatus(taps), [taps]);

  return {
    species,
    setSpecies,
    taps,
    status,
    tally,
    last,
    flights,
    stageFlash,
    stick,
    landFlight,
    endFlight,
  };
}
