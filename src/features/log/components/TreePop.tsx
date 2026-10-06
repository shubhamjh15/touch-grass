'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useProfile } from '@/game';
import { cn } from '@/lib/cn';
import { TreeGlyph } from '@/ui';
import { WorldStage, useWorldStore } from '@/world';

/** How long the thumbnail stays before it fades, and how long the fade takes. */
const HOLD_MS = 1500;
const FADE_MS = 360;

/**
 * The moment after a log: a small thumbnail of the tree pops in above the tab bar, holds, and
 * fades. Decoration only: the toast carries the words. Mount it with a fresh `key` per log;
 * it calls `onDone` when it has left.
 */
export function TreePop({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const species = useProfile().species;
  // With the 3D preview on, the live scene must not be pulled into a box this short-lived.
  const live = useWorldStore((state) => state.status === 'ready');

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const done = window.setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return createPortal(
    <div
      aria-hidden="true"
      data-tree-pop=""
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-b)+56px)] z-(--z-toast) flex justify-center lg:bottom-12"
    >
      <div
        className={cn(
          'grid size-28 animate-pop place-items-center overflow-hidden rounded-full border-2 border-ink bg-card transition-opacity duration-(--dur-slow) ease-out',
          leaving && 'opacity-0',
        )}
      >
        {live ? (
          <TreeGlyph species={species} className="text-green-deep" size={56} />
        ) : (
          <WorldStage mode="companion" className="size-24" />
        )}
      </div>
    </div>,
    document.body,
  );
}
