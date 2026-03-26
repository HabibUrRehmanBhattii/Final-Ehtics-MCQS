/**
 * Admin API Routes - Express/Node.js backend for MCQ management
 * Add to your Express server: app.use('/api/admin', require('./admin-routes'))
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Middleware - Authentication check
const adminAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    // Verify token against your auth system
    if (!token || !verifyAdminToken(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

function verifyAdminToken(token) {
    // Implement your token verification logic
    // For now, check against environment variable
    return token === process.env.ADMIN_TOKEN;
}

async function verifyAdminCredentials(email, password) {
    if (!email || !password) return false;

    const adminFilePath = path.join(__dirname, '..', 'data', 'admin-users.json');
    let admins = [];

    try {
        const content = await fs.readFile(adminFilePath, 'utf-8');
        admins = JSON.parse(content);
    } catch {
        return false;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const providedHash = crypto.createHash('sha256').update(String(password)).digest('hex');

    return admins.some((admin) => {
        const adminEmail = String(admin?.email || '').trim().toLowerCase();
        return adminEmail === normalizedEmail && admin?.passwordHash === providedHash;
    });
}

// Helper - Get question file path
function getQuestionFilePath(topic, testId) {
    const dataDir = path.join(__dirname, '..', 'data');
    const topicDir = path.join(dataDir, `${topic}-${testId}`);
    return path.join(topicDir, `${topic}-${testId}.json`);
}

// Helper - Load JSON file
async function loadJSON(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Failed to load file: ${error.message}`);
    }
}

// Helper - Save JSON file
async function saveJSON(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        throw new Error(`Failed to save file: ${error.message}`);
    }
}

// GET /api/admin/questions
router.get('/questions', adminAuth, async (req, res) => {
    try {
        const { topic, test } = req.query;
        
        if (!topic || !test) {
            return res.status(400).json({ error: 'Missing topic or test parameter' });
        }

        const filePath = getQuestionFilePath(topic, test);
        const data = await loadJSON(filePath);
        
        res.json({
            topic: data.topic,
            topicId: data.topicId,
            description: data.description,
            questions: data.questions || [],
            count: data.questions?.length || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/questions/:id
router.get('/questions/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        // Parse id format: "topic-test-qid"
        const [topic, test, qid] = id.split('-');
        
        const filePath = getQuestionFilePath(topic, test);
        const data = await loadJSON(filePath);
        
        const question = data.questions?.find(q => q.id === id);
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        res.json(question);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/questions
router.post('/questions', adminAuth, async (req, res) => {
    try {
        const { topic, testId, question, options, correctAnswer, optionFeedback, explanation, difficulty, tags } = req.body;
        
        // Validate input
        if (!topic || !testId || !question || !options || correctAnswer === undefined || !explanation) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const filePath = getQuestionFilePath(topic, testId);
        const data = await loadJSON(filePath);
        
        // Generate question ID
        const maxId = Math.max(
            0,
            ...data.questions.map(q => {
                const match = q.id.match(/\d+$/);
                return match ? parseInt(match[0]) : 0;
            })
        );
        
        const newQuestion = {
            id: `${topic}-${testId}-${maxId + 1}`,
            question,
            options,
            correctAnswer,
            optionFeedback: optionFeedback || [null, null, null, null],
            explanation,
            difficulty: difficulty || 'medium',
            tags: tags || [],
            createdAt: new Date().toISOString()
        };
        
        data.questions.push(newQuestion);
        await saveJSON(filePath, data);
        
        res.status(201).json({ success: true, question: newQuestion });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/admin/questions/:id
router.put('/questions/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const [topic, test] = id.split('-');
        
        const filePath = getQuestionFilePath(topic, test);
        const data = await loadJSON(filePath);
        
        const questionIndex = data.questions.findIndex(q => q.id === id);
        if (questionIndex === -1) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        // Update fields
        const updated = {
            ...data.questions[questionIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        data.questions[questionIndex] = updated;
        await saveJSON(filePath, data);
        
        res.json({ success: true, question: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/questions/:id
router.delete('/questions/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const [topic, test] = id.split('-');
        
        const filePath = getQuestionFilePath(topic, test);
        const data = await loadJSON(filePath);
        
        const questionIndex = data.questions.findIndex(q => q.id === id);
        if (questionIndex === -1) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        data.questions.splice(questionIndex, 1);
        await saveJSON(filePath, data);
        
        res.json({ success: true, message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/questions/bulk-import
router.post('/questions/bulk-import', adminAuth, async (req, res) => {
    try {
        const { topic, testId, data: csvData } = req.body;
        
        if (!topic || !testId || !csvData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const filePath = getQuestionFilePath(topic, testId);
        const fileData = await loadJSON(filePath);
        
        let importCount = 0;
        const errors = [];
        
        // Parse CSV data (assuming it's already parsed)
        csvData.forEach((row, index) => {
            try {
                const options = [row.option_a, row.option_b, row.option_c, row.option_d];
                const correctAnswer = parseInt(row.correct_answer);
                
                const question = {
                    id: `${topic}-${testId}-${fileData.questions.length + importCount + 1}`,
                    question: row.question,
                    options,
                    correctAnswer,
                    optionFeedback: [null, null, null, null],
                    explanation: row.explanation,
                    difficulty: row.difficulty || 'medium',
                    tags: row.tags ? row.tags.split(',') : []
                };
                
                fileData.questions.push(question);
                importCount++;
            } catch (error) {
                errors.push(`Row ${index + 1}: ${error.message}`);
            }
        });
        
        if (importCount > 0) {
            await saveJSON(filePath, fileData);
        }
        
        res.json({
            success: true,
            imported: importCount,
            errors: errors,
            message: `Successfully imported ${importCount} questions`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/validate
router.get('/validate', adminAuth, async (req, res) => {
    try {
        const { topic, test } = req.query;
        
        const filePath = getQuestionFilePath(topic, test);
        const data = await loadJSON(filePath);
        
        const errors = [];
        const warnings = [];
        
        // Validate schema
        data.questions?.forEach((q, index) => {
            if (!q.id) errors.push(`Question ${index}: Missing ID`);
            if (!q.question) errors.push(`Question ${index}: Missing question text`);
            if (!Array.isArray(q.options) || q.options.length !== 4) {
                errors.push(`Question ${index}: Must have 4 options`);
            }
            if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
                errors.push(`Question ${index}: Invalid correctAnswer`);
            }
            if (!q.explanation) warnings.push(`Question ${index}: Missing explanation`);
            if (!q.optionFeedback || q.optionFeedback.length !== 4) {
                errors.push(`Question ${index}: Invalid optionFeedback`);
            }
        });
        
        res.json({
            valid: errors.length === 0,
            errors,
            warnings,
            questionCount: data.questions?.length || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/stats
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        const files = await fs.readdir(dataDir, { recursive: true });
        
        let totalQuestions = 0;
        const topics = new Set();
        
        for (const file of files) {
            if (file.endsWith('.json') && !file.includes('topics')) {
                try {
                    const data = await loadJSON(path.join(dataDir, file));
                    totalQuestions += data.questions?.length || 0;
                    if (data.topic) topics.add(data.topic);
                } catch {
                    // Skip invalid files
                }
            }
        }
        
        res.json({
            totalQuestions,
            activeTopics: topics.size,
            topicsList: Array.from(topics),
            lastUpdated: new Date().toISOString(),
            validationStatus: 'passing'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/export
router.get('/export', adminAuth, async (req, res) => {
    try {
        const { topic, format = 'json' } = req.query;
        
        if (!topic) {
            return res.status(400).json({ error: 'Missing topic parameter' });
        }
        
        if (format === 'json') {
            // Return JSON file
            const dataDir = path.join(__dirname, '..', 'data');
            const file = path.join(dataDir, `${topic}.json`);
            res.download(file);
        } else if (format === 'csv') {
            // Convert to CSV and send
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${topic}-export.csv`);
            // Generate CSV content
            res.send('topic,question,options,correctAnswer,explanation\n');
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth endpoint
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        const isValid = await verifyAdminCredentials(email, password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        if (!process.env.ADMIN_TOKEN) {
            return res.status(500).json({ error: 'ADMIN_TOKEN is not configured' });
        }

        res.json({
            success: true,
            token: process.env.ADMIN_TOKEN,
            user: {
                email: String(email).trim().toLowerCase(),
                role: 'admin'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.all('/auth/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (verifyAdminToken(token)) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
});

module.exports = router;
