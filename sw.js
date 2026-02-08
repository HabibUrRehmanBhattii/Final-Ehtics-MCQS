/* PWA Service Worker for LLQP & WFG Exam Prep */
const CACHE_VERSION = 'v1.0.6';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
  '/data/topics.json',
  '/data/topics-updated.json',
  '/data/user_data.json',
  '/data/llqp-ethics/practice-1.json',
  '/data/llqp-ethics/practice-2.json',
  '/data/llqp-ethics/practice-3.json',
  '/data/llqp-segregated/practice-1.json',
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
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

  // JSON data: stale-while-revalidate
  if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise || new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Other static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
    )
  );
});
