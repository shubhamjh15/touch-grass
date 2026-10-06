'use client';

/**
 * The game as coach chips see it, and the engine's honest preview of one would-be log.
 * Both follow the store, so a chip disappears the moment its action is maxed and a
 * confirmation always shows what saving would really do.
 */
import { useMemo } from 'react';
import {
  previewAction,
  selectActionStatesById,
  selectToday,
  useGame,
  useGameState,
  useProfile,
  useQuests,
  useTouchGrass,
  type LogPreview,
} from '@/game';
import type { ChipWorld } from './model/chips';

export function useChipWorld(): ChipWorld {
  const actions = useGame(selectActionStatesById);
  const board = useQuests();
  const rest = useTouchGrass();
  const { units } = useProfile();
  const breakAvailable = rest.active === null && rest.cooldownMin === 0;
  return useMemo(
    () => ({ actions, quests: [...board.daily, ...board.weekly], breakAvailable, units }),
    [actions, board.daily, board.weekly, breakAvailable, units],
  );
}

/** What sticking this on would do right now: ≈ kg, XP and any reason it would be refused. */
export function useLogPreview(actionId: string, qty: number): LogPreview {
  const logs = useGameState((game) => game.logs);
  const profile = useGameState((game) => game.profile);
  const baseline = useGameState((game) => game.baseline);
  const settings = useGameState((game) => game.settings);
  const day = useGame(selectToday);
  return useMemo(
    () =>
      previewAction({ logs, profile, baseline, settings }, { actionId, qty, source: 'coach' }, day),
    [logs, profile, baseline, settings, actionId, qty, day],
  );
}
