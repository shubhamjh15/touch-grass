'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { PointerEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SPRINGS } from './motion';

export interface TiltBodyProps {
  /** Degrees per axis, already limited by `<TiltCard>`. */
  limit: number;
  className?: string;
  children: ReactNode;
}

/**
 * The moving half of `<TiltCard>`: springs that follow the pointer. `<TiltCard>` fetches this
 * file the first time a card may actually tilt, so pages that show one do not wait for the
 * animation library, and touch devices never download it for this.
 */
export function TiltBody({ limit, className, children }: TiltBodyProps) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, SPRINGS.float);
  const y = useSpring(pointerY, SPRINGS.float);
  const rotateY = useTransform(x, [-1, 1], [-limit, limit]);
  const rotateX = useTransform(y, [-1, 1], [limit, -limit]);
  const shiftX = useTransform(x, [-1, 1], [3, -3]);
  const shiftY = useTransform(y, [-1, 1], [3, -3]);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - box.left) / box.width) * 2 - 1);
    pointerY.set(((event.clientY - box.top) / box.height) * 2 - 1);
  };
  const onPointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div
      className={cn('perspective-[900px]', className)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <motion.div className="transform-3d" style={{ rotateX, rotateY, x: shiftX, y: shiftY }}>
        {children}
      </motion.div>
    </div>
  );
}
