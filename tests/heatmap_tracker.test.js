const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadMCQApp,
  setupQuizState
} = require('./helpers/mcq_app_test_utils');

test('queueHeatmapEvent captures events only while an MCQ test view is active', () => {
  const { app } = loadMCQApp();
  app.state.analytics.enabled = true;

  app.state.currentView = 'home';
  app.state.currentTopic = null;
  app.state.currentPracticeTest = null;
  app.queueHeatmapEvent({ type: 'click', selector: '.option[data-index="0"]' });
  assert.equal(app.state.analytics.queue.length, 0);

  app.state.currentView = 'mcq';
  app.state.currentTopic = { id: 'llqp-life' };
  app.state.currentPracticeTest = { id: 'life-01' };
  app.queueHeatmapEvent({ type: 'click', selector: '.option[data-index="0"]' });
  assert.equal(app.state.analytics.queue.length, 1);
});

test('selectOption emits click heatmap payload with option selector and relative coordinates', () => {
  const { app } = loadMCQApp();
  setupQuizState(app, {
    id: 'q-1',
    question: 'Question',
    options: ['A', 'B'],
    correctAnswer: 0
  });
  app.state.currentView = 'mcq';
  app.state.analytics.enabled = true;
  app.pauseQuestionTimer = () => {};
  app.recordDailyPractice = () => {};
  app.logWrongAnswer = () => {};
  app.renderQuestion = () => {};

  const emitted = [];
  app.queueHeatmapEvent = (payload) => {
    emitted.push(payload);
  };

  app.selectOption(1, {
    currentTarget: {
      getBoundingClientRect() {
        return { left: 100, top: 200, width: 200, height: 100 };
      }
    },
    clientX: 150,
    clientY: 225
  });

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, 'click');
  assert.equal(emitted[0].selector, '.option[data-index="1"]');
  assert.equal(Math.round(emitted[0].xPercent), 25);
  assert.equal(Math.round(emitted[0].yPercent), 25);
});

test('heatmap tracker schedules timed flushes and forces beacon flush on unload', () => {
  let scheduledFlushCallback = null;
  const { app, dispatchWindowEvent } = loadMCQApp({}, {
    onSetTimeout: (callback) => {
      scheduledFlushCallback = callback;
      return 99;
    }
  });

  setupQuizState(app, {
    id: 'q-1',
    question: 'Question',
    options: ['A', 'B'],
    correctAnswer: 0
  });
  app.state.currentView = 'mcq';
  app.state.analytics.enabled = true;

  let flushCount = 0;
  app.flushHeatmapEvents = () => {
    flushCount += 1;
    return true;
  };
  app.initHeatmapTracking();

  app.queueHeatmapEvent({ type: 'scroll', scrollPercent: 52 });
  assert.equal(typeof scheduledFlushCallback, 'function');
  scheduledFlushCallback();
  assert.equal(flushCount, 1);

  let unloadFlushOptions = null;
  app.stopHeatmapFlushTimer = () => {};
  app.flushHeatmapEvents = (options) => {
    unloadFlushOptions = options;
    return true;
  };
  dispatchWindowEvent('beforeunload');

  assert.equal(Boolean(unloadFlushOptions?.useBeacon), true);
  assert.equal(Boolean(unloadFlushOptions?.force), true);
});

test('mobile touchmove sampling applies throttle guardrails', () => {
  const { app, setNow, dispatchWindowEvent } = loadMCQApp({}, {
    innerWidth: 390
  });

  setupQuizState(app, {
    id: 'q-1',
    question: 'Question',
    options: ['A', 'B'],
    correctAnswer: 0
  });
  app.state.currentView = 'mcq';
  app.state.analytics.enabled = true;

  let moveEvents = 0;
  app.queueHeatmapEvent = (payload) => {
    if (payload.type === 'move') {
      moveEvents += 1;
    }
  };
  app.initHeatmapTracking();

  setNow(1000);
  dispatchWindowEvent('touchmove', { touches: [{ clientX: 20, clientY: 40 }] });
  setNow(1100);
  dispatchWindowEvent('touchmove', { touches: [{ clientX: 25, clientY: 45 }] });
  setNow(1300);
  dispatchWindowEvent('touchmove', { touches: [{ clientX: 30, clientY: 50 }] });

  assert.equal(moveEvents, 2);
});
