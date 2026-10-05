import { describe, expect, it, vi } from 'vitest';
import { createChatHandler } from './chat';
import { createRateLimiter } from './limits';
import { checkBaseUrl } from './providers';
import {
  chatMessages,
  chunk,
  DONE,
  GROQ_KEY,
  ManualClock,
  postRequest,
  scriptedFetch,
  sseResponse,
} from './testkit';

const env = { GROQ_API_KEY: GROQ_KEY };
const happy = (): Response => sseResponse([chunk('Hi'), chunk('', 'stop'), DONE]);

describe('base URL hardening', () => {
  it.each([
    ['https://metadata.internal./v1', /private/],
    ['https://0xa9fea9fe/v1', /private/],
    ['https://0251.0376.0251.0376/v1', /private/],
    ['https://[::ffff:a9fe:a9fe]/v1', /private/],
    ['https://user@api.example.com/v1', /credentials/],
    ['https://[::1]:9/v1', null],
    ['http://localhost./v1', null],
  ])('%s', (url, reason) => {
    const result = checkBaseUrl(url);
    if (reason === null) {
      expect(result.ok).toBe(true);
    } else {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(reason);
    }
  });
});

describe('client identification', () => {
  const build = () => {
    const clock = new ManualClock();
    const limiter = createRateLimiter({ capacity: 1, perHour: 1, maxConcurrent: 5 }, clock);
    return createChatHandler({
      env: () => env,
      fetch: scriptedFetch([happy]).fetch,
      clock,
      limiter,
      log: vi.fn(),
    });
  };

  it('trusts the proxy-appended end of X-Forwarded-For, not entries a client can prepend', async () => {
    const handler = build();
    const ask = (forwarded: string) =>
      handler(
        postRequest({ messages: chatMessages }, { headers: { 'x-forwarded-for': forwarded } }),
      );
    await (await ask('1.1.1.1, 203.0.113.7')).text();
    expect((await ask('9.9.9.9, 203.0.113.7')).status).toBe(429);
    const other = await ask('9.9.9.9, 198.51.100.2');
    expect(other.status).toBe(200);
    await other.text();
  });

  it('prefers the platform header over X-Forwarded-For', async () => {
    const handler = build();
    const ask = (forwarded: string) =>
      handler(
        postRequest(
          { messages: chatMessages },
          { headers: { 'x-vercel-forwarded-for': '203.0.113.50', 'x-forwarded-for': forwarded } },
        ),
      );
    await (await ask('1.1.1.1')).text();
    expect((await ask('2.2.2.2')).status).toBe(429);
  });
});

describe('a provider that never ends a line', () => {
  it('is cut off instead of growing memory without bound', async () => {
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(400_000)));
      },
    });
    const upstream = scriptedFetch([
      () =>
        new Response(endless, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      happy,
    ]);
    const handler = createChatHandler({
      env: () => env,
      fetch: upstream.fetch,
      clock: new ManualClock(),
      log: vi.fn(),
    });
    const response = await handler(postRequest({ messages: chatMessages }));
    expect(upstream.calls).toHaveLength(2);
    await response.text();
  });
});
