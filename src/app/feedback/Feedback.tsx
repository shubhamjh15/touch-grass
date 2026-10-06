'use client';

import {
  Award,
  CloudRain,
  Database,
  Flame,
  Sparkles,
  Sprout,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { gameActions, useGameEvents, useProfile } from '@/game';
import { play } from '@/lib/sfx';
import { dismissToast, toast } from '@/ui';
import { ROUTES } from '../routes';
import { useShellStore } from '../shellStore';
import { planFeedback, type FeedbackPlan, type ToastAction, type ToastIcon } from './eventFeedback';
import { LevelUpDialog } from './LevelUpDialog';

const ICON: Record<ToastIcon, LucideIcon> = {
  xp: Sparkles,
  quest: Target,
  rain: CloudRain,
  streak: Flame,
  stage: Sprout,
  badge: Award,
  data: Database,
};

/**
 * Turns game events into what the user sees and hears, on any screen: a toast (with Undo on a
 * log), the level-up dialog, a sound when sound is on. Pages never toast for a game event
 * themselves; they only fire the action. Mounted once, in the root layout.
 */
export function Feedback() {
  const router = useRouter();
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
            if (gameActions.undoLog(action.logId).ok) return;
            toast({
              id: `undo-missed-${action.logId}`,
              title: 'Too late to undo here.',
              meta: 'You can still remove it on the Log page.',
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
        meta: spec.meta,
        icon: spec.icon ? ICON[spec.icon] : undefined,
        tone: spec.tone,
        action: actionOf(spec.action),
      });
    }
    for (const cue of plan.sounds) later(() => play(cue.name, cue.options), cue.delayMs);
    const { levelUp } = plan;
    if (levelUp) later(() => useShellStore.getState().setLevelUp(levelUp), plan.levelUpDelayMs);
  };

  useGameEvents((events) => {
    if (events.some((event) => event.type === 'state-reset')) {
      // A reset wipes everything: nothing on screen still describes the user's data.
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current.clear();
      useShellStore.getState().setLevelUp(null);
      dismissToast();
      return;
    }
    carryOut(planFeedback(events, { treeName }));
  });

  return <LevelUpDialog />;
}
