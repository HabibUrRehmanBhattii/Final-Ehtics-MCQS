/* PWA Service Worker for LLQP & WFG Exam Prep */
const CACHE_VERSION = 'v1.7.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/auth.js',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
  '/data/topics.json',
  '/data/topics-updated.json',
  '/data/user_data.json',
  '/data/llqp-ethics/llqp-ethics-1.json',
  '/data/llqp-ethics/llqp-ethics-2.json',
  '/data/llqp-ethics/llqp-ethics-3.json',
  '/data/llqp-segregated/llqp-segregated-1.json',
  '/data/llqp-segregated/llqp-segregated-certification-exam.json',
  '/data/llqp-life/llqp-life-01.json',
  '/data/llqp-life/llqp-life-01-part-1.json',
  '/data/llqp-life/llqp-life-01-part-2.json',
  '/data/llqp-life/hllqp-life-02.json',
  '/data/llqp-life/hllqp-life-02-part-1.json',
  '/data/llqp-life/hllqp-life-02-part-2.json',
  '/data/llqp-life/hllqp-life-02-part-3.json',
  '/data/llqp-life/hllqp-life-02-part-4.json',
  '/data/llqp-life/hllqp-life-03.json',
  '/data/llqp-life/hllqp-life-03-part-1.json',
  '/data/llqp-life/hllqp-life-03-part-2.json',
  '/data/llqp-life/hllqp-life-03-part-3.json',
  '/data/llqp-life/hllqp-life-03-part-4.json',
  '/data/llqp-life/hllqp-life-03-part-5.json',
  '/data/llqp-life/hllqp-life-04.json',
  '/data/llqp-life/hllqp-life-04-part-1.json',
  '/data/llqp-life/hllqp-life-04-part-2.json',
  '/data/llqp-life/hllqp-life-04-part-3.json',
  '/data/llqp-life/hllqp-life-04-part-4.json',
  '/data/llqp-life/llqp-life-certification-exam.json',
  '/data/insurance-legislation-ethics/insurance-legislation-ethics-1.json',
  '/data/flashcards/flashcards-1.json',
  '/data/flashcards/flashcards-2.json',
  '/data/flashcards/flashcards-2-full.json',
  '/data/flashcards/flashcards-2-part-1.json',
  '/data/flashcards/flashcards-2-part-2.json',
  '/data/flashcards/flashcards-2-part-3.json',
  '/data/flashcards/flashcards-2-part-4.json',
  '/data/flashcards/flashcards-2-part-5.json',
  '/data/flashcards/flashcards-2-part-6.json',
  '/data/flashcards/flashcards-2-part-7.json',
  '/data/flashcards/flashcards-2-part-8.json'
];

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

  // PDF + Range requests must go to network (cache can break PDF viewers)
  if (request.headers.has('range') || url.pathname.toLowerCase().endsWith('.pdf')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigations: network-first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JSON data: network-first (prevents stale content after deploy)
  if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(url.pathname)))
        .then((fallback) => fallback || new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Core UI assets: network-first so users get latest JS/CSS quickly after deploy
  if (
    url.pathname === '/js/app.js' ||
    url.pathname === '/js/auth.js' ||
    url.pathname === '/css/style.css' ||
    url.pathname === '/index.html' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(url.pathname)))
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
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
      )
    )
  );
});
