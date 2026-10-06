'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { prefersReducedMotion, useReducedMotion } from '@/lib/hooks';
import { DURATIONS, EASINGS } from '@/ui';

const PEEL_MS = DURATIONS.fast * 1000;
/** A very long page is not worth copying: the cost of cloning it would be felt as lag. */
const PEEL_MAX_NODES = 1500;
const PEEL_EASING = `cubic-bezier(${EASINGS.peel.join(',')})`;

/**
 * Peels a copy of the leaving page off the mat (bible 7.3, first 140 ms).
 *
 * The App Router swaps the page in one commit, so there is nothing left to animate out: this
 * takes a lifeless copy of the old page at the moment it is removed, pins it where it was on
 * screen and lifts it away up-left. The copy is inert, hidden from assistive tech and gone in
 * 140 ms; it never delays the new page.
 */
function peelAway(page: HTMLElement): void {
  if (typeof page.animate !== 'function') return;
  const rect = page.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  if (page.getElementsByTagName('*').length > PEEL_MAX_NODES) return;

  const frame = document.createElement('div');
  frame.setAttribute('aria-hidden', 'true');
  frame.inert = true;
  frame.dataset.routeGhost = '';
  frame.className = 'pointer-events-none fixed inset-0 z-(--z-content) overflow-hidden';

  const copy = page.cloneNode(true) as HTMLElement;
  copy.style.position = 'absolute';
  copy.style.top = `${rect.top}px`;
  copy.style.left = `${rect.left}px`;
  copy.style.width = `${rect.width}px`;
  copy.style.margin = '0';
  frame.append(copy);
  document.body.append(frame);

  const remove = () => frame.remove();
  // A hidden tab never finishes animations: the timer guarantees the copy cannot linger.
  const timer = window.setTimeout(remove, PEEL_MS + 120);
  const animation = copy.animate(
    [
      { opacity: 1, transform: 'translate(0, 0) rotate(0deg)' },
      { opacity: 0, transform: 'translate(-10px, -10px) rotate(-0.6deg)' },
    ],
    { duration: PEEL_MS, easing: PEEL_EASING, fill: 'forwards' },
  );
  animation.onfinish = () => {
    window.clearTimeout(timer);
    remove();
  };
}

function Page({ delay, children }: { delay: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    return () => {
      // Runs while the leaving page is still in the document, just before React removes it.
      if (node && node.isConnected && !prefersReducedMotion()) peelAway(node);
    };
  }, []);

  return (
    <motion.div
      ref={ref}
      data-route-page=""
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: -8, y: -8 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
      transition={
        reduced
          ? { duration: 0.15, ease: 'linear' }
          : { duration: DURATIONS.base, delay, ease: EASINGS.stick }
      }
    >
      {children}
    </motion.div>
  );
}

export interface RouteTransitionProps {
  /** Changes when the route does (the pathname). */
  routeKey: string;
  /**
   * The grove has to travel to a different stage (Today to a rail page and back): the new page
   * waits a little longer, so the plate is seen crossing the bare mat.
   */
  carry?: boolean;
  children: ReactNode;
}

/**
 * Route changes, per bible 7.3: the old page peels off (140 ms), the new one is stuck on
 * (220 ms, with one overshoot). Only `transform` and `opacity` move, so nothing shifts. Under
 * reduced motion both collapse into a 150 ms cross-fade. The first page of a visit does not
 * animate: it is simply there.
 */
export function RouteTransition({ routeKey, carry = false, children }: RouteTransitionProps) {
  const delay = carry ? DURATIONS.slow : DURATIONS.fast;
  return (
    <AnimatePresence initial={false}>
      <Page key={routeKey} delay={delay}>
        {children}
      </Page>
    </AnimatePresence>
  );
}
