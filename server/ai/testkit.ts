/**
 * Test doubles for the proxy: a manual clock, scripted upstream responses and
 * helpers to read the SSE the handler produces. Used by the *.test.ts files
 * only; nothing in the functions imports it.
 */
import type { Clock } from './http';

export class ManualClock implements Clock {
  private time = 0;
  private nextId = 0;
  private readonly timers = new Map<number, { at: number; run: () => void }>();

  now(): number {
    return this.time;
  }

  setTimeout(run: () => void, ms: number): unknown {
    this.nextId += 1;
    this.timers.set(this.nextId, { at: this.time + ms, run });
    return this.nextId;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  get pending(): number {
    return this.timers.size;
  }

  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.time = Math.max(this.time, due[1].at);
      due[1].run();
    }
    this.time = target;
  }
}

/** Lets pending promise callbacks run. */
export async function settle(times = 6): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

const encoder = new TextEncoder();

export function chunk(content: string, finish: string | null = null): string {
  return `data: ${JSON.stringify({
    choices: [{ index: 0, delta: content === '' ? {} : { content }, finish_reason: finish }],
  })}\n\n`;
}

export const DONE = 'data: [DONE]\n\n';

export function sseResponse(frames: readonly string[], status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } });
}

export interface Controlled {
  response: Response;
  push(text: string): void;
  close(): void;
  fail(): void;
  readonly cancelled: boolean;
}

/** A provider stream that stays open until the test closes it or the proxy cancels it. */
export function controlledSse(signal?: AbortSignal | null): Controlled {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      signal?.addEventListener('abort', () => {
        cancelled = true;
        try {
          c.error(new DOMException('Aborted', 'AbortError'));
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    response: new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }),
    push: (text) => controller?.enqueue(encoder.encode(text)),
    close: () => controller?.close(),
    fail: () => controller?.error(new Error('socket hang up')),
    get cancelled() {
      return cancelled;
    },
  };
}

/** Never answers; rejects with an AbortError when the proxy gives up. */
export function hang(signal?: AbortSignal | null): Promise<Response> {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
}

export interface RecordedCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  redirect: string | undefined;
  signal: AbortSignal | null | undefined;
}

export type Script = (call: RecordedCall) => Response | Promise<Response>;

/** A fetch that answers from a script, one entry per call, and records what it was sent. */
export function scriptedFetch(script: readonly Script[]): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fake = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const call: RecordedCall = {
      url: String(input),
      headers,
      body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
        string,
        unknown
      >,
      redirect: init?.redirect,
      signal: init?.signal,
    };
    calls.push(call);
    const step = script[calls.length - 1] ?? script[script.length - 1];
    if (!step) throw new Error('no script');
    return step(call);
  }) as typeof fetch;
  return { fetch: fake, calls };
}

export function jsonBody(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export const ORIGIN = 'https://eco.test';

export function postRequest(
  body: unknown,
  options: {
    path?: string;
    headers?: Record<string, string>;
    raw?: BodyInit;
    signal?: AbortSignal;
  } = {},
): Request {
  return new Request(`${ORIGIN}${options.path ?? '/api/chat'}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...options.headers },
    body: options.raw ?? JSON.stringify(body),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

export interface ParsedEvent {
  event: string;
  data: unknown;
}

export function parseEvents(text: string): ParsedEvent[] {
  return text
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block !== '' && !block.startsWith(':'))
    .map((block) => {
      const lines = block.split('\n');
      const event = lines.find((line) => line.startsWith('event: '))?.slice(7) ?? 'message';
      const data = lines
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n');
      return { event, data: JSON.parse(data) as unknown };
    });
}

export const GROQ_KEY = 'gsk_' + 'k'.repeat(40);
export const GEMINI_KEY = 'AIza' + 'g'.repeat(35);

export const chatMessages = [{ role: 'user', content: 'One easy win for today?' }];
