import { useEffect, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { SKY_BAND_FLEX } from './config';
import { useWorldStore } from './store';

/**
 * The printed sky: four flat bands dithered into each other with halftone dots, a sun
 * or moon and a few clouds hanging on strings, and crop marks in the corners.
 *
 * It is plain CSS in a layer below the WebGL canvas. The tracker sizes and moves this
 * element to the active stage rectangle every frame, so the 3D tree occludes the sky
 * and page UI covers it. All colours come from the `--sky-*` custom properties.
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

const STARS: CSSProperties = {
  opacity: 'var(--sky-stars)',
  backgroundImage: [
    'radial-gradient(circle, var(--sky-cloud) 0 1px, transparent 1.6px)',
    'radial-gradient(circle, var(--sky-orb) 0 1.4px, transparent 2px)',
    'radial-gradient(circle, var(--sky-cloud) 0 0.8px, transparent 1.4px)',
  ].join(', '),
  backgroundSize: '97px 83px, 151px 127px, 61px 71px',
  backgroundPosition: '13px 9px, 71px 47px, 31px 53px',
};

const CLOUD_PATH =
  'M26 58a17 17 0 0 1 2-33.9a23 23 0 0 1 43.6-6.4a19 19 0 0 1 31.4 13.9a13.5 13.5 0 0 1-1 26.4Z';

interface HangingProps {
  /** Horizontal position and drop, as CSS lengths relative to the sky box. */
  left: string;
  drop: string;
  className?: string;
  sway: number;
  children: ReactNode;
}

/** Something hanging from the top edge on an ink string, swaying like a mobile. */
function Hanging({ left, drop, className, sway, children }: HangingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useWorldStore((state) => state.motion);

  useEffect(() => {
    const el = ref.current;
    const still =
      motion === 'reduced' ||
      (motion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!el || still || typeof el.animate !== 'function') return;
    const animation = el.animate(
      [{ transform: `rotate(${-sway}deg)` }, { transform: `rotate(${sway}deg)` }],
      {
        duration: 5200 + sway * 2400,
        direction: 'alternate',
        iterations: Infinity,
        easing: 'ease-in-out',
      },
    );
    return () => animation.cancel();
  }, [motion, sway]);

  return (
    <div
      ref={ref}
      className={cn(
        'absolute top-0 hidden origin-top flex-col items-center @min-[260px]:flex',
        className,
      )}
      style={{ left, height: drop }}
    >
      <div className="w-0.5 grow bg-(--sky-mark)" />
      <div className="w-full shrink-0">{children}</div>
    </div>
  );
}

function Cloud() {
  return (
    <svg viewBox="0 0 124 70" className="block w-full overflow-visible">
      <path d={CLOUD_PATH} className="fill-ink" transform="translate(5 5)" />
      <path
        d={CLOUD_PATH}
        fill="var(--sky-cloud)"
        className="stroke-ink"
        strokeWidth="4"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Sun by day, moon by night: a round sticker with its own die-cut border and shadow. */
function Orb() {
  return (
    <svg viewBox="0 0 72 72" className="block w-full overflow-visible">
      <circle cx="41" cy="41" r="30" className="fill-ink" />
      <circle cx="36" cy="36" r="30" className="fill-ink" />
      <circle cx="36" cy="36" r="28.5" className="fill-white" />
      <circle cx="36" cy="36" r="22" className="fill-ink" />
      <circle cx="36" cy="36" r="18.5" fill="var(--sky-orb)" />
      <g style={{ opacity: 'var(--sky-moon)' }} className="fill-ink/15">
        <circle cx="29" cy="31" r="4" />
        <circle cx="42" cy="42" r="5.5" />
        <circle cx="41" cy="27" r="2.5" />
      </g>
    </svg>
  );
}

const CROP_MARKS = [
  'top-2.5 left-2.5 border-t-[1.5px] border-l-[1.5px]',
  'top-2.5 right-2.5 border-t-[1.5px] border-r-[1.5px]',
  'bottom-2.5 left-2.5 border-b-[1.5px] border-l-[1.5px]',
  'right-2.5 bottom-2.5 border-r-[1.5px] border-b-[1.5px]',
];

export function WorldSky({ ref }: { ref: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className="@container absolute top-0 left-0 size-0 overflow-hidden opacity-0 will-change-transform"
    >
      <div className="absolute inset-0 flex flex-col bg-(--sky-0)">
        {SKY_BAND_FLEX.map((flex, index) => (
          <div
            key={flex}
            className="relative bg-(--c)"
            style={{ '--c': `var(--sky-${index})`, flexGrow: flex } as CSSProperties}
          >
            {index > 0 && <div className="absolute inset-x-0 bottom-full" style={HALFTONE} />}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 h-[55%]" style={STARS} />

      <Hanging
        left="var(--sky-orb-x)"
        drop="var(--sky-orb-y)"
        sway={0.7}
        className="w-[11%] max-w-20 min-w-9 -translate-x-1/2"
      >
        <Orb />
      </Hanging>
      <Hanging left="9%" drop="27%" sway={1.3} className="w-[17%] max-w-36 min-w-12">
        <Cloud />
      </Hanging>
      <Hanging left="41%" drop="13%" sway={1.7} className="w-[9%] max-w-20 min-w-9">
        <Cloud />
      </Hanging>
      <Hanging left="80%" drop="38%" sway={1} className="w-[12%] max-w-24 min-w-10">
        <Cloud />
      </Hanging>

      {CROP_MARKS.map((position) => (
        <i
          key={position}
          className={cn(
            'absolute hidden size-3.5 border-(--sky-mark) @min-[200px]:block',
            position,
          )}
        />
      ))}
    </div>
  );
}
