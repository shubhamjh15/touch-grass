/**
 * GET /api/status: tells the browser whether a provider key is configured and
 * which provider and model would answer. Never contains a secret.
 */
import type { AiStatus } from '../../src/ai/contract';
import { defaultEnv } from './runtime';
import { errorResponse, jsonResponse, SAFE_MESSAGES } from './http';
import { describeChain, type Env } from './providers';

export interface StatusDeps {
  env?: () => Env;
}

export function createStatusHandler(
  deps: StatusDeps = {},
): (request: Request) => Promise<Response> {
  const getEnv = deps.env ?? defaultEnv;
  return async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return errorResponse('method_not_allowed', SAFE_MESSAGES.method_not_allowed, {
        headers: { allow: 'GET, HEAD' },
      });
    try {
      const { configured, provider, model, devOnly, hint } = describeChain(getEnv());
      const status: AiStatus = {
        configured,
        provider,
        model,
        ...(devOnly ? { devOnly: true } : {}),
        ...(hint ? { hint } : {}),
      };
      return jsonResponse(status);
    } catch {
      return errorResponse('internal', SAFE_MESSAGES.internal);
    }
  };
}
