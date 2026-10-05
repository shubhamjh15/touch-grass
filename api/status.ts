import { createStatusHandler } from '../server/ai/status.js';

/** Tells the browser whether a provider key is configured. Never returns a secret. */
export const config = { runtime: 'nodejs', maxDuration: 5 };

const handler = createStatusHandler();

export default {
  fetch: (request: Request): Promise<Response> => handler(request),
};
