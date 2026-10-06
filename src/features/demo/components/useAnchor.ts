'use client';

import { useEffect, useState } from 'react';

/** How often the page is searched again while it keeps changing. */
const SEARCH_EVERY_MS = 200;

const onScreen = (rect: DOMRect): boolean =>
  rect.bottom > 0 &&
  rect.right > 0 &&
  rect.top < window.innerHeight &&
  rect.left < window.innerWidth;

/**
 * The element a hint should point at: the first match of the first selector that is laid
 * out (both navigations are always in the page; only one of them is displayed). Something
 * on screen beats something scrolled away.
 */
export function findAnchor(selectors: readonly string[]): HTMLElement | null {
  let scrolledAway: HTMLElement | null = null;
  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (onScreen(rect)) return element;
      scrolledAway ??= element;
    }
  }
  return scrolledAway;
}

/** True when the element stays put while the page scrolls (it sits in a fixed bar). */
export function isPinned(element: HTMLElement): boolean {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') return true;
  }
  return false;
}

/**
 * Follows the anchor of a hint while pages load, change and resize. Pages arrive lazily and
 * are replaced on navigation, so the search is repeated whenever the document changes, at
 * most a few times a second, and the result only changes when the element does.
 */
export function useAnchor(selectors: readonly string[], active: boolean): HTMLElement | null {
  const key = selectors.join('\n');
  const [found, setFound] = useState<{ key: string; element: HTMLElement | null }>({
    key,
    element: null,
  });

  useEffect(() => {
    if (!active || key === '') return undefined;
    const list = key.split('\n');
    let timer: number | undefined;
    const search = () => {
      timer = undefined;
      const element = findAnchor(list);
      setFound((current) =>
        current.key === key && current.element === element ? current : { key, element },
      );
    };
    const schedule = () => {
      timer ??= window.setTimeout(search, SEARCH_EVERY_MS);
    };
    timer = window.setTimeout(search, 0);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [key, active]);

  return active && found.key === key && found.element?.isConnected ? found.element : null;
}
