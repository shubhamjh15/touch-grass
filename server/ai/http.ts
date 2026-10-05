/**
 * Small web-standard helpers shared by the three functions: error bodies,
 * the same-origin check, client identification and a size-capped JSON reader.
 * Everything here uses the platform (Request, Response, TextDecoder) only.
 */
import type { AiErrorBody, AiErrorCode } from '../../src/ai/contract.js';
import type { Env } from './providers.js';

/** Injectable time source, so tests control heartbeats, timeouts and rate limits. */
export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const STATUS_FOR_CODE: Readonly<Record<AiErrorCode, number>> = {
  not_configured: 503,
  rate_limited: 429,
  upstream_unavailable: 502,
  invalid_request: 400,
  forbidden_origin: 403,
  too_large: 413,
  method_not_allowed: 405,
  estimate_failed: 502,
  timeout: 504,
  internal: 500,
  offline: 503,
  aborted: 499,
};

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
} as const;

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/** Error responses carry a code and a fixed, safe sentence. Upstream text never reaches the client. */
export function errorResponse(
  code: AiErrorCode,
  message: string,
  options: { status?: number; retryAfterSec?: number; headers?: Record<string, string> } = {},
): Response {
  const body: AiErrorBody = {
    error: {
      code,
      message,
      ...(options.retryAfterSec !== undefined ? { retryAfterSec: options.retryAfterSec } : {}),
    },
  };
  const headers: Record<string, string> = { ...options.headers };
  if (options.retryAfterSec !== undefined) headers['retry-after'] = String(options.retryAfterSec);
  return jsonResponse(body, options.status ?? STATUS_FOR_CODE[code], headers);
}

export const SAFE_MESSAGES: Readonly<Record<AiErrorCode, string>> = {
  not_configured: 'The live coach is not set up on this server.',
  rate_limited: 'The coach is busy right now. Try again in a moment.',
  upstream_unavailable: 'The live coach could not answer just now.',
  invalid_request: 'The request was not valid.',
  forbidden_origin: 'This request is not allowed from this site.',
  too_large: 'The request is too large.',
  method_not_allowed: 'Method not allowed.',
  estimate_failed: 'No reliable estimate could be made.',
  timeout: 'The live coach took too long to answer.',
  internal: 'Something went wrong on the server.',
  offline: 'The server could not be reached.',
  aborted: 'The request was cancelled.',
};

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function parseAllowedOrigins(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const part of (raw ?? '').split(',')) {
    const trimmed = part.trim();
    if (trimmed === '' || trimmed === '*') continue;
    try {
      out.add(new URL(trimmed).origin.toLowerCase());
    } catch {
      // A malformed entry grants nothing.
    }
  }
  return out;
}

/**
 * Rejects cross-origin browser requests. Browsers always send `Origin` on a
 * POST and a web page cannot forge it, so comparing it with the request host
 * stops other sites from spending this deployment's quota through a visitor's
 * browser. A caller without an Origin header (curl, tests, a same-origin GET)
 * is allowed unless the browser itself marks the request cross-site.
 * This is not authentication: anyone can script a request with any header.
 * Rate limits are the defence against that.
 */
export function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (origin === null) return site === null || site === 'same-origin' || site === 'none';
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parseAllowedOrigins(env.ALLOWED_ORIGINS).has(parsed.origin.toLowerCase())) return true;
  const host = parsed.host.toLowerCase();
  return [hostOf(request.url), request.headers.get('host')?.toLowerCase()].includes(host);
}

/**
 * The address a request came from, as reported by the platform proxy. Vercel
 * sets these headers itself, so a client cannot choose its own bucket there.
 * Elsewhere they are only as trustworthy as the proxy in front. A client can
 * prepend fake entries to X-Forwarded-For, but a proxy appends the real
 * address at the END, so the last entry is the one to trust.
 */
export function clientKey(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for')?.split(',');
  const raw =
    headers.get('x-vercel-forwarded-for') ??
    headers.get('x-real-ip') ??
    forwarded?.[forwarded.length - 1] ??
    'unknown';
  return raw.trim().slice(0, 64) || 'unknown';
}

export type BodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

/** Reads a JSON body without ever buffering more than `maxBytes`, whatever Content-Length claims. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult> {
  const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (type !== 'application/json')
    return {
      ok: false,
      response: errorResponse('invalid_request', 'Send the body as application/json.'),
    };
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes)
    return { ok: false, response: errorResponse('too_large', 'The request body is too large.') };
  if (!request.body)
    return { ok: false, response: errorResponse('invalid_request', 'The request body is empty.') };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return {
          ok: false,
          response: errorResponse('too_large', 'The request body is too large.'),
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      response: errorResponse('invalid_request', 'The request body could not be read.'),
    };
  }
  if (size === 0)
    return { ok: false, response: errorResponse('invalid_request', 'The request body is empty.') };

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: errorResponse('invalid_request', 'The body is not valid JSON.') };
  }
}

export function sleep(clock: Clock, ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = (): void => {
      clock.clearTimeout(handle);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const handle = clock.setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

export function readNumber(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(raw);
  if (raw === undefined || raw.trim() === '' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
