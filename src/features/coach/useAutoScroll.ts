'use client';

/**
 * Autoscroll that respects the reader. While the reader is at the latest message the view
 * follows new text; the moment they scroll up to read, it stops and a "Jump to latest"
 * button appears. Works for a scrolling box (the drawer) and for the document (the page).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Closer to the end than this counts as "reading the latest". */
const FOLLOW_WITHIN_PX = 72;

export interface AutoScrollOptions {
  /** The scrolling box. `null` scrolls the document. */
  container: RefObject<HTMLElement | null> | null;
  /** The element whose growth means "new text" (the message list). */
  content: RefObject<HTMLElement | null>;
  /** Changes whenever there is something new to follow (message count and length). */
  signal: string | number;
  /** Where the reader left this surface last time; `null` starts at the latest message. */
  initialOffset: number | null;
  /** Reports the reader's position: an offset while reading back, `null` while following. */
  onRest?: (offset: number | null) => void;
  /** Glide when jumping; never while following a stream (it would lag behind the text). */
  smooth?: boolean;
}

export interface AutoScroll {
  /** The reader scrolled away from the latest message. */
  away: boolean;
  /** Something arrived while they were away. */
  unseen: boolean;
  /** Go to the latest message and follow again. */
  jump: (animate?: boolean) => void;
}

interface Metrics {
  top: number;
  height: number;
  view: number;
}

export function useAutoScroll({
  container,
  content,
  signal,
  initialOffset,
  onRest,
  smooth = true,
}: AutoScrollOptions): AutoScroll {
  const following = useRef(initialOffset === null);
  const [away, setAway] = useState(initialOffset !== null);
  const [unseen, setUnseen] = useState(false);
  const rest = useRef(onRest);
  useEffect(() => {
    rest.current = onRest;
  }, [onRest]);

  const measure = useCallback((): Metrics => {
    const box = container?.current;
    if (box) return { top: box.scrollTop, height: box.scrollHeight, view: box.clientHeight };
    const root = document.documentElement;
    return { top: window.scrollY, height: root.scrollHeight, view: window.innerHeight };
  }, [container]);

  const scrollTo = useCallback(
    (top: number, animate: boolean) => {
      const options: ScrollToOptions = { top, behavior: animate ? 'smooth' : 'auto' };
      const box = container?.current;
      if (!box) window.scrollTo(options);
      // Setting the offset directly works everywhere; the glide is a nicety where it exists.
      else if (animate && typeof box.scrollTo === 'function') box.scrollTo(options);
      else box.scrollTop = top;
    },
    [container],
  );

  const toEnd = useCallback(
    (animate: boolean) => {
      const { height, view } = measure();
      scrollTo(Math.max(0, height - view), animate);
    },
    [measure, scrollTo],
  );

  // First paint: where the reader left off, or the latest message.
  useLayoutEffect(() => {
    if (initialOffset === null) toEnd(false);
    else scrollTo(initialOffset, false);
    // Only on mount: later positions belong to the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target: HTMLElement | Window = container?.current ?? window;
    const onScroll = () => {
      const { top, height, view } = measure();
      const atEnd = height - (top + view) <= FOLLOW_WITHIN_PX;
      following.current = atEnd;
      setAway(!atEnd);
      if (atEnd) setUnseen(false);
      rest.current?.(atEnd ? null : top);
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [container, measure]);

  // New text: follow it, or tell the reader it is there.
  const firstSignal = useRef(true);
  useLayoutEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    if (following.current) toEnd(false);
    else setUnseen(true);
  }, [signal, toEnd]);

  // Layout that grows without new text (a confirmation opening, a font arriving).
  useEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (following.current) toEnd(false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [content, toEnd]);

  const jump = useCallback(
    (animate = true) => {
      following.current = true;
      setAway(false);
      setUnseen(false);
      rest.current?.(null);
      toEnd(animate && smooth);
    },
    [smooth, toEnd],
  );

  return { away, unseen, jump };
}
