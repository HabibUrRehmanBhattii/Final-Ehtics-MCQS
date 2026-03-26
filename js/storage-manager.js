/**
 * StorageManager: Centralized localStorage and session management
 * Handles quiz progress, shuffle order, wrong answers, and preferences
 */

const StorageManager = {
  SHUFFLE_SCHEMA_VERSION: '20260323-session-layout-v5',

  // Key patterns
  KEYS: {
    progress: (topicId, testId) => `progress_${topicId}_${testId}`,
    shuffle: (topicId, testId) => `shuffle_${topicId}_${testId}`,
    wrongQuestions: 'wrong_questions',
    autoAdvance: 'auto-advance',
    homeInsightsExpanded: 'home-insights-expanded',
    theme: 'theme'
  },

  /**
   * Get auto-advance preference
   */
  getAutoAdvance() {
    return localStorage.getItem(this.KEYS.autoAdvance) === 'true';
  },

  /**
   * Set auto-advance preference
   */
  setAutoAdvance(enabled) {
    if (enabled) {
      localStorage.setItem(this.KEYS.autoAdvance, 'true');
    } else {
      localStorage.removeItem(this.KEYS.autoAdvance);
    }
  },

  /**
   * Get home insights expanded state
   */
  getHomeInsightsExpanded() {
    return localStorage.getItem(this.KEYS.homeInsightsExpanded) === 'true';
  },

  /**
   * Set home insights expanded state
   */
  setHomeInsightsExpanded(expanded) {
    if (expanded) {
      localStorage.setItem(this.KEYS.homeInsightsExpanded, 'true');
    } else {
      localStorage.removeItem(this.KEYS.homeInsightsExpanded);
    }
  },

  /**
   * Save progress for a quiz session
   */
  saveProgress(topicId, testId, progressData) {
    const key = this.KEYS.progress(topicId, testId);
    try {
      localStorage.setItem(key, JSON.stringify(progressData));
    } catch (error) {
      console.warn(`Failed to save progress for ${key}.`, error);
    }
  },

  /**
   * Load progress for a quiz session
   */
  loadProgress(topicId, testId) {
    const key = this.KEYS.progress(topicId, testId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Invalid localStorage data for ${key}; resetting entry.`, error);
      localStorage.removeItem(key);
      return null;
    }
  },

  /**
   * Clear progress for a quiz session
   */
  clearProgress(topicId, testId) {
    const key = this.KEYS.progress(topicId, testId);
    localStorage.removeItem(key);
  },

  /**
   * Save shuffle order for a quiz session
   */
  saveShuffle(topicId, testId, shuffleData) {
    const key = this.KEYS.shuffle(topicId, testId);
    const value = JSON.stringify(shuffleData);

    try {
      localStorage.setItem(key, value);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded; attempting cleanup...');
        this.compactLegacyShuffleCaches();
        try {
          localStorage.setItem(key, value);
        } catch (retryError) {
          if (retryError.name === 'QuotaExceededError') {
            console.warn('Quota still exceeded after compact; pruning oldest shuffles...');
            this.pruneShuffleCaches();
            try {
              localStorage.setItem(key, value);
            } catch (finalError) {
              console.warn(`Unable to persist localStorage key ${key} after cache cleanup.`, finalError);
            }
          }
        }
      }
    }
  },

  /**
   * Load shuffle order for a quiz session
   */
  loadShuffle(topicId, testId) {
    const key = this.KEYS.shuffle(topicId, testId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Invalid shuffle cache for ${key}; removing it.`, error);
      localStorage.removeItem(key);
      return null;
    }
  },

  /**
   * Clear shuffle order for a quiz session
   */
  clearShuffle(topicId, testId) {
    const key = this.KEYS.shuffle(topicId, testId);
    localStorage.removeItem(key);
  },

  /**
   * Save wrong questions list
   */
  saveWrongQuestions(wrongQuestions) {
    try {
      localStorage.setItem(this.KEYS.wrongQuestions, JSON.stringify(wrongQuestions));
    } catch (error) {
      console.warn('Failed to save wrong questions.', error);
    }
  },

  /**
   * Load wrong questions list
   */
  loadWrongQuestions() {
    try {
      const raw = localStorage.getItem(this.KEYS.wrongQuestions);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Invalid wrong questions data; resetting.', error);
      localStorage.removeItem(this.KEYS.wrongQuestions);
      return [];
    }
  },

  /**
   * Clear wrong questions
   */
  clearWrongQuestions() {
    localStorage.removeItem(this.KEYS.wrongQuestions);
  },

  /**
   * Compact legacy shuffle caches (upgrade schema versions)
   */
  compactLegacyShuffleCaches() {
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
        const parsed = JSON.parse(raw || '{}');
        if (parsed.version && parsed.version !== this.SHUFFLE_SCHEMA_VERSION) {
          // Upgrade to new schema version
          localStorage.setItem(key, JSON.stringify({
            ...parsed,
            version: this.SHUFFLE_SCHEMA_VERSION
          }));
        }
      } catch (error) {
        console.warn(`Unable to compact shuffle cache ${key}; removing it.`, error);
        localStorage.removeItem(key);
      }
    });
  },

  /**
   * Prune oldest shuffle caches to free space
   */
  pruneShuffleCaches() {
    const shuffleKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith('shuffle_')) {
        shuffleKeys.push(key);
      }
    }

    // Remove all shuffle caches (aggressive pruning)
    shuffleKeys.forEach((key) => localStorage.removeItem(key));
  },

  /**
   * Set theme preference
   */
  setTheme(theme) {
    try {
      localStorage.setItem(this.KEYS.theme, theme);
    } catch (error) {
      console.warn('Failed to set theme preference.', error);
    }
  },

  /**
   * Get theme preference
   */
  getTheme() {
    try {
      return localStorage.getItem(this.KEYS.theme) || 'dark';
    } catch (error) {
      return 'dark';
    }
  }
};
