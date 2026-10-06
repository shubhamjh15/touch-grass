'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import { useBreakpoint } from '@/lib/hooks';
import { Meter } from '@/ui';
import { LEARN_COPY } from '../copy';

/**
 * True while a `position: sticky` element is pinned. The observer's root is pulled in by the
 * element's own `top` plus a pixel, so the element stops being fully inside it exactly when it
 * sticks. `layoutKey` re-reads the offset when the layout changes (the bar sits lower on desktop).
 */
function useStuck<T extends HTMLElement>(layoutKey: unknown) {
  const ref = useRef<T | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const top = Number.parseFloat(window.getComputedStyle(element).top) || 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top <= top + 1);
      },
      { threshold: 1, rootMargin: `${-(top + 1)}px 0px 0px 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [layoutKey]);

  return [ref, stuck] as const;
}

/**
 * The lesson's reading progress: a thin meter that sticks to the top of the screen (under the top
 * bar on desktop) on an opaque strip of mat. Its bottom rule is drawn only while it is stuck.
 */
export function ReadingProgress({ percent }: { percent: number }) {
  const desktop = useBreakpoint('lg');
  const [ref, stuck] = useStuck<HTMLDivElement>(desktop);

  return (
    <div
      ref={ref}
      className={cn(
        'sticky top-0 z-(--z-sticky) -mx-(--gutter) flex items-center gap-3 border-b-[1.5px] bg-mat px-(--gutter) py-2.5 lg:top-24',
        stuck ? 'border-ink' : 'border-transparent',
      )}
    >
      <Meter
        size="sm"
        tone="blue"
        value={percent}
        max={100}
        label={LEARN_COPY.readingLabel}
        valueText={LEARN_COPY.readingText(percent)}
        className="flex-1"
      />
      <span aria-hidden="true" className="w-9 shrink-0 text-right font-mono text-data-sm">
        {formatPercent(percent / 100)}
      </span>
    </div>
  );
}
