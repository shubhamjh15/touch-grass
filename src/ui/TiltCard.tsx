'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useFinePointer, useReducedMotion } from '@/lib/hooks';
import type { TiltBodyProps } from './TiltBody';

export interface TiltCardProps {
  /** Degrees per axis, at most 4. */
  maxTilt?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

// The moving half, once it has been fetched: later cards get it without waiting.
let loadedBody: ComponentType<TiltBodyProps> | null = null;

/**
 * Tilts its child toward the pointer (up to 4° per axis) and counter-shifts it up to 3 px, so the
 * hard shadow seems to stay on the table. Off on touch and under reduced motion. Reserved for four
 * objects: the passport, the share card, a badge in detail and the landing kit cards. One per viewport.
 *
 * The springs live in `TiltBody`, fetched when a card may first tilt; until it arrives (and
 * whenever tilting is off) the card lies flat.
 */
export function TiltCard({ maxTilt = 4, disabled = false, className, children }: TiltCardProps) {
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const active = fine && !reduced && !disabled;
  const limit = Math.min(Math.abs(maxTilt), 4);
  const [Body, setBody] = useState<ComponentType<TiltBodyProps> | null>(() => loadedBody);

  useEffect(() => {
    if (!active || Body) return undefined;
    let cancelled = false;
    void import('./TiltBody')
      .then((module) => {
        loadedBody = module.TiltBody;
        if (!cancelled) setBody(() => module.TiltBody);
      })
      // Offline or mid-deploy: the card simply stays flat.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active, Body]);

  if (!active || !Body) return <div className={className}>{children}</div>;

  return (
    <Body limit={limit} className={className}>
      {children}
    </Body>
  );
}
