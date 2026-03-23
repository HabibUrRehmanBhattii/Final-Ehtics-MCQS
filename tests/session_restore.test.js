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
  assert.deepEqual(Array.from(app.state.viewedQuestions), ['1']);
  assert.deepEqual(Array.from(app.state.bookmarkedQuestions), ['2']);
  assert.deepEqual(Array.from(app.state.answersRevealed), ['1']);
  assert.deepEqual(JSON.parse(JSON.stringify(app.state.questionElapsedMs)), { '1': 4200 });
  assert.deepEqual(JSON.parse(JSON.stringify(app.state.attemptedOptions)), { '1': [0, 2] });
  assert.deepEqual(JSON.parse(JSON.stringify(app.state.firstAttemptCorrect)), { '1': false });
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
