/**
 * The browser's only door to the AI stack: `/api/status`, `/api/chat` and
 * `/api/estimate` on the same origin. The browser never talks to a provider and
 * never holds a key. A static preview without functions (the server answers
 * with HTML) and a dead network are both treated as "no live coach", which the
 * callers answer with the built-in coach.
 */
import {
  AI_LIMITS,
  ESTIMATE_CATEGORIES,
  type ActionEstimate,
  type AiErrorBody,
  type AiErrorCode,
  type AiStatus,
  type ChatMessage,
  type ChatResult,
  type ClientAiStatus,
  type CoachContext,
  type EstimateCatalogueEntry,
  type StreamEvent,
} from './contract';
import { readSse } from './sse';

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retryAfterSec: number | undefined;
  /** Text that had already streamed in when the failure happened. Empty means nothing reached the user. */
  readonly partial: string;
  readonly status: number | undefined;

  constructor(
    code: AiErrorCode,
    message: string,
    extra: { retryAfterSec?: number; partial?: string; status?: number } = {},
  ) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.retryAfterSec = extra.retryAfterSec;
    this.partial = extra.partial ?? '';
    this.status = extra.status;
  }
}

export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError;
}

const KNOWN_CODES: readonly AiErrorCode[] = [
  'not_configured',
  'rate_limited',
  'upstream_unavailable',
  'invalid_request',
  'forbidden_origin',
  'too_large',
  'method_not_allowed',
  'estimate_failed',
  'timeout',
  'internal',
  'offline',
  'aborted',
];

function isCode(value: unknown): value is AiErrorCode {
  return typeof value === 'string' && (KNOWN_CODES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// {{name}}: the model never learns the user's name, the browser fills it in
// ---------------------------------------------------------------------------

const NAME_TOKEN = '{{name}}';

function partialSuffix(text: string): string {
  for (let length = Math.min(text.length, NAME_TOKEN.length - 1); length > 0; length -= 1) {
    if (NAME_TOKEN.startsWith(text.slice(text.length - length)))
      return text.slice(text.length - length);
  }
  return '';
}

export interface NameFilter {
  push(text: string): string;
  flush(): string;
}

/** Replaces `{{name}}` in a stream, even when the token is split across deltas. */
export function createNameFilter(name: string | undefined): NameFilter {
  const clean = [...(name ?? '')]
    .filter((char) => char.charCodeAt(0) > 31 && char !== '<' && char !== '>')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  const replacement = clean === '' ? 'friend' : clean;
  let carry = '';
  return {
    push(text) {
      const joined = carry + text;
      const keep = partialSuffix(joined);
      carry = keep;
      return joined
        .slice(0, joined.length - keep.length)
        .split(NAME_TOKEN)
        .join(replacement);
    },
    flush() {
      const rest = carry;
      carry = '';
      return rest.split(NAME_TOKEN).join(replacement);
    },
  };
}

// ---------------------------------------------------------------------------
// Wire helpers
// ---------------------------------------------------------------------------

/** Everything the coach may know, minus the display name, which never leaves the device. */
export function toWireContext(
  context: CoachContext | undefined,
): Omit<CoachContext, 'displayName'> {
  if (!context) return {};
  const { displayName: _name, ...rest } = context;
  void _name;
  return rest;
}

function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`;
}

/** The most recent turns, each within the server's per-message limit. */
export function prepareMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-AI_LIMITS.historyMessages);
  return recent.map((message, index) => {
    const isLast = index === recent.length - 1;
    const max = message.role === 'user' ? AI_LIMITS.maxUserChars : AI_LIMITS.maxAssistantChars;
    if (isLast && message.role === 'user' && [...message.content].length > max)
      throw new AiError('invalid_request', `Keep messages under ${max} characters.`);
    return { role: message.role, content: clip(message.content, max) };
  });
}

function mapStatus(status: number): AiErrorCode {
  if (status === 429) return 'rate_limited';
  if (status === 403) return 'forbidden_origin';
  if (status === 413) return 'too_large';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status === 404 || status === 405 || status === 501) return 'not_configured';
  if (status === 503) return 'not_configured';
  if (status === 504 || status === 408) return 'timeout';
  return 'upstream_unavailable';
}

async function errorFromResponse(response: Response): Promise<AiError> {
  const type = response.headers.get('content-type') ?? '';
  const retryHeader = Number(response.headers.get('retry-after'));
  const retryAfterSec = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined;
  if (type.includes('json')) {
    try {
      const body = (await response.json()) as Partial<AiErrorBody>;
      const error = body.error;
      if (isRecord(error) && isCode(error.code)) {
        return new AiError(
          error.code,
          typeof error.message === 'string' ? error.message : error.code,
          {
            status: response.status,
            retryAfterSec:
              typeof error.retryAfterSec === 'number' ? error.retryAfterSec : retryAfterSec,
          },
        );
      }
    } catch {
      // Fall through to the status mapping.
    }
    return new AiError(mapStatus(response.status), `Request failed (${response.status}).`, {
      status: response.status,
      retryAfterSec,
    });
  }
  // HTML or plain text: a static host with no functions behind /api.
  return new AiError('not_configured', 'The AI service is not available here.', {
    status: response.status,
  });
}

export interface AiClientOptions {
  fetch?: typeof fetch;
  /** Where the functions live. Defaults to the same origin's /api. */
  baseUrl?: string;
  /** How long a successful status is trusted, in ms. */
  statusTtlMs?: number;
  /** No first token within this long means "timeout" so the built-in coach can answer (spec: 15 s). */
  firstTokenMs?: number;
  /** Per-request ceiling for status and estimate calls. */
  timeoutMs?: number;
  now?: () => number;
}

export interface StreamChatParams {
  messages: readonly ChatMessage[];
  context?: CoachContext;
  signal?: AbortSignal;
  /** Called with each new piece of text and the whole answer so far. */
  onDelta?: (delta: string, fullText: string) => void;
}

export interface EstimateExtras {
  quantity?: number;
  catalogue?: readonly EstimateCatalogueEntry[];
  signal?: AbortSignal;
}

export interface AiClient {
  getAiStatus(options?: { refresh?: boolean; signal?: AbortSignal }): Promise<ClientAiStatus>;
  streamChat(params: StreamChatParams): Promise<ChatResult>;
  estimateAction(text: string, region: string, extras?: EstimateExtras): Promise<ActionEstimate>;
  /** Forget the cached status (for example when the browser comes back online). */
  resetStatus(): void;
}

function offlineStatus(reason: ClientAiStatus['reason']): ClientAiStatus {
  return { configured: false, provider: null, model: null, reason };
}

function isAiStatus(value: unknown): value is AiStatus {
  return (
    isRecord(value) &&
    typeof value.configured === 'boolean' &&
    (value.provider === null || typeof value.provider === 'string') &&
    (value.model === null || typeof value.model === 'string')
  );
}

/**
 * Strict client-side check of an estimate, so a bad server never reaches the UI
 * (spec 8.8). Confidence is forced to "low": an AI estimate never claims more.
 */
export function parseActionEstimate(value: unknown): ActionEstimate | null {
  if (!isRecord(value)) return null;
  const { category, effort, confidence } = value;
  if (typeof value.isClimateAction !== 'boolean') return null;
  if (value.matchedActionId !== null && typeof value.matchedActionId !== 'string') return null;
  const variant = value.variant ?? null;
  if (variant !== null && (typeof variant !== 'string' || variant.length > 40)) return null;
  if (typeof value.title !== 'string' || value.title === '' || value.title.length > 60) return null;
  if (typeof value.emoji !== 'string' || value.emoji === '' || value.emoji.length > 16) return null;
  if (
    typeof category !== 'string' ||
    !(ESTIMATE_CATEGORIES as readonly string[]).includes(category)
  )
    return null;
  if (effort !== 1 && effort !== 2 && effort !== 3 && effort !== 4) return null;
  if (typeof value.qty !== 'number' || !Number.isFinite(value.qty) || value.qty <= 0) return null;
  if (typeof value.unit !== 'string') return null;
  if (value.co2eKg !== null) {
    if (typeof value.co2eKg !== 'number' || !Number.isFinite(value.co2eKg)) return null;
    if (value.co2eKg < 0 || value.co2eKg > AI_LIMITS.maxEstimateKg) return null;
  }
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') return null;
  if (typeof value.rationale !== 'string' || value.rationale.length > 160) return null;
  return {
    isClimateAction: value.isClimateAction,
    matchedActionId: value.matchedActionId,
    variant,
    title: value.title,
    emoji: value.emoji,
    category: category as ActionEstimate['category'],
    effort,
    qty: value.qty,
    unit: value.unit,
    co2eKg: value.co2eKg,
    confidence: 'low',
    rationale: value.rationale,
  };
}

export function createAiClient(options: AiClientOptions = {}): AiClient {
  const base = (options.baseUrl ?? '/api').replace(/\/+$/, '');
  const ttl = options.statusTtlMs ?? 5 * 60_000;
  const failureTtl = 30_000;
  const timeoutMs = options.timeoutMs ?? 8000;
  const firstTokenMs = options.firstTokenMs ?? 15_000;
  const now = options.now ?? (() => Date.now());
  const doFetch: typeof fetch = (input, init) => (options.fetch ?? globalThis.fetch)(input, init);

  let cached: { value: ClientAiStatus; at: number } | null = null;
  let inflight: Promise<ClientAiStatus> | null = null;

  /** Fetch with a timeout and the caller's signal, mapping transport failures to AiError. */
  async function send(
    path: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
    limitMs: number | null,
  ): Promise<Response> {
    if (signal?.aborted) throw new AiError('aborted', 'The request was cancelled.');
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    let timedOut = false;
    const timer =
      limitMs === null
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, limitMs);
    try {
      return await doFetch(`${base}${path}`, { ...init, signal: controller.signal });
    } catch {
      if (signal?.aborted) throw new AiError('aborted', 'The request was cancelled.');
      if (timedOut) throw new AiError('timeout', 'The AI service took too long to answer.');
      throw new AiError('offline', 'The AI service could not be reached.');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async function loadStatus(signal?: AbortSignal): Promise<ClientAiStatus> {
    try {
      const response = await send(
        '/status',
        { method: 'GET', headers: { accept: 'application/json' } },
        signal,
        6000,
      );
      if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json'))
        return offlineStatus('no_functions');
      const body: unknown = await response.json();
      if (!isAiStatus(body)) return offlineStatus('no_functions');
      return { ...body, reason: body.configured ? 'ready' : 'not_configured' };
    } catch (error) {
      if (isAiError(error) && error.code === 'aborted') throw error;
      return offlineStatus(
        isAiError(error) && error.code === 'offline' ? 'offline' : 'no_functions',
      );
    }
  }

  async function streamOnce(
    { messages, context, signal, onDelta }: StreamChatParams,
    onFirstDelta: () => void,
  ): Promise<ChatResult> {
    const body = JSON.stringify({
      messages: prepareMessages(messages),
      context: toWireContext(context),
    });
    const response = await send(
      '/chat',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body,
      },
      signal,
      null,
    );
    if (!response.ok) throw await errorFromResponse(response);
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('text/event-stream') || !response.body)
      throw new AiError('not_configured', 'The AI service is not available here.', {
        status: response.status,
      });

    const filter = createNameFilter(context?.displayName);
    let text = '';
    const deliver = (piece: string): void => {
      if (piece === '') return;
      text += piece;
      onDelta?.(piece, text);
    };
    let meta: { provider: string; model: string; finish: string } | null = null;

    try {
      for await (const event of readSse(response.body, signal)) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          continue;
        }
        if (!isRecord(parsed)) continue;
        const kind = event.event as StreamEvent['type'];
        if (kind === 'delta' && typeof parsed.text === 'string') {
          onFirstDelta();
          deliver(filter.push(parsed.text));
        } else if (kind === 'done') {
          deliver(filter.flush());
          meta = {
            provider: typeof parsed.provider === 'string' ? parsed.provider : 'AI',
            model: typeof parsed.model === 'string' ? parsed.model : '',
            finish: typeof parsed.finish === 'string' ? parsed.finish : 'stop',
          };
          break;
        } else if (kind === 'error') {
          deliver(filter.flush());
          throw new AiError(
            isCode(parsed.code) ? parsed.code : 'upstream_unavailable',
            typeof parsed.message === 'string' ? parsed.message : 'The answer was interrupted.',
            { partial: text },
          );
        }
      }
    } catch (error) {
      if (isAiError(error)) throw error;
      if (signal?.aborted)
        throw new AiError('aborted', 'The request was cancelled.', { partial: text });
      throw new AiError('offline', 'The connection dropped.', { partial: text });
    }
    if (signal?.aborted)
      throw new AiError('aborted', 'The request was cancelled.', { partial: text });
    if (!meta)
      throw new AiError('upstream_unavailable', 'The answer was interrupted.', { partial: text });
    return { text, ...meta };
  }

  return {
    async getAiStatus({ refresh = false, signal } = {}) {
      const age = cached ? now() - cached.at : Infinity;
      const limit =
        cached?.value.reason === 'ready' || cached?.value.reason === 'not_configured'
          ? ttl
          : failureTtl;
      if (!refresh && cached && age < limit) return cached.value;
      inflight ??= loadStatus().then((value) => {
        cached = { value, at: now() };
        return value;
      });
      const pending = inflight;
      void pending.finally(() => {
        if (inflight === pending) inflight = null;
      });
      if (!signal) return pending;
      if (signal.aborted) throw new AiError('aborted', 'The request was cancelled.');
      return new Promise<ClientAiStatus>((resolve, reject) => {
        const onAbort = (): void => reject(new AiError('aborted', 'The request was cancelled.'));
        signal.addEventListener('abort', onAbort, { once: true });
        pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
      });
    },

    async streamChat(params) {
      const { signal } = params;
      const own = new AbortController();
      const relay = (): void => own.abort();
      signal?.addEventListener('abort', relay, { once: true });
      if (signal?.aborted) own.abort();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        own.abort();
      }, firstTokenMs);
      try {
        return await streamOnce({ ...params, signal: own.signal }, () => clearTimeout(timer));
      } catch (error) {
        if (timedOut && isAiError(error) && error.code === 'aborted' && error.partial === '')
          throw new AiError('timeout', 'The coach took too long to answer.');
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', relay);
      }
    },

    async estimateAction(text, region, extras = {}) {
      const response = await send(
        '/estimate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            text,
            region,
            ...(extras.quantity !== undefined ? { qty: extras.quantity } : {}),
            ...(extras.catalogue ? { catalogue: extras.catalogue } : {}),
          }),
        },
        extras.signal,
        timeoutMs,
      );
      if (!response.ok) throw await errorFromResponse(response);
      if (!(response.headers.get('content-type') ?? '').includes('json'))
        throw new AiError('not_configured', 'The AI service is not available here.', {
          status: response.status,
        });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AiError('estimate_failed', 'The estimate could not be read.');
      }
      const estimate = parseActionEstimate(isRecord(payload) ? payload.estimate : undefined);
      if (!estimate) throw new AiError('estimate_failed', 'The estimate did not pass validation.');
      return estimate;
    },

    resetStatus() {
      cached = null;
      inflight = null;
    },
  };
}

const defaultClient = createAiClient();

export const getAiStatus: AiClient['getAiStatus'] = (options) => defaultClient.getAiStatus(options);
export const streamChat: AiClient['streamChat'] = (params) => defaultClient.streamChat(params);
export const estimateAction: AiClient['estimateAction'] = (text, region, extras) =>
  defaultClient.estimateAction(text, region, extras);
export const resetAiStatus = (): void => defaultClient.resetStatus();
