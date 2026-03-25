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
    email: 'student+<script>alert(1)</script>@example.com',
    isAdmin: false
  };
  app.state.auth.lastSyncedAt = null;

  app.renderAuthPanel();

  assert.match(authPanel.innerHTML, /Cloud sync is on/);
  assert.match(authPanel.innerHTML, /Sign out/);
  assert.doesNotMatch(authPanel.innerHTML, /Admin Dashboard/);
  assert.match(authPanel.innerHTML, /student\+&lt;script&gt;alert\(1\)&lt;\/script&gt;@example\.com/);
  assert.doesNotMatch(authPanel.innerHTML, /<script>alert\(1\)<\/script>/);
});

test('renderAuthPanel shows Admin Dashboard action only when user.isAdmin is true', () => {
  const authPanel = new ElementStub();
  const { app } = loadMCQAppWithAuth({
    'auth-panel': authPanel
  });

  app.state.auth.available = true;
  app.state.auth.authenticated = true;
  app.state.auth.user = {
    email: 'student@example.com',
    isAdmin: false
  };
  app.renderAuthPanel();
  assert.doesNotMatch(authPanel.innerHTML, /Admin Dashboard/);

  app.state.auth.user = {
    email: 'habibcanad@gmail.com',
    isAdmin: true
  };
  app.renderAuthPanel();
  assert.match(authPanel.innerHTML, /Admin Dashboard/);
});

test('refreshAdminDashboard renders overview, student table, and deep detail from mocked API responses', async () => {
  const adminRoot = new ElementStub();
  const { app } = loadMCQAppWithAuth({
    'admin-dashboard-root': adminRoot
  }, {
    location: { href: 'https://hllqpmcqs.com/' },
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname === '/api/admin/students/overview') {
        return new Response(JSON.stringify({
          metrics: {
            studentsCount: 1,
            activeStudents: 1,
            totalAnswered: 12,
            avgCompletionPct: 66.7,
            avgFirstTryAccuracyPct: 72.5
          },
          students: [
            {
              id: 'student-1',
              email: 'alpha.student@example.com',
              totalTests: 2,
              answeredCount: 12,
              completionPct: 66.7,
              firstTryAccuracyPct: 72.5,
              totalStudyTimeMs: 300000
            }
          ],
          generatedAt: '2026-03-24T12:00:00.000Z'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (parsed.pathname === '/api/admin/students/student-1') {
        return new Response(JSON.stringify({
          student: {
            id: 'student-1',
            email: 'alpha.student@example.com'
          },
          summary: {
            answeredCount: 12,
            completionPct: 66.7,
            firstTryAccuracyPct: 72.5,
            totalStudyTimeMs: 300000
          },
          topics: [
            {
              topicId: 'llqp-life',
              answeredCount: 12,
              completionPct: 66.7,
              firstTryAccuracyPct: 72.5,
              tests: [
                {
                  topicId: 'llqp-life',
                  testId: 'life-01',
                  answeredCount: 6,
                  viewedCount: 8,
                  revealedCount: 6,
                  bookmarkedCount: 2,
                  firstTryAccuracyPct: 70,
                  studyTimeMs: 180000,
                  lastUpdatedAt: '2026-03-24T11:40:00.000Z'
                }
              ]
            }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  app.state.auth.authenticated = true;
  app.state.auth.user = {
    id: 'admin-1',
    email: 'habibcanad@gmail.com',
    isAdmin: true
  };

  await app.refreshAdminDashboard({ silent: true, preserveSelection: true });

  assert.match(adminRoot.innerHTML, /Student Progress Monitor/);
  assert.match(adminRoot.innerHTML, /alpha\.student@example\.com/);
  assert.match(adminRoot.innerHTML, /life-01/);
  assert.match(adminRoot.innerHTML, /Avg Completion/);
});

test('admin auto-refresh interval starts in admin view and stops when leaving admin view', () => {
  const homeView = new ElementStub({ classes: ['view', 'active'] });
  const adminView = new ElementStub({ classes: ['view'] });
  const adminRoot = new ElementStub();
  const intervalIds = [];
  const clearedIds = [];

  const { app } = loadMCQAppWithAuth({
    'home-view': homeView,
    'admin-view': adminView,
    'admin-dashboard-root': adminRoot
  }, {
    documentQuerySelectorAll: (selector) => selector === '.view' ? [homeView, adminView] : [],
    onSetInterval: (_callback, delay) => {
      const id = intervalIds.length + 1;
      intervalIds.push({ id, delay });
      return id;
    },
    onClearInterval: (id) => {
      clearedIds.push(id);
    }
  });

  app.state.auth.authenticated = true;
  app.state.auth.user = {
    id: 'admin-1',
    email: 'habibcanad@gmail.com',
    isAdmin: true
  };
  app.state.auth.admin = null;
  app.refreshAdminDashboard = async () => true;
  app.renderAdminDashboard = () => {};
  app.clearAutoAdvanceTimer = () => {};
  app.stopQuestionTimer = () => {};
  app.saveProgress = () => {};
  app.resetAdvanceTapState = () => {};
  app.stopSpeech = () => {};
  app.cleanupQuizKeyboardListeners = () => {};
  app.renderTopicsGrid = () => {};

  app.showView('admin');
  assert.equal(intervalIds.length, 1);
  assert.equal(intervalIds[0].delay, 60000);

  app.showView('home');
  assert.deepEqual(clearedIds, [1]);
});

test('admin view entry triggers an immediate refresh even with cached overview data', () => {
  const homeView = new ElementStub({ classes: ['view', 'active'] });
  const adminView = new ElementStub({ classes: ['view'] });
  const adminRoot = new ElementStub();
  let refreshCalls = 0;

  const { app } = loadMCQAppWithAuth({
    'home-view': homeView,
    'admin-view': adminView,
    'admin-dashboard-root': adminRoot
  }, {
    documentQuerySelectorAll: (selector) => selector === '.view' ? [homeView, adminView] : [],
    onSetInterval: () => 1,
    onClearInterval: () => {}
  });

  app.state.auth.authenticated = true;
  app.state.auth.user = {
    id: 'admin-1',
    email: 'habibcanad@gmail.com',
    isAdmin: true
  };
  app.ensureAdminDashboardState();
  app.state.auth.admin.overview = { studentsCount: 5 };
  app.refreshAdminDashboard = async () => {
    refreshCalls += 1;
    return true;
  };
  app.renderAdminDashboard = () => {};
  app.clearAutoAdvanceTimer = () => {};
  app.stopQuestionTimer = () => {};
  app.saveProgress = () => {};
  app.resetAdvanceTapState = () => {};
  app.stopSpeech = () => {};
  app.cleanupQuizKeyboardListeners = () => {};
  app.renderTopicsGrid = () => {};

  app.showView('admin');
  assert.equal(refreshCalls, 1);
});

test('signOut clears admin auto-refresh timer and resets admin dashboard state', async () => {
  const clearedIds = [];
  const { app } = loadMCQAppWithAuth({}, {
    onClearInterval: (id) => {
      clearedIds.push(id);
    }
  });

  app.fetchAuthJson = async () => ({ success: true });
  app.showView = () => {};
  app.renderAuthPanel = () => {};
  app.showToast = () => {};
  app.applyProgressSnapshot = () => {};
  app.getEmptyProgressSnapshot = () => ({ version: 1, items: {} });

  app.state.auth.authenticated = true;
  app.state.auth.user = {
    id: 'admin-1',
    email: 'habibcanad@gmail.com',
    isAdmin: true
  };
  app.ensureAdminDashboardState();
  app.state.auth.admin.refreshIntervalId = 42;
  app.state.auth.admin.overview = { studentsCount: 1 };
  app.state.auth.admin.students = [{ id: 'student-1' }];
  app.state.auth.admin.selectedStudentId = 'student-1';
  app.state.auth.admin.selectedStudentDetail = { student: { id: 'student-1' } };
  app.state.auth.admin.error = 'x';
  app.state.auth.admin.detailError = 'y';

  await app.signOut();

  assert.deepEqual(clearedIds, [42]);
  assert.equal(app.state.auth.authenticated, false);
  assert.equal(app.state.auth.user, null);
  assert.equal(app.state.auth.admin.refreshIntervalId, null);
  assert.equal(app.state.auth.admin.overview, null);
  assert.equal(Array.isArray(app.state.auth.admin.students), true);
  assert.equal(app.state.auth.admin.students.length, 0);
  assert.equal(app.state.auth.admin.selectedStudentId, '');
  assert.equal(app.state.auth.admin.selectedStudentDetail, null);
  assert.equal(app.state.auth.admin.error, '');
  assert.equal(app.state.auth.admin.detailError, '');
});

test('resetAdminStudentTestProgress posts the expected payload and refreshes dashboard state', async () => {
  const fetchCalls = [];
  let refreshCalls = 0;
  const { app } = loadMCQAppWithAuth({}, {
    location: { href: 'https://hllqpmcqs.com/' },
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  app.state.auth.authenticated = true;
  app.state.auth.user = {
    id: 'admin-1',
    email: 'habibcanad@gmail.com',
    isAdmin: true
  };
  app.ensureAdminDashboardState();
  app.state.auth.admin.selectedStudentId = 'student-1';
  app.refreshAdminDashboard = async () => {
    refreshCalls += 1;
    return true;
  };
  app.renderAdminDashboard = () => {};
  app.showToast = () => {};

  await app.resetAdminStudentTestProgress('llqp-life', 'life-01');

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://hllqpmcqs.com/api/admin/students/student-1/reset-test-progress');
  assert.equal(fetchCalls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), {
    topicId: 'llqp-life',
    testId: 'life-01'
  });
  assert.equal(refreshCalls, 1);
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
