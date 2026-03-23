const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ElementStub,
  loadMCQApp
} = require('./helpers/mcq_app_test_utils');

function buildQuestions(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    question: `Question ${index + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0
  }));
}

test('setCurrentQuestionIndex blocks forward jumps until the current question is answered unless forced', () => {
  const { app } = loadMCQApp();

  app.state.questions = buildQuestions(4);
  app.state.currentQuestionIndex = 0;
  app.state.answersRevealed = new Set();

  let toastMessage = null;
  let renderCount = 0;
  app.showToast = (message) => {
    toastMessage = message;
  };
  app.renderQuestion = () => {
    renderCount += 1;
  };

  assert.equal(app.setCurrentQuestionIndex(2), false);
  assert.equal(app.state.currentQuestionIndex, 0);
  assert.equal(renderCount, 0);
  assert.equal(toastMessage, 'Answer this question before moving ahead.');

  assert.equal(app.setCurrentQuestionIndex(2, { force: true }), true);
  assert.equal(app.state.currentQuestionIndex, 2);
  assert.equal(renderCount, 1);
});

test('updateNavigationButtons disables previous at the start and next until the current question is answered', () => {
  const prevBtn = new ElementStub();
  const nextBtn = new ElementStub();
  const { app } = loadMCQApp({
    'prev-question-btn': prevBtn,
    'next-question-btn': nextBtn
  });

  app.state.questions = buildQuestions(3);
  app.state.currentQuestionIndex = 0;
  app.state.answersRevealed = new Set();

  app.updateNavigationButtons();
  assert.equal(prevBtn.disabled, true);
  assert.equal(nextBtn.disabled, true);

  app.state.answersRevealed.add('1');
  app.updateNavigationButtons();
  assert.equal(prevBtn.disabled, true);
  assert.equal(nextBtn.disabled, false);

  app.state.currentQuestionIndex = 2;
  app.state.answersRevealed.add('3');
  app.updateNavigationButtons();
  assert.equal(nextBtn.disabled, true);
});

test('renderQuestionDots uses a 5-dot mobile window and shows a next-window control when more questions exist', () => {
  const dotsContainer = new ElementStub();
  const { app } = loadMCQApp({
    'question-dots': dotsContainer
  }, {
    innerWidth: 390
  });

  app.state.questions = buildQuestions(8);
  app.state.currentQuestionIndex = 3;
  app.state.answersRevealed = new Set(['4']);
  app.state.viewedQuestions = new Set(['1', '2', '3', '4']);
  app.state.bookmarkedQuestions = new Set(['2']);
  app.state.firstAttemptCorrect = { '1': true, '4': true };
  app.scrollActiveQuestionDotIntoView = () => {};

  app.renderQuestionDots();

  const html = dotsContainer.innerHTML;
  assert.equal((html.match(/class="question-dot/g) || []).length, 5);
  assert.match(html, /dot-nav-next/);
  assert.doesNotMatch(html, /Question 6 -/);
  assert.match(html, /Question 5/);
  assert.match(html, /is-active/);
});

test('renderQuestionDots locks future mobile dots and disables the next-window control until the current question is answered', () => {
  const dotsContainer = new ElementStub();
  const { app } = loadMCQApp({
    'question-dots': dotsContainer
  }, {
    innerWidth: 390
  });

  app.state.questions = buildQuestions(8);
  app.state.currentQuestionIndex = 1;
  app.state.answersRevealed = new Set();
  app.state.viewedQuestions = new Set(['1', '2']);
  app.state.bookmarkedQuestions = new Set();
  app.state.firstAttemptCorrect = {};
  app.scrollActiveQuestionDotIntoView = () => {};

  app.renderQuestionDots();

  const html = dotsContainer.innerHTML;
  assert.match(html, /Question 3 - Answer the current question first/);
  assert.match(html, /question-dot [^"]*is-locked/);
  assert.match(html, /dot-nav-next[^>]*disabled/);
});
