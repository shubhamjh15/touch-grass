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
    if (title === null || title === undefined) return;
    document.title = pageTitle(title);
  }, [title]);
}
