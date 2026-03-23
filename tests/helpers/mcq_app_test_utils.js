const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class ClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(...tokens) {
    tokens.forEach((token) => this.values.add(token));
  }

  remove(...tokens) {
    tokens.forEach((token) => this.values.delete(token));
  }

  toggle(token, force) {
    if (typeof force === 'boolean') {
      if (force) {
        this.values.add(token);
      } else {
        this.values.delete(token);
      }
      return force;
    }

    if (this.values.has(token)) {
      this.values.delete(token);
      return false;
    }

    this.values.add(token);
    return true;
  }

  contains(token) {
    return this.values.has(token);
  }
}

class ElementStub {
  constructor({
    classes = [],
    querySelectorAll,
    closest,
    matches,
    parentElement = null,
    innerText = '',
    textContent = ''
  } = {}) {
    this.textContent = textContent;
    this.innerText = innerText;
    this.innerHTML = '';
    this.style = {};
    this.attributes = {};
    this.classList = new ClassList(classes);
    this.querySelectorAll = querySelectorAll || (() => []);
    this.closestImpl = closest || null;
    this.matchesImpl = matches || null;
    this.parentElement = parentElement;
    this.disabled = false;
    this.required = false;
    this.value = '';
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  addEventListener() {}

  removeEventListener() {}

  focus() {}

  matches(...args) {
    if (typeof this.matchesImpl === 'function') {
      return this.matchesImpl(...args);
    }
    return false;
  }

  closest(...args) {
    if (typeof this.closestImpl === 'function') {
      return this.closestImpl(...args);
    }
    return null;
  }

  reset() {
    this.value = '';
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parentElement = null;
    return child;
  }

  remove() {
    if (this.parentElement && typeof this.parentElement.removeChild === 'function') {
      this.parentElement.removeChild(this);
    }
  }
}

function createStorage(initialEntries = {}) {
  const storage = new Map(Object.entries(initialEntries));

  return {
    get length() {
      return storage.size;
    },
    key(index) {
      return Array.from(storage.keys())[index] ?? null;
    },
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
    clear() {
      storage.clear();
    }
  };
}

function buildLocation(overrides = {}) {
  const href = overrides.href || 'http://localhost:8000/';
  const parsed = new URL(href);

  return {
    hostname: overrides.hostname || parsed.hostname,
    origin: overrides.origin || parsed.origin,
    href: parsed.href,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash
  };
}

function createAppHarness(customElements = {}, options = {}, includeAuth = false) {
  const elements = new Map(
    Object.entries(customElements).map(([id, element]) => [id, element])
  );

  const documentElement = new ElementStub();
  const document = {
    addEventListener() {},
    removeEventListener() {},
    querySelector: options.documentQuerySelector || (() => null),
    querySelectorAll: options.documentQuerySelectorAll || (() => []),
    documentElement,
    body: new ElementStub(),
    createElement() {
      return new ElementStub();
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new ElementStub());
      }
      return elements.get(id);
    }
  };

  const localStorage = createStorage(options.storage || {});
  let nowValue = 0;

  class MockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [nowValue]));
    }

    static now() {
      return nowValue;
    }
  }

  const location = buildLocation(options.location);
  const historyCalls = [];
  const windowEventListeners = new Map();
  let historyState = null;

  const windowObject = {
    location,
    history: {
      get state() {
        return historyState;
      },
      pushState(state, _title, nextUrl) {
        historyState = state;
        historyCalls.push({ type: 'push', state, nextUrl });
        if (!nextUrl) return;
        Object.assign(location, buildLocation({
          href: new URL(nextUrl, location.origin).toString()
        }));
      },
      replaceState(_state, _title, nextUrl) {
        historyState = _state;
        historyCalls.push({ type: 'replace', state: _state, nextUrl });
        if (!nextUrl) return;
        Object.assign(location, buildLocation({
          href: new URL(nextUrl, location.origin).toString()
        }));
      }
    },
    turnstile: options.turnstile,
    innerWidth: options.innerWidth ?? 1024,
    setInterval() {
      return 1;
    },
    clearInterval() {},
    setTimeout(callback) {
      if (typeof options.onSetTimeout === 'function') {
        return options.onSetTimeout(callback);
      }
      return 1;
    },
    clearTimeout() {},
    scrollTo() {},
    addEventListener(type, handler) {
      windowEventListeners.set(type, handler);
    },
    removeEventListener(type) {
      windowEventListeners.delete(type);
    },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    }
  };

  class MockURL extends URL {}
  MockURL.createObjectURL = () => 'blob:test';
  MockURL.revokeObjectURL = () => {};

  const context = vm.createContext({
    console,
    window: windowObject,
    document,
    navigator: {
      onLine: options.navigator?.onLine ?? true,
      userAgent: options.navigator?.userAgent || 'node',
      language: options.navigator?.language || 'en-US'
    },
    localStorage,
    fetch: options.fetchImpl || (async () => ({
      ok: true,
      json: async () => ({}),
      text: async () => '{}'
    })),
    confirm: () => true,
    URL: MockURL,
    speechSynthesis: {
      cancel() {},
      speak() {},
      getVoices() {
        return [];
      }
    },
    SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {},
    Date: MockDate,
    setTimeout: (...args) => windowObject.setTimeout(...args),
    clearTimeout: (...args) => windowObject.clearTimeout(...args),
    setInterval: (...args) => windowObject.setInterval(...args),
    clearInterval: (...args) => windowObject.clearInterval(...args),
    requestAnimationFrame: (...args) => windowObject.requestAnimationFrame(...args)
  });

  const appSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'js', 'app.js'),
    'utf8'
  );
  const authSource = includeAuth
    ? fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'auth.js'), 'utf8')
    : '';
  vm.runInContext(`${appSource}\n${authSource}\nthis.__TEST_EXPORTS__ = MCQApp;`, context);

  return {
    app: context.__TEST_EXPORTS__,
    elements,
    localStorage,
    windowObject,
    historyCalls,
    windowEventListeners,
    context,
    setNow(value) {
      nowValue = value;
    },
    dispatchWindowEvent(type, event = {}) {
      const handler = windowEventListeners.get(type);
      if (typeof handler === 'function') {
        handler(event);
      }
    }
  };
}

function loadMCQApp(customElements = {}, options = {}) {
  return createAppHarness(customElements, options, false);
}

function loadMCQAppWithAuth(customElements = {}, options = {}) {
  return createAppHarness(customElements, options, true);
}

function createOptionElement(index) {
  const element = new ElementStub();
  element.setAttribute('data-index', index);
  return element;
}

function setupQuizState(app, question) {
  app.state.currentTopic = { id: 'topic-1', name: 'Timer Topic' };
  app.state.currentPracticeTest = { id: 'test-1' };
  app.state.questions = [question];
  app.state.currentQuestionIndex = 0;
  app.state.filterMode = 'all';
  app.state.bookmarkedQuestions = new Set();
  app.state.viewedQuestions = new Set();
  app.state.answersRevealed = new Set();
  app.state.wrongQuestions = [];
  app.state.firstAttemptCorrect = {};
  app.state.attemptedOptions = {};
  app.state.lastRenderedQuestionKey = null;
  app.state.lastRenderedQuestionIndex = -1;
  app.state.lastSelectedIndex = undefined;
  app.state.lastSelectedQuestionKey = null;
  app.state.isReviewMode = false;
}

module.exports = {
  ElementStub,
  createOptionElement,
  loadMCQApp,
  loadMCQAppWithAuth,
  setupQuizState
};
