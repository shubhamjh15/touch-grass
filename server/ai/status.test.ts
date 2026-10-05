import { describe, expect, it } from 'vitest';
import { createStatusHandler } from './status';
import { GROQ_KEY, ORIGIN } from './testkit';

const get = (method = 'GET'): Request => new Request(`${ORIGIN}/api/status`, { method });

describe('status endpoint', () => {
  it('reports not configured without a key', async () => {
    const response = await createStatusHandler({ env: () => ({}) })(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false, provider: null, model: null });
  });

  it('reports the head of the chain and never a secret', async () => {
    const response = await createStatusHandler({ env: () => ({ AI_API_KEY: GROQ_KEY }) })(get());
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      configured: true,
      provider: 'Groq',
      model: 'openai/gpt-oss-120b',
    });
    expect(text).not.toContain(GROQ_KEY);
    expect(text).not.toContain('gsk_');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('flags a dev-only provider and explains an almost-configured setup', async () => {
    const dev = await createStatusHandler({
      env: () => ({ NVIDIA_API_KEY: 'nvapi-' + 'x'.repeat(40) }),
    })(get());
    expect(await dev.json()).toMatchObject({ configured: true, devOnly: true });
    const bad = await createStatusHandler({ env: () => ({ AI_API_KEY: 'b'.repeat(32) }) })(get());
    const body = (await bad.json()) as { configured: boolean; hint?: string };
    expect(body.configured).toBe(false);
    expect(body.hint).toMatch(/AI_PROVIDER/);
    expect(JSON.stringify(body)).not.toContain('b'.repeat(32));
  });

  it('only answers GET and HEAD', async () => {
    const response = await createStatusHandler({ env: () => ({}) })(get('POST'));
    expect(response.status).toBe(405);
  });
});
