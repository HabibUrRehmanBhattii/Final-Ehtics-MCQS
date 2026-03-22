const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadMCQApp
} = require('./helpers/mcq_app_test_utils');

test('stripOptionPrefix and getOptionDisplayText remove common answer labels', () => {
  const { app } = loadMCQApp();

  assert.equal(app.stripOptionPrefix('A) Cash surrender value'), 'Cash surrender value');
  assert.equal(app.stripOptionPrefix(' (b) Policy loan'), 'Policy loan');
  assert.equal(app.getOptionDisplayText('1. Paid-up additions'), 'Paid-up additions');
  assert.equal(app.stripOptionPrefix(null), '');
});

test('getNormalizedOptionFeedback reorders feedback and fills the correct answer from explanation', () => {
  const { app } = loadMCQApp();
  const question = {
    options: ['A', 'B', 'C', 'D'],
    optionFeedback: ['Third in order', '', 'First in order', null],
    correctAnswer: 1,
    explanation: 'Because option B is the correct answer.'
  };

  const feedback = app.getNormalizedOptionFeedback(question, [2, 1, 0, 3]);

  assert.deepEqual(JSON.parse(JSON.stringify(feedback)), [
    'First in order',
    'Because option B is the correct answer.',
    'Third in order',
    ''
  ]);
});

test('normalizeQuestionOptionLabels strips prefixes and normalizes option feedback', () => {
  const { app } = loadMCQApp();
  const question = {
    options: ['A) Term insurance', 'B) Whole life'],
    optionFeedback: [null, '  Correct because it lasts for life. '],
    correctAnswer: 1,
    explanation: 'Whole life is correct.'
  };

  const normalized = app.normalizeQuestionOptionLabels(question);

  assert.deepEqual(JSON.parse(JSON.stringify(normalized)), {
    options: ['Term insurance', 'Whole life'],
    optionFeedback: ['', 'Correct because it lasts for life.'],
    correctAnswer: 1,
    explanation: 'Whole life is correct.'
  });
});

test('hasPrefixedOptionLabels detects prefixed options and ignores clean data', () => {
  const { app } = loadMCQApp();

  assert.equal(app.hasPrefixedOptionLabels([
    { options: ['A) First', 'B) Second'] }
  ]), true);
  assert.equal(app.hasPrefixedOptionLabels([
    { options: ['First', 'Second'] }
  ]), false);
});

test('study text helpers normalize text, remove stopwords, and score keyword overlap', () => {
  const { app } = loadMCQApp();

  assert.equal(
    app.normalizeStudyText('<strong>Cash-value</strong> grows at 10%!'),
    'cash value grows at 10%'
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(app.getKeywordTokens('The policy has a cash value and policy loan.'))),
    ['policy', 'cash', 'value', 'policy', 'loan']
  );
  assert.equal(
    app.getKeywordOverlapScore('cash value loan', 'loan cash surrender value'),
    1
  );
});

test('question text helpers clean feedback, build sentences, and detect exception prompts', () => {
  const { app } = loadMCQApp();
  const question = {
    question: '<p>A client is comparing riders.</p> Which rider is best for this case'
  };

  assert.equal(app.cleanFeedbackText('Incorrect.  Too broad for the facts.  '), 'Too broad for the facts.');
  assert.equal(app.toSentence('  policy loan  '), 'Policy loan.');
  assert.equal(app.getQuestionPlainText({ question: 'Line 1<br><strong>Line 2</strong>' }), 'Line 1 Line 2');
  assert.equal(app.getQuestionFocusText(question), 'Which rider is best for this case.');
  assert.equal(
    app.isExceptionQuestion({ question: 'Which of the following is not required on delivery' }),
    true
  );
});

test('inferQuestionRule recognizes beneficiary and underwriting question patterns', () => {
  const { app } = loadMCQApp();

  assert.match(
    app.inferQuestionRule({ question: 'Who receives proceeds when a contingent beneficiary is named?' }),
    /beneficiary-order rules/i
  );
  assert.match(
    app.inferQuestionRule({ question: 'What underwriting is required before a temporary insurance agreement takes effect?' }),
    /underwriting eligibility rules/i
  );
});

test('getQuestionContentSignature treats prefixed and cleaned options as the same content', () => {
  const { app } = loadMCQApp();

  const prefixed = app.getQuestionContentSignature([
    {
      id: 1,
      question: 'What is the best option?',
      options: ['A) Whole life', 'B) Term'],
      correctAnswer: 0,
      explanation: 'Whole life is correct.',
      optionFeedback: ['Correct', 'Too narrow']
    }
  ]);

  const clean = app.getQuestionContentSignature([
    {
      id: 1,
      question: 'What is the best option?',
      options: ['Whole life', 'Term'],
      correctAnswer: 0,
      explanation: 'Whole life is correct.',
      optionFeedback: ['Correct', 'Too narrow']
    }
  ]);

  assert.equal(prefixed, clean);
});

test('shuffle helpers read legacy and structured cache entries and persist the current schema version', () => {
  const { app, localStorage } = loadMCQApp();
  const questions = [{ id: 1 }, { id: 2 }];

  localStorage.setItem('shuffle_legacy', JSON.stringify(questions));
  assert.deepEqual(
    JSON.parse(JSON.stringify(app.getSavedShuffleData('shuffle_legacy'))),
    { questions, signature: null, version: null }
  );

  app.saveShuffleData('shuffle_current', questions, 'sig-123');
  assert.deepEqual(
    JSON.parse(localStorage.getItem('shuffle_current')),
    {
      version: app.shuffleSchemaVersion,
      signature: 'sig-123',
      questions
    }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(app.getSavedShuffleData('shuffle_current'))),
    {
      questions,
      signature: 'sig-123',
      version: app.shuffleSchemaVersion
    }
  );
});
