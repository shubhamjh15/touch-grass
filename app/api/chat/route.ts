import { createChatHandler } from '../../../server/ai/chat';

/** Streaming coach endpoint. The logic lives in server/ai so it can be tested without a platform. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const handler = createChatHandler();
const run = (request: Request): Promise<Response> => handler(request);

// The handler answers unsupported methods itself, with the API's JSON error shape.
export { run as GET, run as POST };
