const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadMCQApp
} = require('./helpers/mcq_app_test_utils');

test('convertMarkdownTablesToHTML turns valid markdown tables into styled HTML tables', () => {
  const { app } = loadMCQApp();
  const markdown = [
    '| Age | Probability of Death | Life Expectancy |',
    '| --- | --- | --- |',
    '| 35 | 0.0015 | 47.2 |'
  ].join('\n');

  const html = app.convertMarkdownTablesToHTML(markdown);

  assert.match(html, /<table class="life-table">/);
  assert.match(html, /<th data-type="numeric">Probability of Death<\/th>/);
  assert.match(html, /<td class="age-col">35<\/td>/);
  assert.match(html, /<td data-type="numeric">47\.2<\/td>/);
});

test('renderSafeTextWithTables escapes free text while preserving rendered tables', () => {
  const { app } = loadMCQApp();
  const text = [
    '<script>alert("x")</script>',
    '',
    '| Age | Probability of Death |',
    '| --- | --- |',
    '| 35 | 0.0015 |'
  ].join('\n');

  const html = app.renderSafeTextWithTables(text);

  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /<table class="life-table">/);
  assert.doesNotMatch(html, /&lt;table/);
});

test('getExplanationReasonCandidates extracts Step 3 teaching points from explanations', () => {
  const { app } = loadMCQApp();
  const question = {
    explanation: 'Step 1: Read the facts. Step 3: "Revocable beneficiary" is wrong because the policyowner can change it without consent; "Irrevocable beneficiary" is correct because consent is required before a change. Step 4: Choose the best answer.'
  };

  const candidates = app.getExplanationReasonCandidates(question);

  assert.deepEqual(JSON.parse(JSON.stringify(candidates)), [
    '"Revocable beneficiary" is wrong because the policyowner can change it without consent.',
    '"Irrevocable beneficiary" is correct because consent is required before a change.'
  ]);
});

test('getExplanationReasonForOption chooses the candidate that matches the selected option better than the correct one', () => {
  const { app } = loadMCQApp();
  const question = {
    options: ['Revocable beneficiary', 'Irrevocable beneficiary'],
    correctAnswer: 1,
    explanation: 'Step 3: "Revocable beneficiary" is wrong because the policyowner can change it without consent; "Irrevocable beneficiary" is correct because consent is required before a change.'
  };

  const reason = app.getExplanationReasonForOption(question, 0);

  assert.equal(
    reason,
    '"Revocable beneficiary" is wrong because the policyowner can change it without consent.'
  );
});

test('feedback sanitizers remove direct answer reveals and keep short teaching points', () => {
  const { app } = loadMCQApp();

  assert.equal(
    app.stripCorrectAnswerReveal('Incorrect. This choice is too broad. The correct answer is "Revocable beneficiary" because the policyowner can change it.'),
    'This choice is too broad.'
  );
  assert.equal(
    app.summarizeExplanationReason('"Revocable beneficiary" is wrong because the policyowner can change it without consent. The correct answer is "Irrevocable beneficiary" because consent is required.'),
    'It is wrong because the policyowner can change it without consent.'
  );
});
