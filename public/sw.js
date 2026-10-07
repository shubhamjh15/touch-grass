/*
 * Touch Grass service worker. Hand-written, no dependencies.
 *
 * What it does
 *  - Install: stores every page, script, stylesheet, font and icon of this build (the list comes from
 *    /sw-manifest.js, written at build time) in one cache named after the build.
 *  - Pages: network first (so a deploy shows at once), the stored copy when the network is down or slow.
 *  - Static files: stored copy first. Their names carry a hash, so a stored file is never stale.
 *  - Never touches /api, other origins, non-GET requests or range requests.
 *  - Updates: a new build installs in the background and waits. The page asks the person to reload
 *    (they may be in the middle of logging something); on "Reload" it sends SKIP_WAITING.
 */
importScripts('/sw-manifest.js');

const BUILD = self.__TOUCH_GRASS_BUILD;
const SHELL_CACHE = `touchgrass-shell-${BUILD.version}`;
const RUNTIME_CACHE = 'touchgrass-runtime-v1';
const NAVIGATION_TIMEOUT_MS = 4000;
const PRECACHED = new Set(BUILD.urls);

/** Pages are stored without their query: /log?a=bike works from the stored /log. */
function pageKey(pathname) {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return path || '/';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Hashed files can come from the HTTP cache; pages and the manifest must be fresh.
      await Promise.all(
        BUILD.urls.map(async (url) => {
          const hashed = url.startsWith('/_next/static/');
          const response = await fetch(new Request(url, { cache: hashed ? 'default' : 'reload' }));
          // The not-found page answers with a 404 by design; it is stored all the same.
          if (!response.ok && url !== '/_not-found') {
            throw new Error(`Could not store ${url}: ${response.status}`);
          }
          await cache.put(url, response);
        }),
      );
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('touchgrass-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function answerNavigation(request, url) {
  try {
    return await Promise.race([fetch(request), timeout(NAVIGATION_TIMEOUT_MS)]);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const stored = await cache.match(pageKey(url.pathname));
    if (stored) return stored;
    // A path the app does not have: show the app's own "not found" page rather than the browser's.
    const notFound = await cache.match('/_not-found');
    if (notFound) return new Response(notFound.body, { status: 404, headers: notFound.headers });
    return Response.error();
  }
}

async function storedFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const stored = await cache.match(request);
  if (stored) return stored;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(answerNavigation(request, url));
    return;
  }
  // Next's own data requests for client-side navigation: the network, and a full page load when it fails.
  if (request.headers.has('rsc') || url.searchParams.has('_rsc')) return;

  if (url.pathname.startsWith('/_next/static/') || PRECACHED.has(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const stored = await cache.match(url.pathname);
        return stored || storedFirst(request, RUNTIME_CACHE);
      }),
    );
    return;
  }
  if (url.pathname.startsWith('/models/') || /\.(?:png|svg|ico|woff2|webp)$/.test(url.pathname)) {
    event.respondWith(storedFirst(request, RUNTIME_CACHE));
  }
});
