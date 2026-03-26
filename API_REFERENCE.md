# API Documentation

Complete reference for all public APIs: Worker endpoints, app functions, and auth operations.

---

## Worker API (`src/worker.js`)

### Authentication Endpoints

#### `POST /api/auth/register`
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "turnstile_token": "0.abc123..."
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "created_at": "2026-03-26T10:00:00Z"
  },
  "session_token": "eyJhbGci..."
}
```

**Errors:**
- `400` - Invalid email or weak password
- `409` - Email already registered
- `429` - Rate limited (too many attempts)

---

#### `POST /api/auth/login`
Authenticate user and create session.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "turnstile_token": "0.abc123..."
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com"
  },
  "session_token": "eyJhbGci..."
}
```

**Errors:**
- `401` - Invalid credentials
- `404` - User not found
- `429` - Rate limited

---

#### `POST /api/auth/logout`
Invalidate current session.

**Headers:**
```
Authorization: Bearer {session_token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out"
}
```

---

#### `POST /api/auth/password-reset-request`
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Reset email sent if account exists"
}
```

---

#### `POST /api/auth/password-reset-confirm`
Confirm password reset with token.

**Request:**
```json
{
  "token": "reset_token_xyz",
  "password": "newPassword456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password updated"
}
```

**Errors:**
- `400` - Invalid token or expired
- `422` - Weak password

---

### Progress Sync Endpoints

#### `POST /api/progress/save`
Save quiz progress to cloud.

**Headers:**
```
Authorization: Bearer {session_token}
Content-Type: application/json
```

**Request:**
```json
{
  "topic_id": "life",
  "test_id": "01",
  "progress": {
    "current_question": 5,
    "total_questions": 35,
    "answered": 4,
    "correct": 3,
    "timestamp": 1711420800
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "saved_at": "2026-03-26T10:05:00Z"
}
```

---

#### `GET /api/progress/load`
Load quiz progress from cloud.

**Headers:**
```
Authorization: Bearer {session_token}
```

**Query Parameters:**
- `topic_id` (required) - Topic identifier
- `test_id` (required) - Test identifier

**Response (200):**
```json
{
  "progress": {
    "current_question": 5,
    "total_questions": 35,
    "answered": 4,
    "correct": 3,
    "timestamp": 1711420800
  }
}
```

**Errors:**
- `404` - No progress found (first time)
- `401` - Unauthorized

---

### AI Explanation Endpoint

#### `POST /api/explain`
Generate AI explanation for a question.

**Headers:**
```
Authorization: Bearer {session_token} (optional)
Content-Type: application/json
```

**Request:**
```json
{
  "question": "What is universal life insurance?",
  "options": [
    "Fixed premium term insurance",
    "Flexible premium with variable cash value",
    "Guaranteed premium for life",
    "Group coverage option"
  ],
  "correct_answer": 1,
  "user_selected": 2,
  "explanation": "UL insurance provides flexibility..."
}
```

**Response (200):**
```json
{
  "explanation": "You selected option 2, but the correct answer is option 1...",
  "follow_up": "Can you explain why universal life insurance is flexible?",
  "key_concepts": ["cash value", "flexible premiums", "investment returns"],
  "generated_at": "2026-03-26T10:10:00Z"
}
```

**Errors:**
- `429` - Rate limited (too many requests)
- `503` - AI service unavailable

---

### Admin Endpoints

#### `POST /api/admin/reset-student-progress`
Reset a student's progress (admin only).

**Headers:**
```
Authorization: Bearer {admin_session_token}
Content-Type: application/json
```

**Request:**
```json
{
  "student_id": "user_456",
  "topic_id": "life",
  "test_id": "01"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Progress reset",
  "reset_at": "2026-03-26T10:15:00Z"
}
```

**Errors:**
- `403` - Not an admin
- `404` - Student or progress not found

---

#### `GET /api/admin/analytics`
Get aggregated student analytics (admin only).

**Headers:**
```
Authorization: Bearer {admin_session_token}
```

**Query Parameters:**
- `topic_id` (optional) - Filter by topic
- `days` (optional) - Last N days (default: 7)

**Response (200):**
```json
{
  "total_students": 245,
  "active_today": 67,
  "average_score": 74.2,
  "topics": {
    "life": {
      "students": 156,
      "average_score": 76.5,
      "most_wrong_question": "q_life_47"
    },
    "ethics": {
      "students": 89,
      "average_score": 71.3
    }
  }
}
```

---

### Health Check

#### `GET /health`
Check Worker status.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-03-26T10:20:00Z",
  "version": "1.0.0"
}
```

---

## Frontend API (`js/app.js`)

### Quiz Management

#### `MCQApp.selectTopic(topicId)`
Load and display a topic.

**Parameters:**
```javascript
topicId: string  // e.g., "life", "ethics"
```

**Returns:** `Promise<void>`

**Example:**
```javascript
await MCQApp.selectTopic("life");
```

---

#### `MCQApp.selectPracticeTest(topicId, testId)`
Start a practice test.

**Parameters:**
```javascript
topicId: string   // e.g., "life"
testId: string    // e.g., "01", "certification-exam"
```

**Returns:** `Promise<void>`

**Example:**
```javascript
await MCQApp.selectPracticeTest("life", "01");
```

---

#### `MCQApp.submitAnswer(questionIndex, selectedOptionIndex)`
Submit an answer to current question.

**Parameters:**
```javascript
questionIndex: number        // 0-based index
selectedOptionIndex: number  // 0-3 (A-D)
```

**Returns:** `boolean` - Whether answer is correct

**Example:**
```javascript
const isCorrect = MCQApp.submitAnswer(0, 1); // Submit option B for first question
```

---

#### `MCQApp.nextQuestion()`
Move to next question in quiz.

**Returns:** `void`

**Example:**
```javascript
MCQApp.nextQuestion();
```

---

#### `MCQApp.previousQuestion()`
Move to previous question.

**Returns:** `void`

---

#### `MCQApp.getProgress()`
Get current quiz progress.

**Returns:**
```javascript
{
  current_question: number,
  total_questions: number,
  answered: number,
  correct: number,
  percentage: number
}
```

---

### Wrong-Answer Review

#### `MCQApp.viewWrongAnswerReview()`
Display review of all incorrectly answered questions.

**Returns:** `Promise<void>`

**Example:**
```javascript
await MCQApp.viewWrongAnswerReview();
```

---

#### `MCQApp.clearWrongAnswersReview()`
Clear the wrong-answer history.

**Returns:** `Promise<void>`

---

### AI Explanations

#### `MCQApp.generateAIExplanation(questionIndex)`
Get AI-generated explanation for a question.

**Parameters:**
```javascript
questionIndex: number  // 0-based index in current quiz
```

**Returns:** `Promise<string>` - Explanation text

**Example:**
```javascript
const explanation = await MCQApp.generateAIExplanation(2);
console.log(explanation);
```

---

### Manuals

#### `MCQApp.viewManual(manualId)`
Display PDF manual.

**Parameters:**
```javascript
manualId: string  // e.g., "ethics-manual", "life-manual"
```

**Returns:** `void`

---

### Session Management

#### `MCQApp.resumeSession()`
Restore previous quiz session.

**Returns:** `Promise<void>`

---

#### `MCQApp.saveSession()`
Persist current session to storage.

**Returns:** `Promise<void>`

---

## Authentication API (`js/auth.js`)

### Account Operations

#### `Auth.register(email, password)`
Register new account.

**Parameters:**
```javascript
email: string      // Valid email
password: string   // Min 8 chars, complexity required
```

**Returns:** `Promise<{success: boolean, user: object, error?: string}>`

**Example:**
```javascript
const result = await Auth.register("user@example.com", "SecurePass123");
if (result.success) {
  console.log("Account created:", result.user);
} else {
  console.error("Registration failed:", result.error);
}
```

---

#### `Auth.login(email, password)`
Authenticate and create session.

**Parameters:**
```javascript
email: string
password: string
```

**Returns:** `Promise<{success: boolean, user: object, error?: string}>`

---

#### `Auth.logout()`
End current session.

**Returns:** `Promise<void>`

---

#### `Auth.changePassword(currentPassword, newPassword)`
Update account password.

**Parameters:**
```javascript
currentPassword: string
newPassword: string
```

**Returns:** `Promise<{success: boolean, error?: string}>`

---

### Session Management

#### `Auth.isAuthenticated()`
Check if user has active session.

**Returns:** `boolean`

---

#### `Auth.getCurrentUser()`
Get current logged-in user.

**Returns:** `object | null` - User object or null if not logged in

---

#### `Auth.refreshSession()`
Refresh session token.

**Returns:** `Promise<void>`

---

## Storage API (`js/storage-manager.js`)

#### `StorageManager.getProgress(topicId, testId)`
Retrieve saved quiz progress.

**Returns:** `object | null`

---

#### `StorageManager.setProgress(topicId, testId, progress)`
Save quiz progress.

**Returns:** `void`

---

#### `StorageManager.getShuffle(topicId, testId)`
Get option shuffle order for a quiz.

**Returns:** `array | null`

---

#### `StorageManager.setShuffle(topicId, testId, shuffle)`
Save option shuffle for a quiz.

**Returns:** `void`

---

## Quiz Renderer API (`js/quiz-renderer.js`)

#### `QuizRenderer.renderQuestion(question, displayOptions)`
Render a question with given options.

**Parameters:**
```javascript
question: object          // Question data
displayOptions: array     // Reordered option indices
```

**Returns:** `HTMLElement`

---

#### `QuizRenderer.getShuffleOrder(options)`
Generate random option order (Fisher-Yates).

**Returns:** `array` - Indices in new order

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid credentials",
    "status": 401
  }
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `AUTH_FAILED` | 401 | Authentication failed |
| `UNAUTHORIZED` | 403 | Not permitted |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid input |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal error |

---

## Rate Limiting

- Auth endpoints: 5 requests/minute per IP
- AI explain: 10 requests/minute per user
- Progress sync: 100 requests/minute per user
- Admin endpoints: 20 requests/minute per admin

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit` (default: 20, max: 100)
- `offset` (default: 0)

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "total": 245,
    "limit": 20,
    "offset": 0,
    "next_offset": 20
  }
}
```

---

## Versioning

Current API version: **v1**

All endpoints are accessed at `/api/*` and support:
- `Accept: application/json`
- `Content-Type: application/json`

Future versions will use `/api/v2/*`, `/api/v3/*`, etc.

---

## Testing APIs

### Using cURL

```bash
# Health check
curl https://hllqpmcqs.com/health

# Register
curl -X POST https://hllqpmcqs.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123","turnstile_token":"..."}'

# Login
curl -X POST https://hllqpmcqs.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123","turnstile_token":"..."}'

# Save progress (with auth)
curl -X POST https://hllqpmcqs.com/api/progress/save \
  -H "Authorization: Bearer {session_token}" \
  -H "Content-Type: application/json" \
  -d '{"topic_id":"life","test_id":"01","progress":{...}}'
```

### Using JavaScript

```javascript
// Fetch with auth
async function apiCall(endpoint, method = 'GET', data = null) {
  const token = Auth.getSessionToken();
  const response = await fetch(`https://hllqpmcqs.com/api${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: data ? JSON.stringify(data) : undefined
  });
  return response.json();
}

// Usage
const progress = await apiCall('/progress/load?topic_id=life&test_id=01');
```

---

## Support & Issues

For API questions or issues:
1. Check this documentation
2. Review [CODEBASE_REFERENCE.md](CODEBASE_REFERENCE.md)
3. Check Worker logs in Cloudflare dashboard
4. Open GitHub issue with error details
