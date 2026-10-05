import { createEstimateHandler } from '../server/ai/estimate.js';

/** Custom-action CO2e estimate: one short JSON completion, never streamed. */
export const config = { runtime: 'nodejs', maxDuration: 15 };

const handler = createEstimateHandler();

export default {
  fetch: (request: Request): Promise<Response> => handler(request),
};
