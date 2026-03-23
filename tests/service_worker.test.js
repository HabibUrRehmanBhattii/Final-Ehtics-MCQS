const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadServiceWorker
} = require('./helpers/service_worker_test_utils');

test('install pre-caches the core assets and activates the new worker immediately', async () => {
  const worker = loadServiceWorker();
  const installEvent = worker.createExtendableEvent();

  worker.listeners.get('install')(installEvent);
  await installEvent.waitForCompletion();

  assert.equal(worker.getSkipWaitingCalls(), 1);
  assert.equal(worker.caches.addAllCalls.length, 1);
  assert.equal(worker.caches.addAllCalls[0].cacheName, worker.STATIC_CACHE);
  assert.deepEqual(
    Array.from(worker.caches.addAllCalls[0].entries),
    Array.from(worker.CORE_ASSETS)
  );
});

test('activate removes stale caches and claims open clients', async () => {
  const worker = loadServiceWorker();
  const activateEvent = worker.createExtendableEvent();

  await worker.caches.open(worker.STATIC_CACHE);
  await worker.caches.open(worker.DATA_CACHE);
  await worker.caches.open('static-v1.6.0');
  await worker.caches.open('misc-cache');

  worker.listeners.get('activate')(activateEvent);
  await activateEvent.waitForCompletion();

  assert.deepEqual(worker.caches.deletedKeys.sort(), ['misc-cache', 'static-v1.6.0']);
  assert.equal(worker.getClaimCalls(), 1);
});

test('API requests always bypass caches and hit the network directly', async () => {
  const fetchCalls = [];
  const worker = loadServiceWorker({
    fetchImpl: async (request) => {
      fetchCalls.push(request.url);
      return new Response('api ok');
    }
  });
  const event = worker.createFetchEvent(
    new Request('https://hllqpmcqs.com/api/auth/session')
  );

  worker.listeners.get('fetch')(event);
  const response = await event.getResponse();

  assert.equal(await response.text(), 'api ok');
  assert.deepEqual(fetchCalls, ['https://hllqpmcqs.com/api/auth/session']);
  assert.equal(worker.caches.putCalls.length, 0);
});

test('JSON data requests cache successful responses but skip caching server errors', async () => {
  const responses = [
    new Response('{"topics":[]}', { status: 200 }),
    new Response('server exploded', { status: 500 })
  ];
  const worker = loadServiceWorker({
    fetchImpl: async () => responses.shift()
  });

  const successEvent = worker.createFetchEvent(
    new Request('https://hllqpmcqs.com/data/topics.json')
  );
  worker.listeners.get('fetch')(successEvent);
  await successEvent.getResponse();

  const failureEvent = worker.createFetchEvent(
    new Request('https://hllqpmcqs.com/data/topics-updated.json')
  );
  worker.listeners.get('fetch')(failureEvent);
  await failureEvent.getResponse();

  assert.deepEqual(
    worker.caches.putCalls.map(({ cacheName, key, response }) => ({
      cacheName,
      key,
      status: response.status
    })),
    [
      {
        cacheName: worker.DATA_CACHE,
        key: 'https://hllqpmcqs.com/data/topics.json',
        status: 200
      }
    ]
  );
});

test('core UI assets fall back to a cached path match when the network is unavailable', async () => {
  const worker = loadServiceWorker({
    fetchImpl: async () => {
      throw new Error('offline');
    }
  });
  worker.caches.seed(
    worker.STATIC_CACHE,
    '/js/app.js',
    new Response('cached app bundle', { status: 200 })
  );

  const event = worker.createFetchEvent(
    new Request('https://hllqpmcqs.com/js/app.js')
  );
  worker.listeners.get('fetch')(event);
  const response = await event.getResponse();

  assert.equal(await response.text(), 'cached app bundle');
});
