/**
 * Registry of OpenAI-compatible chat providers and the logic that turns
 * environment variables into an ordered failover chain.
 *
 * Values come from `.redesign/research/ai-providers.md` (verified 2026-10-06).
 * Model ids churn monthly on free tiers: every default can be overridden with
 * AI_MODEL, and the failover chain tolerates a retired id (HTTP 404 / 410).
 *
 * Runs on Vercel: no browser APIs, no imports from outside `server/`.
 */

export type Env = Readonly<Record<string, string | undefined>>;

export type ProviderId =
  | 'groq'
  | 'gemini'
  | 'mistral'
  | 'openrouter'
  | 'cloudflare'
  | 'sambanova'
  | 'nvidia'
  | 'cohere'
  | 'cerebras'
  | 'huggingface'
  | 'together'
  | 'vercel'
  | 'custom';

/** What a request is for. Estimates are short JSON jobs, so they prefer each provider's fast model. */
export type Purpose = 'chat' | 'estimate';

/** How strictly a model can be told to answer in JSON. */
export type JsonMode = 'json_schema' | 'json_object' | 'none';

interface ProviderDef {
  id: Exclude<ProviderId, 'custom'>;
  label: string;
  /** No trailing slash. `{account}` is replaced by the Cloudflare account id. */
  baseUrl: string;
  keyEnv: string;
  /** Extra variable some providers need next to the key. */
  accountEnv?: string;
  smart: string;
  fast: string;
  /** Models tried in order for chat. The first is what the status endpoint reports. */
  chat: readonly string[];
  maxTokensField: 'max_tokens' | 'max_completion_tokens';
  /** Cohere documents its system prompt under the "developer" role. */
  systemRole: 'system' | 'developer';
  headers?: Readonly<Record<string, string>>;
  /** Terms limit the key to development and testing (shown as a warning in the UI). */
  devOnly?: boolean;
  jsonMode(model: string): JsonMode;
  extraBody(model: string): Record<string, unknown>;
}

const none = (): Record<string, never> => ({});

const PROVIDERS: Readonly<Record<Exclude<ProviderId, 'custom'>, ProviderDef>> = {
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    smart: 'openai/gpt-oss-120b',
    fast: 'openai/gpt-oss-20b',
    chat: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
    maxTokensField: 'max_completion_tokens',
    systemRole: 'system',
    // Structured outputs work on these three; the other Groq models only know json_object.
    jsonMode: (model) =>
      model.startsWith('openai/gpt-oss') || model.startsWith('qwen/')
        ? 'json_schema'
        : 'json_object',
    // GPT-OSS always reasons: keep it short and keep the reasoning out of the stream.
    extraBody: (model) =>
      model.includes('gpt-oss')
        ? { reasoning_effort: 'low', include_reasoning: false }
        : model.startsWith('qwen/')
          ? { reasoning_effort: 'none' }
          : {},
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    smart: 'gemini-3.8-flash',
    fast: 'gemini-3.5-flash-lite',
    // 3.8 Flash is reported at about 20 requests/day on the free tier, so it is not a chat default.
    chat: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    jsonMode: () => 'json_object',
    // Thinking cannot be switched off on Gemini 3 models; "minimal" is an error on 3.8 Flash.
    extraBody: (model) => (model === 'gemini-3.8-flash' ? { reasoning_effort: 'low' } : {}),
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyEnv: 'MISTRAL_API_KEY',
    smart: 'mistral-medium-latest',
    fast: 'mistral-small-latest',
    chat: ['mistral-small-latest', 'mistral-medium-latest'],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    jsonMode: () => 'json_object',
    extraBody: none,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    smart: 'nvidia/nemotron-3-super-120b-a12b:free',
    fast: 'google/gemma-4-31b-it:free',
    // "openrouter/free" may land on a coding or classifier model: last resort only.
    chat: [
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'openrouter/free',
    ],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    headers: { 'X-OpenRouter-Title': 'EcoQuest' },
    jsonMode: () => 'json_object',
    extraBody: none,
  },
  cloudflare: {
    id: 'cloudflare',
    label: 'Cloudflare Workers AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1',
    keyEnv: 'CLOUDFLARE_AI_TOKEN',
    accountEnv: 'CLOUDFLARE_AI_ACCOUNT_ID',
    smart: '@cf/openai/gpt-oss-120b',
    fast: '@cf/google/gemma-4-26b-a4b-it',
    chat: ['@cf/openai/gpt-oss-120b', '@cf/google/gemma-4-26b-a4b-it'],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    jsonMode: () => 'none',
    extraBody: none,
  },
  sambanova: {
    id: 'sambanova',
    label: 'SambaNova',
    baseUrl: 'https://api.sambanova.ai/v1',
    keyEnv: 'SAMBANOVA_API_KEY',
    smart: 'gpt-oss-120b',
    fast: 'Meta-Llama-3.3-70B-Instruct',
    chat: ['gpt-oss-120b'],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    jsonMode: () => 'none',
    extraBody: none,
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    keyEnv: 'NVIDIA_API_KEY',
    smart: 'nvidia/nemotron-3-super-120b-a12b',
    fast: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    chat: ['nvidia/nemotron-3-super-120b-a12b'],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    devOnly: true,
    jsonMode: () => 'none',
    extraBody: none,
  },
  cohere: {
    id: 'cohere',
    label: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    keyEnv: 'COHERE_API_KEY',
    smart: 'command-a-plus-05-2026',
    fast: 'command-r7b-12-2024',
    chat: ['command-a-plus-05-2026', 'command-a-03-2025'],
    maxTokensField: 'max_tokens',
    systemRole: 'developer',
    devOnly: true,
    jsonMode: () => 'none',
    extraBody: none,
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyEnv: 'CEREBRAS_API_KEY',
    smart: 'gpt-oss-120b',
    fast: 'qwen-3.8-27b',
    chat: ['gpt-oss-120b', 'qwen-3.8-27b'],
    maxTokensField: 'max_completion_tokens',
    systemRole: 'system',
    jsonMode: () => 'json_object',
    extraBody: none,
  },
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face',
    baseUrl: 'https://router.huggingface.co/v1',
    // HF_TOKEN is what the Hugging Face CLI and many CI jobs already export, so it is not read.
    keyEnv: 'HUGGINGFACE_API_KEY',
    smart: 'openai/gpt-oss-120b:cheapest',
    fast: 'openai/gpt-oss-20b:fastest',
    chat: ['openai/gpt-oss-120b:cheapest'],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    jsonMode: () => 'json_object',
    extraBody: none,
  },
  together: {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.ai/v1',
    keyEnv: 'TOGETHER_API_KEY',
    // The research lists no verified Together model: these are a best guess, set AI_MODEL if they 404.
    smart: 'openai/gpt-oss-120b',
    fast: 'openai/gpt-oss-20b',
    chat: ['openai/gpt-oss-120b'],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    jsonMode: () => 'json_object',
    extraBody: none,
  },
  vercel: {
    id: 'vercel',
    label: 'Vercel AI Gateway',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    keyEnv: 'AI_GATEWAY_API_KEY',
    // Which models are in the free credit subset is UNVERIFIED; override with AI_MODEL.
    smart: 'openai/gpt-oss-120b',
    fast: 'openai/gpt-oss-20b',
    chat: ['openai/gpt-oss-120b'],
    maxTokensField: 'max_tokens',
    systemRole: 'system',
    jsonMode: () => 'json_object',
    extraBody: none,
  },
};

/**
 * Failover order from the research: truly free and published limits first,
 * then free-but-opaque, then dev-only trial keys, then paid options.
 */
export const DEFAULT_ORDER: readonly ProviderId[] = [
  'groq',
  'gemini',
  'mistral',
  'openrouter',
  'cloudflare',
  'sambanova',
  'nvidia',
  'cohere',
  'cerebras',
  'huggingface',
  'together',
  'vercel',
  'custom',
];

export const PROVIDER_IDS: readonly ProviderId[] = DEFAULT_ORDER;

export function isProviderId(value: string): value is ProviderId {
  return (DEFAULT_ORDER as readonly string[]).includes(value);
}

export interface ChainEntry {
  provider: ProviderId;
  label: string;
  /** Validated, no trailing slash. */
  baseUrl: string;
  /** Empty only for a local model on loopback that needs no key. */
  apiKey: string;
  model: string;
  /** Name of the variable the key came from. Safe to log; used for cool-downs. */
  keyRef: string;
  maxTokensField: 'max_tokens' | 'max_completion_tokens';
  systemRole: 'system' | 'developer';
  headers: Readonly<Record<string, string>>;
  jsonMode: JsonMode;
  extraBody: Readonly<Record<string, unknown>>;
  devOnly: boolean;
}

interface KeySource {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  keyRef: string;
  /** AI_MODEL: when set it is the only model tried for this source. */
  modelOverride?: string;
  /** The single key the owner pasted (or the custom endpoint): tried first unless the order says otherwise. */
  primary: boolean;
}

export interface ConfigPlan {
  chain: ChainEntry[];
  /** Plain-language reasons something was ignored. Contain no secrets. */
  problems: string[];
}

// ---------------------------------------------------------------------------
// Key hygiene and provider detection
// ---------------------------------------------------------------------------

/** Trim, drop wrapping quotes that sneak in from dashboards, and reject anything that is not a plausible token. */
export function cleanSecret(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  let value = raw.trim();
  if (value.length >= 2 && /^(["'`]).*\1$/.test(value)) value = value.slice(1, -1).trim();
  if (value === '') return null;
  return /^[\x21-\x7e]{8,512}$/.test(value) ? value : null;
}

export type Detection =
  | { kind: 'provider'; provider: Exclude<ProviderId, 'custom'> }
  | { kind: 'unresolved'; hint: string };

/**
 * Guess the provider from a pasted key. Order matters: "sk-or-" must be tested
 * before the generic "sk-". Shapes without a documented prefix (Mistral,
 * Cohere, SambaNova, Together) are never guessed silently: the owner sets
 * AI_PROVIDER.
 */
export function detectProvider(key: string): Detection {
  if (/^gsk_/.test(key)) return { kind: 'provider', provider: 'groq' };
  if (/^sk-or-/.test(key)) return { kind: 'provider', provider: 'openrouter' };
  if (/^AIza[0-9A-Za-z_-]{35}$/.test(key) || /^AQ\.[A-Za-z0-9_.-]+$/.test(key))
    return { kind: 'provider', provider: 'gemini' };
  if (/^nvapi-/.test(key)) return { kind: 'provider', provider: 'nvidia' };
  if (/^hf_/.test(key)) return { kind: 'provider', provider: 'huggingface' };
  if (/^csk-/.test(key)) return { kind: 'provider', provider: 'cerebras' };
  if (/^cf(ut|at)_/.test(key)) return { kind: 'provider', provider: 'cloudflare' };
  if (/^vck_/.test(key)) return { kind: 'provider', provider: 'vercel' };
  if (/^(github_pat_|ghp_|gho_|ghs_)/.test(key))
    return {
      kind: 'unresolved',
      hint: 'That looks like a GitHub token. GitHub Models was shut down in July 2026: use a free Groq key (gsk_...) instead.',
    };
  if (/^(sk-ant-|sk-|xai-)/.test(key))
    return {
      kind: 'unresolved',
      hint: 'That key belongs to a provider with no free tier here. To use it anyway, also set AI_BASE_URL and AI_MODEL.',
    };
  return {
    kind: 'unresolved',
    hint: 'The key has no recognisable prefix. Set AI_PROVIDER (for example mistral, cohere or sambanova) next to AI_API_KEY, or use a Groq key (gsk_...).',
  };
}

// ---------------------------------------------------------------------------
// Base URL validation (custom endpoints)
// ---------------------------------------------------------------------------

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a = 0, b = 0] = [Number(match[1]), Number(match[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

export type BaseUrlCheck =
  { ok: true; url: string; loopback: boolean } | { ok: false; reason: string };

/**
 * Only https endpoints (plus http on loopback for a local model such as
 * Ollama). Rejects credentials in the URL, query strings, and hosts that are
 * private-network IP literals or internal names. A hostname that *resolves* to
 * a private address cannot be caught here; the value is set by the deployment
 * owner, never by a request, and redirects are never followed.
 */
export function checkBaseUrl(raw: string): BaseUrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'AI_BASE_URL is not a valid URL.' };
  }
  const host = url.hostname.toLowerCase();
  const loopback = LOOPBACK_HOSTS.has(host);
  if (url.username || url.password)
    return { ok: false, reason: 'AI_BASE_URL must not contain credentials.' };
  if (url.search || url.hash)
    return { ok: false, reason: 'AI_BASE_URL must not contain a query string or fragment.' };
  if (url.protocol === 'http:') {
    if (!loopback)
      return {
        ok: false,
        reason: 'AI_BASE_URL must use https (http is only allowed for localhost or 127.0.0.1).',
      };
  } else if (url.protocol !== 'https:') {
    return { ok: false, reason: 'AI_BASE_URL must use https.' };
  }
  if (!loopback) {
    if (
      host.startsWith('[') ||
      isPrivateIpv4(host) ||
      /\.(internal|local|localdomain|lan|home)$/.test(host) ||
      !host.includes('.')
    )
      return { ok: false, reason: 'AI_BASE_URL points at a private or internal host.' };
  }
  return { ok: true, url: `${url.origin}${url.pathname}`.replace(/\/+$/, ''), loopback };
}

// ---------------------------------------------------------------------------
// Building the chain
// ---------------------------------------------------------------------------

function parseOrder(raw: string | undefined, problems: string[]): ProviderId[] {
  if (!raw) return [];
  const seen: ProviderId[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim().toLowerCase();
    if (id === '') continue;
    if (!isProviderId(id)) {
      problems.push(`AI_FALLBACK_ORDER names an unknown provider "${id.slice(0, 24)}".`);
      continue;
    }
    if (!seen.includes(id)) seen.push(id);
  }
  return seen;
}

function resolveBase(def: ProviderDef, env: Env, problems: string[]): string | null {
  if (!def.baseUrl.includes('{account}')) return def.baseUrl;
  const account = (def.accountEnv ? env[def.accountEnv] : undefined)?.trim() ?? '';
  if (!/^[0-9a-f]{32}$/i.test(account)) {
    problems.push(`${def.label} also needs ${def.accountEnv} (the 32-character account id).`);
    return null;
  }
  return def.baseUrl.replace('{account}', account.toLowerCase());
}

function collectSources(env: Env, problems: string[]): KeySource[] {
  const sources: KeySource[] = [];
  const customBase = env.AI_BASE_URL?.trim();
  const genericKeyRaw = env.AI_API_KEY;
  const genericKey = cleanSecret(genericKeyRaw);
  if (genericKeyRaw?.trim() && !genericKey)
    problems.push(
      'AI_API_KEY is set but does not look like an API key (empty, too short or contains spaces).',
    );
  const modelOverride = env.AI_MODEL?.trim() || undefined;

  if (customBase) {
    const check = checkBaseUrl(customBase);
    if (!check.ok) problems.push(check.reason);
    else if (!modelOverride) problems.push('AI_BASE_URL needs AI_MODEL too.');
    else if (!genericKey && !check.loopback) problems.push('AI_BASE_URL needs AI_API_KEY too.');
    else
      sources.push({
        provider: 'custom',
        apiKey: genericKey ?? '',
        baseUrl: check.url,
        keyRef: 'AI_API_KEY',
        modelOverride,
        primary: true,
      });
  } else if (genericKey) {
    const forced = env.AI_PROVIDER?.trim().toLowerCase();
    let provider: Exclude<ProviderId, 'custom'> | null = null;
    if (forced) {
      if (isProviderId(forced) && forced !== 'custom') provider = forced;
      else
        problems.push(
          `AI_PROVIDER "${forced.slice(0, 24)}" is not a known provider (or needs AI_BASE_URL).`,
        );
    } else {
      const detected = detectProvider(genericKey);
      if (detected.kind === 'provider') provider = detected.provider;
      else problems.push(detected.hint);
    }
    if (provider) {
      const base = resolveBase(PROVIDERS[provider], env, problems);
      if (base)
        sources.push({
          provider,
          apiKey: genericKey,
          baseUrl: base,
          keyRef: 'AI_API_KEY',
          modelOverride,
          primary: true,
        });
    }
  }

  for (const id of DEFAULT_ORDER) {
    if (id === 'custom') continue;
    const def = PROVIDERS[id];
    const raw = env[def.keyEnv];
    if (raw === undefined || raw.trim() === '') continue;
    const key = cleanSecret(raw);
    if (!key) {
      problems.push(`${def.keyEnv} is set but does not look like an API key.`);
      continue;
    }
    if (sources.some((source) => source.provider === id && source.apiKey === key)) continue;
    const base = resolveBase(def, env, problems);
    if (base)
      sources.push({
        provider: id,
        apiKey: key,
        baseUrl: base,
        keyRef: def.keyEnv,
        primary: false,
      });
  }
  return sources;
}

function entriesFor(source: KeySource, purpose: Purpose): ChainEntry[] {
  if (source.provider === 'custom') {
    const model = source.modelOverride ?? '';
    return [
      {
        provider: 'custom',
        label: 'Custom endpoint',
        baseUrl: source.baseUrl,
        apiKey: source.apiKey,
        model,
        keyRef: source.keyRef,
        maxTokensField: 'max_tokens',
        systemRole: 'system',
        headers: {},
        jsonMode: 'none',
        extraBody: {},
        devOnly: false,
      },
    ];
  }
  const def = PROVIDERS[source.provider];
  const models = source.modelOverride
    ? [source.modelOverride]
    : purpose === 'estimate'
      ? [def.fast, def.smart]
      : def.chat;
  return [...new Set(models)].map((model) => ({
    provider: def.id,
    label: def.label,
    baseUrl: source.baseUrl,
    apiKey: source.apiKey,
    model,
    keyRef: source.keyRef,
    maxTokensField: def.maxTokensField,
    systemRole: def.systemRole,
    headers: def.headers ?? {},
    jsonMode: def.jsonMode(model),
    extraBody: def.extraBody(model),
    devOnly: def.devOnly ?? false,
  }));
}

/**
 * Reads the environment and returns the usable failover chain plus any
 * plain-language problems (never containing a secret).
 *
 * Variables:
 *   AI_API_KEY (+ AI_PROVIDER, AI_MODEL)    one key, provider auto-detected from its prefix
 *   GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY, ...   named keys
 *   AI_FALLBACK_ORDER                       comma list of provider ids, tried first in that order
 *   AI_BASE_URL + AI_API_KEY + AI_MODEL     any other OpenAI-compatible endpoint
 */
export function planConfig(env: Env, purpose: Purpose = 'chat'): ConfigPlan {
  const problems: string[] = [];
  const sources = collectSources(env, problems);
  const override = parseOrder(env.AI_FALLBACK_ORDER, problems);
  const ranking: ProviderId[] = [
    ...override,
    ...DEFAULT_ORDER.filter((id) => !override.includes(id)),
  ];
  const rank = (source: KeySource): number =>
    override.length === 0 && source.primary ? -1 : ranking.indexOf(source.provider);
  const ordered = sources
    .map((source, index) => ({ source, index }))
    .sort((a, b) => rank(a.source) - rank(b.source) || a.index - b.index)
    .map(({ source }) => source);
  return { chain: ordered.flatMap((source) => entriesFor(source, purpose)), problems };
}

export function resolveChain(env: Env, purpose: Purpose = 'chat'): ChainEntry[] {
  return planConfig(env, purpose).chain;
}

/** Display values for the status endpoint (the head of the chat chain). */
export function describeChain(env: Env): {
  configured: boolean;
  provider: string | null;
  model: string | null;
  devOnly: boolean;
  hint: string | undefined;
} {
  const { chain, problems } = planConfig(env, 'chat');
  const head = chain[0];
  return {
    configured: head !== undefined,
    provider: head?.label ?? null,
    model: head?.model ?? null,
    devOnly: head?.devOnly ?? false,
    hint: head ? undefined : problems[0],
  };
}
