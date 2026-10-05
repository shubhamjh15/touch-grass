import { clamp01 } from '@/lib/math';
import type { WorldPulse } from './contract';

/**
 * Pulse choreography (design bible 5.10), as pure data and maths.
 *
 * A pulse is a short script: a set of *channels* (numbers the scene applies to
 * transforms and uniforms every frame: a squash, a hop, a pressed shadow) and a list of
 * *beats* (one-shot bursts of paper bits, emitted exactly once when their time comes).
 * The scheduler queues pulses, lets at most two overlap, merges rapid `grow` pulses and
 * never allocates while it runs. Under reduced motion every pulse collapses into one
 * calm highlight and no beat is emitted.
 */

export type PulseKind = WorldPulse['kind'];

/** Paper bits a beat can throw. The scene decides how each kind looks and flies. */
export type BurstKind =
  /** Leaf clusters popping at the branch tips (overshoot, then they stay a while). */
  | 'pops'
  /** Loose paper leaves from the sticking point, fluttering down-right. */
  | 'leaves'
  /** Colour-bar confetti squares arcing out from behind the crown. */
  | 'confetti'
  /** Water drops falling on the soil. */
  | 'drops'
  /** Dust chips ringing the base of the island. */
  | 'dust'
  /** Soil chips puffing where the seed landed. */
  | 'soil'
  /** Fruit or blossom chips popping across the crown, left to right. */
  | 'fruit'
  /** Petals drifting down for a while. */
  | 'petals';

/** Everything a frame of pulses asks of the scene. All zero (or -1) at rest. */
export interface PulseChannels {
  /** Share of the tree's height squashed away (0.04 = 4 %); negative stretches. */
  squash: number;
  /** The island's hop, in world units above its rest position. */
  hop: number;
  /** The island pressed down, in world units. */
  dip: number;
  /** The whole sticker pressed into the page, in CSS pixels (down-right). */
  press: number;
  /** Multiplier of the hard shadow's length: above 1 while airborne, below 1 while pressed. */
  shadow: number;
  /** 0..1 wash of the highlight tone over the canopy. */
  flash: number;
  /** Extra scale of the whole subject (the ceremony's push-in). */
  push: number;
  /** -1 = none, else 0..1: the paper band travelling up the trunk. */
  band: number;
  /** Share of extra trunk girth. */
  girth: number;
  /** Extra scale of the ring medallion while a ring is stamped onto it. */
  stamp: number;
  /** 0..1 tip of the watering can. */
  can: number;
  /** 0..1 height of Moss's bounce. */
  cheer: number;
  /** -1 = none, 0..1 = the seed falling on its thread, 1 = landed. */
  seed: number;
  /** 0..1 squash of the landed seed. */
  seedSquash: number;
  /** 1 while the displayed growth must be held at zero (the seed has not sprouted yet). */
  gate: number;
  /** 0..1: the sky rig makes room (clouds slide outward, the orb spins). */
  rig: number;
}

export function createChannels(): PulseChannels {
  return {
    squash: 0,
    hop: 0,
    dip: 0,
    press: 0,
    shadow: 1,
    flash: 0,
    push: 0,
    band: -1,
    girth: 0,
    stamp: 0,
    can: 0,
    cheer: 0,
    seed: -1,
    seedSquash: 0,
    gate: 0,
    rig: 0,
  };
}

function resetChannels(out: PulseChannels): void {
  out.squash = 0;
  out.hop = 0;
  out.dip = 0;
  out.press = 0;
  out.shadow = 1;
  out.flash = 0;
  out.push = 0;
  out.band = -1;
  out.girth = 0;
  out.stamp = 0;
  out.can = 0;
  out.cheer = 0;
  out.seed = -1;
  out.seedSquash = 0;
  out.gate = 0;
  out.rig = 0;
}

// --- Envelopes (t in milliseconds) ---------------------------------------------------------

/** 0 outside [from, to], a half sine inside: rises, peaks in the middle, returns. */
export function bump(t: number, from: number, to: number): number {
  if (t <= from || t >= to) return 0;
  return Math.sin((Math.PI * (t - from)) / (to - from));
}

/** 0 before `from`, 1 after `to`, smooth in between. */
export function ramp(t: number, from: number, to: number): number {
  const x = clamp01((t - from) / (to - from));
  return x * x * (3 - 2 * x);
}

/**
 * A squash that is pushed in over `attack` ms and then rings out like spring `pop`:
 * one visible overshoot the other way, then rest.
 */
export function thump(t: number, attack: number, decay = 90, period = 55): number {
  if (t <= 0) return 0;
  if (t < attack) return Math.sin((Math.PI / 2) * (t / attack));
  const rest = t - attack;
  return Math.exp(-rest / decay) * Math.cos(rest / period);
}

/** Two bounces that die away: Moss cheering. */
export function bounce(t: number, from: number, length: number): number {
  const x = (t - from) / length;
  if (x <= 0 || x >= 1) return 0;
  return Math.abs(Math.sin(x * Math.PI * 2)) * (1 - x * 0.55);
}

// --- Scripts -------------------------------------------------------------------------------

interface Beat {
  /** Milliseconds after the pulse started. */
  at: number;
  kind: BurstKind;
  /** How many bits, from the pulse's own numbers (strength, days). */
  count: (play: Play) => number;
}

interface Script {
  /** Milliseconds the channels are driven for. */
  length: number;
  beats: readonly Beat[];
  channels: (t: number, play: Play, out: PulseChannels) => void;
}

/** A pulse being played (or waiting). Pooled: fields are overwritten, never reallocated. */
export interface Play {
  kind: PulseKind;
  /** `grow`: 0..1. Rapid grows merge into one play and add their strengths. */
  strength: number;
  /** `streak`: days. `level-up`: the level. */
  amount: number;
  /** Scheduler time (seconds) at which it started. */
  start: number;
  /** Beats already emitted. */
  emitted: number;
  active: boolean;
}

const fixed = (count: number) => () => count;

export const SCRIPTS: Record<PulseKind, Script> = {
  grow: {
    length: 1000,
    beats: [
      { at: 120, kind: 'pops', count: (play) => 3 + Math.round(5 * play.strength) },
      { at: 200, kind: 'leaves', count: (play) => 8 + Math.round(16 * play.strength) },
    ],
    channels(t, play, out) {
      const force = 0.6 + 0.4 * play.strength;
      out.squash += 0.04 * force * thump(t, 120);
      out.dip += 0.07 * force * thump(t - 20, 130, 120, 70);
      out.flash = Math.max(out.flash, 0.32 * bump(t, 100, 560));
    },
  },
  ring: {
    length: 800,
    beats: [],
    channels(t, _play, out) {
      if (t < 520) out.band = ramp(t, 0, 500);
      out.girth += 0.02 * bump(t, 0, 800);
      if (t >= 500) out.stamp = Math.max(out.stamp, 0.3 * (1 - ramp(t, 500, 800)));
    },
  },
  water: {
    length: 1200,
    beats: [{ at: 200, kind: 'drops', count: fixed(5) }],
    channels(t, _play, out) {
      out.can = Math.max(out.can, ramp(t, 0, 300) * (1 - ramp(t, 620, 860)));
      out.flash = Math.max(out.flash, 0.28 * bump(t, 300, 1200));
      out.squash -= 0.025 * bump(t, 420, 1000);
      out.cheer = Math.max(out.cheer, bounce(t, 600, 560));
    },
  },
  'level-up': {
    length: 1800,
    beats: [{ at: 300, kind: 'confetti', count: fixed(24) }],
    channels(t, _play, out) {
      const air = bump(t, 0, 350);
      out.hop += 0.24 * air;
      out.shadow *= 1 + 0.75 * air;
      out.squash += 0.035 * thump(t - 350, 40, 110, 60);
      out.cheer = Math.max(out.cheer, bounce(t, 400, 700));
      out.rig = Math.max(out.rig, bump(t, 400, 1000));
      out.flash = Math.max(out.flash, 0.22 * bump(t, 300, 900));
    },
  },
  badge: {
    length: 900,
    beats: [{ at: 320, kind: 'dust', count: fixed(6) }],
    channels(t, _play, out) {
      const pressed = t >= 320 && t < 400 ? 1 : 1 - ramp(t, 400, 470);
      if (t >= 320) {
        out.press += 3 * pressed;
        out.shadow *= 1 - 0.625 * pressed;
      }
    },
  },
  streak: {
    // 1400 ms of choreography; the petals it throws at 700 drift for three more seconds.
    length: 1400,
    beats: [
      { at: 0, kind: 'fruit', count: fixed(10) },
      { at: 700, kind: 'petals', count: (play) => Math.max(4, Math.min(30, play.amount)) },
    ],
    channels(t, _play, out) {
      out.flash = Math.max(out.flash, 0.3 * bump(t, 0, 700));
      out.squash -= 0.02 * bump(t, 0, 500);
    },
  },
  plant: {
    length: 2400,
    beats: [{ at: 500, kind: 'soil', count: fixed(6) }],
    channels(t, _play, out) {
      // The seed drops on its thread (ease-in), squashes, and the sprout only then rises.
      const fall = clamp01(t / 500);
      out.seed = fall * fall;
      out.seedSquash = Math.max(0, thump(t - 500, 50, 80, 45)) * 0.4;
      out.gate = t < 1000 ? 1 : 0;
      out.dip += 0.04 * thump(t - 500, 40, 100, 60);
      if (t >= 1900) out.stamp = Math.max(out.stamp, 0.3 * (1 - ramp(t, 1900, 2200)));
      out.push = Math.max(out.push, 0.06 * ramp(t, 0, 600) * (1 - ramp(t, 2000, 2400)));
      out.rig = Math.max(out.rig, ramp(t, 0, 300) * (1 - ramp(t, 2200, 2400)));
    },
  },
  celebrate: {
    length: 1200,
    beats: [{ at: 100, kind: 'confetti', count: fixed(16) }],
    channels(t, _play, out) {
      const air = bump(t, 0, 300);
      out.hop += 0.12 * air;
      out.shadow *= 1 + 0.4 * air;
      out.squash += 0.02 * thump(t - 300, 40, 100, 60);
      out.cheer = Math.max(out.cheer, bounce(t, 150, 600));
    },
  },
};

/** Reduced motion: one calm highlight, whatever the pulse. */
export const CALM_MS = 500;
const CALM_FLASH = 0.38;

export const MAX_OVERLAP = 2;
export const MAX_QUEUE = 8;
/** `grow` pulses this close together (seconds) become one, with their strengths added. */
export const MERGE_WINDOW = 0.25;

const amountOf = (pulse: WorldPulse): number =>
  pulse.kind === 'streak' ? pulse.days : pulse.kind === 'level-up' ? pulse.level : 0;

const strengthOf = (pulse: WorldPulse): number =>
  pulse.kind === 'grow' ? clamp01(pulse.strength ?? 0.5) : 1;

const idlePlay = (): Play => ({
  kind: 'grow',
  strength: 0,
  amount: 0,
  start: 0,
  emitted: 0,
  active: false,
});

export type BurstSink = (kind: BurstKind, count: number, play: Play) => void;

export class PulseScheduler {
  readonly channels = createChannels();
  private readonly plays: Play[] = Array.from({ length: MAX_OVERLAP }, idlePlay);
  private readonly queue: Play[] = Array.from({ length: MAX_QUEUE }, idlePlay);
  private queued = 0;
  private now = 0;

  /** Pulses currently playing. */
  get playing(): number {
    let count = 0;
    for (const play of this.plays) if (play.active) count += 1;
    return count;
  }

  /** Pulses waiting for a free slot. */
  get waiting(): number {
    return this.queued;
  }

  /** Queues a pulse. `now` is the scheduler clock in seconds (the frame time). */
  push(pulse: WorldPulse, now = this.now): void {
    this.now = Math.max(this.now, now);
    if (pulse.kind === 'grow') {
      // A second log during the moment adds to the grow that is still winding up.
      for (const play of this.plays) {
        if (play.active && play.kind === 'grow' && now - play.start < MERGE_WINDOW) {
          play.strength = clamp01(play.strength + strengthOf(pulse));
          return;
        }
      }
      for (let i = 0; i < this.queued; i += 1) {
        const waiting = this.queue[i] as Play;
        if (waiting.kind === 'grow') {
          waiting.strength = clamp01(waiting.strength + strengthOf(pulse));
          return;
        }
      }
    }
    const free = this.plays.find((play) => !play.active);
    if (free) {
      this.begin(free, pulse.kind, strengthOf(pulse), amountOf(pulse), now);
      return;
    }
    // Full queue: the oldest waiting pulse gives way, so the newest news is never lost.
    if (this.queued === MAX_QUEUE) {
      const oldest = this.queue.shift() as Play;
      this.queue.push(oldest);
      this.queued -= 1;
    }
    const slot = this.queue[this.queued] as Play;
    slot.kind = pulse.kind;
    slot.strength = strengthOf(pulse);
    slot.amount = amountOf(pulse);
    this.queued += 1;
  }

  private begin(play: Play, kind: PulseKind, strength: number, amount: number, now: number): void {
    play.kind = kind;
    play.strength = strength;
    play.amount = amount;
    play.start = now;
    play.emitted = 0;
    play.active = true;
  }

  /**
   * Advances to `now` (seconds), fills `channels` and emits the beats that became due.
   * Returns true while anything is playing or waiting.
   */
  update(now: number, reduced: boolean, emit: BurstSink): boolean {
    this.now = now;
    const out = this.channels;
    resetChannels(out);
    let busy = false;
    for (const play of this.plays) {
      if (!play.active) continue;
      const script = SCRIPTS[play.kind];
      const t = (now - play.start) * 1000;
      const length = reduced ? CALM_MS : script.length;
      if (t >= length) {
        // Late frames still owe their beats before the play is retired.
        if (!reduced) this.emitDue(play, script, Number.POSITIVE_INFINITY, emit);
        play.active = false;
        continue;
      }
      busy = true;
      if (reduced) {
        out.flash = Math.max(out.flash, CALM_FLASH * bump(t, 0, CALM_MS));
        continue;
      }
      script.channels(t, play, out);
      this.emitDue(play, script, t, emit);
    }
    // Promote waiting pulses into the slots that just became free.
    for (const play of this.plays) {
      if (play.active || this.queued === 0) continue;
      const next = this.queue.shift() as Play;
      this.queue.push(next);
      this.queued -= 1;
      this.begin(play, next.kind, next.strength, next.amount, now);
      busy = true;
    }
    return busy || this.queued > 0;
  }

  private emitDue(play: Play, script: Script, t: number, emit: BurstSink): void {
    while (play.emitted < script.beats.length) {
      const beat = script.beats[play.emitted] as Beat;
      if (beat.at > t) break;
      play.emitted += 1;
      emit(beat.kind, beat.count(play), play);
    }
  }

  /** Drops everything (the scene was rebuilt or the stage went away). */
  clear(): void {
    for (const play of this.plays) play.active = false;
    this.queued = 0;
    resetChannels(this.channels);
  }
}
