import type { ReactNode } from 'react';

/**
 * A route change is a quick fade: the new page is keyed on the path, so it mounts fresh and
 * its starting style (transparent) eases to opaque. Pure CSS, opacity only; where starting
 * styles are not supported the page is simply there.
 */
export function RouteTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <div
      key={routeKey}
      data-route-page=""
      className="transition-opacity duration-(--dur-fast) ease-linear starting:opacity-0"
    >
      {children}
    </div>
  );
}
