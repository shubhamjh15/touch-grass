'use client';

import { useEffect } from 'react';
import { useGameEvents, useSettings, useWorldSnapshot, worldPulsesFor } from '@/game';
import { setMotionPreference } from '@/lib/hooks';
import { setHapticsEnabled, setSoundEnabled } from '@/lib/sfx';
import { emitPulse, setWorldSnapshot, useWorldStore } from '@/world';

/**
 * The one place the game talks to the Grove. The world never imports the game: this
 * component hands it a snapshot whenever the game changes (the store's minute tick moves
 * the sky's hour), forwards one-shot pulses, and applies the user's 3D, motion, sound and
 * haptics settings to the modules that need them. Renders nothing.
 */
export function WorldBridge() {
  const snapshot = useWorldSnapshot();
  const settings = useSettings();

  useEffect(() => {
    setWorldSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    useWorldStore.getState().setPreference(settings.graphics);
  }, [settings.graphics]);

  useEffect(() => {
    // One setting, three readers: the world, the CSS `calm:` variant and `useReducedMotion()`.
    useWorldStore.getState().setMotion(settings.motion);
    setMotionPreference(settings.motion);
  }, [settings.motion]);

  useEffect(() => {
    setSoundEnabled(settings.sound);
  }, [settings.sound]);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  useGameEvents((events) => {
    for (const pulse of worldPulsesFor(events)) emitPulse(pulse);
  });

  return null;
}
