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
  constructor({ classes = [], querySelectorAll } = {}) {
    this.textContent = '';
    this.innerHTML = '';
    this.style = {};
    this.attributes = {};
    this.classList = new ClassList(classes);
    this.querySelectorAll = querySelectorAll || (() => []);
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

  matches() {
    return false;
  }

  closest() {
    return null;
  }
}

function loadMCQApp(customElements = {}) {
  const elements = new Map(
    Object.entries(customElements).map(([id, element]) => [id, element])
  );

  const document = {
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new ElementStub());
      }
      return elements.get(id);
    }
  };

  const storage = new Map();
  let nowValue = 0;

  class MockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [nowValue]));
    }

    static now() {
      return nowValue;
    }
  }

  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };

  const windowObject = {
    location: {
      hostname: 'localhost',
      origin: 'http://localhost:8000'
    },
    setInterval() {
      return 1;
    },
    clearInterval() {},
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {}
  };

  const context = vm.createContext({
    console,
    window: windowObject,
    document,
    navigator: { onLine: true, userAgent: 'node' },
    localStorage,
    fetch: async () => ({
      ok: true,
      json: async () => ({})
    }),
    confirm: () => true,
    URL: {
      createObjectURL() {
        return 'blob:test';
      },
      revokeObjectURL() {}
    },
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
    clearInterval: (...args) => windowObject.clearInterval(...args)
  });

  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'js', 'app.js'),
    'utf8'
  );
  vm.runInContext(`${source}\nthis.__TEST_EXPORTS__ = MCQApp;`, context);

  return {
    app: context.__TEST_EXPORTS__,
    elements,
    localStorage,
    windowObject,
    setNow(value) {
      nowValue = value;
    }
  };
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
  setupQuizState
};
