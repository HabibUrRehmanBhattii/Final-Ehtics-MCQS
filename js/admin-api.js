/**
 * Admin API Module - Backend integration for MCQ management
 * Handles all CRUD operations for questions, topics, and content
 */

class AdminAPI {
    constructor() {
        this.baseUrl = '/api/admin';
        this.cacheVersion = 'v1';
        this.initialized = false;
    }

    /**
     * Initialize admin API with authentication
     */
    async init() {
        try {
            const auth = await this.checkAuth();
            if (!auth) {
                throw new Error('Not authenticated');
            }
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Admin API init failed:', error);
            return false;
        }
    }

    /**
     * Check authentication status
     */
    async checkAuth() {
        const token = localStorage.getItem('admin_token');
        if (!token) return false;

        try {
            const response = await fetch(`${this.baseUrl}/auth/verify`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get all questions for a topic and test
     */
    async getQuestions(topic, testId) {
        try {
            const response = await fetch(
                `${this.baseUrl}/questions?topic=${encodeURIComponent(topic)}&test=${encodeURIComponent(testId)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    }
                }
            );
            if (!response.ok) throw new Error('Failed to fetch questions');
            const data = await response.json();
            return Array.isArray(data?.questions) ? data.questions : [];
        } catch (error) {
            console.error('Failed to get questions:', error);
            return [];
        }
    }

    /**
     * Get single question by ID
     */
    async getQuestion(questionId) {
        try {
            const response = await fetch(`${this.baseUrl}/questions/${questionId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            if (!response.ok) throw new Error('Question not found');
            return await response.json();
        } catch (error) {
            console.error('Failed to get question:', error);
            return null;
        }
    }

    /**
     * Create new question
     */
    async createQuestion(questionData) {
        try {
            const response = await fetch(`${this.baseUrl}/questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify(this.validateQuestion(questionData))
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Failed to create question');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to create question:', error);
            throw error;
        }
    }

    /**
     * Update existing question
     */
    async updateQuestion(questionId, questionData) {
        try {
            const response = await fetch(`${this.baseUrl}/questions/${questionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify(this.validateQuestion(questionData))
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Failed to update question');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to update question:', error);
            throw error;
        }
    }

    /**
     * Delete question
     */
    async deleteQuestion(questionId) {
        try {
            const response = await fetch(`${this.baseUrl}/questions/${questionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to delete question');
            return true;
        } catch (error) {
            console.error('Failed to delete question:', error);
            throw error;
        }
    }

    /**
     * Bulk import questions from CSV
     */
    async bulkImport(csvData, topic, testId) {
        try {
            const response = await fetch(`${this.baseUrl}/questions/bulk-import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify({
                    topic,
                    testId,
                    data: csvData
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Bulk import failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Bulk import failed:', error);
            throw error;
        }
    }

    /**
     * Validate content schema
     */
    async validateContent(topic, testId) {
        try {
            const response = await fetch(
                `${this.baseUrl}/validate?topic=${topic}&test=${testId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    }
                }
            );
            
            if (!response.ok) throw new Error('Validation failed');
            return await response.json();
        } catch (error) {
            console.error('Validation failed:', error);
            return { valid: false, errors: [error.message] };
        }
    }

    /**
     * Export questions
     */
    async exportQuestions(topic, testId = '01', format = 'json') {
        try {
            if (format === 'pdf') {
                throw new Error('PDF export is not available yet. Use JSON or CSV.');
            }
            const response = await fetch(
                `${this.baseUrl}/export?topic=${encodeURIComponent(topic)}&test=${encodeURIComponent(testId)}&format=${encodeURIComponent(format)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    }
                }
            );
            
            if (!response.ok) throw new Error('Export failed');
            return await response.blob();
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    /**
     * Get dashboard statistics
     */
    async getDashboardStats() {
        try {
            const response = await fetch(`${this.baseUrl}/stats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch stats');
            return await response.json();
        } catch (error) {
            console.error('Failed to get stats:', error);
            return { totalQuestions: 0, activeTopics: 0, validationStatus: 'unknown' };
        }
    }

    /**
     * Validate question schema
     */
    validateQuestion(data) {
        const required = ['topic', 'question', 'options', 'correctAnswer', 'explanation'];
        
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!Array.isArray(data.options) || data.options.length !== 4) {
            throw new Error('Must have exactly 4 options');
        }

        if (typeof data.correctAnswer !== 'number' || data.correctAnswer < 0 || data.correctAnswer > 3) {
            throw new Error('Correct answer must be 0-3');
        }

        if (!Array.isArray(data.optionFeedback) || data.optionFeedback.length !== 4) {
            throw new Error('Must have feedback for all 4 options');
        }

        if (data.optionFeedback[data.correctAnswer] !== null && data.optionFeedback[data.correctAnswer] !== undefined) {
            throw new Error('Correct answer feedback must be null');
        }

        return data;
    }
}

// Export singleton instance
window.adminAPI = new AdminAPI();
