import { gameEvents, gameStore, selectTreeStatus } from '@/game';
import { emitBootReset, setBoot } from './bootStore';

/**
 * Keeps the boot store in step with the game. Importing this module is what connects them, so it
 * happens exactly once and before any component that arrived with the game renders: the guard
 * knows the saved state in the same frame the game does.
 */
function sync(): void {
  const { game, runtime } = gameStore.getState();
  const onboarded = game.onboarding.completedAt !== null;
  setBoot({
    hydrated: runtime.hydrated,
    onboarded,
    motion: game.settings.motion,
    sceneLabel: onboarded ? selectTreeStatus(game, runtime.now).sceneLabel : null,
  });
}

sync();
gameStore.subscribe(sync);
gameEvents.on('state-reset', emitBootReset);
