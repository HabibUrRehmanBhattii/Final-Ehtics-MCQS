const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function normalizeCacheKey(key) {
  if (typeof key === 'string') return key;
  if (key && typeof key.url === 'string') return key.url;
  return String(key);
}

function createCaches() {
  const stores = new Map();
  const addAllCalls = [];
  const putCalls = [];
  const deletedKeys = [];

  function ensureStore(name) {
    if (!stores.has(name)) {
      stores.set(name, new Map());
    }
    return stores.get(name);
  }

  return {
    addAllCalls,
    putCalls,
    deletedKeys,
    async open(name) {
      const store = ensureStore(name);
      return {
        async addAll(entries) {
          addAllCalls.push({ cacheName: name, entries: [...entries] });
        },
        async put(key, response) {
          putCalls.push({ cacheName: name, key: normalizeCacheKey(key), response });
          store.set(normalizeCacheKey(key), response);
        }
      };
    },
    async keys() {
      return Array.from(stores.keys());
    },
    async delete(name) {
      deletedKeys.push(name);
      return stores.delete(name);
    },
    async match(key) {
      const normalizedKey = normalizeCacheKey(key);
      for (const store of stores.values()) {
        if (store.has(normalizedKey)) {
          return store.get(normalizedKey);
        }
      }
      return undefined;
    },
    seed(cacheName, key, response) {
      ensureStore(cacheName).set(normalizeCacheKey(key), response);
    }
  };
}

function createExtendableEvent() {
  let waitPromise = Promise.resolve();
  return {
    waitUntil(promise) {
      waitPromise = Promise.resolve(promise);
    },
    async waitForCompletion() {
      await waitPromise;
    }
  };
}

function createFetchEvent(request) {
  let responsePromise = Promise.resolve(undefined);
  return {
    request,
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    },
    async getResponse() {
      return responsePromise;
    }
  };
}

function loadServiceWorker(options = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'sw.js'),
    'utf8'
  );
  const listeners = new Map();
  const caches = createCaches();
  let skipWaitingCalls = 0;
  let claimCalls = 0;

  const self = {
    location: {
      origin: options.origin || 'https://hllqpmcqs.com'
    },
    clients: {
      claim() {
        claimCalls += 1;
        return Promise.resolve();
      }
    },
    skipWaiting() {
      skipWaitingCalls += 1;
      return Promise.resolve();
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    }
  };

  const context = vm.createContext({
    self,
    caches,
    fetch: options.fetchImpl || fetch,
    Request,
    Response,
    URL,
    console
  });

  vm.runInContext(
    `${source}
this.__TEST_EXPORTS__ = {
  CACHE_VERSION,
  STATIC_CACHE,
  DATA_CACHE,
  CORE_ASSETS
};`,
    context
  );

  return {
    ...context.__TEST_EXPORTS__,
    caches,
    listeners,
    createExtendableEvent,
    createFetchEvent,
    getSkipWaitingCalls() {
      return skipWaitingCalls;
    },
    getClaimCalls() {
      return claimCalls;
    }
  };
}

module.exports = {
  loadServiceWorker
};
