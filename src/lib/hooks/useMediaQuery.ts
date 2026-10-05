import { useCallback, useSyncExternalStore } from 'react';

/** The bible's breakpoints (section 3.1), as min-width media queries. */
export const BREAKPOINTS = {
  sm: '(min-width: 30rem)',
  md: '(min-width: 48rem)',
  lg: '(min-width: 64rem)',
  xl: '(min-width: 80rem)',
  '2xl': '(min-width: 96rem)',
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Subscribes to a CSS media query. Prefer CSS (`md:` variants) for layout; use this only when the
 * component tree itself must change (a Modal that becomes a Sheet below `md`).
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

/** True from the given breakpoint up, e.g. `useBreakpoint('lg')` = the desktop shell. */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(BREAKPOINTS[breakpoint]);
}

/** True below `lg`: the tab-bar shell (phones and tablets). */
export function useIsMobile(): boolean {
  return !useMediaQuery(BREAKPOINTS.lg);
}

/** True when the primary pointer can hover precisely (mouse, trackpad). Tilt and hover flourishes only. */
export function useFinePointer(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}
