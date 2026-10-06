'use client';

/**
 * One coach conversation for a surface: the chat hook from `@/ai` fed with the game's
 * coach context, plus the things only the page knows (network state, calm motion) folded
 * into a single status the UI can label truthfully.
 */
import { useMemo } from 'react';
import { useCoach, useCoachStore, type CoachClient, type CoachContext, type UseCoach } from '@/ai';
import { LESSONS } from '@/data/content';
import { getCoachContext } from '@/game';
import { useOnlineStatus, useReducedMotion } from '@/lib/hooks';
import { budgetedClient } from './coachUi';
import { STATUS_LINE } from './copy';

const LESSON_TITLES: Readonly<Record<string, string>> = Object.fromEntries(
  LESSONS.map((lesson) => [lesson.id, lesson.title]),
);

/** The game's view of the user, rebuilt for every request so the coach never sees stale stats. */
export function readCoachContext(): CoachContext {
  return getCoachContext({ lessonTitles: LESSON_TITLES });
}

export type BuiltInReason = 'not_configured' | 'unreachable' | 'rate_limited' | 'trouble';

export type CoachStatus =
  | { kind: 'checking' }
  | { kind: 'live'; provider: string; model: string | null }
  | { kind: 'offline' }
  | { kind: 'builtin'; why: BuiltInReason };

export interface CoachSession extends UseCoach {
  status: CoachStatus;
  online: boolean;
  /** Built-in answers appear at once instead of word by word. */
  calm: boolean;
}

export function useCoachSession(client: CoachClient = budgetedClient): CoachSession {
  const calm = useReducedMotion();
  const online = useOnlineStatus();
  const coach = useCoach(readCoachContext, { instant: calm, client });
  const live = useCoachStore((state) => state.live);

  const status = useMemo<CoachStatus>(() => {
    if (!live.ready) return { kind: 'checking' };
    if (!online) return { kind: 'offline' };
    if (live.configured && live.degraded === null) {
      return { kind: 'live', provider: live.provider ?? 'AI coach', model: live.model };
    }
    if (live.configured) {
      return {
        kind: 'builtin',
        why: live.degraded === 'rate_limited' ? 'rate_limited' : 'trouble',
      };
    }
    return { kind: 'builtin', why: live.reason === 'offline' ? 'unreachable' : 'not_configured' };
  }, [live, online]);

  return { ...coach, status, online, calm };
}

/** Which coach is answering, in one honest sentence. */
export function statusLine(status: CoachStatus): string {
  switch (status.kind) {
    case 'checking':
      return STATUS_LINE.checking;
    case 'live':
      return STATUS_LINE.live(status.provider);
    case 'offline':
      return STATUS_LINE.offline;
    case 'builtin':
      return STATUS_LINE[status.why];
  }
}
