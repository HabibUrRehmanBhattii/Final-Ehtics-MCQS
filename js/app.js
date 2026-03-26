// ===================================
// MCQ Study Platform - Main Application
// ===================================
const MCQApp = {
  appBuildVersion: '20260326f',
  cacheVersion: 'v1.8.11',
  shuffleSchemaVersion: '20260323-session-layout-v5',
  // State Management
  state: {
    topics: [],
    currentTopic: null,
    currentPracticeTest: null,
    questions: [],
    loadedQuestionSetId: null,
    loadedQuestionSourceSignature: '',
    currentQuestionIndex: 0,
    bookmarkedQuestions: new Set(),
    viewedQuestions: new Set(),
    answersRevealed: new Set(),
    currentView: 'home',
    filterMode: 'all', // 'all' or 'bookmarked'
    wrongQuestions: [],
    lastSelectedIndex: undefined,
    lastSelectedQuestionKey: null,
    lastRenderedQuestionKey: null,
    lastRenderedQuestionIndex: -1,
    isReviewMode: false,
    attemptedOptions: {}, // Track which options were attempted for each question
    firstAttemptCorrect: {}, // Track if first attempt was correct for each question
    speechSupported: false,
    currentUtterance: null,
    lifeSection: null,
    practiceTestParent: null,
    currentPdfResource: null,
    currentPdfObjectUrl: null,
    loadingCount: 0,
    autoAdvanceTimer: null,
    aiAvailable: false,
    questionElapsedMs: {},
    activeQuestionTimerKey: null,
    activeQuestionTimerStartedAt: null,
    questionTimerInterval: null,
    lastAdvanceTapAt: 0,
    lastAdvanceTapKey: null,
    mcqTouchStart: null,
    auth: {
      available: false,
      authenticated: false,
      loading: false,
      error: '',
      user: null,
      admin: null,
      heatmapEnabled: true,
      passwordResetEmailEnabled: false,
      pendingResetToken: '',
      turnstileReady: false,
      turnstileSiteKey: '',
      authMode: 'signin',
      widgetId: null,
      lastSyncedAt: null,
      syncTimer: null,
      migrating: false
    },
    analytics: {
      enabled: true,
      initialized: false,
      visitorId: '',
      sessionId: '',
      queue: [],
      replayQueue: [],
      flushTimer: null,
      flushing: false,
      moveLastSentAt: 0,
      scrollLastSentAt: 0,
      hoverLastEventKey: '',
      hoverLastAt: 0,
      replayChunkIndex: 0,
      profile: null
    },
    autoAdvanceEnabled: localStorage.getItem('auto-advance') === 'true',
    autoAdvanceDelay: 1500,
    homeInsightsExpanded: localStorage.getItem('home-insights-expanded') === 'true'
  },

  // Utility: Shuffle Array (Fisher-Yates)
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  stripOptionPrefix(optionText) {
    if (typeof optionText !== 'string') return '';
    return optionText.replace(/^\s*(?:\(?\s*[A-Fa-f1-6]\s*\)?\s*[.):\-]?)\s+/, '').trim();
  },

  getOptionDisplayText(optionText) {
    return this.stripOptionPrefix(optionText);
  },

  getNormalizedOptionFeedback(question, optionOrder = null) {
    if (!question || !Array.isArray(question.options)) return [];

    const rawFeedback = Array.isArray(question.optionFeedback) ? question.optionFeedback : [];
    const orderedFeedback = Array.isArray(optionOrder)
      ? optionOrder.map((sourceIndex) => rawFeedback[sourceIndex])
      : rawFeedback.slice();

    const normalizedFeedback = question.options.map((_, index) => {
      const value = orderedFeedback[index];
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'undefined' || value === null) return '';
      return String(value).trim();
    });

    const correctIndex = Number.isInteger(question.correctAnswer) ? question.correctAnswer : -1;
    if (correctIndex >= 0 && correctIndex < normalizedFeedback.length && !normalizedFeedback[correctIndex]) {
      normalizedFeedback[correctIndex] = String(question.explanation || '').trim();
    }

    return normalizedFeedback;
  },

  normalizeQuestionOptionLabels(question) {
    if (!question || !Array.isArray(question.options)) return question;
    return {
      ...question,
      options: question.options.map((option) => this.getOptionDisplayText(option)),
      optionFeedback: this.getNormalizedOptionFeedback(question)
    };
  },

  getLoadedQuestionSetKey(topicId = this.state.currentTopic?.id, testId = this.state.currentPracticeTest?.id) {
    if (!topicId || !testId) return null;
    return `${topicId}:${testId}`;
  },

  buildQuestionFromOptionOrder(question, optionOrder = null) {
    if (!question || !Array.isArray(question.options)) return question;

    const optionsWithoutPrefix = question.options.map((option) => this.getOptionDisplayText(option));
    const defaultOrder = optionsWithoutPrefix.map((_, index) => index);
    const isValidOptionOrder = Array.isArray(optionOrder) &&
      optionOrder.length === defaultOrder.length &&
      optionOrder.every((value) => Number.isInteger(value) && value >= 0 && value < defaultOrder.length) &&
      new Set(optionOrder).size === optionOrder.length;
    const resolvedOrder = isValidOptionOrder ? optionOrder.slice() : defaultOrder;
    const originalCorrectAnswer = Number.isInteger(question.correctAnswer) ? question.correctAnswer : -1;
    const shuffledOptions = resolvedOrder.map((originalIndex) => optionsWithoutPrefix[originalIndex]);
    const shuffledFeedback = this.getNormalizedOptionFeedback(question, resolvedOrder);
    const newCorrectAnswer = originalCorrectAnswer >= 0 ? resolvedOrder.indexOf(originalCorrectAnswer) : -1;

    return this.normalizeQuestionOptionLabels({
      ...question,
      options: shuffledOptions,
      correctAnswer: newCorrectAnswer,
      optionFeedback: shuffledFeedback,
      __optionOrder: resolvedOrder
    });
  },

  resolveOptionOrderFromTexts(question, optionTexts = []) {
    if (!question || !Array.isArray(question.options) || !Array.isArray(optionTexts)) {
      return null;
    }

    const normalizedSourceOptions = question.options.map((option) => this.getOptionDisplayText(option));
    if (normalizedSourceOptions.length !== optionTexts.length) {
      return null;
    }

    const order = [];
    const used = new Set();
    for (const optionText of optionTexts) {
      const normalizedTarget = this.getOptionDisplayText(optionText);
      const sourceIndex = normalizedSourceOptions.findIndex((value, index) =>
        value === normalizedTarget && !used.has(index)
      );
      if (sourceIndex < 0) {
        return null;
      }
      used.add(sourceIndex);
      order.push(sourceIndex);
    }

    return order;
  },

  buildQuestionLayoutSnapshot(questions = this.state.questions) {
    const questionOrder = [];
    const optionTextsByQuestion = {};

    (Array.isArray(questions) ? questions : []).forEach((question) => {
      const questionKey = this.getQuestionStateKey(question);
      if (!questionKey) return;
      questionOrder.push(questionKey);
      optionTextsByQuestion[questionKey] = Array.isArray(question.options)
        ? question.options.map((option) => this.getOptionDisplayText(option))
        : [];
    });

    return {
      questionOrder,
      optionTextsByQuestion
    };
  },

  buildQuestionsFromLayout(rawQuestions, layout) {
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return [];
    if (!layout || !Array.isArray(layout.questionOrder)) return null;

    const optionTextsByQuestion = layout.optionTextsByQuestion && typeof layout.optionTextsByQuestion === 'object'
      ? layout.optionTextsByQuestion
      : {};
    const questionMap = new Map(rawQuestions.map((question) => [String(question?.id), question]));
    const seen = new Set();
    const restoredQuestions = [];

    for (const questionKey of layout.questionOrder) {
      const normalizedKey = String(questionKey);
      const rawQuestion = questionMap.get(normalizedKey);
      if (!rawQuestion || seen.has(normalizedKey)) {
        return null;
      }

      const optionOrder = this.resolveOptionOrderFromTexts(rawQuestion, optionTextsByQuestion[normalizedKey] || []);
      if (!optionOrder) {
        return null;
      }

      restoredQuestions.push(this.buildQuestionFromOptionOrder(rawQuestion, optionOrder));
      seen.add(normalizedKey);
    }

    if (restoredQuestions.length !== rawQuestions.length || seen.size !== questionMap.size) {
      return null;
    }

    return restoredQuestions;
  },

  formatQuestionTimer(ms = 0) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  },

  getRecommendedTotalQuestionTimeMs(questionCount = 0) {
    return Math.max(0, Number(questionCount || 0)) * 120000;
  },

  getCompletionTimeSummary(questions = this.getFilteredQuestions()) {
    const list = Array.isArray(questions) ? questions : [];
    const totalQuestions = list.length;
    const totalElapsedMs = list.reduce((sum, question) => {
      const questionKey = this.getQuestionStateKey(question);
      return sum + (questionKey ? this.getQuestionElapsedMs(questionKey) : 0);
    }, 0);
    const recommendedTotalMs = this.getRecommendedTotalQuestionTimeMs(totalQuestions);
    const averageQuestionMs = totalQuestions > 0 ? Math.round(totalElapsedMs / totalQuestions) : 0;
    const deltaMs = totalElapsedMs - recommendedTotalMs;
    const isOnTarget = deltaMs === 0;
    const withinRecommended = deltaMs <= 0;

    let paceLabel = 'Right on the total target';
    if (deltaMs < 0) {
      paceLabel = `${this.formatQuestionTimer(Math.abs(deltaMs))} under total target`;
    } else if (deltaMs > 0) {
      paceLabel = `${this.formatQuestionTimer(deltaMs)} over total target`;
    }

    return {
      totalQuestions,
      totalElapsedMs,
      recommendedTotalMs,
      averageQuestionMs,
      withinRecommended,
      isOnTarget,
      totalElapsedLabel: this.formatQuestionTimer(totalElapsedMs),
      recommendedTotalLabel: this.formatQuestionTimer(recommendedTotalMs),
      averageQuestionLabel: this.formatQuestionTimer(averageQuestionMs),
      paceLabel
    };
  },

  getVersionChipLabel() {
    return `Cache ${this.cacheVersion}`;
  },

  renderVersionChip() {
    const chip = document.getElementById('app-build-chip');
    if (!chip) return;

    const label = this.getVersionChipLabel();
    chip.textContent = label;
    chip.setAttribute('title', label);
    chip.setAttribute('aria-label', label);
  },

  isHeatmapTrackingActive() {
    return Boolean(
      this.state.analytics.enabled &&
      this.state.currentView === 'mcq' &&
      this.state.currentTopic?.id &&
      this.state.currentPracticeTest?.id
    );
  },

  getHeatmapTrackingProfile() {
    const viewportWidth = Math.max(0, Math.floor(window.innerWidth || 0));
    const viewportHeight = Math.max(0, Math.floor(window.innerHeight || 0));
    const userAgent = String(navigator?.userAgent || '').toLowerCase();
    const uaClass = /ipad|tablet/.test(userAgent)
      ? 'tablet'
      : /mobile|iphone|android|ipod/.test(userAgent)
        ? 'mobile'
        : userAgent
          ? 'desktop'
          : 'unknown';
    const coarsePointer = typeof window.matchMedia === 'function'
      ? Boolean(window.matchMedia('(pointer: coarse)').matches)
      : false;
    const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection || null;
    const saveData = Boolean(connection?.saveData);
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    const lowPowerDevice = (
      (Number(navigator?.deviceMemory || 0) > 0 && Number(navigator?.deviceMemory || 0) <= 4)
      || (Number(navigator?.hardwareConcurrency || 0) > 0 && Number(navigator?.hardwareConcurrency || 0) <= 4)
    );
    const slowNetwork = saveData || effectiveType === '2g' || effectiveType === 'slow-2g';

    const isTablet = uaClass === 'tablet';
    const isMobile = !isTablet && (uaClass === 'mobile' || viewportWidth <= 820 || coarsePointer);
    const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : uaClass === 'desktop' ? 'desktop' : 'unknown';

    let profile = {
      deviceType,
      uaClass,
      viewportWidth,
      viewportHeight,
      effectiveType,
      saveData,
      moveSampleMs: 150,
      touchMoveSampleMs: 260,
      scrollSampleMs: 300,
      hoverSampleMs: 900,
      flushDelayMs: 5000,
      queueFlushCount: 120,
      replayFlushCount: 220,
      maxBatchEvents: 500,
      maxReplayEvents: 500,
      maxPayloadBytes: 256 * 1024
    };

    if (deviceType === 'tablet') {
      profile = {
        ...profile,
        moveSampleMs: 180,
        touchMoveSampleMs: 320,
        scrollSampleMs: 420,
        flushDelayMs: 6000,
        queueFlushCount: 90,
        replayFlushCount: 150,
        maxBatchEvents: 140,
        maxReplayEvents: 170,
        maxPayloadBytes: 72 * 1024
      };
    }

    if (deviceType === 'mobile') {
      const constrained = lowPowerDevice || slowNetwork;
      profile = {
        ...profile,
        moveSampleMs: constrained ? 360 : 280,
        touchMoveSampleMs: constrained ? 700 : 460,
        scrollSampleMs: constrained ? 900 : 600,
        hoverSampleMs: constrained ? 1800 : 1400,
        flushDelayMs: constrained ? 9000 : 7000,
        queueFlushCount: constrained ? 45 : 60,
        replayFlushCount: constrained ? 72 : 96,
        maxBatchEvents: constrained ? 60 : 80,
        maxReplayEvents: constrained ? 80 : 110,
        maxPayloadBytes: constrained ? 24 * 1024 : 36 * 1024
      };
    }

    this.state.analytics.profile = profile;
    return profile;
  },

  getHeatmapTrackingContext() {
    const question = this.getCurrentQuestion();
    const questionId = question ? this.getQuestionStateKey(question) : '';
    const profile = this.getHeatmapTrackingProfile();
    return {
      routePath: `${window.location.pathname}#${this.state.currentView}`,
      topicId: this.state.currentTopic?.id || '',
      testId: this.state.currentPracticeTest?.id || '',
      questionId: questionId || '',
      quizKey: this.state.currentTopic?.id && this.state.currentPracticeTest?.id
        ? `${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`
        : '',
      deviceType: profile.deviceType,
      viewport: {
        width: profile.viewportWidth,
        height: profile.viewportHeight
      },
      uaClass: profile.uaClass,
      networkType: profile.effectiveType || '',
      saveData: profile.saveData,
      timezoneOffset: new Date().getTimezoneOffset()
    };
  },

  queueHeatmapEvent(event = {}) {
    if (!this.isHeatmapTrackingActive()) return;
    if (!event || typeof event !== 'object') return;

    const analytics = this.state.analytics;
    const normalized = {
      type: String(event.type || '').trim().toLowerCase(),
      ts: Date.now(),
      ...event
    };
    if (!['click', 'move', 'scroll', 'hover'].includes(normalized.type)) return;

    if (typeof normalized.xPercent === 'number') {
      normalized.xPercent = Math.max(0, Math.min(100, normalized.xPercent));
    }
    if (typeof normalized.yPercent === 'number') {
      normalized.yPercent = Math.max(0, Math.min(100, normalized.yPercent));
    }
    if (typeof normalized.scrollPercent === 'number') {
      normalized.scrollPercent = Math.max(0, Math.min(100, normalized.scrollPercent));
    }

    const profile = this.getHeatmapTrackingProfile();
    analytics.queue.push(normalized);
    this.queueReplayEvent(normalized);
    this.scheduleHeatmapFlush();

    if (analytics.queue.length >= profile.queueFlushCount) {
      this.flushHeatmapEvents();
    }
  },

  queueReplayEvent(event = {}) {
    const analytics = this.state.analytics;
    const safeEvent = {
      type: String(event.type || 'event').slice(0, 32),
      ts: new Date(event.ts || Date.now()).toISOString(),
      xPercent: typeof event.xPercent === 'number' ? event.xPercent : null,
      yPercent: typeof event.yPercent === 'number' ? event.yPercent : null,
      scrollPercent: typeof event.scrollPercent === 'number' ? event.scrollPercent : null,
      selector: String(event.selector || '').slice(0, 255),
      value: String(event.value || '').slice(0, 180)
    };
    if (/(password|token|email|auth|secret|reset)/i.test(safeEvent.selector)) {
      safeEvent.selector = '[masked]';
      safeEvent.value = '[masked]';
    }

    const profile = this.getHeatmapTrackingProfile();
    analytics.replayQueue.push(safeEvent);
    if (analytics.replayQueue.length >= profile.replayFlushCount) {
      this.flushHeatmapEvents();
    }
  },

  scheduleHeatmapFlush(delayMs = null) {
    const analytics = this.state.analytics;
    if (analytics.flushTimer) return;
    const profile = this.getHeatmapTrackingProfile();
    const waitMs = Number.isFinite(Number(delayMs))
      ? Math.max(1000, Number(delayMs))
      : Math.max(1000, Number(profile.flushDelayMs || 5000));
    analytics.flushTimer = window.setTimeout(() => {
      analytics.flushTimer = null;
      this.flushHeatmapEvents();
    }, waitMs);
  },

  stopHeatmapFlushTimer() {
    const analytics = this.state.analytics;
    if (analytics.flushTimer) {
      window.clearTimeout(analytics.flushTimer);
      analytics.flushTimer = null;
    }
  },

  estimateHeatmapPayloadBytes(payload) {
    const serialized = JSON.stringify(payload || {});
    if (typeof TextEncoder !== 'undefined') {
      try {
        return new TextEncoder().encode(serialized).length;
      } catch {}
    }
    return serialized.length;
  },

  buildHeatmapFlushPayload() {
    const analytics = this.state.analytics;
    const profile = this.getHeatmapTrackingProfile();
    const maxBatchEvents = Math.max(1, Math.min(500, Number(profile.maxBatchEvents || 500)));
    const maxReplayEvents = Math.max(0, Math.min(500, Number(profile.maxReplayEvents || 500)));
    const maxPayloadBytes = Math.max(12 * 1024, Number(profile.maxPayloadBytes || (64 * 1024)));
    let events = analytics.queue.slice(0, maxBatchEvents);
    let replayEvents = analytics.replayQueue.slice(0, maxReplayEvents);

    const buildPayload = () => ({
      sessionId: analytics.sessionId || '',
      context: this.getHeatmapTrackingContext(),
      events,
      replayChunk: replayEvents.length > 0
        ? {
          chunkIndex: analytics.replayChunkIndex,
          events: replayEvents
        }
        : null
    });

    let payload = buildPayload();
    let attempts = 0;
    while (
      attempts < 12
      && this.estimateHeatmapPayloadBytes(payload) > maxPayloadBytes
      && (events.length > 1 || replayEvents.length > 1)
    ) {
      attempts += 1;
      if (replayEvents.length >= events.length && replayEvents.length > 1) {
        replayEvents = replayEvents.slice(0, Math.max(1, Math.floor(replayEvents.length * 0.75)));
      } else if (events.length > 1) {
        events = events.slice(0, Math.max(1, Math.floor(events.length * 0.75)));
      } else if (replayEvents.length > 1) {
        replayEvents = replayEvents.slice(0, Math.max(1, Math.floor(replayEvents.length * 0.75)));
      } else {
        break;
      }
      payload = buildPayload();
    }

    return {
      payload,
      eventCount: events.length,
      replayEventCount: replayEvents.length
    };
  },

  async flushHeatmapEvents({ useBeacon = false, force = false } = {}) {
    const analytics = this.state.analytics;
    if (!analytics.enabled || analytics.flushing) return false;
    if (!force && !this.isHeatmapTrackingActive()) return false;
    if (analytics.queue.length === 0 && analytics.replayQueue.length === 0) return false;

    analytics.flushing = true;
    try {
      const { payload, eventCount, replayEventCount } = this.buildHeatmapFlushPayload();
      if (eventCount === 0 && replayEventCount === 0) {
        return false;
      }

      let accepted = false;
      if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        accepted = Boolean(navigator.sendBeacon('/api/analytics/track', blob));
      } else {
        const response = await fetch('/api/analytics/track', {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data?.sessionId) analytics.sessionId = String(data.sessionId);
          if (data?.visitorId) analytics.visitorId = String(data.visitorId);
          accepted = true;
        }
      }

      if (accepted) {
        analytics.queue.splice(0, eventCount);
        analytics.replayQueue.splice(0, replayEventCount);
        if (replayEventCount > 0) {
          analytics.replayChunkIndex += 1;
        }
      }

      return accepted;
    } catch (error) {
      console.warn('Heatmap flush failed', error);
      return false;
    } finally {
      analytics.flushing = false;
    }
  },

  initHeatmapTracking() {
    const analytics = this.state.analytics;
    if (analytics.initialized) return;
    analytics.initialized = true;
    analytics.enabled = this.state.auth.heatmapEnabled !== false;
    analytics.profile = this.getHeatmapTrackingProfile();
    analytics.sessionId = `s_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36).slice(-4)}`;

    window.addEventListener('resize', () => {
      analytics.profile = this.getHeatmapTrackingProfile();
    }, { passive: true });

    window.addEventListener('mousemove', (event) => {
      if (!this.isHeatmapTrackingActive()) return;
      const profile = this.getHeatmapTrackingProfile();
      const now = Date.now();
      if (now - analytics.moveLastSentAt < profile.moveSampleMs) return;
      analytics.moveLastSentAt = now;
      const width = Math.max(window.innerWidth || 1, 1);
      const height = Math.max(window.innerHeight || 1, 1);
      this.queueHeatmapEvent({
        type: 'move',
        xPercent: (Number(event.clientX || 0) / width) * 100,
        yPercent: (Number(event.clientY || 0) / height) * 100
      });
    }, { passive: true });

    window.addEventListener('touchmove', (event) => {
      if (!this.isHeatmapTrackingActive()) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const profile = this.getHeatmapTrackingProfile();
      const now = Date.now();
      if (now - analytics.moveLastSentAt < profile.touchMoveSampleMs) return;
      analytics.moveLastSentAt = now;
      const width = Math.max(window.innerWidth || 1, 1);
      const height = Math.max(window.innerHeight || 1, 1);
      this.queueHeatmapEvent({
        type: 'move',
        xPercent: (Number(touch.clientX || 0) / width) * 100,
        yPercent: (Number(touch.clientY || 0) / height) * 100
      });
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (!this.isHeatmapTrackingActive()) return;
      const profile = this.getHeatmapTrackingProfile();
      const now = Date.now();
      if (now - analytics.scrollLastSentAt < profile.scrollSampleMs) return;
      analytics.scrollLastSentAt = now;
      const doc = document.documentElement || document.body;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const maxScroll = Math.max((doc.scrollHeight || 0) - (window.innerHeight || 0), 1);
      this.queueHeatmapEvent({
        type: 'scroll',
        scrollPercent: (scrollTop / maxScroll) * 100
      });
    }, { passive: true });

    window.addEventListener('beforeunload', () => {
      this.stopHeatmapFlushTimer();
      this.flushHeatmapEvents({ useBeacon: true, force: true });
    });

    window.addEventListener('pagehide', () => {
      this.stopHeatmapFlushTimer();
      this.flushHeatmapEvents({ useBeacon: true, force: true });
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      this.stopHeatmapFlushTimer();
      this.flushHeatmapEvents({ useBeacon: true, force: true });
    });
  },

  getQuestionElapsedMs(questionKey) {
    if (!questionKey) return 0;

    let total = Number(this.state.questionElapsedMs[questionKey] || 0);
    if (this.state.activeQuestionTimerKey === questionKey && this.state.activeQuestionTimerStartedAt) {
      total += Math.max(0, Date.now() - this.state.activeQuestionTimerStartedAt);
    }

    return total;
  },

  flushActiveQuestionTimer() {
    const { activeQuestionTimerKey, activeQuestionTimerStartedAt } = this.state;
    if (!activeQuestionTimerKey || !activeQuestionTimerStartedAt) return;

    const elapsed = Math.max(0, Date.now() - activeQuestionTimerStartedAt);
    this.state.questionElapsedMs[activeQuestionTimerKey] = Number(this.state.questionElapsedMs[activeQuestionTimerKey] || 0) + elapsed;
    this.state.activeQuestionTimerStartedAt = null;
  },

  updateQuestionTimerDisplay(questionKey = this.state.activeQuestionTimerKey) {
    const timerEl = document.getElementById('question-timer');
    if (!timerEl) return;

    const elapsed = questionKey ? this.getQuestionElapsedMs(questionKey) : 0;
    timerEl.textContent = this.formatQuestionTimer(elapsed);
    timerEl.classList.toggle('is-warning', elapsed >= 120000);
  },

  stopQuestionTimer() {
    this.flushActiveQuestionTimer();

    if (this.state.questionTimerInterval) {
      window.clearInterval(this.state.questionTimerInterval);
      this.state.questionTimerInterval = null;
    }

    this.state.activeQuestionTimerKey = null;
    this.state.activeQuestionTimerStartedAt = null;
    this.updateQuestionTimerDisplay(null);
  },

  pauseQuestionTimer(questionKey = this.state.activeQuestionTimerKey) {
    this.flushActiveQuestionTimer();

    if (this.state.questionTimerInterval) {
      window.clearInterval(this.state.questionTimerInterval);
      this.state.questionTimerInterval = null;
    }

    this.state.activeQuestionTimerKey = null;
    this.state.activeQuestionTimerStartedAt = null;
    this.updateQuestionTimerDisplay(questionKey || null);
  },

  startQuestionTimer(question) {
    const questionKey = this.getQuestionStateKey(question);
    if (!questionKey) {
      this.stopQuestionTimer();
      return;
    }

    if (this.state.activeQuestionTimerKey && this.state.activeQuestionTimerKey !== questionKey) {
      this.flushActiveQuestionTimer();
    }

    if (this.state.activeQuestionTimerKey !== questionKey || !this.state.activeQuestionTimerStartedAt) {
      this.state.activeQuestionTimerKey = questionKey;
      this.state.activeQuestionTimerStartedAt = Date.now();
    }

    if (!this.state.questionTimerInterval) {
      this.state.questionTimerInterval = window.setInterval(() => {
        this.updateQuestionTimerDisplay();
      }, 1000);
    }

    this.updateQuestionTimerDisplay(questionKey);
  },

  shouldTrackQuestionTime(question) {
    const questionKey = this.getQuestionStateKey(question);
    if (!questionKey) return false;
    if (this.state.answersRevealed.has(questionKey)) return false;

    const attempts = this.state.attemptedOptions[questionKey];
    return !Array.isArray(attempts) || attempts.length === 0;
  },

  syncQuestionTimer(question) {
    const questionKey = this.getQuestionStateKey(question);
    if (!questionKey) {
      this.stopQuestionTimer();
      return;
    }

    // Freeze the timer after the first submitted answer so review time does not
    // continue to count against the question.
    if (this.shouldTrackQuestionTime(question)) {
      this.startQuestionTimer(question);
      return;
    }

    this.pauseQuestionTimer(questionKey);
  },

  getQuestionTimersSnapshot() {
    const snapshot = { ...this.state.questionElapsedMs };
    const activeKey = this.state.activeQuestionTimerKey;
    if (activeKey && this.state.activeQuestionTimerStartedAt) {
      snapshot[activeKey] = Number(snapshot[activeKey] || 0) + Math.max(0, Date.now() - this.state.activeQuestionTimerStartedAt);
    }
    return snapshot;
  },

  isBlockedAdvanceTapTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;

    return Boolean(target.closest(
      'button, a, input, textarea, select, label, summary, details, .option, .q-nav, .question-dot, .btn-dot-nav, .follow-up-composer'
    ));
  },

  resetAdvanceTapState() {
    this.state.lastAdvanceTapAt = 0;
    this.state.lastAdvanceTapKey = null;
    this.state.mcqTouchStart = null;
  },

  handleMcqTouchStart(event) {
    if (!event.touches || event.touches.length !== 1) {
      this.state.mcqTouchStart = null;
      return;
    }

    const touch = event.touches[0];
    this.state.mcqTouchStart = {
      x: touch.clientX,
      y: touch.clientY
    };
  },

  triggerDoubleTapNext(event) {
    if (this.state.currentView !== 'mcq') return;

    const question = this.getCurrentQuestion();
    const questionKey = this.getQuestionStateKey(question);
    if (!question || !questionKey || !this.state.answersRevealed.has(questionKey)) {
      this.resetAdvanceTapState();
      return;
    }

    const filteredQuestions = this.getFilteredQuestions();
    const isLastQuestion = this.state.currentQuestionIndex >= filteredQuestions.length - 1;
    if (isLastQuestion || this.isBlockedAdvanceTapTarget(event?.target)) {
      return;
    }

    const now = Date.now();
    const isDoubleTap = this.state.lastAdvanceTapKey === questionKey && (now - this.state.lastAdvanceTapAt) <= 320;

    this.state.lastAdvanceTapAt = now;
    this.state.lastAdvanceTapKey = questionKey;

    if (!isDoubleTap) return;

    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }

    this.resetAdvanceTapState();
    this.navigateQuestion(1);
  },

  handleMcqTouchEnd(event) {
    if (!this.state.mcqTouchStart || !event.changedTouches || event.changedTouches.length !== 1) {
      this.state.mcqTouchStart = null;
      return;
    }

    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.state.mcqTouchStart.x;
    const dy = touch.clientY - this.state.mcqTouchStart.y;
    this.state.mcqTouchStart = null;

    if (Math.hypot(dx, dy) > 18) {
      return;
    }

    this.triggerDoubleTapNext(event);
  },

  normalizeStudyText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .replace(/[^a-z0-9$% ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  getKeywordTokens(value) {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'by', 'can', 'do', 'does',
      'for', 'from', 'has', 'have', 'if', 'in', 'into', 'is', 'it', 'its', 'not', 'of',
      'on', 'or', 'so', 'than', 'that', 'the', 'their', 'there', 'they', 'this', 'to',
      'was', 'were', 'what', 'when', 'which', 'who', 'will', 'with', 'would', 'you',
      'your'
    ]);

    return this.normalizeStudyText(value)
      .split(' ')
      .filter((token) => token.length > 2 && !stopWords.has(token));
  },

  getKeywordOverlapScore(text, reference) {
    const textTokens = new Set(this.getKeywordTokens(text));
    const refTokens = new Set(this.getKeywordTokens(reference));

    if (!textTokens.size || !refTokens.size) return 0;

    let matchCount = 0;
    textTokens.forEach((token) => {
      if (refTokens.has(token)) {
        matchCount += 1;
      }
    });

    return matchCount / Math.min(textTokens.size, refTokens.size);
  },

  cleanFeedbackText(value) {
    return String(value || '')
      .replace(/^incorrect\.\s*/i, '')
      .replace(/^correct\.\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  toSentence(value) {
    const cleaned = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[\s.]+$/, '');

    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) + '.';
  },

  getQuestionPlainText(question) {
    return String(question?.question || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  getQuestionFocusText(question) {
    const plainQuestion = this.getQuestionPlainText(question);
    const parts = plainQuestion.split(/(?<=[.?!])\s+/).filter(Boolean);
    const target = [...parts].reverse().find((line) =>
      /\?$/.test(line) || /(which|what|how much|who|best|correct|most likely|following)/i.test(line)
    ) || parts[parts.length - 1] || 'Determine the best answer based on the scenario facts';

    return this.toSentence(target);
  },

  isExceptionQuestion(question) {
    const focusText = this.getQuestionFocusText(question).toLowerCase();
    return /\bexcept\b/.test(focusText) ||
      /\bnot required\b/.test(focusText) ||
      /\bnot true\b/.test(focusText) ||
      /\bnot correct\b/.test(focusText) ||
      /\bnot considered\b/.test(focusText) ||
      /\bwhich of the following is not\b/.test(focusText) ||
      /\ball of these .* except\b/.test(focusText);
  },

  inferQuestionRule(question) {
    const q = this.getQuestionPlainText(question).toLowerCase();

    if (/beneficiar|estate as beneficiary/.test(q)) {
      return 'Use beneficiary-order rules: proceeds go to the named beneficiary first, and a contingent beneficiary applies only if the primary beneficiary predeceases the life insured.';
    }

    if (/underwrit|insurab|temporary insurance agreement|tia|medical evidence|application/.test(q)) {
      return 'Apply underwriting eligibility rules: identify whose health must be underwritten and whether any rider adds extra underwriting requirements.';
    }

    if (/capital gain|acb|gift|deemed disposition|non-registered/.test(q)) {
      return 'Apply capital-gains tax rules, including deemed disposition and adjusted cost base treatment where relevant.';
    }

    if (/charitable donation|charity|tax return|final return|terminal return|net income/.test(q)) {
      return 'Apply tax-return rules for the specific year: each year has its own claim limit, and available claims depend on the taxpayer and return being tested.';
    }

    if (/rrsp|rrif|lira|spousal rrsp|pension adjustment/.test(q)) {
      return 'Apply registered-plan contribution and withdrawal rules, including attribution and taxation at withdrawal where applicable.';
    }

    if (/annuit|annuity|term certain|life annuity/.test(q)) {
      return 'Apply annuity contract rules on payment guarantees, beneficiary rights, and taxation of annuity income.';
    }

    if (
      /segregated fund|seg fund|segregated contract|segregated policy|maturity guarantee|guaranteed maturity value|reset/.test(q) ||
      (/death benefit/.test(q) && /segregated|guarantee|maturity|reset/.test(q))
    ) {
      return 'Apply segregated-fund guarantee rules, including resets, maturity and death guarantees, and beneficiary treatment.';
    }

    if (/mortality|probability of death|life expectancy|life table/.test(q)) {
      return 'Apply mortality and life-table concepts to distinguish probability of death from life expectancy.';
    }

    if (/disabil|critical illness|long-term care|accident|sickness|elimination period|benefit period|offset/.test(q)) {
      return 'Apply the accident and sickness policy rule being tested, then check whether the trigger, waiting period, and benefit conditions are actually satisfied.';
    }

    return 'Apply the governing LLQP product, contract, and tax rule to the exact facts in the scenario.';
  },

  getConceptLabel(question, optionText = '', correctText = '') {
    const questionText = this.getQuestionPlainText(question);
    const combined = `${questionText} ${optionText} ${correctText}`.toLowerCase();

    if (
      /which statement|what statement|how would|what action|what happens|all of these|each of the following|which of the following/.test(combined) ||
      /^(if|when|normally|the|a|an)\b/i.test(optionText) ||
      /^(if|when|normally|the|a|an)\b/i.test(correctText)
    ) {
      return 'statement';
    }

    if (/beneficiar/.test(combined)) {
      return 'beneficiary designation';
    }

    if (/rider/.test(combined)) {
      return 'rider';
    }

    if (/provision|clause|grace period|reinstatement|free-look|non-forfeiture/.test(combined)) {
      return 'policy provision';
    }

    if (/annuit/.test(combined)) {
      return 'annuity type';
    }

    if (/group/.test(combined) && /contributory|employer|employee/.test(combined)) {
      return 'group plan feature';
    }

    if (/receipt|policy summary|certificate/.test(combined)) {
      return 'document';
    }

    if (/application|sign|initial/.test(combined)) {
      return 'application requirement';
    }

    if (/premium/.test(combined) && /mode|frequency|pay/.test(combined)) {
      return 'premium-payment feature';
    }

    if (/tax|rrsp|rrif|acb|capital gain|registered/.test(combined)) {
      return 'tax treatment';
    }

    if (/benefit|coverage|payable|claim|elimination period/.test(combined)) {
      return 'coverage condition';
    }

    return 'answer';
  },

  getCorrectConceptReason(question, correctText) {
    const q = this.getQuestionPlainText(question).toLowerCase();
    const correct = String(correctText || '').toLowerCase();

    if (/contingent beneficiary/.test(q)) {
      return `The correct answer is "${correctText}" because a contingent beneficiary is paid only if the primary beneficiary dies before the insured.`;
    }

    if (/beneficiar/.test(q) && /irrevocable/.test(correct)) {
      return `The correct idea here is "${correctText}": only an irrevocable beneficiary must consent to a change.`;
    }

    if (/beneficiar/.test(q) && /revocable/.test(correct)) {
      return `The correct idea here is "${correctText}": a revocable beneficiary can be changed by the policyowner without the beneficiary's consent.`;
    }

    if ((/beneficiar/.test(q) || /beneficiar/.test(correct)) && /contingent/.test(correct)) {
      return `The correct answer is "${correctText}" because a contingent beneficiary is paid only if the primary beneficiary dies before the insured.`;
    }

    if ((/beneficiar/.test(q) || /beneficiar/.test(correct)) && /primary/.test(correct)) {
      return `The correct answer is "${correctText}" because the primary beneficiary is first in line to receive the proceeds.`;
    }

    if (/minor beneficiar/.test(`${q} ${correct}`)) {
      return `The correct answer is "${correctText}" because a minor usually cannot give a valid discharge, so payment is commonly made to a trustee or guardian until the child reaches majority.`;
    }

    if (/change (?:of )?beneficiary|change a revocable beneficiary|change the beneficiary/.test(q) && /\banytime\b/.test(correct)) {
      return `The correct answer is "${correctText}" because a revocable beneficiary can be changed by the policyowner at any time.`;
    }

    if (/change (?:of )?beneficiary/.test(q) && /policyowner/.test(correct)) {
      return `The correct answer is "${correctText}" because the policyowner controls beneficiary changes unless the designation is irrevocable.`;
    }

    if (/noncontributory/.test(`${q} ${correct}`)) {
      return `The correct answer is "${correctText}" because a noncontributory plan is paid entirely by the employer.`;
    }

    if (/contributory/.test(`${q} ${correct}`)) {
      return `The correct answer is "${correctText}" because a contributory plan requires employees to share in the premium cost.`;
    }

    if (/grace period/.test(q)) {
      return `The correct answer is "${correctText}" because the grace period is the extra time to pay an overdue premium while coverage stays in force.`;
    }

    if (/reinstat/.test(q)) {
      return `The correct answer is "${correctText}" because reinstatement is the provision that can restore a lapsed policy once the insurer's conditions are met.`;
    }

    if (/free-look/.test(q)) {
      return `The correct answer is "${correctText}" because the free-look period begins when the policy is delivered.`;
    }

    if ((/waiver of premium/.test(q) || /totally disabled/.test(q)) && /waiver|premium|rider/.test(correct)) {
      return `The correct answer is "${correctText}" because this feature keeps the policy in force when the insured qualifies for a disability waiver.`;
    }

    if (/application/.test(q) && /sign/.test(q)) {
      return `The correct answer is "${correctText}" because this question is testing whose signature is or is not required on the application.`;
    }

    if (/application/.test(q) && /\binitials\b/.test(q)) {
      return `The correct answer is "${correctText}" because this question is testing whose initials are required for application changes.`;
    }

    if (/goes into effect|before .* policy .* effect|before .* goes into effect/.test(q)) {
      return `The correct answer is "${correctText}" because that item is not required before the policy takes effect.`;
    }

    if (/what action should|producer then take|producer take/.test(q)) {
      return `The correct answer is "${correctText}" because that action follows the underwriting or delivery rule being tested in this scenario.`;
    }

    if (/which statement|which of the following|what is the underlying concept/.test(q)) {
      return `The correct answer is "${correctText}" because that statement is the one that matches the rule being tested.`;
    }

    if (/what item is given|what is issued/.test(q)) {
      return `The correct answer is "${correctText}" because that is the document the applicant or employee receives in this situation.`;
    }

    if (/what type|which type|what kind|which provision|what provision|what policy feature|what policy provision/.test(q)) {
      return `The correct answer is "${correctText}" because that is the contract feature that matches the fact pattern.`;
    }

    if (correctText) {
      return `The better answer here is "${correctText}".`;
    }

    return '';
  },

  isContrastiveFeedback(feedbackText) {
    return /This option incorrectly adds|This option is too restrictive|This option adds a condition|This choice is too absolute|This choice is too broad|This mixes in employee contributions|The number in this choice is off|is the opposite of what the facts show|describes beneficiary order|describes a different event|is not the exception here|is a different provision\. It does not|is a different [a-z- ]+ than the one this question is testing/i.test(String(feedbackText || ''));
  },

  getSelectedMismatchReason(question, optionText, correctText) {
    const q = this.getQuestionPlainText(question).toLowerCase();
    const selected = String(optionText || '').toLowerCase();
    const correct = String(correctText || '').toLowerCase();

    if (this.isExceptionQuestion(question) && optionText) {
      return `"${optionText}" is not the exception here. It is one of the items that is normally true or required.`;
    }

    if (/beneficiar/.test(q) && /(revocable|irrevocable)/.test(`${selected} ${correct}`)) {
      if (/(primary|contingent|tertiary)/.test(selected)) {
        return `"${optionText}" describes beneficiary order, not whether the designation can be changed.`;
      }

      if (/revocable/.test(selected) && /irrevocable/.test(correct)) {
        return `"${optionText}" is the changeable type, so it does not fit a question asking for consent before a change.`;
      }

      if (/irrevocable/.test(selected) && /revocable/.test(correct)) {
        return `"${optionText}" would require the beneficiary's consent, but the facts say the policyowner can change the designation freely.`;
      }
    }

    if (/change a revocable beneficiary|change the beneficiary|change of beneficiary/.test(q)) {
      if (/consent/.test(selected)) {
        return 'This option incorrectly adds a consent requirement.';
      }

      if (/\bnever\b/.test(selected)) {
        return 'This option is too restrictive for the rule being tested.';
      }

      if (/\bonly\b/.test(selected)) {
        return 'This option adds a condition that the rule does not require.';
      }
    }

    if (/noncontributory/.test(`${q} ${correct}`) && /(shared|both employer and employee|employee)/.test(selected)) {
      return 'This mixes in employee contributions, which is the opposite of a noncontributory plan.';
    }

    if (/contributory/.test(`${q} ${correct}`) && /(entire cost|paid for by the employer|only employer)/.test(selected)) {
      return 'This removes the employee contribution that defines a contributory plan.';
    }

    if (/grace period/.test(q) && /(effective|beneficiary|death)/.test(selected)) {
      return `"${optionText}" describes a different event, not the overdue-premium window called the grace period.`;
    }

    if (/reinstat/.test(q) && /(grace period|non[- ]forfeiture)/.test(selected)) {
      return `"${optionText}" is a different provision. It does not restore a lapsed policy.`;
    }

    if (/application/.test(q) && /sign/.test(q) && (/\bexcept\b|\bnot\b/.test(q))) {
      return `"${optionText}" is normally one of the required signatures, so it cannot be the exception.`;
    }

    return '';
  },

  /**
   * @deprecated Use new feedback generation system instead
   * Checks if feedback matches legacy AI-generated patterns
   * @param {string} feedbackText - Feedback text to check
   * @returns {boolean} True if matches legacy pattern
   */
  isLegacyGeneratedFeedback(feedbackText) {
    console.warn('⚠️  isLegacyGeneratedFeedback() is deprecated. Use new feedback system.');
    return /does not fit the key fact this question is testing|stated too absolutely for the facts given|too broad\. Re-check whether|At least one listed option fits the rule better|amount, percentage, or time period in this choice is off|This choice is too absolute\. Re-check whether the facts allow/i.test(String(feedbackText || ''));
  },

  getExplanationReasonCandidates(question) {
    const explanation = String(question?.explanation || '');
    if (!explanation) return [];

    const stepThreeMatch = explanation.match(/Step\s*3\s*:\s*([\s\S]*?)(?=Step\s*4\s*:|$)/i);
    const stepThree = stepThreeMatch?.[1] || explanation;

    return stepThree
      .replace(/^Eliminate distractors using the facts(?: and remove options that conflict with the scenario)?\.?\s*/i, '')
      .split(/\s*;\s*|\.\s+(?=[A-Z"'])/)
      .map((part) => this.toSentence(part))
      .filter((part) => part && part.length > 25);
  },

  getExplanationReasonForOption(question, optionIndex) {
    const optionText = this.getOptionDisplayText(question?.options?.[optionIndex] || '');
    const correctText = this.getOptionDisplayText(question?.options?.[question?.correctAnswer] || '');
    const candidates = this.getExplanationReasonCandidates(question);

    let bestCandidate = '';
    let bestScore = 0;

    candidates.forEach((candidate) => {
      const optionScore = this.getKeywordOverlapScore(candidate, optionText);
      const correctScore = this.getKeywordOverlapScore(candidate, correctText);

      if (optionScore >= 0.34 && optionScore >= correctScore && optionScore > bestScore) {
        bestCandidate = candidate;
        bestScore = optionScore;
      }
    });

    return bestCandidate;
  },

  isWrongAnswerFeedbackReliable(question, optionIndex, feedbackText) {
    const cleaned = this.cleanFeedbackText(feedbackText);
    if (!cleaned) return false;

    if (this.isLegacyGeneratedFeedback(cleaned)) {
      return false;
    }

    if (this.isContrastiveFeedback(cleaned)) {
      if (/not the exception here|normally true or required/i.test(cleaned) && !this.isExceptionQuestion(question)) {
        return false;
      }
      return true;
    }

    if (/step\s*\d|select the best answer|correct answer|option\s+[a-f0-9]\b/i.test(cleaned)) {
      return false;
    }

    const optionText = this.getOptionDisplayText(question?.options?.[optionIndex] || '');
    const correctText = this.getOptionDisplayText(question?.options?.[question?.correctAnswer] || '');
    const optionScore = this.getKeywordOverlapScore(cleaned, optionText);
    const correctScore = this.getKeywordOverlapScore(cleaned, correctText);

    const stronglyAffirmsOutcome = /\b(can pay|will pay|is payable|best answer|therefore|so the answer|select|choose|is correct)\b/i.test(cleaned);
    if (stronglyAffirmsOutcome && correctScore > optionScore + 0.2) {
      return false;
    }

    if (/\bneither\b/i.test(optionText) && /\b(can pay|will pay|is payable)\b/i.test(cleaned)) {
      return false;
    }

    if (/\bnone of the above\b/i.test(optionText) && correctScore > optionScore) {
      return false;
    }

    return true;
  },

  buildWrongAnswerFallback(question, optionIndex) {
    const optionText = this.getOptionDisplayText(question?.options?.[optionIndex] || '');
    const correctText = this.getOptionDisplayText(question?.options?.[question?.correctAnswer] || '');
    const matchedExplanation = this.getExplanationReasonForOption(question, optionIndex);
    const mismatchReason = this.getSelectedMismatchReason(question, optionText, correctText);
    const correctReason = this.getCorrectConceptReason(question, correctText);

    if (matchedExplanation) {
      return matchedExplanation;
    }

    const numberPattern = /\$?\d[\d,]*(?:\.\d+)?%?|\b\d+\s*(?:days?|months?|years?)\b/gi;
    const selectedNumbers = optionText.match(numberPattern) || [];
    const correctNumbers = correctText.match(numberPattern) || [];
    if (selectedNumbers.length > 0 && correctNumbers.length > 0 && selectedNumbers.join('|') !== correctNumbers.join('|')) {
      return correctText
        ? `The number in this choice is off. The correct answer is "${correctText}".`
        : 'The number in this choice is off. Re-check the calculation or eligibility threshold.';
    }

    if (mismatchReason) {
      return correctReason ? `${mismatchReason} ${correctReason}` : mismatchReason;
    }

    if (/\bneither\b/i.test(optionText)) {
      return correctReason
        ? `This choice is too absolute. ${correctReason}`
        : 'This choice is too absolute. At least one listed outcome can still apply under these facts.';
    }

    if (/\bboth\b|\ball of the above\b/i.test(optionText)) {
      return correctReason
        ? `This choice is too broad. ${correctReason}`
        : 'This choice is too broad. The facts support one specific outcome, not every listed statement.';
    }

    if (/\bnone of the above\b/i.test(optionText)) {
      return correctReason
        ? `This choice is too broad. ${correctReason}`
        : 'This choice is too broad because at least one listed option does fit the rule here.';
    }

    if (/\b(always|never|only|must|cannot|can\'t|all)\b/i.test(optionText)) {
      return correctReason
        ? `This choice is too absolute for the facts given. ${correctReason}`
        : 'This choice is too absolute for the facts given. Re-check whether the rule really applies that broadly.';
    }

    if (this.isExceptionQuestion(question) && correctReason) {
      return `${correctReason} This question is asking for the exception.`;
    }

    const conceptLabel = this.getConceptLabel(question, optionText, correctText);
    const optionPreview = optionText.length > 96 ? `${optionText.slice(0, 93).trim()}...` : optionText;
    if (correctReason) {
      return `"${optionPreview}" is a different ${conceptLabel} than the one this question is testing. ${correctReason}`;
    }

    return `"${optionPreview}" is not the best fit for this question. Re-check the key fact the answer is testing.`;
  },

  hasPrefixedOptionLabels(questions = []) {
    return questions.some((question) =>
      Array.isArray(question?.options) &&
      question.options.some((option) =>
        typeof option === 'string' &&
        /^\s*(?:\(?\s*[A-Fa-f1-6]\s*\)?\s*[.).:\-]?)\s+/.test(option)
      )
    );
  },

  // Log Wrong Answer
  logWrongAnswer(question) {
    if (!question) return;
    const topicId = question.__sourceTopicId || this.state.currentTopic?.id || 'unknown-topic';
    const testId = question.__sourceTestId || this.state.currentPracticeTest?.id || 'unknown-test';
    const key = `${topicId}|${testId}|${question.id}`;
    if (!this.state.wrongQuestions.some(q => q.key === key)) {
      this.state.wrongQuestions.push({
        key,
        topicId,
        testId,
        questionId: question.id,
        timestamp: new Date().toISOString()
      });
      this.saveWrongQuestions();
    }
  },

  loadWrongQuestions() {
    const data = this.readJSONFromStorage('wrong_questions', []);
    const list = Array.isArray(data) ? data : [];

    const normalized = [];
    const seen = new Set();

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;

      const topicId = item.topicId || 'unknown-topic';
      const testId = item.testId || 'unknown-test';
      const questionId = item.questionId;

      if (typeof questionId === 'undefined' || questionId === null) continue;

      const key = item.key || `${topicId}|${testId}|${questionId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      normalized.push({
        key,
        topicId,
        testId,
        questionId,
        timestamp: item.timestamp || new Date().toISOString()
      });
    }

    this.state.wrongQuestions = normalized;
    this.saveWrongQuestions();
  },

  saveWrongQuestions() {
    localStorage.setItem('wrong_questions', JSON.stringify(this.state.wrongQuestions));
    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }
  },

  readJSONFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`Invalid localStorage data for ${key}; resetting entry.`, error);
      localStorage.removeItem(key);
      return fallback;
    }
  },

  isQuotaExceededError(error) {
    return Boolean(
      error && (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.code === 22 ||
        error.code === 1014
      )
    );
  },

  /**
   * @deprecated Use modern localStorage management
   * Compacts legacy shuffle cache to free up storage space
   * Removes old/invalid shuffle entries from localStorage
   */
  compactLegacyShuffleCaches() {
    console.warn('⚠️  compactLegacyShuffleCaches() is deprecated. Use new cache system.');
    const shuffleKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith('shuffle_')) {
        shuffleKeys.push(key);
      }
    }

    shuffleKeys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (parsed && parsed.layout && Array.isArray(parsed.layout.questionOrder)) {
          return;
        }

        const legacyQuestions = Array.isArray(parsed)
          ? parsed
          : (parsed && Array.isArray(parsed.questions) ? parsed.questions : null);
        if (!legacyQuestions) return;

        localStorage.setItem(key, JSON.stringify({
          version: typeof parsed?.version === 'string' ? parsed.version : this.shuffleSchemaVersion,
          signature: typeof parsed?.signature === 'string' ? parsed.signature : null,
          layout: this.buildQuestionLayoutSnapshot(legacyQuestions)
        }));
      } catch (error) {
        console.warn(`Unable to compact shuffle cache ${key}; removing it.`, error);
        localStorage.removeItem(key);
      }
    });
  },

  pruneShuffleCaches() {
    const shuffleKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith('shuffle_')) {
        shuffleKeys.push(key);
      }
    }

    shuffleKeys.forEach((key) => localStorage.removeItem(key));
  },

  setStorageItemWithRecovery(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      if (!this.isQuotaExceededError(error)) {
        console.warn(`Failed to write localStorage key ${key}.`, error);
        return false;
      }
    }

    try {
      this.compactLegacyShuffleCaches();
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      if (!this.isQuotaExceededError(error)) {
        console.warn(`Failed to recover storage while writing ${key}.`, error);
        return false;
      }
    }

    try {
      this.pruneShuffleCaches();
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`Unable to persist localStorage key ${key} after cache cleanup.`, error);
      return false;
    }
  },

  showToast(message, type = 'info', title = '', durationMs = 2600) {
    const root = document.getElementById('toast-root');
    if (!root || !message) return;

    const toast = document.createElement('div');
    toast.className = `toast is-${type}`;

    const resolvedTitle = title || {
      info: 'Notice',
      success: 'Done',
      warning: 'Heads up',
      error: 'Problem'
    }[type] || 'Notice';

    toast.innerHTML = `
      <div class="toast-title">${this.escapeHtml(resolvedTitle)}</div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
    `;

    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 220);
    }, Number.isFinite(durationMs) ? durationMs : 2600);
  },

  beginLoading(message = 'Loading...') {
    this.state.loadingCount += 1;
    const overlay = document.getElementById('app-loading');
    const text = document.getElementById('app-loading-text');
    if (text) text.textContent = message;
    if (overlay) {
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');
    }
  },

  endLoading() {
    this.state.loadingCount = Math.max(0, this.state.loadingCount - 1);
    if (this.state.loadingCount > 0) return;

    const overlay = document.getElementById('app-loading');
    if (overlay) {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
  },

  getTopicPracticeUnits(topic) {
    if (!topic?.practiceTests) return [];

    return topic.practiceTests.flatMap((test) => {
      if (Array.isArray(test.subTests) && test.subTests.length > 0) {
        return test.subTests;
      }
      return [test];
    });
  },

  findPracticeTestById(topic, testId) {
    if (!topic || !testId) return null;

    return topic.practiceTests?.find((test) => test.id === testId)
      || this.getTopicPracticeUnits(topic).find((test) => test.id === testId)
      || null;
  },

  getQuestionStateKey(question) {
    if (!question) return null;
    return question.__stateKey || String(question.id);
  },

  getWrongEntryKey(question) {
    if (!question) return null;
    if (question.__wrongKey) return question.__wrongKey;

    const topicId = question.__sourceTopicId || this.state.currentTopic?.id;
    const testId = question.__sourceTestId || this.state.currentPracticeTest?.id;
    if (!topicId || !testId || typeof question.id === 'undefined') return null;

    return `${topicId}|${testId}|${question.id}`;
  },

  removeFromWrongQuestions(questionOrKey) {
    const key = typeof questionOrKey === 'string'
      ? questionOrKey
      : this.getWrongEntryKey(questionOrKey);

    if (!key) return;
    this.state.wrongQuestions = this.state.wrongQuestions.filter((q) => q.key !== key);
    this.saveWrongQuestions();
    this.updateWrongQuestionsCount();
  },

  // Start Wrong Questions Review
  async startWrongQuestionsReview() {
    if (this.state.wrongQuestions.length === 0) {
      this.showToast('No wrong answers to review yet. Keep practicing!', 'info');
      return;
    }

    // Load all wrong questions from different topics/tests
    const wrongQuestionsToReview = [];
    const retainedWrongEntries = [];
    
    this.beginLoading('Loading wrong-answer review...');
    try {
      for (const wrongQ of this.state.wrongQuestions) {
        const topic = this.state.topics.find(t => t.id === wrongQ.topicId);
        if (!topic) continue;

        const test = this.findPracticeTestById(topic, wrongQ.testId);
        if (!test) continue;

        try {
          const response = await fetch(test.dataFile);
          const data = await response.json();
          const question = data.questions.find(q => q.id === wrongQ.questionId);

          if (question) {
            retainedWrongEntries.push(wrongQ);
            wrongQuestionsToReview.push({
              ...question,
              __stateKey: wrongQ.key,
              __wrongKey: wrongQ.key,
              __sourceTopicId: wrongQ.topicId,
              __sourceTestId: wrongQ.testId,
              topicName: topic.name,
              testName: test.name
            });
          }
        } catch (error) {
          console.error('Error loading question:', error);
        }
      }

      if (retainedWrongEntries.length !== this.state.wrongQuestions.length) {
        this.state.wrongQuestions = retainedWrongEntries;
        this.saveWrongQuestions();
        this.updateWrongQuestionsCount();
      }
    } finally {
      this.endLoading();
    }

    if (wrongQuestionsToReview.length === 0) {
      this.showToast('Could not load wrong questions. They may have been deleted.', 'warning');
      return;
    }

    this.stopQuestionTimer();
    this.state.questionElapsedMs = {};
    this.resetAdvanceTapState();

    // Set up review mode
    this.state.questions = wrongQuestionsToReview;
    this.state.loadedQuestionSetId = 'review-mode';
    this.state.loadedQuestionSourceSignature = '';
    this.state.currentQuestionIndex = 0;
    this.state.filterMode = 'all';
    this.state.currentTopic = { name: 'Wrong Answers Review', icon: '❌' };
    this.state.currentPracticeTest = { name: 'Review Mode' };
    this.state.isReviewMode = true;
    
    // Don't track progress for review mode
    this.state.viewedQuestions = new Set();
    this.state.bookmarkedQuestions = new Set();
    this.state.answersRevealed = new Set();
    this.state.attemptedOptions = {};
    this.state.firstAttemptCorrect = {};
    this.state.lastSelectedIndex = undefined;
    this.state.lastSelectedQuestionKey = null;
    
    this.showView('mcq');
    this.renderQuestion();
  },

  // Clear Wrong Questions History
  clearWrongQuestions() {
    if (!confirm('Are you sure you want to clear all wrong answers history? This cannot be undone.')) {
      return;
    }
    this.state.wrongQuestions = [];
    this.saveWrongQuestions();
    this.updateWrongQuestionsCount();

    if (this.state.isReviewMode) {
      this.state.isReviewMode = false;
      this.showView('home');
    }

    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }

    this.showToast('Wrong answers history cleared.', 'success');
  },

  // Initialize Application
  async init() {
    console.log('🚀 Initializing MCQ App...');
    this.initDarkMode();
    this.initSpeech();
    this.registerServiceWorker();
    this.beginLoading('Loading topics...');
    try {
      await this.loadTopics();
      await this.checkAIAvailability();
      if (typeof this.initAuth === 'function') {
        await this.initAuth();
      }
      this.loadWrongQuestions();
    } finally {
      this.endLoading();
    }
    this.setupEventListeners();
    this.initHeatmapTracking();
    this.renderTopicsGrid();
    this.renderVersionChip();
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(this.buildNavigationState('home'), '', window.location.href);
    }
    console.log('✅ App initialized successfully');
  },

  // Initialize Speech Synthesis (Accessibility)
  initSpeech() {
    this.state.speechSupported = 'speechSynthesis' in window;
    const btn = document.getElementById('read-question-btn');
    if (btn) {
      if (!this.state.speechSupported) {
        btn.style.display = 'none';
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }
    }
  },

  // Register Service Worker (PWA)
  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

    // Local development: disable SW to avoid cache/update issues with PDFs and rapid edits.
    if (isLocalhost) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch(() => {});
      return;
    }

    window.addEventListener('load', () => {
      let refreshing = false;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      navigator.serviceWorker
        .register(`/sw.js?v=${this.appBuildVersion}`)
        .then((registration) => {
          // Proactively check for updates each load/session
          registration.update();

          const tryActivateWaitingWorker = () => {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          };

          tryActivateWaitingWorker();

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              // If there's already a controlling SW, this is an update.
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                tryActivateWaitingWorker();
              }
            });
          });
        })
        .catch((error) => {
          console.warn('Service worker registration failed:', error);
        });
    });
  },

  // Initialize Dark Mode
  initDarkMode() {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    this.updateDarkModeIcon('dark');
  },

  // Toggle Dark Mode
  toggleDarkMode() {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    this.updateDarkModeIcon('dark');
    this.showToast('Dark mode is locked for now so the study screens stay readable.', 'info');
  },

  // Update Dark Mode Icon
  updateDarkModeIcon(theme) {
    const toggleBtn = document.getElementById('dark-mode-toggle');
    theme = 'dark';
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-disabled', 'true');
      toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
      toggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  },

  // Load Topics Configuration
  async loadTopics() {
    try {
      const response = await fetch('data/topics.json?v=20260316e', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load topics (${response.status})`);
      }
      const data = await response.json();
      this.state.topics = data.topics;
    } catch (error) {
      console.error('Error loading topics:', error);
      this.state.topics = [];
      this.showToast('Unable to load topics right now.', 'error');
    }
  },

  // Setup Event Listeners
  setupEventListeners() {
    // Dark mode toggle
    document.getElementById('dark-mode-toggle')?.addEventListener('click', () => {
      this.toggleDarkMode();
    });

    // Read question aloud - use bind to preserve 'this' context
    const readBtn = document.getElementById('read-question-btn');
    if (readBtn) {
      readBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Read button clicked', {
          supported: this.state.speechSupported,
          speaking: window.speechSynthesis?.speaking,
          pending: window.speechSynthesis?.pending
        });
        if (!this.state.speechSupported) {
          console.warn('Speech synthesis not supported');
          return;
        }
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          this.stopSpeech();
          return;
        }
        this.speakCurrentQuestion();
      });
    }

    // Back to topics button from practice test selection
    document.getElementById('back-to-topics-btn')?.addEventListener('click', () => {
      if (this.state.practiceTestParent) {
        this.state.practiceTestParent = null;
        this.state.currentPracticeTest = null;
        this.renderPracticeTests();
        return;
      }
      if (this.state.lifeSection) {
        this.state.lifeSection = null;
        this.renderPracticeTests();
        return;
      }
      this.showView('home');
    });

    // PDF viewer controls
    document.getElementById('pdf-back-btn')?.addEventListener('click', () => {
      const frame = document.getElementById('pdf-frame');
      if (frame) frame.src = 'about:blank';
      this.revokePdfObjectUrl();
      this.showView('practice-test');
    });

    document.getElementById('pdf-open-new-tab-btn')?.addEventListener('click', () => {
      const file = this.state.currentPdfResource?.dataFile || this.state.currentPdfObjectUrl;
      if (!file) return;
      window.open(file, '_blank');
    });

    document.getElementById('pdf-download-btn')?.addEventListener('click', () => {
      const file = this.state.currentPdfResource?.dataFile;
      if (!file) return;
      const link = document.createElement('a');
      link.href = file;
      link.download = (this.state.currentPdfResource?.name || 'manual').replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    // Back button from MCQ view
    document.getElementById('back-btn')?.addEventListener('click', () => {
      if (this.state.isReviewMode) {
        this.state.isReviewMode = false;
        this.showView('home');
        return;
      }
      this.showView('practice-test');
    });

    // Navigation buttons
    document.getElementById('prev-question-btn')?.addEventListener('click', () => {
      this.navigateQuestion(-1);
    });

    document.getElementById('next-question-btn')?.addEventListener('click', () => {
      this.navigateQuestion(1);
    });

    // Next question button (top, before explanation)
    document.getElementById('next-question-btn-top')?.addEventListener('click', () => {
      this.navigateQuestion(1);
    });

    // Hide answer button
    document.getElementById('hide-answer-btn')?.addEventListener('click', () => {
      this.hideAnswer();
    });

    // Bookmark button
    document.getElementById('bookmark-btn')?.addEventListener('click', () => {
      this.toggleBookmark();
    });

    // Action buttons
    document.getElementById('show-all-btn')?.addEventListener('click', () => {
      this.showAllQuestions();
    });

    document.getElementById('bookmarked-only-btn')?.addEventListener('click', () => {
      this.toggleFilterMode();
    });

    document.getElementById('reset-progress-btn')?.addEventListener('click', () => {
      this.resetProgress();
    });

    // Back to MCQ from list view
    document.getElementById('back-to-mcq-btn')?.addEventListener('click', () => {
      this.showView('mcq');
    });

    // Clear wrong questions
    document.getElementById('clear-wrong-btn')?.addEventListener('click', () => {
      this.clearWrongQuestions();
    });

    // Finish banner buttons
    document.getElementById('finish-home-btn')?.addEventListener('click', () => {
      if (this.state.isReviewMode) {
        this.state.isReviewMode = false;
      }
      this.showView('home');
    });
    document.getElementById('finish-tests-btn')?.addEventListener('click', () => {
      if (this.state.isReviewMode) {
        this.state.isReviewMode = false;
        this.showView('home');
        return;
      }
      this.showView('practice-test');
    });
    document.getElementById('finish-retry-btn')?.addEventListener('click', () => {
      this.retryCurrentTest();
    });

    const mcqView = document.getElementById('mcq-view');
    if (mcqView) {
      mcqView.addEventListener('touchstart', (event) => this.handleMcqTouchStart(event), { passive: true });
      mcqView.addEventListener('touchend', (event) => this.handleMcqTouchEnd(event), { passive: false });
      mcqView.addEventListener('dblclick', (event) => this.triggerDoubleTapNext(event));
    }

    if (typeof this.setupAuthEventListeners === 'function') {
      this.setupAuthEventListeners();
    }
    if (typeof this.consumePendingPasswordResetLink === 'function') {
      this.consumePendingPasswordResetLink();
    }

    window.addEventListener('online', () => {
      if (typeof this.syncProgressToCloud === 'function') {
        this.syncProgressToCloud({ silent: true, force: false });
      }
    });

    window.addEventListener('pagehide', () => {
      if (this.state.currentView === 'mcq' && !this.state.isReviewMode) {
        this.saveProgress();
      }
      this.syncNavigationState('replace');
    });

    window.addEventListener('popstate', async (event) => {
      const navState = event.state;
      if (!navState?.view) return;

      this.restoreNavigationState(navState);

      if (navState.view === 'mcq') {
        const restored = await this.ensureCurrentPracticeTestQuestionsLoaded({ showLoading: false });
        if (this.state.currentTopic && this.state.currentPracticeTest) {
          this.loadProgress();
          this.applyNavigationSessionState(navState);
        }

        if (!restored || !this.getCurrentQuestion()) {
          this.showView('practice-test', { updateHistory: false });
          this.showToast('We restored the test list. Open the quiz again to continue.', 'warning');
          return;
        }

        this.showView('mcq', { updateHistory: false });
        this.renderQuestion();
        return;
      }

      this.showView(navState.view, { updateHistory: false });
    });
  },

  // Update Wrong Questions Count
  updateWrongQuestionsCount() {
    const badge = document.getElementById('wrong-count-badge');
    const section = document.getElementById('wrong-questions-section');
    
    if (badge) {
      badge.textContent = this.state.wrongQuestions.length;
    }
    
    if (section) {
      if (this.state.wrongQuestions.length === 0) {
        section.style.display = 'none';
      } else {
        section.style.display = 'block';
      }
    }

    this.renderHomeFocus();
    this.renderHomeInsights();
  },

  getDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getDailyStudyStats() {
    const defaultStats = {
      date: this.getDateKey(),
      todayAnswered: 0,
      streak: 0,
      lastActiveDate: null,
      dailyHistory: {},
      xpTotal: 0
    };

    const stats = this.readJSONFromStorage('study_daily_stats', defaultStats) || defaultStats;
    const today = this.getDateKey();

    if (stats.date !== today) {
      stats.date = today;
      stats.todayAnswered = 0;
    }

    stats.dailyHistory = stats.dailyHistory || {};
    stats.xpTotal = Number(stats.xpTotal || 0);

    return stats;
  },

  saveDailyStudyStats(stats) {
    if (!stats) return;
    localStorage.setItem('study_daily_stats', JSON.stringify(stats));
    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }
  },

  recordDailyPractice(isCorrect = false) {
    const stats = this.getDailyStudyStats();
    const today = this.getDateKey();

    if (stats.date !== today) {
      stats.date = today;
      stats.todayAnswered = 0;
    }

    stats.todayAnswered += 1;
    stats.dailyHistory[today] = Number(stats.dailyHistory[today] || 0) + 1;
    stats.xpTotal += 10 + (isCorrect ? 5 : 0);

    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 120);
    const minDateKey = this.getDateKey(minDate);
    Object.keys(stats.dailyHistory).forEach((key) => {
      if (key < minDateKey) delete stats.dailyHistory[key];
    });

    if (stats.lastActiveDate !== today) {
      if (stats.lastActiveDate) {
        const last = new Date(`${stats.lastActiveDate}T00:00:00`);
        const now = new Date(`${today}T00:00:00`);
        const dayDiff = Math.round((now - last) / 86400000);
        stats.streak = dayDiff === 1 ? (Number(stats.streak || 0) + 1) : 1;
      } else {
        stats.streak = 1;
      }
      stats.lastActiveDate = today;
    }

    this.saveDailyStudyStats(stats);
  },

  getHeatmapCells(days = 7) {
    const stats = this.getDailyStudyStats();
    const history = stats.dailyHistory || {};
    const cells = [];

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = this.getDateKey(date);
      const count = Number(history[key] || 0);
      const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;

      cells.push({
        key,
        count,
        level,
        shortDay: date.toLocaleDateString(undefined, { weekday: 'short' })
      });
    }

    return cells;
  },

  getXpLevel(stats = this.getDailyStudyStats()) {
    const xpTotal = Number(stats.xpTotal || 0);
    const perLevel = 200;
    const level = Math.floor(xpTotal / perLevel) + 1;
    const currentXp = xpTotal % perLevel;
    const pct = Math.round((currentXp / perLevel) * 100);
    return { xpTotal, level, currentXp, perLevel, pct };
  },

  getHomeTopicRank(topicId) {
    const preferredOrder = {
      'llqp-life': 1,
      'llqp-accident': 2,
      'llqp-segregated': 3,
      'llqp-ethics': 4
    };
    return preferredOrder[topicId] || 99;
  },

  isCompactHomeTopic(topicId) {
    return ['llqp-life', 'llqp-accident', 'llqp-segregated', 'llqp-ethics'].includes(topicId);
  },

  getActivePracticeUnits() {
    return this.state.topics.flatMap((topic) => {
      const topicUnits = this.getTopicPracticeUnits(topic) || [];
      return topicUnits
        .filter((test) => test && test.status !== 'coming-soon' && Number(test.questionCount || 0) > 0)
        .map((test) => ({ topic, test }));
    });
  },

  getHomeStudyStats() {
    const units = this.getActivePracticeUnits();
    const totalCourses = units.length;
    let completedCourses = 0;
    let totalQuestions = 0;
    let totalAnswered = 0;

    units.forEach(({ topic, test }) => {
      const questions = Number(test.questionCount || 0);
      const progressKey = `progress_${topic.id}_${test.id}`;
      const saved = this.readJSONFromStorage(progressKey, null);
      const answered = Math.min((saved?.revealed || []).length, questions);

      totalQuestions += questions;
      totalAnswered += answered;
      if (questions > 0 && answered >= questions) {
        completedCourses += 1;
      }
    });

    const overallProgress = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;
    return { totalCourses, completedCourses, totalQuestions, overallProgress };
  },

  getRecommendedPracticeUnit() {
    const units = this.getActivePracticeUnits();
    if (!units.length) return null;

    const enriched = units
      .map(({ topic, test }) => ({
        topic,
        test,
        progress: this.getPracticeTestProgress(topic.id, test.id)
      }))
      .filter((item) => item.progress < 100);

    if (!enriched.length) return null;

    const inProgress = enriched
      .filter((item) => item.progress > 0)
      .sort((a, b) => b.progress - a.progress);

    if (inProgress.length) return inProgress[0];

    return enriched.sort((a, b) => {
      const rankDiff = this.getHomeTopicRank(a.topic.id) - this.getHomeTopicRank(b.topic.id);
      if (rankDiff !== 0) return rankDiff;
      return (a.test.name || '').localeCompare(b.test.name || '');
    })[0];
  },

  async startRecommendedPractice() {
    const rec = this.getRecommendedPracticeUnit();
    if (!rec) {
      this.showToast('Great work — no recommended test right now.', 'success');
      return;
    }

    this.saveLastSession(rec.topic.id, rec.test.id);
    await this.resumeLastSession();
  },

  getSessionTarget(topicId, testId) {
    if (!topicId || !testId) return null;

    const topic = this.state.topics.find((t) => t.id === topicId);
    if (!topic) return null;

    const directTest = topic.practiceTests?.find((t) => t.id === testId);
    if (directTest) {
      return { topic, test: directTest, parentTest: null };
    }

    const parentTest = topic.practiceTests?.find((t) =>
      Array.isArray(t.subTests) && t.subTests.some((sub) => sub.id === testId)
    );
    const subTest = parentTest?.subTests?.find((sub) => sub.id === testId);
    if (parentTest && subTest) {
      return { topic, test: subTest, parentTest };
    }

    return null;
  },

  getLastSession() {
    const session = this.readJSONFromStorage('last_session', null);
    if (!session?.topicId || !session?.testId) return null;

    return this.getSessionTarget(session.topicId, session.testId);
  },

  getNextIncompletePracticeUnit(topic, currentTestId = null) {
    if (!topic) return null;

    const units = this.getTopicPracticeUnits(topic)
      .filter((test) => test && test.status !== 'coming-soon' && Number(test.questionCount || 0) > 0);
    if (!units.length) return null;

    const currentIndex = currentTestId
      ? units.findIndex((test) => test.id === currentTestId)
      : -1;
    const orderedCandidates = currentIndex >= 0
      ? [...units.slice(currentIndex + 1), ...units.slice(0, currentIndex)]
      : units;

    return orderedCandidates.find((test) =>
      this.getPracticeTestProgress(topic.id, test.id) < 100
    ) || null;
  },

  getContinueSession() {
    const session = this.getLastSession();
    if (!session) return null;

    if (this.getPracticeTestProgress(session.topic.id, session.test.id) < 100) {
      return session;
    }

    const nextTest = this.getNextIncompletePracticeUnit(session.topic, session.test.id);
    return nextTest ? this.getSessionTarget(session.topic.id, nextTest.id) : null;
  },

  saveLastSession(topicId, testId) {
    if (!topicId || !testId) return;
    localStorage.setItem('last_session', JSON.stringify({
      topicId,
      testId,
      updatedAt: new Date().toISOString()
    }));
    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }
  },

  async resumeLastSession() {
    const storedSession = this.getLastSession();
    const session = this.getContinueSession();
    if (!session) {
      if (storedSession) {
        this.showToast('Your last saved section is already complete. Choose the next course from the list.', 'info');
        return;
      }
      this.showToast('No saved session found yet. Start a test first.', 'info');
      return;
    }

    const { topic, test, parentTest } = session;
    if (!storedSession || storedSession.topic.id !== topic.id || storedSession.test.id !== test.id) {
      this.saveLastSession(topic.id, test.id);
    }
    this.state.currentTopic = topic;
    this.state.lifeSection = null;
    this.state.practiceTestParent = null;
    this.state.currentPracticeTest = null;

    if (parentTest) {
      await this.selectSubPracticeTest(parentTest.id, test.id);
      return;
    }

    await this.selectPracticeTest(test.id);
  },

  toggleHomeInsights() {
    this.state.homeInsightsExpanded = !this.state.homeInsightsExpanded;
    localStorage.setItem('home-insights-expanded', String(this.state.homeInsightsExpanded));
    this.renderHomeInsights();
  },

  getHomeFocusStats(stats = this.getHomeStudyStats(), daily = this.getDailyStudyStats()) {
    return [
      {
        label: 'Questions Today',
        value: String(Number(daily?.todayAnswered || 0))
      },
      {
        label: 'Study Streak',
        value: `${Number(daily?.streak || 0)}d`
      },
      {
        label: 'Overall Progress',
        value: `${Number(stats?.overallProgress || 0)}%`
      }
    ];
  },

  renderHomeFocus() {
    const host = document.getElementById('home-focus');
    if (!host) return;

    const stats = this.getHomeStudyStats();
    const storedSession = this.getLastSession();
    const session = this.getContinueSession();
    const daily = this.getDailyStudyStats();
    const recommended = this.getRecommendedPracticeUnit();
    const wrongCount = this.state.wrongQuestions.length;
    const promotedSession = session && storedSession &&
      (session.topic.id !== storedSession.topic.id || session.test.id !== storedSession.test.id);
    const focusStats = this.getHomeFocusStats(stats, daily);

    let title = 'Pick a topic and start.';
    let meta = `${stats.totalCourses} topics ready`;
    let primaryLabel = 'Browse topics';
    let primaryAction = "document.getElementById('topics-grid').scrollIntoView({ behavior: 'smooth', block: 'start' })";

    if (session) {
      title = `${session.topic.name}: ${session.test.name}`;
      meta = promotedSession ? 'Next section ready' : 'Continue where you left off';
      primaryLabel = 'Continue';
      primaryAction = 'MCQApp.resumeLastSession()';
    } else if (recommended) {
      title = `${recommended.topic.name}: ${recommended.test.name}`;
      meta = `${recommended.progress}% complete`;
      primaryLabel = 'Continue';
      primaryAction = 'MCQApp.startRecommendedPractice()';
    }

    host.innerHTML = `
      <div class="focus-card">
        <div class="focus-copy">
          <div class="focus-label">${session ? 'Continue' : 'Daily study'}</div>
          <h2 class="focus-title">${this.escapeHtml(title)}</h2>
          <p class="focus-meta">${this.escapeHtml(meta)}</p>
          <div class="focus-actions">
            <button class="btn-primary focus-btn" type="button" onclick="${primaryAction}">${this.escapeHtml(primaryLabel)}</button>
            ${wrongCount > 0 ? `
              <button class="btn-outline focus-btn-secondary" type="button" onclick="MCQApp.startWrongQuestionsReview()">Review wrong (${wrongCount})</button>
            ` : ''}
          </div>
        </div>
        <div class="focus-stats">
          ${focusStats.map((item) => `
            <div class="focus-stat">
              <span>${this.escapeHtml(item.label)}</span>
              <strong>${this.escapeHtml(item.value)}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderHomeInsights() {
    const host = document.getElementById('home-insights');
    if (!host) return;
    host.innerHTML = '';
  },

  // Render Topics Grid
  renderTopicsGrid() {
    this.updateWrongQuestionsCount();
    if (typeof this.renderAuthPanel === 'function') {
      this.renderAuthPanel();
    }
    this.renderHomeFocus();
    const grid = document.getElementById('topics-grid');
    if (!grid) return;

    const topics = [...this.state.topics].sort((a, b) => {
      const rankDiff = this.getHomeTopicRank(a.id) - this.getHomeTopicRank(b.id);
      if (rankDiff !== 0) return rankDiff;

      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    grid.innerHTML = topics.map(topic => {
      const progress = this.getTopicProgress(topic.id);
      const isActive = topic.status === 'active';
      const isCompact = this.isCompactHomeTopic(topic.id);
      const totalQuestions = topic.practiceTests?.reduce((sum, test) => sum + test.questionCount, 0) || 0;
      const safeColor = this.escapeHtml(this.getSafeThemeColor(topic.color));
      const selectTopicCall = this.getInlineActionCall('MCQApp.selectTopic', topic.id);
      
      return `
        <div class="topic-card topic-list-item ${isCompact ? 'compact-topic' : ''} ${!isActive ? 'coming-soon' : ''}" 
             ${isActive ? `onclick="${selectTopicCall}"` : ''}
             style="--topic-color: ${safeColor}">
          <div class="topic-card-top">
            <div class="topic-icon">${this.escapeHtml(topic.icon)}</div>
          </div>
          <div class="topic-list-copy">
            <h3 class="topic-name">${this.escapeHtml(topic.name)}</h3>
            <p class="topic-description">${this.escapeHtml(topic.description)}</p>
            <div class="topic-meta">
              <span class="question-count">
                ${totalQuestions} Question${totalQuestions !== 1 ? 's' : ''}
              </span>
              ${isActive && progress > 0 ? `
                <span class="progress-badge">${progress}% Complete</span>
              ` : ''}
              ${!isActive ? `
                <span class="coming-soon-badge">Coming Soon</span>
              ` : ''}
            </div>
          </div>
          <div class="topic-list-action">
            ${isActive ? `
              <span class="topic-chevron" aria-hidden="true">&#8250;</span>
            ` : `
              <span class="topic-status-muted">Soon</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  },

  // Select Topic and Show Practice Tests
  async selectTopic(topicId) {
    const topic = this.state.topics.find(t => t.id === topicId);
    if (!topic) return;
    
    this.state.currentTopic = topic;
    this.state.lifeSection = null;
    this.state.practiceTestParent = null;
    this.state.currentPracticeTest = null;
    this.showView('practice-test');
    this.renderPracticeTests();
  },

  renderSubPracticeTests(parentTest) {
    const topic = this.state.currentTopic;
    const grid = document.getElementById('practice-tests-grid');
    const description = document.getElementById('practice-description');
    if (!topic || !grid || !parentTest) return;

    if (description) {
      description.textContent = parentTest.description;
    }

    const items = parentTest.subTests || [];
    grid.classList.remove('catalog-list', 'catalog-tiles');

    grid.innerHTML = `
      <div class="catalog-shell" style="--topic-color: ${this.escapeHtml(this.getSafeThemeColor(topic.color))}">
        <div class="catalog-breadcrumb">${this.escapeHtml(topic.name)} / Chapter Quizzes / ${this.escapeHtml(parentTest.name)}</div>
        <h3 class="catalog-heading">${this.escapeHtml(parentTest.name)}</h3>
        <p class="muted-text">Choose a smaller section below.</p>
        <button class="btn-outline" onclick="${this.getInlineActionCall('MCQApp.backToPracticeTests')}" style="margin-bottom:.75rem;">
          ← Back to Chapter Quizzes
        </button>

        <div class="catalog-courses is-list">
          ${items.map((test, index) => {
            const testProgress = this.getPracticeTestProgress(topic.id, test.id);
            return `
              <div class="practice-test-card"
                   onclick="${this.getInlineActionCall('MCQApp.selectSubPracticeTest', parentTest.id, test.id)}"
                   style="--topic-color: ${this.escapeHtml(this.getSafeThemeColor(topic.color))}">
                <div class="test-number">${index + 1}</div>
                <h3 class="test-name">${this.escapeHtml(test.name)}</h3>
                <p class="test-description">${this.escapeHtml(test.description)}</p>
                <div class="test-meta">
                  <span class="question-count">
                    📝 ${test.questionCount} Question${test.questionCount !== 1 ? 's' : ''}
                  </span>
                  ${testProgress > 0 ? `<span class="progress-badge">${testProgress}% Complete</span>` : ''}
                </div>
                <button class="btn-start-test">Open Section →</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  backToPracticeTests() {
    this.state.practiceTestParent = null;
    this.state.currentPracticeTest = null;
    this.renderPracticeTests();
  },

  async selectSubPracticeTest(parentTestId, subTestId) {
    const topic = this.state.currentTopic;
    if (!topic) return;

    const parentTest = topic.practiceTests.find(t => t.id === parentTestId);
    const practiceTest = parentTest?.subTests?.find(t => t.id === subTestId);
    if (!parentTest || !practiceTest) return;

    this.state.practiceTestParent = parentTest;

    this.beginLoading('Loading section...');
    try {
      await this.loadQuestions(practiceTest.dataFile, practiceTest.id);
    } finally {
      this.endLoading();
    }
    if (this.state.questions.length === 0) {
      this.showToast('No questions available for this section yet.', 'warning');
      return;
    }

    this.state.currentPracticeTest = practiceTest;
    this.saveLastSession(topic.id, practiceTest.id);
    this.state.currentQuestionIndex = 0;
    this.state.filterMode = 'all';
    this.state.isReviewMode = false;
    this.state.attemptedOptions = {};
    this.state.firstAttemptCorrect = {};
    this.state.lastSelectedIndex = undefined;
    this.state.lastSelectedQuestionKey = null;
    this.loadProgress();
    this.showView('mcq');
    this.renderQuestion();
  },

  shouldUseSectionedCatalog(topic) {
    const sectionedTopicIds = new Set([
      'llqp-life',
      'llqp-ethics',
      'llqp-accident',
      'llqp-segregated'
    ]);
    return sectionedTopicIds.has(topic?.id);
  },

  getLifeSections(topic) {
    const tests = topic?.practiceTests || [];

    // Guard against accidental duplicate entries in topic data.
    const seen = new Set();
    const uniqueTests = tests.filter((test) => {
      const key = test?.id || test?.dataFile || test?.name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const sections = [
      {
        id: 'chapter-quizzes',
        title: 'Chapter Quizzes',
        description: 'All chapter quiz courses'
      },
      {
        id: 'practice-provincial-exam',
        title: 'Practice Provincial Exam',
        description: 'Provincial exam-style practice'
      },
      {
        id: 'practice-mcqs',
        title: 'Practice MCQs',
        description: 'General practice MCQ sets'
      },
      {
        id: 'cisro-manuals',
        title: 'CISRO Manuals',
        description: 'Manual and reference material'
      },
      {
        id: 'practice-certification-exam',
        title: 'Practice Certification Exam',
        description: 'Only do this before certification exam'
      }
    ];

    const sectionBuckets = Object.fromEntries(sections.map(section => [section.id, []]));

    uniqueTests.forEach((test) => {
      const text = `${test?.name || ''} ${test?.description || ''}`;
      if (/\bQZ\b/i.test(test?.name || '')) {
        sectionBuckets['chapter-quizzes'].push(test);
      } else if (/certification/i.test(text)) {
        sectionBuckets['practice-certification-exam'].push(test);
      } else if (/provincial/i.test(text)) {
        sectionBuckets['practice-provincial-exam'].push(test);
      } else if (/cisro|manual/i.test(text)) {
        sectionBuckets['cisro-manuals'].push(test);
      } else {
        sectionBuckets['practice-mcqs'].push(test);
      }
    });

    return sections.map(section => ({
      ...section,
      items: sectionBuckets[section.id],
      count: sectionBuckets[section.id].length
    }));
  },

  // Render Practice Tests
  renderPracticeTests() {
    const topic = this.state.currentTopic;
    if (!topic) return;

    document.getElementById('practice-topic-title').textContent = topic.name;
    document.getElementById('practice-topic-icon').textContent = topic.icon;
    document.getElementById('practice-description').textContent = topic.description;

    const grid = document.getElementById('practice-tests-grid');
    if (!grid) return;

    if (this.state.practiceTestParent) {
      this.renderSubPracticeTests(this.state.practiceTestParent);
      return;
    }

    if (!topic.practiceTests || topic.practiceTests.length === 0) {
      grid.innerHTML = `
        <div class="no-tests-message">
          <p>📚 Practice tests for this topic are coming soon!</p>
        </div>
      `;
      return;
    }

    // Course-catalog style view (Main > Sub > Courses)
    if (this.shouldUseSectionedCatalog(topic)) {
      const sections = this.getLifeSections(topic);
      const selectedSection = sections.find(s => s.id === this.state.lifeSection) || null;

      // Step 1: Sub-heading chooser (Main -> Sub-heading)
      if (!selectedSection) {
        grid.classList.remove('catalog-list', 'catalog-tiles');
        grid.innerHTML = `
          <div class="catalog-shell" style="--topic-color: ${this.escapeHtml(this.getSafeThemeColor(topic.color))}">
            <div class="catalog-breadcrumb">${this.escapeHtml(topic.name)}</div>
            <h3 class="catalog-heading">Choose a Sub Heading</h3>
            <div class="catalog-subgrid">
              ${sections.map(section => `
                <div class="catalog-subcard" style="--topic-color: ${this.escapeHtml(this.getSafeThemeColor(topic.color))}">
                  <div class="catalog-subtitle">${this.escapeHtml(section.title)}</div>
                  <div class="catalog-subdesc">${this.escapeHtml(section.description)}</div>
                  <div class="catalog-submeta">
                    <span class="catalog-chip">${section.count} Course${section.count !== 1 ? 's' : ''}</span>
                  </div>
                  <button class="btn-start-test" onclick="${this.getInlineActionCall('MCQApp.setLifeSection', section.id)}">
                    Open ${this.escapeHtml(section.title)} →
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        return;
      }

      const scopedTopic = {
        ...topic,
        practiceTests: selectedSection.items
      };
      const items = scopedTopic.practiceTests || [];
      grid.classList.remove('catalog-list', 'catalog-tiles');

      const rowsHtml = items.map((test, index) => {
        const isActive = test.status !== 'coming-soon';
        const isPdf = this.isPdfResource(test);
        const testProgress = this.getPracticeTestProgress(topic.id, test.id);

        return `
          <div class="practice-test-card ${!isActive ? 'coming-soon' : ''}"
               ${isActive ? `onclick="${this.getInlineActionCall('MCQApp.selectPracticeTest', test.id)}"` : ''}
               style="--topic-color: ${this.escapeHtml(this.getSafeThemeColor(topic.color))}">
            <div class="test-number">${index + 1}</div>
            <h3 class="test-name">${this.escapeHtml(test.name)}</h3>
            <p class="test-description">${this.escapeHtml(test.description)}</p>
            <div class="test-meta">
              ${isPdf ? `
                <span class="question-count">📘 PDF Manual</span>
              ` : `
                <span class="question-count">
                  📝 ${test.questionCount} Question${test.questionCount !== 1 ? 's' : ''}
                </span>
              `}
              ${isActive && testProgress > 0 ? `
                <span class="progress-badge">${testProgress}% Complete</span>
              ` : ''}
            </div>
            ${isActive ? `
              <button class="btn-start-test">${isPdf ? 'Open Manual →' : 'Start Test →'}</button>
            ` : `
              <span class="coming-soon-badge">Coming Soon</span>
            `}
          </div>
        `;
      }).join('');

      grid.innerHTML = `
        <div class="catalog-shell" style="--topic-color: ${this.escapeHtml(this.getSafeThemeColor(topic.color))}">
          <div class="catalog-breadcrumb">${this.escapeHtml(topic.name)} / ${this.escapeHtml(selectedSection.title)}</div>
          <h3 class="catalog-heading">${this.escapeHtml(selectedSection.title)}</h3>
          <button class="btn-outline" onclick="${this.getInlineActionCall('MCQApp.setLifeSection', null)}" style="margin-bottom:.75rem;">
            ← Back to Sub Headings
          </button>

          <div class="catalog-courses is-list">
            ${rowsHtml || '<div class="no-tests-message"><p>No courses available yet.</p></div>'}
          </div>
        </div>
      `;
      return;
    }

    grid.classList.remove('catalog-list', 'catalog-tiles');

    grid.innerHTML = topic.practiceTests.map((test, index) => {
      const isActive = test.status !== 'coming-soon';
      const isPdf = this.isPdfResource(test);
      const testProgress = this.getPracticeTestProgress(topic.id, test.id);
      
      return `
        <div class="practice-test-card ${!isActive ? 'coming-soon' : ''}"
             ${isActive ? `onclick="${this.getInlineActionCall('MCQApp.selectPracticeTest', test.id)}"` : ''}
             style="--topic-color: ${this.escapeHtml(this.getSafeThemeColor(topic.color))}">
          <div class="test-number">${index + 1}</div>
          <h3 class="test-name">${this.escapeHtml(test.name)}</h3>
          <p class="test-description">${this.escapeHtml(test.description)}</p>
          <div class="test-meta">
            ${isPdf ? `
              <span class="question-count">📘 PDF Manual</span>
            ` : `
              <span class="question-count">
                📝 ${test.questionCount} Question${test.questionCount !== 1 ? 's' : ''}
              </span>
            `}
            ${isActive && testProgress > 0 ? `
              <span class="progress-badge">${testProgress}% Complete</span>
            ` : ''}
          </div>
          ${isActive ? `
            <button class="btn-start-test">${isPdf ? 'Open Manual →' : 'Start Test →'}</button>
          ` : `
            <span class="coming-soon-badge">Coming Soon</span>
          `}
        </div>
      `;
    }).join('');
  },

  // Select Practice Test and Load Questions
  async selectPracticeTest(testId) {
    const topic = this.state.currentTopic;
    if (!topic) return;

    const practiceTest = topic.practiceTests.find(t => t.id === testId);
    if (!practiceTest) return;

    if (Array.isArray(practiceTest.subTests) && practiceTest.subTests.length > 0) {
      this.state.practiceTestParent = practiceTest;
      this.state.currentPracticeTest = null;
      this.renderPracticeTests();
      return;
    }

    if (this.isPdfResource(practiceTest)) {
      await this.openPdfResource(practiceTest);
      return;
    }

    if (practiceTest.status === 'coming-soon' || Number(practiceTest.questionCount || 0) === 0) {
      this.showToast('This course is coming soon.', 'info');
      return;
    }

    this.beginLoading('Loading practice test...');
    try {
      await this.loadQuestions(practiceTest.dataFile, practiceTest.id);
    } finally {
      this.endLoading();
    }
    if (this.state.questions.length === 0) {
      this.showToast('No questions available for this practice test yet.', 'warning');
      return;
    }

    this.state.currentPracticeTest = practiceTest;
    this.saveLastSession(topic.id, practiceTest.id);
    this.state.currentQuestionIndex = 0;
    this.state.filterMode = 'all';
    this.state.isReviewMode = false;
    this.state.attemptedOptions = {};
    this.state.firstAttemptCorrect = {};
    this.state.lastSelectedIndex = undefined;
    this.state.lastSelectedQuestionKey = null;
    this.loadProgress();
    this.showView('mcq');
    this.renderQuestion();
  },

  setLifeSection(sectionId) {
    this.state.lifeSection = sectionId;
    this.renderPracticeTests();
  },

  isPdfResource(test) {
    return /\.pdf(\?|$)/i.test(test?.dataFile || '');
  },

  revokePdfObjectUrl() {
    if (this.state.currentPdfObjectUrl) {
      URL.revokeObjectURL(this.state.currentPdfObjectUrl);
      this.state.currentPdfObjectUrl = null;
    }
  },

  async openPdfResource(test) {
    this.state.currentPdfResource = test;

    const topicTitle = document.getElementById('pdf-topic-title');
    const manualTitle = document.getElementById('pdf-manual-title');
    const helperText = document.getElementById('pdf-helper-text');
    const frame = document.getElementById('pdf-frame');

    if (topicTitle) topicTitle.textContent = this.state.currentTopic?.name || 'Manual';
    if (manualTitle) manualTitle.textContent = test?.name || 'PDF Manual';
    if (helperText) helperText.textContent = 'Loading manual...';
    if (frame) frame.src = 'about:blank';

    this.showView('pdf');

    this.revokePdfObjectUrl();
    this.beginLoading('Loading manual...');

    try {
      const pdfUrl = new URL(test.dataFile, window.location.href).toString();
      if (frame) frame.src = `${pdfUrl}#toolbar=1&navpanes=1&view=FitH`;
      if (helperText) helperText.textContent = 'Use browser PDF search with Ctrl+F (or Find in page).';
    } catch (error) {
      console.error('PDF load failed:', error);
      if (helperText) helperText.textContent = 'Unable to display PDF inline. Use Open in New Tab or Download PDF.';
      this.showToast('Unable to display the PDF inline right now.', 'warning');
    } finally {
      this.endLoading();
    }
  },

  // Load Questions from File
  async loadQuestions(dataFile, testId = this.state.currentPracticeTest?.id) {
    try {
      const response = await fetch(dataFile);
      if (!response.ok) {
        throw new Error(`Failed to load questions (${response.status})`);
      }
      const data = await response.json();
      const rawQuestions = Array.isArray(data?.questions) ? data.questions : [];

      // Check if we have a saved shuffled order for this test
      const shuffleKey = `shuffle_${this.state.currentTopic?.id}_${testId}`;
      const progressKey = this.state.currentTopic?.id && testId
        ? `progress_${this.state.currentTopic.id}_${testId}`
        : null;
      const sourceSignature = this.getQuestionContentSignature(rawQuestions);
      const savedProgress = progressKey ? this.readJSONFromStorage(progressKey, null) : null;
      const savedProgressLayout = savedProgress?.questionLayoutSignature === sourceSignature
        ? savedProgress.questionLayout
        : null;
      const savedShuffleData = this.getSavedShuffleData(shuffleKey);
      const savedQuestionsFromProgress = savedProgressLayout
        ? this.buildQuestionsFromLayout(rawQuestions, savedProgressLayout)
        : null;
      const savedQuestionsFromLayout = savedShuffleData?.layout &&
        savedShuffleData?.signature === sourceSignature &&
        savedShuffleData?.version === this.shuffleSchemaVersion
        ? this.buildQuestionsFromLayout(rawQuestions, savedShuffleData.layout)
        : null;
      const legacySavedQuestions = Array.isArray(savedShuffleData?.questions) ? savedShuffleData.questions : null;
      const legacySavedShuffleNeedsCleanup = this.hasPrefixedOptionLabels(legacySavedQuestions || []);
      const canReuseLegacyShuffle = Boolean(
        legacySavedQuestions &&
        legacySavedQuestions.length === rawQuestions.length &&
        savedShuffleData?.signature === sourceSignature &&
        !legacySavedShuffleNeedsCleanup
      );

      if (savedQuestionsFromProgress) {
        console.log('Using question order from saved progress');
        this.state.questions = savedQuestionsFromProgress;
        this.saveShuffleData(shuffleKey, this.state.questions, sourceSignature);
      } else if (savedQuestionsFromLayout) {
        console.log('Using saved question order');
        this.state.questions = savedQuestionsFromLayout;
      } else if (canReuseLegacyShuffle) {
        console.log('Using saved question order');
        this.state.questions = legacySavedQuestions.map((question) => this.normalizeQuestionOptionLabels(question));
        this.saveShuffleData(shuffleKey, this.state.questions, sourceSignature);
      } else {
        console.log('Creating new randomized order');
        const shuffledQuestions = this.shuffleArray(rawQuestions);
        this.state.questions = shuffledQuestions.map((question) => {
          const indices = Array.isArray(question.options)
            ? question.options.map((_, index) => index)
            : [];
          const shuffledIndices = this.shuffleArray(indices);
          return this.buildQuestionFromOptionOrder(question, shuffledIndices);
        });
        this.saveShuffleData(shuffleKey, this.state.questions, sourceSignature);
      }

      this.state.loadedQuestionSetId = this.getLoadedQuestionSetKey(this.state.currentTopic?.id, testId);
      this.state.loadedQuestionSourceSignature = sourceSignature;
      console.log(`Loaded ${this.state.questions.length} questions`);
    } catch (error) {
      console.error('Error loading questions:', error);
      this.state.questions = [];
      this.state.loadedQuestionSetId = null;
      this.state.loadedQuestionSourceSignature = '';
      this.showToast('Unable to load questions right now.', 'error');
    }
  },

  // Show View
  buildNavigationState(viewName = this.state.currentView) {
    const navState = {
      view: viewName,
      topicId: this.state.currentTopic?.id || null,
      testId: this.state.currentPracticeTest?.id || null,
      parentTestId: this.state.practiceTestParent?.id || null,
      lifeSection: this.state.lifeSection || null
    };

    if (viewName === 'mcq') {
      const currentQuestion = this.getCurrentQuestion();
      navState.filterMode = this.state.filterMode;
      navState.currentQuestionIndex = this.state.currentQuestionIndex;
      navState.currentQuestionKey = currentQuestion ? this.getQuestionStateKey(currentQuestion) : null;
    }

    return navState;
  },

  applyNavigationSessionState(navState = {}) {
    if (!navState || navState.view !== 'mcq') return;

    this.state.filterMode = navState.filterMode === 'bookmarked' ? 'bookmarked' : this.state.filterMode;
    const filteredQuestions = this.getFilteredQuestions();
    const targetQuestionKey = navState.currentQuestionKey ? String(navState.currentQuestionKey) : '';
    const targetQuestionIndex = targetQuestionKey
      ? filteredQuestions.findIndex((question) => this.getQuestionStateKey(question) === targetQuestionKey)
      : -1;

    if (targetQuestionIndex >= 0) {
      this.state.currentQuestionIndex = targetQuestionIndex;
      return;
    }

    if (filteredQuestions.length > 0 && Number.isInteger(navState.currentQuestionIndex)) {
      this.state.currentQuestionIndex = Math.max(0, Math.min(navState.currentQuestionIndex, filteredQuestions.length - 1));
    }
  },

  syncNavigationState(historyMode = 'replace') {
    if (!window.history) return;
    const method = historyMode === 'push' ? 'pushState' : 'replaceState';
    if (typeof window.history[method] !== 'function') return;
    window.history[method](this.buildNavigationState(this.state.currentView), '', window.location.href);
  },

  async ensureCurrentPracticeTestQuestionsLoaded(options = {}) {
    const { showLoading = true } = options;
    if (this.state.isReviewMode) {
      return this.state.questions.length > 0;
    }

    const topic = this.state.currentTopic;
    const practiceTest = this.state.currentPracticeTest;
    if (!topic || !practiceTest?.id || !practiceTest?.dataFile) {
      return false;
    }

    const expectedQuestionSetId = this.getLoadedQuestionSetKey(topic.id, practiceTest.id);
    if (this.state.loadedQuestionSetId === expectedQuestionSetId && this.state.questions.length > 0) {
      return true;
    }

    if (showLoading) {
      this.beginLoading('Restoring quiz...');
    }
    try {
      await this.loadQuestions(practiceTest.dataFile, practiceTest.id);
    } finally {
      if (showLoading) {
        this.endLoading();
      }
    }
    return this.state.questions.length > 0;
  },

  restoreNavigationState(navState = {}) {
    if (!navState || typeof navState !== 'object') return;

    const topic = navState.topicId
      ? this.state.topics.find((item) => item.id === navState.topicId)
      : null;

    if (topic) {
      this.state.currentTopic = topic;
      this.state.lifeSection = navState.lifeSection || null;

      if (navState.parentTestId) {
        this.state.practiceTestParent = topic.practiceTests?.find((test) => test.id === navState.parentTestId) || null;
      } else {
        this.state.practiceTestParent = null;
      }

      if (navState.testId) {
        if (this.state.practiceTestParent?.subTests?.some((test) => test.id === navState.testId)) {
          this.state.currentPracticeTest = this.state.practiceTestParent.subTests.find((test) => test.id === navState.testId) || null;
        } else {
          this.state.currentPracticeTest = this.findPracticeTestById(topic, navState.testId);
        }
      } else {
        this.state.currentPracticeTest = null;
      }
    }
  },

  showView(viewName, options = {}) {
    const { updateHistory = true, historyMode = 'push' } = options;
    this.clearAutoAdvanceTimer();
    if (viewName !== 'admin' && viewName !== 'admin-heatmaps' && typeof this.onLeaveAdminView === 'function') {
      this.onLeaveAdminView();
    }
    if (viewName !== 'mcq') {
      this.stopHeatmapFlushTimer();
      this.flushHeatmapEvents({ useBeacon: true, force: true });
      this.stopQuestionTimer();
      if (!this.state.isReviewMode) {
        this.saveProgress();
      }
      this.resetAdvanceTapState();
      this.stopSpeech();
      // Clean up keyboard listeners when leaving quiz
      this.cleanupQuizKeyboardListeners();
    }
    this.state.currentView = viewName;
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    const viewMap = {
      'home': 'home-view',
      'practice-test': 'practice-test-view',
      'mcq': 'mcq-view',
      'list': 'list-view',
      'pdf': 'pdf-view',
      'admin': 'admin-view',
      'admin-heatmaps': 'admin-heatmaps-view'
    };

    const targetView = document.getElementById(viewMap[viewName]);
    if (targetView) {
      targetView.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'home') {
      this.renderTopicsGrid();
    } else if (viewName === 'practice-test' && this.state.currentTopic) {
      this.renderPracticeTests();
    } else if (viewName === 'admin' && typeof this.onEnterAdminView === 'function') {
      this.onEnterAdminView();
    } else if (viewName === 'admin-heatmaps' && typeof this.onEnterAdminHeatmapsView === 'function') {
      this.onEnterAdminHeatmapsView();
    }

    if (updateHistory && window.history) {
      const method = historyMode === 'replace' ? 'replaceState' : 'pushState';
      if (typeof window.history[method] === 'function') {
        window.history[method](this.buildNavigationState(viewName), '', window.location.href);
      }
    }
  },

  // Render Current Question
  renderQuestion() {
    this.clearAutoAdvanceTimer();
    this.stopSpeech();
    const question = this.getCurrentQuestion();
    if (!question) {
      if (this.state.currentPracticeTest && this.state.currentTopic && this.state.currentView === 'mcq') {
        this.showView('practice-test', { updateHistory: false });
        this.showToast('We could not restore that exact question. Open the test again to continue.', 'warning');
      }
      return;
    }
    const stateKey = this.getQuestionStateKey(question);

    const questionIndex = this.state.currentQuestionIndex;
    const totalQuestions = this.getFilteredQuestions().length;
    const shouldScrollToTop =
      this.state.lastRenderedQuestionKey !== stateKey ||
      this.state.lastRenderedQuestionIndex !== questionIndex;

    // Update header
    document.getElementById('topic-title').textContent = this.state.currentTopic.name;
    document.getElementById('current-question-num').textContent = questionIndex + 1;
    document.getElementById('total-questions').textContent = totalQuestions;
    this.syncQuestionTimer(question);

    // Update progress bar
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
      const pct = ((questionIndex + 1) / totalQuestions) * 100;
      progressFill.style.width = pct + '%';
    }

    // Update question card
    document.getElementById('q-num').textContent = questionIndex + 1;
    // Convert markdown tables to HTML and render question
    document.getElementById('question-text').innerHTML = this.renderSafeTextWithTables(question.question);
    this.resetAIExplanationUi(false);

    // Render options
    const optionsContainer = document.getElementById('options-container');
    const attemptedForQuestion = this.state.attemptedOptions[stateKey] || [];
    
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    optionsContainer.innerHTML = question.options.map((option, index) => {
      const wasAttempted = attemptedForQuestion.includes(index);
      const isCorrect = index === question.correctAnswer;
      const isRevealed = this.state.answersRevealed.has(stateKey);
      const isFocused = this.state.lastSelectedQuestionKey === stateKey && this.state.lastSelectedIndex === index && !isRevealed;
      const dimmedClass = isRevealed && !isCorrect && !wasAttempted ? 'is-dimmed' : '';
      const feedbackText = wasAttempted && !isRevealed
        ? this.getWrongAnswerFeedback(question, index)
        : '';
      const feedbackHtml = feedbackText ? `
            <div class="option-feedback">
              <div class="option-feedback-label">Why this choice misses</div>
              <p>${this.escapeHtml(feedbackText)}</p>
            </div>
          ` : '';
      
      return `
        <div class="option ${wasAttempted ? 'was-attempted' : ''} ${isRevealed && isCorrect ? 'is-correct' : ''} ${isFocused ? 'is-focused' : ''} ${dimmedClass}" 
             data-index="${index}" 
             tabindex="0"
             onmouseenter="MCQApp.trackOptionHover(${index}, event)"
             onclick="MCQApp.selectOption(${index}, event)">
          <div class="option-main">
            <span class="option-letter">${letters[index] || index + 1}</span>
            <span class="option-text">${this.escapeHtml(this.getOptionDisplayText(option))}</span>
          </div>
          ${feedbackHtml}
        </div>
      `;
    }).join('');

    // Update bookmark button
    const bookmarkBtn = document.getElementById('bookmark-btn');
    const isBookmarked = this.state.bookmarkedQuestions.has(stateKey);
    bookmarkBtn.textContent = isBookmarked ? '⭐' : '☆';
    bookmarkBtn.classList.toggle('bookmarked', isBookmarked);

    // Hide answer section initially
    document.getElementById('answer-section').classList.add('hidden');

    // If already answered, restore the answer display and disable options
    if (this.state.answersRevealed.has(stateKey)) {
      const answerSection = document.getElementById('answer-section');
      document.getElementById('correct-answer-text').textContent = this.getOptionDisplayText(question.options[question.correctAnswer]);
      const explanationText = this.buildStepByStepExplanation(question);
      document.getElementById('explanation-text').innerHTML = this.formatExplanation(explanationText);

      // Display kidExplanation if available
      const kidExplanationBox = document.getElementById('kid-explanation-box');
      const kidExplanationText = document.getElementById('kid-explanation-text');
      console.log('📚 Kid Explanation Check:', {
        hasQuestion: !!question,
        hasKidExplanation: !!question.kidExplanation,
        kidBoxFound: !!kidExplanationBox,
        kidTextFound: !!kidExplanationText,
        kidExplanationPreview: question.kidExplanation?.substring(0, 50) || 'NONE'
      });

      if (question.kidExplanation && kidExplanationText) {
        kidExplanationText.innerHTML = this.formatExplanation(question.kidExplanation);
        kidExplanationBox.style.display = 'block';
        console.log('✅ Kid explanation displayed');
      } else if (kidExplanationBox) {
        kidExplanationBox.style.display = 'none';
        console.log('⚠️ Kid explanation not available for this question');
      }

      this.resetAIExplanationUi(true);
      answerSection.classList.remove('hidden');
      optionsContainer.querySelectorAll('.option').forEach(opt => {
        const idx = parseInt(opt.getAttribute('data-index'));
        if (idx === question.correctAnswer) {
          opt.classList.add('is-correct');
          opt.classList.remove('is-dimmed');
        } else if (!opt.classList.contains('was-attempted')) {
          opt.classList.add('is-dimmed');
        }
        opt.style.pointerEvents = 'none';
      });
    }

    // Mark as viewed
    this.state.viewedQuestions.add(stateKey);
    this.saveProgress();
    this.syncNavigationState('replace');

    // Update navigation buttons
    this.updateNavigationButtons();
    this.renderQuestionDots();

    // Hide Next until answered; always hide on last question (finish banner handles it)
    const nextBtn = document.getElementById('next-question-btn');
    const hasAnswered = this.state.answersRevealed.has(stateKey);
    const isLastQ = this.state.currentQuestionIndex === this.getFilteredQuestions().length - 1;
    if (nextBtn) {
      nextBtn.classList.remove('hidden');
    }
    const nextBtnTop = document.getElementById('next-question-btn-top');
    if (nextBtnTop) {
      nextBtnTop.classList.toggle('hidden', !hasAnswered || isLastQ);
    }

    // Setup keyboard listeners for this quiz
    this.setupQuizKeyboardListeners();

    // Update auto-advance toggle state display
    const autoAdvanceBtn = document.getElementById('auto-advance-toggle');
    if (autoAdvanceBtn) {
      autoAdvanceBtn.classList.toggle('is-enabled', this.state.autoAdvanceEnabled);
      autoAdvanceBtn.setAttribute('aria-pressed', this.state.autoAdvanceEnabled ? 'true' : 'false');
    }

    if (shouldScrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    this.state.lastRenderedQuestionKey = stateKey;
    this.state.lastRenderedQuestionIndex = questionIndex;

    // Check if all questions have been answered — show/hide finish banner
    this.checkCompletion();
  },

  // Build speech text for current question
  buildSpeechText(question) {
    const questionText = this.getVisibleSpeechText(
      document.getElementById('question-text'),
      this.getQuestionPlainText(question)
    );
    const optionNodes = Array.from(document.querySelectorAll('#options-container .option-text'));
    const optionsText = optionNodes.length > 0
      ? optionNodes
        .map((node, idx) => `Option ${idx + 1}: ${this.getVisibleSpeechText(node)}`)
        .filter((text) => !/^Option \d+:\s*$/.test(text))
        .join('. ')
      : (Array.isArray(question?.options) ? question.options : [])
        .map((opt, idx) => `Option ${idx + 1}: ${this.getOptionDisplayText(opt)}`)
        .join('. ');

    return [
      questionText ? `Question. ${questionText}` : '',
      optionsText
    ].filter(Boolean).join('. ');
  },

  getVisibleSpeechText(element, fallback = '') {
    const fallbackText = String(fallback || '').replace(/\s+/g, ' ').trim();
    if (!element) {
      return fallbackText;
    }

    if (typeof element.innerText === 'string') {
      const innerText = element.innerText.replace(/\s+/g, ' ').trim();
      if (innerText) {
        return innerText;
      }
    }

    if (typeof element.textContent === 'string') {
      const textContent = element.textContent.replace(/\s+/g, ' ').trim();
      if (textContent) {
        return textContent;
      }
    }

    return fallbackText;
  },

  // Speak current question and options
  speakCurrentQuestion() {
    if (!this.state.speechSupported) {
      console.warn('Speech synthesis not supported');
      return;
    }
    const question = this.getCurrentQuestion();
    if (!question) {
      console.warn('No current question found');
      return;
    }

    try {
      const text = this.buildSpeechText(question);
      console.log('Speaking:', text.substring(0, 50) + '...');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = navigator.language || 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => console.log('Speech started');
      utterance.onend = () => {
        console.log('Speech ended');
        this.updateSpeechButton(false);
      };
      utterance.onerror = (e) => {
        console.error('Speech error:', e);
        this.updateSpeechButton(false);
      };

      this.state.currentUtterance = utterance;
      this.updateSpeechButton(true);
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error speaking question:', error);
      this.updateSpeechButton(false);
    }
  },

  // Stop any active speech
  stopSpeech() {
    if (!this.state.speechSupported) return;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    this.updateSpeechButton(false);
  },

  // Update read button UI state
  updateSpeechButton(isSpeaking) {
    const btn = document.getElementById('read-question-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', isSpeaking ? 'true' : 'false');
    btn.textContent = isSpeaking ? '⏹ Stop' : '🔊 Read';
  },

  // Convert markdown tables to HTML tables with styling
  convertMarkdownTablesToHTML(text) {
    if (!text || !text.includes('|')) return text;
    
    // Split text by tables (separated by empty lines)
    const parts = text.split(/\n\n+/);
    
    return parts.map(part => {
      // Check if this part is a table (has pipe characters)
      if (!part.includes('|')) {
        return part;
      }
      
      const lines = part.trim().split('\n');
      const parseTableRow = (line) => {
        const cells = line.split('|').map((cell) => cell.trim());
        if (line.trim().startsWith('|')) {
          cells.shift();
        }
        if (line.trim().endsWith('|')) {
          cells.pop();
        }
        return cells;
      };
      
      // Validate table format (must have at least 3 lines: header, separator, data)
      if (lines.length < 3 || !lines[1].match(/^\s*\|?[\s\-|:]+\|?[\s\-|:]*$/)) {
        return part; // Not a valid markdown table
      }
      
      try {
        // Parse headers
        const headers = parseTableRow(lines[0]).filter((header) => header);
        
        // Parse data rows
        const rows = lines.slice(2).map(line => 
          parseTableRow(line)
            .slice(0, headers.length)
        ).filter(row => row.length > 0);
        
        // Build HTML table
        let html = '<table class="life-table">';
        
        // Header
        html += '<thead><tr>';
        headers.forEach((header, idx) => {
          const isNumeric = header.includes('Probability') || header.includes('Expectancy') || header.includes('Death');
          html += `<th${isNumeric ? ' data-type="numeric"' : ''}>${this.escapeHtml(header)}</th>`;
        });
        html += '</tr></thead>';
        
        // Body
        html += '<tbody>';
        rows.forEach((row, rowIdx) => {
          html += '<tr>';
          row.forEach((cell, cellIdx) => {
            const isAgeColumn = cellIdx === 0;
            const isNumeric = headers[cellIdx] && (headers[cellIdx].includes('Probability') || headers[cellIdx].includes('Expectancy'));
            const cellAttr = isAgeColumn
              ? ' class="age-col"'
              : (isNumeric ? ' data-type="numeric"' : '');
            html += `<td${cellAttr}>${this.escapeHtml(cell)}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
        
        return html;
      } catch (e) {
        console.warn('Failed to parse table:', e);
        return part; // Return original on error
      }
    }).join('\n\n');
  },

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  },

  getSafeThemeColor(value, fallback = '#2563eb') {
    const color = String(value || '').trim();
    if (
      /^(#[0-9a-f]{3,8}|rgba?\([^()]+\)|hsla?\([^()]+\)|[a-z]+)$/i.test(color)
    ) {
      return color;
    }
    return fallback;
  },

  getInlineActionCall(methodName, ...args) {
    const safeMethod = String(methodName || '').replace(/[^\w.$]/g, '');
    const serializedArgs = args.map((arg) => JSON.stringify(arg ?? null)).join(', ');
    return this.escapeHtml(`${safeMethod}(${serializedArgs})`);
  },

  renderSafeTextWithTables(text) {
    if (!text) return '';

    const processedText = this.convertMarkdownTablesToHTML(String(text));
    const parts = processedText.split(/(<table[\s\S]*?<\/table>)/);

    return parts.map((part) => {
      if (part.startsWith('<table')) {
        return part;
      }
      return this.escapeHtml(part).replace(/\n/g, '<br>');
    }).join('');
  },

  getQuestionContentSignature(questions = []) {
    return JSON.stringify(
      questions.map((question) => ({
        id: question?.id,
        question: question?.question,
        options: Array.isArray(question?.options)
          ? question.options.map((option) => this.getOptionDisplayText(option))
          : question?.options,
        correctAnswer: question?.correctAnswer,
        explanation: question?.explanation,
        optionFeedback: question?.optionFeedback
      }))
    );
  },

  getSavedShuffleData(shuffleKey) {
    try {
      const raw = localStorage.getItem(shuffleKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return {
          questions: parsed,
          signature: null,
          version: null
        };
      }

      if (parsed && Array.isArray(parsed.questions)) {
        return {
          questions: parsed.questions,
          layout: null,
          signature: typeof parsed.signature === 'string' ? parsed.signature : null,
          version: typeof parsed.version === 'string' ? parsed.version : null
        };
      }

      if (parsed && parsed.layout && Array.isArray(parsed.layout.questionOrder)) {
        return {
          questions: null,
          layout: parsed.layout,
          signature: typeof parsed.signature === 'string' ? parsed.signature : null,
          version: typeof parsed.version === 'string' ? parsed.version : null
        };
      }
    } catch (error) {
      console.warn('Invalid saved shuffle data; ignoring cached order.', error);
    }

    return null;
  },

  saveShuffleData(shuffleKey, questions, signature) {
    this.setStorageItemWithRecovery(shuffleKey, JSON.stringify({
      version: this.shuffleSchemaVersion,
      signature,
      layout: this.buildQuestionLayoutSnapshot(questions)
    }));
  },

  resetAIExplanationUi(showButton = false) {
    const aiExplanationEl = document.getElementById('ai-explanation-text');
    const aiButton = document.getElementById('get-ai-explanation-btn');

    if (aiExplanationEl) {
      aiExplanationEl.innerHTML = '';
      aiExplanationEl.style.display = 'none';
    }

    if (aiButton) {
      aiButton.style.display = showButton && this.state.aiAvailable ? 'inline-flex' : 'none';
      aiButton.disabled = false;
    }
  },

  clearAutoAdvanceTimer() {
    if (this.state.autoAdvanceTimer) {
      window.clearTimeout(this.state.autoAdvanceTimer);
      this.state.autoAdvanceTimer = null;
    }
  },

  getAIApiUrl() {
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    return isLocalhost
      ? 'http://localhost:8000/api/explain'
      : `${window.location.origin}/api/explain`;
  },

  getAIHealthUrl() {
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    return isLocalhost
      ? 'http://localhost:8000/health'
      : `${window.location.origin}/health`;
  },

  async checkAIAvailability() {
    try {
      const response = await fetch(this.getAIHealthUrl(), {
        method: 'GET',
        cache: 'no-store'
      });
      this.state.aiAvailable = response.ok;
    } catch (error) {
      this.state.aiAvailable = false;
    }
  },

  // Toggle auto-advance feature
  toggleAutoAdvance() {
    this.state.autoAdvanceEnabled = !this.state.autoAdvanceEnabled;
    localStorage.setItem('auto-advance', this.state.autoAdvanceEnabled ? 'true' : 'false');
    
    // Update button UI
    const btn = document.getElementById('auto-advance-toggle');
    if (btn) {
      btn.classList.toggle('is-enabled', this.state.autoAdvanceEnabled);
      btn.setAttribute('aria-pressed', this.state.autoAdvanceEnabled ? 'true' : 'false');
    }
    
    // Show confirmation toast
    const status = this.state.autoAdvanceEnabled ? 'enabled' : 'disabled';
    this.showToast(`Auto-advance ${status}`, 'info', '', 2000);
  },

  // Auto-advance to next question after delay
  autoAdvanceNext() {
    this.clearAutoAdvanceTimer();
    if (!this.state.autoAdvanceEnabled) return;
    const filtered = this.getFilteredQuestions();
    const isLastQuestion = this.state.currentQuestionIndex === filtered.length - 1;
    if (!isLastQuestion) {
      this.state.autoAdvanceTimer = window.setTimeout(() => {
        this.state.autoAdvanceTimer = null;
        this.navigateQuestion(1);
      }, this.state.autoAdvanceDelay);
    }
  },

  // Handle keyboard navigation
  handleQuizKeydown(event) {
    // Only handle keyboard shortcuts when in MCQ view
    if (MCQApp.state.currentView !== 'mcq') return;
    
    // Ignore if focused on input/textarea
    const target = event.target;
    if (target.matches('input, textarea, [contenteditable]')) return;
    
    const key = event.key.toLowerCase();
    
    // Arrow Up/Down to navigate options
    if (key === 'arrowup' || key === 'arrowdown') {
      event.preventDefault();
      const question = this.getCurrentQuestion();
      if (!question || this.state.answersRevealed.has(this.getQuestionStateKey(question))) return; // Don't navigate if already answered
      
      const optionsContainer = document.getElementById('options-container');
      if (!optionsContainer) return;
      const options = optionsContainer.querySelectorAll('.option');
      const selectedIndex = this.state.lastSelectedIndex ?? -1;
      
      let newIndex = selectedIndex;
      if (key === 'arrowdown') {
        newIndex = Math.min(newIndex + 1, options.length - 1);
      } else {
        newIndex = Math.max(newIndex - 1, 0);
      }
      
      this.state.lastSelectedIndex = newIndex;
      this.state.lastSelectedQuestionKey = this.getQuestionStateKey(question);
      options.forEach((opt, idx) => {
        opt.classList.toggle('is-focused', idx === newIndex);
        if (idx === newIndex) opt.focus();
      });
      return;
    }
    
    // Enter to select focused option
    if (key === 'enter') {
      event.preventDefault();
      const question = this.getCurrentQuestion();
      if (!question) return;
      
      const selectedIndex = this.state.lastSelectedIndex;
      const stateKey = this.getQuestionStateKey(question);
      if (
        selectedIndex !== undefined &&
        selectedIndex >= 0 &&
        this.state.lastSelectedQuestionKey === stateKey
      ) {
        this.selectOption(selectedIndex);
      }
      return;
    }
    
    // Space to advance to next question (if already answered)
    if (key === ' ') {
      event.preventDefault();
      const question = this.getCurrentQuestion();
      if (!question || !this.state.answersRevealed.has(this.getQuestionStateKey(question))) return;
      
      const filtered = this.getFilteredQuestions();
      if (this.state.currentQuestionIndex < filtered.length - 1) {
        this.navigateQuestion(1);
      }
      return;
    }
    
    // Left Arrow to go to previous question
    if (key === 'arrowleft') {
      event.preventDefault();
      if (this.state.currentQuestionIndex > 0) {
        this.navigateQuestion(-1);
      }
      return;
    }
    
    // Right Arrow to go to next question
    if (key === 'arrowright') {
      event.preventDefault();
      const filtered = this.getFilteredQuestions();
      if (this.state.currentQuestionIndex < filtered.length - 1) {
        this.navigateQuestion(1);
      }
      return;
    }
    
    // Escape to toggle bookmark
    if (key === 'escape') {
      event.preventDefault();
      const question = this.getCurrentQuestion();
      if (question) {
        const questionKey = this.getQuestionStateKey(question);
        const isBookmarked = this.state.bookmarkedQuestions.has(questionKey);
        if (isBookmarked) {
          this.state.bookmarkedQuestions.delete(questionKey);
        } else {
          this.state.bookmarkedQuestions.add(questionKey);
        }
        this.saveProgress();
        this.renderQuestion();
      }
      return;
    }
    
    // 1-9 to jump to question by number
    const charCode = key.charCodeAt(0);
    if (charCode >= 48 && charCode <= 57) {
      const num = parseInt(key);
      if (num > 0) {
        const filtered = this.getFilteredQuestions();
        const targetIndex = num - 1;
        if (targetIndex < filtered.length) {
          this.jumpToQuestion(targetIndex);
        }
      }
    }
  },

  // Initialize keyboard listeners for quiz
  setupQuizKeyboardListeners() {
    // Attach to document to capture all keyboard events, not just on mcq-view
    // Remove old listener if exists
    if (this.state.quizKeyboardHandler) {
      document.removeEventListener('keydown', this.state.quizKeyboardHandler);
    }
    
    // Bind new listener to document
    this.state.quizKeyboardHandler = this.handleQuizKeydown.bind(this);
    document.addEventListener('keydown', this.state.quizKeyboardHandler);
  },

  // Clean up keyboard listeners
  cleanupQuizKeyboardListeners() {
    if (this.state.quizKeyboardHandler) {
      document.removeEventListener('keydown', this.state.quizKeyboardHandler);
    }
  },

  // Get Current Question
  getCurrentQuestion() {
    const filtered = this.getFilteredQuestions();
    return filtered[this.state.currentQuestionIndex];
  },

  // Get Filtered Questions
  getFilteredQuestions() {
    if (this.state.filterMode === 'bookmarked') {
      return this.state.questions.filter(q => this.state.bookmarkedQuestions.has(this.getQuestionStateKey(q)));
    }
    return this.state.questions;
  },

  canAdvanceFromCurrentQuestion() {
    const question = this.getCurrentQuestion();
    if (!question) return true;
    return this.state.answersRevealed.has(this.getQuestionStateKey(question));
  },

  setCurrentQuestionIndex(index, options = {}) {
    const { force = false, showBlockedToast = true } = options;
    const filtered = this.getFilteredQuestions();
    if (!filtered.length) return false;

    const targetIndex = Math.max(0, Math.min(index, filtered.length - 1));
    if (targetIndex === this.state.currentQuestionIndex) {
      return false;
    }

    const movingForward = targetIndex > this.state.currentQuestionIndex;
    if (movingForward && !force && !this.canAdvanceFromCurrentQuestion()) {
      if (showBlockedToast) {
        this.showToast('Answer this question before moving ahead.', 'info');
      }
      return false;
    }

    this.state.currentQuestionIndex = targetIndex;
    this.renderQuestion();
    return true;
  },

  // Navigate Question
  navigateQuestion(direction) {
    this.resetAdvanceTapState();
    return this.setCurrentQuestionIndex(
      this.state.currentQuestionIndex + direction,
      { showBlockedToast: direction > 0 }
    );
  },

  // Update Navigation Buttons
  updateNavigationButtons() {
    const filtered = this.getFilteredQuestions();
    const prevBtn = document.getElementById('prev-question-btn');
    const nextBtn = document.getElementById('next-question-btn');

    if (!prevBtn || !nextBtn) return;

    const hasAnswered = this.canAdvanceFromCurrentQuestion();
    prevBtn.disabled = filtered.length === 0 || this.state.currentQuestionIndex === 0;
    nextBtn.disabled = (
      filtered.length === 0 ||
      this.state.currentQuestionIndex === filtered.length - 1 ||
      !hasAnswered
    );
  },

  scrollActiveQuestionDotIntoView() {
    const activeDot = document.querySelector('#question-dots .question-dot.is-active');
    if (!activeDot || typeof activeDot.scrollIntoView !== 'function') return;

    const runScroll = () => {
      activeDot.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(runScroll);
      return;
    }

    runScroll();
  },

  // Render Question Dots
  renderQuestionDots() {
    const dotsContainer = document.getElementById('question-dots');
    if (!dotsContainer) return;

    const filtered = this.getFilteredQuestions();
    const totalQuestions = filtered.length;
    const currentIndex = this.state.currentQuestionIndex;
    const canAdvance = this.canAdvanceFromCurrentQuestion();
    if (totalQuestions === 0) {
      dotsContainer.innerHTML = '';
      return;
    }

    // For mobile/small screens: show only 5 dots at a time in a window.
    // For desktop: show more dots without rendering a huge strip.
    const isMobile = window.innerWidth < 768;
    const dotsPerWindow = isMobile ? 5 : 12;

    // Calculate which window the current question is in
    const currentWindow = Math.floor(currentIndex / dotsPerWindow);
    const windowStart = currentWindow * dotsPerWindow;
    const windowEnd = Math.min(windowStart + dotsPerWindow, totalQuestions);

    let html = '';
    
    // Add previous window button if not first window
    if (windowStart > 0) {
      html += `
        <button class="dot-nav-btn dot-nav-prev" 
                onclick="${this.getInlineActionCall('MCQApp.jumpToQuestion', Math.max(0, windowStart - dotsPerWindow))}"
                aria-label="Previous questions">
          ‹
        </button>
      `;
    }
    
    // Add question dots for current window
    for (let i = windowStart; i < windowEnd; i++) {
      const q = filtered[i];
      const isActive = i === currentIndex;
      const isLocked = i > currentIndex && !canAdvance;
      const questionKey = this.getQuestionStateKey(q);
      const isBookmarked = this.state.bookmarkedQuestions.has(questionKey);
      const isViewed = this.state.viewedQuestions.has(questionKey);
      const isAnswered = this.state.answersRevealed.has(questionKey);
      const wasFirstCorrect = this.state.firstAttemptCorrect[questionKey];
      const dotStateClass = isAnswered ? (wasFirstCorrect ? 'is-correct-dot' : 'is-wrong-dot') : '';
      const dotTitle = isLocked
        ? `Question ${i + 1} - Answer the current question first`
        : `Question ${i + 1}${isAnswered ? (wasFirstCorrect ? ' - Correct' : ' - Wrong') : ''}`;
      const dotContent = isAnswered ? '' : (isBookmarked ? '⭐' : i + 1);
      
      html += `
        <button class="question-dot ${isActive ? 'is-active' : ''} ${isViewed ? 'is-viewed' : ''} ${isBookmarked ? 'is-bookmarked' : ''} ${dotStateClass} ${isLocked ? 'is-locked' : ''}"
                onclick="${this.getInlineActionCall('MCQApp.jumpToQuestion', i)}"
                title="${this.escapeHtml(dotTitle)}"
                aria-label="${this.escapeHtml(dotTitle)}"
                aria-current="${isActive ? 'page' : 'false'}"
                ${isLocked ? 'disabled' : ''}>
          ${dotContent}
        </button>
      `;
    }
    
    // Add next window button if not last window
    if (windowEnd < totalQuestions) {
      html += `
        <button class="dot-nav-btn dot-nav-next ${Math.min(windowEnd, totalQuestions - 1) > currentIndex && !canAdvance ? 'is-locked' : ''}" 
                onclick="${this.getInlineActionCall('MCQApp.jumpToQuestion', Math.min(windowEnd, totalQuestions - 1))}"
                aria-label="Next questions"
                ${Math.min(windowEnd, totalQuestions - 1) > currentIndex && !canAdvance ? 'disabled' : ''}>
          ›
        </button>
      `;
    }
    
    dotsContainer.innerHTML = html;
    this.scrollActiveQuestionDotIntoView();
  },

  // Jump to Question
  jumpToQuestion(index, options = {}) {
    return this.setCurrentQuestionIndex(index, options);
  },

  stripCorrectAnswerReveal(feedbackText) {
    const text = this.cleanFeedbackText(feedbackText);
    if (!text) return '';

    const sanitized = text
      .replace(/\s*The correct answer is "[^"]+" because[\s\S]*$/i, '')
      .replace(/\s*The correct idea here is "[^"]+":[\s\S]*$/i, '')
      .replace(/\s*The better answer here is "[^"]+"\.[\s\S]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[\s.]+$/, '');

    return sanitized ? this.toSentence(sanitized) : '';
  },

  summarizeExplanationReason(feedbackText) {
    const text = this.cleanFeedbackText(feedbackText);
    if (!text) return '';

    const sanitized = text
      .replace(/^The correct answer is "[^"]+" because\s*/i, '')
      .replace(/^The correct idea here is "[^"]+":\s*/i, '')
      .replace(/^The better answer here is "[^"]+"\.\s*/i, '')
      .replace(/\s*The correct answer is "[^"]+" because[\s\S]*$/i, '')
      .replace(/\s*The correct idea here is "[^"]+":[\s\S]*$/i, '')
      .replace(/\s*The better answer here is "[^"]+"\.[\s\S]*$/i, '')
      .replace(/^"[^"]+"\s+is\b/i, 'It is')
      .replace(/^"[^"]+"\s+describes\b/i, 'It describes')
      .replace(/^"[^"]+"\s+would\b/i, 'It would')
      .replace(/^"[^"]+"\s+does\b/i, 'It does')
      .replace(/^"[^"]+"\s+adds\b/i, 'It adds')
      .replace(/^"[^"]+"\s+mixes\b/i, 'It mixes')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[\s.]+$/, '');

    return sanitized ? this.toSentence(sanitized) : '';
  },

  buildCorrectAnswerReason(question) {
    const options = Array.isArray(question?.options) ? question.options : [];
    const correctIndex = Number.isInteger(question?.correctAnswer) ? question.correctAnswer : -1;
    const correctText = correctIndex >= 0 ? this.getOptionDisplayText(options[correctIndex] || '') : '';
    const storedFeedback = this.cleanFeedbackText(question?.optionFeedback?.[correctIndex]);
    const explanationCandidates = this.getExplanationReasonCandidates(question);

    if (explanationCandidates.length > 0) {
      const combinedReference = `${correctText} ${this.getQuestionPlainText(question)}`.trim();
      let bestCandidate = '';
      let bestScore = 0;

      explanationCandidates.forEach((candidate) => {
        const score = Math.max(
          this.getKeywordOverlapScore(candidate, combinedReference),
          this.getKeywordOverlapScore(candidate, correctText)
        );

        if (score > bestScore) {
          bestCandidate = candidate;
          bestScore = score;
        }
      });

      const fallbackCandidate = explanationCandidates[0] || '';
      const teachingPoint = bestScore >= 0.16 ? bestCandidate : fallbackCandidate;
      const summarizedTeachingPoint = this.summarizeExplanationReason(teachingPoint);
      if (summarizedTeachingPoint) {
        return summarizedTeachingPoint;
      }
    }

    const conceptReason = this.summarizeExplanationReason(
      this.getCorrectConceptReason(question, correctText)
    );
    if (conceptReason) {
      return conceptReason;
    }

    const storedFeedbackLooksUseful = Boolean(
      storedFeedback &&
      this.normalizeStudyText(storedFeedback) !== this.normalizeStudyText(correctText) &&
      !/^this option best matches/i.test(storedFeedback)
    );
    if (storedFeedbackLooksUseful) {
      const summarizedStoredFeedback = this.summarizeExplanationReason(storedFeedback);
      if (summarizedStoredFeedback) {
        return summarizedStoredFeedback;
      }
    }

    return 'It fits the key fact pattern and matches the rule this question is testing.';
  },

  getRuleReminder(question) {
    const ruleText = this.toSentence(this.inferQuestionRule(question));
    if (!ruleText) return '';

    if (/Apply the governing LLQP product, contract, and tax rule to the exact facts in the scenario\./i.test(ruleText)) {
      return '';
    }

    return ruleText;
  },

  buildTopicLesson(question) {
    const sourceText = [
      this.getQuestionPlainText(question),
      Array.isArray(question?.options) ? question.options.map((option) => this.getOptionDisplayText(option)).join(' ') : '',
      String(question?.explanation || '')
    ].join(' ').toLowerCase();

    if (/mortality|probability of death|life expectancy|life table/.test(sourceText)) {
      return 'Separate annual mortality from life expectancy: males usually have higher yearly mortality, while females usually have longer life expectancy.';
    }

    if (/beneficiar|estate as beneficiary/.test(sourceText)) {
      return 'Read beneficiary questions in order: pay the primary beneficiary first, and use the contingent beneficiary only if the primary cannot receive the proceeds.';
    }

    if (/underwrit|insurab|temporary insurance agreement|tia|medical evidence|application/.test(sourceText)) {
      return 'For underwriting questions, identify who is being underwritten, then check whether riders or temporary coverage conditions add extra requirements.';
    }

    if (/capital gain|acb|gift|deemed disposition|non-registered/.test(sourceText)) {
      return 'Tax questions usually turn on ownership, adjusted cost base, and whether the transfer creates an immediate taxable disposition.';
    }

    if (/rrsp|rrif|lira|spousal rrsp|pension adjustment/.test(sourceText)) {
      return 'Registered-plan questions usually hinge on when deductions apply, who reports the income, and when withdrawals become taxable.';
    }

    if (/annuit|annuity|term certain|life annuity/.test(sourceText)) {
      return 'For annuities, separate who receives payments, how long payments last, and what happens to any guarantee period on death.';
    }

    if (
      /segregated fund|seg fund|segregated contract|segregated policy|maturity guarantee|guaranteed maturity value|reset/.test(sourceText) ||
      (/death benefit/.test(sourceText) && /segregated|guarantee|maturity|reset/.test(sourceText))
    ) {
      return 'Segregated-fund questions usually turn on which guarantee applies now: maturity, death benefit, or a reset-adjusted value.';
    }

    if (/charitable donation|charity|tax return|final return|terminal return/.test(sourceText)) {
      return 'For donation questions, calculate each tax year separately and apply that year’s claim limit instead of combining years into one total.';
    }

    if (/net per month|gross return|marginal tax|after-tax|support herself|principal amount of the death benefit/.test(sourceText)) {
      return 'For income-replacement calculations, convert the needed net income to a gross pre-tax return requirement, then solve for the principal amount and round as asked.';
    }

    if (/disabil|critical illness|long-term care|accident|sickness|elimination period|benefit period|offset/.test(sourceText)) {
      return 'Coverage questions usually come down to the trigger, the waiting period, and whether the policy conditions for payment are actually met.';
    }

    const ruleReminder = this.getRuleReminder(question);
    if (ruleReminder) {
      return ruleReminder;
    }

    return 'Focus on the exact fact the rule turns on, then eliminate choices that change that fact.';
  },

  compactStudySentence(value, maxLength = 120) {
    const cleaned = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.?!]+$/, '');

    if (!cleaned) return '';
    if (cleaned.length <= maxLength) return `${cleaned}.`;

    const naturalBreak = cleaned.search(/[:;]\s+/);
    if (naturalBreak > 28 && naturalBreak < maxLength) {
      return `${cleaned.slice(0, naturalBreak).trim()}.`;
    }

    const shortened = cleaned
      .slice(0, maxLength - 3)
      .trim()
      .replace(/[,;:]+$/, '');

    return `${shortened}...`;
  },

  buildBeginnerLesson(question, correctReason = '') {
    const topicLesson = this.compactStudySentence(this.buildTopicLesson(question), 118);
    if (topicLesson) {
      return topicLesson;
    }

    const reasonText = this.compactStudySentence(
      this.summarizeExplanationReason(correctReason) || correctReason,
      118
    );
    if (reasonText) {
      return reasonText;
    }

    return 'Match the answer to the key fact the question is testing.';
  },

  buildStudyTipPoints(question, correctReason = '') {
    const genericRuleText = 'Apply the governing LLQP product, contract, and tax rule to the exact facts in the scenario';
    const inferredRuleRaw = String(this.inferQuestionRule(question) || '').trim();
    const ruleBase = this.getRuleReminder(question)
      || (
        this.normalizeStudyText(inferredRuleRaw) === this.normalizeStudyText(genericRuleText)
          ? 'Match the answer to the exact fact in the question.'
          : inferredRuleRaw
      );
    const ruleText = this.compactStudySentence(
      String(ruleBase || '')
        .replace(/^Apply\s+/i, '')
        .replace(/^Use\s+/i, 'Use '),
      118
    );
    const mainIdea = this.compactStudySentence(this.buildBeginnerLesson(question, correctReason), 118);
    const rememberText = this.compactStudySentence(
      this.isExceptionQuestion(question)
        ? 'This is an exception question. Keep the one choice that breaks the normal rule.'
        : 'Pick the choice that fits the facts. Ignore answers that add extra details.',
      110
    );

    const seen = new Set();
    const points = [];
    const addPoint = (label, text) => {
      if (!text) return;
      const normalized = this.normalizeStudyText(text);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      points.push({ label, text });
    };

    addPoint('Main idea', mainIdea);
    addPoint('Use this rule', ruleText);
    addPoint('Remember', rememberText);

    return points;
  },

  buildWrongAnswerHint(question, optionIndex) {
    const optionText = this.getOptionDisplayText(question?.options?.[optionIndex] || '');
    const correctText = this.getOptionDisplayText(question?.options?.[question?.correctAnswer] || '');
    const mismatchReason = this.getSelectedMismatchReason(question, optionText, correctText);
    if (mismatchReason) {
      return this.toSentence(mismatchReason);
    }

    const rawFeedback = this.cleanFeedbackText(question?.optionFeedback?.[optionIndex]);
    if (this.isWrongAnswerFeedbackReliable(question, optionIndex, rawFeedback)) {
      const nonSpoilerFeedback = this.stripCorrectAnswerReveal(rawFeedback);
      if (nonSpoilerFeedback) {
        return nonSpoilerFeedback;
      }
    }

    const matchedExplanation = this.stripCorrectAnswerReveal(
      this.getExplanationReasonForOption(question, optionIndex)
    );
    if (matchedExplanation) {
      return matchedExplanation;
    }

    if (/\bneither\b/i.test(optionText)) {
      return 'This choice is too absolute. At least one part of the scenario still points to a different result.';
    }

    if (/\bboth\b|\ball of the above\b/i.test(optionText)) {
      return 'This choice is too broad. The facts support a narrower answer than this.';
    }

    if (/\bnone of the above\b/i.test(optionText)) {
      return 'This choice is too broad because one of the listed answers fits the rule better.';
    }

    if (/\b(always|never|only|must|cannot|can\'t|all)\b/i.test(optionText)) {
      return 'This choice states the rule too absolutely for the facts given.';
    }

    const numberPattern = /\$?\d[\d,]*(?:\.\d+)?%?|\b\d+\s*(?:days?|months?|years?)\b/gi;
    const selectedNumbers = optionText.match(numberPattern) || [];
    const correctNumbers = correctText.match(numberPattern) || [];
    if (selectedNumbers.length > 0 && correctNumbers.length > 0 && selectedNumbers.join('|') !== correctNumbers.join('|')) {
      return 'The amount, percentage, or time period in this choice is off.';
    }

    const fallbackHint = this.stripCorrectAnswerReveal(
      this.buildWrongAnswerFallback(question, optionIndex)
    );
    if (fallbackHint) {
      return fallbackHint;
    }

    const conceptLabel = this.getConceptLabel(question, optionText, correctText);
    return `This choice does not match the ${conceptLabel} the question is testing.`;
  },

  buildWrongAnswerReviewReason(question, optionIndex) {
    const optionText = this.getOptionDisplayText(question?.options?.[optionIndex] || '');
    const correctText = this.getOptionDisplayText(question?.options?.[question?.correctAnswer] || '');
    const mismatchReason = this.getSelectedMismatchReason(question, optionText, correctText);
    if (mismatchReason) {
      return this.summarizeExplanationReason(mismatchReason);
    }

    const rawFeedback = this.cleanFeedbackText(question?.optionFeedback?.[optionIndex]);
    if (this.isWrongAnswerFeedbackReliable(question, optionIndex, rawFeedback)) {
      const summarizedFeedback = this.summarizeExplanationReason(rawFeedback);
      if (summarizedFeedback) {
        return summarizedFeedback;
      }
    }

    const matchedExplanation = this.summarizeExplanationReason(
      this.getExplanationReasonForOption(question, optionIndex)
    );
    if (matchedExplanation) {
      return matchedExplanation;
    }

    const fallbackReason = this.summarizeExplanationReason(
      this.buildWrongAnswerFallback(question, optionIndex)
    );
    if (fallbackReason) {
      return fallbackReason;
    }

    return 'It does not fit the rule the question is testing.';
  },

  buildStepByStepExplanation(question) {
    if (!question) return null;

    const options = Array.isArray(question.options) ? question.options : [];
    const correctIndex = Number.isInteger(question.correctAnswer) ? question.correctAnswer : -1;
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const correctReason = this.buildCorrectAnswerReason(question);
    const studyTipPoints = this.buildStudyTipPoints(question, correctReason);
    const includeLesson = studyTipPoints.length > 0;
    const wrongChoices = options
      .map((option, index) => {
        if (index === correctIndex) return null;
        return {
          letter: letters[index] || String(index + 1),
          reason: this.buildWrongAnswerReviewReason(question, index)
        };
      })
      .filter(Boolean);

    return {
      sections: [
        {
          variant: 'correct',
          title: 'Why this is right',
          badge: correctIndex >= 0 ? (letters[correctIndex] || String(correctIndex + 1)) : '',
          badgeTone: 'correct',
          body: correctReason
        },
        ...(includeLesson ? [{
          variant: 'lesson',
          title: 'Remember this',
          points: studyTipPoints
        }] : []),
        {
          variant: 'review',
          title: 'Why other choices miss',
          summaryMeta: `${wrongChoices.length} short notes`,
          collapsible: true,
          items: wrongChoices
        }
      ]
    };
  },

  // Format explanation text into styled HTML
  formatExplanation(text) {
    if (!text) return '';

    if (typeof text === 'object' && Array.isArray(text.sections)) {
      const sectionsHtml = text.sections.map((section) => {
        if (!section) return '';

        if (Array.isArray(section.items)) {
          const itemsHtml = section.items.map((item) => `
              <li class="exp-choice-item">
                <span class="exp-choice-pill">${this.escapeHtml(item.letter || '')}</span>
                <p class="exp-choice-reason">${this.escapeHtml(item.reason || '')}</p>
              </li>
            `).join('');

          if (section.collapsible) {
            const summaryMetaHtml = section.summaryMeta
              ? `<span class="exp-disclosure-meta">${this.escapeHtml(section.summaryMeta)}</span>`
              : '';
            return `
              <details class="exp-disclosure">
                <summary class="exp-disclosure-summary">
                  <span class="exp-disclosure-summary-text">${this.escapeHtml(section.title || '')}</span>
                  ${summaryMetaHtml}
                </summary>
                <div class="exp-disclosure-body">
                  <ul class="exp-choice-list">
                    ${itemsHtml}
                  </ul>
                </div>
              </details>
            `;
          }

          return `
            <section class="exp-panel is-${this.escapeHtml(section.variant || 'default')}">
              <div class="exp-panel-head">
                <h4 class="exp-panel-title">${this.escapeHtml(section.title || '')}</h4>
              </div>
              <ul class="exp-choice-list">
                ${itemsHtml}
              </ul>
            </section>
          `;
        }

        if (Array.isArray(section.points)) {
          const pointsHtml = section.points.map((point) => `
              <div class="exp-study-point">
                <div class="exp-study-label">${this.escapeHtml(point.label || 'Study tip')}</div>
                <p class="exp-study-text">${this.escapeHtml(point.text || '')}</p>
              </div>
            `).join('');

          return `
            <section class="exp-panel is-${this.escapeHtml(section.variant || 'default')}">
              <div class="exp-panel-head">
                <h4 class="exp-panel-title">${this.escapeHtml(section.title || '')}</h4>
              </div>
              <div class="exp-study-points">
                ${pointsHtml}
              </div>
            </section>
          `;
        }

        const badgeHtml = section.badge
          ? `<span class="exp-badge is-${this.escapeHtml(section.badgeTone || 'default')}">${this.escapeHtml(section.badge)}</span>`
          : '';
        const noteHtml = section.note
          ? `<p class="exp-panel-note"><strong>Remember:</strong> ${this.escapeHtml(section.note)}</p>`
          : '';

        return `
          <section class="exp-panel is-${this.escapeHtml(section.variant || 'default')}">
            <div class="exp-panel-head">
              <h4 class="exp-panel-title">${this.escapeHtml(section.title || '')}</h4>
              ${badgeHtml}
            </div>
            <p class="exp-panel-text">${this.escapeHtml(section.body || '')}</p>
            ${noteHtml}
          </section>
        `;
      }).join('');

      return `
        <div class="exp-panels">
          ${sectionsHtml}
        </div>
      `;
    }
    
    // First, convert markdown tables to HTML tables
    let processedText = this.convertMarkdownTablesToHTML(text);
    
    // Escape HTML to prevent XSS (but preserve HTML from table conversion)
    const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Split by tables and non-tables to process separately
    const parts = processedText.split(/(<table[\s\S]*?<\/table>)/);
    
    let html = '';
    
    parts.forEach(part => {
      if (part.startsWith('<table')) {
        // Already HTML table, add as-is
        html += part;
        return;
      }
      
      const safeText = escapeHtml(part);
      
      // Split into paragraphs by double newlines
      const sections = safeText.split(/\n\n+/);
      
      sections.forEach(section => {
        const trimmed = section.trim();
        if (!trimmed) return;
        
        // Skip separator lines (━━━ or ─── or ---)
        if (/^[━─\-=]{5,}$/.test(trimmed)) {
          html += '<hr class="exp-divider">';
          return;
        }
        
        // Check if it's a heading-like line (all caps, emoji prefix, or ends with : or ?)
        const lines = trimmed.split('\n');
        const firstLine = lines[0].trim();
        
        // Detect section headers
        const isHeader = (
          /^[A-Z\s\d\?\!\:\"\']{10,}$/.test(firstLine.replace(/[^\w\s\?\!\:\"\']/g, '')) ||
          /^[\u{1F300}-\u{1FAFF}]/u.test(firstLine) ||
          /^(WHAT|WHY|HOW|KEY|QUICK|NOTE|ADDITIONAL|IMPORTANT|REMEMBER|TIP)/i.test(firstLine.replace(/[^\w\s]/g, ''))
        );
        
        if (isHeader && lines.length === 1) {
          // Standalone header
          html += `<h4 class="exp-heading">${firstLine}</h4>`;
          return;
        }
        
        if (isHeader && lines.length > 1) {
          // Header + content below
          html += `<h4 class="exp-heading">${firstLine}</h4>`;
          const rest = lines.slice(1);
          const hasBullets = rest.some(l => /^\s*[•\-\d️⃣]/.test(l.trim()));
          
          if (hasBullets) {
            html += '<ul class="exp-list">';
            rest.forEach(l => {
              const clean = l.trim().replace(/^[•\-]\s*/, '').replace(/^\d️⃣\s*/, '');
              if (clean) {
                // Bold the label before a colon
                const formatted = clean.replace(/^([^:]+):/, '<strong>$1:</strong>');
                html += `<li>${formatted}</li>`;
              }
            });
            html += '</ul>';
          } else {
            html += `<p class="exp-text">${rest.join('<br>')}</p>`;
          }
          return;
        }
        
        // Check if section is a bullet list
        const hasBullets = lines.some(l => /^\s*[•\-]\s/.test(l.trim()));
        if (hasBullets) {
          html += '<ul class="exp-list">';
          lines.forEach(l => {
            const clean = l.trim().replace(/^[•\-]\s*/, '');
            if (clean) {
              const formatted = clean.replace(/^([^:]+):/, '<strong>$1:</strong>');
              html += `<li>${formatted}</li>`;
            }
          });
          html += '</ul>';
          return;
        }

        // Check if section is a numbered list (1️⃣, 2️⃣, etc.)
        const hasNumberedEmoji = lines.some(l => /^\s*\d️⃣/.test(l.trim()));
        if (hasNumberedEmoji) {
          let currentItem = null;
          let subItems = [];
          
          const flushItem = () => {
            if (currentItem) {
              html += `<div class="exp-numbered-item"><div class="exp-numbered-title">${currentItem}</div>`;
              if (subItems.length) {
                html += '<ul class="exp-list">';
                subItems.forEach(s => {
                  const formatted = s.replace(/^([^:]+):/, '<strong>$1:</strong>');
                  html += `<li>${formatted}</li>`;
                });
                html += '</ul>';
              }
              html += '</div>';
            }
          };
          
          lines.forEach(l => {
            const t = l.trim();
            if (/^\d️⃣/.test(t)) {
              flushItem();
              currentItem = t;
              subItems = [];
            } else if (/^\s*[•\-]/.test(t)) {
              subItems.push(t.replace(/^[•\-]\s*/, ''));
            } else if (t) {
              if (currentItem) subItems.push(t);
              else html += `<p class="exp-text">${t}</p>`;
            }
          });
          flushItem();
          return;
        }
        
        // Regular paragraph
        html += `<p class="exp-text">${trimmed.replace(/\n/g, '<br>')}</p>`;
      });
    });
    
    return html;
  },

  // Check if all questions have been answered
  checkCompletion() {
    const filtered = this.getFilteredQuestions();
    const totalQ = filtered.length;
    const answeredCount = filtered.filter(q => this.state.answersRevealed.has(this.getQuestionStateKey(q))).length;
    const banner = document.getElementById('finish-banner');

    if (answeredCount === totalQ && totalQ > 0) {
      // Calculate score (first attempt correct)
      const correctFirst = filtered.filter(q => this.state.firstAttemptCorrect[this.getQuestionStateKey(q)] === true).length;
      const wrongFirst = filtered.filter(q => this.state.firstAttemptCorrect[this.getQuestionStateKey(q)] === false).length;
      const pct = Math.round((correctFirst / totalQ) * 100);
      const timeSummary = this.getCompletionTimeSummary(filtered);

      // Update banner with detailed stats
      document.getElementById('finish-correct').textContent = correctFirst;
      document.getElementById('finish-total').textContent = totalQ;
      document.getElementById('finish-percent').textContent = pct + '%';
      
      // Update detailed stats
      const statsEl = document.getElementById('finish-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="finish-stat"><span class="stat-label">Correct on 1st try:</span> <span class="stat-value">${correctFirst}</span></div>
          <div class="finish-stat"><span class="stat-label">Needed retry:</span> <span class="stat-value">${wrongFirst}</span></div>
          <div class="finish-stat"><span class="stat-label">Accuracy:</span> <span class="stat-value">${pct}%</span></div>
          <div class="finish-stat"><span class="stat-label">Total time:</span> <span class="stat-value">${timeSummary.totalElapsedLabel}</span></div>
          <div class="finish-stat"><span class="stat-label">Time goal:</span> <span class="stat-value">${timeSummary.recommendedTotalLabel} total</span></div>
          <div class="finish-stat"><span class="stat-label">Average / question:</span> <span class="stat-value">${timeSummary.averageQuestionLabel}</span></div>
          <div class="finish-stat"><span class="stat-label">Pace:</span> <span class="stat-value ${timeSummary.withinRecommended ? 'is-good' : 'is-warning'}">${this.escapeHtml(timeSummary.paceLabel)}</span></div>
        `;
      }

      if (banner) banner.classList.remove('hidden');
    } else {
      if (banner) banner.classList.add('hidden');
    }
  },

  // Retry current test from scratch
  async retryCurrentTest() {
    if (!this.state.currentPracticeTest) return;
    const testId = this.state.currentPracticeTest.id;
    
    // Clear progress for this test
    if (this.state.currentTopic && this.state.currentPracticeTest) {
      const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
      localStorage.removeItem(key);
      const shuffleKey = `shuffle_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
      localStorage.removeItem(shuffleKey);
    }
    this.state.viewedQuestions = new Set();
    this.state.bookmarkedQuestions = new Set();
    this.state.answersRevealed = new Set();
    this.stopQuestionTimer();
    this.state.questionElapsedMs = {};
    this.state.attemptedOptions = {};
    this.state.firstAttemptCorrect = {};
    this.state.lastSelectedIndex = undefined;
    this.state.lastSelectedQuestionKey = null;
    this.resetAdvanceTapState();
    this.state.currentQuestionIndex = 0;
    
    // Reload and reshuffle questions
    await this.loadQuestions(this.state.currentPracticeTest.dataFile || 
      this.state.currentTopic.practiceTests.find(t => t.id === testId)?.dataFile);
    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }
    this.renderQuestion();
  },

  // Get wrong answer feedback from question explanation
  getWrongAnswerFeedback(question, optionIndex) {
    return this.buildWrongAnswerHint(question, optionIndex);
  },

  trackOptionHover(optionIndex, pointerEvent = null) {
    if (!this.isHeatmapTrackingActive()) return;
    if (
      pointerEvent?.pointerType === 'touch'
      || String(pointerEvent?.type || '').startsWith('touch')
      || Boolean(pointerEvent?.touches?.length)
    ) {
      return;
    }
    const question = this.getCurrentQuestion();
    if (!question) return;
    const questionId = this.getQuestionStateKey(question);
    const hoverKey = `${questionId}:${optionIndex}`;
    const now = Date.now();
    const profile = this.getHeatmapTrackingProfile();
    if (this.state.analytics.hoverLastEventKey === hoverKey && (now - this.state.analytics.hoverLastAt) < profile.hoverSampleMs) {
      return;
    }
    this.state.analytics.hoverLastEventKey = hoverKey;
    this.state.analytics.hoverLastAt = now;

    let xPercent = null;
    let yPercent = null;
    const eventTarget = pointerEvent?.currentTarget || pointerEvent?.target;
    const targetEl = eventTarget && typeof eventTarget.getBoundingClientRect === 'function'
      ? eventTarget
      : document.querySelector(`#options-container .option[data-index="${optionIndex}"]`);
    if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
      const rect = targetEl.getBoundingClientRect();
      const eventX = Number(pointerEvent?.clientX ?? pointerEvent?.touches?.[0]?.clientX ?? (rect.left + (rect.width / 2)));
      const eventY = Number(pointerEvent?.clientY ?? pointerEvent?.touches?.[0]?.clientY ?? (rect.top + (rect.height / 2)));
      if (rect.width > 0 && rect.height > 0) {
        xPercent = ((eventX - rect.left) / rect.width) * 100;
        yPercent = ((eventY - rect.top) / rect.height) * 100;
      }
    }

    this.queueHeatmapEvent({
      type: 'hover',
      optionIndex,
      questionId,
      selector: `.option[data-index="${optionIndex}"]`,
      xPercent,
      yPercent
    });
  },

  // Select Option
  selectOption(selectedIndex, pointerEvent = null) {
    const question = this.getCurrentQuestion();
    if (!question) return;
    const stateKey = this.getQuestionStateKey(question);

    // Initialize tracking for this question if not exists
    if (!this.state.attemptedOptions[stateKey]) {
      this.state.attemptedOptions[stateKey] = [];
    }
    
    // Check if this option was already attempted
    const alreadyAttempted = this.state.attemptedOptions[stateKey].includes(selectedIndex);
    if (alreadyAttempted) {
      return; // Don't allow clicking the same wrong answer again
    }

    // Check if this is the first attempt for this question
    const isFirstAttempt = this.state.attemptedOptions[stateKey].length === 0;
    
    // Store selected answer index for AI explanation
    this.state.lastSelectedIndex = selectedIndex;
    this.state.lastSelectedQuestionKey = stateKey;

    let xPercent = null;
    let yPercent = null;
    const eventTarget = pointerEvent?.currentTarget || pointerEvent?.target;
    const targetEl = eventTarget && typeof eventTarget.getBoundingClientRect === 'function'
      ? eventTarget
      : document.querySelector(`#options-container .option[data-index="${selectedIndex}"]`);
    if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
      const rect = targetEl.getBoundingClientRect();
      const eventX = Number(pointerEvent?.clientX ?? pointerEvent?.touches?.[0]?.clientX ?? (rect.left + (rect.width / 2)));
      const eventY = Number(pointerEvent?.clientY ?? pointerEvent?.touches?.[0]?.clientY ?? (rect.top + (rect.height / 2)));
      if (rect.width > 0 && rect.height > 0) {
        xPercent = ((eventX - rect.left) / rect.width) * 100;
        yPercent = ((eventY - rect.top) / rect.height) * 100;
      }
    }

    this.queueHeatmapEvent({
      type: 'click',
      optionIndex: selectedIndex,
      questionId: stateKey,
      selector: `.option[data-index="${selectedIndex}"]`,
      xPercent,
      yPercent
    });

    // Check if correct answer
    const isCorrect = selectedIndex === question.correctAnswer;

    this.pauseQuestionTimer(stateKey);

    if (isFirstAttempt && !this.state.isReviewMode) {
      this.recordDailyPractice(isCorrect);
    }
    
    if (isCorrect) {
      // CORRECT ANSWER - Show full explanation and reveal
      
      // Track if first attempt was correct
      if (isFirstAttempt) {
        this.state.firstAttemptCorrect[stateKey] = true;
      }
      
      // In review mode, only clear the question if the user got it right
      // on the first try of this review pass. If they missed it again first,
      // keep it in the wrong-answer queue for future review.
      if (this.state.isReviewMode && isFirstAttempt) {
        this.removeFromWrongQuestions(question);
      }
      
      // Highlight correct option green, dim others
      const optionsContainer = document.getElementById('options-container');
      const options = optionsContainer.querySelectorAll('.option');
      options.forEach(option => {
        const idx = parseInt(option.getAttribute('data-index'));
        if (idx === question.correctAnswer) {
          option.classList.add('is-correct');
        } else if (!option.classList.contains('was-attempted')) {
          option.classList.add('is-dimmed');
        }
        option.style.pointerEvents = 'none';
      });
      
      // Show explanation
      const answerSection = document.getElementById('answer-section');
      document.getElementById('correct-answer-text').textContent = this.getOptionDisplayText(question.options[question.correctAnswer]);
      const explanationText = this.buildStepByStepExplanation(question);
      document.getElementById('explanation-text').innerHTML = this.formatExplanation(explanationText);

      // Display kidExplanation if available
      const kidExplanationBox = document.getElementById('kid-explanation-box');
      const kidExplanationText = document.getElementById('kid-explanation-text');
      console.log('📚 Kid Explanation Check:', {
        hasQuestion: !!question,
        hasKidExplanation: !!question.kidExplanation,
        kidBoxFound: !!kidExplanationBox,
        kidTextFound: !!kidExplanationText,
        kidExplanationPreview: question.kidExplanation?.substring(0, 50) || 'NONE'
      });

      if (question.kidExplanation && kidExplanationText) {
        kidExplanationText.innerHTML = this.formatExplanation(question.kidExplanation);
        kidExplanationBox.style.display = 'block';
        console.log('✅ Kid explanation displayed');
      } else if (kidExplanationBox) {
        kidExplanationBox.style.display = 'none';
        console.log('⚠️ Kid explanation not available for this question');
      }

      // Show AI button and ensure AI container is hidden until used
      this.resetAIExplanationUi(true);
      
      answerSection.classList.remove('hidden');

      // Show Next button after answering (unless it's the last question)
      const nextBtn = document.getElementById('next-question-btn');
      const nextBtnTop = document.getElementById('next-question-btn-top');
      const filtered = this.getFilteredQuestions();
      const isLastQuestion = this.state.currentQuestionIndex === filtered.length - 1;
      if (nextBtn && !isLastQuestion) {
        nextBtn.classList.remove('hidden');
      }
      if (nextBtnTop && !isLastQuestion) {
        nextBtnTop.classList.remove('hidden');
      }

      // Track answer reveal
      this.state.answersRevealed.add(stateKey);
      this.saveProgress();

      // Update dots to show answered state & check completion
      this.updateNavigationButtons();
      this.renderQuestionDots();
      this.checkCompletion();

      // Auto-advance to next question if enabled
      this.autoAdvanceNext();

      if (this.state.isReviewMode && !isFirstAttempt) {
        this.showToast('You corrected it this time, but it will stay in Review Wrong Answers because the first try was still wrong.', 'info');
      }
      
    } else {
      // WRONG ANSWER - Show individual feedback, don't reveal correct answer

      // In wrong-answer review mode, avoid visual elimination clues.
      // Keep one attempt per pass and move on.
      if (this.state.isReviewMode) {
        if (isFirstAttempt) {
          this.state.firstAttemptCorrect[stateKey] = false;
          this.logWrongAnswer(question);
          this.showToast('Incorrect. Stay on this question to review the feedback or ask AI before moving on.', 'warning');
        }

        this.state.attemptedOptions[stateKey].push(selectedIndex);
        this.renderQuestion();
        return;
      }
      
      // Add to attempted options
      this.state.attemptedOptions[stateKey].push(selectedIndex);
      
      // If this is the first attempt and it's wrong, log it as wrong
      if (isFirstAttempt) {
        this.state.firstAttemptCorrect[stateKey] = false;
        this.logWrongAnswer(question);
      }
      
      // Re-render to show the feedback for this wrong answer
      this.renderQuestion();
    }
  },

  extractAISections(rawText, isCorrect) {
    if (!rawText || typeof rawText !== 'string') return {};

    const text = rawText.replace(/\r/g, '').trim();
    const sectionPatterns = {
      mainExplanation: /\*\*?\s*MAIN_EXPLANATION\s*:?\s*\*\*?\s*([\s\S]*?)(?=(\*\*?\s*(WHY_CORRECT|WHY_INCORRECT|KEY_CONCEPT|STUDY_TIP|RELATED_CONCEPT)\s*:?\s*\*\*?)|$)/i,
      whyCorrect: /\*\*?\s*WHY_CORRECT\s*:?\s*\*\*?\s*([\s\S]*?)(?=(\*\*?\s*(WHY_INCORRECT|KEY_CONCEPT|STUDY_TIP|RELATED_CONCEPT)\s*:?\s*\*\*?)|$)/i,
      whyIncorrect: /\*\*?\s*WHY_INCORRECT\s*:?\s*\*\*?\s*([\s\S]*?)(?=(\*\*?\s*(KEY_CONCEPT|STUDY_TIP|RELATED_CONCEPT)\s*:?\s*\*\*?)|$)/i,
      keyConcept: /\*\*?\s*KEY_CONCEPT\s*:?\s*\*\*?\s*([\s\S]*?)(?=(\*\*?\s*(STUDY_TIP|RELATED_CONCEPT)\s*:?\s*\*\*?)|$)/i,
      studyTip: /\*\*?\s*STUDY_TIP\s*:?\s*\*\*?\s*([\s\S]*?)(?=(\*\*?\s*RELATED_CONCEPT\s*:?\s*\*\*?)|$)/i,
      relatedConcept: /\*\*?\s*RELATED_CONCEPT\s*:?\s*\*\*?\s*([\s\S]*)$/i,
    };

    const sections = {};
    for (const [key, pattern] of Object.entries(sectionPatterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        sections[key] = match[1].trim();
      }
    }

    if (!sections.mainExplanation) {
      const cleaned = text
        .replace(/\*\*?\s*(MAIN_EXPLANATION|WHY_CORRECT|WHY_INCORRECT|KEY_CONCEPT|STUDY_TIP|RELATED_CONCEPT)\s*:?\s*\*\*?/gi, '')
        .trim();
      sections.mainExplanation = cleaned;
    }

    if (isCorrect && !sections.whyCorrect) {
      sections.whyCorrect = 'You identified the correct principle and applied it correctly to the scenario.';
    }

    return sections;
  },

  normalizeAIResponse(data, isCorrect) {
    if (!data || typeof data !== 'object') return {};

    const parseEmbeddedJson = (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed.startsWith('{')) return null;
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        // Try extracting quoted fields from partial/truncated JSON-like text
        const pick = (key) => {
          const re = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?=",\\s*"|"\\s*}|$)`, 'i');
          const m = trimmed.match(re);
          return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : '';
        };
        const guessed = {
          mainExplanation: pick('mainExplanation'),
          whyCorrect: pick('whyCorrect'),
          whyIncorrect: pick('whyIncorrect'),
          keyConcept: pick('keyConcept'),
          studyTip: pick('studyTip'),
          relatedConcept: pick('relatedConcept'),
        };
        if (guessed.mainExplanation || guessed.whyCorrect || guessed.keyConcept) {
          return guessed;
        }
        return null;
      }
    };

    const hasStructured = data.mainExplanation || data.whyCorrect || data.keyConcept || data.studyTip || data.relatedConcept || (!isCorrect && data.whyIncorrect);
    if (hasStructured) {
      const embedded = parseEmbeddedJson(data.mainExplanation);
      if (embedded) {
        return {
          mainExplanation: embedded.mainExplanation || '',
          whyCorrect: embedded.whyCorrect || data.whyCorrect || '',
          whyIncorrect: embedded.whyIncorrect || data.whyIncorrect || '',
          keyConcept: embedded.keyConcept || data.keyConcept || '',
          studyTip: embedded.studyTip || data.studyTip || '',
          relatedConcept: embedded.relatedConcept || data.relatedConcept || '',
        };
      }
      return data;
    }

    const fallbackText = data.explanation || data.response || data.text || '';
    const embedded = parseEmbeddedJson(fallbackText);
    if (embedded) return embedded;
    return this.extractAISections(fallbackText, isCorrect);
  },

  formatAIText(text) {
    if (!text) return '';
    return this.escapeHtml(String(text).trim()).replace(/\n/g, '<br>');
  },

  // Generate AI Explanation
  async generateAIExplanation() {
    const question = this.getCurrentQuestion();
    if (!question) return;

    const selectedIndex = this.state.lastSelectedIndex;
    const stateKey = this.getQuestionStateKey(question);
    if (selectedIndex === undefined || this.state.lastSelectedQuestionKey !== stateKey) return;

    const aiButton = document.getElementById('get-ai-explanation-btn');
    const element = document.getElementById('ai-explanation-text');
    
    if (!element) return;

    // Show loading state and reveal AI container
    if (aiButton) aiButton.disabled = true;
    element.style.display = 'block';
    element.innerHTML = '<div class="loading-spinner">⏳ Generating comprehensive explanation...</div>';

    try {
      const userAnswer = question.options[selectedIndex];
      const correctAnswer = this.getOptionDisplayText(question.options[question.correctAnswer]);
      const isCorrect = selectedIndex === question.correctAnswer;
      
      // Build rich context for better explanations
      const optionFeedback = question.optionFeedback ? question.optionFeedback[selectedIndex] : null;
      const correctFeedback = question.optionFeedback ? question.optionFeedback[question.correctAnswer] : null;
      const difficulty = question.difficulty || 'Medium';
      const tags = question.tags ? question.tags.join(', ') : '';
      const examTips = this.state.currentTopic?.examTips || '';
      
      // Construct the API URL based on current location
      const apiUrl = this.getAIApiUrl();

      // Build comprehensive prompt with rich context
      const contextInfo = {
        question: question.question,
        userAnswer: userAnswer,
        correctAnswer: correctAnswer,
        options: question.options,
        isCorrect: isCorrect,
        difficulty: difficulty,
        tags: tags,
        optionFeedback: optionFeedback,
        correctFeedback: correctFeedback,
        explanation: question.explanation,
        examTips: examTips,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contextInfo),
      });

      if (!response.ok) {
        throw new Error(`AI request failed (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success) {
        const parsed = this.normalizeAIResponse(data, isCorrect);

        // Build enhanced explanation HTML with multiple sections
        let html = '<div class="ai-explanation-enhanced">';
        
        // Main explanation
        if (parsed.mainExplanation) {
          html += `<div class="ai-section ai-main">
            <div class="ai-section-title">💡 Explanation</div>
            <div class="ai-section-content">${this.formatAIText(parsed.mainExplanation)}</div>
          </div>`;
        }
        
        // Why correct answer is right
        if (parsed.whyCorrect) {
          html += `<div class="ai-section ai-correct">
            <div class="ai-section-title">✅ Why This Is Correct</div>
            <div class="ai-section-content">${this.formatAIText(parsed.whyCorrect)}</div>
          </div>`;
        }
        
        // Why selected was wrong (if incorrect)
        if (!isCorrect && parsed.whyIncorrect) {
          html += `<div class="ai-section ai-incorrect">
            <div class="ai-section-title">❌ Why Your Answer Wasn't Correct</div>
            <div class="ai-section-content">${this.formatAIText(parsed.whyIncorrect)}</div>
          </div>`;
        }
        
        // Key concept
        if (parsed.keyConcept) {
          html += `<div class="ai-section ai-concept">
            <div class="ai-section-title">🎯 Key Concept</div>
            <div class="ai-section-content">${this.formatAIText(parsed.keyConcept)}</div>
          </div>`;
        }
        
        // Study tip
        if (parsed.studyTip) {
          html += `<div class="ai-section ai-tip">
            <div class="ai-section-title">📚 Study Tip</div>
            <div class="ai-section-content">${this.formatAIText(parsed.studyTip)}</div>
          </div>`;
        }
        
        // Related concept (follow-up learning)
        if (parsed.relatedConcept) {
          html += `<div class="ai-section ai-related">
            <div class="ai-section-title">🔗 Related Concept</div>
            <div class="ai-section-content">${this.formatAIText(parsed.relatedConcept)}</div>
          </div>`;
        }
        
        html += '</div>';
        element.innerHTML = html;
        
        // Add follow-up composer so user can ask a specific question
        if (parsed.relatedConcept) {
          const composer = document.createElement('div');
          composer.className = 'follow-up-composer';
          composer.innerHTML = `
            <label for="follow-up-input" class="follow-up-label">Ask a specific follow-up question</label>
            <textarea id="follow-up-input" class="follow-up-input" rows="3" placeholder="Type your exact question here..."></textarea>
            <div class="follow-up-actions">
              <button class="btn-secondary btn-follow-up" data-action="ask-follow-up">🤔 Ask Another Question</button>
            </div>
          `;
          element.appendChild(composer);

          const askBtn = composer.querySelector('[data-action="ask-follow-up"]');
          const input = composer.querySelector('#follow-up-input');

          if (askBtn && input) {
            askBtn.addEventListener('click', () => {
              this.generateFollowUpExplanation(question, contextInfo, input.value);
            });
            input.addEventListener('keydown', (ev) => {
              if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
                ev.preventDefault();
                this.generateFollowUpExplanation(question, contextInfo, input.value);
              }
            });
          }
        }
        
        if (aiButton) aiButton.style.display = 'none';
      } else {
        element.innerHTML = '<div class="ai-error">⚠️ AI service temporarily unavailable</div>';
        console.error('AI Error:', data.error);
        if (aiButton) aiButton.disabled = false;
      }
    } catch (error) {
      console.error('Error generating AI explanation:', error);
      this.state.aiAvailable = false;
      element.innerHTML = '<div class="ai-error">⚠️ Could not connect to AI service. Check your connection.</div>';
      if (aiButton) aiButton.disabled = false;
    }
  },

  // Generate follow-up question or deeper explanation
  async generateFollowUpExplanation(question, contextInfo, customQuestion = '') {
    const element = document.getElementById('ai-explanation-text');
    if (!element) return;
    
    const followUpBtn = element.querySelector('.btn-follow-up');
    const followUpInput = element.querySelector('#follow-up-input');
    const trimmedQuestion = String(customQuestion || '').trim();

    if (!trimmedQuestion) {
      this.showToast('Please type your question first.', 'info');
      if (followUpInput) followUpInput.focus();
      return;
    }

    if (followUpBtn) followUpBtn.disabled = true;
    if (followUpInput) followUpInput.disabled = true;
    
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-spinner';
    loadingDiv.innerHTML = '⏳ Generating follow-up...';
    element.appendChild(loadingDiv);
    
    try {
      const apiUrl = this.getAIApiUrl();
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contextInfo,
          isFollowUp: true,
          followUpQuestion: trimmedQuestion,
          requestType: 'deeper_insight',
        }),
      });

      if (!response.ok) {
        throw new Error(`AI follow-up failed (${response.status})`);
      }
      
      const data = await response.json();
      if (data.success && data.followUpInsight) {
        const followUpHtml = `<div class="ai-section ai-followup">
          <div class="ai-section-title">🌟 Follow-up Answer</div>
          <div class="ai-followup-question">Q: ${this.formatAIText(trimmedQuestion)}</div>
          <div class="ai-section-content">${this.formatAIText(data.followUpInsight)}</div>
        </div>`;
        loadingDiv.remove();
        element.insertAdjacentHTML('beforeend', followUpHtml);
        if (followUpBtn) followUpBtn.disabled = false;
        if (followUpInput) {
          followUpInput.disabled = false;
          followUpInput.value = '';
          followUpInput.focus();
        }
      } else {
        loadingDiv.remove();
        if (followUpBtn) followUpBtn.disabled = false;
        if (followUpInput) followUpInput.disabled = false;
        this.showToast('Could not generate a follow-up answer right now.', 'warning');
      }
    } catch (error) {
      console.error('Follow-up error:', error);
      this.state.aiAvailable = false;
      loadingDiv.remove();
      if (followUpBtn) followUpBtn.disabled = false;
      if (followUpInput) followUpInput.disabled = false;
      this.showToast('Follow-up request failed. Please try again.', 'error');
    }
  },

  // Hide Answer
  hideAnswer() {
    const question = this.getCurrentQuestion();
    if (!question) return;
    const stateKey = this.getQuestionStateKey(question);
    const isRevealed = this.state.answersRevealed.has(stateKey);

    // If already revealed, keep lock state to prevent re-attempting answered questions.
    if (isRevealed) {
      const optionsContainerLocked = document.getElementById('options-container');
      if (optionsContainerLocked) {
        optionsContainerLocked.querySelectorAll('.option').forEach(option => {
          option.style.pointerEvents = 'none';
        });
      }
      document.getElementById('answer-section').classList.add('hidden');

      const nextBtnTopLocked = document.getElementById('next-question-btn-top');
      if (nextBtnTopLocked) {
        nextBtnTopLocked.classList.add('hidden');
      }
      return;
    }

    // Reset view (only for unanswered questions)
    const optionsContainer = document.getElementById('options-container');
    if (!optionsContainer) return;
    const options = optionsContainer.querySelectorAll('.option');
    options.forEach(option => {
      option.classList.remove('is-correct', 'is-incorrect', 'is-dimmed', 'was-attempted');
      option.style.pointerEvents = 'auto';
    });

    document.getElementById('answer-section').classList.add('hidden');
    
    // Hide the top next button
    const nextBtnTop = document.getElementById('next-question-btn-top');
    if (nextBtnTop) {
      nextBtnTop.classList.add('hidden');
    }
  },

  // Toggle Bookmark
  toggleBookmark() {
    const question = this.getCurrentQuestion();
    if (!question) return;
    const questionKey = this.getQuestionStateKey(question);

    if (this.state.bookmarkedQuestions.has(questionKey)) {
      this.state.bookmarkedQuestions.delete(questionKey);
    } else {
      this.state.bookmarkedQuestions.add(questionKey);
    }

    this.saveProgress();

    if (this.state.filterMode === 'bookmarked') {
      const filteredCount = this.getFilteredQuestions().length;

      if (filteredCount === 0) {
        this.state.filterMode = 'all';
        this.state.currentQuestionIndex = 0;
        const bookmarkedBtn = document.getElementById('bookmarked-only-btn');
        if (bookmarkedBtn) {
          bookmarkedBtn.textContent = '📌 Bookmarked Only';
        }
        this.showToast('No bookmarked questions left. Showing all questions again.', 'info');
      } else if (this.state.currentQuestionIndex >= filteredCount) {
        this.state.currentQuestionIndex = filteredCount - 1;
      }
    }

    this.renderQuestion();
  },

  // Toggle Filter Mode
  toggleFilterMode() {
    if (this.state.filterMode === 'all') {
      const bookmarkedCount = this.state.bookmarkedQuestions.size;
      if (bookmarkedCount === 0) {
        this.showToast('No bookmarked questions yet. Click ☆ to save questions.', 'info');
        return;
      }
      this.state.filterMode = 'bookmarked';
      document.getElementById('bookmarked-only-btn').textContent = '📋 Show All Questions';
    } else {
      this.state.filterMode = 'all';
      document.getElementById('bookmarked-only-btn').textContent = '📌 Bookmarked Only';
    }

    this.state.currentQuestionIndex = 0;
    this.renderQuestion();
  },

  // Show All Questions List
  showAllQuestions() {
    const listContainer = document.getElementById('questions-list');
    const filtered = this.getFilteredQuestions();

    listContainer.innerHTML = filtered.map((question, index) => {
      const questionKey = this.getQuestionStateKey(question);
      const isBookmarked = this.state.bookmarkedQuestions.has(questionKey);
      const isRevealed = this.state.answersRevealed.has(questionKey);

      return `
        <div class="list-question-card">
          <div class="list-question-header">
            <span class="list-question-num">Question ${index + 1}</span>
            ${isBookmarked ? '<span class="bookmark-indicator">⭐</span>' : ''}
          </div>
          <div class="list-question-text" style="overflow: auto;">${this.renderSafeTextWithTables(question.question)}</div>
          <div class="list-options">
            ${question.options.map((opt, i) => `
              <div class="list-option ${i === question.correctAnswer && isRevealed ? 'correct-preview' : ''}">
                ${this.escapeHtml(this.getOptionDisplayText(opt))}
              </div>
            `).join('')}
          </div>
          <button class="btn-jump" onclick="MCQApp.jumpToQuestionFromList(${index})">
            Practice This Question →
          </button>
        </div>
      `;
    }).join('');

    document.getElementById('list-topic-title').textContent = `${this.state.currentTopic.name} - All Questions`;
    this.showView('list');
  },

  // Jump to Question from List
  jumpToQuestionFromList(index) {
    this.state.currentQuestionIndex = index;
    this.showView('mcq');
    this.renderQuestion();
  },

  // Get Topic Progress
  getTopicProgress(topicId) {
    const topic = this.state.topics.find(t => t.id === topicId);
    if (!topic || !topic.practiceTests) return 0;

    let totalQuestions = 0;
    let totalAnswered = 0;

    this.getTopicPracticeUnits(topic).forEach(test => {
      if (test.questionCount > 0) {
        const key = `progress_${topicId}_${test.id}`;
        const saved = this.readJSONFromStorage(key, null);
        if (saved) {
          totalAnswered += Math.min((saved.revealed || []).length, test.questionCount);
        }
        totalQuestions += test.questionCount;
      }
    });

    if (totalQuestions === 0) return 0;
    return Math.round((totalAnswered / totalQuestions) * 100);
  },

  // Get Practice Test Progress
  getPracticeTestProgress(topicId, testId) {
    const key = `progress_${topicId}_${testId}`;
    const saved = this.readJSONFromStorage(key, null);
    if (!saved) return 0;

    const topic = this.state.topics.find(t => t.id === topicId);
    if (!topic) return 0;

    const test = this.findPracticeTestById(topic, testId);
    if (!test || test.questionCount === 0) return 0;

    const answered = Math.min((saved.revealed || []).length, test.questionCount);
    return Math.round((answered / test.questionCount) * 100);
  },

  // Save Progress
  saveProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) return;
    if (!this.state.currentTopic.id || !this.state.currentPracticeTest.id) return;

    const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
    const currentQuestion = this.getCurrentQuestion();
    const data = {
      viewed: Array.from(this.state.viewedQuestions),
      bookmarked: Array.from(this.state.bookmarkedQuestions),
      revealed: Array.from(this.state.answersRevealed),
      timers: this.getQuestionTimersSnapshot(),
      attemptedOptions: this.state.attemptedOptions,
      firstAttemptCorrect: this.state.firstAttemptCorrect,
      questionLayout: this.buildQuestionLayoutSnapshot(),
      questionLayoutSignature: this.state.loadedQuestionSourceSignature || null,
      filterMode: this.state.filterMode,
      currentQuestionIndex: this.state.currentQuestionIndex,
      currentQuestionKey: currentQuestion ? this.getQuestionStateKey(currentQuestion) : null,
      lastUpdated: new Date().toISOString()
    };

    if (!this.setStorageItemWithRecovery(key, JSON.stringify(data))) {
      return;
    }
    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }
  },

  getResumeQuestionIndex(questions = this.state.questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return 0;
    }

    const firstUntouchedIndex = questions.findIndex((question) => {
      const questionKey = this.getQuestionStateKey(question);
      return !this.state.viewedQuestions.has(questionKey) && !this.state.answersRevealed.has(questionKey);
    });
    if (firstUntouchedIndex >= 0) {
      return firstUntouchedIndex;
    }

    const firstUnansweredIndex = questions.findIndex((question) => {
      const questionKey = this.getQuestionStateKey(question);
      return !this.state.answersRevealed.has(questionKey);
    });
    if (firstUnansweredIndex >= 0) {
      return firstUnansweredIndex;
    }

    return 0;
  },

  // Load Progress
  loadProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) {
      this.state.viewedQuestions = new Set();
      this.state.bookmarkedQuestions = new Set();
      this.state.answersRevealed = new Set();
      this.state.questionElapsedMs = {};
      this.state.attemptedOptions = {};
      this.state.firstAttemptCorrect = {};
      this.state.filterMode = 'all';
      this.state.currentQuestionIndex = 0;
      return;
    }

    if (!this.state.currentTopic.id || !this.state.currentPracticeTest.id) {
      this.state.viewedQuestions = new Set();
      this.state.bookmarkedQuestions = new Set();
      this.state.answersRevealed = new Set();
      this.state.questionElapsedMs = {};
      this.state.attemptedOptions = {};
      this.state.firstAttemptCorrect = {};
      this.state.filterMode = 'all';
      this.state.currentQuestionIndex = 0;
      return;
    }

    const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
    const saved = this.readJSONFromStorage(key, null);
    if (saved) {
      this.state.viewedQuestions = new Set(saved.viewed || []);
      this.state.bookmarkedQuestions = new Set(saved.bookmarked || []);
      this.state.answersRevealed = new Set(saved.revealed || []);
      this.state.questionElapsedMs = saved.timers && typeof saved.timers === 'object' ? { ...saved.timers } : {};
      this.state.attemptedOptions = saved.attemptedOptions && typeof saved.attemptedOptions === 'object'
        ? JSON.parse(JSON.stringify(saved.attemptedOptions))
        : {};
      this.state.firstAttemptCorrect = saved.firstAttemptCorrect && typeof saved.firstAttemptCorrect === 'object'
        ? { ...saved.firstAttemptCorrect }
        : {};
      this.state.filterMode = saved.filterMode === 'bookmarked' ? 'bookmarked' : 'all';
    } else {
      this.state.viewedQuestions = new Set();
      this.state.bookmarkedQuestions = new Set();
      this.state.answersRevealed = new Set();
      this.state.questionElapsedMs = {};
      this.state.attemptedOptions = {};
      this.state.firstAttemptCorrect = {};
      this.state.filterMode = 'all';
    }

    const filteredQuestions = this.getFilteredQuestions();
    const savedQuestionKey = saved?.currentQuestionKey ? String(saved.currentQuestionKey) : '';
    const savedQuestionIndex = Number.isInteger(saved?.currentQuestionIndex) ? saved.currentQuestionIndex : -1;
    const savedQuestionPosition = savedQuestionKey
      ? filteredQuestions.findIndex((question) => this.getQuestionStateKey(question) === savedQuestionKey)
      : -1;

    if (savedQuestionPosition >= 0) {
      this.state.currentQuestionIndex = savedQuestionPosition;
      return;
    }

    if (filteredQuestions.length > 0 && savedQuestionIndex >= 0) {
      this.state.currentQuestionIndex = Math.max(0, Math.min(savedQuestionIndex, filteredQuestions.length - 1));
      return;
    }

    if (this.state.filterMode === 'bookmarked' && filteredQuestions.length === 0) {
      this.state.filterMode = 'all';
    }

    this.state.currentQuestionIndex = this.getResumeQuestionIndex(this.getFilteredQuestions());
  },

  async resetProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) return;

    if (this.state.isReviewMode) {
      if (!confirm('Reset this review session?')) {
        return;
      }
      this.stopQuestionTimer();
      this.state.viewedQuestions.clear();
      this.state.bookmarkedQuestions.clear();
      this.state.answersRevealed.clear();
      this.state.questionElapsedMs = {};
      this.state.attemptedOptions = {};
      this.state.firstAttemptCorrect = {};
      this.state.lastSelectedIndex = undefined;
      this.state.lastSelectedQuestionKey = null;
      this.resetAdvanceTapState();
      this.state.currentQuestionIndex = 0;
      if (typeof this.scheduleProgressSync === 'function') {
        this.scheduleProgressSync();
      }
      this.renderQuestion();
      this.showToast('Review session reset.', 'success');
      return;
    }

    if (!confirm('Are you sure you want to reset all progress for this practice test? This cannot be undone.')) {
      return;
    }

    const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
    localStorage.removeItem(key);
    
    // Clear saved shuffle order so questions will be re-randomized
    const shuffleKey = `shuffle_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
    localStorage.removeItem(shuffleKey);
    
    this.stopQuestionTimer();
    this.state.viewedQuestions.clear();
    this.state.bookmarkedQuestions.clear();
    this.state.answersRevealed.clear();
    this.state.questionElapsedMs = {};
    this.state.attemptedOptions = {};
    this.state.firstAttemptCorrect = {};
    this.state.lastSelectedIndex = undefined;
    this.state.lastSelectedQuestionKey = null;
    this.resetAdvanceTapState();
    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }

    // Hide finish banner
    const banner = document.getElementById('finish-banner');
    if (banner) banner.classList.add('hidden');

    this.state.currentQuestionIndex = 0;
    const previousQuestions = this.state.questions.slice();

    this.beginLoading('Resetting progress...');
    try {
      await this.loadQuestions(this.state.currentPracticeTest.dataFile, this.state.currentPracticeTest.id);
      if (this.state.questions.length === 0 && previousQuestions.length > 0) {
        this.state.questions = previousQuestions;
        this.showToast('Progress was reset, but a fresh question order could not be loaded right now.', 'warning');
      }
    } finally {
      this.endLoading();
    }

    this.renderQuestion();
    this.showToast('Progress reset successfully.', 'success');
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  MCQApp.init();
});
 
 
