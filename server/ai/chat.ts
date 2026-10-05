/**
 * POST /api/chat: validates the request, builds the system prompt on the
 * server, calls the first usable provider with `stream: true`, fails over to
 * the next one while no token has reached the browser, and re-emits the
 * provider's stream as a small stable SSE protocol:
 *
 *   event: delta   data: {"text": "..."}
 *   event: done    data: {"provider": "Groq", "model": "...", "finish": "stop"}
 *   event: error   data: {"code": "...", "message": "..."}
 *   : keep-alive   (comment, about every 15 s)
 *
 * The browser never chooses a model, a base URL or a system prompt, and never
 * sees a key, an upstream URL or an upstream error body.
 */
import type { StreamEvent } from '../../src/ai/contract.js';
import { AI_LIMITS } from '../../src/ai/contract.js';
import { createCooldowns, failureResponse, logFailure, orderCandidates } from './failover.js';
import {
  clientKey,
  errorResponse,
  originAllowed,
  readJsonBody,
  readNumber,
  realClock,
  SAFE_MESSAGES,
  sleep,
  type Clock,
} from './http.js';
import type { RateLimiter } from './limits.js';
import { buildSystemPrompt, sanitizeContext } from './prompt.js';
import { resolveChain, type ChainEntry, type Env } from './providers.js';
import { defaultEnv, defaultLimiter } from './runtime.js';
import {
  chatRequestBody,
  classifyHttpFailure,
  createUpstreamReader,
  readCapped,
  toUpstreamMessages,
  upstreamHeaders,
  upstreamUrl,
  type UpstreamFailure,
  type UpstreamReader,
} from './upstream.js';
import { prepareHistory, validateChatBody } from './validate.js';

export interface ChatOptions {
  maxTokens: number;
  temperature: number;
  /** Per provider: connect plus time to the first content token. */
  firstTokenMs: number;
  /** Stop trying further providers after this long without a token. */
  connectDeadlineMs: number;
  /** Hard cap on one whole answer. */
  totalMs: number;
  heartbeatMs: number;
  /** Chain entries tried per request. */
  maxAttempts: number;
  /** Safety valve against a runaway stream, in characters. */
  maxOutputChars: number;
}

export interface ChatDeps {
  /** Read on every request so a changed environment takes effect without a restart. */
  env?: () => Env;
  fetch?: typeof fetch;
  clock?: Clock;
  limiter?: RateLimiter;
  /** Receives provider / model / status lines only. */
  log?: (message: string) => void;
  options?: Partial<ChatOptions>;
}

export const DEFAULT_CHAT_OPTIONS: ChatOptions = {
  maxTokens: 600,
  temperature: 0.6,
  firstTokenMs: 7000,
  connectDeadlineMs: 12_000,
  totalMs: 55_000,
  heartbeatMs: 15_000,
  maxAttempts: 4,
  maxOutputChars: 12_000,
};

type Opened =
  | { ok: true; reader: UpstreamReader; first: string; abort: () => void }
  | { ok: false; failure: UpstreamFailure };

interface OpenContext {
  fetch: typeof fetch;
  clock: Clock;
  signal: AbortSignal;
  firstTokenMs: number;
}

const failed = (partial: Partial<UpstreamFailure> & Pick<UpstreamFailure, 'kind'>): Opened => ({
  ok: false,
  failure: { rateLimited: false, gone: false, ...partial },
});

/** Connects and waits for the first content token, so a failure can still fail over. */
async function openStream(
  entry: ChainEntry,
  body: Record<string, unknown>,
  context: OpenContext,
): Promise<Opened> {
  const { clock, signal } = context;
  if (signal.aborted) return failed({ kind: 'aborted' });
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  let timedOut = false;
  const timer = clock.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, context.firstTokenMs);
  const release = (): void => {
    clock.clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  };
  let reader: UpstreamReader | undefined;
  try {
    const response = await context.fetch(upstreamUrl(entry), {
      method: 'POST',
      headers: upstreamHeaders(entry, true),
      body: JSON.stringify(body),
      signal: controller.signal,
      // A redirect would resend the Authorization header to wherever it points.
      redirect: 'manual',
    });
    if (!response.ok) {
      const text = await readCapped(response);
      controller.abort();
      release();
      return {
        ok: false,
        failure: classifyHttpFailure(
          response.status,
          text,
          response.headers.get('retry-after'),
          clock.now(),
        ),
      };
    }
    if (!response.body) {
      controller.abort();
      release();
      return failed({ kind: 'bad_response' });
    }
    reader = createUpstreamReader(response.body);
    for (;;) {
      const item = await reader.next();
      if (item.type === 'text') {
        // Past this point the stream belongs to the response: no more failover.
        clock.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        return { ok: true, reader, first: item.text, abort: onAbort };
      }
      if (item.type === 'error') {
        reader.cancel();
        controller.abort();
        release();
        return failed({
          kind: 'stream',
          ...(item.status !== undefined ? { status: item.status } : {}),
          rateLimited: item.rateLimited,
        });
      }
      if (item.type === 'finish' || item.type === 'end') {
        // An empty answer (the reasoning used the whole budget, or the model refused silently).
        reader.cancel();
        controller.abort();
        release();
        return failed({ kind: 'empty' });
      }
    }
  } catch {
    reader?.cancel();
    controller.abort();
    release();
    if (signal.aborted) return failed({ kind: 'aborted' });
    return failed({ kind: timedOut ? 'timeout' : 'network' });
  }
}

function encodeEvent(event: StreamEvent['type'], data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

interface StreamArgs {
  entry: ChainEntry;
  opened: Extract<Opened, { ok: true }>;
  signal: AbortSignal;
  clock: Clock;
  release: () => void;
  options: ChatOptions;
}

function streamAnswer({ entry, opened, signal, clock, release, options }: StreamArgs): Response {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let heartbeat: unknown;
  let total: unknown;
  let sent = 0;

  const finishStream = (): void => {
    if (closed) return;
    closed = true;
    clock.clearTimeout(heartbeat);
    clock.clearTimeout(total);
    signal.removeEventListener('abort', finishStream);
    opened.reader.cancel();
    opened.abort();
    release();
    try {
      controller?.close();
    } catch {
      // Already closed by the consumer.
    }
  };

  const armHeartbeat = (): void => {
    clock.clearTimeout(heartbeat);
    heartbeat = clock.setTimeout(() => {
      if (closed) return;
      write(': keep-alive\n\n');
    }, options.heartbeatMs);
  };

  const write = (text: string): void => {
    if (closed || !controller) return;
    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      finishStream();
      return;
    }
    armHeartbeat();
  };

  const emitError = (code: 'upstream_unavailable' | 'rate_limited' | 'timeout'): void => {
    write(encodeEvent('error', { code, message: SAFE_MESSAGES[code] }));
  };

  const emitDone = (finish: string): void => {
    write(
      encodeEvent('done', {
        provider: entry.label,
        model: entry.model,
        finish: finish.slice(0, 32),
      }),
    );
  };

  const pump = async (): Promise<void> => {
    try {
      for (;;) {
        const item = await opened.reader.next();
        if (closed) return;
        if (item.type === 'text') {
          sent += item.text.length;
          write(encodeEvent('delta', { text: item.text }));
          if (sent > options.maxOutputChars) {
            emitDone('length');
            return finishStream();
          }
          continue;
        }
        if (item.type === 'finish') emitDone(item.reason);
        else if (item.type === 'end' && item.clean) emitDone('stop');
        else if (item.type === 'error')
          emitError(item.rateLimited ? 'rate_limited' : 'upstream_unavailable');
        // The provider hung up without finishing: the answer is truncated.
        else emitError('upstream_unavailable');
        return finishStream();
      }
    } catch {
      if (closed) return;
      emitError('upstream_unavailable');
      finishStream();
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      signal.addEventListener('abort', finishStream, { once: true });
      total = clock.setTimeout(() => {
        emitError('timeout');
        finishStream();
      }, options.totalMs);
      write(encodeEvent('delta', { text: opened.first }));
      sent = opened.first.length;
      void pump();
    },
    cancel() {
      finishStream();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function createChatHandler(deps: ChatDeps = {}): (request: Request) => Promise<Response> {
  const getEnv = deps.env ?? defaultEnv;
  const doFetch = deps.fetch ?? ((input, init) => fetch(input, init));
  const clock = deps.clock ?? realClock;
  const options: ChatOptions = { ...DEFAULT_CHAT_OPTIONS, ...deps.options };
  const limiter = deps.limiter ?? defaultLimiter(getEnv(), clock);
  const cooldowns = createCooldowns(clock);
  const log = deps.log ?? ((message: string) => console.warn(message));

  async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST')
      return errorResponse('method_not_allowed', SAFE_MESSAGES.method_not_allowed, {
        headers: { allow: 'POST' },
      });
    const env = getEnv();
    if (!originAllowed(request, env))
      return errorResponse('forbidden_origin', SAFE_MESSAGES.forbidden_origin);

    const maxTokens = readNumber(env.AI_MAX_OUTPUT_TOKENS, options.maxTokens, 64, 1500);
    const chain = resolveChain(env, 'chat');
    if (chain.length === 0) return errorResponse('not_configured', SAFE_MESSAGES.not_configured);

    const taken = limiter.take(clientKey(request));
    if (!taken.ok)
      return errorResponse('rate_limited', SAFE_MESSAGES.rate_limited, {
        retryAfterSec: taken.retryAfterSec,
      });

    const body = await readJsonBody(request, AI_LIMITS.maxBodyBytes);
    if (!body.ok) return body.response;
    const validated = validateChatBody(body.value);
    if (!validated.ok) return errorResponse('invalid_request', validated.message);

    const history = prepareHistory(validated.value.messages);
    const { context, catalogue } = sanitizeContext(validated.value.rawContext);
    const system = buildSystemPrompt(context, catalogue);

    const release = limiter.acquire();
    if (!release)
      return errorResponse('rate_limited', SAFE_MESSAGES.rate_limited, { retryAfterSec: 5 });

    let handedOver = false;
    try {
      const failures: UpstreamFailure[] = [];
      const started = clock.now();
      const openContext: OpenContext = {
        fetch: doFetch,
        clock,
        signal: request.signal,
        firstTokenMs: options.firstTokenMs,
      };

      for (const entry of orderCandidates(chain, cooldowns, options.maxAttempts)) {
        if (clock.now() - started > options.connectDeadlineMs) break;
        const payload = chatRequestBody(entry, toUpstreamMessages(entry, system, history), {
          stream: true,
          maxTokens,
          temperature: options.temperature,
        });
        let result = await openStream(entry, payload, openContext);
        if (
          !result.ok &&
          result.failure.rateLimited &&
          result.failure.kind !== 'aborted' &&
          result.failure.retryAfterSec !== undefined &&
          result.failure.retryAfterSec <= 2
        ) {
          // A short rate-limit window is cheaper to wait out than a slower model.
          await sleep(clock, Math.max(250, result.failure.retryAfterSec * 1000), request.signal);
          result = await openStream(entry, payload, openContext);
        }
        if (result.ok) {
          handedOver = true;
          return streamAnswer({
            entry,
            opened: result,
            signal: request.signal,
            clock,
            release,
            options,
          });
        }
        if (result.failure.kind === 'aborted')
          return errorResponse('aborted', SAFE_MESSAGES.aborted);
        failures.push(result.failure);
        cooldowns.mark(entry, result.failure);
        logFailure(log, entry, result.failure);
      }
      return failureResponse(failures);
    } finally {
      if (!handedOver) release();
    }
  }

  return async (request) => {
    try {
      return await handle(request);
    } catch {
      return errorResponse('internal', SAFE_MESSAGES.internal);
    }
  };
}
