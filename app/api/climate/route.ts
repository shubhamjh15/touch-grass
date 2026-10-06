import { createClimateHandler } from '../../../server/climate/handler';
import { createClimateService } from '../../../server/climate/service';
import { CLIMATE_SNAPSHOT } from '../../../server/climate/snapshot';

/**
 * Public climate readings for the Impact page, fetched here so the browser never calls a third
 * party. Each publisher's answer is kept in the data cache for a day (`revalidate`); the logic
 * lives in server/climate so it can be tested without a platform.
 */
export const runtime = 'nodejs';
export const maxDuration = 20;

const DAY_SECONDS = 86_400;
const UPSTREAM_TIMEOUT_MS = 8_000;
const USER_AGENT = 'TouchGrass/1.0 (climate readings for the Impact page)';

const service = createClimateService({
  snapshot: CLIMATE_SNAPSHOT,
  fetch: (url) =>
    fetch(url, {
      next: { revalidate: DAY_SECONDS },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      // NASA's server hangs up on requests that do not say who is asking.
      headers: {
        accept: 'application/json, text/csv;q=0.9, text/plain;q=0.8',
        'user-agent': USER_AGENT,
      },
    }),
});
const handler = createClimateHandler({ service, snapshot: CLIMATE_SNAPSHOT });

export function GET(request: Request): Promise<Response> {
  return handler(request);
}
