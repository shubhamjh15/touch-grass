import { createStatusHandler } from '../../../server/ai/status';

/** Tells the browser whether a provider key is configured. Never returns a secret. The logic lives in server/ai so it can be tested without a platform. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

const handler = createStatusHandler();
const run = (request: Request): Promise<Response> => handler(request);

// The handler answers unsupported methods itself, with the API's JSON error shape.
export { run as GET, run as POST };
