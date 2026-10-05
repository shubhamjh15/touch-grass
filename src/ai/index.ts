/**
 * The AI module's public surface. Pages import from "@/ai", never from a file inside it.
 *
 * - `useCoach(getContext)`: the chat hook. `getContext` is the seam to the game: return a `CoachContext`.
 * - `parseCoachText`: turn a message into text and "log this" chips while it streams.
 * - `estimateCustomAction`: AI estimate with a local fallback, labelled with its source.
 * - `respondOffline`, `offlineTip`: the built-in coach, also used for Today's tip.
 */
export {
  AiError,
  createAiClient,
  createNameFilter,
  estimateAction,
  getAiStatus,
  isAiError,
  parseActionEstimate,
  resetAiStatus,
  streamChat,
  toWireContext,
  type AiClient,
  type AiClientOptions,
  type StreamChatParams,
} from './client';
export {
  chipHref,
  chipKey,
  parseCoachText,
  stripChips,
  type ChipOptions,
  type ChipSegment,
  type CoachSegment,
  type TextSegment,
} from './chips';
export {
  createCoachController,
  fallbackNotice,
  type CoachClient,
  type CoachController,
  type SendResult,
} from './coachController';
export {
  MAX_STORED_MESSAGES,
  createCoachStore,
  useCoachStore,
  type CoachMessage,
  type CoachNotice,
  type CoachState,
  type MessageSource,
  type MessageStatus,
} from './coachStore';
export {
  AI_LIMITS,
  ESTIMATE_CATEGORIES,
  EVIDENCE_CATEGORY_TO_PRODUCT,
  type ActionEstimate,
  type AiErrorCode,
  type AiStatus,
  type ChatMessage,
  type ChatResult,
  type ChatRole,
  type ClientAiStatus,
  type CoachAction,
  type CoachCategoryStat,
  type CoachContext,
  type CoachQuest,
  type CoachRecentAction,
  type EstimateCatalogueEntry,
  type EstimateCategory,
  type EstimateConfidence,
  type EstimateOutcome,
  type EstimateSource,
  type PartOfDay,
  type StreamEvent,
} from './contract';
export {
  estimateCustomAction,
  estimateLocally,
  estimateSourceLabel,
  type EstimateOptions,
} from './estimate';
export {
  DAILY_FACTS,
  OFFLINE_LABEL,
  QUICK_PROMPTS,
  matchIntent,
  offlineTip,
  respondOffline,
  runOfflineCoach,
  streamOfflineText,
  type IntentId,
  type OfflineAnswer,
  type OfflineReply,
  type QuickPrompt,
} from './offline';
export { useCoach, type CoachMode, type UseCoach, type UseCoachOptions } from './useCoach';
