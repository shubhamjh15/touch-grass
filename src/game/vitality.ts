/**
 * Vitality changes colour, posture and copy, nothing else. A tree gets thirsty after a
 * missed day and rests after a week, and one good day always brings it back. It cannot die.
 */
import {
  DORMANT_AFTER_MISSED,
  VITALITY_THIRSTY_START,
  VITALITY_THIRSTY_STEP,
  VITALITY_WAKING,
} from './economy';
import type { VitalityState } from './types';

/** The state a tree is in after `missed` consecutive missed days, before any check-in. */
export function vitalityAfterMissed(missed: number): VitalityState {
  if (missed >= DORMANT_AFTER_MISSED) return 'dormant';
  return missed >= 1 ? 'thirsty' : 'thriving';
}

/** The 0..1 value the world draws: 1 thriving, 0.70 down to 0.30 thirsty, 0 dormant, 0.6 waking. */
export function vitalityValue(state: VitalityState, missed: number): number {
  switch (state) {
    case 'thriving':
      return 1;
    case 'waking':
      return VITALITY_WAKING;
    case 'dormant':
      return 0;
    case 'thirsty': {
      const days = Math.min(Math.max(1, missed), DORMANT_AFTER_MISSED - 1);
      const value = VITALITY_THIRSTY_START - VITALITY_THIRSTY_STEP * (days - 1);
      return Math.round(value * 100) / 100;
    }
  }
}

const LABELS: Record<VitalityState, string> = {
  thriving: 'Thriving',
  thirsty: 'Thirsty',
  dormant: 'Resting',
  waking: 'Waking up',
};

export function vitalityLabel(state: VitalityState): string {
  return LABELS[state];
}

/** The status line under the tree. `checkedIn` is whether today already has its check-in. */
export function vitalityCopy(state: VitalityState, treeName: string, checkedIn: boolean): string {
  switch (state) {
    case 'thriving':
      return checkedIn ? `${treeName} is thriving.` : `${treeName} could use a drink.`;
    case 'thirsty':
      return `${treeName} is thirsty. One tap fixes that.`;
    case 'dormant':
      return `${treeName} is resting. It kept every ring. Wake it up?`;
    case 'waking':
      return "Waking up. Close today's ring and it's thriving again.";
  }
}
