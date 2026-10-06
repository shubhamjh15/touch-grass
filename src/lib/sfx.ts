/**
 * The product's sounds: a tiny WebAudio synth, no audio files.
 * The family is paper, felt, wood and a small glockenspiel.
 *
 *   play('stick')                    a sticker lands
 *   play('toggle', { on: false })    a switch going off
 *   play('leaf', { count: 5 })       five plucks for a big burst
 *   play('tick', { rate: 1.3 })      a higher tick (the hold ring rises in pitch)
 *
 * Rules the module enforces so callers cannot get them wrong:
 * - off by default: silent until the Sound setting turns it on (`setSoundEnabled`), until the
 *   first user gesture (`installAudioUnlock` in the shell), and while the tab is hidden;
 * - master gain 0.25, at most two voices at once (the oldest is cut), ±3 % pitch per play;
 * - `tick` is rate-limited to 30 per second.
 * A sound never carries information by itself: every one has a visual beat fired by the same event.
 */

export const SFX_NAMES = [
  'tap',
  'toggle',
  'tick',
  'peel',
  'stick',
  'thup',
  'leaf',
  'boop',
  'tear',
  'stamp',
  'ring',
  'water',
  'level',
  'streak',
  'plant',
  'cheer',
  'chime',
  'error',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export interface SfxOptions {
  /** `toggle`: rising for on (default), falling for off. */
  on?: boolean;
  /** `leaf`: number of plucks, 3 to 6. */
  count?: number;
  /** Pitch multiplier on top of the random ±3 %, e.g. the hold ring's rising ticks. */
  rate?: number;
}

const MASTER_GAIN = 0.25;
const MAX_VOICES = 2;
const PITCH_SPREAD = 0.03;
const TICK_MIN_GAP_MS = 1000 / 30;
/** A cut voice fades over this long, so it never clicks. */
const CUT_S = 0.015;
const SILENCE = 0.0001;

const NOTE = {
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  A5: 880,
  C6: 1046.5,
  D6: 1174.66,
  E6: 1318.51,
} as const;

interface Voice {
  out: GainNode;
  endsAt: number;
}

/** What a recipe draws with: the context, the voice's output, its start time and its pitch. */
interface Pen {
  ctx: AudioContext;
  out: GainNode;
  t0: number;
  pitch: number;
  options: SfxOptions;
}

type AudioContextCtor = new () => AudioContext;

let enabled = false;
let hapticsEnabled = false;
let unlocked = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let voices: Voice[] = [];
let lastTick = 0;

function contextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = contextCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

/** One second of white noise, made once and shared by every paper sound. */
function noise(context: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

interface ToneSpec {
  type?: OscillatorType;
  /** Hz at the start and, when it glides, at the end. */
  from: number;
  to?: number;
  /** Seconds after the voice starts. */
  at?: number;
  dur: number;
  gain: number;
  /** Hz of a slow pitch wobble (the held note of `level`). */
  vibrato?: number;
}

/** A pitched blip: an oscillator with a 2 ms attack and an exponential decay to silence. */
function tone(pen: Pen, spec: ToneSpec): number {
  const { ctx: context, out, pitch } = pen;
  const start = pen.t0 + (spec.at ?? 0);
  const end = start + spec.dur;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = spec.type ?? 'sine';
  oscillator.frequency.setValueAtTime(spec.from * pitch, start);
  if (spec.to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(spec.to * pitch, end);
  }
  if (spec.vibrato) {
    const wobble = context.createOscillator();
    const depth = context.createGain();
    wobble.frequency.value = spec.vibrato;
    depth.gain.value = spec.from * pitch * 0.006;
    wobble.connect(depth);
    depth.connect(oscillator.frequency);
    wobble.start(start);
    wobble.stop(end + 0.02);
  }
  envelope.gain.setValueAtTime(SILENCE, start);
  envelope.gain.exponentialRampToValueAtTime(spec.gain, start + 0.002);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, end);
  oscillator.connect(envelope);
  envelope.connect(out);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
  return (spec.at ?? 0) + spec.dur;
}

interface NoiseSpec {
  at?: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  /** Filter frequency at the start and, when it sweeps, at the end. */
  from: number;
  to?: number;
  q?: number;
}

/** A filtered noise burst: paper, soil, a shaker. */
function hiss(pen: Pen, spec: NoiseSpec): number {
  const { ctx: context, out } = pen;
  const start = pen.t0 + (spec.at ?? 0);
  const end = start + spec.dur;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = noise(context);
  source.loop = true;
  filter.type = spec.filter;
  filter.Q.value = spec.q ?? 1;
  filter.frequency.setValueAtTime(spec.from, start);
  if (spec.to !== undefined) filter.frequency.exponentialRampToValueAtTime(spec.to, end);
  envelope.gain.setValueAtTime(SILENCE, start);
  envelope.gain.exponentialRampToValueAtTime(spec.gain, start + 0.003);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, end);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(out);
  source.start(start);
  source.stop(end + 0.02);
  return (spec.at ?? 0) + spec.dur;
}

/** The soft thud shared by `stick`, `level` and `plant`. */
function thud(pen: Pen, at = 0): number {
  tone(pen, { from: 160, to: 70, at, dur: 0.09, gain: 0.5 });
  hiss(pen, { at, dur: 0.008, gain: 0.12, filter: 'bandpass', from: 2000, q: 1.5 });
  return at + 0.09;
}

const clampCount = (count: number | undefined, fallback: number) =>
  Math.min(6, Math.max(3, Math.round(count ?? fallback)));

/** Each recipe schedules its nodes and returns how long it sounds, in seconds. */
const RECIPES: Record<SfxName, (pen: Pen) => number> = {
  tap: (pen) => tone(pen, { from: 1800, to: 1200, dur: 0.02, gain: 0.32 }),

  toggle: (pen) => {
    const rising = pen.options.on !== false;
    const [low, high] = rising ? [1200, 1600] : [1600, 1200];
    tone(pen, { from: low, dur: 0.015, gain: 0.28 });
    return tone(pen, { from: high, at: 0.045, dur: 0.015, gain: 0.28 });
  },

  tick: (pen) => tone(pen, { type: 'square', from: 2000, dur: 0.012, gain: 0.16 }),

  peel: (pen) => hiss(pen, { dur: 0.12, gain: 0.2, filter: 'bandpass', from: 800, to: 3000, q: 2 }),

  stick: (pen) => thud(pen),

  thup: (pen) => {
    tone(pen, { from: 120, to: 60, dur: 0.12, gain: 0.25 });
    return hiss(pen, { dur: 0.008, gain: 0.06, filter: 'bandpass', from: 1600, q: 1.5 });
  },

  leaf: (pen) => {
    const scale = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6];
    const count = clampCount(pen.options.count, 4);
    let end = 0;
    for (let index = 0; index < count; index += 1) {
      const note = scale[index % scale.length] ?? NOTE.C5;
      end = tone(pen, { type: 'triangle', from: note, at: index * 0.04, dur: 0.08, gain: 0.3 });
    }
    return end;
  },

  boop: (pen) => {
    tone(pen, { type: 'triangle', from: 1040, to: 760, dur: 0.07, gain: 0.08 });
    return tone(pen, { from: 520, to: 380, dur: 0.07, gain: 0.4 });
  },

  tear: (pen) => {
    for (let click = 0; click < 6; click += 1) {
      hiss(pen, {
        at: click * 0.022,
        dur: 0.01,
        gain: 0.12 + click * 0.02,
        filter: 'highpass',
        from: 3000 + click * 250,
      });
    }
    return hiss(pen, {
      at: 0.14,
      dur: 0.09,
      gain: 0.24,
      filter: 'bandpass',
      from: 1000,
      to: 4000,
      q: 1.2,
    });
  },

  stamp: (pen) => {
    tone(pen, { from: 110, to: 55, dur: 0.14, gain: 0.6 });
    hiss(pen, { dur: 0.06, gain: 0.3, filter: 'lowpass', from: 400 });
    return hiss(pen, { at: 0.03, dur: 0.012, gain: 0.1, filter: 'bandpass', from: 1800, q: 2 });
  },

  ring: (pen) => {
    hiss(pen, { dur: 0.005, gain: 0.2, filter: 'bandpass', from: 2400, q: 3 });
    tone(pen, { from: 880, at: 0.005, dur: 0.4, gain: 0.26 });
    return tone(pen, { from: 1320, at: 0.005, dur: 0.4, gain: 0.14 });
  },

  water: (pen) => {
    let end = 0;
    for (let drop = 0; drop < 4; drop += 1) {
      const wobble = (Math.random() * 2 - 1) * 100;
      end = tone(pen, {
        from: 1400 + wobble,
        to: 600 + wobble,
        at: drop * 0.07,
        dur: 0.06,
        gain: 0.26,
      });
    }
    return end;
  },

  level: (pen) => {
    thud(pen);
    const notes = [NOTE.C5, NOTE.E5, NOTE.G5];
    notes.forEach((note, index) => {
      tone(pen, { type: 'triangle', from: note, at: 0.1 + index * 0.07, dur: 0.14, gain: 0.3 });
    });
    return tone(pen, {
      type: 'triangle',
      from: NOTE.C6,
      at: 0.31,
      dur: 0.5,
      gain: 0.34,
      vibrato: 6,
    });
  },

  streak: (pen) => {
    tone(pen, { type: 'triangle', from: NOTE.G5, dur: 0.14, gain: 0.3 });
    tone(pen, { type: 'triangle', from: NOTE.D6, at: 0.12, dur: 0.26, gain: 0.32 });
    let end = 0;
    for (let shake = 0; shake < 3; shake += 1) {
      end = hiss(pen, {
        at: 0.06 + shake * 0.09,
        dur: 0.03,
        gain: 0.1,
        filter: 'highpass',
        from: 5000,
      });
    }
    return Math.max(end, 0.38);
  },

  plant: (pen) => {
    tone(pen, { from: 900, to: 300, dur: 0.4, gain: 0.22 });
    thud(pen, 0.4);
    hiss(pen, { at: 0.44, dur: 0.2, gain: 0.2, filter: 'lowpass', from: 600 });
    const sprout = [NOTE.C5, NOTE.G5, NOTE.E6];
    let end = 0;
    sprout.forEach((note, index) => {
      end = tone(pen, { from: note, at: 0.7 + index * 0.12, dur: 0.12, gain: 0.2 });
    });
    return end;
  },

  cheer: (pen) => {
    tone(pen, { from: 700, to: 1400, dur: 0.06, gain: 0.26 });
    return tone(pen, { from: 700, to: 1400, at: 0.09, dur: 0.06, gain: 0.26 });
  },

  chime: (pen) => {
    const bell = [NOTE.C5, NOTE.E5, NOTE.G5];
    let end = 0;
    bell.forEach((note, index) => {
      end = tone(pen, { from: note, at: index * 0.12, dur: 1.2, gain: 0.24 });
    });
    return end;
  },

  error: (pen) => {
    tone(pen, { from: 220, dur: 0.04, gain: 0.3 });
    return tone(pen, { from: 220, at: 0.1, dur: 0.04, gain: 0.3 });
  },
};

/** Makes room for a new voice: finished ones are forgotten, the oldest live one is faded out. */
function claimVoice(context: AudioContext): void {
  const now = context.currentTime;
  voices = voices.filter((voice) => voice.endsAt > now);
  while (voices.length >= MAX_VOICES) {
    const oldest = voices.shift();
    if (!oldest) break;
    oldest.out.gain.cancelScheduledValues(now);
    oldest.out.gain.setValueAtTime(oldest.out.gain.value, now);
    oldest.out.gain.linearRampToValueAtTime(0, now + CUT_S);
  }
}

/**
 * Plays one sound. Does nothing when sound is off, before the first gesture, while the tab is
 * hidden, or where WebAudio does not exist. Never throws.
 */
export function play(name: SfxName, options: SfxOptions = {}): void {
  if (!enabled || !unlocked) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const context = ensureContext();
  if (!context || !master) return;

  if (name === 'tick') {
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    if (now - lastTick < TICK_MIN_GAP_MS) return;
    lastTick = now;
  }

  try {
    if (context.state === 'suspended') void context.resume();
    claimVoice(context);
    const out = context.createGain();
    out.gain.value = 1;
    out.connect(master);
    const spread = 1 + (Math.random() * 2 - 1) * PITCH_SPREAD;
    const pen: Pen = {
      ctx: context,
      out,
      // A few milliseconds of lead so the envelope's attack is never in the past.
      t0: context.currentTime + 0.005,
      pitch: spread * (options.rate ?? 1),
      options,
    };
    const length = RECIPES[name](pen);
    voices.push({ out, endsAt: pen.t0 + length + 0.03 });
  } catch {
    // A sound is decoration: a failed node must never reach the user as an error.
  }
}

/** Settings → Sound. Off stops every later `play` (running tails finish by themselves). */
export function setSoundEnabled(next: boolean): void {
  enabled = next;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/** True once a user gesture has allowed audio. */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

/**
 * Marks audio as allowed. Browsers only start an AudioContext from a user gesture, so this
 * is called from the first pointer or key event and nowhere else.
 */
export function unlockAudio(): void {
  unlocked = true;
  if (!enabled) return;
  const context = ensureContext();
  if (context && context.state === 'suspended') void context.resume().catch(() => undefined);
}

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Unlocks audio on the first user gesture. Mount once in the shell; returns the cleanup.
 * Until then every `play` is a no-op, so nothing can sound before the user has acted.
 */
export function installAudioUnlock(target: Window | undefined = globalThis.window): () => void {
  if (!target || unlocked) return () => undefined;
  const remove = () => {
    for (const name of UNLOCK_EVENTS) target.removeEventListener(name, onGesture, true);
  };
  function onGesture() {
    unlockAudio();
    remove();
  }
  for (const name of UNLOCK_EVENTS) {
    target.addEventListener(name, onGesture, { capture: true, passive: true });
  }
  return remove;
}

/** Settings → Haptics. */
export function setHapticsEnabled(next: boolean): void {
  hapticsEnabled = next;
}

/** A short vibration where the device has one (the 10 ms press of the log moment). */
export function buzz(pattern: number | number[] = 10): void {
  if (!hapticsEnabled || !unlocked || typeof navigator === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when vibration is blocked by policy.
  }
}

/** Test seam: forget the context, the voices and the unlock. */
export function resetSfx(): void {
  enabled = false;
  hapticsEnabled = false;
  unlocked = false;
  ctx = null;
  master = null;
  noiseBuffer = null;
  voices = [];
  lastTick = 0;
}
