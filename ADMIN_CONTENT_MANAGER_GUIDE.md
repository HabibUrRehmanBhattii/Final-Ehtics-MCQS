# Admin Content Manager - Complete Integration Guide

## Overview
The Admin Content Manager is a comprehensive web-based interface for managing MCQ content, providing real-time editing, validation, bulk import/export, and analytics.

## Architecture

### Components

#### 1. Frontend (`admin-content-manager.html`)
- **Dashboard**: Real-time statistics and quick actions
- **Add Question**: Form-based question creation with instant validation
- **Edit Questions**: Search and edit existing questions
- **Bulk Import**: CSV-based batch question import
- **Validation**: Schema compliance checking across all files
- **Export**: Data export in JSON/CSV/PDF formats

#### 2. API Client (`js/admin-api.js`)
```javascript
// Singleton instance for all API calls
window.adminAPI = new AdminAPI();

// Available methods:
adminAPI.init()                          // Initialize with auth check
adminAPI.getQuestions(topic, testId)    // Fetch all questions
adminAPI.getQuestion(questionId)        // Fetch single question
adminAPI.createQuestion(data)           // Create new question
adminAPI.updateQuestion(id, data)       // Update question
adminAPI.deleteQuestion(questionId)     // Delete question
adminAPI.bulkImport(csvData, topic, testId)  // Batch import
adminAPI.validateContent(topic, testId) // Run schema validation
adminAPI.getDashboardStats()            // Get analytics data
adminAPI.exportQuestions(topic, format) // Export data
```

#### 3. Backend (`src/admin-routes.js`)
Express.js router with the following endpoints:

```
POST   /api/admin/auth/verify              - Check authentication
GET    /api/admin/questions                - List questions
GET    /api/admin/questions/:id            - Get single question
POST   /api/admin/questions                - Create question
PUT    /api/admin/questions/:id            - Update question
DELETE /api/admin/questions/:id            - Delete question
POST   /api/admin/questions/bulk-import    - Batch import
GET    /api/admin/validate                 - Validate schema
GET    /api/admin/stats                    - Get statistics
GET    /api/admin/export                   - Export data
```

#### 4. Authentication (`admin-login.html`)
- Email/password based authentication
- JWT token storage in localStorage
- "Remember me" functionality
- Session validation on admin panel load

## Setup Instructions

### 1. Install Backend Dependencies
```bash
npm install express multer jsonschema dotenv
```

### 2. Configure Environment Variables
Create `.env` file:
```
ADMIN_TOKEN=your-secure-token-here
NODE_ENV=production
API_PORT=3000
DATA_DIR=./data
```

### 3. Add Routes to Express Server
```javascript
const adminRoutes = require('./src/admin-routes');
app.use('/api/admin', adminRoutes);

// Also add authentication middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || token !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};
```

### 4. Link Admin Panel in Main App
Add to `index.html`:
```html
<a href="/admin-content-manager.html" class="admin-link">Admin Panel</a>
```

## Usage Workflows

### Adding a Single Question
1. Navigate to "Add Question" tab
2. Fill in topic, test ID, and question text
3. Enter 4 options and select correct answer
4. Add option feedback (optional)
5. Add explanation and tags
6. Click "Save Question"
7. Question is immediately saved to JSON file

### Bulk Importing Questions
1. Prepare CSV file with format:
```csv
topic,test_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation
ethics,1,"What is market conduct?","Buying","Fair practices","Selling","Managing",1,"Market conduct..."
```
2. Navigate to "Bulk Import" tab
3. Upload CSV file
4. Click "Preview" to verify data
5. Click "Import" to save all questions

### Editing Existing Questions
1. Navigate to "Edit Questions" tab
2. Search for question by text or ID
3. Click question to load into form
4. Make changes
5. Click "Save Question"

### Running Validation
1. Navigate to "Validation" tab
2. Select topic
3. Click "Run Full Validation"
4. Review results:
   - ✓ Green: All checks passed
   - ✗ Red: Errors found (listed below)
   - ⚠ Yellow: Warnings (missing fields, etc.)

### Exporting Data
1. Navigate to "Export Data" tab
2. Select format (JSON, CSV, or PDF)
3. Select topic(s)
4. Click "Export"
5. File downloads automatically

## Question Schema

Each question must follow this structure:
```json
{
  "id": "ethics-1-47",
  "question": "What is market conduct?",
  "options": [
    "Buying insurance",
    "Fair and honest practices",
    "Selling products",
    "Managing risk"
  ],
  "correctAnswer": 1,
  "optionFeedback": [
    "Incorrect: This is purchasing, not conduct.",
    null,
    "Incorrect: This is sales, not conduct.",
    "Incorrect: This is risk management."
  ],
  "explanation": "Market conduct refers to fair and honest practices in the insurance industry...",
  "difficulty": "medium",
  "tags": ["market", "conduct", "ethics"],
  "createdAt": "2026-03-26T10:00:00Z",
  "updatedAt": "2026-03-26T10:00:00Z"
}
```

### Required Fields
- `id`: Unique identifier (auto-generated or provided)
- `question`: Question text (supports HTML)
- `options`: Array of exactly 4 options
- `correctAnswer`: Zero-based index of correct option (0-3)
- `optionFeedback`: Array of 4 feedback strings (correct answer must be null)
- `explanation`: Detailed explanation of correct answer

### Optional Fields
- `difficulty`: "easy", "medium", or "hard" (default: "medium")
- `tags`: Array of category tags for filtering
- `createdAt`/`updatedAt`: ISO 8601 timestamps

## Data Files Structure

Questions are stored in topic-based JSON files:
```
data/
├── llqp-ethics/
│   ├── llqp-ethics-1.json
│   ├── llqp-ethics-2.json
│   └── ...
├── llqp-life/
│   ├── llqp-life-1.json
│   └── ...
└── topics.json
```

Each file contains:
```json
{
  "topic": "Ethics",
  "topicId": "ethics",
  "description": "Insurance Ethics and Market Conduct",
  "examTips": "Focus on market conduct and fair dealing principles",
  "questions": [
    { ... }
  ]
}
```

## Validation Rules

The system validates:
- ✓ Exactly 4 options per question
- ✓ Valid correctAnswer index (0-3)
- ✓ Exactly 4 feedback entries
- ✓ Correct answer feedback is null
- ✓ All required fields present
- ✓ No draft/placeholder language
- ✓ No HTML injection risks
- ✓ No duplicate question IDs

## Error Handling

### Common Errors & Solutions

**"Missing required field: topic"**
- Ensure topic is selected in form
- Check that topic exists in system

**"Must have exactly 4 options"**
- All 4 option fields must be filled
- Cannot skip any option

**"Correct answer feedback must be null"**
- Leave feedback empty for correct answer
- Non-null values are only for wrong answers

**"Failed to create question"**
- Check network connection
- Verify API endpoint is running
- Check authentication token in localStorage

**"Question not found"**
- Question ID may have changed
- File may have been deleted
- Check topic/test ID parameters

## Performance Optimization

### Caching Strategy
- Dashboard stats cached for 5 minutes
- Questions list cached per session
- Use cache-busting query params for fresh data

### Large Dataset Handling
- For 1000+ questions, use pagination
- Implement lazy loading in question list
- Consider splitting into multiple test files

### File I/O Optimization
- Batch writes when possible
- Use streaming for large exports
- Implement debouncing for frequent saves

## Security Considerations

### Authentication
- All admin endpoints require valid token
- Tokens stored securely in localStorage
- Token expiration: 24 hours
- Implement token refresh mechanism

### Authorization
- Role-based access control (RBAC) recommended
- Admin, Editor, Viewer roles
- Audit logs for all modifications
- IP whitelisting for production

### Data Protection
- Validate all input before processing
- Sanitize HTML in question text
- Prevent SQL injection (if DB used)
- Encrypt sensitive data in transit

## Monitoring & Debugging

### Admin Console
Access browser DevTools (F12) for:
- Network tab: Monitor API calls
- Console: View error messages
- Application tab: Check localStorage tokens
- Performance: Profile load times

### Backend Logging
Add to admin-routes.js:
```javascript
router.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
```

### Testing API Endpoints
Use curl or Postman:
```bash
# Get questions
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/admin/questions?topic=ethics&test=1

# Create question
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic":"ethics","question":"..."}' \
  http://localhost:3000/api/admin/questions
```

## Advanced Features

### Custom Workflows
- Add approval workflow for new questions
- Implement version control for questions
- Track question performance metrics
- Schedule content updates

### Integration
- Connect to external question banks
- Sync with LMS platforms
- API for third-party tools
- Automated content pipeline

### Analytics
- Question difficulty analysis
- Student performance by topic
- Time-spent per question
- Wrong answer patterns

## Troubleshooting

### Admin Panel Won't Load
1. Check authentication: `localStorage.getItem('admin_token')`
2. Verify API is running: `curl http://localhost:3000/api/admin/stats`
3. Clear cache: DevTools → Application → Clear storage
4. Hard refresh: Ctrl+Shift+R

### Questions Not Saving
1. Check network requests in DevTools
2. Verify file permissions: `ls -la data/`
3. Check JSON syntax with validator
4. Review server logs for errors

### Export Function Failing
1. Verify topic exists in system
2. Check disk space for file generation
3. Ensure correct format selected
4. Check CORS headers if cross-origin

## Support & Maintenance

For questions or issues:
1. Check this documentation first
2. Review error messages in admin panel
3. Check browser console (F12)
4. Review server logs
5. Contact development team with:
   - Error message
   - Steps to reproduce
   - Admin panel screenshot
   - Browser/OS version
