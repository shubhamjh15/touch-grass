import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buzz,
  installAudioUnlock,
  isAudioUnlocked,
  isSoundEnabled,
  play,
  resetSfx,
  setHapticsEnabled,
  setSoundEnabled,
  SFX_NAMES,
  unlockAudio,
} from './sfx';

/** Enough of WebAudio for the synth to schedule its nodes; nothing makes a sound. */
function installFakeAudio() {
  const created = { contexts: 0, oscillators: 0, sources: 0, voices: 0 };
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() });

  class FakeAudioContext {
    currentTime = 0;
    sampleRate = 8000;
    state: AudioContextState = 'running';
    destination = {};
    constructor() {
      created.contexts += 1;
    }
    resume = vi.fn(() => Promise.resolve());
    createGain() {
      created.voices += 1;
      return { ...node(), gain: param() };
    }
    createOscillator() {
      created.oscillators += 1;
      return { ...node(), type: 'sine', frequency: param(), detune: param() };
    }
    createBiquadFilter() {
      return { ...node(), type: 'lowpass', frequency: param(), Q: param() };
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      created.sources += 1;
      return { ...node(), buffer: null, loop: false };
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext);
  return created;
}

describe('sfx', () => {
  let created: ReturnType<typeof installFakeAudio>;

  beforeEach(() => {
    resetSfx();
    created = installFakeAudio();
    // Sound and haptics are off until the settings say otherwise; most tests want them on.
    setSoundEnabled(true);
    setHapticsEnabled(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetSfx();
  });

  it('is off by default: a gesture alone does not make it sound', () => {
    resetSfx();
    expect(isSoundEnabled()).toBe(false);
    unlockAudio();
    play('tap');
    expect(created.contexts).toBe(0);
  });

  it('stays silent until the first user gesture', () => {
    play('tap');
    expect(created.contexts).toBe(0);
    expect(isAudioUnlocked()).toBe(false);

    unlockAudio();
    play('tap');
    expect(created.contexts).toBe(1);
    expect(created.oscillators).toBeGreaterThan(0);
  });

  it('unlocks on the first pointer or key event and then stops listening', () => {
    const remove = installAudioUnlock(window);
    play('stick');
    expect(created.oscillators).toBe(0);

    window.dispatchEvent(new Event('pointerdown'));
    expect(isAudioUnlocked()).toBe(true);
    play('stick');
    expect(created.oscillators).toBeGreaterThan(0);
    remove();
  });

  it('plays nothing while the Sound setting is off, and resumes when it is back on', () => {
    unlockAudio();
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    for (const name of SFX_NAMES) play(name);
    expect(created.oscillators).toBe(0);
    expect(created.sources).toBe(0);

    setSoundEnabled(true);
    play('level');
    expect(created.oscillators).toBeGreaterThan(0);
  });

  it('does not create an audio context when sound is off at the first gesture', () => {
    setSoundEnabled(false);
    unlockAudio();
    play('tap');
    expect(created.contexts).toBe(0);
  });

  it('plays nothing while the tab is hidden', () => {
    unlockAudio();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    play('ring');
    expect(created.oscillators).toBe(0);
    visibility.mockRestore();
  });

  it('has a recipe for every sound of the palette and none of them throws', () => {
    unlockAudio();
    for (const name of SFX_NAMES) {
      expect(() => play(name, { count: 5, on: false, rate: 1.2 })).not.toThrow();
    }
    expect(created.oscillators + created.sources).toBeGreaterThanOrEqual(SFX_NAMES.length);
  });

  it('rate-limits the tick to thirty a second', () => {
    unlockAudio();
    const clock = vi.spyOn(performance, 'now');
    clock.mockReturnValue(1000);
    play('tick');
    const afterFirst = created.oscillators;
    clock.mockReturnValue(1010);
    play('tick');
    expect(created.oscillators).toBe(afterFirst);
    clock.mockReturnValue(1040);
    play('tick');
    expect(created.oscillators).toBeGreaterThan(afterFirst);
    clock.mockRestore();
  });

  it('is a no-op where WebAudio does not exist', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    unlockAudio();
    expect(() => play('stamp')).not.toThrow();
  });

  it('vibrates only when Haptics is on and a gesture has happened', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });

    buzz(10);
    expect(vibrate).not.toHaveBeenCalled();

    unlockAudio();
    buzz(10);
    expect(vibrate).toHaveBeenCalledTimes(1);

    setHapticsEnabled(false);
    buzz(10);
    expect(vibrate).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(navigator, 'vibrate');
  });
});
