import { ColorBar } from '@/ui';

/**
 * Shown for the moment it takes a page's code to arrive: the page's own shape in plain blocks, so
 * nothing jumps when the real page replaces it. Static (no shimmer) so reduced motion needs no case.
 */
export function PageLoading() {
  return (
    <div aria-busy="true" className="grid min-h-[60dvh] content-start gap-5 pt-2">
      <ColorBar loading size="md" label="Loading the page" className="justify-self-start" />
      <div aria-hidden="true" className="grid gap-3">
        <div className="h-4 w-28 rounded-pill bg-mat-deep" />
        <div className="h-10 w-3/4 max-w-md rounded-md bg-mat-deep" />
        <div className="h-4 w-full max-w-lg rounded-pill bg-mat-deep" />
      </div>
      <div aria-hidden="true" className="h-40 rounded-lg bg-mat-deep" />
    </div>
  );
}
