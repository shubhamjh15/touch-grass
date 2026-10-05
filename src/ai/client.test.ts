import { describe, expect, it, vi } from 'vitest';
import {
  AiError,
  createAiClient,
  createNameFilter,
  parseActionEstimate,
  prepareMessages,
  toWireContext,
} from './client';
import type { ActionEstimate, CoachContext } from './contract';

const encoder = new TextEncoder();

function sse(frames: string[], status = 200): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    }),
    { status, headers: { 'content-type': 'text/event-stream' } },
  );
}

const delta = (text: string): string => `event: delta\ndata: ${JSON.stringify({ text })}\n\n`;
const done = (provider = 'Groq', model = 'openai/gpt-oss-120b', finish = 'stop'): string =>
  `event: done\ndata: ${JSON.stringify({ provider, model, finish })}\n\n`;
const errorEvent = (code: string): string =>
  `event: error\ndata: ${JSON.stringify({ code, message: 'safe text' })}\n\n`;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const html = (status = 200): Response =>
  new Response('<!doctype html><html></html>', {
    status,
    headers: { 'content-type': 'text/html' },
  });

function clientWith(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return handler(String(input), init ?? {});
  });
  let time = 0;
  const client = createAiClient({ fetch: fetchMock as unknown as typeof fetch, now: () => time });
  return { client, calls, fetchMock, advance: (ms: number) => (time += ms) };
}

const messages = [{ role: 'user' as const, content: 'One easy win?' }];

describe('getAiStatus', () => {
  it('reads the server status and caches it', async () => {
    const { client, fetchMock } = clientWith(() =>
      json({ configured: true, provider: 'Groq', model: 'openai/gpt-oss-120b' }),
    );
    const first = await client.getAiStatus();
    expect(first).toEqual({
      configured: true,
      provider: 'Groq',
      model: 'openai/gpt-oss-120b',
      reason: 'ready',
    });
    await client.getAiStatus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await client.getAiStatus({ refresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const { client, fetchMock } = clientWith(() =>
      json({ configured: false, provider: null, model: null }),
    );
    const [a, b] = await Promise.all([client.getAiStatus(), client.getAiStatus()]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.reason).toBe('not_configured');
  });

  it('treats an HTML answer (a static preview with no functions) as unavailable', async () => {
    const { client } = clientWith(() => html());
    expect(await client.getAiStatus()).toMatchObject({ configured: false, reason: 'no_functions' });
  });

  it('treats a 404 and a malformed body as unavailable', async () => {
    const missing = clientWith(() => json({ error: 'nope' }, 404));
    expect(await missing.client.getAiStatus()).toMatchObject({ reason: 'no_functions' });
    const malformed = clientWith(() => json({ configured: 'yes' }));
    expect(await malformed.client.getAiStatus()).toMatchObject({ reason: 'no_functions' });
  });

  it('treats a network failure as offline and retries sooner than a success', async () => {
    let fail = true;
    const { client, fetchMock, advance } = clientWith(() => {
      if (fail) throw new TypeError('Failed to fetch');
      return json({ configured: true, provider: 'Groq', model: 'm' });
    });
    expect(await client.getAiStatus()).toMatchObject({ configured: false, reason: 'offline' });
    await client.getAiStatus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fail = false;
    advance(31_000);
    expect(await client.getAiStatus()).toMatchObject({ configured: true, reason: 'ready' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    advance(60_000);
    await client.getAiStatus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    advance(5 * 60_000);
    await client.getAiStatus();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('can be reset', async () => {
    const { client, fetchMock } = clientWith(() =>
      json({ configured: false, provider: null, model: null }),
    );
    await client.getAiStatus();
    client.resetStatus();
    await client.getAiStatus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with aborted when the caller aborts', async () => {
    const { client } = clientWith(() => new Promise<Response>(() => undefined));
    const controller = new AbortController();
    const pending = client.getAiStatus({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('streamChat', () => {
  it('streams deltas through onDelta and resolves with the text and the provider label', async () => {
    const { client, calls } = clientWith(() => sse([delta('Hel'), delta('lo'), done()]));
    const seen: [string, string][] = [];
    const result = await client.streamChat({
      messages,
      onDelta: (piece, full) => seen.push([piece, full]),
    });
    expect(result).toEqual({
      text: 'Hello',
      provider: 'Groq',
      model: 'openai/gpt-oss-120b',
      finish: 'stop',
    });
    expect(seen).toEqual([
      ['Hel', 'Hel'],
      ['lo', 'Hello'],
    ]);
    expect(calls[0]?.url).toBe('/api/chat');
    expect(calls[0]?.init.method).toBe('POST');
  });

  it('parses a stream split into odd chunks, including inside a UTF-8 sequence', async () => {
    const bytes = encoder.encode(delta('héllo 🌱') + done());
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
        controller.close();
      },
    });
    const { client } = clientWith(
      () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    expect((await client.streamChat({ messages })).text).toBe('héllo 🌱');
  });

  it('never sends the display name, and fills {{name}} back in, even when split across deltas', async () => {
    const { client, calls } = clientWith(() =>
      sse([delta('Hi {'), delta('{na'), delta('me}}, nice '), delta('work {{name}}!'), done()]),
    );
    const context: CoachContext = {
      displayName: 'Alex',
      region: 'eu',
      tree: { name: 'Juniper' },
      streak: 3,
    };
    const result = await client.streamChat({ messages, context });
    expect(result.text).toBe('Hi Alex, nice work Alex!');
    const sent = String(calls[0]?.init.body);
    expect(sent).not.toContain('Alex');
    expect(JSON.parse(sent)).toEqual({
      messages,
      context: { region: 'eu', tree: { name: 'Juniper' }, streak: 3 },
    });
  });

  it('flushes a dangling partial token at the end', async () => {
    const { client } = clientWith(() => sse([delta('Cost {{na'), done()]));
    expect((await client.streamChat({ messages })).text).toBe('Cost {{na');
  });

  it('sends only recent turns within the server limits', async () => {
    const { client, calls } = clientWith(() => sse([delta('ok'), done()]));
    const long = Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: i === 13 ? 'a'.repeat(5000) : 'q'.repeat(700),
    }));
    long.push({ role: 'user', content: 'now' });
    await client.streamChat({ messages: long });
    const body = JSON.parse(String(calls[0]?.init.body)) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages).toHaveLength(10);
    expect(body.messages.every((m) => m.content.length <= (m.role === 'user' ? 600 : 2000))).toBe(
      true,
    );
    expect(body.messages.at(-1)?.content).toBe('now');
  });

  it('refuses a too-long final message locally, before any request', async () => {
    const { client, fetchMock } = clientWith(() => sse([done()]));
    await expect(
      client.streamChat({ messages: [{ role: 'user', content: 'x'.repeat(601) }] }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a 200 HTML answer to not_configured (static preview)', async () => {
    const { client } = clientWith(() => html(200));
    await expect(client.streamChat({ messages })).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('maps a 404 or 405 HTML answer to not_configured', async () => {
    for (const status of [404, 405]) {
      const { client } = clientWith(() => html(status));
      await expect(client.streamChat({ messages })).rejects.toMatchObject({
        code: 'not_configured',
        status,
      });
    }
  });

  it('reads the server error body and retry-after', async () => {
    const limited = clientWith(() =>
      json({ error: { code: 'rate_limited', message: 'busy', retryAfterSec: 42 } }, 429, {
        'retry-after': '42',
      }),
    );
    await expect(limited.client.streamChat({ messages })).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfterSec: 42,
      status: 429,
    });
    const off = clientWith(() => json({ error: { code: 'not_configured', message: 'x' } }, 503));
    await expect(off.client.streamChat({ messages })).rejects.toMatchObject({
      code: 'not_configured',
    });
    const odd = clientWith(() => json({ weird: true }, 502));
    await expect(odd.client.streamChat({ messages })).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
  });

  it('maps a network failure to offline', async () => {
    const { client } = clientWith(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(client.streamChat({ messages })).rejects.toMatchObject({
      code: 'offline',
      partial: '',
    });
  });

  it('throws an error event as AiError carrying the partial text', async () => {
    const { client } = clientWith(() =>
      sse([delta('Par'), delta('tial'), errorEvent('upstream_unavailable')]),
    );
    const error = await client.streamChat({ messages }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code: 'upstream_unavailable', partial: 'Partial' });
  });

  it('treats a stream that ends without done as interrupted, keeping the partial', async () => {
    const { client } = clientWith(() => sse([delta('Cut')]));
    await expect(client.streamChat({ messages })).rejects.toMatchObject({
      code: 'upstream_unavailable',
      partial: 'Cut',
    });
  });

  it('treats a dropped connection mid-stream as offline with the partial', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(delta('Half')));
      },
      pull() {
        throw new Error('socket closed');
      },
    });
    const { client } = clientWith(
      () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    await expect(client.streamChat({ messages })).rejects.toMatchObject({
      code: 'offline',
      partial: 'Half',
    });
  });

  it('aborts: before the request, and mid-stream with the partial text', async () => {
    const early = clientWith(() => sse([done()]));
    const already = new AbortController();
    already.abort();
    await expect(
      early.client.streamChat({ messages, signal: already.signal }),
    ).rejects.toMatchObject({
      code: 'aborted',
    });
    expect(early.fetchMock).not.toHaveBeenCalled();

    let push: ((text: string) => void) | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (text) => controller.enqueue(encoder.encode(text));
      },
    });
    const { client } = clientWith(
      () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const controller = new AbortController();
    const pending = client.streamChat({
      messages,
      signal: controller.signal,
      onDelta: () => controller.abort(),
    });
    await Promise.resolve();
    push?.(delta('One'));
    await expect(pending).rejects.toMatchObject({ code: 'aborted', partial: 'One' });
  });

  it('ignores malformed events and keeps going', async () => {
    const { client } = clientWith(() =>
      sse(['event: delta\ndata: not json\n\n', delta('ok'), done()]),
    );
    expect((await client.streamChat({ messages })).text).toBe('ok');
  });
});

describe('estimateAction', () => {
  const estimate: ActionEstimate = {
    isClimateAction: true,
    matchedActionId: null,
    title: 'Fixed a bike',
    emoji: '🔧',
    category: 'transport',
    effort: 3,
    quantity: 1,
    unit: 'item',
    co2Kg: 0.4,
    confidence: 'low',
    reasoning: 'A repair avoids a replacement.',
  };

  it('returns a validated estimate and sends text, region and the optional catalogue', async () => {
    const { client, calls } = clientWith(() => json({ estimate }));
    const result = await client.estimateAction('fixed a bike', 'eu', {
      quantity: 2,
      catalogue: [{ id: 'stuff_repair', title: 'Repaired', unit: 'item' }],
    });
    expect(result).toEqual(estimate);
    expect(calls[0]?.url).toBe('/api/estimate');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      text: 'fixed a bike',
      region: 'eu',
      quantity: 2,
      catalogue: [{ id: 'stuff_repair', title: 'Repaired', unit: 'item' }],
    });
  });

  it('rejects a response that fails the browser-side validation', async () => {
    for (const bad of [
      {},
      { estimate: { ...estimate, co2Kg: 50 } },
      { estimate: { ...estimate, category: 'x' } },
      { estimate: { ...estimate, confidence: 'high' } },
    ]) {
      const { client } = clientWith(() => json(bad));
      await expect(client.estimateAction('fixed a bike', 'eu')).rejects.toMatchObject({
        code: 'estimate_failed',
      });
    }
  });

  it('maps server errors, HTML and network failures', async () => {
    const failed = clientWith(() =>
      json({ error: { code: 'estimate_failed', message: 'x' } }, 502),
    );
    await expect(failed.client.estimateAction('abc', 'eu')).rejects.toMatchObject({
      code: 'estimate_failed',
    });
    const page = clientWith(() => html());
    await expect(page.client.estimateAction('abc', 'eu')).rejects.toMatchObject({
      code: 'not_configured',
    });
    const off = clientWith(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(off.client.estimateAction('abc', 'eu')).rejects.toMatchObject({ code: 'offline' });
  });

  it('times out', async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const client = createAiClient({ fetch: fetchMock as unknown as typeof fetch, timeoutMs: 20 });
    await expect(client.estimateAction('abc', 'eu')).rejects.toMatchObject({ code: 'timeout' });
  });
});

describe('helpers', () => {
  it('createNameFilter replaces whole and split tokens and defaults to "friend"', () => {
    const filter = createNameFilter('Sam');
    expect(filter.push('Hi {{na') + filter.push('me}} and {{name}}')).toBe('Hi Sam and Sam');
    expect(createNameFilter(undefined).push('Hey {{name}}')).toBe('Hey friend');
    expect(createNameFilter('  <b>Evil</b>\n').push('{{name}}')).toBe('bEvil/b');
  });

  it('toWireContext drops only the display name', () => {
    expect(toWireContext({ displayName: 'Alex', streak: 2 })).toEqual({ streak: 2 });
    expect(toWireContext(undefined)).toEqual({});
  });

  it('prepareMessages keeps the latest turns', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}`,
    }));
    const result = prepareMessages(many);
    expect(result).toHaveLength(10);
    expect(result.at(-1)?.content).toBe('m29');
  });

  it('parseActionEstimate is strict', () => {
    expect(parseActionEstimate(null)).toBeNull();
    expect(parseActionEstimate('x')).toBeNull();
    expect(parseActionEstimate({})).toBeNull();
  });
});
