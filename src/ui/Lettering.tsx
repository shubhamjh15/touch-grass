'use client';

import {
  useRef,
  type ComponentProps,
  type CSSProperties,
  type ElementType,
  type PointerEvent,
} from 'react';
import { cn } from '@/lib/cn';
import { useFinePointer, useReducedMotion } from '@/lib/hooks';
import { looseTag } from './polymorphic';
import { restTilt, SWATCH_VAR, type Hue } from './tokens';

export type LetteringFill = 'ink' | 'white' | Extract<Hue, 'green' | 'yellow' | 'pink' | 'blue'>;

/** Hover tilt is quantised to 12 fps: it reads as stop-motion, and spares glyph re-rasterisation. */
const FRAME_MS = 1000 / 12;

export type LetteringProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** At most 24 glyphs and two lines. Never a sentence inside the app. */
  children: string;
  fill?: LetteringFill;
  /** `rest`: a stable tilt picked from the text. `none`: flat (numerals, small sizes). */
  tilt?: 'rest' | 'none';
  /** Follows a fine pointer across the word. Off on touch and under reduced motion. */
  hoverTilt?: boolean;
  /** Entrance: one sweep from a steep tilt to rest (level-up, ceremony, landing hero). */
  sweep?: boolean;
  as?: ElementType;
};

/**
 * Sticker lettering: Tilt Warp with an ink outline, a white die-cut margin and a hard shadow, tilted
 * on the font's own XROT/YROT axes. Real text underneath; the die-cut layers are decorative.
 * Size it with a `text-display-*` class (never below 20 px).
 */
export function Lettering({
  children,
  fill = 'ink',
  tilt = 'rest',
  hoverTilt = false,
  sweep = false,
  as = 'span',
  className,
  style,
  ...rest
}: LetteringProps) {
  const Comp = looseTag(as);
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const lastFrame = useRef(0);
  const rest0 = tilt === 'rest' ? restTilt(children) : { xrot: 0, yrot: 0 };
  const live = hoverTilt && fine && !reduced;

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.timeStamp - lastFrame.current < FRAME_MS) return;
    lastFrame.current = event.timeStamp;
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    const nx = ((event.clientX - box.left) / box.width) * 2 - 1;
    const ny = ((event.clientY - box.top) / box.height) * 2 - 1;
    node.style.setProperty('--xrot', String(Math.round(-ny * 14)));
    node.style.setProperty('--yrot', String(Math.round(nx * 18)));
  };
  const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--xrot', String(rest0.xrot));
    event.currentTarget.style.setProperty('--yrot', String(rest0.yrot));
  };

  return (
    <Comp
      data-text={children}
      className={cn(
        'lettering',
        live &&
          '[transition:--xrot_var(--dur-slow)_var(--ease-out),--yrot_var(--dur-slow)_var(--ease-out)]',
        sweep && 'animate-sweep',
        className,
      )}
      style={
        {
          '--fill': SWATCH_VAR[fill],
          '--xrot': rest0.xrot,
          '--yrot': rest0.yrot,
          ...style,
        } as CSSProperties
      }
      onPointerMove={live ? onPointerMove : undefined}
      onPointerLeave={live ? onPointerLeave : undefined}
      {...rest}
    >
      {children}
    </Comp>
  );
}
