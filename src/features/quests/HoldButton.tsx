'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { Button } from '@/ui';

/** Product spec 4.6: a self-attested epic is confirmed by a 1.5-second hold. */
export const HOLD_MS = 1500;
/** One dry tick per quarter second, rising in pitch as the ring fills. */
const TICK_MS = 250;
/** Letting go early unwinds the ring over this long (matches the CSS transition below). */
const UNWIND_MS = 220;
/** A confirmed hold normally unmounts the button; if it is still there after this, it resets. */
const REARM_MS = 700;

const RADIUS = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface HoldButtonProps {
  /** Verb-first, e.g. "I actually did this". */
  label: string;
  /** What to say after an early release. */
  earlyHint: string;
  /** How to use it, read with the button: "Press and hold for a second and a half." */
  hint: string;
  onConfirm: () => void;
  /** Keeps the button focusable but inert, with the reason in a tooltip. */
  disabledReason?: string;
  holdMs?: number;
  className?: string;
}

/**
 * Hold to confirm: the ring fills while a pointer, Space or Enter is held, and unwinds if it
 * is let go early. A plain click never confirms, so a slip of the thumb cannot claim an epic.
 * The caller always offers an ordinary button beside it for switch and voice users.
 */
export function HoldButton({
  label,
  hint,
  earlyHint,
  onConfirm,
  disabledReason,
  holdMs = HOLD_MS,
  className,
}: HoldButtonProps) {
  const hintId = useId();
  const arc = useRef<SVGCircleElement>(null);
  const frame = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const ticks = useRef(0);
  const fired = useRef(false);
  const rearm = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [released, setReleased] = useState(false);
  const disabled = Boolean(disabledReason);

  const paint = useCallback((progress: number, animate: boolean) => {
    const circle = arc.current;
    if (!circle) return;
    circle.style.transition = animate ? `stroke-dashoffset ${UNWIND_MS}ms var(--ease-out)` : 'none';
    circle.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress));
  }, []);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    startedAt.current = null;
  }, []);

  const release = useCallback(() => {
    if (startedAt.current === null) return;
    stop();
    setHolding(false);
    if (fired.current) return;
    paint(0, true);
    setReleased(true);
  }, [paint, stop]);

  const begin = useCallback(() => {
    if (disabled || startedAt.current !== null || fired.current) return;
    const calm = prefersReducedMotion();
    startedAt.current = performance.now();
    ticks.current = 0;
    setHolding(true);
    setReleased(false);

    const step = (time: number) => {
      const began = startedAt.current;
      if (began === null) return;
      const elapsed = time - began;
      const due = Math.floor(elapsed / TICK_MS);
      if (due > ticks.current) {
        ticks.current = due;
        play('tick', { rate: 1 + due * 0.08 });
      }
      const progress = Math.min(1, elapsed / holdMs);
      // Calm motion: the ring advances in the same six steps as the ticks.
      paint(calm ? Math.min(1, (due * TICK_MS) / holdMs) : progress, false);
      if (progress >= 1) {
        fired.current = true;
        paint(1, false);
        stop();
        setHolding(false);
        onConfirm();
        // If the confirmation was refused the button is still here: make it usable again.
        rearm.current = window.setTimeout(() => {
          fired.current = false;
          paint(0, true);
        }, REARM_MS);
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [disabled, holdMs, onConfirm, paint, stop]);

  useEffect(
    () => () => {
      stop();
      if (rearm.current !== null) window.clearTimeout(rearm.current);
    },
    [stop],
  );

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    begin();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    // Space would otherwise scroll the page while it is held.
    event.preventDefault();
    if (!event.repeat) begin();
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') release();
  };

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Button
        variant="reward"
        size="lg"
        fullWidth
        disabledReason={disabledReason}
        aria-describedby={hintId}
        data-holding={holding || undefined}
        className="touch-pan-y select-none [-webkit-touch-callout:none]"
        onPointerDown={onPointerDown}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
          aria-hidden="true"
          className="-ml-1 shrink-0"
        >
          <circle
            cx="16"
            cy="16"
            r={RADIUS + 3}
            className="fill-white stroke-ink"
            strokeWidth="2.5"
          />
          <circle
            ref={arc}
            cx="16"
            cy="16"
            r={RADIUS}
            fill="none"
            className="stroke-green-deep"
            strokeWidth="5"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
            transform="rotate(-90 16 16)"
          />
        </svg>
        {label}
      </Button>
      <p id={hintId} className="text-caption text-ink-2">
        {hint}
      </p>
      <p role="status" className="sr-only">
        {released && !holding ? earlyHint : ''}
      </p>
    </div>
  );
}
