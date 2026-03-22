const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadMCQApp
} = require('./helpers/mcq_app_test_utils');

function createTopicFixtures() {
  return [
    {
      id: 'llqp-life',
      practiceTests: [
        {
          id: 'chapter-1',
          name: 'Chapter 1',
          questionCount: 0,
          subTests: [
            {
              id: 'life-part-1',
              name: 'Life Section 1',
              questionCount: 4,
              status: 'active'
            },
            {
              id: 'life-part-2',
              name: 'Life Section 2',
              questionCount: 4,
              status: 'active'
            }
          ]
        },
        {
          id: 'life-final',
          name: 'Final Review',
          questionCount: 5,
          status: 'active'
        },
        {
          id: 'life-manual',
          name: 'Manual',
          questionCount: 0,
          status: 'active'
        },
        {
          id: 'life-soon',
          name: 'Coming Soon',
          questionCount: 10,
          status: 'coming-soon'
        }
      ]
    },
    {
      id: 'llqp-ethics',
      practiceTests: [
        {
          id: 'ethics-1',
          name: 'Ethics Quiz',
          questionCount: 3,
          status: 'active'
        }
      ]
    }
  ];
}

test('getTopicPracticeUnits flattens subtests and findPracticeTestById resolves direct and nested tests', () => {
  const { app } = loadMCQApp();
  const [topic] = createTopicFixtures();

  const units = app.getTopicPracticeUnits(topic);

  assert.deepEqual(
    JSON.parse(JSON.stringify(units.map((item) => item.id))),
    ['life-part-1', 'life-part-2', 'life-final', 'life-manual', 'life-soon']
  );
  assert.equal(app.findPracticeTestById(topic, 'life-final').id, 'life-final');
  assert.equal(app.findPracticeTestById(topic, 'life-part-2').id, 'life-part-2');
  assert.equal(app.findPracticeTestById(topic, 'missing'), null);
});

test('getActivePracticeUnits filters out coming soon and zero-question entries', () => {
  const { app } = loadMCQApp();
  app.state.topics = createTopicFixtures();

  const units = app.getActivePracticeUnits();

  assert.deepEqual(
    JSON.parse(JSON.stringify(units.map(({ topic, test }) => `${topic.id}:${test.id}`))),
    ['llqp-life:life-part-1', 'llqp-life:life-part-2', 'llqp-life:life-final', 'llqp-ethics:ethics-1']
  );
});

test('getRecommendedPracticeUnit prefers the highest progress incomplete course', () => {
  const { app, localStorage } = loadMCQApp();
  const topics = createTopicFixtures();
  app.state.topics = topics;

  localStorage.setItem('progress_llqp-life_life-part-1', JSON.stringify({ revealed: ['1', '2', '3'] }));
  localStorage.setItem('progress_llqp-life_life-part-2', JSON.stringify({ revealed: ['1'] }));
  localStorage.setItem('progress_llqp-life_life-final', JSON.stringify({ revealed: ['1', '2', '3', '4', '5'] }));

  const recommended = app.getRecommendedPracticeUnit();

  assert.equal(recommended.topic.id, 'llqp-life');
  assert.equal(recommended.test.id, 'life-part-1');
  assert.equal(recommended.progress, 75);
});

test('question key helpers prefer explicit state keys and derive wrong entry keys from state', () => {
  const { app } = loadMCQApp();

  app.state.currentTopic = { id: 'llqp-life' };
  app.state.currentPracticeTest = { id: 'life-part-1' };

  assert.equal(app.getQuestionStateKey({ id: 9 }), '9');
  assert.equal(app.getQuestionStateKey({ id: 9, __stateKey: 'custom-key' }), 'custom-key');
  assert.equal(app.getWrongEntryKey({ id: 3, __wrongKey: 'preset' }), 'preset');
  assert.equal(app.getWrongEntryKey({ id: 3 }), 'llqp-life|life-part-1|3');
});

test('loadWrongQuestions deduplicates saved entries and backfills missing metadata', () => {
  const { app, localStorage } = loadMCQApp();

  localStorage.setItem('wrong_questions', JSON.stringify([
    { topicId: 'llqp-life', testId: 'life-part-1', questionId: 7, timestamp: '2026-03-22T10:00:00.000Z' },
    { topicId: 'llqp-life', testId: 'life-part-1', questionId: 7, timestamp: '2026-03-22T11:00:00.000Z' },
    { key: 'llqp-ethics|ethics-1|4', topicId: 'llqp-ethics', testId: 'ethics-1', questionId: 4 },
    null
  ]));

  app.loadWrongQuestions();

  assert.deepEqual(
    JSON.parse(JSON.stringify(app.state.wrongQuestions.map((item) => ({
      key: item.key,
      topicId: item.topicId,
      testId: item.testId,
      questionId: item.questionId
    })))),
    [
      {
        key: 'llqp-life|life-part-1|7',
        topicId: 'llqp-life',
        testId: 'life-part-1',
        questionId: 7
      },
      {
        key: 'llqp-ethics|ethics-1|4',
        topicId: 'llqp-ethics',
        testId: 'ethics-1',
        questionId: 4
      }
    ]
  );
});

test('readJSONFromStorage clears invalid JSON and returns the fallback value', () => {
  const { app, localStorage } = loadMCQApp();

  localStorage.setItem('bad-json', '{not valid');

  const originalWarn = console.warn;
  let value;
  try {
    console.warn = () => {};
    value = app.readJSONFromStorage('bad-json', { ok: false });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(value, { ok: false });
  assert.equal(localStorage.getItem('bad-json'), null);
});

test('getResumeQuestionIndex prefers untouched questions before previously viewed unanswered ones', () => {
  const { app } = loadMCQApp();
  const questions = [{ id: 1 }, { id: 2 }, { id: 3 }];

  app.state.viewedQuestions = new Set(['1']);
  app.state.answersRevealed = new Set(['1', '2']);
  assert.equal(app.getResumeQuestionIndex(questions), 2);

  app.state.viewedQuestions = new Set(['1', '2', '3']);
  app.state.answersRevealed = new Set(['1', '3']);
  assert.equal(app.getResumeQuestionIndex(questions), 1);
});

test('getPracticeTestProgress returns the answered percentage for nested practice units', () => {
  const { app, localStorage } = loadMCQApp();
  const [topic] = createTopicFixtures();
  app.state.topics = [topic];

  localStorage.setItem('progress_llqp-life_life-part-2', JSON.stringify({
    revealed: ['q1', 'q2']
  }));

  assert.equal(app.getPracticeTestProgress('llqp-life', 'life-part-2'), 50);
  assert.equal(app.getPracticeTestProgress('llqp-life', 'missing'), 0);
});
