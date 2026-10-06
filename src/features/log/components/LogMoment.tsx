'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CategoryId } from '@/data/catalogue';
import { useReducedMotion } from '@/lib/hooks';
import { buzz, play } from '@/lib/sfx';
import { EASINGS, Sticker } from '@/ui';
import { getStickingPoint } from '@/world';

/** Bible 7.4: peel 0–140 ms, carry 140–440 ms, press 440–520 ms. */
const LAND_MS = 440;
const DONE_MS = 520;
const PEEL_END = 140 / DONE_MS;
const LAND = LAND_MS / DONE_MS;
/** The control point of the arc sits this far above the midpoint. */
const ARC_LIFT = 80;
const SIZE = 66;

interface Point {
  x: number;
  y: number;
}

interface Flight {
  id: number;
  category: CategoryId;
  icon: LucideIcon;
  from: Point;
  to: Point;
  /** Size of the sticker the clone lifts off from, relative to the 66 px clone. */
  startScale: number;
}

export interface LaunchOptions {
  category: CategoryId;
  icon: LucideIcon;
  /** The sticker the clone peels off from. Without it the log is saved at once. */
  origin: Element | null;
  /** Saves the log. Runs when the sticker lands, or at once when nothing flies. */
  commit: () => void;
}

const STAGE_SELECTOR = '[data-log-stage]';

/**
 * Where the sticker lands: the point the world offers on the crown, or, when the tree is
 * scrolled out of view, the edge of the screen in the direction of the page's own stage.
 */
function landingPoint(): Point | null {
  const onTree = getStickingPoint();
  if (onTree) return onTree;
  const stage = document.querySelector(STAGE_SELECTOR);
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: Math.max(-SIZE, Math.min(window.innerHeight + SIZE, rect.top + rect.height * 0.4)),
  };
}

/** A point on the quadratic arc from `from` to `to` whose control point is lifted above the middle. */
function arc(from: Point, to: Point, t: number): Point {
  const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - ARC_LIFT };
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

const CARRY_STEPS = [0.25, 0.5, 0.75, 1] as const;

function FlyingSticker({ flight }: { flight: Flight }) {
  const { from, to, startScale } = flight;
  const path = CARRY_STEPS.map((step) => arc(from, to, step));
  const carryTimes = CARRY_STEPS.map((step) => PEEL_END + (LAND - PEEL_END) * step);
  const times = [0, PEEL_END, ...carryTimes, 1];
  const half = SIZE / 2;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 will-change-transform"
      initial={{ x: from.x - half, y: from.y - half, scale: startScale, rotate: 0, opacity: 1 }}
      animate={{
        x: [from.x - half, from.x - half - 4, ...path.map((point) => point.x - half), to.x - half],
        y: [from.y - half, from.y - half - 8, ...path.map((point) => point.y - half), to.y - half],
        scale: [startScale, startScale * 1.15, 1, 0.85, 0.7, 0.6, 0.5],
        rotate: [0, -8, -5, -1, 3, 6, 6],
        opacity: [1, 1, 1, 1, 1, 1, 0],
      }}
      transition={{ duration: DONE_MS / 1000, times, ease: EASINGS.inOut }}
    >
      <Sticker category={flight.category} icon={flight.icon} size={66} rotate={0} />
    </motion.div>
  );
}

interface Pending {
  commit: () => void;
  land: number;
  done: number;
}

/**
 * The log moment (bible 7.4). `launch` peels a clone of the action's sticker off its slot and
 * carries it to the tree; the log is saved when it lands, so the shell's leaves, sound and
 * receipt (all driven by the engine's events) arrive on the beat. Nothing is ever lost to the
 * animation: without motion or a place to land the log is saved at once, and a flight still
 * in the air when the page goes away is landed first. A second log during the moment simply
 * launches its own sticker.
 */
export function useLogMoment(): {
  launch: (options: LaunchOptions) => void;
  layer: React.ReactNode;
} {
  const reduced = useReducedMotion();
  const [flights, setFlights] = useState<Flight[]>([]);
  const pending = useRef(new Map<number, Pending>());
  const counter = useRef(0);

  const land = useCallback((id: number) => {
    const entry = pending.current.get(id);
    if (!entry) return;
    pending.current.delete(id);
    window.clearTimeout(entry.land);
    entry.commit();
  }, []);

  const flush = useCallback(() => {
    for (const id of [...pending.current.keys()]) land(id);
  }, [land]);

  useEffect(() => {
    const timers = pending.current;
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      for (const entry of timers.values()) window.clearTimeout(entry.done);
      flush();
    };
  }, [flush]);

  const launch = useCallback(
    ({ category, icon, origin, commit }: LaunchOptions) => {
      play('tap');
      buzz(10);
      const rect = origin?.getBoundingClientRect();
      const to = reduced || !rect || rect.width === 0 ? null : landingPoint();
      if (!rect || !to) {
        commit();
        return;
      }
      play('peel');
      counter.current += 1;
      const id = counter.current;
      const flight: Flight = {
        id,
        category,
        icon,
        from: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        to,
        startScale: Math.min(1.6, Math.max(0.5, rect.width / SIZE)),
      };
      pending.current.set(id, {
        commit,
        land: window.setTimeout(() => land(id), LAND_MS),
        done: window.setTimeout(() => {
          setFlights((current) => current.filter((item) => item.id !== id));
        }, DONE_MS + 40),
      });
      setFlights((current) => [...current, flight]);
    },
    [land, reduced],
  );

  const layer =
    flights.length > 0
      ? createPortal(
          <div className="pointer-events-none fixed inset-0 z-(--z-fx) overflow-hidden">
            {flights.map((flight) => (
              <FlyingSticker key={flight.id} flight={flight} />
            ))}
          </div>,
          document.body,
        )
      : null;

  return { launch, layer };
}
