import { BRAND } from '@/lib/brand';
import { LeafMark } from '@/ui';

/**
 * What is on screen until the saved state has been read: the leaf mark on the plain page
 * colour. It is part of the server's HTML for app routes and there is no timer in it.
 */
export function Splash() {
  return (
    <div
      role="status"
      aria-label={`${BRAND.name} is loading`}
      className="fixed inset-0 z-(--z-fx) grid place-items-center bg-mat"
    >
      <span className="grid size-14 place-items-center rounded-lg border-2 border-ink bg-green">
        <LeafMark size={32} />
      </span>
    </div>
  );
}
