'use client';

import { motion } from 'framer-motion';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '@/lib/hooks';
import { EASINGS } from '@/ui';
import { getStickingPoint } from '@/world';

interface Point {
  x: number;
  y: number;
}

interface Flight {
  id: number;
  from: Point;
  to: Point;
  label: string;
}

/**
 * Where a torn stub lands (bible 7.5): the HUD's level cell on desktop or the tree chip on
 * mobile, whichever the shell marks with `data-reward-target`; without one, the tree itself.
 * `null` when neither is on screen: then the stub only tears away.
 */
function rewardTarget(): Point | null {
  for (const element of document.querySelectorAll<HTMLElement>('[data-reward-target]')) {
    const rect = element.getBoundingClientRect();
    const visible =
      rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    if (visible) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  const tree = getStickingPoint();
  if (!tree) return null;
  // A tree that has scrolled away is still "up there": leave through the top edge.
  return { x: tree.x, y: Math.max(tree.y, -48) };
}

/** The kit's tear has pulled the stub this far when the flight takes over (keyframe `tear`, 60 %). */
const TEAR_OFFSET: Point = { x: 16, y: -6 };
const TAKEOVER_S = 0.25;
const FLIGHT_S = 0.34;
/** How far the path bows above the straight line. */
const ARC_PX = 36;

/**
 * The second half of the tear: the stub that was just torn off flies to where rewards are
 * kept and is pressed into it. Purely decorative (the ticket already says "claimed", and the
 * ticket announces it), so it is skipped under reduced motion and when there is no target.
 */
export function useRewardFlight(): {
  /** `from` is the centre of the stub in viewport coordinates. */
  launch: (from: Point | null, label: string) => void;
  /** Render once, anywhere in the page. */
  layer: ReactNode;
} {
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextId = useRef(0);

  const launch = useCallback((from: Point | null, label: string) => {
    if (!from || prefersReducedMotion()) return;
    const to = rewardTarget();
    if (!to) return;
    nextId.current += 1;
    const flight: Flight = {
      id: nextId.current,
      from: { x: from.x + TEAR_OFFSET.x, y: from.y + TEAR_OFFSET.y },
      to,
      label,
    };
    setFlights((current) => [...current, flight]);
  }, []);

  const land = useCallback((id: number) => {
    setFlights((current) => current.filter((flight) => flight.id !== id));
  }, []);

  const layer =
    flights.length > 0
      ? createPortal(
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-(--z-fx)">
            {flights.map((flight) => (
              <motion.span
                key={flight.id}
                data-reward-flight=""
                className="absolute -top-8 -left-[42px] grid h-16 w-[84px] place-items-center rounded-r-[9px] border-3 border-l-2 [border-left-style:dashed] border-ink bg-yellow text-button-sm text-ink shadow-2"
                initial={{ x: flight.from.x, y: flight.from.y, scale: 1, rotate: 14, opacity: 0 }}
                animate={{
                  x: [flight.from.x, (flight.from.x + flight.to.x) / 2, flight.to.x],
                  y: [flight.from.y, Math.min(flight.from.y, flight.to.y) - ARC_PX, flight.to.y],
                  scale: [1, 0.85, 0.5],
                  rotate: [14, 4, -6],
                  opacity: [1, 1, 1],
                }}
                transition={{
                  delay: TAKEOVER_S,
                  duration: FLIGHT_S,
                  ease: EASINGS.inOut,
                  times: [0, 0.5, 1],
                  opacity: { delay: TAKEOVER_S, duration: 0.01 },
                }}
                onAnimationComplete={() => land(flight.id)}
              >
                {flight.label}
              </motion.span>
            ))}
          </div>,
          document.body,
        )
      : null;

  return { launch, layer };
}
