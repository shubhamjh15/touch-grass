import { createEstimateHandler } from '../../../server/ai/estimate';

/** Custom-action CO2e estimate: one short JSON completion, never streamed. The logic lives in server/ai so it can be tested without a platform. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const handler = createEstimateHandler();
const run = (request: Request): Promise<Response> => handler(request);

// The handler answers unsupported methods itself, with the API's JSON error shape.
export { run as GET, run as POST };
