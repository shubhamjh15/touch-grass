'use client';

import { BookOpen, ChartColumn, Expand, IdCard, Mail, Plus, Target } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { measureCallouts, registerCallouts, type CalloutElements } from './callouts';
import { STAGE_DEFAULTS } from './config';
import { LANDMARKS, type LandmarkId, type WorldStageProps } from './contract';
import { FallbackTree } from './FallbackTree';
import {
  clearPointer,
  createRectCache,
  emitTap,
  onWorldTap,
  orbit,
  setPointer,
} from './interaction';
import { LANDMARK_INFO, describeIsland, describePart, type PartRef } from './props/info';
import { openExplore, stickingPoint, useWorldStore, type StageOptions } from './store';

/** Label, icon and disc colour of each landmark's callout (bible 5.7). */
const CALLOUTS: Record<LandmarkId, { label: string; disc: string; icon: ReactNode }> = {
  log: { label: 'Log', disc: 'bg-green', icon: <Plus size={16} strokeWidth={2.6} /> },
  quests: { label: 'Quests', disc: 'bg-yellow', icon: <Target size={16} strokeWidth={2.6} /> },
  learn: { label: 'Learn', disc: 'bg-blue', icon: <BookOpen size={16} strokeWidth={2.6} /> },
  impact: { label: 'Impact', disc: 'bg-teal', icon: <ChartColumn size={16} strokeWidth={2.6} /> },
  community: { label: 'Community', disc: 'bg-pink', icon: <Mail size={16} strokeWidth={2.6} /> },
  coach: { label: 'Ask Moss', disc: 'bg-white', icon: <MossFace /> },
  me: { label: 'Passport', disc: 'bg-paper', icon: <IdCard size={16} strokeWidth={2.6} /> },
};

/** Moss, the coach: a moss ball with two dot eyes and one sprout. */
function MossFace() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 6c1-3 3-4 5-4-1 2-2 4-5 4Z" className="fill-lime stroke-ink" strokeWidth="1.2" />
      <circle cx="12" cy="14" r="8" className="fill-moss stroke-ink" strokeWidth="1.6" />
      <circle cx="9" cy="13" r="2" className="fill-white" />
      <circle cx="15" cy="13" r="2" className="fill-white" />
      <circle cx="9.3" cy="13.2" r="0.9" className="fill-ink" />
      <circle cx="15.3" cy="13.2" r="0.9" className="fill-ink" />
    </svg>
  );
}

const CHIP =
  'relative inline-flex h-9 hard items-center gap-2 rounded-pill border-3 border-ink bg-white pr-3.5 pl-1 text-body-sm font-bold whitespace-nowrap text-ink lift-3 after:absolute after:inset-x-0 after:-inset-y-1 md:h-10';

/** A stage that would only take focus from its own background, not from a control on it. */
const isControl = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest('button, a, input, select, textarea, label, [data-world-ignore]') !== null;

/** How long the note about a tapped prop stays up. */
const NOTE_MS = 4200;

interface Note {
  ref: PartRef;
  /** Where it was tapped, in pixels of the stage box. */
  x: number;
  y: number;
  /** A new tap on the same thing shows the note afresh. */
  stamp: number;
}

interface Drag {
  pointer: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startedAt: number;
  turning: boolean;
  touch: boolean;
}

/**
 * Reserves a box in the page for the world. The one persistent 3D world moves into the
 * active stage (its canvas becomes a child of the stage, so the page scrolls it like any
 * other element) and frames itself for the stage's mode. Until the 3D scene has drawn
 * (and for good when WebGL is unavailable or turned off) the stage draws the illustrated
 * tree in the same place, so a stage box is never empty.
 *
 * An interactive stage can be turned by dragging, with the arrow keys or by hovering;
 * a stage with `landmarks` carries one real button per landmark, tracked to the island.
 */
export function WorldStage(props: WorldStageProps) {
  return <Stage {...props} />;
}

/**
 * The stage itself. `exploring` is the one thing the public component cannot ask for: it
 * marks the full-screen stage of Explore mode (`WorldExplore.tsx`), where the camera is
 * free and can zoom.
 */
export function Stage({
  mode = 'companion',
  preview,
  interactive,
  landmarks = false,
  onLandmark,
  landmarkMeta,
  fit = STAGE_DEFAULTS[mode].fit,
  anchor = STAGE_DEFAULTS[mode].anchor,
  priority = 0,
  sky,
  explore = false,
  exploring = false,
  label,
  className,
  children,
}: WorldStageProps & { exploring?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const hintId = useId();
  const islandId = useId();
  const status = useWorldStore((state) => state.status);
  // There is one 3D world: it stands in the active stage, every other stage keeps its drawing.
  const active = useWorldStore((state) => state.activeStageId === id);
  const snapshot = useWorldStore((state) => state.snapshot);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // The illustrated tree stays for the length of its cross-fade once 3D is on screen.
  const [faded, setFaded] = useState(false);
  if (status !== 'ready' && faded) setFaded(false);

  // `preview` is usually an inline object; key it by value so effects stay quiet.
  const previewKey = preview ? JSON.stringify(preview) : '';
  const canInteract = interactive ?? (mode === 'hero' || mode === 'hub');
  const showSky = sky ?? mode !== 'companion';
  const live = status === 'ready' && active;
  const still = status === 'fallback';
  const operable = canInteract && live;

  const leads = onLandmark !== undefined;
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
      onLandmark: leads ? (landmark) => onLandmarkRef.current?.(landmark) : null,
      fit,
      anchor,
      priority,
      sky: showSky,
      explore: exploring,
    }),
    [mode, previewKey, canInteract, landmarks, leads, fit, anchor, priority, showSky, exploring],
  );

  const latestOptions = useRef(options);
  useEffect(() => {
    latestOptions.current = options;
    useWorldStore.getState().updateStage(id, options);
  }, [id, options]);

  // A layout effect, so the world leaves this stage while its element is still in the
  // page (the tracker measures where it was) and enters a new one before the next paint.
  useLayoutEffect(() => {
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
    // The illustrated tree and the callouts are laid out in pixels of the box.
    const measure = new ResizeObserver(() => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      setSize((current) =>
        current && current.width === width && current.height === height
          ? current
          : { width, height },
      );
      measureCallouts(id);
    });
    measure.observe(el);
    return () => {
      observer.disconnect();
      measure.disconnect();
      unregisterStage(id);
      if (useWorldStore.getState().activeStageId === id) orbit.dragEnd();
    };
  }, [id]);

  // --- Landmark callouts: registered once, then moved by the scene, outside React. ---
  const tracked = landmarks && live;
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = layer.current;
    if (!tracked || !root) return;
    const items: CalloutElements[] = [];
    for (const landmark of LANDMARKS) {
      const wrap = root.querySelector<HTMLElement>(`[data-callout="${landmark}"]`);
      const line = root.querySelector<SVGLineElement>(`[data-leader="${landmark}"]`);
      const dot = root.querySelector<SVGCircleElement>(`[data-dot="${landmark}"]`);
      if (!wrap || !line || !dot) return;
      items.push({ wrap, line, dot });
    }
    return registerCallouts(id, items);
  }, [id, tracked]);
  const metaKey = landmarkMeta ? JSON.stringify(landmarkMeta) : '';
  useEffect(() => {
    if (tracked) measureCallouts(id);
  }, [id, tracked, metaKey]);

  // --- Turning the island: pointer, keyboard, hover. The tracker steps the controller. ---
  const drag = useRef<Drag | null>(null);
  const [rectOf] = useState(createRectCache);
  const isActive = () => useWorldStore.getState().activeStageId === id;

  const endDrag = (el: HTMLElement, pointer: number) => {
    if (drag.current?.turning) {
      orbit.dragEnd();
      if (el.hasPointerCapture(pointer)) el.releasePointerCapture(pointer);
    }
    delete el.dataset.dragging;
    drag.current = null;
  };

  // --- Explore: two fingers pinch, the wheel zooms (there is no page to scroll there). ---
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const spread = () => {
    const [a, b] = [...fingers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  useEffect(() => {
    const el = ref.current;
    if (!exploring || !operable || !el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      orbit.zoomBy(Math.exp(Math.max(-120, Math.min(120, event.deltaY)) * 0.0022));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [exploring, operable]);

  // --- A tap on a prop or a landmark says what it is and what earned it. ---
  const [note, setNote] = useState<Note | null>(null);
  useEffect(() => {
    if (!operable) return;
    return onWorldTap((hit) => {
      const el = ref.current;
      const part = describePart(hit.part);
      if (!el || !part || useWorldStore.getState().activeStageId !== id) {
        setNote(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setNote({
        ref: part,
        x: hit.clientX - rect.left,
        y: hit.clientY - rect.top,
        stamp: performance.now(),
      });
    });
  }, [id, operable]);
  const noteStamp = note?.stamp;
  useEffect(() => {
    if (noteStamp === undefined) return;
    const timer = window.setTimeout(() => setNote(null), NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [noteStamp]);
  if (note && !operable) setNote(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!operable || event.button !== 0 || !isActive() || isControl(event.target)) return;
    if (exploring) {
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.current.size === 2) {
        // The second finger turns the drag into a pinch.
        if (drag.current) endDrag(event.currentTarget, drag.current.pointer);
        return;
      }
    }
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: event.timeStamp,
      turning: false,
      touch: event.pointerType !== 'mouse',
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const finger = fingers.current.get(event.pointerId);
    if (finger && fingers.current.size === 2) {
      const before = spread();
      finger.x = event.clientX;
      finger.y = event.clientY;
      const after = spread();
      if (before > 8 && after > 8) orbit.zoomBy(before / after);
      return;
    }
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) {
      // Hover parallax and hover hit-testing are for fine pointers only.
      if (operable && event.pointerType === 'mouse' && isActive()) {
        const rect = rectOf(el);
        const u = (event.clientX - rect.left) / Math.max(1, rect.width);
        const v = (event.clientY - rect.top) / Math.max(1, rect.height);
        orbit.hover(u * 2 - 1, v * 2 - 1);
        if (isControl(event.target)) clearPointer();
        else setPointer(u, v, event.clientX, event.clientY);
      }
      return;
    }
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.turning) {
      const travelX = Math.abs(event.clientX - current.startX);
      const travelY = Math.abs(event.clientY - current.startY);
      // A vertical swipe on a touch screen belongs to the page (`touch-action: pan-y`),
      // except in Explore, where there is no page to scroll and it tips the camera.
      if (exploring ? travelX + travelY < 5 : travelX < 5 || (current.touch && travelY > travelX))
        return;
      current.turning = true;
      el.setPointerCapture(event.pointerId);
      el.dataset.dragging = 'true';
      orbit.dragStart();
      setNote(null);
    }
    current.x = event.clientX;
    current.y = event.clientY;
    const rect = rectOf(el);
    orbit.dragMove(
      dx / Math.max(1, rect.width),
      current.touch && !exploring ? 0 : dy / Math.max(1, rect.height),
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    fingers.current.delete(event.pointerId);
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const tapped = !current.turning && event.timeStamp - current.startedAt < 500;
    const rect = rectOf(event.currentTarget);
    endDrag(event.currentTarget, event.pointerId);
    if (tapped && isActive()) {
      emitTap(
        (event.clientX - rect.left) / Math.max(1, rect.width),
        (event.clientY - rect.top) / Math.max(1, rect.height),
        event.clientX,
        event.clientY,
      );
    }
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    fingers.current.delete(event.pointerId);
    if (drag.current?.pointer === event.pointerId) endDrag(event.currentTarget, event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only when the stage itself has the focus: buttons on it keep their own keys.
    if (!operable || event.target !== event.currentTarget || !isActive()) return;
    if (event.key === 'ArrowLeft') orbit.nudge(-1);
    else if (event.key === 'ArrowRight') orbit.nudge(1);
    else if (event.key === 'ArrowUp') orbit.lift(1);
    else if (event.key === 'ArrowDown') orbit.lift(-1);
    else if (event.key === 'Home') orbit.reset();
    else if (exploring && (event.key === '+' || event.key === '=')) orbit.zoomBy(0.82);
    else if (exploring && (event.key === '-' || event.key === '_')) orbit.zoomBy(1.22);
    else if (explore && !exploring && (event.key === 'e' || event.key === 'E')) openExplore();
    else return;
    event.preventDefault();
  };

  // Where a logged action lands while the illustrated tree stands in for the 3D one.
  const onPlaced = useCallback(
    (stick: { x: number; y: number }) => {
      const el = ref.current;
      const state = useWorldStore.getState();
      if (!el || state.status === 'ready' || state.activeStageId !== id) return;
      stickingPoint.el = el;
      stickingPoint.u = stick.x / Math.max(1, el.clientWidth);
      stickingPoint.v = stick.y / Math.max(1, el.clientHeight);
      stickingPoint.valid = true;
    },
    [id],
  );

  const group = landmarks || canInteract;
  const merged = useMemo(() => ({ ...snapshot, ...options.preview }), [snapshot, options.preview]);
  // Without WebGL the landmark buttons sit in a tidy grid under the illustrated tree.
  const grid = landmarks && still;
  const reserve = grid && size !== null && size.height >= 320 ? 104 : 0;

  const chip = (landmark: LandmarkId) => {
    const entry = CALLOUTS[landmark];
    const meta = landmarkMeta?.[landmark];
    return (
      <button
        type="button"
        className={CHIP}
        data-landmark={landmark}
        onClick={() => onLandmarkRef.current?.(landmark)}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink',
            entry.disc,
          )}
        >
          {entry.icon}
        </span>
        {entry.label}
        {meta ? <span className="type-tick text-ink-3">{meta}</span> : null}
      </button>
    );
  };

  return (
    <div
      ref={ref}
      role={group ? 'group' : 'img'}
      aria-label={label ?? 'Your tree'}
      aria-roledescription={operable ? 'rotatable scene' : undefined}
      aria-describedby={group ? (operable ? `${hintId} ${islandId}` : islandId) : undefined}
      tabIndex={operable ? 0 : undefined}
      data-world-stage={mode}
      data-world-growth={merged.growth.toFixed(4)}
      className={cn(
        'relative isolate',
        operable &&
          'cursor-grab focus-inset select-none data-world-hover:cursor-pointer data-[dragging=true]:cursor-grabbing',
        operable && (exploring ? 'touch-none' : 'touch-pan-y'),
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => {
        orbit.hover(null, null);
        clearPointer();
      }}
      onKeyDown={onKeyDown}
    >
      {/* The world layer (sky and canvas) is moved in here while this stage is active. */}
      <div
        data-world-host=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
      />
      {operable && (
        <span id={hintId} className="sr-only">
          Drag, or use the arrow keys, to look around the island. Home faces it front.
          {exploring ? ' Plus and minus zoom.' : ''}
          {explore && !exploring ? ' Press E to explore it full screen.' : ''} Tap anything on the
          island to hear what it is.
        </span>
      )}
      {group && (
        <span id={islandId} className="sr-only">
          {describeIsland(merged.props)}
        </span>
      )}
      {(!live || !faded) && size && (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 transition-opacity duration-200 ease-linear',
            live && 'opacity-0',
          )}
          style={{ bottom: reserve }}
          onTransitionEnd={() => {
            if (useWorldStore.getState().status === 'ready') setFaded(true);
          }}
        >
          <FallbackTree
            snapshot={merged}
            width={size.width}
            height={Math.max(8, size.height - reserve)}
            mode={mode}
            fit={fit}
            anchor={anchor}
            onPlaced={onPlaced}
            className="block"
          />
        </div>
      )}
      {tracked && (
        <div
          ref={layer}
          data-world-callouts="tracked"
          className="pointer-events-none absolute inset-0 z-10"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            className="absolute inset-0 size-full overflow-visible"
          >
            {LANDMARKS.map((landmark) => (
              <g key={landmark}>
                <line
                  data-leader={landmark}
                  className="stroke-ink"
                  strokeWidth="2"
                  style={{ visibility: 'hidden' }}
                />
                <circle
                  data-dot={landmark}
                  r="5"
                  className="fill-ink stroke-white"
                  strokeWidth="3"
                  paintOrder="stroke"
                  style={{ visibility: 'hidden' }}
                />
              </g>
            ))}
          </svg>
          {LANDMARKS.map((landmark) => (
            <span
              key={landmark}
              data-callout={landmark}
              className="pointer-events-auto absolute top-0 left-0 inline-flex will-change-transform"
              style={{ visibility: 'hidden' }}
            >
              {chip(landmark)}
            </span>
          ))}
        </div>
      )}
      {grid && (
        <div
          data-world-callouts="grid"
          className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center justify-center gap-2"
        >
          {LANDMARKS.map((landmark) => (
            <span key={landmark} className="inline-flex">
              {chip(landmark)}
            </span>
          ))}
        </div>
      )}
      {note && (
        <div
          key={note.stamp}
          data-world-note={note.ref.id}
          className="pointer-events-none absolute z-20 w-56 -translate-x-1/2"
          style={{
            left: Math.min(Math.max(note.x, 120), Math.max(120, (size?.width ?? 240) - 120)),
            // Above the finger when there is room, below it near the top edge.
            top: note.y > 132 ? note.y - 18 : note.y + 22,
          }}
        >
          <div className={cn(note.y > 132 && '-translate-y-full')}>
            <div
              role="status"
              className="pointer-events-auto flex flex-col gap-1 rounded-md border-3 border-ink bg-white px-3 py-2 text-ink shadow-2 motion-safe:animate-pop"
            >
              <span className="text-body-sm font-bold">{note.ref.info.name}</span>
              <span className="text-caption text-ink-2">{note.ref.info.note}</span>
              {note.ref.kind === 'landmark' && leads && (
                <button
                  type="button"
                  className="mt-1 inline-flex h-9 hard items-center justify-center rounded-pill border-2 border-ink bg-green px-3 text-body-sm font-bold text-ink lift-2"
                  onClick={() => {
                    const landmark = note.ref.id as LandmarkId;
                    setNote(null);
                    onLandmarkRef.current?.(landmark);
                  }}
                >
                  {LANDMARK_INFO[note.ref.id as LandmarkId].action}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {explore && !exploring && live && (
        <button
          type="button"
          data-world-explore=""
          className={cn(CHIP, 'absolute right-3 bottom-3 z-10 pl-3 lg:right-6 lg:bottom-6')}
          onClick={() => openExplore()}
        >
          <Expand size={16} strokeWidth={2.6} aria-hidden="true" />
          Explore
        </button>
      )}
      {children}
    </div>
  );
}
