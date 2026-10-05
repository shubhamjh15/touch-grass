import { createChatHandler } from '../server/ai/chat.js';

/**
 * Streaming coach endpoint. The handler lives in server/ai so it can be tested
 * without a platform; this file only adapts it to the Vercel Functions
 * web-handler signature (`export default { fetch }`), which vite/devApi.ts
 * also serves in development.
 */
export const config = { runtime: 'nodejs', maxDuration: 60 };

const handler = createChatHandler();

export default {
  fetch: (request: Request): Promise<Response> => handler(request),
};
