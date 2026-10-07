'use client';

import { useEffect, useState } from 'react';
import { gameActions, useOnboarding, useTreeStatus } from '@/game';
import { useReducedMotion } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { Button, Card } from '@/ui';
import { COACH_MARKS } from '../copy';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const sameBox = (a: Box | null, b: Box) =>
  a !== null &&
  a.top === b.top &&
  a.left === b.left &&
  a.width === b.width &&
  a.height === b.height;

/** Follows one element on screen: where it is now, in viewport pixels. */
function useTargetBox(target: string, reduced: boolean): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-coachmark="${target}"]`);
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const next = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      setBox((current) => (sameBox(current, next) ? current : next));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };
    // On a phone the card docks at the bottom, so the target goes to the top of the screen: it can
    // never sit under the card. On a desk it is centred, as the card lives in a corner.
    const behavior = reduced ? 'auto' : 'smooth';
    if (window.matchMedia('(min-width: 1024px)').matches) {
      el.scrollIntoView({ block: 'center', behavior });
    } else if (target === 'tree') {
      // The tree stands at the top of the stage: show the top of the page.
      window.scrollTo({ top: 0, behavior });
    } else {
      // Bring the target 84 px under the top edge, below the bars.
      el.style.scrollMarginTop = '84px';
      el.scrollIntoView({ block: 'start', behavior });
    }
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [target, reduced]);

  return box;
}

function Tour() {
  const tree = useTreeStatus();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const mark = COACH_MARKS[Math.min(step, COACH_MARKS.length - 1)] ?? COACH_MARKS[0];
  const box = useTargetBox(mark.target, reduced);
  const last = step >= COACH_MARKS.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') gameActions.markCoachMarksSeen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const next = () => {
    play('tap');
    if (last) gameActions.markCoachMarksSeen();
    else setStep(step + 1);
  };

  return (
    <>
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-(--z-sticky) rounded-lg outline-4 outline-offset-4 outline-focus outline-dashed"
          style={{
            width: box.width,
            height: box.height,
            transform: `translate(${box.left}px, ${box.top}px)`,
          }}
        />
      ) : null}
      {/* On a desk the card sits above the corner where receipts land, so a toast for the first
          logged action never covers Skip and Next. */}
      <Card
        as="section"
        role="region"
        aria-label="Quick tour"
        aria-live="polite"
        featured
        className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+var(--safe-b)+52px)] z-(--z-scrim) grid max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:items-center max-lg:gap-x-3 max-lg:gap-y-0.5 max-lg:p-3 lg:inset-x-auto lg:right-10 lg:bottom-28 lg:w-[380px] lg:gap-2"
      >
        <p className="type-slug text-ink-3 max-lg:col-start-1 max-lg:row-start-1">
          Quick tour · {step + 1} of {COACH_MARKS.length}
        </p>
        <h2 className="text-body font-bold text-ink max-lg:col-start-1 max-lg:row-start-2 lg:text-h4">
          {mark.title}
        </h2>
        <p className="text-caption text-ink-2 max-lg:col-start-1 max-lg:row-start-3 lg:text-body-sm">
          <span className="lg:hidden">{mark.short}</span>
          <span className="max-lg:hidden">{mark.body(tree.name)}</span>
        </p>
        <div className="flex items-center justify-between gap-3 max-lg:contents lg:mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="max-lg:col-start-2 max-lg:row-start-1 max-lg:h-8 max-lg:justify-self-end"
            onClick={() => gameActions.markCoachMarksSeen()}
          >
            Skip the tour
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="max-lg:col-start-2 max-lg:row-span-2 max-lg:row-start-2"
            onClick={next}
          >
            {last ? 'Got it' : 'Next'}
          </Button>
        </div>
      </Card>
    </>
  );
}

/** The three pointers of the first day. Shown once; gone for good after "Got it", Skip or Esc. */
export function CoachMarks() {
  const { coachMarksSeen } = useOnboarding();
  return coachMarksSeen ? null : <Tour />;
}
