// ===================================
// MCQ Study Platform - Main Application
// ===================================

const MCQApp = {
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
    isReviewMode: false,
    attemptedOptions: {}, // Track which options were attempted for each question
    firstAttemptCorrect: {}, // Track if first attempt was correct for each question
    speechSupported: false,
    currentUtterance: null
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

  // Log Wrong Answer
  logWrongAnswer(question) {
    if (!question) return;
    const topicId = this.state.currentTopic?.id || 'unknown-topic';
    const testId = this.state.currentPracticeTest?.id || 'unknown-test';
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
    const data = JSON.parse(localStorage.getItem('wrong_questions') || '[]');
    this.state.wrongQuestions = data;
  },

  saveWrongQuestions() {
    localStorage.setItem('wrong_questions', JSON.stringify(this.state.wrongQuestions));
  },

  removeFromWrongQuestions(questionId) {
    this.state.wrongQuestions = this.state.wrongQuestions.filter(q => q.questionId !== questionId);
    this.saveWrongQuestions();
    this.updateWrongQuestionsCount();
  },

  // Start Wrong Questions Review
  async startWrongQuestionsReview() {
    if (this.state.wrongQuestions.length === 0) {
      alert('No wrong answers to review yet. Keep practicing!');
      return;
    }

    // Load all wrong questions from different topics/tests
    const wrongQuestionsToReview = [];
    
    for (const wrongQ of this.state.wrongQuestions) {
      // Find the topic and test
      const topic = this.state.topics.find(t => t.id === wrongQ.topicId);
      if (!topic) continue;

      const test = topic.practiceTests?.find(t => t.id === wrongQ.testId);
      if (!test) continue;

      // Load questions from that test
      try {
        const response = await fetch(test.dataFile);
        const data = await response.json();
        const question = data.questions.find(q => q.id === wrongQ.questionId);
        
        if (question) {
          wrongQuestionsToReview.push({
            ...question,
            topicName: topic.name,
            testName: test.name
          });
        }
      } catch (error) {
        console.error('Error loading question:', error);
      }
    }

    if (wrongQuestionsToReview.length === 0) {
      alert('Could not load wrong questions. They may have been deleted.');
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
    alert('Wrong answers history cleared!');
  },

  // Initialize Application
  async init() {
    console.log('🚀 Initializing MCQ App...');
    this.initDarkMode();
    this.initSpeech();
    this.registerServiceWorker();
    this.loadWrongQuestions();
    await this.loadTopics();
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

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((error) => {
          console.warn('Service worker registration failed:', error);
        });
    });
  },

  // Initialize Dark Mode
  initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateDarkModeIcon(savedTheme);
  },

  // Toggle Dark Mode
  toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateDarkModeIcon(newTheme);
  },

  // Update Dark Mode Icon
  updateDarkModeIcon(theme) {
    const toggleBtn = document.getElementById('dark-mode-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
      toggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  },

  // Load Topics Configuration
  async loadTopics() {
    try {
      const response = await fetch('data/topics.json');
      const data = await response.json();
      this.state.topics = data.topics;
    } catch (error) {
      console.error('Error loading topics:', error);
      this.state.topics = [];
    }
  },

  // Load Questions for a Topic
  async loadQuestions(topicId) {
    const topic = this.state.topics.find(t => t.id === topicId);
    if (!topic) return;

    try {
      const response = await fetch(topic.dataFile);
      const data = await response.json();
      this.state.questions = data.questions;
      this.state.currentTopic = topic;
      console.log(`Loaded ${this.state.questions.length} questions for ${topic.name}`);
    } catch (error) {
      console.error('Error loading questions:', error);
      this.state.questions = [];
    }
  },

  // Setup Event Listeners
  setupEventListeners() {
    // Dark mode toggle
    document.getElementById('dark-mode-toggle')?.addEventListener('click', () => {
      this.toggleDarkMode();
    });

    // Read question aloud
    document.getElementById('read-question-btn')?.addEventListener('click', () => {
      if (!this.state.speechSupported) return;
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        this.stopSpeech();
        return;
      }
      this.speakCurrentQuestion();
    });

    // Back to topics button from practice test selection
    document.getElementById('back-to-topics-btn')?.addEventListener('click', () => {
      this.showView('home');
    });

    // Back button from MCQ view
    document.getElementById('back-btn')?.addEventListener('click', () => {
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
      this.showView('home');
    });
    document.getElementById('finish-tests-btn')?.addEventListener('click', () => {
      this.showView('practice-test');
    });
    document.getElementById('finish-retry-btn')?.addEventListener('click', () => {
      this.retryCurrentTest();
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
  },

  // Render Topics Grid
  renderTopicsGrid() {
    this.updateWrongQuestionsCount();
    const grid = document.getElementById('topics-grid');
    if (!grid) return;

    grid.innerHTML = this.state.topics.map(topic => {
      const progress = this.getTopicProgress(topic.id);
      const isActive = topic.status === 'active';
      const totalQuestions = topic.practiceTests?.reduce((sum, test) => sum + test.questionCount, 0) || 0;
      
      return `
        <div class="topic-card ${!isActive ? 'coming-soon' : ''}" 
             ${isActive ? `onclick="MCQApp.selectTopic('${topic.id}')"` : ''}
             style="--topic-color: ${topic.color}">
          <div class="topic-icon">${topic.icon}</div>
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
          ${isActive ? `
            <button class="btn-start">Start Practice →</button>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  // Select Topic and Show Practice Tests
  async selectTopic(topicId) {
    const topic = this.state.topics.find(t => t.id === topicId);
    if (!topic) return;
    
    this.state.currentTopic = topic;
    this.showView('practice-test');
    this.renderPracticeTests();
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

    if (!topic.practiceTests || topic.practiceTests.length === 0) {
      grid.innerHTML = `
        <div class="no-tests-message">
          <p>📚 Practice tests for this topic are coming soon!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = topic.practiceTests.map((test, index) => {
      const isActive = test.status !== 'coming-soon';
      const testProgress = this.getPracticeTestProgress(topic.id, test.id);
      
      return `
        <div class="practice-test-card ${!isActive ? 'coming-soon' : ''}"
             ${isActive ? `onclick="MCQApp.selectPracticeTest('${test.id}')"` : ''}
             style="--topic-color: ${topic.color}">
          <div class="test-number">${index + 1}</div>
          <h3 class="test-name">${test.name}</h3>
          <p class="test-description">${test.description}</p>
          <div class="test-meta">
            <span class="question-count">
              📝 ${test.questionCount} Question${test.questionCount !== 1 ? 's' : ''}
            </span>
            ${isActive && testProgress > 0 ? `
              <span class="progress-badge">${testProgress}% Complete</span>
            ` : ''}
          </div>
          ${isActive ? `
            <button class="btn-start-test">Start Test →</button>
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

    await this.loadQuestions(practiceTest.dataFile);
    if (this.state.questions.length === 0) {
      alert('No questions available for this practice test yet.');
      return;
    }

    this.state.currentPracticeTest = practiceTest;
    this.state.currentQuestionIndex = 0;
    this.state.filterMode = 'all';
    this.state.isReviewMode = false;
    this.loadProgress();
    this.showView('mcq');
    this.renderQuestion();
  },

  // Load Questions from File
  async loadQuestions(dataFile) {
    try {
      const response = await fetch(dataFile);
      const data = await response.json();
      
      // Check if we have a saved shuffled order for this test
      const shuffleKey = `shuffle_${this.state.currentTopic?.id}_${this.state.currentPracticeTest?.id}`;
      let savedShuffle = null;
      try {
        const saved = localStorage.getItem(shuffleKey);
        if (saved) savedShuffle = JSON.parse(saved);
      } catch (e) {
        console.log('No saved shuffle found');
      }
      
      // If we have saved shuffle data, use it; otherwise create new shuffle
      if (savedShuffle && savedShuffle.length === data.questions.length) {
        console.log('Using saved question order');
        this.state.questions = savedShuffle;
      } else {
        console.log('Creating new randomized order');
        // Randomize questions order
        const shuffledQuestions = this.shuffleArray(data.questions);
        
        // Randomize answer options for each question
        this.state.questions = shuffledQuestions.map(question => {
          // Strip A. B. C. D. prefixes from options
          const optionsWithoutPrefix = question.options.map(opt => 
            opt.replace(/^[A-D]\.\s*/, '').trim()
          );
          
          const originalCorrectAnswer = question.correctAnswer;
          
          // Create array of indices and shuffle them
          const indices = optionsWithoutPrefix.map((_, index) => index);
          const shuffledIndices = this.shuffleArray(indices);
          
          // Shuffle options and re-add A, B, C, D prefixes
          const shuffledOptions = shuffledIndices.map((originalIndex, newIndex) => {
            const letter = ['A', 'B', 'C', 'D'][newIndex];
            return `${letter}. ${optionsWithoutPrefix[originalIndex]}`;
          });
          
          // Find new position of correct answer
          const newCorrectAnswer = shuffledIndices.indexOf(originalCorrectAnswer);
          
          return {
            ...question,
            options: shuffledOptions,
            correctAnswer: newCorrectAnswer
          };
        });
        
        // Save the shuffled order
        localStorage.setItem(shuffleKey, JSON.stringify(this.state.questions));
      }
      
      console.log(`Loaded ${this.state.questions.length} questions`);
    } catch (error) {
      console.error('Error loading questions:', error);
      this.state.questions = [];
    }
  },

  // Show View
  showView(viewName) {
    if (viewName !== 'mcq') {
      this.stopSpeech();
    }
    this.state.currentView = viewName;
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    const viewMap = {
      'home': 'home-view',
      'practice-test': 'practice-test-view',
      'mcq': 'mcq-view',
      'list': 'list-view'
    };

    const targetView = document.getElementById(viewMap[viewName]);
    if (targetView) {
      targetView.classList.add('active');
    }

    if (viewName === 'home') {
      this.renderTopicsGrid();
    }
  },

  // Render Current Question
  renderQuestion() {
    this.stopSpeech();
    const question = this.getCurrentQuestion();
    if (!question) return;

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
    document.getElementById('question-text').textContent = question.question;

    // Render options
    const optionsContainer = document.getElementById('options-container');
    const attemptedForQuestion = this.state.attemptedOptions[question.id] || [];
    
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    optionsContainer.innerHTML = question.options.map((option, index) => {
      const wasAttempted = attemptedForQuestion.includes(index);
      const isCorrect = index === question.correctAnswer;
      const isRevealed = this.state.answersRevealed.has(question.id);
      const dimmedClass = isRevealed && !isCorrect && !wasAttempted ? 'is-dimmed' : '';
      const feedbackText = wasAttempted && !isRevealed ? this.getWrongAnswerFeedback(question, index) : '';
      const feedbackHtml = feedbackText ? `
            <div class="option-feedback">
              <p>${feedbackText}</p>
            </div>
          ` : '';
      
      return `
        <div class="option ${wasAttempted ? 'was-attempted' : ''} ${isRevealed && isCorrect ? 'is-correct' : ''} ${dimmedClass}" 
             data-index="${index}" 
             onclick="MCQApp.selectOption(${index})">
          <div class="option-main">
            <span class="option-letter">${letters[index] || index + 1}</span>
            <span class="option-text">${option}</span>
          </div>
          ${feedbackHtml}
        </div>
      `;
    }).join('');

    // Update bookmark button
    const bookmarkBtn = document.getElementById('bookmark-btn');
    const isBookmarked = this.state.bookmarkedQuestions.has(question.id);
    bookmarkBtn.textContent = isBookmarked ? '⭐' : '☆';
    bookmarkBtn.classList.toggle('bookmarked', isBookmarked);

    // Hide answer section initially
    document.getElementById('answer-section').classList.add('hidden');

    // If already answered, restore the answer display and disable options
    if (this.state.answersRevealed.has(question.id)) {
      const answerSection = document.getElementById('answer-section');
      document.getElementById('correct-answer-text').textContent = question.options[question.correctAnswer];
      document.getElementById('explanation-text').innerHTML = this.formatExplanation(question.explanation);
      answerSection.classList.remove('hidden');
      optionsContainer.querySelectorAll('.option').forEach(opt => {
        opt.style.pointerEvents = 'none';
      });
    }

    // Mark as viewed
    this.state.viewedQuestions.add(question.id);
    this.saveProgress();

    // Update navigation buttons
    this.updateNavigationButtons();
    this.renderQuestionDots();

    // Hide Next until answered; always hide on last question (finish banner handles it)
    const nextBtn = document.getElementById('next-question-btn');
    const hasAnswered = this.state.answersRevealed.has(question.id);
    const isLastQ = this.state.currentQuestionIndex === this.getFilteredQuestions().length - 1;
    if (nextBtn) {
      nextBtn.classList.toggle('hidden', !hasAnswered || isLastQ);
    }

    // Scroll to top on question change
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Check if all questions have been answered — show/hide finish banner
    this.checkCompletion();
  },

  // Build speech text for current question
  buildSpeechText(question) {
    const optionsText = question.options
      .map((opt, idx) => `Option ${idx + 1}: ${opt}`)
      .join('. ');
    return `Question. ${question.question}. ${optionsText}`;
  },

  // Speak current question and options
  speakCurrentQuestion() {
    if (!this.state.speechSupported) return;
    const question = this.getCurrentQuestion();
    if (!question) return;

    const text = this.buildSpeechText(question);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => this.updateSpeechButton(false);
    utterance.onerror = () => this.updateSpeechButton(false);

    this.state.currentUtterance = utterance;
    this.updateSpeechButton(true);
    window.speechSynthesis.speak(utterance);
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

  // Get Current Question
  getCurrentQuestion() {
    const filtered = this.getFilteredQuestions();
    return filtered[this.state.currentQuestionIndex];
  },

  // Get Filtered Questions
  getFilteredQuestions() {
    if (this.state.filterMode === 'bookmarked') {
      return this.state.questions.filter(q => this.state.bookmarkedQuestions.has(q.id));
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
      const isBookmarked = this.state.bookmarkedQuestions.has(q.id);
      const isViewed = this.state.viewedQuestions.has(q.id);
      const isAnswered = this.state.answersRevealed.has(q.id);
      const wasFirstCorrect = this.state.firstAttemptCorrect[q.id];
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

  // Format explanation text into styled HTML
  formatExplanation(text) {
    if (!text) return '';
    
    // Escape HTML to prevent XSS
    const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeText = escapeHtml(text);
    
    // Split into paragraphs by double newlines
    const sections = safeText.split(/\n\n+/);
    
    let html = '';
    
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
    
    return html;
  },

  // Check if all questions have been answered
  checkCompletion() {
    const filtered = this.getFilteredQuestions();
    const totalQ = filtered.length;
    const answeredCount = filtered.filter(q => this.state.answersRevealed.has(q.id)).length;
    const banner = document.getElementById('finish-banner');

    if (answeredCount === totalQ && totalQ > 0) {
      // Calculate score (first attempt correct)
      const correctFirst = filtered.filter(q => this.state.firstAttemptCorrect[q.id] === true).length;
      const pct = Math.round((correctFirst / totalQ) * 100);

      document.getElementById('finish-correct').textContent = correctFirst;
      document.getElementById('finish-total').textContent = totalQ;
      document.getElementById('finish-percent').textContent = pct + '%';

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
    }
    this.state.viewedQuestions = new Set();
    this.state.bookmarkedQuestions = new Set();
    this.state.answersRevealed = new Set();
    this.state.attemptedOptions = {};
    this.state.firstAttemptCorrect = {};
    this.state.currentQuestionIndex = 0;
    
    // Reload and reshuffle questions
    await this.loadQuestions(this.state.currentPracticeTest.dataFile || 
      this.state.currentTopic.practiceTests.find(t => t.id === testId)?.dataFile);
    this.renderQuestion();
  },

  // Get wrong answer feedback from question explanation
  getWrongAnswerFeedback(question, optionIndex) {
    // Check if question has optionFeedback array
    if (question.optionFeedback && question.optionFeedback[optionIndex]) {
      return question.optionFeedback[optionIndex];
    }

    // Fallback to explanation if specific feedback is not provided
    if (question.explanation) {
      return question.explanation;
    }
    
    // No feedback provided
    return '';
  },

  // Select Option
  selectOption(selectedIndex) {
    const question = this.getCurrentQuestion();
    if (!question) return;

    // Initialize tracking for this question if not exists
    if (!this.state.attemptedOptions[question.id]) {
      this.state.attemptedOptions[question.id] = [];
    }
    
    // Check if this option was already attempted
    const alreadyAttempted = this.state.attemptedOptions[question.id].includes(selectedIndex);
    if (alreadyAttempted) {
      return; // Don't allow clicking the same wrong answer again
    }

    // Check if this is the first attempt for this question
    const isFirstAttempt = this.state.attemptedOptions[question.id].length === 0;
    
    // Store selected answer index for AI explanation
    this.state.lastSelectedIndex = selectedIndex;

    // Check if correct answer
    const isCorrect = selectedIndex === question.correctAnswer;
    
    if (isCorrect) {
      // CORRECT ANSWER - Show full explanation and reveal
      
      // Track if first attempt was correct
      if (isFirstAttempt) {
        this.state.firstAttemptCorrect[question.id] = true;
      }
      
      // If answered correctly in review mode, remove from wrong questions
      if (this.state.isReviewMode) {
        this.removeFromWrongQuestions(question.id);
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
      document.getElementById('correct-answer-text').textContent = question.options[question.correctAnswer];
      document.getElementById('explanation-text').innerHTML = this.formatExplanation(question.explanation);
      
      // Show AI button and ensure AI container is hidden until used
      const aiExplanationEl = document.getElementById('ai-explanation-text');
      const aiButton = document.getElementById('get-ai-explanation-btn');
      if (aiExplanationEl) {
        aiExplanationEl.innerHTML = '';
        aiExplanationEl.style.display = 'none';
      }
      if (aiButton) {
        aiButton.style.display = 'inline-flex';
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
      this.state.answersRevealed.add(question.id);
      this.saveProgress();

      // Update dots to show answered state & check completion
      this.renderQuestionDots();
      this.checkCompletion();
      
    } else {
      // WRONG ANSWER - Show individual feedback, don't reveal correct answer
      
      // Add to attempted options
      this.state.attemptedOptions[question.id].push(selectedIndex);
      
      // If this is the first attempt and it's wrong, log it as wrong
      if (isFirstAttempt) {
        this.state.firstAttemptCorrect[question.id] = false;
        this.logWrongAnswer(question);
      }
      
      // Re-render to show the feedback for this wrong answer
      this.renderQuestion();
    }
  },

  // Generate AI Explanation
  async generateAIExplanation() {
    const question = this.getCurrentQuestion();
    if (!question) return;

    const selectedIndex = this.state.lastSelectedIndex;
    if (selectedIndex === undefined) return;

    const aiButton = document.getElementById('get-ai-explanation-btn');
    const element = document.getElementById('ai-explanation-text');
    
    if (!element) return;

    // Show loading state and reveal AI container
    if (aiButton) aiButton.disabled = true;
    element.style.display = 'block';
    element.innerHTML = '<div class="loading-spinner">⏳ Generating AI explanation...</div>';

    try {
      const userAnswer = question.options[selectedIndex];
      const correctAnswer = question.options[question.correctAnswer];
      const isCorrect = selectedIndex === question.correctAnswer;
      
      // Construct the API URL based on current location
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8000/api/explain'
        : `${window.location.origin}/api/explain`;

      // Build appropriate prompt based on whether answer was correct
      let prompt;
      if (isCorrect) {
        prompt = `You are an expert ethics instructor. A student answered this ethics question CORRECTLY:

Question: ${question.question}

Student's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}

The student selected the CORRECT answer. Provide a brief, supportive explanation (2-3 sentences) explaining:
1. Why this answer is correct
2. Key concepts the student should remember

Keep it educational and encouraging.`;
      } else {
        prompt = `You are an expert ethics instructor. A student answered this ethics question INCORRECTLY:

Question: ${question.question}

Student's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}

The student selected an INCORRECT answer. Provide a brief, clear explanation (2-3 sentences) of:
1. Why the correct answer is right
2. Why the student's answer was incorrect

Keep the explanation educational and supportive.`;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.question,
          userAnswer: userAnswer,
          correctAnswer: correctAnswer,
          options: question.options,
          isCorrect: isCorrect,
          customPrompt: prompt,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        element.innerHTML = `<div class="ai-explanation"><strong>🤖 AI Insights:</strong> ${data.explanation}</div>`;
        if (aiButton) aiButton.style.display = 'none';
      } else {
        element.innerHTML = '<div class="ai-error">⚠️ AI service temporarily unavailable</div>';
        console.error('AI Error:', data.error);
        if (aiButton) aiButton.disabled = false;
      }
    } catch (error) {
      console.error('Error generating AI explanation:', error);
      element.innerHTML = '<div class="ai-error">⚠️ Could not connect to AI service. Check your connection.</div>';
      if (aiButton) aiButton.disabled = false;
    }
  },

  // Hide Answer
  hideAnswer() {
    const question = this.getCurrentQuestion();
    if (!question) return;

    // Reset view
    const optionsContainer = document.getElementById('options-container');
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

    if (this.state.bookmarkedQuestions.has(question.id)) {
      this.state.bookmarkedQuestions.delete(question.id);
    } else {
      this.state.bookmarkedQuestions.add(question.id);
    }

    this.saveProgress();
    this.renderQuestion();
  },

  // Toggle Filter Mode
  toggleFilterMode() {
    if (this.state.filterMode === 'all') {
      const bookmarkedCount = this.state.bookmarkedQuestions.size;
      if (bookmarkedCount === 0) {
        alert('No bookmarked questions yet. Click the ☆ button to bookmark questions.');
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
      const isBookmarked = this.state.bookmarkedQuestions.has(question.id);
      const isRevealed = this.state.answersRevealed.has(question.id);

      return `
        <div class="list-question-card">
          <div class="list-question-header">
            <span class="list-question-num">Question ${index + 1}</span>
            ${isBookmarked ? '<span class="bookmark-indicator">⭐</span>' : ''}
          </div>
          <div class="list-question-text">${question.question}</div>
          <div class="list-options">
            ${question.options.map((opt, i) => `
              <div class="list-option ${i === question.correctAnswer && isRevealed ? 'correct-preview' : ''}">
                ${opt}
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

    topic.practiceTests.forEach(test => {
      if (test.questionCount > 0) {
        const key = `progress_${topicId}_${test.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const data = JSON.parse(saved);
          totalViewed += data.viewed.length;
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
    const saved = localStorage.getItem(key);
    if (!saved) return 0;

    const topic = this.state.topics.find(t => t.id === topicId);
    if (!topic) return 0;

    const test = topic.practiceTests.find(t => t.id === testId);
    if (!test || test.questionCount === 0) return 0;

    const data = JSON.parse(saved);
    return Math.round((data.viewed.length / test.questionCount) * 100);
  },

  // Save Progress
  saveProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) return;

    const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
    const data = {
      viewed: Array.from(this.state.viewedQuestions),
      bookmarked: Array.from(this.state.bookmarkedQuestions),
      revealed: Array.from(this.state.answersRevealed),
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(key, JSON.stringify(data));
  },

  // Load Progress
  loadProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) {
      this.state.viewedQuestions = new Set();
      this.state.bookmarkedQuestions = new Set();
      this.state.answersRevealed = new Set();
      return;
    }

    const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      this.state.viewedQuestions = new Set(data.viewed || []);
      this.state.bookmarkedQuestions = new Set(data.bookmarked || []);
      this.state.answersRevealed = new Set(data.revealed || []);
    } else {
      this.state.viewedQuestions = new Set();
      this.state.bookmarkedQuestions = new Set();
      this.state.answersRevealed = new Set();
    }
  },

  resetProgress() {
    if (!this.state.currentTopic || !this.state.currentPracticeTest) return;
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

    // Hide finish banner
    const banner = document.getElementById('finish-banner');
    if (banner) banner.classList.add('hidden');

    this.state.currentQuestionIndex = 0;
    this.renderQuestion();
    alert('Progress reset successfully!');
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  MCQApp.init();
});
