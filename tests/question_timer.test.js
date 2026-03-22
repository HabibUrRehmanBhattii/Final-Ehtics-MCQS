const test = require('node:test');
const assert = require('node:assert/strict');
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
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      }
    },
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
    path.join(__dirname, '..', 'js', 'app.js'),
    'utf8'
  );
  vm.runInContext(`${source}\nthis.__TEST_EXPORTS__ = MCQApp;`, context);

  return {
    app: context.__TEST_EXPORTS__,
    elements,
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

test('pauseQuestionTimer freezes elapsed time and keeps the current value visible', () => {
  const { app, elements, windowObject, setNow } = loadMCQApp({
    'question-timer': new ElementStub()
  });

  let clearedInterval = null;
  windowObject.clearInterval = (value) => {
    clearedInterval = value;
  };

  app.state.activeQuestionTimerKey = 'q-1';
  app.state.activeQuestionTimerStartedAt = 1000;
  app.state.questionTimerInterval = 77;
  setNow(2500);

  app.pauseQuestionTimer('q-1');

  assert.equal(app.state.questionElapsedMs['q-1'], 1500);
  assert.equal(app.state.activeQuestionTimerKey, null);
  assert.equal(app.state.activeQuestionTimerStartedAt, null);
  assert.equal(app.state.questionTimerInterval, null);
  assert.equal(clearedInterval, 77);
  assert.equal(elements.get('question-timer').textContent, '00:01');
});

test('renderQuestion pauses timing for a question that already has an attempted answer', () => {
  const { app } = loadMCQApp();
  const question = {
    id: 7,
    question: 'What should happen to the timer?',
    options: ['Stop', 'Run'],
    correctAnswer: 0
  };

  setupQuizState(app, question);
  app.state.attemptedOptions['7'] = [1];

  let started = 0;
  const pausedKeys = [];

  app.startQuestionTimer = () => {
    started += 1;
  };
  app.pauseQuestionTimer = (questionKey) => {
    pausedKeys.push(questionKey);
  };
  app.clearAutoAdvanceTimer = () => {};
  app.stopSpeech = () => {};
  app.renderSafeTextWithTables = (text) => text;
  app.resetAIExplanationUi = () => {};
  app.escapeHtml = (text) => text;
  app.getWrongAnswerFeedback = () => 'Incorrect';
  app.saveProgress = () => {};
  app.updateNavigationButtons = () => {};
  app.renderQuestionDots = () => {};
  app.setupQuizKeyboardListeners = () => {};
  app.checkCompletion = () => {};

  app.renderQuestion();

  assert.equal(started, 0);
  assert.deepEqual(pausedKeys, ['7']);
  assert.equal(app.state.viewedQuestions.has('7'), true);
});

test('selectOption pauses the timer after a wrong first attempt before rerendering', () => {
  const { app } = loadMCQApp();
  const question = {
    id: 11,
    question: 'Pick the correct option',
    options: ['Wrong', 'Right'],
    correctAnswer: 1
  };

  setupQuizState(app, question);

  const pausedKeys = [];
  let rerenderCount = 0;
  let wrongLogCount = 0;
  const recordedPractice = [];

  app.pauseQuestionTimer = (questionKey) => {
    pausedKeys.push(questionKey);
  };
  app.renderQuestion = () => {
    rerenderCount += 1;
  };
  app.logWrongAnswer = () => {
    wrongLogCount += 1;
  };
  app.recordDailyPractice = (isCorrect) => {
    recordedPractice.push(isCorrect);
  };

  app.selectOption(0);

  assert.deepEqual(pausedKeys, ['11']);
  assert.deepEqual(Array.from(app.state.attemptedOptions['11']), [0]);
  assert.equal(app.state.firstAttemptCorrect['11'], false);
  assert.equal(rerenderCount, 1);
  assert.equal(wrongLogCount, 1);
  assert.deepEqual(recordedPractice, [false]);
});

test('selectOption pauses the timer after a correct answer and reveals the explanation', () => {
  const optionElements = [createOptionElement(0), createOptionElement(1)];
  const optionsContainer = new ElementStub({
    querySelectorAll: () => optionElements
  });
  const { app, elements } = loadMCQApp({
    'options-container': optionsContainer,
    'answer-section': new ElementStub({ classes: ['hidden'] }),
    'correct-answer-text': new ElementStub(),
    'explanation-text': new ElementStub(),
    'next-question-btn': new ElementStub({ classes: ['hidden'] }),
    'next-question-btn-top': new ElementStub({ classes: ['hidden'] })
  });
  const question = {
    id: 15,
    question: 'Which option is right?',
    options: ['Wrong', 'Correct'],
    correctAnswer: 1
  };

  setupQuizState(app, question);

  const pausedKeys = [];
  const recordedPractice = [];

  app.pauseQuestionTimer = (questionKey) => {
    pausedKeys.push(questionKey);
  };
  app.recordDailyPractice = (isCorrect) => {
    recordedPractice.push(isCorrect);
  };
  app.buildStepByStepExplanation = () => 'Because it matches the rule.';
  app.formatExplanation = (text) => `formatted:${text}`;
  app.resetAIExplanationUi = () => {};
  app.saveProgress = () => {};
  app.updateNavigationButtons = () => {};
  app.renderQuestionDots = () => {};
  app.checkCompletion = () => {};
  app.autoAdvanceNext = () => {};

  app.selectOption(1);

  assert.deepEqual(pausedKeys, ['15']);
  assert.deepEqual(recordedPractice, [true]);
  assert.equal(app.state.answersRevealed.has('15'), true);
  assert.equal(app.state.firstAttemptCorrect['15'], true);
  assert.equal(elements.get('correct-answer-text').textContent, 'Correct');
  assert.equal(elements.get('explanation-text').innerHTML, 'formatted:Because it matches the rule.');
  assert.equal(elements.get('answer-section').classList.contains('hidden'), false);
  assert.equal(optionElements[1].classList.contains('is-correct'), true);
  assert.equal(optionElements[0].classList.contains('is-dimmed'), true);
  assert.equal(optionElements[0].style.pointerEvents, 'none');
  assert.equal(optionElements[1].style.pointerEvents, 'none');
});
