'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { prefersReducedMotion } from '@/lib/hooks';
import { Button } from '@/ui';
import { useShellStore } from '../shellStore';

/** How long the dialog stays when nobody dismisses it. */
const SHOW_MS = 6000;
const BURST_MS = 900;

/** One burst: where each piece lands (px from the centre of the card's top edge) and its turn. */
const PIECES: readonly { x: number; y: number; turn: number; ink: string }[] = [
  { x: -132, y: -58, turn: -160, ink: 'bg-green' },
  { x: -96, y: -104, turn: 120, ink: 'bg-yellow' },
  { x: -58, y: -72, turn: -90, ink: 'bg-blue' },
  { x: -28, y: -126, turn: 200, ink: 'bg-pink' },
  { x: 0, y: -84, turn: -140, ink: 'bg-green' },
  { x: 30, y: -130, turn: 160, ink: 'bg-yellow' },
  { x: 62, y: -70, turn: -110, ink: 'bg-pink' },
  { x: 98, y: -108, turn: 90, ink: 'bg-blue' },
  { x: 134, y: -54, turn: -200, ink: 'bg-green' },
  { x: -150, y: -18, turn: 140, ink: 'bg-blue' },
  { x: 152, y: -14, turn: -120, ink: 'bg-yellow' },
  { x: 0, y: -148, turn: 180, ink: 'bg-pink' },
];

/**
 * One confetti burst, run by the compositor (Web Animations on `transform` and `opacity`):
 * no canvas, no frame loop. The pieces are invisible at rest, so reduced motion shows none.
 */
function Confetti() {
  const host = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node || prefersReducedMotion()) return undefined;
    const animations: Animation[] = [];
    Array.from(node.children).forEach((child, index) => {
      const piece = PIECES[index];
      if (!piece || typeof child.animate !== 'function') return;
      animations.push(
        child.animate(
          [
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { opacity: 1, offset: 0.6 },
            {
              transform: `translate(${piece.x}px, ${piece.y + 36}px) rotate(${piece.turn}deg)`,
              opacity: 0,
            },
          ],
          { duration: BURST_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        ),
      );
    });
    return () => animations.forEach((animation) => animation.cancel());
  }, []);

  return (
    <span
      ref={host}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-1/2 size-0"
    >
      {PIECES.map((piece, index) => (
        <span key={index} className={cn('absolute size-2 rounded-xs opacity-0', piece.ink)} />
      ))}
    </span>
  );
}

/**
 * "Level 6", once, in a small card over the page. It is not modal: nothing behind it is
 * blocked, focus stays where it was, and it leaves by itself, on Esc, or on its button.
 */
export function LevelUpDialog() {
  const levelUp = useShellStore((state) => state.levelUp);
  const titleId = useId();

  useEffect(() => {
    if (!levelUp) return undefined;
    const close = () => useShellStore.getState().setLevelUp(null);
    const timer = window.setTimeout(close, SHOW_MS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [levelUp]);

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {levelUp ? `Level ${formatNumber(levelUp.level)}. ${levelUp.title}.` : ''}
      </p>
      {levelUp ? (
        <div className="pointer-events-none fixed inset-x-0 top-[18dvh] z-(--z-toast) flex justify-center px-gutter">
          <div
            key={levelUp.level}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className="pointer-events-auto relative grid w-full max-w-[320px] justify-items-center gap-1 rounded-lg border-2 border-ink bg-white p-6 text-center shadow-2 transition-[opacity,scale] duration-(--dur-base) ease-out starting:scale-95 starting:opacity-0"
          >
            <Confetti />
            <p className="text-body-sm font-semibold text-ink-3">Level up</p>
            <p id={titleId} className="text-[2.75rem]/[3rem] font-bold tracking-[-0.02em]">
              Level {formatNumber(levelUp.level)}
            </p>
            <p className="text-body text-ink-2">{levelUp.title}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => useShellStore.getState().setLevelUp(null)}
            >
              Keep going
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
