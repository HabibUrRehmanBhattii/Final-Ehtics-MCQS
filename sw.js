/* PWA Service Worker for LLQP & WFG Exam Prep */
const CACHE_VERSION = 'v1.8.19';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/storage-manager.js',
  '/js/quiz-renderer.js',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
  '/data/topics.json',
  '/data/topics-updated.json',
  '/data/user_data.json'
];

function cacheIfOk(cacheName, key, response) {
  if (!response || !response.ok) {
    return response;
  }

  const copy = response.clone();
  caches.open(cacheName).then((cache) => cache.put(key, copy));
  return response;
}

async function staleWhileRevalidate(request, cacheName, fallbackPath = null) {
  const cache = await caches.open(cacheName);
  const cached = await caches.match(request) || (fallbackPath ? await caches.match(fallbackPath) : null);

  const networkPromise = fetch(request)
    .then((response) => {
      cacheIfOk(cacheName, request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const network = await networkPromise;
  return network || new Response('Offline', { status: 503 });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    return;
  }

  // API requests must always hit network so auth/session state stays fresh.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // PDF + Range requests must go to network (cache can break PDF viewers)
  if (request.headers.has('range') || url.pathname.toLowerCase().endsWith('.pdf')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigations: network-first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheIfOk(STATIC_CACHE, '/index.html', response))
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JSON data: stale-while-revalidate (fast repeat loads + background freshness)
  if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      staleWhileRevalidate(request, DATA_CACHE, url.pathname)
    );
    return;
  }

  // Core UI assets: stale-while-revalidate for fast startup while refreshing in background
  if (
    url.pathname === '/js/app.js' ||
    url.pathname === '/js/auth.js' ||
    url.pathname === '/js/storage-manager.js' ||
    url.pathname === '/js/quiz-renderer.js' ||
    url.pathname === '/css/style.css' ||
    url.pathname === '/index.html' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      staleWhileRevalidate(request, STATIC_CACHE, url.pathname)
    );
    return;
  }

  // Other static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      caches.match(url.pathname).then((pathCached) =>
        pathCached ||
        fetch(request).then((response) => {
          return cacheIfOk(STATIC_CACHE, request, response);
        })
      )
    )
  );
});
