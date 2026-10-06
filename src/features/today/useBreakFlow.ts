'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BREAK_MIN_KEPT_MIN,
  game,
  gameActions,
  judgeBreak,
  useGameNow,
  useGameState,
  useTouchGrass,
  useTreeStatus,
  type BreakOutcome,
  type BreakStartResult,
  type TouchGrassStatus,
} from '@/game';
import { play } from '@/lib/sfx';
import { BREAK_COPY } from './copy';
import { breakSummary, type BreakSummary } from './model';

/**
 * - `idle`: no break; Today is Today.
 * - `away`: a break is running; the page shows the return time and little else.
 * - `returning`: "How was the sky?"
 * - `result`: what the engine decided, once, until it is closed.
 */
export type BreakPhase = 'idle' | 'away' | 'returning' | 'result';

export interface BreakFlow {
  phase: BreakPhase;
  status: TouchGrassStatus;
  /** The planned time of the running break is over. */
  timeUp: boolean;
  summary: BreakSummary | null;
  sheet: { open: boolean; minutes: number };
  openSheet: (minutes?: number | null) => void;
  closeSheet: () => void;
  start: (minutes: number) => BreakStartResult;
  /** "I'm back": on to the question. */
  comeBack: () => void;
  /** "End early": under ten minutes nothing is recorded; otherwise on to the question. */
  endEarly: () => void;
  answer: (outcome: BreakOutcome) => void;
  closeResult: () => void;
}

/**
 * Whether the planned time has passed. The break itself runs on wall-clock timestamps in
 * the store. The store's clock only ticks once a minute, so a timer covers the exact
 * moment, and a re-check when the tab comes back covers throttled background timers.
 */
function useTimeUp(endsAt: number | null): boolean {
  const now = useGameNow();
  const [upFor, setUpFor] = useState<number | null>(null);

  useEffect(() => {
    if (endsAt === null) return;
    const check = () => {
      if (game.now() >= endsAt) setUpFor(endsAt);
    };
    check();
    const timer = window.setTimeout(check, Math.max(0, endsAt - game.now()) + 50);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [endsAt]);

  return endsAt !== null && (upFor === endsAt || now >= endsAt);
}

/** Drives the Touch grass break on Today. All rules are the engine's; this is only the flow. */
export function useBreakFlow(): BreakFlow {
  const status = useTouchGrass();
  const tree = useTreeStatus();
  const active = useGameState((state) => state.activeBreak);
  const [sheet, setSheet] = useState<{ open: boolean; minutes: number | null }>({
    open: false,
    minutes: null,
  });
  const [returningFor, setReturningFor] = useState<number | null>(null);
  const [summary, setSummary] = useState<BreakSummary | null>(null);

  const endsAt = status.active?.endsAt ?? null;
  const timeUp = useTimeUp(endsAt);
  const returning = active !== null && returningFor === active.startTs;
  const phase: BreakPhase = active
    ? returning
      ? 'returning'
      : 'away'
    : summary
      ? 'result'
      : 'idle';

  // Time is up while the page is in view: a soft chime, and the tab says so.
  useEffect(() => {
    if (!timeUp) return;
    if (document.visibilityState === 'visible') play('chime');
    const title = document.title;
    document.title = BREAK_COPY.doneTitle;
    return () => {
      document.title = title;
    };
  }, [timeUp]);

  const openSheet = useCallback((minutes?: number | null) => {
    setSheet({ open: true, minutes: minutes ?? null });
  }, []);
  const closeSheet = useCallback(() => {
    setSheet((current) => ({ ...current, open: false }));
  }, []);

  const start = useCallback((minutes: number): BreakStartResult => {
    const result = gameActions.startTouchGrass(minutes);
    if (result.ok) {
      setSheet({ open: false, minutes: null });
      setSummary(null);
      setReturningFor(null);
    }
    return result;
  }, []);

  const finish = useCallback(
    (outcome: BreakOutcome, line?: string) => {
      const result = gameActions.finishTouchGrass(outcome);
      setReturningFor(null);
      if (!result.ok) return;
      const made = breakSummary(result, tree.name);
      setSummary(line ? { ...made, line } : made);
    },
    [tree.name],
  );

  const comeBack = useCallback(() => {
    if (active) setReturningFor(active.startTs);
  }, [active]);

  const endEarly = useCallback(() => {
    if (!active) return;
    const verdict = judgeBreak(active, game.now());
    if (!verdict.complete && verdict.elapsedMin < BREAK_MIN_KEPT_MIN) {
      finish('none', BREAK_COPY.tooShort);
      return;
    }
    setReturningFor(active.startTs);
  }, [active, finish]);

  const answer = useCallback((outcome: BreakOutcome) => finish(outcome), [finish]);
  const closeResult = useCallback(() => setSummary(null), []);

  return {
    phase,
    status,
    timeUp,
    summary,
    sheet: { open: sheet.open, minutes: sheet.minutes ?? status.suggestedMin },
    openSheet,
    closeSheet,
    start,
    comeBack,
    endEarly,
    answer,
    closeResult,
  };
}
