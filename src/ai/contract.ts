/**
 * The wire contract between the browser client (`src/ai`) and the serverless
 * proxy (`api/`, `server/`). Types and constants only: the server imports this
 * file with `import type`, so nothing here may depend on the browser or on Vite.
 */

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Hard limits shared by the client (to avoid wasted requests) and the server (which enforces them). */
export const AI_LIMITS = {
  /** Largest request body the proxy will read, in bytes. */
  maxBodyBytes: 32 * 1024,
  /** Most messages a request may carry. The proxy keeps only the most recent ones. */
  maxMessages: 24,
  /** How many of the most recent messages are forwarded to the model. */
  historyMessages: 10,
  /** Longest user message, in characters. */
  maxUserChars: 600,
  /** Longest assistant message in the history, in characters. */
  maxAssistantChars: 2000,
  /** Longest custom-action description, in characters. */
  maxEstimateChars: 80,
  minEstimateChars: 3,
  /** Largest CO2e a single AI-estimated log can claim, in kg. */
  maxEstimateKg: 5,
} as const;

/** Where in the day the user is. Coarse on purpose: no timestamps leave the device. */
export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface CoachQuest {
  id: string;
  /** One line the model can read, e.g. "Log 3 plant-based meals (1/3)". */
  line: string;
  /** 0..1, used by the offline coach to pick the quest closest to done. */
  progress?: number;
}

/** An action the coach may offer as a "log this" chip. */
export interface CoachAction {
  id: string;
  title: string;
  unit: string;
  category?: string;
  /** True when today's rewarded cap for it is already used. */
  doneToday?: boolean;
}

export interface CoachRecentAction {
  title: string;
  quantity?: number;
  unit?: string;
  daysAgo?: number;
}

export interface CoachCategoryStat {
  category: string;
  count?: number;
  kg?: number;
}

/**
 * What the coach knows about the user. Built by the game layer and handed to the
 * coach through a function argument (the AI module never imports the game
 * store). `displayName` never leaves the device: the model writes `{{name}}`
 * and the browser substitutes it.
 */
export interface CoachContext {
  displayName?: string;
  region?: string;
  partOfDay?: PartOfDay;
  tree?: { name?: string; species?: string; stage?: string; vitality?: string };
  level?: number;
  levelTitle?: string;
  streak?: number;
  /** Banked rain clouds that protect the streak. */
  rain?: number;
  /** One ring per day the user showed up. */
  rings?: number;
  focus?: string[];
  totals?: { kgTotal?: number; kgLast7?: number; actionsTotal?: number };
  topCategories?: CoachCategoryStat[];
  recentActions?: CoachRecentAction[];
  quests?: CoachQuest[];
  /** A one-line summary of the starting-line quiz, e.g. "7.5 t/yr, mostly travel and home". */
  baseline?: string;
  /** Loggable actions; the only ids a chip may reference. */
  actions?: CoachAction[];
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  context?: Omit<CoachContext, 'displayName'>;
}

export type AiErrorCode =
  | 'not_configured'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'invalid_request'
  | 'forbidden_origin'
  | 'too_large'
  | 'method_not_allowed'
  | 'estimate_failed'
  | 'timeout'
  | 'internal'
  /** Client-only: the network is down or the request never reached a server. */
  | 'offline'
  /** Client-only: the caller aborted. */
  | 'aborted';

export interface AiErrorBody {
  error: { code: AiErrorCode; message: string; retryAfterSec?: number };
}

/** Server-sent events emitted by `POST /api/chat`. */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; provider: string; model: string; finish: string }
  | { type: 'error'; code: AiErrorCode; message: string };

export interface ChatResult {
  text: string;
  provider: string;
  model: string;
  finish: string;
}

/** `GET /api/status`. Never contains a secret. */
export interface AiStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  /** True when the active key's terms limit it to development and testing. */
  devOnly?: boolean;
  /** A plain-language hint for the owner when something is almost configured. */
  hint?: string;
}

/** What the browser learns about the proxy; `reason` explains an unconfigured state. */
export interface ClientAiStatus extends AiStatus {
  reason: 'ready' | 'not_configured' | 'no_functions' | 'offline';
}

export const ESTIMATE_CATEGORIES = [
  'transport',
  'food',
  'energy',
  'waste',
  'water',
  'shopping',
  'nature',
] as const;

export type EstimateCategory = (typeof ESTIMATE_CATEGORIES)[number];

/**
 * The product spec names its catalogue categories move / eat / power / water /
 * stuff / waste / nature. Both vocabularies are accepted on input; the estimate
 * always answers in `ESTIMATE_CATEGORIES`, and this map is the bridge for the game layer.
 */
export const SPEC_CATEGORY_TO_ESTIMATE: Readonly<Record<string, EstimateCategory>> = {
  move: 'transport',
  eat: 'food',
  power: 'energy',
  water: 'water',
  stuff: 'shopping',
  waste: 'waste',
  nature: 'nature',
};

export type EstimateConfidence = 'low' | 'medium' | 'high';

export interface EstimateCatalogueEntry {
  id: string;
  title: string;
  unit: string;
}

export interface EstimateRequestBody {
  text: string;
  region: string;
  quantity?: number;
  catalogue?: EstimateCatalogueEntry[];
}

export interface ActionEstimate {
  /** False when the text is not a climate action; the caller offers a journal note instead. */
  isClimateAction: boolean;
  /** A catalogue action the text matches. When set, callers use the catalogue factor, not `co2Kg`. */
  matchedActionId: string | null;
  title: string;
  emoji: string;
  category: EstimateCategory;
  /** 1 (tiny) to 4 (big). */
  effort: 1 | 2 | 3 | 4;
  quantity: number;
  unit: string;
  /** Conservative kg CO2e avoided, 0..5, or null when no honest number exists. */
  co2Kg: number | null;
  /** Never "high" for an AI estimate; the server clamps it. */
  confidence: EstimateConfidence;
  reasoning: string;
}

/** Which path produced an estimate, so the UI can label it truthfully. */
export type EstimateSource = 'ai' | 'heuristic';

export interface EstimateOutcome {
  estimate: ActionEstimate;
  source: EstimateSource;
  /** True when the local heuristic recognised nothing and the category is a placeholder. */
  recognised: boolean;
}
