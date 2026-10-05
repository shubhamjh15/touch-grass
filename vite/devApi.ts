import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * Serves the Vercel-style functions in `/api` from the Vite dev server, so
 * `npm run dev` behaves like production without `vercel dev`.
 *
 * A function module may export any of the web-standard shapes Vercel accepts:
 *   - `export default (request: Request) => Response`
 *   - `export default { fetch(request: Request) { … } }`
 *   - `export function GET/POST/…(request: Request) { … }`
 */

type WebHandler = (request: Request) => Response | Promise<Response>;

interface FunctionModule {
  default?: WebHandler | { fetch?: WebHandler };
  [method: string]: unknown;
}

function resolveHandler(mod: FunctionModule, method: string): WebHandler | null {
  const named = mod[method.toUpperCase()];
  if (typeof named === 'function') return named as WebHandler;
  const def = mod.default;
  if (typeof def === 'function') return def;
  if (def && typeof def === 'object' && typeof def.fetch === 'function') return def.fetch.bind(def);
  return null;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req)
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

async function toWebRequest(req: IncomingMessage, signal: AbortSignal): Promise<Request> {
  const origin = `http://${req.headers.host ?? 'localhost'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, value);
  }
  const method = req.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await readBody(req) : undefined;
  return new Request(new URL(req.url ?? '/', origin), {
    method,
    headers,
    body: body && body.length > 0 ? new Uint8Array(body) : undefined,
    signal,
  });
}

async function sendWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Flush every chunk immediately so server-sent events stream in dev.
      res.write(value);
    }
  } finally {
    res.end();
  }
}

function findFunctionFile(root: string, pathname: string): string | null {
  const name = pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '') || 'index';
  if (name.includes('..')) return null;
  for (const candidate of [`${name}.ts`, `${name}/index.ts`]) {
    const file = path.join(root, 'api', candidate);
    if (existsSync(file)) return file;
  }
  return null;
}

export function devApi(): Plugin {
  return {
    name: 'ecoquest:dev-api',
    apply: 'serve',
    config(_, { mode }) {
      // Functions read secrets from process.env, exactly like they do on Vercel.
      // Vite restarts when a .env file changes; drop what we injected last time so
      // an edited or removed key takes effect without restarting `npm run dev`.
      const store = globalThis as { __ecoquestEnvKeys?: Set<string> };
      const injected = (store.__ecoquestEnvKeys ??= new Set<string>());
      for (const key of injected) delete process.env[key];
      injected.clear();

      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
          injected.add(key);
        }
      }
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/') && url !== '/api') return next();

        const pathname = new URL(url, 'http://localhost').pathname;
        const file = findFunctionFile(server.config.root, pathname);
        if (!file) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              error: { code: 'not_found', message: `No function for ${pathname}` },
            }),
          );
          return;
        }

        const abort = new AbortController();
        res.on('close', () => {
          if (!res.writableEnded) abort.abort();
        });

        try {
          const mod = (await server.ssrLoadModule(file)) as FunctionModule;
          const handler = resolveHandler(mod, req.method ?? 'GET');
          if (!handler) {
            res.statusCode = 405;
            res.setHeader('content-type', 'application/json');
            res.end(
              JSON.stringify({
                error: { code: 'method_not_allowed', message: 'Method not allowed' },
              }),
            );
            return;
          }
          const response = await handler(await toWebRequest(req, abort.signal));
          await sendWebResponse(response, res);
        } catch (error) {
          if (abort.signal.aborted) return;
          server.ssrFixStacktrace(error as Error);
          server.config.logger.error(
            `[api] ${pathname} failed: ${(error as Error).stack ?? error}`,
          );
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
          }
          res.end(
            JSON.stringify({
              error: { code: 'internal', message: 'Function crashed. See the dev server log.' },
            }),
          );
        }
      });
    },
  };
}
