const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ElementStub,
  loadMCQApp
} = require('./helpers/mcq_app_test_utils');

test('showToast escapes dynamic title and message content before rendering HTML', () => {
  const toastRoot = new ElementStub();
  const { app } = loadMCQApp({
    'toast-root': toastRoot
  });

  app.showToast('<img src=x onerror=alert(1)>', 'warning', '<strong>Injected</strong>');

  assert.equal(toastRoot.children.length, 1);
  assert.doesNotMatch(toastRoot.children[0].innerHTML, /<img|<strong>/i);
  assert.match(toastRoot.children[0].innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(toastRoot.children[0].innerHTML, /&lt;strong&gt;Injected&lt;\/strong&gt;/);
});

test('renderTopicsGrid escapes topic content and keeps inline actions safely quoted', () => {
  const grid = new ElementStub();
  const { app } = loadMCQApp({
    'topics-grid': grid
  });

  app.updateWrongQuestionsCount = () => {};
  app.renderHomeFocus = () => {};
  app.getHomeTopicRank = () => 0;
  app.isCompactHomeTopic = () => false;
  app.getTopicProgress = () => 25;
  app.state.topics = [
    {
      id: `bad');window.hacked=1;//`,
      name: '<img src=x onerror=alert(1)>',
      description: '<script>alert(2)</script>',
      icon: '<svg onload=alert(3)>',
      color: 'red; background:url(javascript:alert(4))',
      status: 'active',
      practiceTests: [{ questionCount: 3 }]
    }
  ];

  app.renderTopicsGrid();

  assert.doesNotMatch(grid.innerHTML, /<img|<script|<svg/i);
  assert.match(grid.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(grid.innerHTML, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.match(grid.innerHTML, /&lt;svg onload=alert\(3\)&gt;/);
  assert.match(
    grid.innerHTML,
    /onclick="MCQApp\.selectTopic\(&quot;bad&#039;\);window\.hacked=1;\/\/&quot;\)"/
  );
  assert.match(grid.innerHTML, /style="--topic-color: #2563eb"/);
});

test('renderPracticeTests escapes practice-test content in the main course list', () => {
  const practiceGrid = new ElementStub();
  const { app, elements } = loadMCQApp({
    'practice-topic-title': new ElementStub(),
    'practice-topic-icon': new ElementStub(),
    'practice-description': new ElementStub(),
    'practice-tests-grid': practiceGrid
  });

  app.shouldUseSectionedCatalog = () => false;
  app.getPracticeTestProgress = () => 50;
  app.state.currentTopic = {
    id: 'topic-1',
    name: 'Topic Name',
    icon: 'T',
    description: 'Topic description',
    color: 'blue;background:url(javascript:alert(1))',
    practiceTests: [
      {
        id: `test');window.hacked=1;//`,
        name: '<img src=x onerror=alert(9)>',
        description: '<script>alert(8)</script>',
        questionCount: 10,
        status: 'active',
        dataFile: 'data/test.json'
      }
    ]
  };

  app.renderPracticeTests();

  assert.equal(elements.get('practice-topic-title').textContent, 'Topic Name');
  assert.doesNotMatch(practiceGrid.innerHTML, /<img|<script/i);
  assert.match(practiceGrid.innerHTML, /&lt;img src=x onerror=alert\(9\)&gt;/);
  assert.match(practiceGrid.innerHTML, /&lt;script&gt;alert\(8\)&lt;\/script&gt;/);
  assert.match(
    practiceGrid.innerHTML,
    /onclick="MCQApp\.selectPracticeTest\(&quot;test&#039;\);window\.hacked=1;\/\/&quot;\)"/
  );
  assert.match(practiceGrid.innerHTML, /style="--topic-color: #2563eb"/);
});
