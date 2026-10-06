'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** How long to wait for a lazily loaded page to render its heading. */
const HEADING_PATIENCE_MS = 4000;

const openDialog = () => document.querySelector('[role="dialog"][data-state="open"]');

/**
 * Moves keyboard and screen-reader focus to the new page's `h1`, so a route change is
 * announced and the next Tab starts at the top of the content. Returns a cancel function.
 */
function focusPageHeading(): () => void {
  let done = false;
  const tryFocus = (): boolean => {
    const heading = document.querySelector<HTMLElement>('#main h1, main h1');
    if (!heading) return false;
    // A sheet or the palette may have opened meanwhile: it owns focus.
    if (openDialog()) return true;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    return true;
  };

  if (tryFocus()) return () => undefined;

  const observer = new MutationObserver(() => {
    if (!done && tryFocus()) stop();
  });
  const timer = window.setTimeout(() => stop(), HEADING_PATIENCE_MS);
  function stop() {
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  return stop;
}

/**
 * What every navigation does besides showing the page: a new route starts at the top (Back
 * and Forward keep the position the browser restores), and focus lands on the page heading.
 * Renders nothing.
 */
export function RouteEffects() {
  const pathname = usePathname();
  const firstRender = useRef(true);
  const traversed = useRef(false);

  useEffect(() => {
    const onPop = () => {
      traversed.current = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    // The first page is the browser's business: it restores scroll and focus by itself.
    if (firstRender.current) {
      firstRender.current = false;
      return undefined;
    }
    const wasTraversal = traversed.current;
    traversed.current = false;
    if (!wasTraversal && !window.location.hash) window.scrollTo(0, 0);
    return focusPageHeading();
  }, [pathname]);

  return null;
}
