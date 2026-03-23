const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ElementStub,
  createOptionElement,
  loadMCQApp,
  setupQuizState
} = require('./helpers/mcq_app_test_utils');

function createViewElement() {
  return new ElementStub({ classes: ['view'] });
}

function createPracticeTestFixture(questionCount = 7) {
  return {
    id: 'llqp-life',
    name: 'Life',
    practiceTests: [
      {
        id: 'life-01',
        name: 'LIFE 01',
        questionCount,
        dataFile: 'life-01.json',
        status: 'active'
      }
    ]
  };
}

function createQuestionPayload(count = 7) {
  return {
    questions: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      question: `Question ${index + 1}`,
      options: [`A${index + 1}`, `B${index + 1}`],
      correctAnswer: 0
    }))
  };
}

test('showView rerenders practice tests when returning from an MCQ session', () => {
  const homeView = createViewElement();
  const practiceView = createViewElement();
  const mcqView = createViewElement();
  mcqView.classList.add('active');

  const { app } = loadMCQApp({
    'home-view': homeView,
    'practice-test-view': practiceView,
    'mcq-view': mcqView
  }, {
    documentQuerySelectorAll: (selector) => selector === '.view'
      ? [homeView, practiceView, mcqView]
      : []
  });

  let renderPracticeTestsCalls = 0;
  app.state.currentTopic = { id: 'llqp-life', name: 'Life' };
  app.renderPracticeTests = () => {
    renderPracticeTestsCalls += 1;
  };
  app.clearAutoAdvanceTimer = () => {};
  app.stopQuestionTimer = () => {};
  app.saveProgress = () => {};
  app.resetAdvanceTapState = () => {};
  app.stopSpeech = () => {};
  app.cleanupQuizKeyboardListeners = () => {};

  app.showView('practice-test');

  assert.equal(app.state.currentView, 'practice-test');
  assert.equal(renderPracticeTestsCalls, 1);
  assert.equal(practiceView.classList.contains('active'), true);
  assert.equal(mcqView.classList.contains('active'), false);
});

test('saveProgress and loadProgress preserve attempt history and first-try correctness for resumed quizzes', () => {
  const { app, localStorage } = loadMCQApp();

  app.state.currentTopic = { id: 'llqp-life' };
  app.state.currentPracticeTest = { id: 'life-01' };
  app.state.questions = [{ id: 1 }, { id: 2 }];
  app.state.currentQuestionIndex = 1;
  app.state.viewedQuestions = new Set(['1']);
  app.state.bookmarkedQuestions = new Set(['2']);
  app.state.answersRevealed = new Set(['1']);
  app.state.questionElapsedMs = { '1': 4200 };
  app.state.attemptedOptions = { '1': [0, 2] };
  app.state.firstAttemptCorrect = { '1': false };
  app.getQuestionTimersSnapshot = () => ({ '1': 4200 });

  app.saveProgress();

  app.state.viewedQuestions = new Set();
  app.state.bookmarkedQuestions = new Set();
  app.state.answersRevealed = new Set();
  app.state.questionElapsedMs = {};
  app.state.attemptedOptions = {};
  app.state.firstAttemptCorrect = {};

  app.loadProgress();

  const saved = JSON.parse(localStorage.getItem('progress_llqp-life_life-01'));
  assert.deepEqual(saved.attemptedOptions, { '1': [0, 2] });
  assert.deepEqual(saved.firstAttemptCorrect, { '1': false });
  assert.deepEqual(saved.questionLayout.questionOrder, ['1', '2']);
  assert.deepEqual(Array.from(app.state.viewedQuestions), ['1']);
  assert.deepEqual(Array.from(app.state.bookmarkedQuestions), ['2']);
  assert.deepEqual(Array.from(app.state.answersRevealed), ['1']);
  assert.deepEqual(JSON.parse(JSON.stringify(app.state.questionElapsedMs)), { '1': 4200 });
  assert.deepEqual(JSON.parse(JSON.stringify(app.state.attemptedOptions)), { '1': [0, 2] });
  assert.deepEqual(JSON.parse(JSON.stringify(app.state.firstAttemptCorrect)), { '1': false });
  assert.equal(app.state.currentQuestionIndex, 1);
});

test('renderQuestion restores answered-option styling after resuming a completed question', () => {
  const optionElements = [createOptionElement(0), createOptionElement(1), createOptionElement(2)];
  optionElements[0].classList.add('was-attempted');

  const optionsContainer = new ElementStub({
    querySelectorAll: () => optionElements
  });
  const { app, elements } = loadMCQApp({
    'topic-title': new ElementStub(),
    'current-question-num': new ElementStub(),
    'total-questions': new ElementStub(),
    'progress-fill': new ElementStub(),
    'q-num': new ElementStub(),
    'question-text': new ElementStub(),
    'options-container': optionsContainer,
    'bookmark-btn': new ElementStub(),
    'answer-section': new ElementStub({ classes: ['hidden'] }),
    'correct-answer-text': new ElementStub(),
    'explanation-text': new ElementStub(),
    'next-question-btn': new ElementStub({ classes: ['hidden'] }),
    'next-question-btn-top': new ElementStub({ classes: ['hidden'] }),
    'auto-advance-toggle': new ElementStub(),
    'question-dots': new ElementStub()
  });
  const question = {
    id: 7,
    question: 'Which option is correct?',
    options: ['Wrong 1', 'Correct', 'Wrong 2'],
    correctAnswer: 1
  };

  setupQuizState(app, question);
  app.state.answersRevealed.add('7');
  app.state.attemptedOptions = { '7': [0] };
  app.state.firstAttemptCorrect = { '7': false };
  app.clearAutoAdvanceTimer = () => {};
  app.stopSpeech = () => {};
  app.syncQuestionTimer = () => {};
  app.renderSafeTextWithTables = (text) => text;
  app.resetAIExplanationUi = () => {};
  app.saveProgress = () => {};
  app.updateNavigationButtons = () => {};
  app.renderQuestionDots = () => {};
  app.setupQuizKeyboardListeners = () => {};
  app.checkCompletion = () => {};
  app.formatExplanation = (text) => `formatted:${text}`;
  app.buildStepByStepExplanation = () => 'Step by step';

  app.renderQuestion();

  assert.equal(elements.get('answer-section').classList.contains('hidden'), false);
  assert.equal(optionElements[1].classList.contains('is-correct'), true);
  assert.equal(optionElements[2].classList.contains('is-dimmed'), true);
  assert.equal(optionElements[0].classList.contains('was-attempted'), true);
  assert.equal(optionElements[0].style.pointerEvents, 'none');
  assert.equal(optionElements[1].style.pointerEvents, 'none');
  assert.equal(optionElements[2].style.pointerEvents, 'none');
});

test('resumed correct answers keep a green navigation dot instead of falling back to wrong-red', () => {
  const dotsContainer = new ElementStub();
  const { app, localStorage } = loadMCQApp({
    'question-dots': dotsContainer
  }, {
    innerWidth: 390
  });

  app.state.currentTopic = { id: 'llqp-life' };
  app.state.currentPracticeTest = { id: 'life-01' };
  app.state.questions = [
    { id: 1, question: 'Q1', options: ['A', 'B'], correctAnswer: 0 },
    { id: 2, question: 'Q2', options: ['A', 'B'], correctAnswer: 0 }
  ];
  app.scrollActiveQuestionDotIntoView = () => {};

  localStorage.setItem('progress_llqp-life_life-01', JSON.stringify({
    viewed: ['1'],
    bookmarked: [],
    revealed: ['1'],
    timers: {},
    attemptedOptions: { '1': [0] },
    firstAttemptCorrect: { '1': true }
  }));

  app.loadProgress();
  app.renderQuestionDots();

  assert.match(dotsContainer.innerHTML, /is-correct-dot/);
  assert.doesNotMatch(dotsContainer.innerHTML, /is-wrong-dot/);
});

test('reopening a saved test keeps the same visible question order when the shuffle cache is missing', async () => {
  const quizData = createQuestionPayload(7);
  const firstHarness = loadMCQApp({}, {
    fetchImpl: async () => ({
      ok: true,
      json: async () => quizData
    })
  });
  const topic = createPracticeTestFixture(7);
  const firstApp = firstHarness.app;

  firstApp.state.topics = [topic];
  firstApp.state.currentTopic = topic;
  firstApp.beginLoading = () => {};
  firstApp.endLoading = () => {};
  firstApp.clearAutoAdvanceTimer = () => {};
  firstApp.stopQuestionTimer = () => {};
  firstApp.resetAdvanceTapState = () => {};
  firstApp.stopSpeech = () => {};
  firstApp.cleanupQuizKeyboardListeners = () => {};
  firstApp.showToast = () => {};
  firstApp.renderQuestion = () => {};
  firstApp.shuffleArray = (items) => {
    if (items.length === 7 && items[0] && typeof items[0] === 'object') {
      return [items[0], items[6], ...items.slice(1, 6)];
    }
    return items.slice();
  };

  await firstApp.selectPracticeTest('life-01');
  firstApp.state.currentQuestionIndex = 1;
  firstApp.saveProgress();

  const savedProgress = JSON.parse(firstHarness.localStorage.getItem('progress_llqp-life_life-01'));
  assert.equal(savedProgress.currentQuestionKey, '7');
  assert.deepEqual(savedProgress.questionLayout.questionOrder, ['1', '7', '2', '3', '4', '5', '6']);

  firstHarness.localStorage.removeItem('shuffle_llqp-life_life-01');

  const storage = {};
  for (let index = 0; index < firstHarness.localStorage.length; index += 1) {
    const key = firstHarness.localStorage.key(index);
    storage[key] = firstHarness.localStorage.getItem(key);
  }

  const secondHarness = loadMCQApp({}, {
    storage,
    fetchImpl: async () => ({
      ok: true,
      json: async () => quizData
    })
  });
  const secondApp = secondHarness.app;
  secondApp.state.topics = [topic];
  secondApp.state.currentTopic = topic;
  secondApp.beginLoading = () => {};
  secondApp.endLoading = () => {};
  secondApp.clearAutoAdvanceTimer = () => {};
  secondApp.stopQuestionTimer = () => {};
  secondApp.resetAdvanceTapState = () => {};
  secondApp.stopSpeech = () => {};
  secondApp.cleanupQuizKeyboardListeners = () => {};
  secondApp.showToast = () => {};
  secondApp.renderQuestion = () => {};
  secondApp.shuffleArray = (items) => items.slice();

  await secondApp.selectPracticeTest('life-01');

  assert.equal(secondApp.state.currentQuestionIndex, 1);
  assert.equal(secondApp.getCurrentQuestion().id, 7);
});

test('setupEventListeners reloads quiz data before restoring an mcq history entry', async () => {
  const homeView = createViewElement();
  const practiceView = createViewElement();
  const mcqView = createViewElement();
  const topic = createPracticeTestFixture(3);
  const quizData = createQuestionPayload(3);
  const { app, dispatchWindowEvent, historyCalls } = loadMCQApp({
    'home-view': homeView,
    'practice-test-view': practiceView,
    'mcq-view': mcqView
  }, {
    documentQuerySelectorAll: (selector) => selector === '.view'
      ? [homeView, practiceView, mcqView]
      : [],
    fetchImpl: async () => ({
      ok: true,
      json: async () => quizData
    })
  });

  app.state.topics = [topic];
  app.state.currentTopic = topic;
  app.beginLoading = () => {};
  app.endLoading = () => {};
  app.clearAutoAdvanceTimer = () => {};
  app.stopQuestionTimer = () => {};
  app.resetAdvanceTapState = () => {};
  app.stopSpeech = () => {};
  app.cleanupQuizKeyboardListeners = () => {};
  app.showToast = () => {};
  app.renderPracticeTests = () => {};
  app.renderQuestion = () => {};

  app.setupEventListeners();
  await app.selectPracticeTest('life-01');
  app.state.currentQuestionIndex = 1;
  app.saveProgress();
  app.syncNavigationState('replace');

  app.state.questions = [];
  app.state.loadedQuestionSetId = null;
  app.state.currentQuestionIndex = 0;

  let renderQuestionCalls = 0;
  app.renderQuestion = () => {
    renderQuestionCalls += 1;
  };

  const mcqState = historyCalls.filter((entry) => entry.state?.view === 'mcq').pop();
  await dispatchWindowEvent('popstate', { state: mcqState.state });

  assert.equal(app.state.currentView, 'mcq');
  assert.equal(app.state.questions.length, 3);
  assert.equal(app.state.currentQuestionIndex, 1);
  assert.equal(renderQuestionCalls, 1);
});

test('setupEventListeners restores the previous in-app view on browser back navigation', async () => {
  const homeView = createViewElement();
  const practiceView = createViewElement();
  const mcqView = createViewElement();
  const { app, dispatchWindowEvent, historyCalls } = loadMCQApp({
    'home-view': homeView,
    'practice-test-view': practiceView,
    'mcq-view': mcqView
  }, {
    documentQuerySelectorAll: (selector) => selector === '.view'
      ? [homeView, practiceView, mcqView]
      : []
  });

  app.state.topics = [
    {
      id: 'llqp-life',
      practiceTests: [
        { id: 'life-01', name: 'LIFE 01', questionCount: 2 }
      ]
    }
  ];
  app.state.currentTopic = app.state.topics[0];
  app.state.currentPracticeTest = app.state.topics[0].practiceTests[0];
  app.state.questions = [{ id: 1, options: ['A'], correctAnswer: 0 }];

  let renderPracticeTestsCalls = 0;
  let renderQuestionCalls = 0;
  app.renderPracticeTests = () => {
    renderPracticeTestsCalls += 1;
  };
  app.renderQuestion = () => {
    renderQuestionCalls += 1;
  };
  app.clearAutoAdvanceTimer = () => {};
  app.stopQuestionTimer = () => {};
  app.saveProgress = () => {};
  app.resetAdvanceTapState = () => {};
  app.stopSpeech = () => {};
  app.cleanupQuizKeyboardListeners = () => {};
  app.showToast = () => {};

  app.setupEventListeners();
  app.showView('practice-test');
  app.showView('mcq');

  const practiceState = historyCalls.find((entry) => entry.type === 'push' && entry.state?.view === 'practice-test');
  await dispatchWindowEvent('popstate', { state: practiceState.state });

  assert.equal(app.state.currentView, 'practice-test');
  assert.equal(renderPracticeTestsCalls >= 2, true);
  assert.equal(renderQuestionCalls, 0);
});
