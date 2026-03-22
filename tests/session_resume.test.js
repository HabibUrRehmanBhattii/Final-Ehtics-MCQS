const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadMCQApp
} = require('./helpers/mcq_app_test_utils');

function createLifeTopic() {
  return {
    id: 'llqp-life',
    name: 'LLQP Life Insurance',
    icon: 'L',
    color: '#123456',
    practiceTests: [
      {
        id: 'life-01',
        name: 'LIFE 01',
        subTests: [
          {
            id: 'life-01-part-1',
            name: 'Section 1',
            description: 'First section',
            questionCount: 2,
            dataFile: 'section-1.json'
          },
          {
            id: 'life-01-part-2',
            name: 'Section 2',
            description: 'Second section',
            questionCount: 2,
            dataFile: 'section-2.json'
          },
          {
            id: 'life-01-part-3',
            name: 'Section 3',
            description: 'Third section',
            questionCount: 2,
            dataFile: 'section-3.json'
          }
        ]
      }
    ]
  };
}

function markTestComplete(localStorage, topicId, testId, count) {
  localStorage.setItem(`progress_${topicId}_${testId}`, JSON.stringify({
    revealed: Array.from({ length: count }, (_, index) => `q-${index + 1}`)
  }));
}

test('getContinueSession promotes a completed section to the next incomplete section', () => {
  const { app, localStorage } = loadMCQApp();
  const topic = createLifeTopic();

  app.state.topics = [topic];
  localStorage.setItem('last_session', JSON.stringify({
    topicId: topic.id,
    testId: 'life-01-part-1'
  }));
  markTestComplete(localStorage, topic.id, 'life-01-part-1', 2);

  const session = app.getContinueSession();

  assert.equal(session.topic.id, topic.id);
  assert.equal(session.test.id, 'life-01-part-2');
  assert.equal(session.parentTest.id, 'life-01');
});

test('renderHomeFocus shows the promoted next section instead of the completed one', () => {
  const { app, localStorage, elements } = loadMCQApp();
  const topic = createLifeTopic();

  app.state.topics = [topic];
  app.state.wrongQuestions = [];
  app.escapeHtml = (value) => String(value);
  app.getDailyStudyStats = () => ({ todayAnswered: 8, streak: 3 });
  app.getHomeStudyStats = () => ({ totalCourses: 3, overallProgress: 67 });
  app.getRecommendedPracticeUnit = () => null;

  localStorage.setItem('last_session', JSON.stringify({
    topicId: topic.id,
    testId: 'life-01-part-1'
  }));
  markTestComplete(localStorage, topic.id, 'life-01-part-1', 2);

  app.renderHomeFocus();

  const html = elements.get('home-focus').innerHTML;
  assert.match(html, /LLQP Life Insurance: Section 2/);
  assert.match(html, /Next section ready/);
});

test('resumeLastSession opens the promoted next section and updates last_session', async () => {
  const { app, localStorage } = loadMCQApp();
  const topic = createLifeTopic();

  app.state.topics = [topic];
  localStorage.setItem('last_session', JSON.stringify({
    topicId: topic.id,
    testId: 'life-01-part-1'
  }));
  markTestComplete(localStorage, topic.id, 'life-01-part-1', 2);

  let openedSection = null;
  let toastMessage = null;

  app.selectSubPracticeTest = async (parentTestId, subTestId) => {
    openedSection = { parentTestId, subTestId };
  };
  app.selectPracticeTest = async (testId) => {
    openedSection = { parentTestId: null, subTestId: testId };
  };
  app.showToast = (message) => {
    toastMessage = message;
  };

  await app.resumeLastSession();

  const savedSession = JSON.parse(localStorage.getItem('last_session'));
  assert.deepEqual(openedSection, {
    parentTestId: 'life-01',
    subTestId: 'life-01-part-2'
  });
  assert.equal(savedSession.topicId, topic.id);
  assert.equal(savedSession.testId, 'life-01-part-2');
  assert.equal(toastMessage, null);
});
