import type { WorldPulse } from '@/world';
import type { Celebration } from './eventFeedback';

/**
 * Pulses that belong to a queued celebration (badge, level-up, streak). The celebration plays
 * its own pulse on its beat, so the bridge must not fire these the moment the event arrives.
 */
export function isQueuedPulse(pulse: WorldPulse): boolean {
  return pulse.kind === 'level-up' || pulse.kind === 'badge' || pulse.kind === 'streak';
}

/** The world pulse that goes with a celebration. */
export function celebrationPulse(celebration: Celebration): WorldPulse {
  switch (celebration.kind) {
    case 'level-up':
      return { kind: 'level-up', level: celebration.level };
    case 'badge':
      return { kind: 'badge' };
    case 'streak':
      return { kind: 'streak', days: celebration.days };
  }
}
