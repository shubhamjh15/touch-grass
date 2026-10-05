'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { PointerEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFinePointer, useReducedMotion } from '@/lib/hooks';
import { SPRINGS } from './motion';

export interface TiltCardProps {
  /** Degrees per axis, at most 4. */
  maxTilt?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Tilts its child toward the pointer (up to 4° per axis) and counter-shifts it up to 3 px, so the
 * hard shadow seems to stay on the table. Off on touch and under reduced motion. Reserved for four
 * objects: the passport, the share card, a badge in detail and the landing kit cards. One per viewport.
 */
export function TiltCard({ maxTilt = 4, disabled = false, className, children }: TiltCardProps) {
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const active = fine && !reduced && !disabled;
  const limit = Math.min(Math.abs(maxTilt), 4);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, SPRINGS.float);
  const y = useSpring(pointerY, SPRINGS.float);
  const rotateY = useTransform(x, [-1, 1], [-limit, limit]);
  const rotateX = useTransform(y, [-1, 1], [limit, -limit]);
  const shiftX = useTransform(x, [-1, 1], [3, -3]);
  const shiftY = useTransform(y, [-1, 1], [3, -3]);

  if (!active) return <div className={className}>{children}</div>;

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
