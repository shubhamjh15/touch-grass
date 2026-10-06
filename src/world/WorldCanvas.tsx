'use client';

import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useWorldStore } from './store';
import { detectSupport, resolveQuality } from './support';
import { startTracker } from './tracker';
import { WorldExplore } from './WorldExplore';
import { WorldSky } from './WorldSky';

// three.js, R3F and every shader live behind this import: the main bundle stays light
// and the page paints before any 3D code is downloaded.
const WorldScene = lazy(() => import('./scene/WorldScene'));

/** A scene that fails to load or throws must never take the app down with it. */
class SceneBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Mounted once by the root layout and never unmounted: the one WebGL canvas that renders
 * the world, with the printed sky that stands in for it while it loads. Both sit in a
 * single "world layer" element which the tracker moves into whichever stage is active,
 * so the canvas is part of the page's own flow (native scrolling moves it) and is never
 * larger than the stage it shows. The WebGL context survives the moves, so the tree is
 * never rebuilt on navigation. This component also decides between 3D and the
 * illustrated fallback; everything heavy is lazy.
 */
export function WorldCanvas() {
  const preference = useWorldStore((state) => state.preference);
  const ready = useWorldStore((state) => state.status === 'ready');
  const [support] = useState(detectSupport);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  const backdrop = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const sky = useRef<HTMLDivElement>(null);
  const use3d = support.webgl2 && preference !== 'off' && !failed;

  useEffect(() => {
    const { setQuality, setStatus, status } = useWorldStore.getState();
    setQuality(resolveQuality(preference, support));
    // The scene itself reports `ready` once its first frame is on screen.
    if (!use3d) setStatus('fallback');
    else if (status !== 'ready') setStatus('loading');
  }, [preference, support, use3d]);

  useEffect(() => {
    const mirror = (status: string) => {
      if (status === 'idle') delete document.documentElement.dataset.world;
      else document.documentElement.dataset.world = status;
    };
    mirror(useWorldStore.getState().status);
    return useWorldStore.subscribe((state, previous) => {
      if (state.status !== previous.status) mirror(state.status);
    });
  }, []);

  useEffect(() => {
    if (!backdrop.current || !layer.current || !sky.current) return;
    return startTracker({ backdrop: backdrop.current, layer: layer.current, sky: sky.current });
  }, []);

  return (
    <>
      <WorldExplore />
      <div
        ref={backdrop}
        aria-hidden="true"
        // Where the layer waits between two stages. `lvh`, not `inset-0`: the box must not
        // resize every time a mobile URL bar slides away.
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-lvh overflow-hidden"
      >
        {/* Moved between stage hosts by the tracker; React only ever sees it here. */}
        <div ref={layer} className="absolute top-0 left-0 size-0 overflow-hidden opacity-0">
          {/* The 3D scene paints its own sky: the printed one is for loading and fallback. */}
          <WorldSky ref={sky} hidden={ready && use3d} />
          <div className="absolute inset-0">
            {use3d && (
              <SceneBoundary onError={fail}>
                <Suspense fallback={null}>
                  <WorldScene onFail={fail} adaptive={!support.software} />
                </Suspense>
              </SceneBoundary>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
