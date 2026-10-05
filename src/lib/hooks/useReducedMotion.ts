'use client';

import { useSyncExternalStore } from 'react';

/** Settings → Motion. `system` follows the OS, `reduced` forces calm, `full` overrides the OS. */
export type MotionPreference = 'system' | 'reduced' | 'full';

const QUERY = '(prefers-reduced-motion: reduce)';
const ATTRIBUTE = 'data-motion';

/**
 * Writes the Motion setting where both CSS (`calm:` variant, the base-layer reset) and
 * `useReducedMotion` read it. Called by the shell whenever the setting changes.
 */
export function setMotionPreference(preference: MotionPreference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute(ATTRIBUTE);
  else root.setAttribute(ATTRIBUTE, preference);
}

export function getMotionPreference(): MotionPreference {
  const value = document.documentElement.getAttribute(ATTRIBUTE);
  return value === 'reduced' || value === 'full' ? value : 'system';
}

/** Non-hook read, for event handlers and animation code outside React. */
export function prefersReducedMotion(): boolean {
  const preference = getMotionPreference();
  if (preference === 'reduced') return true;
  if (preference === 'full') return false;
  return window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATTRIBUTE] });
  return () => {
    list.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

/**
 * True when motion must be calm: the Motion setting says so, or it follows an OS that does.
 * Use this instead of Framer Motion's hook, which cannot see the in-app setting.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
