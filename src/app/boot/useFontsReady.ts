'use client';

import { useSyncExternalStore } from 'react';

/** The three self-hosted families (src/styles/fonts.ts). */
const FAMILIES = ['Space Grotesk Variable', 'Tilt Warp Variable', 'Martian Mono Variable'];

/**
 * The longest the splash will wait for fonts. Not a delay: fonts normally arrive in well under
 * a second from the same origin, and a font that never loads must not hold the app hostage.
 */
const FONT_PATIENCE_MS = 2500;

let ready = false;
let started = false;
const listeners = new Set<() => void>();

function finish(): void {
  if (ready) return;
  ready = true;
  for (const listener of listeners) listener();
}

function start(): void {
  if (started) return;
  started = true;
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts || typeof fonts.load !== 'function') {
    finish();
    return;
  }
  const timer = window.setTimeout(finish, FONT_PATIENCE_MS);
  Promise.all(FAMILIES.map((family) => fonts.load(`1em "${family}"`)))
    .then(() => fonts.ready)
    .catch(() => undefined)
    .then(() => {
      window.clearTimeout(timer);
      finish();
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

/**
 * True once the product's fonts are usable (or have clearly failed), so the first screen the
 * user sees is set in the right type instead of reflowing a moment later.
 */
export function useFontsReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => false,
  );
}
