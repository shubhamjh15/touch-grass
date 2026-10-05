/**
 * Hand-written request validators with precise 400 messages (no schema library
 * is available on the function runtime), plus history trimming that keeps each
 * request small enough for tight free-tier tokens-per-minute limits.
 */
import { AI_LIMITS, type ChatMessage } from '../../src/ai/contract';

export type Validation<T> = { ok: true; value: T } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Normalises line endings and drops control characters other than newline and tab. */
/* eslint-disable no-control-regex */
const CONTROL = new RegExp(
  '[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]',
  'g',
);
/* eslint-enable no-control-regex */

export function cleanMessageText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function validateChatMessages(value: unknown): Validation<ChatMessage[]> {
  if (!Array.isArray(value) || value.length < 1 || value.length > AI_LIMITS.maxMessages)
    return {
      ok: false,
      message: `messages must be an array of 1 to ${AI_LIMITS.maxMessages} items.`,
    };
  const messages: ChatMessage[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item: unknown = value[i];
    if (!isRecord(item)) return { ok: false, message: `messages[${i}] must be an object.` };
    const role = item.role;
    if (role !== 'user' && role !== 'assistant')
      return { ok: false, message: `messages[${i}].role must be "user" or "assistant".` };
    const max = role === 'user' ? AI_LIMITS.maxUserChars : AI_LIMITS.maxAssistantChars;
    if (typeof item.content !== 'string')
      return { ok: false, message: `messages[${i}].content must be a string.` };
    const content = cleanMessageText(item.content);
    if (content === '') return { ok: false, message: `messages[${i}].content must not be empty.` };
    if ([...content].length > max)
      return {
        ok: false,
        message: `messages[${i}].content is too long: ${role} messages may have at most ${max} characters.`,
      };
    messages.push({ role, content });
  }
  if (messages[messages.length - 1]?.role !== 'user')
    return { ok: false, message: 'The last message must come from the user.' };
  return { ok: true, value: messages };
}

/** Total characters of history sent upstream (about 1,500 tokens). */
const HISTORY_CHAR_BUDGET = 6000;

/**
 * Keeps the most recent turns that fit, merges consecutive messages from the
 * same role (some providers reject them) and makes sure the history starts
 * with a user turn.
 */
export function prepareHistory(messages: readonly ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-AI_LIMITS.historyMessages);
  const kept: ChatMessage[] = [];
  let budget = HISTORY_CHAR_BUDGET;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const message = recent[i];
    if (!message) continue;
    // The newest message is always kept: it is what the user is asking.
    if (kept.length > 0 && message.content.length > budget) break;
    budget -= message.content.length;
    kept.unshift(message);
  }
  const merged: ChatMessage[] = [];
  for (const message of kept) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) last.content = `${last.content}\n\n${message.content}`;
    else merged.push({ ...message });
  }
  while (merged[0] && merged[0].role !== 'user') merged.shift();
  return merged;
}

export interface ChatRequest {
  messages: ChatMessage[];
  rawContext: unknown;
}

export function validateChatBody(body: unknown): Validation<ChatRequest> {
  if (!isRecord(body)) return { ok: false, message: 'The body must be a JSON object.' };
  const messages = validateChatMessages(body.messages);
  if (!messages.ok) return messages;
  if (body.context !== undefined && body.context !== null && !isRecord(body.context))
    return { ok: false, message: 'context must be an object.' };
  return { ok: true, value: { messages: messages.value, rawContext: body.context } };
}
