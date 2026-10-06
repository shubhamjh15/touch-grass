'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { clamp01 } from '@/lib/math';
import {
  TIMELAPSE_FRAMES,
  listProgress,
  pinnedProgress,
  timelapseAt,
  timelapseEngaged,
  type TimelapseMoment,
} from './model';

export interface Timelapse {
  /** The tall section; on phones its scroll distance is the time-lapse. */
  sectionRef: RefObject<HTMLElement | null>;
  /** The caption list; beside the desktop stage its scroll position is the time-lapse. */
  listRef: RefObject<HTMLOListElement | null>;
  moment: TimelapseMoment;
  /** The time-lapse currently owns the shared desktop stage (rather than the demo). */
  engaged: boolean;
}

/**
 * Turns the page's scroll position into a moment of the tree's first year. It only listens
 * and measures: the page scrolls natively, in both directions, and React re-renders at most
 * once per quantised step (60 across the whole time-lapse, 8 in the calm version).
 */
export function useTimelapse(desktop: boolean, still: boolean): Timelapse {
  const sectionRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  const [position, setPosition] = useState({ progress: 0, engaged: false });

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const target = desktop ? listRef.current : sectionRef.current;
      if (!target) return;
      const box = target.getBoundingClientRect();
      const raw = desktop
        ? listProgress(box, viewport, TIMELAPSE_FRAMES.length)
        : pinnedProgress(box, viewport);
      const engaged = desktop
        ? timelapseEngaged(raw, TIMELAPSE_FRAMES.length)
        : box.top < viewport && box.top + box.height > 0;
      const progress = clamp01(raw);
      const quantised = timelapseAt(progress, { still }).progress;
      setPosition((current) =>
        current.progress === quantised && current.engaged === engaged
          ? current
          : { progress: quantised, engaged },
      );
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [desktop, still]);

  const moment = useMemo(
    () => timelapseAt(position.progress, { still }),
    [position.progress, still],
  );

  return { sectionRef, listRef, moment, engaged: position.engaged };
}
