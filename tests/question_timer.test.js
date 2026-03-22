const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ElementStub,
  createOptionElement,
  loadMCQApp,
  setupQuizState
} = require('./helpers/mcq_app_test_utils');

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
