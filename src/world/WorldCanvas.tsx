import { useEffect } from 'react';
import { useWorldStore } from './store';

/**
 * Mounted once by the root layout and never unmounted: the fixed backdrop and,
 * on capable devices, the WebGL canvas that renders the Grove.
 *
 * Placeholder: reports `fallback` so every stage draws the illustrated tree.
 */
export function WorldCanvas() {
  useEffect(() => {
    useWorldStore.getState().setStatus('fallback');
    document.documentElement.dataset.world = 'fallback';
  }, []);

  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
