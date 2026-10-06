'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Sticker, type CategoryId, type StickerSize } from '@/ui';
import { flightFrames, type Point } from '../model';

export interface Flight {
  id: number;
  category: CategoryId;
  /** Viewport pixels: the centre of the sticker at take-off and at landing. */
  from: Point;
  to: Point;
  size: StickerSize;
  /** An undo: the sticker comes home to its slot instead of leaving it. */
  back: boolean;
}

/**
 * One sticker in the air between its slot and the tree. It is decoration: the log itself is
 * saved by a timer in the caller, so a dropped frame (or no frame at all) never loses it.
 * Only `transform` and `opacity` move, on a fixed layer above the page.
 */
export function StickerFlight({
  flight,
  onDone,
}: {
  flight: Flight;
  onDone: (id: number) => void;
}) {
  const frames = useMemo(
    () => flightFrames(flight.from, flight.to, flight.back),
    [flight.from, flight.to, flight.back],
  );
  const half = flight.size / 2;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-(--z-toast) will-change-transform"
      style={{ marginLeft: -half, marginTop: -half }}
      initial={{
        x: frames.x[0],
        y: frames.y[0],
        scale: frames.scale[0],
        rotate: frames.rotate[0],
        opacity: frames.opacity[0],
      }}
      animate={{
        x: frames.x,
        y: frames.y,
        scale: frames.scale,
        rotate: frames.rotate,
        opacity: frames.opacity,
      }}
      transition={{ duration: frames.duration, times: frames.times, ease: 'linear' }}
      onAnimationComplete={() => onDone(flight.id)}
    >
      <Sticker category={flight.category} size={flight.size} rotate={0} />
    </motion.div>
  );
}
