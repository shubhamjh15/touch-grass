/**
 * Typed game events. Every mutation of the game state goes through one path
 * (`transact` in `engine.ts`) and reports what happened as a list of these, in order.
 * A shell turns them into toasts, sounds, live-region announcements and world pulses.
 */
import type { IslandPropId, WorldPulse } from '@/world/contract';
import type {
  BadgeTier,
  CategoryId,
  DayKey,
  LogEntry,
  Notice,
  QuestKind,
  VitalityState,
} from './types';

export type XpReason =
  | 'ceremony'
  | 'check-in'
  | 'log'
  | 'ring'
  | 'quest'
  | 'clean-sweep'
  | 'epic'
  | 'lesson'
  | 'myth'
  | 'break'
  | 'journal'
  | 'challenge'
  | 'streak-milestone'
  | 'badge'
  | 'dev';

export type CheckInVia = 'water' | 'log' | 'break' | 'lesson' | 'ceremony';

export type GameEvent =
  /** The seed-planting ceremony finished: profile, seed and ring 1 exist. */
  | { type: 'planted'; treeName: string; species: string; day: DayKey }
  | {
      type: 'checked-in';
      day: DayKey;
      via: CheckInVia;
      /** True when a log, break or lesson performed the check-in instead of the Water button. */
      implicit: boolean;
      ringNumber: number;
      returnedFrom: 'rain' | 'missed' | 'dormant' | null;
    }
  | {
      type: 'ring';
      day: DayKey;
      /** `drawn` at check-in, `closed` by the third rewarded act, `reopened` by an undo. */
      state: 'drawn' | 'closed' | 'reopened';
      rings: number;
      fullRings: number;
      /** False when the ring was closed before today and only regained: stay silent. */
      first: boolean;
    }
  | {
      type: 'action-logged';
      log: LogEntry;
      /** False when the action or its group was already maxed: kilograms only. */
      rewarded: boolean;
      /** Strength for the world's `grow` pulse, 0.2..1. */
      strength: number;
      /** The log also performed today's check-in. */
      firstActToday: boolean;
    }
  | {
      type: 'action-undone';
      log: LogEntry;
      /** True for a log of today, which is recomputed live. */ live: boolean;
    }
  | { type: 'xp-gained'; amount: number; reason: XpReason; total: number }
  /** XP taken back by an undo, a delete or a voided claim. Never shown as a loss. */
  | { type: 'xp-removed'; amount: number; reason: XpReason; total: number }
  | { type: 'level-up'; level: number; from: number; title: string; first: boolean }
  | {
      type: 'growth';
      gp: number;
      delta: number;
      growth: number;
      previousGrowth: number;
      stage: string;
      /** "Sapling → Young tree 43.2%". */
      label: string;
    }
  | { type: 'stage-up'; stage: string; stageIndex: number; first: boolean }
  | { type: 'vitality-restored'; from: VitalityState; to: VitalityState }
  | { type: 'vitality-changed'; from: VitalityState; to: VitalityState; missed: number }
  | { type: 'streak'; current: number; previous: number; best: number }
  | { type: 'streak-milestone'; days: number; xp: number }
  /** A gap ended the chain. `announced` is false for streaks under three days. */
  | { type: 'streak-rested'; days: number; announced: boolean }
  /** Rain covered a gap: the streak freeze was used. */
  | { type: 'freeze-used'; days: DayKey[]; bank: number; streak: number }
  | { type: 'rain-earned'; reason: 'weekly' | 'rings' | 'streak'; bank: number }
  | {
      type: 'badge-unlocked';
      badgeId: string;
      name: string;
      emoji: string;
      tier: BadgeTier;
      tiers: number;
      xp: number;
      secret: boolean;
      /** The island prop this tier unlocks, if any. */
      prop: IslandPropId | null;
    }
  | { type: 'quest-progress'; questId: string; kind: QuestKind; current: number; target: number }
  | { type: 'quest-claimable'; questId: string; kind: QuestKind; title: string }
  | {
      type: 'quest-claimed';
      questId: string;
      kind: QuestKind;
      title: string;
      xp: number;
      auto: boolean;
    }
  /** A claim whose condition no longer holds after an undo was taken back. */
  | { type: 'quest-voided'; questId: string; kind: QuestKind; xp: number }
  | { type: 'quest-swapped'; kind: 'daily' | 'weekly'; slot: number; from: string; to: string }
  | { type: 'quests-rotated'; kind: 'daily' | 'weekly'; slots: [string, string, string] }
  | { type: 'clean-sweep'; day: DayKey; xp: number }
  | { type: 'lesson-opened'; slug: string }
  | {
      type: 'lesson-completed';
      slug: string;
      score: number;
      passed: boolean;
      /** True the first time the lesson is passed; XP is paid only then. */
      firstPass: boolean;
      perfect: boolean;
      xp: number;
    }
  | { type: 'myth-flipped'; myth: number; first: boolean; xp: number }
  | { type: 'break-started'; plannedMin: number; endsAt: number }
  | {
      type: 'break-finished';
      kept: boolean;
      keptMin: number;
      outcome: 'outside' | 'rested' | 'none';
      rewarded: boolean;
      xp: number;
      gp: number;
    }
  | { type: 'break-cancelled' }
  | { type: 'post-added'; noteId: string; rewarded: boolean }
  | { type: 'post-edited'; noteId: string }
  | { type: 'post-deleted'; noteId: string }
  | { type: 'challenge-created'; templateId: string }
  | { type: 'challenge-accepted'; templateId: string; from: string | null }
  | { type: 'challenge-completed'; templateId: string; done: number; of: number; xp: number }
  | { type: 'challenge-ended'; templateId: string; done: number; of: number }
  | { type: 'baseline-set'; totalTonnes: number; first: boolean }
  | { type: 'focus-changed'; focus: CategoryId[] }
  | { type: 'day-rolled'; from: DayKey; to: DayKey; rain: number; rest: number; missed: number }
  | { type: 'notice'; notice: Notice }
  | { type: 'legacy-imported'; logs: number; skipped: number; rings: number; xp: number }
  | { type: 'state-imported' }
  | { type: 'state-reset' };

export type GameEventType = GameEvent['type'];
export type GameEventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;

type Handler<T extends GameEventType> = (event: GameEventOf<T>) => void;
type AnyHandler = (event: GameEvent) => void;

export interface GameEventBus {
  /** Subscribes to one event type. Returns the unsubscribe function. */
  on<T extends GameEventType>(type: T, handler: Handler<T>): () => void;
  /** Subscribes to every event, in emission order. */
  onAny(handler: AnyHandler): () => void;
  /** Subscribes to whole batches: one call per mutation, with everything it caused. */
  onBatch(handler: (events: readonly GameEvent[]) => void): () => void;
  emit(events: readonly GameEvent[]): void;
  clear(): void;
}

export function createEventBus(): GameEventBus {
  const typed = new Map<GameEventType, Set<AnyHandler>>();
  const any = new Set<AnyHandler>();
  const batch = new Set<(events: readonly GameEvent[]) => void>();

  // A failing listener must never break the mutation that fired it or the listeners after it.
  const safely = (run: () => void) => {
    try {
      run();
    } catch (error) {
      console.error('[game] event listener failed', error);
    }
  };

  return {
    on(type, handler) {
      const set = typed.get(type) ?? new Set<AnyHandler>();
      typed.set(type, set);
      const wrapped = handler as AnyHandler;
      set.add(wrapped);
      return () => {
        set.delete(wrapped);
      };
    },
    onAny(handler) {
      any.add(handler);
      return () => {
        any.delete(handler);
      };
    },
    onBatch(handler) {
      batch.add(handler);
      return () => {
        batch.delete(handler);
      };
    },
    emit(events) {
      if (events.length === 0) return;
      for (const event of events) {
        for (const handler of [...(typed.get(event.type) ?? [])]) safely(() => handler(event));
        for (const handler of [...any]) safely(() => handler(event));
      }
      for (const handler of [...batch]) safely(() => handler(events));
    },
    clear() {
      typed.clear();
      any.clear();
      batch.clear();
    },
  };
}

/** The app-wide bus the store emits on. */
export const gameEvents: GameEventBus = createEventBus();

/**
 * The world pulses an event batch should play, in order (product spec section 2.5):
 * `water` before `ring` on a check-in that revived the tree, `grow` per saved log,
 * `celebrate` for a closed ring, a stage-up, a claim or a kept break.
 */
export function worldPulsesFor(events: readonly GameEvent[]): WorldPulse[] {
  const pulses: WorldPulse[] = [];
  const revived = events.some((event) => event.type === 'vitality-restored');
  for (const event of events) {
    switch (event.type) {
      case 'planted':
        pulses.push({ kind: 'plant' });
        break;
      case 'checked-in':
        if (event.via === 'ceremony') break;
        if (revived) pulses.push({ kind: 'water' });
        pulses.push({ kind: 'ring' });
        break;
      case 'action-logged':
        pulses.push({ kind: 'grow', strength: event.strength });
        break;
      case 'level-up':
        if (event.first) pulses.push({ kind: 'level-up', level: event.level });
        break;
      case 'badge-unlocked':
        pulses.push({ kind: 'badge' });
        break;
      case 'streak-milestone':
        pulses.push({ kind: 'streak', days: event.days });
        break;
      case 'ring':
        if (event.state === 'closed' && event.first) pulses.push({ kind: 'celebrate' });
        break;
      case 'stage-up':
        if (event.first) pulses.push({ kind: 'celebrate' });
        break;
      case 'quest-claimed':
        if (!event.auto) pulses.push({ kind: 'celebrate' });
        break;
      case 'break-finished':
        if (event.kept) pulses.push({ kind: 'celebrate' });
        break;
      default:
        break;
    }
  }
  return pulses;
}
