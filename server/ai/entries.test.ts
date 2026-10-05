import { describe, expect, it } from 'vitest';
import chat, { config as chatConfig } from '../../api/chat';
import estimate from '../../api/estimate';
import status from '../../api/status';

const origin = 'https://eco.test';

describe('function entry files', () => {
  it('export the web-handler shape Vercel and vite/devApi.ts both serve', () => {
    for (const entry of [chat, estimate, status]) {
      expect(typeof entry.fetch).toBe('function');
    }
    expect(chatConfig).toMatchObject({ runtime: 'nodejs' });
    expect(chatConfig.maxDuration).toBeGreaterThanOrEqual(30);
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
      const health = await status.fetch(new Request(`${origin}/api/status`));
      expect(await health.json()).toEqual({ configured: false, provider: null, model: null });
      const response = await chat.fetch(
        new Request(`${origin}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
        }),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: 'not_configured' } });
      const est = await estimate.fetch(
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
