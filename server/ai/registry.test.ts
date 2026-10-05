import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, providerEnvNames, registrySummary, resolveChain } from './providers';

describe('provider registry', () => {
  const key = 'k'.repeat(40);

  it('resolves every provider from AI_API_KEY plus AI_PROVIDER', () => {
    const account = 'a'.repeat(32);
    for (const id of PROVIDER_IDS) {
      if (id === 'custom') continue;
      const chain = resolveChain({
        AI_API_KEY: key,
        AI_PROVIDER: id,
        CLOUDFLARE_AI_ACCOUNT_ID: account,
      });
      expect(chain[0]?.provider, id).toBe(id);
      expect(chain[0]?.apiKey).toBe(key);
    }
  });

  it('resolves every provider from its named key', () => {
    const account = 'b'.repeat(32);
    for (const entry of registrySummary()) {
      const env = { CLOUDFLARE_AI_ACCOUNT_ID: account, [entry.keyEnv]: key };
      expect(
        resolveChain(env).some((item) => item.provider === entry.id),
        entry.id,
      ).toBe(true);
    }
  });

  it('lists https base URLs, at least one chat model and a fast model for each provider', () => {
    for (const entry of registrySummary()) {
      expect(entry.baseUrl, entry.id).toMatch(/^https:\/\//);
      expect(entry.baseUrl.endsWith('/')).toBe(false);
      expect(entry.chat.length).toBeGreaterThan(0);
      expect(entry.fast).not.toBe('');
    }
  });

  it('uses unique variable names that common CI and SDK setups do not already export', () => {
    const names = providerEnvNames();
    expect(new Set(names).size).toBe(names.length);
    for (const common of [
      'HF_TOKEN',
      'GOOGLE_API_KEY',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GITHUB_TOKEN',
      'VERCEL_TOKEN',
      'CI',
    ]) {
      expect(names).not.toContain(common);
    }
    for (const name of names) expect(name.startsWith('VITE_')).toBe(false);
  });
});
