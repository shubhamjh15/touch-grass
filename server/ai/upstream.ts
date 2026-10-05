/**
 * Everything that talks to a provider: building the OpenAI-style request,
 * classifying failures, and turning the provider's SSE into a small, uniform
 * item stream. Provider text (error bodies, reasoning) never leaves this
 * module as anything but a coarse classification.
 */
import type { ChainEntry } from './providers.js';

export interface UpstreamMessage {
  role: 'system' | 'developer' | 'user' | 'assistant';
  content: string;
}

export function upstreamUrl(entry: ChainEntry): string {
  return `${entry.baseUrl}/chat/completions`;
}

export function upstreamHeaders(entry: ChainEntry, stream: boolean): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: stream ? 'text/event-stream' : 'application/json',
    ...entry.headers,
    // Local models on loopback may need no key at all.
    ...(entry.apiKey ? { authorization: `Bearer ${entry.apiKey}` } : {}),
  };
}

export function toUpstreamMessages(
  entry: ChainEntry,
  system: string,
  history: readonly { role: 'user' | 'assistant'; content: string }[],
): UpstreamMessage[] {
  return [{ role: entry.systemRole, content: system }, ...history];
}

/**
 * Provider quirks (`extraBody`) go first so they can never override the fields
 * the proxy decides: model, streaming and the output cap.
 */
export function chatRequestBody(
  entry: ChainEntry,
  messages: UpstreamMessage[],
  options: { stream: boolean; maxTokens: number; temperature: number },
): Record<string, unknown> {
  return {
    ...entry.extraBody,
    model: entry.model,
    stream: options.stream,
    temperature: options.temperature,
    [entry.maxTokensField]: options.maxTokens,
    messages,
  };
}

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

export type FailureKind =
  'network' | 'timeout' | 'aborted' | 'http' | 'redirect' | 'empty' | 'stream' | 'bad_response';

export interface UpstreamFailure {
  kind: FailureKind;
  status?: number;
  rateLimited: boolean;
  /** The provider says this model id no longer exists: update the registry. */
  gone: boolean;
  retryAfterSec?: number;
}

/** Seconds from a Retry-After header (delta-seconds or an HTTP date), clamped to an hour. */
export function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(3600, Math.max(0, Math.ceil(seconds)));
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.min(3600, Math.max(0, Math.ceil((date - nowMs) / 1000)));
}

const GONE_PATTERN =
  /decommission|model_not_found|model not found|does not exist|deprecated|no longer (available|supported)|retired/i;

export function classifyHttpFailure(
  status: number,
  bodyText: string,
  retryAfterHeader: string | null,
  nowMs: number,
): UpstreamFailure {
  const redirect = status >= 300 && status < 400;
  return {
    kind: redirect ? 'redirect' : 'http',
    status,
    rateLimited: status === 429 || (status === 413 && /tokens? per minute|rate/i.test(bodyText)),
    gone: status === 404 || status === 410 || GONE_PATTERN.test(bodyText),
    retryAfterSec: parseRetryAfter(retryAfterHeader, nowMs),
  };
}

/** Reads at most `max` characters of an error body, for classification only. */
export async function readCapped(response: Response, max = 2048): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (text.length < max) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    // Classification works without a body.
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return text.slice(0, max);
}

// ---------------------------------------------------------------------------
// Reasoning that leaks into content
// ---------------------------------------------------------------------------

function partialSuffix(text: string, tag: string): string {
  const max = Math.min(text.length, tag.length - 1);
  for (let length = max; length > 0; length -= 1) {
    if (tag.startsWith(text.slice(text.length - length))) return text.slice(text.length - length);
  }
  return '';
}

/**
 * Some open models (Qwen, DeepSeek distills) write their reasoning inline as
 * `<think>...</think>`. Drops it, even when a tag is split across chunks.
 */
export class ThinkFilter {
  private inside = false;
  private carry = '';

  push(text: string): string {
    let rest = this.carry + text;
    this.carry = '';
    let out = '';
    for (;;) {
      if (this.inside) {
        const close = rest.indexOf('</think>');
        if (close < 0) {
          this.carry = partialSuffix(rest, '</think>');
          return out;
        }
        rest = rest.slice(close + '</think>'.length);
        this.inside = false;
      } else {
        const open = rest.indexOf('<think>');
        if (open < 0) {
          const keep = partialSuffix(rest, '<think>');
          this.carry = keep;
          return out + rest.slice(0, rest.length - keep.length);
        }
        out += rest.slice(0, open);
        rest = rest.slice(open + '<think>'.length);
        this.inside = true;
      }
    }
  }

  flush(): string {
    const out = this.inside ? '' : this.carry;
    this.carry = '';
    return out;
  }
}

/** Removes `<think>` blocks from a complete (non-streamed) answer. */
export function stripThinking(text: string): string {
  const filter = new ThinkFilter();
  return (filter.push(text) + filter.flush()).trim();
}

// ---------------------------------------------------------------------------
// Upstream SSE
// ---------------------------------------------------------------------------

export type UpstreamItem =
  | { type: 'text'; text: string }
  | { type: 'finish'; reason: string }
  | { type: 'error'; status?: number; rateLimited: boolean }
  /** `clean` is true only when the provider sent its explicit [DONE] marker. */
  | { type: 'end'; clean: boolean };

export interface UpstreamReader {
  next(): Promise<UpstreamItem>;
  cancel(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part): string => {
      if (typeof part === 'string') return part;
      if (
        isRecord(part) &&
        typeof part.text === 'string' &&
        (part.type === undefined || part.type === 'text')
      )
        return part.text;
      return '';
    })
    .join('');
}

function errorItem(error: unknown, fallbackStatus: unknown): UpstreamItem {
  const record = isRecord(error) ? error : {};
  const status =
    typeof record.code === 'number'
      ? record.code
      : typeof fallbackStatus === 'number'
        ? fallbackStatus
        : undefined;
  const probe = JSON.stringify(error ?? '').slice(0, 400);
  return {
    type: 'error',
    ...(status !== undefined ? { status } : {}),
    rateLimited: status === 429 || /rate.?limit|quota|exhausted|too many/i.test(probe),
  };
}

/** Turns one parsed provider JSON object into stream items. Tolerates every shape seen in the research. */
function itemsFromPayload(value: unknown, think: ThinkFilter): UpstreamItem[] {
  const payload = Array.isArray(value) ? value[0] : value;
  if (!isRecord(payload)) return [];
  if ('error' in payload && payload.error) return [errorItem(payload.error, payload.status)];
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) return [];
  const choice: unknown = choices[0];
  if (!isRecord(choice)) return [];
  const delta = isRecord(choice.delta)
    ? choice.delta
    : isRecord(choice.message)
      ? choice.message
      : {};
  const items: UpstreamItem[] = [];
  // Only `content`: `reasoning` and `reasoning_content` deltas are deliberately ignored.
  const text = think.push(contentText(delta.content));
  if (text) items.push({ type: 'text', text });
  if (typeof choice.finish_reason === 'string' && choice.finish_reason !== '') {
    const tail = think.flush();
    if (tail) items.push({ type: 'text', text: tail });
    items.push({ type: 'finish', reason: choice.finish_reason });
  }
  return items;
}

/**
 * Incrementally parses an OpenAI-style SSE body. Tolerates keep-alive
 * comments, `[DONE]`, empty `choices`, usage-only chunks, array-wrapped and
 * in-stream errors, CRLF, and providers that ignore `stream: true` and answer
 * with one JSON object.
 */
const MAX_LINE_CHARS = 1_000_000;

export function createUpstreamReader(body: ReadableStream<Uint8Array>): UpstreamReader {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const think = new ThinkFilter();
  const queue: UpstreamItem[] = [];
  let buffer = '';
  let dataLines: string[] = [];
  let sawData = false;
  let raw = '';
  let eof = false;
  let ended = false;

  const parse = (payload: string): void => {
    const trimmed = payload.trim();
    if (trimmed === '[DONE]') {
      const tail = think.flush();
      if (tail) queue.push({ type: 'text', text: tail });
      queue.push({ type: 'end', clean: true });
      return;
    }
    try {
      queue.push(...itemsFromPayload(JSON.parse(trimmed) as unknown, think));
    } catch {
      // A garbled line is skipped: the next one usually recovers.
    }
  };

  const dispatch = (): void => {
    if (dataLines.length === 0) return;
    const payload = dataLines.join('\n');
    dataLines = [];
    parse(payload);
  };

  const line = (text: string): void => {
    if (text === '') return dispatch();
    if (text.startsWith(':')) return;
    const colon = text.indexOf(':');
    const field = colon < 0 ? text : text.slice(0, colon);
    if (field !== 'data') return;
    sawData = true;
    const value = colon < 0 ? '' : text.slice(colon + 1);
    dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
  };

  const feed = (text: string, final: boolean): void => {
    if (!sawData && raw.length < 262_144) raw += text;
    buffer += text;
    let start = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const char = buffer[i];
      if (char !== '\n' && char !== '\r') continue;
      if (char === '\r' && i === buffer.length - 1 && !final) break;
      line(buffer.slice(start, i));
      if (char === '\r' && buffer[i + 1] === '\n') i += 1;
      start = i + 1;
    }
    buffer = buffer.slice(start);
    // A provider that never ends a line would grow this without bound.
    if (buffer.length > MAX_LINE_CHARS) throw new Error('upstream line too long');
  };

  const finish = (): void => {
    eof = true;
    feed(decoder.decode(), true);
    if (buffer !== '') {
      line(buffer);
      buffer = '';
    }
    dispatch();
    if (!sawData) {
      const text = raw.trim();
      if (text.startsWith('{') || text.startsWith('[')) parse(text);
    }
    const tail = think.flush();
    if (tail) queue.push({ type: 'text', text: tail });
    queue.push({ type: 'end', clean: false });
  };

  return {
    async next() {
      for (;;) {
        const item = queue.shift();
        if (item) {
          if (item.type === 'end') ended = true;
          return item;
        }
        if (ended || eof) return { type: 'end', clean: false };
        const { done, value } = await reader.read();
        if (done) finish();
        else feed(decoder.decode(value, { stream: true }), false);
      }
    },
    cancel() {
      ended = true;
      reader.cancel().catch(() => undefined);
    },
  };
}
