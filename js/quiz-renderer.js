/**
 * QuizRenderer: Centralized question rendering and option shuffling
 * Handles option normalization, shuffle logic, and layout restoration
 */

const QuizRenderer = {
  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  /**
   * Strip option prefix (A., B., etc.)
   */
  stripOptionPrefix(optionText) {
    if (typeof optionText !== 'string') return '';
    return optionText.replace(/^\s*(?:\(?\s*[A-Fa-f1-6]\s*\)?\s*[.):\-]?)\s+/, '').trim();
  },

  /**
   * Get option display text (without prefix)
   */
  getOptionDisplayText(optionText) {
    return this.stripOptionPrefix(optionText);
  },

  /**
   * Get normalized option feedback aligned with option order
   */
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

  /**
   * Normalize question option labels (remove prefix, get clean text)
   */
  normalizeQuestionOptionLabels(question) {
    if (!question || !Array.isArray(question.options)) return question;
    return {
      ...question,
      options: question.options.map((option) => this.getOptionDisplayText(option)),
      optionFeedback: this.getNormalizedOptionFeedback(question)
    };
  },

  /**
   * Build question with shuffled options based on option order
   */
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

  /**
   * Resolve option order from displayed text
   */
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

  /**
   * Build layout snapshot of current questions (for session restore)
   */
  buildQuestionLayoutSnapshot(questions = []) {
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

  /**
   * Rebuild questions from layout snapshot (restore session)
   */
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

  /**
   * Get unique question state key (for tracking)
   * Note: Depends on parent app context; should be passed or injected
   */
  getQuestionStateKey(question) {
    if (!question) return null;
    const id = question?.id;
    if (!id) return null;
    return String(id);
  }
};
