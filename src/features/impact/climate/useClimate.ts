'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOnlineStatus } from '@/lib/hooks';
import { parseClimatePayload, type ClimatePayload } from './contract';

export const CLIMATE_ENDPOINT = '/api/climate';
const TIMEOUT_MS = 12_000;

export type ClimateState =
  | { phase: 'loading' }
  /** `server`: our API answered. `bundled`: it could not be reached, so this is the saved copy. */
  | { phase: 'ready'; payload: ClimatePayload; origin: 'server' | 'bundled' }
  | { phase: 'error' };

/** The last answer from our API, so switching views does not flash a skeleton. */
let remembered: ClimatePayload | null = null;

/** For tests: forget the remembered answer. */
export function resetClimateMemory(): void {
  remembered = null;
}

async function fromServer(signal: AbortSignal): Promise<ClimatePayload> {
  const response = await fetch(CLIMATE_ENDPOINT, {
    signal,
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`climate: ${response.status}`);
  const payload = parseClimatePayload(await response.json());
  if (!payload) throw new Error('climate: malformed answer');
  return payload;
}

/** The copy saved with the app, in its own chunk: only fetched when the API cannot be reached. */
async function fromBundle(): Promise<ClimatePayload> {
  const module = await import('../../../../server/climate/snapshot');
  return module.CLIMATE_SNAPSHOT;
}

/**
 * The planet's readings for the page. Asks our own API (never a third party); if that fails or
 * the device is offline it falls back to the bundled snapshot, and tries the API again when the
 * connection returns or the person asks.
 */
export function useClimate(): { state: ClimateState; retry: () => void } {
  const online = useOnlineStatus();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ClimateState>(() =>
    remembered ? { phase: 'ready', payload: remembered, origin: 'server' } : { phase: 'loading' },
  );

  useEffect(() => {
    if (remembered && attempt === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    let active = true;
    const load = online ? fromServer(controller.signal) : Promise.reject(new Error('offline'));
    load
      .then((payload) => {
        remembered = payload;
        if (active) setState({ phase: 'ready', payload, origin: 'server' });
      })
      .catch(() =>
        fromBundle().then(
          (payload) => {
            if (active) setState({ phase: 'ready', payload, origin: 'bundled' });
          },
          () => {
            if (active) setState({ phase: 'error' });
          },
        ),
      )
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, online]);

  const retry = useCallback(() => {
    remembered = null;
    setState({ phase: 'loading' });
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
}
