/**
 * QA helper for development builds: `window.__game` in the browser console. It drives
 * the real store through the real actions, so what it produces is always a state the
 * product could reach — except where a method says it bends the rules (grants, badges).
 * Never installed in production: `installGameDevTools` is only imported when `IS_DEV`.
 */
import type { BadgeTier } from '@/data/badges';
import { dayKey } from '@/lib/dates';
import { IS_DEV } from '@/lib/env';
import type { WorldSnapshot } from '@/world/contract';
import type { LogInputs } from './co2';
import { growthInfo } from './growth';
import { levelInfo } from './levels';
import { selectWorldSnapshot } from './selectors';
import { game as defaultGame, type Game } from './store';
import type { GameState } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface GameDevTools {
  /** Lists the commands. */
  help(): string;
  /** A one-line summary of where the game stands. */
  status(): string;
  /** The persisted state. */
  state(): GameState;
  /** The snapshot the world receives. */
  world(): WorldSnapshot;
  /** The game's clock as local date and time. */
  now(): string;
  /** Moves the clock forward by days and hours, then settles the calendar. */
  travel(days: number, hours?: number): string;
  /** Jumps to a local date and time, e.g. `travelTo('2026-11-01T08:00')`. Forward only. */
  travelTo(localIso: string): string;
  /** Back to the real clock. If the game is ahead of it, the calendar waits (future guard). */
  realTime(): string;
  /** Today's check-in. */
  water(): boolean;
  /** Logs a catalogue action through the normal rules. */
  log(actionId: string, qty?: number, inputs?: LogInputs): unknown;
  /** Logs three plant-based meals, which closes today's ring on an empty day. */
  closeRing(): unknown;
  /** Adds XP outside the rules (negative removes). */
  grantXp(amount: number): number;
  /** Adds growth points outside the rules (negative removes). */
  grantGp(amount: number): number;
  /** Awards a badge tier outright, with its XP and island prop. */
  unlockBadge(badgeId: string, tier?: BadgeTier): boolean;
  /** Plays `days` days of a simple routine: water, two logs, and a third on alternate days. */
  play(days: number): string;
  /** The export file as text. */
  export(): string;
  /** Replaces the data with an export file's text. */
  import(text: string): boolean;
  /** Deletes everything the app stored on this device. */
  reset(): void;
}

const HELP = [
  '__game.status()                 where the game stands',
  '__game.travel(days, hours?)     move the clock forward and settle',
  "__game.travelTo('2026-11-01T08:00')",
  '__game.realTime()               back to the real clock',
  '__game.water()                  check in',
  "__game.log('plant-based-meal', 2)",
  '__game.closeRing()              three acts',
  '__game.play(days)               a routine for N days',
  '__game.grantXp(n) / grantGp(n)  outside the rules',
  "__game.unlockBadge('bookworm', 2)",
  '__game.state() / world()        persisted state / world snapshot',
  '__game.export() / import(text) / reset()',
].join('\n');

export function createGameDevTools(target: Game = defaultGame): GameDevTools {
  const { actions, store } = target;
  let offset = 0;
  const applyOffset = () => target.setClock(() => Date.now() + offset);
  const stamp = () => new Date(target.now()).toLocaleString('en-GB');
  const state = () => store.getState().game;

  const tools: GameDevTools = {
    help: () => HELP,
    status() {
      const current = state();
      const level = levelInfo(current.xp);
      const growth = growthInfo(current.tree.gp);
      return [
        `${stamp()} · day ${dayKey(target.now())}`,
        `${current.profile.treeName || '(not planted)'} · ${growth.stage} ${(growth.growth * 100).toFixed(1)}% · ${current.tree.vitality}`,
        `L${level.level} ${level.title} · ${current.xp} XP · ${current.tree.gp} GP`,
        `rings ${current.tree.rings} (${current.tree.fullRings} full) · streak ${current.streak.current} (best ${current.streak.best}) · rain ${current.rain.bank}`,
        `logs ${current.logs.length} · badges ${Object.keys(current.badges).length}`,
      ].join('\n');
    },
    state,
    world: () => selectWorldSnapshot(state(), target.now()),
    now: stamp,
    travel(days, hours = 0) {
      offset += Math.max(0, days) * DAY + Math.max(0, hours) * HOUR;
      applyOffset();
      actions.tick(undefined, true);
      return stamp();
    },
    travelTo(localIso) {
      const goal = new Date(localIso).getTime();
      if (!Number.isFinite(goal) || goal < target.now()) return `${stamp()} (forward only)`;
      offset = goal - Date.now();
      applyOffset();
      actions.tick(undefined, true);
      return stamp();
    },
    realTime() {
      offset = 0;
      applyOffset();
      actions.tick();
      return stamp();
    },
    water: () => actions.checkIn(),
    log: (actionId, qty, inputs) => actions.logAction({ actionId, qty, inputs }),
    closeRing: () => actions.logAction({ actionId: 'plant-based-meal', qty: 3 }),
    grantXp(amount) {
      actions.devGrantXp(amount);
      return state().xp;
    },
    grantGp(amount) {
      actions.devGrantGp(amount);
      return state().tree.gp;
    },
    unlockBadge: (badgeId, tier = 1) => actions.devUnlockBadge(badgeId, tier),
    play(days) {
      for (let index = 0; index < Math.max(0, Math.floor(days)); index += 1) {
        if (index > 0) tools.travel(1);
        actions.checkIn();
        actions.logAction({ actionId: 'plant-based-meal', qty: 1 });
        offset += 5000;
        applyOffset();
        actions.logAction({ actionId: 'bus-instead-of-car', qty: 5 });
        if (index % 2 === 0) {
          offset += 5000;
          applyOffset();
          actions.logAction({ actionId: 'refuse-single-use-bottle', qty: 1 });
        }
      }
      return tools.status();
    },
    export: () => actions.exportState(),
    import: (text) => actions.importState(text).ok,
    reset: () => actions.resetAll(),
  };
  return tools;
}

declare global {
  interface Window {
    /** QA helper, development builds only. */
    __game?: GameDevTools;
  }
}

/** Puts the helper on `window.__game`. A no-op in production builds and on the server. */
export function installGameDevTools(target: Game = defaultGame): void {
  if (!IS_DEV || typeof window === 'undefined') return;
  window.__game = createGameDevTools(target);
}
