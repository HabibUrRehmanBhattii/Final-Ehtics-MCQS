const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadLifeCertificationExam() {
  const filePath = path.join(
    __dirname,
    '..',
    'data',
    'llqp-life',
    'llqp-life-certification-exam.json'
  );
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('life certification exam includes the curated 35-question ID set', () => {
  const exam = loadLifeCertificationExam();
  const expectedIds = [
    196849, 196396, 196397, 196850, 197443, 196695, 196869,
    196538, 240097, 196844, 196652, 196890, 196605, 196570,
    196933, 196983, 196617, 196545, 196979, 196562, 196399,
    196889, 197484, 196650, 196935, 196971, 196395, 196422,
    196565, 196439, 196429, 196899, 196942, 196954, 196600
  ];

  assert.equal(exam.topicId, 'llqp-life');
  assert.equal(exam.questions.length, 35);
  assert.deepEqual(
    exam.questions.map((question) => question.id),
    expectedIds
  );

  const seen = new Set();
  for (const question of exam.questions) {
    assert.equal(typeof question.question, 'string');
    assert.ok(question.question.trim().length > 0);
    assert.equal(Array.isArray(question.options), true);
    assert.equal(question.options.length, 4);
    assert.equal(Number.isInteger(question.correctAnswer), true);
    assert.ok(question.correctAnswer >= 0 && question.correctAnswer < question.options.length);
    assert.equal(typeof question.explanation, 'string');
    assert.ok(question.explanation.trim().length > 0);
    assert.equal(typeof question.kidExplanation, 'string');
    assert.ok(question.kidExplanation.trim().length > 0);
    assert.equal(seen.has(question.id), false);
    seen.add(question.id);
  }
});

test('life certification exam answer keys map to expected option text', () => {
  const exam = loadLifeCertificationExam();
  const byId = new Map(exam.questions.map((question) => [question.id, question]));

  const expectedCorrectAnswers = new Map([
    [196849, '$0'],
    [196396, 'Loss of a caregiver'],
    [196397, 'With the exception of the first few years of life, the probability of death starts low, increases slowly until age 40, then increases more dramatically.'],
    [196850, '$0'],
    [197443, 'A UL policyholder can adjust deposits, but cannot go below a minimum amount needed to keep the policy in force.'],
    [196695, 'After satisfying the probation period on or about September 1st.'],
    [196869, 'There would be no tax consequences today; however, the death benefit will be subject to taxation.'],
    [196538, '$500,000 less any balance owing under an APL'],
    [240097, '0.51 (semi-annually)'],
    [196844, 'A $25,000 policy gain upon disposal of an exempt life insurance policy'],
    [196652, 'Grow UL cash value to a level that can cover mortality and expense deductions indefinitely.'],
    [196890, '$75,000'],
    [196605, 'A maximum-funded UL policy'],
    [196570, 'a) Participating whole life insurance with a waiver of premium'],
    [196933, 'All of the above'],
    [196983, 'Option #1, as it would cost $240 more.'],
    [196617, '$410,000'],
    [196545, 'Universal life insurance'],
    [196979, '$400,000'],
    [196562, 'PUAA'],
    [196399, 'All of the above'],
    [196889, 'A non-refundable tax credit would be of no use to him.'],
    [197484, 'To pay off their mortgage upon death.'],
    [196650, 'Obtain a policy loan from the insurer.'],
    [196935, 'The claim can be denied on the basis of material misrepresentation.'],
    [196971, '$1,250,000'],
    [196395, 'Probability of death'],
    [196422, 'A 20-year term insurance policy on a joint last-to-die basis.'],
    [196565, 'd) Showing more than one possible outcome helps the client understand dividend illustrations are not guaranteed.'],
    [196439, 'b) The policy can renew repeatedly, but premium increases at each renewal and may become very expensive later in life.'],
    [196429, 'Increasing term insurance'],
    [196899, '$0, due to the LCGE'],
    [196942, 'All of the above'],
    [196954, 'The full $2,000,000 is taxed as regular income, creating about $800,000 tax.'],
    [196600, 'Investment account, mortality costs, and expenses']
  ]);

  for (const [questionId, expectedAnswerText] of expectedCorrectAnswers.entries()) {
    const question = byId.get(questionId);
    assert.ok(question, `Question ${questionId} should exist`);
    assert.equal(question.options[question.correctAnswer], expectedAnswerText);
  }
});
