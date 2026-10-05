import { describe, expect, it } from 'vitest';
import {
  checkBaseUrl,
  cleanSecret,
  describeChain,
  detectProvider,
  planConfig,
  resolveChain,
  type Env,
} from './providers';

const KEYS = {
  groq: 'gsk_' + 'a'.repeat(40),
  openrouter: 'sk-or-v1-' + 'b'.repeat(40),
  gemini: 'AIza' + 'c'.repeat(35),
  geminiNew: 'AQ.' + 'd'.repeat(48),
  nvidia: 'nvapi-' + 'e'.repeat(40),
  hf: 'hf_' + 'f'.repeat(34),
  cerebras: 'csk-' + 'g'.repeat(40),
  cloudflare: 'cfut_' + 'h'.repeat(40),
  vercel: 'vck_' + 'i'.repeat(40),
};

describe('detectProvider', () => {
  it.each([
    [KEYS.groq, 'groq'],
    [KEYS.openrouter, 'openrouter'],
    [KEYS.gemini, 'gemini'],
    [KEYS.geminiNew, 'gemini'],
    [KEYS.nvidia, 'nvidia'],
    [KEYS.hf, 'huggingface'],
    [KEYS.cerebras, 'cerebras'],
    [KEYS.cloudflare, 'cloudflare'],
    ['cfat_' + 'j'.repeat(40), 'cloudflare'],
    [KEYS.vercel, 'vercel'],
  ])('recognises %s as %s', (key, provider) => {
    expect(detectProvider(key)).toEqual({ kind: 'provider', provider });
  });

  it('tests sk-or- before the generic sk- prefix', () => {
    expect(detectProvider('sk-or-v1-abcdefgh').kind).toBe('provider');
    expect(detectProvider('sk-proj-abcdefgh').kind).toBe('unresolved');
  });

  it('never guesses silently for shapes without a prefix', () => {
    for (const key of ['a'.repeat(32), 'b'.repeat(40), '123e4567-e89b-12d3-a456-426614174000']) {
      const result = detectProvider(key);
      expect(result.kind).toBe('unresolved');
    }
  });

  it('explains the retired GitHub Models service', () => {
    const result = detectProvider('ghp_' + 'x'.repeat(36));
    expect(result.kind).toBe('unresolved');
    if (result.kind === 'unresolved') expect(result.hint).toMatch(/shut down/);
  });

  it('rejects an AIza key of the wrong length', () => {
    expect(detectProvider('AIzaShort').kind).toBe('unresolved');
  });
});

describe('cleanSecret', () => {
  it('trims and unwraps quotes', () => {
    expect(cleanSecret('  "gsk_12345678"  ')).toBe('gsk_12345678');
    expect(cleanSecret("'gsk_12345678'")).toBe('gsk_12345678');
  });
  it('rejects empty, short, spaced and non-ascii values', () => {
    for (const bad of [undefined, '', '   ', 'short', 'has space in it', 'café-key-1234']) {
      expect(cleanSecret(bad)).toBeNull();
    }
  });
});

describe('the one-key path', () => {
  it('detects the provider and returns its default chat chain', () => {
    const chain = resolveChain({ AI_API_KEY: KEYS.groq });
    expect(chain.map((entry) => entry.model)).toEqual([
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
    ]);
    expect(chain[0]).toMatchObject({
      provider: 'groq',
      label: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: KEYS.groq,
      maxTokensField: 'max_completion_tokens',
      extraBody: { reasoning_effort: 'low', include_reasoning: false },
    });
    expect(chain[2]?.extraBody).toEqual({ reasoning_effort: 'none' });
  });

  it('resolves every detectable provider from a bare AI_API_KEY', () => {
    const cases: [string, string][] = [
      [KEYS.openrouter, 'openrouter'],
      [KEYS.gemini, 'gemini'],
      [KEYS.nvidia, 'nvidia'],
      [KEYS.hf, 'huggingface'],
      [KEYS.cerebras, 'cerebras'],
      [KEYS.vercel, 'vercel'],
    ];
    for (const [key, provider] of cases) {
      expect(resolveChain({ AI_API_KEY: key })[0]?.provider).toBe(provider);
    }
  });

  it('honours AI_PROVIDER for keys without a prefix', () => {
    const chain = resolveChain({ AI_API_KEY: 'm'.repeat(32), AI_PROVIDER: 'Mistral' });
    expect(chain[0]).toMatchObject({ provider: 'mistral', model: 'mistral-small-latest' });
    expect(resolveChain({ AI_API_KEY: 'm'.repeat(32) })).toEqual([]);
  });

  it('lets AI_MODEL replace the model chain', () => {
    const chain = resolveChain({ AI_API_KEY: KEYS.groq, AI_MODEL: 'openai/gpt-oss-20b' });
    expect(chain.map((entry) => entry.model)).toEqual(['openai/gpt-oss-20b']);
  });

  it('needs the account id for a Cloudflare token', () => {
    const missing = planConfig({ AI_API_KEY: KEYS.cloudflare });
    expect(missing.chain).toEqual([]);
    expect(missing.problems.join(' ')).toMatch(/CLOUDFLARE_AI_ACCOUNT_ID/);
    const account = 'ABCDEF0123456789abcdef0123456789';
    const ok = resolveChain({ AI_API_KEY: KEYS.cloudflare, CLOUDFLARE_AI_ACCOUNT_ID: account });
    expect(ok[0]?.baseUrl).toBe(
      'https://api.cloudflare.com/client/v4/accounts/abcdef0123456789abcdef0123456789/ai/v1',
    );
  });

  it('refuses a Cloudflare account id that could rewrite the URL', () => {
    const chain = resolveChain({
      AI_API_KEY: KEYS.cloudflare,
      CLOUDFLARE_AI_ACCOUNT_ID: 'x/../../evil',
    });
    expect(chain).toEqual([]);
  });

  it('reports a hint instead of silently ignoring a bad key', () => {
    const status = describeChain({ AI_API_KEY: 'short' });
    expect(status.configured).toBe(false);
    expect(status.hint).toMatch(/AI_API_KEY/);
  });

  it('flags the dev-only providers', () => {
    expect(describeChain({ AI_API_KEY: KEYS.nvidia }).devOnly).toBe(true);
    expect(describeChain({ AI_API_KEY: KEYS.groq }).devOnly).toBe(false);
  });
});

describe('named keys and ordering', () => {
  const env: Env = {
    MISTRAL_API_KEY: 'm'.repeat(32),
    GEMINI_API_KEY: KEYS.gemini,
    GROQ_API_KEY: KEYS.groq,
    OPENROUTER_API_KEY: KEYS.openrouter,
  };

  it('follows the research fallback order regardless of variable order', () => {
    const providers = [...new Set(resolveChain(env).map((entry) => entry.provider))];
    expect(providers).toEqual(['groq', 'gemini', 'mistral', 'openrouter']);
  });

  it('lets AI_FALLBACK_ORDER put providers first and keeps the rest after', () => {
    const providers = [
      ...new Set(
        resolveChain({ ...env, AI_FALLBACK_ORDER: 'mistral, openrouter' }).map((e) => e.provider),
      ),
    ];
    expect(providers).toEqual(['mistral', 'openrouter', 'groq', 'gemini']);
  });

  it('reports unknown names in AI_FALLBACK_ORDER without failing', () => {
    const plan = planConfig({ ...env, AI_FALLBACK_ORDER: 'nope,groq' });
    expect(plan.chain[0]?.provider).toBe('groq');
    expect(plan.problems.join(' ')).toMatch(/unknown provider/);
  });

  it('puts the single pasted key first, ahead of named keys', () => {
    const chain = resolveChain({ AI_API_KEY: KEYS.openrouter, GROQ_API_KEY: KEYS.groq });
    expect(chain[0]?.provider).toBe('openrouter');
    expect(chain.some((entry) => entry.provider === 'groq')).toBe(true);
  });

  it('does not duplicate the same key given twice', () => {
    const chain = resolveChain({ AI_API_KEY: KEYS.groq, GROQ_API_KEY: KEYS.groq });
    expect(chain.filter((entry) => entry.model === 'openai/gpt-oss-120b')).toHaveLength(1);
  });

  it('keeps two different keys for the same provider', () => {
    const chain = resolveChain({ AI_API_KEY: KEYS.groq, GROQ_API_KEY: 'gsk_' + 'z'.repeat(40) });
    expect(chain.filter((entry) => entry.model === 'openai/gpt-oss-120b')).toHaveLength(2);
  });

  it('uses env names that do not collide with common CI variables', () => {
    const chain = resolveChain({
      HF_TOKEN: 'hf_' + 'q'.repeat(30),
      CLOUDFLARE_API_TOKEN: 'cfut_' + 'q'.repeat(40),
      GOOGLE_API_KEY: KEYS.gemini,
    });
    expect(chain).toEqual([]);
  });

  it('uses each provider fast model first for estimates', () => {
    const chain = resolveChain({ GROQ_API_KEY: KEYS.groq }, 'estimate');
    expect(chain.map((entry) => entry.model)).toEqual([
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b',
    ]);
    expect(chain[0]?.jsonMode).toBe('json_schema');
  });

  it('sends Cohere the system prompt as a developer message', () => {
    expect(resolveChain({ COHERE_API_KEY: 'k'.repeat(40) })[0]?.systemRole).toBe('developer');
  });

  it('is empty when nothing is configured', () => {
    expect(resolveChain({})).toEqual([]);
    expect(describeChain({})).toMatchObject({ configured: false, provider: null, model: null });
  });
});

describe('custom endpoints', () => {
  const base = {
    AI_BASE_URL: 'https://llm.example.com/v1/',
    AI_API_KEY: 'secret-key-1234',
    AI_MODEL: 'my-model',
  };

  it('builds a single entry from AI_BASE_URL + AI_API_KEY + AI_MODEL', () => {
    const chain = resolveChain(base);
    expect(chain).toHaveLength(1);
    expect(chain[0]).toMatchObject({
      provider: 'custom',
      baseUrl: 'https://llm.example.com/v1',
      model: 'my-model',
      apiKey: 'secret-key-1234',
    });
  });

  it('needs a model, and a key unless the host is loopback', () => {
    expect(resolveChain({ ...base, AI_MODEL: undefined })).toEqual([]);
    expect(resolveChain({ ...base, AI_API_KEY: undefined })).toEqual([]);
    const local = resolveChain({ AI_BASE_URL: 'http://localhost:11434/v1', AI_MODEL: 'llama3' });
    expect(local[0]).toMatchObject({ apiKey: '', baseUrl: 'http://localhost:11434/v1' });
  });

  it('does not auto-detect a provider when a base URL is given', () => {
    const chain = resolveChain({ ...base, AI_API_KEY: KEYS.groq });
    expect(chain[0]?.baseUrl).toBe('https://llm.example.com/v1');
  });

  it.each([
    ['http://example.com/v1', /https/],
    ['ftp://example.com/v1', /https/],
    ['https://user:pw@example.com/v1', /credentials/],
    ['https://example.com/v1?key=abc', /query/],
    ['https://169.254.169.254/latest', /private/],
    ['https://10.0.0.5/v1', /private/],
    ['https://192.168.1.2/v1', /private/],
    ['https://172.20.0.1/v1', /private/],
    ['https://[fd00::1]/v1', /private/],
    ['https://metadata.internal/v1', /private/],
    ['https://intranet/v1', /private/],
    ['not a url', /valid URL/],
  ])('rejects %s', (url, reason) => {
    const result = checkBaseUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(reason);
  });

  it.each([
    'http://localhost:11434/v1',
    'http://127.0.0.1:8080',
    'https://api.example.com/openai/v1',
  ])('accepts %s', (url) => {
    expect(checkBaseUrl(url).ok).toBe(true);
  });

  it('does not leak the key into problems', () => {
    const plan = planConfig({
      AI_BASE_URL: 'http://example.com',
      AI_API_KEY: 'super-secret-value',
      AI_MODEL: 'm',
    });
    expect(JSON.stringify(plan.problems)).not.toContain('super-secret-value');
  });
});
