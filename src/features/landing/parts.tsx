'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from '@/lib/hooks';
import { Sticker } from '@/ui';
import { WorldStage, type WorldStageProps } from '@/world';
import { FLIGHT_LAND_MS, type DemoFlight } from './useDemo';

/**
 * A reserved box for a `WorldStage`. The box itself is plain server HTML with its size set
 * in CSS, so nothing shifts when the stage arrives; the stage is mounted only in the slot
 * that belongs to the current layout (phones and desktop place the tree differently, and a
 * hidden stage must never register with the world).
 */
export function StageSlot({
  show,
  className,
  onTouched,
  ...stage
}: Omit<WorldStageProps, 'className'> & {
  show: boolean;
  className?: string;
  /** The visitor pressed on the scene itself (not on a control floating over it). */
  onTouched?: () => void;
}) {
  return (
    <div className={cn('relative', className)} onPointerDown={onTouched}>
      {show ? <WorldStage {...stage} className="absolute inset-0" /> : null}
    </div>
  );
}

/**
 * Sticks its content in once, the first time a fifth of it is on screen (bible 7.9).
 * The server HTML is fully visible: only what is still below the fold when the page becomes
 * interactive is armed, so nothing visible ever blinks, and without JavaScript nothing hides.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  /** Stagger, in milliseconds, for siblings that arrive together. */
  delay?: number;
  as?: 'div' | 'li' | 'section';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return undefined;
    if (node.getBoundingClientRect().top < window.innerHeight) return undefined;
    node.dataset.reveal = 'armed';
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        node.dataset.reveal = 'in';
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      delete node.dataset.reveal;
    };
  }, []);

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node;
      }}
      className={cn('data-[reveal=armed]:opacity-0 data-[reveal=in]:animate-stick', className)}
      style={delay ? ({ animationDelay: `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

/** Slug, title and optional lead that open every section below the story. */
export function SectionHead({
  id,
  slug,
  title,
  lead,
  className,
}: {
  id: string;
  slug: string;
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <header className={cn('max-w-[46rem]', className)}>
      <p className="type-slug text-ink-3">{slug}</p>
      <h2 id={id} className="mt-3 text-h1 text-balance">
        {title}
      </h2>
      {lead ? <p className="mt-3 text-lead text-pretty text-ink-2">{lead}</p> : null}
    </header>
  );
}

/** Points along the carry: a quadratic arc whose control point sits 80 px above the midpoint. */
function arc(from: { x: number; y: number }, to: { x: number; y: number }, samples: number) {
  const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 80 };
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const linear = index / samples;
    // ease-in-out along the path, so the sticker leaves and arrives gently.
    const t = linear < 0.5 ? 2 * linear * linear : 1 - (-2 * linear + 2) ** 2 / 2;
    const u = 1 - t;
    xs.push(u * u * from.x + 2 * u * t * control.x + t * t * to.x);
    ys.push(u * u * from.y + 2 * u * t * control.y + t * t * to.y);
  }
  return { xs, ys };
}

const PEEL_MS = 140;
const PRESS_MS = 80;
const TOTAL_MS = FLIGHT_LAND_MS + PRESS_MS;
const SAMPLES = 8;
const HALF = 33;

/**
 * The log moment's flying sticker (bible 7.4): it peels off its slot, is carried to the
 * tree on an arc and pressed on. Purely decorative; the page does the same thing without it
 * under reduced motion.
 */
export function StickerFlight({
  flight,
  onLand,
  onEnd,
}: {
  flight: DemoFlight;
  onLand: (key: number) => void;
  onEnd: (key: number) => void;
}) {
  const { key, from, to, action } = flight;

  useEffect(() => {
    const timer = window.setTimeout(() => onLand(key), FLIGHT_LAND_MS);
    return () => window.clearTimeout(timer);
  }, [key, onLand]);

  const path = arc(from, to, SAMPLES);
  const carryTimes = path.xs.map(
    (_, index) => (PEEL_MS + ((FLIGHT_LAND_MS - PEEL_MS) * index) / SAMPLES) / TOTAL_MS,
  );
  const times = [0, ...carryTimes, 1];
  const x = [from.x, ...path.xs, to.x].map((value) => value - HALF);
  const y = [from.y, ...path.ys, to.y].map((value) => value - HALF);
  const scale = [1, ...path.xs.map((_, index) => 1.15 - (0.55 * index) / SAMPLES), 0.5];
  const rotate = [0, ...path.xs.map((_, index) => -8 + (14 * index) / SAMPLES), 6];
  const opacity = [1, ...path.xs.map(() => 1), 0];

  return createPortal(
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-(--z-fx)"
      initial={{ x: x[0], y: y[0], scale: 1, rotate: 0, opacity: 1 }}
      animate={{ x, y, scale, rotate, opacity }}
      transition={{ duration: TOTAL_MS / 1000, times, ease: 'linear' }}
      onAnimationComplete={() => {
        // The timer normally lands it first; this covers an animation that was cut short.
        onLand(key);
        onEnd(key);
      }}
    >
      <Sticker category={action.category} size={66} rotate={0} />
    </motion.div>,
    document.body,
  );
}
