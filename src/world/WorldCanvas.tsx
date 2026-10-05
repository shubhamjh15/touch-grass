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
 * Mounted once by the root layout and never unmounted: the fixed backdrop (page tint
 * and printed sky) and, on capable devices, the WebGL canvas that renders the Grove.
 * It decides between 3D and the illustrated fallback; everything heavy is lazy.
 */
export function WorldCanvas() {
  const preference = useWorldStore((state) => state.preference);
  const [support] = useState(detectSupport);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  const backdrop = useRef<HTMLDivElement>(null);
  const sky = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
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
    if (!backdrop.current || !sky.current || !scene.current) return;
    return startTracker({ backdrop: backdrop.current, sky: sky.current, scene: scene.current });
  }, []);

  return (
    <div
      ref={backdrop}
      aria-hidden="true"
      // `lvh`, not `inset-0`: the box must not resize (and reallocate the drawing buffer)
      // every time a mobile URL bar slides away.
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-lvh overflow-hidden bg-(--sky-page)"
    >
      <WorldSky ref={sky} />
      <div ref={scene} className="absolute inset-0 opacity-0">
        {use3d && (
          <SceneBoundary onError={fail}>
            <Suspense fallback={null}>
              <WorldScene onFail={fail} />
            </Suspense>
          </SceneBoundary>
        )}
      </div>
    </div>
  );
}
