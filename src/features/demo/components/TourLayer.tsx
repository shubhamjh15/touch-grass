'use client';

import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCoachStore } from '@/ai';
import { ROUTES, normalizePath } from '@/app/routes';
import { gameEvents } from '@/game';
import { cn } from '@/lib/cn';
import { useBreakpoint } from '@/lib/hooks';
import { Button, UiLink } from '@/ui';
import { onWorldTap } from '@/world';
import { COPY } from '../copy';
import { leaveLink } from '../demo';
import { tourSend, useDemoStore } from '../demoStore';
import { TOUR_STEPS, tourStepNumber, type TourState, type TourStepId } from '../model/tour';
import { STAGE, stepView } from './tourSteps';
import { isPinned, useAnchor } from './useAnchor';

/** How far the ring stands off the thing it surrounds. */
const RING_OUTSET = 6;
/** How long a finished step stays before the tour moves on, so its effect can be watched. */
const MOVE_ON_MS: Record<TourStepId, number | null> = {
  world: 1600,
  log: 4200,
  // Impact is read, not done: it moves on when the visitor leaves the page or presses Next.
  impact: null,
  coach: 5000,
};

const TEXT_ENTRY =
  'input:not([type=checkbox],[type=radio],[type=range]),textarea,[contenteditable="true"]';

/** Turns what the visitor really does into the tour's `did` events. */
function useTourSignals(tour: TourState, path: string): void {
  const step = tour.status === 'running' ? tour.step : null;
  const did = tour.status === 'running' && tour.did;

  // 1. The world: a drag, a tap or an arrow key on the stage.
  useEffect(() => {
    if (step !== 'world' || did) return undefined;
    const done = () => tourSend({ type: 'did', step: 'world' });
    const onStage = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-world-stage]')) done();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key.startsWith('Arrow')) onStage(event);
    };
    document.addEventListener('pointerup', onStage, true);
    document.addEventListener('keydown', onKey, true);
    const offTap = onWorldTap(done);
    return () => {
      document.removeEventListener('pointerup', onStage, true);
      document.removeEventListener('keydown', onKey, true);
      offTap();
    };
  }, [step, did]);

  // 2. Logging: the game says so itself, wherever the log was made.
  useEffect(() => {
    if (step !== 'log' || did) return undefined;
    return gameEvents.on('action-logged', () => tourSend({ type: 'did', step: 'log' }));
  }, [step, did]);

  // 3. Impact: being on the page is the step; leaving it afterwards moves the tour on.
  useEffect(() => {
    if (step !== 'impact') return;
    if (path === ROUTES.impact) tourSend({ type: 'did', step: 'impact' });
    else if (did) tourSend({ type: 'next' });
  }, [step, did, path]);

  // 4. The coach: a question of the visitor's own.
  useEffect(() => {
    if (step !== 'coach' || did) return undefined;
    const questions = () =>
      useCoachStore.getState().messages.filter((message) => message.role === 'user').length;
    let asked = questions();
    return useCoachStore.subscribe(() => {
      const now = questions();
      if (now > asked) tourSend({ type: 'did', step: 'coach' });
      asked = now;
    });
  }, [step, did]);

  // A finished step lingers for a moment, then the next one begins.
  useEffect(() => {
    if (step === null || !did) return undefined;
    const wait = MOVE_ON_MS[step];
    if (wait === null) return undefined;
    const timer = window.setTimeout(() => tourSend({ type: 'next' }), wait);
    return () => window.clearTimeout(timer);
  }, [step, did]);
}

/** A touch keyboard is (very probably) open: a card docked at the bottom would sit on the field. */
function isTouchTyping(): boolean {
  const active = document.activeElement;
  if (!active?.matches(TEXT_ENTRY)) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * True while the tour should step aside: something modal is open (dialogs mark the rest of
 * the page `aria-hidden` and make it unclickable), or a touch keyboard is up.
 */
function useSetAside(layer: HTMLElement | null): boolean {
  const [aside, setAside] = useState(false);
  useEffect(() => {
    if (!layer) return undefined;
    // The topmost ancestor below <body> is the element dialogs hide.
    let root: HTMLElement = layer;
    while (root.parentElement && root.parentElement !== document.body) root = root.parentElement;
    const read = () =>
      setAside(layer.closest('[aria-hidden="true"], [inert]') !== null || isTouchTyping());
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['aria-hidden', 'inert'] });
    document.addEventListener('focusin', read);
    document.addEventListener('focusout', read);
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', read);
      document.removeEventListener('focusout', read);
    };
  }, [layer]);
  return aside;
}

interface Box {
  /** In window coordinates (the thing sits in a fixed bar) rather than page coordinates. */
  pinned: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: string;
}

const sameBox = (a: Box | null, b: Box | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.pinned === b.pinned &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.radius === b.radius);

/**
 * Where an element is, for something drawn on top of it. Nothing here runs on scroll: an
 * element in the page is measured in page coordinates and one on a fixed bar in window
 * coordinates, so the browser carries the drawing along by itself. It is measured again
 * only when a size or the layout changes.
 */
function useBox(element: HTMLElement | null, origin: HTMLElement | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    if (!element || !origin) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!element.isConnected) return;
      const rect = element.getBoundingClientRect();
      const pinned = isPinned(element);
      const from = pinned ? { left: 0, top: 0 } : origin.getBoundingClientRect();
      const next: Box = {
        pinned,
        x: Math.round(rect.left - from.left),
        y: Math.round(rect.top - from.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        radius: getComputedStyle(element).borderTopLeftRadius || '0px',
      };
      setBox((current) => (sameBox(current, next) ? current : next));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    schedule();
    const sizes = new ResizeObserver(schedule);
    sizes.observe(element);
    sizes.observe(document.documentElement);
    window.addEventListener('resize', schedule);
    // A page that is still sliding in reports where it is, not where it will rest.
    const settle = [250, 700, 1500].map((delay) => window.setTimeout(schedule, delay));
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      sizes.disconnect();
      window.removeEventListener('resize', schedule);
      settle.forEach((timer) => window.clearTimeout(timer));
    };
  }, [element, origin]);

  return element && box;
}

const NO_ANCHORS: readonly string[] = [];
const STAGE_SEAT: readonly string[] = [STAGE];

/**
 * The guided tour: one small card that says what to try, and a numbered ring on the thing
 * to try it with. There is no scrim and no focus trap; the page underneath stays fully
 * usable. The card keeps to a quiet seat so it never sits on the tree, a page's main action
 * or the tab bar: on a wide screen beside the island on Today and in the empty corner under
 * the grove elsewhere, on a phone as a thin strip above the tab bar.
 */
export function TourLayer() {
  const path = normalizePath(usePathname() ?? '/');
  const tour = useDemoStore((state) => state.tour);
  const focusTick = useDemoStore((state) => state.focusTick);
  const desktop = useBreakpoint('lg');
  const titleId = useId();
  const bodyId = useId();

  const [origin, setOrigin] = useState<HTMLDivElement | null>(null);
  const [card, setCard] = useState<HTMLElement | null>(null);
  const aside = useSetAside(origin);

  useTourSignals(tour, path);

  const running = tour.status === 'running' ? tour : null;
  const wrap = tour.status === 'wrap';
  const step = running?.step ?? null;
  const view = useMemo(() => (step ? stepView(step, path, desktop) : null), [step, path, desktop]);
  const shown = !aside && (wrap || view !== null);

  const target = useAnchor(view?.ring ? view.anchors : NO_ANCHORS, shown && !wrap);
  const ring = useBox(target, origin);
  // On Today a wide screen has room beside the island: the card sits there, in the page.
  const seated = desktop && path === ROUTES.today;
  const seat = useBox(useAnchor(seated ? STAGE_SEAT : NO_ANCHORS, shown), origin);
  const compact = !desktop && !wrap;
  const placed = !seated || seat !== null;

  // The card takes focus only when the visitor moved the tour with one of its own controls
  // (Next, Back, "Tour" in the banner): a step that arrives by itself must not pull focus
  // away from what the visitor is doing. It is announced instead.
  const lastFocus = useRef(focusTick);
  useEffect(() => {
    if (lastFocus.current === focusTick || !card?.isConnected || !placed) return;
    lastFocus.current = focusTick;
    card.focus({ preventScroll: !seated });
    if (seated) card.scrollIntoView({ block: 'nearest' });
  }, [focusTick, card, placed, seated]);

  const dismiss = useCallback(() => tourSend({ type: 'dismiss' }), []);

  // Escape closes the tour unless something else on the page is using the key.
  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const from = event.target instanceof Element ? event.target : null;
      const inCard = from !== null && card !== null && card.contains(from);
      if (!inCard) {
        if (from?.matches(TEXT_ENTRY)) return;
        if (document.querySelector('[role="menu"], [role="listbox"], [data-world-stage="explore"]'))
          return;
      }
      dismiss();
      if (inCard) document.querySelector<HTMLElement>('[data-demo-tour-button]')?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown, card, dismiss]);

  const number = step ? tourStepNumber(step) : TOUR_STEPS.length;
  const copy = view?.copy ?? null;
  const title = wrap ? COPY.tour.wrapTitle : (copy?.title ?? '');
  const body = wrap
    ? COPY.tour.wrapBody
    : copy === null
      ? ''
      : ((running?.did ? copy.done : undefined) ?? (compact ? copy.short : copy.body));
  const stepSpoken = COPY.tour.stepSpoken(number, TOUR_STEPS.length);

  return (
    <div ref={setOrigin} className="pointer-events-none absolute top-0 left-0 size-0">
      <p role="status" aria-live="polite" className="sr-only">
        {wrap ? `${title} ${body}` : copy ? `${stepSpoken}. ${title}. ${body}` : ''}
      </p>

      {shown && !wrap && ring ? (
        <span
          aria-hidden="true"
          className={cn(
            'top-0 left-0 z-35 border-3 border-dashed border-ink shadow-[0_0_0_3px_var(--color-yellow)]',
            ring.pinned ? 'fixed' : 'absolute',
          )}
          style={{
            translate: `${ring.x - RING_OUTSET}px ${ring.y - RING_OUTSET}px`,
            width: ring.width + RING_OUTSET * 2,
            height: ring.height + RING_OUTSET * 2,
            borderRadius: `calc(${ring.radius} + ${RING_OUTSET}px)`,
          }}
        >
          <span className="absolute -top-3 -left-3 grid size-6 place-items-center rounded-full border-2 border-ink bg-yellow font-mono text-[0.75rem] leading-none font-bold text-ink">
            {number}
          </span>
        </span>
      ) : null}

      {shown ? (
        <section
          key={wrap ? 'wrap' : `${step}|${path}`}
          ref={setCard}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          tabIndex={-1}
          data-demo-tour-card=""
          className={cn(
            'pointer-events-auto z-35 rounded-md border-3 border-ink bg-white text-ink flat-5',
            seated
              ? 'absolute top-0 left-0 w-84'
              : 'fixed right-3 bottom-[calc(var(--tabbar-h)+var(--safe-b)+44px)] left-3 lg:right-auto lg:bottom-6 lg:left-6 lg:w-84',
            compact ? 'py-2.5 pr-1.5 pl-3' : 'p-4',
            placed ? 'animate-stick calm:animate-none' : 'invisible',
          )}
          style={
            seated && seat
              ? {
                  // Left of the tree, level with the middle of what is on screen.
                  translate: `${seat.x + 40}px ${
                    seat.y + Math.round(Math.min(seat.height, window.innerHeight) * 0.38)
                  }px`,
                }
              : undefined
          }
        >
          {compact ? (
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="flex items-center gap-2 text-body-sm font-bold">
                  <span className="shrink-0 rounded-xs border-2 border-ink bg-yellow px-1.5 py-0.5 type-slug">
                    <span aria-hidden="true">{COPY.tour.step(number, TOUR_STEPS.length)}</span>
                    <span className="sr-only">{stepSpoken}</span>
                  </span>
                  <span>{title}</span>
                </h2>
                <p id={bodyId} className="mt-1 text-caption text-ink-2">
                  {body}
                </p>
              </div>
              <Button
                size="sm"
                variant="reward"
                className="shrink-0"
                onClick={() => tourSend({ type: 'next' })}
              >
                {COPY.tour.next}
              </Button>
              <button
                type="button"
                onClick={dismiss}
                aria-label={COPY.tour.skip}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full"
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2.5">
                {wrap ? null : (
                  <span className="mt-0.5 shrink-0 rounded-xs border-2 border-ink bg-yellow px-1.5 py-1 type-slug">
                    <span aria-hidden="true">{COPY.tour.step(number, TOUR_STEPS.length)}</span>
                    <span className="sr-only">{stepSpoken}</span>
                  </span>
                )}
                <h2 id={titleId} className="min-w-0 flex-1 text-h4">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label={COPY.tour.close}
                  className="-mt-2.5 -mr-2.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full fine:hover:bg-yellow-tint"
                >
                  <X size={18} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
              <p id={bodyId} className="mt-1 text-body-sm text-ink-2">
                {body}
              </p>
              {wrap ? (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                  <Button size="sm" variant="neutral" onClick={() => tourSend({ type: 'next' })}>
                    {COPY.tour.wrapStay}
                  </Button>
                  <Button asChild size="sm" variant="primary" iconRight={ArrowRight}>
                    <UiLink href={leaveLink('start')}>{COPY.banner.own}</UiLink>
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={dismiss}
                    className="mr-auto -ml-2 inline-flex h-11 cursor-pointer items-center rounded-sm px-2 text-button-sm text-ink-3 underline decoration-2 underline-offset-4 fine:hover:bg-yellow-tint fine:hover:text-ink"
                  >
                    {COPY.tour.skip}
                  </button>
                  {number > 1 ? (
                    <Button
                      size="sm"
                      variant="neutral"
                      icon={ArrowLeft}
                      onClick={() => tourSend({ type: 'back' })}
                    >
                      {COPY.tour.back}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="reward"
                    iconRight={ArrowRight}
                    onClick={() => tourSend({ type: 'next' })}
                  >
                    {COPY.tour.next}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
