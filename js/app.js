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
    filterMode: 'all' // 'all' or 'bookmarked'
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

  // Initialize Application
  async init() {
    console.log('🚀 Initializing MCQ App...');
    this.initDarkMode();
    await this.loadTopics();
    this.loadProgress();
    this.setupEventListeners();
    this.renderTopicsGrid();
    console.log('✅ App initialized successfully');
  },

  // Initialize Dark Mode
  initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
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
  },

  // Render Topics Grid
  renderTopicsGrid() {
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
    this.loadProgress();
    this.showView('mcq');
    this.renderQuestion();
  },

  // Load Questions from File
  async loadQuestions(dataFile) {
    try {
      const response = await fetch(dataFile);
      const data = await response.json();
      
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
      
      console.log(`Loaded and randomized ${this.state.questions.length} questions`);
    } catch (error) {
      console.error('Error loading questions:', error);
      this.state.questions = [];
    }
  },

  // Show View
  showView(viewName) {
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
    const question = this.getCurrentQuestion();
    if (!question) return;

    const questionIndex = this.state.currentQuestionIndex;
    const totalQuestions = this.getFilteredQuestions().length;

    // Update header
    document.getElementById('topic-title').textContent = this.state.currentTopic.name;
    document.getElementById('current-question-num').textContent = questionIndex + 1;
    document.getElementById('total-questions').textContent = totalQuestions;

    // Update question card
    document.getElementById('q-num').textContent = question.id;
    document.getElementById('question-text').textContent = question.question;

    // Render options
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = question.options.map((option, index) => `
      <div class="option" data-index="${index}" onclick="MCQApp.selectOption(${index})">
        <span class="option-text">${option}</span>
      </div>
    `).join('');

    // Update bookmark button
    const bookmarkBtn = document.getElementById('bookmark-btn');
    const isBookmarked = this.state.bookmarkedQuestions.has(question.id);
    bookmarkBtn.textContent = isBookmarked ? '⭐' : '☆';
    bookmarkBtn.classList.toggle('bookmarked', isBookmarked);

    // Hide answer section initially
    document.getElementById('answer-section').classList.add('hidden');

    // Mark as viewed
    this.state.viewedQuestions.add(question.id);
    this.saveProgress();

    // Update navigation buttons
    this.updateNavigationButtons();
    this.renderQuestionDots();
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

  // Render Question Dots
  renderQuestionDots() {
    const dotsContainer = document.getElementById('question-dots');
    const filtered = this.getFilteredQuestions();
    
    dotsContainer.innerHTML = filtered.map((q, index) => {
      const isActive = index === this.state.currentQuestionIndex;
      const isBookmarked = this.state.bookmarkedQuestions.has(q.id);
      const isViewed = this.state.viewedQuestions.has(q.id);
      
      return `
        <button class="question-dot ${isActive ? 'active' : ''} ${isViewed ? 'viewed' : ''} ${isBookmarked ? 'bookmarked' : ''}"
                onclick="MCQApp.jumpToQuestion(${index})"
                aria-label="Question ${index + 1}">
          ${isBookmarked ? '⭐' : index + 1}
        </button>
      `;
    }).join('');
  },

  // Jump to Question
  jumpToQuestion(index) {
    this.state.currentQuestionIndex = index;
    this.renderQuestion();
  },

  // Select Option
  selectOption(selectedIndex) {
    const question = this.getCurrentQuestion();
    if (!question) return;

    // Check if already revealed
    const answerSection = document.getElementById('answer-section');
    if (!answerSection.classList.contains('hidden')) {
      return; // Already showing answer, don't allow re-clicking
    }

    // Highlight selected and correct answers
    const optionsContainer = document.getElementById('options-container');
    const options = optionsContainer.querySelectorAll('.option');
    
    options.forEach((option, index) => {
      option.style.pointerEvents = 'none'; // Disable further clicks
      
      if (index === question.correctAnswer) {
        option.classList.add('correct');
      } else if (index === selectedIndex) {
        option.classList.add('incorrect');
      } else {
        option.classList.add('dimmed');
      }
    });

    // Show explanation
    document.getElementById('correct-answer-text').textContent = question.options[question.correctAnswer];
    document.getElementById('explanation-text').textContent = question.explanation;
    
    answerSection.classList.remove('hidden');

    // Track answer reveal
    this.state.answersRevealed.add(question.id);
    this.saveProgress();
  },

  // Hide Answer
  hideAnswer() {
    const question = this.getCurrentQuestion();
    if (!question) return;

    // Reset view
    const optionsContainer = document.getElementById('options-container');
    const options = optionsContainer.querySelectorAll('.option');
    options.forEach(option => {
      option.classList.remove('correct', 'incorrect', 'dimmed');
      option.style.pointerEvents = 'auto'; // Re-enable clicks
    });

    document.getElementById('answer-section').classList.add('hidden');
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
            <span class="list-question-num">Question ${question.id}</span>
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
    if (!this.state.currentTopic || !this.state.currentPracticeTest) return;

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

  // Reset Progress
  resetProgress() {
    if (!confirm('Are you sure you want to reset all progress for this practice test? This cannot be undone.')) {
      return;
    }

    if (this.state.currentTopic && this.state.currentPracticeTest) {
      const key = `progress_${this.state.currentTopic.id}_${this.state.currentPracticeTest.id}`;
      localStorage.removeItem(key);
      
      this.state.viewedQuestions.clear();
      this.state.bookmarkedQuestions.clear();
      this.state.answersRevealed.clear();
      
      this.state.currentQuestionIndex = 0;
      this.renderQuestion();
      
      alert('Progress reset successfully!');
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  MCQApp.init();
});
