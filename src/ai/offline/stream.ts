/**
 * Plays a finished offline answer word by word through the same `onDelta`
 * interface the live stream uses, so the chat UI has one code path.
 */
import type { CoachContext } from '../contract';
import { respondOffline, type OfflineReply } from './respond';

export interface OfflineStreamOptions {
  onDelta?: (delta: string, fullText: string) => void;
  signal?: AbortSignal;
  /** Pause between words. Zero delivers everything at once (reduced motion, tests). */
  wordDelayMs?: number;
  /** Injectable for tests. Must resolve early when the signal aborts. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const DEFAULT_DELAY_MS = 26;

/** Words with their trailing whitespace, so concatenating the pieces rebuilds the text exactly. */
export function splitWords(text: string): string[] {
  return text.match(/^\s+|\S+\s*/g) ?? [];
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** Resolves with the text delivered so far: all of it, or the part before an abort. */
export async function streamOfflineText(
  text: string,
  {
    onDelta,
    signal,
    wordDelayMs = DEFAULT_DELAY_MS,
    sleep = defaultSleep,
  }: OfflineStreamOptions = {},
): Promise<string> {
  let delivered = '';
  for (const word of splitWords(text)) {
    if (signal?.aborted) break;
    delivered += word;
    onDelta?.(word, delivered);
    // Chip tokens are one unit: no pause makes them feel like typing.
    if (wordDelayMs > 0 && !word.startsWith('[[')) await sleep(wordDelayMs, signal);
  }
  return delivered;
}

export interface OfflineAnswer extends OfflineReply {
  /** What was actually delivered; shorter than `text` when the caller aborted. */
  delivered: string;
}

export async function runOfflineCoach(
  params: { message: string; context?: CoachContext } & OfflineStreamOptions,
): Promise<OfflineAnswer> {
  const { message, context, ...stream } = params;
  const reply = respondOffline(message, context);
  const delivered = await streamOfflineText(reply.text, stream);
  return { ...reply, delivered };
}
