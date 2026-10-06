'use client';

import { useCallback, useRef, useState } from 'react';
import { buzz, play } from '@/lib/sfx';
import { emitPulse } from '@/world';
import { demoStatus, type DemoAction, type DemoStatus } from './model';

/** The demo is sped up, so every sticker gets a generous burst of leaves. */
const GROW_STRENGTH = 0.8;

export interface DemoState {
  /** Stickers stuck on the demo tree so far. */
  taps: number;
  status: DemoStatus;
  /** The sticker stuck on last: its estimate is the one the page shows. */
  last: DemoAction | null;
  stick: (action: DemoAction) => void;
}

/**
 * The landing page's demo tree. It lives in this component's memory only: nothing is written
 * to the saved game or to any browser storage, so "nothing is saved" is literally true.
 */
export function useDemo(): DemoState {
  const [taps, setTaps] = useState(0);
  const [last, setLast] = useState<DemoAction | null>(null);
  // The handler counts from a ref so it stays stable and two quick taps both count.
  const count = useRef(0);

  const stick = useCallback((action: DemoAction) => {
    const before = demoStatus(count.current);
    count.current += 1;
    const after = demoStatus(count.current);
    setTaps(count.current);
    setLast(action);

    play('stick');
    buzz(10);
    emitPulse({ kind: 'grow', strength: GROW_STRENGTH });
    if (after.stage !== before.stage) emitPulse({ kind: 'celebrate' });
  }, []);

  return { taps, status: demoStatus(taps), last, stick };
}
