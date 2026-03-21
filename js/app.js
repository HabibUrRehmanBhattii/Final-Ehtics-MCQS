// ===================================
// MCQ Study Platform - Main Application
// ===================================

const MCQApp = {
  shuffleSchemaVersion: '20260321-option-cleanup-v2',
  // State Management
  state: {
    topics: [],
    currentTopic: null,
    currentPracticeTest: null,
    questions: [],
    currentQuestionIndex: 0,
    bookmarkedQuestions: new Set(),
    viewedQuestions: new Set(),
    answersRevealed: new Set(),
    currentView: 'home',
    filterMode: 'all', // 'all' or 'bookmarked'
    wrongQuestions: [],
    lastSelectedIndex: undefined,
    lastSelectedQuestionKey: null,
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
    auth: {
      available: false,
      authenticated: false,
      loading: false,
      error: '',
      user: null,
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

  normalizeQuestionOptionLabels(question) {
    if (!question || !Array.isArray(question.options)) return question;
    return {
      ...question,
      options: question.options.map((option) => this.getOptionDisplayText(option))
    };
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
      <div class="toast-title">${resolvedTitle}</div>
      <div class="toast-message">${message}</div>
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

    // Set up review mode
    this.state.questions = wrongQuestionsToReview;
    this.state.currentQuestionIndex = 0;
    this.state.filterMode = 'all';
    this.state.currentTopic = { name: 'Wrong Answers Review', icon: '❌' };
    this.state.currentPracticeTest = { name: 'Review Mode' };
    this.state.isReviewMode = true;
    
    // Don't track progress for review mode
    this.state.viewedQuestions = new Set();
    this.state.bookmarkedQuestions = new Set();
    this.state.answersRevealed = new Set();
    
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
    this.renderTopicsGrid();
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
        .register('/sw.js?v=20260321b')
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
    let totalViewed = 0;

    units.forEach(({ topic, test }) => {
      const questions = Number(test.questionCount || 0);
      const progressKey = `progress_${topic.id}_${test.id}`;
      const saved = this.readJSONFromStorage(progressKey, null);
      const viewed = Math.min((saved?.viewed || []).length, questions);

      totalQuestions += questions;
      totalViewed += viewed;
      if (questions > 0 && viewed >= questions) {
        completedCourses += 1;
      }
    });

    const overallProgress = totalQuestions > 0 ? Math.round((totalViewed / totalQuestions) * 100) : 0;
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

  getLastSession() {
    const session = this.readJSONFromStorage('last_session', null);
    if (!session?.topicId || !session?.testId) return null;

    const topic = this.state.topics.find((t) => t.id === session.topicId);
    if (!topic) return null;

    const directTest = topic.practiceTests?.find((t) => t.id === session.testId);
    if (directTest) {
      return { topic, test: directTest, parentTest: null };
    }

    const parentTest = topic.practiceTests?.find((t) =>
      Array.isArray(t.subTests) && t.subTests.some((sub) => sub.id === session.testId)
    );
    const subTest = parentTest?.subTests?.find((sub) => sub.id === session.testId);
    if (parentTest && subTest) {
      return { topic, test: subTest, parentTest };
    }

    return null;
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
    const session = this.getLastSession();
    if (!session) {
      this.showToast('No saved session found yet. Start a test first.', 'info');
      return;
    }

    const { topic, test, parentTest } = session;
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

  renderHomeFocus() {
    const host = document.getElementById('home-focus');
    if (!host) return;

    const stats = this.getHomeStudyStats();
    const session = this.getLastSession();
    const daily = this.getDailyStudyStats();
    const recommended = this.getRecommendedPracticeUnit();
    const wrongCount = this.state.wrongQuestions.length;

    let title = 'Pick a topic and start.';
    let meta = `${stats.totalCourses} topics ready`;
    let primaryLabel = 'Browse topics';
    let primaryAction = "document.getElementById('topics-grid').scrollIntoView({ behavior: 'smooth', block: 'start' })";

    if (session) {
      title = `${session.topic.name}: ${session.test.name}`;
      meta = 'Continue where you left off';
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
          <div class="focus-stat">
            <span>Today</span>
            <strong>${daily.todayAnswered}</strong>
          </div>
          <div class="focus-stat">
            <span>Streak</span>
            <strong>${daily.streak || 0}d</strong>
          </div>
          <div class="focus-stat">
            <span>Progress</span>
            <strong>${stats.overallProgress}%</strong>
          </div>
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
      
      return `
        <div class="topic-card topic-list-item ${isCompact ? 'compact-topic' : ''} ${!isActive ? 'coming-soon' : ''}" 
             ${isActive ? `onclick="MCQApp.selectTopic('${topic.id}')"` : ''}
             style="--topic-color: ${topic.color}">
          <div class="topic-card-top">
            <div class="topic-icon">${topic.icon}</div>
          </div>
          <div class="topic-list-copy">
            <h3 class="topic-name">${topic.name}</h3>
            <p class="topic-description">${topic.description}</p>
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
      <div class="catalog-shell" style="--topic-color: ${topic.color}">
        <div class="catalog-breadcrumb">${topic.name} / Chapter Quizzes / ${parentTest.name}</div>
        <h3 class="catalog-heading">${parentTest.name}</h3>
        <p class="muted-text">Choose a smaller section below.</p>
        <button class="btn-outline" onclick="MCQApp.backToPracticeTests()" style="margin-bottom:.75rem;">
          ← Back to Chapter Quizzes
        </button>

        <div class="catalog-courses is-list">
          ${items.map((test, index) => {
            const testProgress = this.getPracticeTestProgress(topic.id, test.id);
            return `
              <div class="practice-test-card"
                   onclick="MCQApp.selectSubPracticeTest('${parentTest.id}', '${test.id}')"
                   style="--topic-color: ${topic.color}">
                <div class="test-number">${index + 1}</div>
                <h3 class="test-name">${test.name}</h3>
                <p class="test-description">${test.description}</p>
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
          <div class="catalog-shell" style="--topic-color: ${topic.color}">
            <div class="catalog-breadcrumb">${topic.name}</div>
            <h3 class="catalog-heading">Choose a Sub Heading</h3>
            <div class="catalog-subgrid">
              ${sections.map(section => `
                <div class="catalog-subcard" style="--topic-color: ${topic.color}">
                  <div class="catalog-subtitle">${section.title}</div>
                  <div class="catalog-subdesc">${section.description}</div>
                  <div class="catalog-submeta">
                    <span class="catalog-chip">${section.count} Course${section.count !== 1 ? 's' : ''}</span>
                  </div>
                  <button class="btn-start-test" onclick="MCQApp.setLifeSection('${section.id}')">
                    Open ${section.title} →
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
               ${isActive ? `onclick="MCQApp.selectPracticeTest('${test.id}')"` : ''}
               style="--topic-color: ${topic.color}">
            <div class="test-number">${index + 1}</div>
            <h3 class="test-name">${test.name}</h3>
            <p class="test-description">${test.description}</p>
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
        <div class="catalog-shell" style="--topic-color: ${topic.color}">
          <div class="catalog-breadcrumb">${topic.name} / ${selectedSection.title}</div>
          <h3 class="catalog-heading">${selectedSection.title}</h3>
          <button class="btn-outline" onclick="MCQApp.setLifeSection(null)" style="margin-bottom:.75rem;">
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
             ${isActive ? `onclick="MCQApp.selectPracticeTest('${test.id}')"` : ''}
             style="--topic-color: ${topic.color}">
          <div class="test-number">${index + 1}</div>
          <h3 class="test-name">${test.name}</h3>
          <p class="test-description">${test.description}</p>
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
      
      // Check if we have a saved shuffled order for this test
      const shuffleKey = `shuffle_${this.state.currentTopic?.id}_${testId}`;
      const sourceSignature = this.getQuestionContentSignature(data.questions);
      const savedShuffleData = this.getSavedShuffleData(shuffleKey);
      const savedShuffle = savedShuffleData?.questions || null;
      const savedShuffleNeedsCleanup = this.hasPrefixedOptionLabels(savedShuffle || []);
      const canReuseSavedShuffle = Boolean(
        savedShuffle &&
        savedShuffle.length === data.questions.length &&
        savedShuffleData?.version === this.shuffleSchemaVersion &&
        savedShuffleData?.signature &&
        savedShuffleData.signature === sourceSignature &&
        !savedShuffleNeedsCleanup
      );
      
      // If we have saved shuffle data, use it; otherwise create new shuffle
      if (canReuseSavedShuffle) {
        console.log('Using saved question order');
        this.state.questions = savedShuffle.map((question) => this.normalizeQuestionOptionLabels(question));
      } else {
        console.log('Creating new randomized order');
        // Randomize questions order
        const shuffledQuestions = this.shuffleArray(data.questions);
        
        // Randomize answer options for each question
        this.state.questions = shuffledQuestions.map(question => {
          // Normalize option labels so the UI can render its own A/B/C/D badge cleanly.
          const optionsWithoutPrefix = question.options.map(opt => 
            this.getOptionDisplayText(opt)
          );
          
          const originalCorrectAnswer = question.correctAnswer;
          
          // Create array of indices and shuffle them
          const indices = optionsWithoutPrefix.map((_, index) => index);
          const shuffledIndices = this.shuffleArray(indices);
          
          // Shuffle options without embedding letter prefixes in the text itself.
          const shuffledOptions = shuffledIndices.map((originalIndex, newIndex) => {
            return optionsWithoutPrefix[originalIndex];
          });
          
          // Find new position of correct answer
          const newCorrectAnswer = shuffledIndices.indexOf(originalCorrectAnswer);
          
          return this.normalizeQuestionOptionLabels({
            ...question,
            options: shuffledOptions,
            correctAnswer: newCorrectAnswer
          });
        });
        
        // Save the shuffled order
        this.saveShuffleData(shuffleKey, this.state.questions, sourceSignature);
      }
      
      console.log(`Loaded ${this.state.questions.length} questions`);
    } catch (error) {
      console.error('Error loading questions:', error);
      this.state.questions = [];
      this.showToast('Unable to load questions right now.', 'error');
    }
  },

  // Show View
  showView(viewName) {
    this.clearAutoAdvanceTimer();
    if (viewName !== 'mcq') {
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
      'pdf': 'pdf-view'
    };

    const targetView = document.getElementById(viewMap[viewName]);
    if (targetView) {
      targetView.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'home') {
      this.renderTopicsGrid();
    }
  },

  // Render Current Question
  renderQuestion() {
    this.clearAutoAdvanceTimer();
    this.stopSpeech();
    const question = this.getCurrentQuestion();
    if (!question) return;
    const stateKey = this.getQuestionStateKey(question);

    const questionIndex = this.state.currentQuestionIndex;
    const totalQuestions = this.getFilteredQuestions().length;

    // Update header
    document.getElementById('topic-title').textContent = this.state.currentTopic.name;
    document.getElementById('current-question-num').textContent = questionIndex + 1;
    document.getElementById('total-questions').textContent = totalQuestions;

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
      const feedbackText = (this.state.isReviewMode)
        ? ''
        : (wasAttempted && !isRevealed ? this.getWrongAnswerFeedback(question, index) : '');
      const feedbackHtml = feedbackText ? `
            <div class="option-feedback">
              <p>${this.escapeHtml(feedbackText)}</p>
            </div>
          ` : '';
      
      return `
        <div class="option ${wasAttempted ? 'was-attempted' : ''} ${isRevealed && isCorrect ? 'is-correct' : ''} ${isFocused ? 'is-focused' : ''} ${dimmedClass}" 
             data-index="${index}" 
             tabindex="0"
             onclick="MCQApp.selectOption(${index})">
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
      answerSection.classList.remove('hidden');
      optionsContainer.querySelectorAll('.option').forEach(opt => {
        opt.style.pointerEvents = 'none';
      });
    }

    // Mark as viewed
    this.state.viewedQuestions.add(stateKey);
    this.saveProgress();

    // Update navigation buttons
    this.updateNavigationButtons();
    this.renderQuestionDots();

    // Hide Next until answered; always hide on last question (finish banner handles it)
    const nextBtn = document.getElementById('next-question-btn');
    const hasAnswered = this.state.answersRevealed.has(stateKey);
    const isLastQ = this.state.currentQuestionIndex === this.getFilteredQuestions().length - 1;
    if (nextBtn) {
      nextBtn.classList.toggle('hidden', !hasAnswered || isLastQ);
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

    // Scroll to top on question change
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Check if all questions have been answered — show/hide finish banner
    this.checkCompletion();
  },

  // Build speech text for current question
  buildSpeechText(question) {
    const optionsText = question.options
      .map((opt, idx) => `Option ${idx + 1}: ${this.getOptionDisplayText(opt)}`)
      .join('. ');
    return `Question. ${question.question}. ${optionsText}`;
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
      
      // Validate table format (must have at least 3 lines: header, separator, data)
      if (lines.length < 3 || !lines[1].match(/^\s*\|?[\s\-|:]+\|?[\s\-|:]*$/)) {
        return part; // Not a valid markdown table
      }
      
      try {
        // Parse headers
        const headers = lines[0]
          .split('|')
          .map(h => h.trim())
          .filter(h => h);
        
        // Parse data rows
        const rows = lines.slice(2).map(line => 
          line.split('|')
            .map(cell => cell.trim())
            .filter((cell, idx) => idx < headers.length)
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
    localStorage.setItem(shuffleKey, JSON.stringify({
      version: this.shuffleSchemaVersion,
      signature,
      questions
    }));
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

  // Navigate Question
  navigateQuestion(direction) {
    const filtered = this.getFilteredQuestions();
    const newIndex = this.state.currentQuestionIndex + direction;
    
    if (newIndex >= 0 && newIndex < filtered.length) {
      this.state.currentQuestionIndex = newIndex;
      this.renderQuestion();
    }
  },

  // Update Navigation Buttons
  updateNavigationButtons() {
    const filtered = this.getFilteredQuestions();
    const prevBtn = document.getElementById('prev-question-btn');
    const nextBtn = document.getElementById('next-question-btn');

    if (!prevBtn || !nextBtn) return;

    prevBtn.disabled = this.state.currentQuestionIndex === 0;
    nextBtn.disabled = this.state.currentQuestionIndex === filtered.length - 1;
  },

  // Render Question Dots with Pagination
  renderQuestionDots() {
    const dotsContainer = document.getElementById('question-dots');
    const filtered = this.getFilteredQuestions();
    const totalQuestions = filtered.length;
    const currentIndex = this.state.currentQuestionIndex;
    
    // For mobile/small screens: show only 5 dots at a time in a window
    // For desktop: show more dots (up to 12)
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
                onclick="MCQApp.jumpToQuestion(${Math.max(0, windowStart - dotsPerWindow)})"
                aria-label="Previous questions">
          ‹
        </button>
      `;
    }
    
    // Add question dots for current window
    for (let i = windowStart; i < windowEnd; i++) {
      const q = filtered[i];
      const isActive = i === currentIndex;
      const questionKey = this.getQuestionStateKey(q);
      const isBookmarked = this.state.bookmarkedQuestions.has(questionKey);
      const isViewed = this.state.viewedQuestions.has(questionKey);
      const isAnswered = this.state.answersRevealed.has(questionKey);
      const wasFirstCorrect = this.state.firstAttemptCorrect[questionKey];
      const dotStateClass = isAnswered ? (wasFirstCorrect ? 'is-correct-dot' : 'is-wrong-dot') : '';
      const dotContent = isAnswered ? '' : (isBookmarked ? '⭐' : i + 1);
      
      html += `
        <button class="question-dot ${isActive ? 'is-active' : ''} ${isViewed ? 'is-viewed' : ''} ${isBookmarked ? 'is-bookmarked' : ''} ${dotStateClass}"
                onclick="MCQApp.jumpToQuestion(${i})"
                title="Question ${i + 1}${isAnswered ? (wasFirstCorrect ? ' - Correct' : ' - Wrong') : ''}"
                aria-label="Question ${i + 1}${isAnswered ? (wasFirstCorrect ? ' - Correct' : ' - Wrong') : ''}">
          ${dotContent}
        </button>
      `;
    }
    
    // Add next window button if not last window
    if (windowEnd < totalQuestions) {
      html += `
        <button class="dot-nav-btn dot-nav-next" 
                onclick="MCQApp.jumpToQuestion(${Math.min(windowEnd, totalQuestions - 1)})"
                aria-label="Next questions">
          ›
        </button>
      `;
    }
    
    dotsContainer.innerHTML = html;
  },

  // Jump to Question
  jumpToQuestion(index) {
    this.state.currentQuestionIndex = index;
    this.renderQuestion();
  },

  buildStepByStepExplanation(question) {
    if (!question) return '';

    const options = Array.isArray(question.options) ? question.options : [];
    const feedback = Array.isArray(question.optionFeedback) ? question.optionFeedback : [];
    const correctIndex = Number.isInteger(question.correctAnswer) ? question.correctAnswer : -1;
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const plainQuestion = String(question.question || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const rawExplanation = String(question.explanation || '').trim();

    const toSentence = (value) => {
      const cleaned = String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[\s.]+$/, '');
      if (!cleaned) return '';
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) + '.';
    };

    const cleanOptionText = (value) => this.getOptionDisplayText(value)
      .replace(/[\s.]+$/, '');

    const cleanFeedback = (value) => String(value || '')
      .replace(/^Incorrect\.\s*/i, '')
      .trim()
      .replace(/\.+$/, '');

    const getQuestionFocus = () => {
      const parts = plainQuestion.split(/(?<=[.?!])\s+/).filter(Boolean);
      const target = [...parts].reverse().find((line) =>
        /\?$/.test(line) || /(which|what|how much|who|best|correct|most likely|following)/i.test(line)
      ) || parts[parts.length - 1] || 'Determine the best answer based on the scenario facts';
      return toSentence(target);
    };

    const inferRule = () => {
      const q = plainQuestion.toLowerCase();
      if (/beneficiar|contingent|estate|life insured|policyholder/.test(q)) {
        return 'Use beneficiary-order rules: proceeds go to the named beneficiary first, and the contingent beneficiary applies only if the primary beneficiary predeceases the life insured';
      }
      if (/capital gain|acb|gift|deemed disposition|non-registered/.test(q)) {
        return 'Apply capital-gains tax rules, including deemed disposition and adjusted cost base treatment where relevant';
      }
      if (/rrsp|rrif|lira|spousal rrsp|pension adjustment/.test(q)) {
        return 'Apply registered-plan contribution and withdrawal rules, including attribution and taxation at withdrawal where applicable';
      }
      if (/annuit|annuity|term certain|life annuity/.test(q)) {
        return 'Apply annuity contract rules on payment guarantees, beneficiary rights, and taxation of annuity income';
      }
      if (/segregated fund|guarantee|reset|maturity|death benefit/.test(q)) {
        return 'Apply segregated-fund guarantee rules, including resets, maturity/death guarantees, and beneficiary treatment';
      }
      if (/mortality|probability of death|life expectancy|life table/.test(q)) {
        return 'Apply mortality and life-table concepts to distinguish probability of death from life expectancy';
      }
      return 'Apply the governing LLQP product, contract, and tax rule to the exact facts in the scenario';
    };

    const wrongReasons = [];
    options.forEach((_, i) => {
      if (i === correctIndex) return;
      const reason = cleanFeedback(feedback[i]);
      const optionLabel = letters[i] || String(i + 1);
      const optionText = cleanOptionText(options[i]);
      if (reason) {
        wrongReasons.push(`Option ${optionLabel}: ${toSentence(reason).replace(/\.$/, '')}`);
      } else {
        wrongReasons.push(`Option ${optionLabel}: "${optionText}" does not match what the question is specifically asking`);
      }
    });

    const correctLabel = correctIndex >= 0 ? (letters[correctIndex] || String(correctIndex + 1)) : '?';
    const correctText = correctIndex >= 0 ? cleanOptionText(options[correctIndex]) : '';
    const correctFeedback = cleanFeedback(feedback[correctIndex]);
    const coreReason = toSentence(correctFeedback || 'This choice directly matches the governing rule and the key facts in the scenario');

    const cleanedBaseExplanation = rawExplanation
      .replace(/Step\s*1\s*:[^\n]*\n?/gi, '')
      .replace(/Step\s*2\s*:[^\n]*\n?/gi, '')
      .replace(/Step\s*3\s*:[^\n]*\n?/gi, '')
      .replace(/Step\s*4\s*:[^\n]*\n?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const baseIsGeneric = /identify what the question is asking|apply the llqp rule|governing concept/i.test(cleanedBaseExplanation);
    const teachingCore = !baseIsGeneric && cleanedBaseExplanation.length > 30
      ? toSentence(cleanedBaseExplanation)
      : `${toSentence(getQuestionFocus())} ${toSentence(inferRule())}`;

    const wrongLine = wrongReasons.length
      ? `Why the other options are wrong:\n- ${wrongReasons.join('\n- ')}.`
      : 'Why the other options are wrong:\n- They conflict with the contract rules or scenario facts.';

    const correctLine = `Why this answer is correct: Option ${correctLabel}${correctText ? ` (${correctText})` : ''}. ${coreReason}`;

    return [
      `Core concept: ${teachingCore}`,
      wrongLine,
      correctLine
    ].join('\n\n');
  },

  // Format explanation text into styled HTML
  formatExplanation(text) {
    if (!text) return '';
    
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
    this.state.attemptedOptions = {};
    this.state.firstAttemptCorrect = {};
    this.state.lastSelectedIndex = undefined;
    this.state.lastSelectedQuestionKey = null;
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
    // Check if question has optionFeedback array
    if (question.optionFeedback && question.optionFeedback[optionIndex]) {
      return question.optionFeedback[optionIndex];
    }

    // Do NOT fall back to full explanation here (it can reveal the answer).
    // Keep feedback generic until the learner chooses the correct option.
    return 'Not quite. Re-check the key rule and compare each option to the scenario facts.';
  },

  // Select Option
  selectOption(selectedIndex) {
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

    // Check if correct answer
    const isCorrect = selectedIndex === question.correctAnswer;

    if (isFirstAttempt && !this.state.isReviewMode) {
      this.recordDailyPractice(isCorrect);
    }
    
    if (isCorrect) {
      // CORRECT ANSWER - Show full explanation and reveal
      
      // Track if first attempt was correct
      if (isFirstAttempt) {
        this.state.firstAttemptCorrect[stateKey] = true;
      }
      
      // If answered correctly in review mode, remove from wrong questions
      if (this.state.isReviewMode) {
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
      
      // Show AI button and ensure AI container is hidden until used
      const aiExplanationEl = document.getElementById('ai-explanation-text');
      const aiButton = document.getElementById('get-ai-explanation-btn');
      if (aiExplanationEl) {
        aiExplanationEl.innerHTML = '';
        aiExplanationEl.style.display = 'none';
      }
      if (aiButton) {
        aiButton.style.display = this.state.aiAvailable ? 'inline-flex' : 'none';
        aiButton.disabled = false;
      }
      
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
      this.renderQuestionDots();
      this.checkCompletion();

      // Auto-advance to next question if enabled
      this.autoAdvanceNext();
      
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
    let totalViewed = 0;

    this.getTopicPracticeUnits(topic).forEach(test => {
      if (test.questionCount > 0) {
        const key = `progress_${topicId}_${test.id}`;
        const saved = this.readJSONFromStorage(key, null);
        if (saved) {
          totalViewed += (saved.viewed || []).length;
        }
        totalQuestions += test.questionCount;
      }
    });

    if (totalQuestions === 0) return 0;
    return Math.round((totalViewed / totalQuestions) * 100);
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

    return Math.round(((saved.viewed || []).length / test.questionCount) * 100);
  },

  // Save Progress
  saveProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) return;
    if (!this.state.currentTopic.id || !this.state.currentPracticeTest.id) return;

    const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
    const data = {
      viewed: Array.from(this.state.viewedQuestions),
      bookmarked: Array.from(this.state.bookmarkedQuestions),
      revealed: Array.from(this.state.answersRevealed),
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(key, JSON.stringify(data));
    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }
  },

  // Load Progress
  loadProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) {
      this.state.viewedQuestions = new Set();
      this.state.bookmarkedQuestions = new Set();
      this.state.answersRevealed = new Set();
      return;
    }

    if (!this.state.currentTopic.id || !this.state.currentPracticeTest.id) {
      this.state.viewedQuestions = new Set();
      this.state.bookmarkedQuestions = new Set();
      this.state.answersRevealed = new Set();
      return;
    }

    const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
    const saved = this.readJSONFromStorage(key, null);
    if (saved) {
      this.state.viewedQuestions = new Set(saved.viewed || []);
      this.state.bookmarkedQuestions = new Set(saved.bookmarked || []);
      this.state.answersRevealed = new Set(saved.revealed || []);
    } else {
      this.state.viewedQuestions = new Set();
      this.state.bookmarkedQuestions = new Set();
      this.state.answersRevealed = new Set();
    }
  },

  resetProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) return;

    if (this.state.isReviewMode) {
      if (!confirm('Reset this review session?')) {
        return;
      }
      this.state.viewedQuestions.clear();
      this.state.bookmarkedQuestions.clear();
      this.state.answersRevealed.clear();
      this.state.attemptedOptions = {};
      this.state.firstAttemptCorrect = {};
      this.state.lastSelectedIndex = undefined;
      this.state.lastSelectedQuestionKey = null;
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
    
    this.state.viewedQuestions.clear();
    this.state.bookmarkedQuestions.clear();
    this.state.answersRevealed.clear();
    this.state.attemptedOptions = {};
    this.state.firstAttemptCorrect = {};
    this.state.lastSelectedIndex = undefined;
    this.state.lastSelectedQuestionKey = null;
    if (typeof this.scheduleProgressSync === 'function') {
      this.scheduleProgressSync();
    }

    // Hide finish banner
    const banner = document.getElementById('finish-banner');
    if (banner) banner.classList.add('hidden');

    this.state.currentQuestionIndex = 0;
    this.renderQuestion();
    this.showToast('Progress reset successfully.', 'success');
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  MCQApp.init();
});
