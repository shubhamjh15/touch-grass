'use client';

import { useEffect, useState, type RefObject } from 'react';
import { gameActions } from '@/game';
import { clamp01 } from '@/lib/math';

/** A lesson counts as read once 80% of it has been scrolled past, or after 30 seconds open. */
export const READ_SCROLL_FRACTION = 0.8;
export const READ_OPEN_MS = 30_000;

/**
 * How far the reader is through a block of text, 0..1: 0 while its top is still at or below the
 * top of the viewport, 1 once its bottom edge has come into view. A block that fits the viewport
 * whole is finished as soon as all of it is visible.
 */
export function readingFraction(top: number, height: number, viewportHeight: number): number {
  if (height <= 0 || viewportHeight <= 0) return 0;
  const travel = height - viewportHeight;
  if (travel <= 0) return top + height <= viewportHeight ? 1 : 0;
  return clamp01(-top / travel);
}

function measure(element: HTMLElement | null): number {
  if (!element) return 0;
  const rect = element.getBoundingClientRect();
  return readingFraction(rect.top, rect.height, window.innerHeight);
}

/**
 * Reading progress through `target` as a whole percentage. Measured at most once per frame and
 * kept in whole percents, so the bar re-renders a hundred times at most, never per scroll event.
 */
export function useReadingProgress(target: RefObject<HTMLElement | null>): number {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setPercent(Math.round(measure(target.current) * 100));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [target]);

  return percent;
}

/**
 * Tells the store a lesson was opened, then marks it read when the reader has scrolled 80% of
 * the way through `target` or has had it open, with the tab visible, for 30 seconds. The scroll
 * rule only listens to real scrolling: a short lesson on a tall screen is not "read" on arrival.
 */
export function useLessonRead(
  slug: string | null,
  target: RefObject<HTMLElement | null>,
  alreadyRead: boolean,
): void {
  useEffect(() => {
    // The store ignores slugs it does not know; an unknown lesson records nothing.
    if (slug) gameActions.openLesson(slug);
  }, [slug]);

  useEffect(() => {
    if (!slug || alreadyRead) return undefined;

    let done = false;
    let visibleMs = 0;
    let since = document.visibilityState === 'visible' ? performance.now() : null;

    const finish = () => {
      if (done) return;
      done = true;
      gameActions.markLessonRead(slug);
    };
    const onScroll = () => {
      if (measure(target.current) >= READ_SCROLL_FRACTION) finish();
    };
    const tick = () => {
      const now = performance.now();
      if (since !== null) {
        visibleMs += now - since;
        since = now;
      }
      if (visibleMs >= READ_OPEN_MS) finish();
    };
    const onVisibility = () => {
      tick();
      since = document.visibilityState === 'visible' ? performance.now() : null;
    };

    const timer = window.setInterval(tick, 1000);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [slug, alreadyRead, target]);
}
