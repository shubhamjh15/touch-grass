'use client';

import { Camera, Home, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { play } from '@/lib/sfx';
import { ISLAND_PROPS, type LandmarkId } from './contract';
import { orbit } from './interaction';
import { PROP_INFO } from './props/info';
import { captureWorld, closeExplore, useWorldStore } from './store';
import { Stage } from './WorldStage';

/**
 * Explore mode: the world full screen. The one 3D world moves into this stage (it has
 * the highest priority while it is open), the camera swoops in, landmarks carry their
 * labels, and the user can turn, tilt and zoom freely, tap things to learn what they
 * are, and take a photo. It is a native modal dialog, so the page behind is inert, focus
 * stays inside, Escape closes it and focus returns to whatever opened it.
 *
 * Mounted once by `WorldCanvas`; opened with `openExplore()` from `@/world`.
 */

const ROUND =
  'inline-flex size-11 hard shrink-0 items-center justify-center rounded-full border-3 border-ink bg-white text-ink lift-3';

type PhotoState = 'idle' | 'busy' | 'saved' | 'shared' | 'failed';

const PHOTO_SAYS: Record<PhotoState, string> = {
  idle: '',
  busy: 'Taking a photo…',
  saved: 'Photo saved to your downloads.',
  shared: 'Photo ready to share.',
  failed: 'The photo could not be taken. Try again in a moment.',
};

function Tool({
  label,
  onPress,
  children,
  className,
  disabled,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(ROUND, 'disabled:opacity-60', className)}
      onClick={() => {
        play('tick');
        onPress();
      }}
    >
      {children}
    </button>
  );
}

async function takePhoto(): Promise<PhotoState> {
  const blob = await captureWorld({ width: 1600, height: 1200 });
  if (!blob) return 'failed';
  const name = `${BRAND.name.toLowerCase().replace(/\s+/g, '-')}-island.png`;
  const file = new File([blob], name, { type: 'image/png' });
  // Phones hand the picture to the share sheet; everything else downloads it.
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `My ${BRAND.name} island` });
      return 'shared';
    } catch {
      // Dismissing the share sheet is not a failure: fall through to the download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}

/** The camera's flash: one white blink over the stage, skipped under reduced motion. */
function shutter(el: HTMLDivElement | null): void {
  if (!el || typeof el.animate !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
}

function ExploreDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const leads = useWorldStore((state) => state.exploreLandmark);
  const ready = useWorldStore((state) => state.status === 'ready');
  const props = useWorldStore((state) => state.snapshot.props);
  const owned = ISLAND_PROPS.filter((id) => props.includes(id));
  const [photo, setPhoto] = useState<PhotoState>('idle');
  const [flash, setFlash] = useState(0);

  // A layout effect: its cleanup runs while the dialog is still in the page, so closing it
  // can hand the focus back to whatever opened Explore.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // jsdom has no modal dialogs; a plain open dialog is close enough for tests.
    if (!el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    }
    return () => {
      if (el.open && typeof el.close === 'function') el.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (photo === 'idle' || photo === 'busy') return;
    const timer = window.setTimeout(() => setPhoto('idle'), 4000);
    return () => window.clearTimeout(timer);
  }, [photo]);

  const onLandmark = (id: LandmarkId) => {
    closeExplore();
    leads?.(id);
  };

  const snap = () => {
    if (photo === 'busy') return;
    setPhoto('busy');
    setFlash((count) => count + 1);
    void takePhoto().then(setPhoto, () => setPhoto('failed'));
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Explore your island"
      data-world-explore="open"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-paper p-0 text-ink backdrop:bg-ink/40"
      onCancel={(event) => {
        event.preventDefault();
        closeExplore();
      }}
    >
      <Stage
        mode="hub"
        exploring
        interactive
        landmarks={leads !== null}
        onLandmark={leads ? onLandmark : undefined}
        priority={1000}
        fit={0.82}
        anchor="center"
        label="Your island, full screen"
        className="absolute inset-0"
      >
        <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-20 flex items-start justify-between gap-3 lg:inset-x-6 lg:top-6">
          <div className="grid max-w-[30ch] gap-2">
            <p className="rounded-md border-3 border-ink bg-white px-3 py-2 text-body-sm font-bold text-ink shadow-2">
              Your island
              <span className="mt-0.5 block text-caption font-medium text-ink-2">
                {ready
                  ? 'Drag to look around, pinch or scroll to zoom, tap anything to see what it is.'
                  : 'The 3D view is off, so this is the illustrated island.'}
              </span>
            </p>
            {/* The same facts a tap gives, for people who use a keyboard or a screen reader. */}
            <details className="pointer-events-auto w-fit max-w-full rounded-md border-3 border-ink bg-white text-ink shadow-2">
              <summary className="cursor-pointer px-3 py-2 text-body-sm font-bold select-none">
                What is here ({owned.length} of {ISLAND_PROPS.length})
              </summary>
              {owned.length === 0 ? (
                <p className="px-3 pb-2 text-caption text-ink-2">
                  Nothing yet. Props arrive as you earn badges.
                </p>
              ) : (
                <ul className="grid max-h-[40vh] gap-1.5 overflow-y-auto px-3 pb-2 text-caption text-ink-2">
                  {owned.map((id) => (
                    <li key={id}>
                      <span className="font-bold text-ink">{PROP_INFO[id].name}.</span>{' '}
                      {PROP_INFO[id].note}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </div>
          <button
            type="button"
            className={cn(ROUND, 'pointer-events-auto w-auto gap-2 px-4 text-body-sm font-bold')}
            onClick={() => {
              play('toggle', { on: false });
              closeExplore();
            }}
          >
            <X size={18} strokeWidth={2.6} aria-hidden="true" />
            Close
          </button>
        </div>
        {ready && (
          <div
            role="toolbar"
            aria-label="Camera"
            className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+14px)] z-20 flex flex-wrap items-center justify-center gap-2 px-3 lg:bottom-6"
          >
            <Tool label="Turn left" onPress={() => orbit.nudge(-1)}>
              <RotateCcw size={18} strokeWidth={2.6} aria-hidden="true" />
            </Tool>
            <Tool label="Turn right" onPress={() => orbit.nudge(1)}>
              <RotateCw size={18} strokeWidth={2.6} aria-hidden="true" />
            </Tool>
            <Tool label="Zoom out" onPress={() => orbit.zoomBy(1.25)}>
              <ZoomOut size={18} strokeWidth={2.6} aria-hidden="true" />
            </Tool>
            <Tool label="Zoom in" onPress={() => orbit.zoomBy(0.8)}>
              <ZoomIn size={18} strokeWidth={2.6} aria-hidden="true" />
            </Tool>
            <Tool label="Reset the view" onPress={() => orbit.reset()}>
              <Home size={18} strokeWidth={2.6} aria-hidden="true" />
            </Tool>
            <button
              type="button"
              disabled={photo === 'busy'}
              className={cn(
                ROUND,
                'w-auto gap-2 bg-yellow px-4 text-body-sm font-bold disabled:opacity-60',
              )}
              onClick={snap}
            >
              <Camera size={18} strokeWidth={2.6} aria-hidden="true" />
              Photo
            </button>
          </div>
        )}
        <p
          role="status"
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-20 mx-auto w-fit max-w-[90%] rounded-pill border-2 border-ink bg-white px-3 py-1 text-caption font-bold text-ink lg:bottom-22',
            photo === 'idle' && 'opacity-0',
          )}
        >
          {PHOTO_SAYS[photo]}
        </p>
        {flash > 0 && (
          <div
            key={flash}
            ref={shutter}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 bg-white opacity-0"
          />
        )}
      </Stage>
    </dialog>
  );
}

export function WorldExplore() {
  const exploring = useWorldStore((state) => state.exploring);
  return exploring ? <ExploreDialog /> : null;
}
