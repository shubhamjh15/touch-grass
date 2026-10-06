'use client';

import { Sprout } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { buzz, play } from '@/lib/sfx';
import { RingProgress } from '@/ui';

/** The ring fills in 1.5 s: six ticks, 250 ms apart, each a little higher than the last. */
export const HOLD_TICKS = 6;
export const HOLD_TICK_MS = 250;

export interface HoldButtonProps {
  /** Accessible name: "Press and hold to plant Fern." */
  label: string;
  /** Read after the name: how long, and that a one-press button exists. */
  hint: string;
  /** The hold ran its full length. Fires once. */
  onComplete: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * The seed button: press and hold, by touch, mouse, Space or Enter, and the ring around it
 * fills in six mechanical steps. Letting go early unwinds it. A hold is never the only way
 * to do something: the page always offers a plain button beside it.
 */
export function HoldButton({
  label,
  hint,
  onComplete,
  disabled = false,
  className,
}: HoldButtonProps) {
  const [ticks, setTicks] = useState(0);
  const [holding, setHolding] = useState(false);
  const hintId = useId();
  const timer = useRef<number | null>(null);
  const count = useRef(0);
  const done = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const release = useCallback(() => {
    if (done.current) return;
    clear();
    count.current = 0;
    setTicks(0);
    setHolding(false);
  }, [clear]);

  const press = useCallback(() => {
    if (disabled || done.current || timer.current !== null) return;
    setHolding(true);
    buzz(10);
    timer.current = window.setInterval(() => {
      count.current += 1;
      const reached = count.current;
      setTicks(reached);
      // The pitch climbs with the ring, so the ear knows how far along the hold is.
      play('tick', { rate: 1 + reached * 0.07 });
      if (reached >= HOLD_TICKS) {
        done.current = true;
        clear();
        setHolding(false);
        onCompleteRef.current();
      }
    }, HOLD_TICK_MS);
  }, [clear, disabled]);

  useEffect(() => clear, [clear]);

  return (
    <button
      type="button"
      aria-label={label}
      aria-describedby={hintId}
      aria-disabled={disabled || undefined}
      data-pressed={holding || ticks >= HOLD_TICKS}
      className={cn(
        'relative grid size-24 shrink-0 hard touch-none place-items-center rounded-full select-none lift-5',
        className,
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(event) => {
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
          event.preventDefault();
          press();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') release();
      }}
      onBlur={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span aria-hidden="true" className="contents">
        <RingProgress
          value={ticks}
          max={HOLD_TICKS}
          size={96}
          tone="green"
          label=""
          keepChildren
          role="presentation"
        >
          <span className="grid size-[58px] place-items-center rounded-full bg-ink text-white">
            <Sprout size={28} strokeWidth={2.25} />
          </span>
        </RingProgress>
      </span>
      <span id={hintId} className="sr-only">
        {hint}
      </span>
    </button>
  );
}
