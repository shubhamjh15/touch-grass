/**
 * GET /api/climate as a web-standard handler, so it can be tested without a platform. It always
 * answers with a complete payload: live readings where the publishers answered, the bundled
 * snapshot where they did not. Upstream errors never reach the browser.
 */
import { SIGNAL_IDS, type ClimatePayload } from './contract';
import type { ClimateService } from './service';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
} as const;

/** A fully live answer may sit in a shared cache for an hour; a partial one is retried soon. */
const CACHE_LIVE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=600';
const CACHE_PARTIAL = 'public, max-age=60, s-maxage=300';

export interface ClimateHandlerDeps {
  service: ClimateService;
  snapshot: ClimatePayload;
  now?: () => number;
}

export function createClimateHandler(
  deps: ClimateHandlerDeps,
): (request: Request) => Promise<Response> {
  const now = deps.now ?? (() => Date.now());
  return async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return new Response(JSON.stringify({ error: { code: 'method_not_allowed' } }), {
        status: 405,
        headers: { ...HEADERS, allow: 'GET, HEAD', 'cache-control': 'no-store' },
      });

    let payload: ClimatePayload;
    try {
      payload = await deps.service.load();
    } catch {
      payload = { ...deps.snapshot, generatedAt: new Date(now()).toISOString() };
    }
    const allLive = SIGNAL_IDS.every((id) => payload[id].status === 'live');
    return new Response(request.method === 'HEAD' ? null : JSON.stringify(payload), {
      status: 200,
      headers: { ...HEADERS, 'cache-control': allLive ? CACHE_LIVE : CACHE_PARTIAL },
    });
  };
}
