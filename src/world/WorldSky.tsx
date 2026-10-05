'use client';

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '@/lib/cn';
import { useWorldStore } from './store';

/**
 * The printed sky plate (design bible 5.3): four flat bands dithered into each other
 * with halftone dot rows, printed stars at night, and a hanging rig of paper cut-outs
 * on ink threads (sun or moon, clouds), with crop marks in the corners.
 *
 * It is plain CSS in a layer below the WebGL canvas. The tracker sizes and moves this
 * element to the active stage rectangle every frame, so the 3D tree occludes the sky
 * and page UI covers it. All colours come from the `--sky-*`, `--orb`, `--cloud` and
 * `--stage-mark` custom properties, which the tracker writes for the previewed hour.
 */

const DOT_RADII = [7.8, 6.2, 5, 3.9, 2.9, 1.9, 1];
const DOT_PITCH = 14;
const STRIP_HEIGHT = (DOT_RADII.length * DOT_PITCH) / 2;

/** Seven staggered rows of dots in the band's own colour, shrinking as they climb. */
const HALFTONE: CSSProperties = {
  height: STRIP_HEIGHT,
  backgroundImage: DOT_RADII.map(
    (radius) => `radial-gradient(circle, var(--c) 0 ${radius}px, transparent ${radius + 0.5}px)`,
  ).join(', '),
  backgroundSize: `${DOT_PITCH}px ${DOT_PITCH}px`,
  backgroundRepeat: 'repeat-x',
  backgroundPosition: DOT_RADII.map(
    (_, row) =>
      `${row % 2 ? DOT_PITCH / 2 : 0}px ${STRIP_HEIGHT - (row + 1.5) * (DOT_PITCH / 2)}px`,
  ).join(', '),
};

const dots = (color: string, radius: number) =>
  `radial-gradient(circle, ${color} 0 ${radius}px, transparent ${radius + 0.6}px)`;

const STARS: CSSProperties = {
  opacity: 'var(--sky-stars)',
  backgroundImage: [dots('var(--cloud)', 1), dots('var(--cloud)', 0.8)].join(', '),
  backgroundSize: '97px 83px, 61px 71px',
  backgroundPosition: '13px 9px, 31px 53px',
};

const BRIGHT_STARS: CSSProperties = {
  opacity: 'var(--sky-stars)',
  backgroundImage: dots('var(--star)', 1.5),
  backgroundSize: '151px 127px',
  backgroundPosition: '71px 47px',
};

/** Band heights, zenith to horizon: bleed below `lg`, bleed from `lg`, and the plate. */
const BANDS = [
  'grow-[15] lg:grow-[18] group-data-[frame=plate]:grow-[20]',
  'grow-[13] lg:grow-[20] group-data-[frame=plate]:grow-[20]',
  'grow-[13] lg:grow-[22] group-data-[frame=plate]:grow-[20]',
  'grow-[59] lg:grow-[40] group-data-[frame=plate]:grow-[40]',
];

const CLOUD_PATH =
  'M26 58a17 17 0 0 1 2-33.9a23 23 0 0 1 43.6-6.4a19 19 0 0 1 31.4 13.9a13.5 13.5 0 0 1-1 26.4Z';

const REDUCED = '(prefers-reduced-motion: reduce)';
const watchReduced = (notify: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};

/** True when puppets must hold still: the app's motion setting, or the OS preference. */
function useStillness(): boolean {
  const motion = useWorldStore((state) => state.motion);
  const system = useSyncExternalStore(
    watchReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  return motion === 'reduced' || (motion === 'system' && system);
}

interface HangingProps {
  /** Horizontal position and drop, as CSS lengths relative to the sky box. */
  left: string;
  drop: string;
  className?: string;
  /** Seconds of one bob. Every puppet has its own period, all above three seconds. */
  period: number;
  children: ReactNode;
}

/**
 * A paper cut-out hanging from the top edge on an ink thread. Puppets move like
 * stop-motion: a few pixels of bob and drift, stepped at 12 frames per second.
 */
function Hanging({ left, drop, className, period, children }: HangingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStillness();

  useEffect(() => {
    const el = ref.current;
    if (!el || still || typeof el.animate !== 'function') return;
    const bob = el.animate(
      [{ transform: 'translate(-6px, -3px)' }, { transform: 'translate(6px, 3px)' }],
      {
        duration: period * 1000,
        direction: 'alternate',
        iterations: Infinity,
        easing: `steps(${Math.round(period * 12)}, end)`,
      },
    );
    return () => bob.cancel();
  }, [period, still]);

  return (
    <div
      ref={ref}
      className={cn('absolute -top-2 hidden flex-col items-center @min-[220px]:flex', className)}
      style={{ left, height: `calc(${drop} + 0.5rem)` }}
    >
      <div className="w-[1.5px] grow bg-(--stage-mark)" />
      <div className="w-full shrink-0">{children}</div>
    </div>
  );
}

function Cloud() {
  return (
    <svg viewBox="0 0 124 70" className="block w-full overflow-visible">
      <path d={CLOUD_PATH} className="fill-ink" transform="translate(4 4)" />
      <path
        d={CLOUD_PATH}
        fill="var(--cloud)"
        className="stroke-ink"
        strokeWidth="3.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Sun by day, moon (with a crescent bite) by night: a round sticker with its own die-cut margin. */
function Orb() {
  return (
    <svg viewBox="0 0 72 72" className="block w-full overflow-visible">
      <circle cx="41" cy="41" r="30" className="fill-ink" />
      <circle cx="36" cy="36" r="30" className="fill-ink" />
      <circle cx="36" cy="36" r="28.5" className="fill-sticker" />
      <circle cx="36" cy="36" r="22" className="fill-ink" />
      <circle cx="36" cy="36" r="18" fill="var(--orb)" />
      <g style={{ opacity: 'var(--sky-moon)' }}>
        <circle cx="45" cy="29" r="13" className="fill-ink" />
        <circle cx="47" cy="27" r="12" className="fill-sticker" />
      </g>
    </svg>
  );
}

const CROP_MARKS = [
  'top-3 left-3 border-t-[1.5px] border-l-[1.5px] lg:top-7 lg:left-7',
  'top-3 right-3 border-t-[1.5px] border-r-[1.5px] lg:top-7 lg:right-7',
  'bottom-3 left-3 border-b-[1.5px] border-l-[1.5px] lg:bottom-7 lg:left-7',
  'right-3 bottom-3 border-r-[1.5px] border-b-[1.5px] lg:right-7 lg:bottom-7',
];

export function WorldSky({ ref }: { ref: Ref<HTMLDivElement> }) {
  const twinkle = useRef<HTMLDivElement>(null);
  const still = useStillness();

  useEffect(() => {
    const el = twinkle.current;
    if (!el || still || typeof el.animate !== 'function') return;
    const animation = el.animate([{ visibility: 'visible' }, { visibility: 'hidden' }], {
      duration: 3000,
      iterations: Infinity,
      easing: 'steps(2, jump-none)',
    });
    return () => animation.cancel();
  }, [still]);

  return (
    <div
      ref={ref}
      data-frame="bleed"
      className={cn(
        'group @container absolute top-0 left-0 size-0 overflow-hidden opacity-0 will-change-transform',
        // The plate is a printed card: an ink frame with a hard shadow, drawn by the sky itself.
        'data-[frame=plate]:border-4 data-[frame=plate]:border-ink data-[frame=plate]:shadow-3',
      )}
    >
      <div className="absolute inset-0 flex flex-col bg-(--sky-0)">
        {BANDS.map((grow, index) => (
          <div
            key={grow}
            className={cn('relative bg-(--c)', grow)}
            style={{ '--c': `var(--sky-${index})` } as CSSProperties}
          >
            {index > 0 && <div className="absolute inset-x-0 bottom-full" style={HALFTONE} />}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 h-[55%]" style={STARS} />
      <div ref={twinkle} className="absolute inset-x-0 top-0 h-[55%]" style={BRIGHT_STARS} />

      <Hanging
        left="var(--sky-orb-x)"
        drop="var(--sky-orb-y)"
        period={7}
        className="w-[12%] max-w-16 min-w-9 -translate-x-1/2"
      >
        <Orb />
      </Hanging>
      <Hanging left="7%" drop="30%" period={5} className="w-[18%] max-w-32 min-w-12">
        <Cloud />
      </Hanging>
      <Hanging left="66%" drop="47%" period={6.2} className="w-[14%] max-w-24 min-w-10">
        <Cloud />
      </Hanging>
      <Hanging
        left="36%"
        drop="14%"
        period={4.3}
        className="w-[11%] max-w-20 min-w-9 max-lg:hidden!"
      >
        <Cloud />
      </Hanging>

      {CROP_MARKS.map((position) => (
        <i
          key={position}
          className={cn(
            'absolute hidden size-3.5 border-(--stage-mark) group-data-[frame=bleed]:@min-[200px]:block',
            position,
          )}
        />
      ))}
    </div>
  );
}
