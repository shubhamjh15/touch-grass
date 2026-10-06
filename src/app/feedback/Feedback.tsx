'use client';

import {
  Award,
  CloudRain,
  Database,
  Flame,
  Sparkles,
  Sprout,
  Ticket,
  TreePalm,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { gameActions, useGameEvents, useProfile, useSettings, worldPulsesFor } from '@/game';
import { formatCo2Parts } from '@/lib/format';
import { useReducedMotion } from '@/lib/hooks';
import { play } from '@/lib/sfx';
import { Approx, dismissToast, toast } from '@/ui';
import { emitPulse } from '@/world';
import { ROUTES } from '../routes';
import { useShellStore } from '../shellStore';
import { Celebrations } from './Celebrations';
import { useCelebrationStore } from './celebrationStore';
import {
  planFeedback,
  type FeedbackPlan,
  type ToastAction,
  type ToastIcon,
  type ToastSpec,
} from './eventFeedback';
import { isQueuedPulse } from './plan';

const ICON: Record<ToastIcon, LucideIcon> = {
  xp: Sparkles,
  quest: Ticket,
  rain: CloudRain,
  streak: Flame,
  stage: Sprout,
  badge: Award,
  island: TreePalm,
  data: Database,
};

/** "≈1.02 kg CO2e · +30 XP": the estimate always leads, behind its glyph. */
function metaOf(spec: ToastSpec): ReactNode {
  if (spec.kg === undefined) return spec.meta;
  const { value, unit } = formatCo2Parts(spec.kg);
  return (
    <>
      <Approx weight="mono" />
      {value} {unit} CO2e{spec.meta ? ` · ${spec.meta}` : ''}
    </>
  );
}

/**
 * Turns game events into what the user sees and hears, anywhere in the product: receipts with
 * Undo, quest and streak notices, the XP bar's yellow span, sounds, and the queued
 * celebrations. Pages never toast or chime for a game event themselves; they only fire the
 * action. Mounted once, in the root layout.
 */
export function Feedback() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { celebrations } = useSettings();
  const { treeName } = useProfile();
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const later = (run: () => void, ms: number) => {
    if (ms <= 0) {
      run();
      return;
    }
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, ms);
    timers.current.add(timer);
  };

  const actionOf = (action: ToastAction | undefined) => {
    if (!action) return undefined;
    switch (action.kind) {
      case 'undo-log':
        return {
          label: action.label,
          onClick: () => {
            const result = gameActions.undoLog(action.logId);
            if (result.ok) return;
            toast({
              id: `undo-missed-${action.logId}`,
              title: 'Too late to undo from here.',
              meta: 'You can still delete it in the history on Log.',
              action: { label: 'Open Log', onClick: () => router.push(ROUTES.log) },
            });
          },
        };
      case 'go':
        return { label: action.label, onClick: () => router.push(action.href) };
    }
  };

  const carryOut = (plan: FeedbackPlan) => {
    for (const id of plan.dismiss) dismissToast(id);
    for (const spec of plan.toasts) {
      toast({
        id: spec.id,
        title: spec.title,
        meta: metaOf(spec),
        category: spec.category,
        icon: spec.icon ? ICON[spec.icon] : undefined,
        tone: spec.tone,
        action: actionOf(spec.action),
      });
    }
    for (const cue of plan.sounds) later(() => play(cue.name, cue.options), cue.delayMs);
    if (plan.xpEarned > 0) {
      const shell = useShellStore.getState();
      shell.flashXp(plan.xpEarned);
      shell.nudgeTree();
    }
    if (plan.celebrations.length > 0) {
      later(
        () => useCelebrationStore.getState().enqueue(plan.celebrations),
        plan.celebrationDelayMs,
      );
    }
  };

  useGameEvents((events) => {
    if (events.some((event) => event.type === 'state-reset')) {
      // A reset wipes everything: nothing that was queued still describes the user's data.
      useCelebrationStore.getState().clear();
      dismissToast();
      return;
    }
    const calm = reducedMotion || celebrations === 'subtle';
    carryOut(planFeedback(events, { treeName, calm }));
    // Calm users get no overlay to carry these pulses, so the world answers right away.
    if (calm) {
      for (const pulse of worldPulsesFor(events)) {
        if (isQueuedPulse(pulse)) emitPulse(pulse);
      }
    }
  });

  return <Celebrations />;
}
