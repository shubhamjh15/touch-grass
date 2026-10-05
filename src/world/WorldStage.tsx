import { useEffect, useId, useMemo, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { WorldStageProps } from './contract';
import { FallbackTree } from './FallbackTree';
import { useWorldStore, type StageOptions } from './store';

/**
 * Reserves a box in the page for the Grove. The persistent 3D world flies to the
 * active stage, scales to fit it and follows it on scroll. When 3D is unavailable
 * the stage draws an illustrated tree in the same box, so layouts never change.
 */
export function WorldStage({
  mode = 'companion',
  preview,
  interactive,
  landmarks = false,
  onLandmark,
  fit = 0.86,
  anchor = 'bottom',
  priority = 0,
  sky,
  label,
  className,
  children,
}: WorldStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const status = useWorldStore((state) => state.status);
  const snapshot = useWorldStore((state) => state.snapshot);

  // `preview` is usually an inline object; key it by value so effects stay quiet.
  const previewKey = preview ? JSON.stringify(preview) : '';
  const canInteract = interactive ?? (mode === 'hero' || mode === 'hub');
  const showSky = sky ?? mode !== 'companion';

  const onLandmarkRef = useRef(onLandmark);
  useEffect(() => {
    onLandmarkRef.current = onLandmark;
  }, [onLandmark]);

  const options = useMemo<StageOptions>(
    () => ({
      mode,
      preview: previewKey ? (JSON.parse(previewKey) as StageOptions['preview']) : null,
      interactive: canInteract,
      landmarks,
      onLandmark: (landmark) => onLandmarkRef.current?.(landmark),
      fit,
      anchor,
      priority,
      sky: showSky,
    }),
    [mode, previewKey, canInteract, landmarks, fit, anchor, priority, showSky],
  );

  const latestOptions = useRef(options);
  useEffect(() => {
    latestOptions.current = options;
    useWorldStore.getState().updateStage(id, options);
  }, [id, options]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { registerStage, setStageVisibility, unregisterStage } = useWorldStore.getState();
    registerStage(id, el, latestOptions.current);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry) setStageVisibility(id, entry.intersectionRatio);
      },
      { threshold: [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      unregisterStage(id);
    };
  }, [id]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label ?? 'Your tree'}
      data-world-stage={mode}
      className={cn('relative isolate', className)}
    >
      {status === 'fallback' && (
        <FallbackTree
          snapshot={{ ...snapshot, ...options.preview }}
          className="absolute inset-0 size-full"
        />
      )}
      {children}
    </div>
  );
}
