'use client';

import { useEffect } from 'react';
import { BRAND } from '@/lib/brand';

/** The same pattern as the metadata template of the route files: "Lesson name · Touch Grass". */
export function pageTitle(title: string): string {
  const text = title.trim();
  return text ? `${text} · ${BRAND.name}` : BRAND.name;
}

/**
 * Sets the document title from state. Static titles come from the `metadata` export of each
 * route file; a page calls this only when the title depends on data (the name of a lesson).
 * Pass `null` to leave the title of the route alone.
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (title === null || title === undefined) return undefined;
    const wanted = pageTitle(title);
    const path = window.location.pathname;
    document.title = wanted;

    // On a hard load the route's own <title> is committed after this effect has run (the
    // metadata streams in late, and React may swap the element) and would put the generic
    // route title back. Win that race, but only while this page is still the one on
    // screen: once the address changes the next route's title is the right one.
    const observer = new MutationObserver(() => {
      if (window.location.pathname === path && document.title !== wanted) document.title = wanted;
    });
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [title]);
}
