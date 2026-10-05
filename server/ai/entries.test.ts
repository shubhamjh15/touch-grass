import { describe, expect, it } from 'vitest';
import * as chat from '../../app/api/chat/route';
import * as estimate from '../../app/api/estimate/route';
import * as status from '../../app/api/status/route';

const origin = 'https://eco.test';

describe('API route files', () => {
  it('export Next.js route handlers on the Node runtime', () => {
    for (const route of [chat, estimate, status]) {
      expect(typeof route.GET).toBe('function');
      expect(typeof route.POST).toBe('function');
      expect(route.runtime).toBe('nodejs');
    }
    expect(chat.maxDuration).toBeGreaterThanOrEqual(30);
  });

  it('answer with the documented not-configured shape when no key is set', async () => {
    const saved = { ...process.env };
    for (const key of Object.keys(process.env)) {
      if (
        /^(AI_|GROQ_|GEMINI_|MISTRAL_|OPENROUTER_|CLOUDFLARE_|SAMBANOVA_|NVIDIA_|COHERE_|CEREBRAS_|HUGGINGFACE_|TOGETHER_)/.test(
          key,
        )
      )
        delete process.env[key];
    }
    try {
      const health = await status.GET(new Request(`${origin}/api/status`));
      expect(await health.json()).toEqual({ configured: false, provider: null, model: null });
      const response = await chat.POST(
        new Request(`${origin}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
        }),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: 'not_configured' } });
      const est = await estimate.POST(
        new Request(`${origin}/api/estimate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin },
          body: JSON.stringify({ text: 'planted a tree' }),
        }),
      );
      expect(est.status).toBe(503);
    } finally {
      process.env = saved;
    }
  });
});
