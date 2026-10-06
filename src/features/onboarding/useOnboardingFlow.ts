'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GRID_BY_ID } from '@/data/catalogue';
import { gameActions, getGameState, useGameRuntime, useOnboarding } from '@/game';
import { randomSeed } from '@/lib/rng';
import { clearDraft, loadDraft, readDemoSpecies, saveDraft } from './draft';
import {
  blockerOf,
  createDraft,
  engineStep,
  isScreenId,
  nextScreen,
  previousScreen,
  reachable,
  reduceDraft,
  screenOfStep,
  screensFor,
  type DraftAction,
  type FlowContext,
  type OnboardingDraft,
  type ScreenId,
} from './flow';

/** Marks a history entry as one of the flow's screens, so the browser's Back walks the flow. */
interface Marker {
  tgStart: ScreenId;
  /** How many entries this visit has pushed before this one: 0 means Back would leave the flow. */
  tgDepth: number;
}

function readMarker(state: unknown): Marker | null {
  if (typeof state !== 'object' || state === null) return null;
  const record = state as Record<string, unknown>;
  if (!isScreenId(record.tgStart)) return null;
  const depth = typeof record.tgDepth === 'number' && record.tgDepth > 0 ? record.tgDepth : 0;
  return { tgStart: record.tgStart, tgDepth: depth };
}

function writeMarker(mode: 'push' | 'replace', marker: Marker): void {
  try {
    if (mode === 'push') window.history.pushState({ ...marker }, '');
    else window.history.replaceState({ ...marker }, '');
  } catch {
    // Some embedded browsers refuse history writes; the on-screen Back button still works.
  }
}

function initialDraft(): OnboardingDraft {
  const saved = loadDraft();
  if (saved) return saved;
  const { profile, onboarding } = getGameState();
  const draft = createDraft({
    nameSeed: randomSeed(),
    region: GRID_BY_ID.get(profile.region)?.id,
    species: readDemoSpecies(),
  });
  // The draft is gone (storage was cleared) but the game remembers how far the user got.
  return { ...draft, screen: screenOfStep(onboarding.step) };
}

export interface OnboardingFlow {
  draft: OnboardingDraft;
  /** The screen on show: the draft's, or an earlier one that still needs an answer. */
  screen: ScreenId;
  /** +1 when the last move went forward, -1 when it went back. */
  direction: 1 | -1;
  context: FlowContext;
  /** How many old logs can be brought along (0 when none were found). */
  legacyLogs: number;
  /** False when nothing typed here survives a reload (private window, storage full). */
  persisted: boolean;
  canGoBack: boolean;
  /** Change an answer. Never moves between screens. */
  change: (action: Exclude<DraftAction, { type: 'go' }>) => void;
  /** Move on if the current screen is complete. Returns the reason when it is not. */
  next: () => string | null;
  /** Jump to a screen of this run (a new history entry). */
  goTo: (screen: ScreenId) => void;
  back: () => void;
  /** The tree is planted: forget the draft and stop following the history. */
  finish: () => void;
}

/**
 * The state of the first-run flow: the draft, the screen on show, and navigation that keeps
 * the saved draft, the game's resume step and the browser history in step with each other.
 */
export function useOnboardingFlow(): OnboardingFlow {
  const [draft, setDraft] = useState(initialDraft);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saved, setSaved] = useState(true);

  const onboarding = useOnboarding();
  const runtime = useGameRuntime();
  const legacyLogs = runtime.legacy?.status === 'real' ? runtime.legacy.logs : 0;
  const legacyOffered = onboarding.legacy === 'offered' && legacyLogs > 0;
  const context = useMemo<FlowContext>(() => ({ legacyOffered }), [legacyOffered]);

  const screen = reachable(draft.screen, draft, context);

  // Handlers run between renders, sometimes twice in one event: they read and write these.
  const draftRef = useRef(draft);
  const contextRef = useRef(context);
  const depthRef = useRef(0);
  const finishedRef = useRef(false);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const commit = useCallback((next: OnboardingDraft) => {
    if (next === draftRef.current) return;
    draftRef.current = next;
    setDraft(next);
    setSaved(saveDraft(next));
  }, []);

  /** The draft as the user sees it: on the screen that is actually showing. */
  const current = useCallback((): OnboardingDraft => {
    const latest = draftRef.current;
    const shown = reachable(latest.screen, latest, contextRef.current);
    return shown === latest.screen ? latest : { ...latest, screen: shown };
  }, []);

  const show = useCallback(
    (target: ScreenId, from: ScreenId) => {
      const order = screensFor(draftRef.current, contextRef.current);
      setDirection(order.indexOf(target) < order.indexOf(from) ? -1 : 1);
      commit(reduceDraft(draftRef.current, { type: 'go', screen: target }));
      gameActions.setOnboardingStep(engineStep(target));
    },
    [commit],
  );

  const change = useCallback<OnboardingFlow['change']>(
    (action) => commit(reduceDraft(draftRef.current, action)),
    [commit],
  );

  const goTo = useCallback(
    (target: ScreenId) => {
      if (finishedRef.current) return;
      const from = current().screen;
      const allowed = reachable(target, draftRef.current, contextRef.current);
      if (allowed === from) return;
      depthRef.current += 1;
      writeMarker('push', { tgStart: allowed, tgDepth: depthRef.current });
      show(allowed, from);
    },
    [current, show],
  );

  const next = useCallback((): string | null => {
    const now = current();
    const blocker = blockerOf(now.screen, now);
    if (blocker) return blocker;
    const target = nextScreen(now, contextRef.current);
    if (target) goTo(target);
    return null;
  }, [current, goTo]);

  const back = useCallback(() => {
    if (finishedRef.current) return;
    const now = current();
    const target = previousScreen(now, contextRef.current);
    if (!target) return;
    if (depthRef.current > 0) {
      // The entry behind this one is the flow's own: let the browser walk back to it.
      window.history.back();
      return;
    }
    writeMarker('replace', { tgStart: target, tgDepth: 0 });
    show(target, now.screen);
  }, [current, show]);

  const finish = useCallback(() => {
    finishedRef.current = true;
    clearDraft();
  }, []);

  // Label the entry the user arrived on, then follow Back and Forward through the flow.
  useEffect(() => {
    const here = readMarker(window.history.state);
    depthRef.current = here?.tgDepth ?? 0;
    writeMarker('replace', { tgStart: current().screen, tgDepth: depthRef.current });

    const onPop = (event: PopStateEvent) => {
      const marker = readMarker(event.state);
      // Not one of ours: the user is leaving the flow, and the router takes it from here.
      if (!marker || finishedRef.current) return;
      depthRef.current = marker.tgDepth;
      const from = current().screen;
      const target = reachable(marker.tgStart, draftRef.current, contextRef.current);
      if (target !== marker.tgStart)
        writeMarker('replace', { tgStart: target, tgDepth: marker.tgDepth });
      if (target !== from) show(target, from);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [current, show]);

  const canGoBack = previousScreen({ ...draft, screen }, context) !== null;

  return {
    draft,
    screen,
    direction,
    context,
    legacyLogs,
    persisted: saved && runtime.storage !== 'memory',
    canGoBack,
    change,
    next,
    goTo,
    back,
    finish,
  };
}
