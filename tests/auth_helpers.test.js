const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ElementStub,
  loadMCQAppWithAuth
} = require('./helpers/mcq_app_test_utils');

test('getManagedProgressKeys and collectProgressSnapshot keep only sync-managed local storage keys', () => {
  const { app, localStorage } = loadMCQAppWithAuth();

  localStorage.setItem('progress_llqp-life_life-01', '{"revealed":["1"]}');
  localStorage.setItem('shuffle_llqp-life_life-01', '{"questions":[1,2]}');
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('custom_note', 'leave me out');

  const managedKeys = Array.from(app.getManagedProgressKeys()).sort();
  const snapshot = app.collectProgressSnapshot();

  assert.deepEqual(managedKeys, [
    'progress_llqp-life_life-01',
    'shuffle_llqp-life_life-01',
    'theme'
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    version: 1,
    items: {
      'progress_llqp-life_life-01': '{"revealed":["1"]}',
      'shuffle_llqp-life_life-01': '{"questions":[1,2]}',
      theme: 'dark'
    }
  });
});

test('applyProgressSnapshot replaces managed keys, preserves unrelated keys, and refreshes dependent UI state', () => {
  const { app, localStorage } = loadMCQAppWithAuth();
  const calls = {
    initDarkMode: 0,
    loadWrongQuestions: 0,
    loadProgress: 0,
    renderTopicsGrid: 0,
    renderQuestion: 0
  };

  localStorage.setItem('progress_old_topic_test', '{"revealed":["old"]}');
  localStorage.setItem('shuffle_old_topic_test', '{"questions":[1]}');
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('custom_flag', 'keep');

  app.initDarkMode = () => {
    calls.initDarkMode += 1;
  };
  app.loadWrongQuestions = () => {
    calls.loadWrongQuestions += 1;
  };
  app.loadProgress = () => {
    calls.loadProgress += 1;
  };
  app.renderTopicsGrid = () => {
    calls.renderTopicsGrid += 1;
  };
  app.renderQuestion = () => {
    calls.renderQuestion += 1;
  };

  app.state.currentTopic = { id: 'llqp-life' };
  app.state.currentPracticeTest = { id: 'life-01' };
  app.state.currentView = 'mcq';
  app.state.questions = [{ id: 1 }];

  app.applyProgressSnapshot({
    version: 1,
    items: {
      'progress_llqp-life_life-01': '{"revealed":["new"]}',
      wrong_questions: '[]',
      'auto-advance': 'true',
      'home-insights-expanded': 'false'
    }
  });

  assert.equal(localStorage.getItem('progress_old_topic_test'), null);
  assert.equal(localStorage.getItem('shuffle_old_topic_test'), null);
  assert.equal(localStorage.getItem('theme'), null);
  assert.equal(localStorage.getItem('progress_llqp-life_life-01'), '{"revealed":["new"]}');
  assert.equal(localStorage.getItem('custom_flag'), 'keep');
  assert.equal(app.state.autoAdvanceEnabled, true);
  assert.equal(app.state.homeInsightsExpanded, false);
  assert.equal(app.state.auth.migrating, false);
  assert.deepEqual(calls, {
    initDarkMode: 1,
    loadWrongQuestions: 1,
    loadProgress: 1,
    renderTopicsGrid: 1,
    renderQuestion: 1
  });
});

test('renderAuthPanel escapes account email and shows the signed-in cloud sync controls', () => {
  const authPanel = new ElementStub();
  const { app } = loadMCQAppWithAuth({
    'auth-panel': authPanel
  });

  app.state.auth.available = true;
  app.state.auth.authenticated = true;
  app.state.auth.user = {
    email: 'student+<script>alert(1)</script>@example.com'
  };
  app.state.auth.lastSyncedAt = null;

  app.renderAuthPanel();

  assert.match(authPanel.innerHTML, /Cloud sync is on/);
  assert.match(authPanel.innerHTML, /Sign out/);
  assert.match(authPanel.innerHTML, /student\+&lt;script&gt;alert\(1\)&lt;\/script&gt;@example\.com/);
  assert.doesNotMatch(authPanel.innerHTML, /<script>alert\(1\)<\/script>/);
});

test('fetchAuthJson sends same-origin JSON requests and surfaces raw text errors', async () => {
  const fetchCalls = [];
  const { app } = loadMCQAppWithAuth({}, {
    location: { href: 'https://hllqpmcqs.com/' },
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      return new Response('Bad gateway from upstream', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  });

  await assert.rejects(
    app.fetchAuthJson('/api/auth/session', {
      method: 'POST',
      headers: { 'X-Test': '1' }
    }),
    /Bad gateway from upstream/
  );

  assert.equal(fetchCalls[0].url, 'https://hllqpmcqs.com/api/auth/session');
  assert.equal(fetchCalls[0].options.credentials, 'include');
  assert.equal(fetchCalls[0].options.cache, 'no-store');
  assert.equal(fetchCalls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(fetchCalls[0].options.headers['X-Test'], '1');
});
