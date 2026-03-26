# Admin Content Manager - API Reference

## Base URL
```
http://localhost:3000/api/admin
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer YOUR_ADMIN_TOKEN
```

## Response Format
All responses are JSON. Success responses return status `2xx`, errors return `4xx` or `5xx`.

### Success Response
```json
{
    "success": true,
    "data": { ... },
    "message": "Operation successful"
}
```

### Error Response
```json
{
    "error": "Error message",
    "code": "ERROR_CODE",
    "status": 400
}
```

---

## Endpoints

### Authentication

#### POST /auth/verify
Verify authentication token validity.

**Request:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/admin/auth/verify
```

**Response:**
```json
{
    "valid": true,
    "user": {
        "email": "admin@example.com",
        "role": "admin"
    }
}
```

---

### Questions

#### GET /questions
List all questions for a topic and test.

**Query Parameters:**
- `topic` (required): Topic ID (e.g., "ethics", "life")
- `test` (required): Test ID (e.g., "01", "02")
- `page` (optional): Pagination (default: 1)
- `limit` (optional): Items per page (default: 50)
- `search` (optional): Search query

**Request:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/admin/questions?topic=ethics&test=01"
```

**Response:**
```json
{
    "topic": "Ethics",
    "topicId": "ethics",
    "description": "Insurance Ethics and Market Conduct",
    "questions": [
        {
            "id": "ethics-01-1",
            "question": "What is market conduct?",
            "options": ["A", "B", "C", "D"],
            "correctAnswer": 1,
            "difficulty": "medium",
            "tags": ["market", "conduct"]
        }
    ],
    "count": 50,
    "total": 123
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing required parameters
- `401`: Unauthorized
- `500`: Server error

---

#### GET /questions/:id
Retrieve a single question by ID.

**Parameters:**
- `id` (path, required): Question ID (format: "topic-test-number")

**Request:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/admin/questions/ethics-01-47
```

**Response:**
```json
{
    "id": "ethics-01-47",
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

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `404`: Question not found
- `500`: Server error

---

#### POST /questions
Create a new question.

**Request Body:**
```json
{
    "topic": "ethics",
    "testId": "01",
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
    "explanation": "Market conduct refers to fair and honest practices...",
    "difficulty": "medium",
    "tags": ["market", "conduct"]
}
```

**Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}' \
  http://localhost:3000/api/admin/questions
```

**Response:**
```json
{
    "success": true,
    "question": {
        "id": "ethics-01-124",
        "question": "What is market conduct?",
        ...
    }
}
```

**Validation Rules:**
- `topic` and `testId` required
- `question` min length: 10 chars
- Exactly 4 `options` required
- `correctAnswer` must be 0-3
- 4 `optionFeedback` entries required
- Correct answer feedback must be `null`
- `explanation` min length: 20 chars

**Status Codes:**
- `201`: Created successfully
- `400`: Validation error
- `401`: Unauthorized
- `409`: Duplicate ID
- `500`: Server error

---

#### PUT /questions/:id
Update an existing question.

**Parameters:**
- `id` (path, required): Question ID

**Request Body:** Same as POST (all fields optional)

**Request:**
```bash
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "Updated text", ...}' \
  http://localhost:3000/api/admin/questions/ethics-01-47
```

**Response:**
```json
{
    "success": true,
    "question": { ... },
    "message": "Question updated successfully"
}
```

**Status Codes:**
- `200`: Updated successfully
- `400`: Validation error
- `401`: Unauthorized
- `404`: Question not found
- `500`: Server error

---

#### DELETE /questions/:id
Delete a question permanently.

**Parameters:**
- `id` (path, required): Question ID

**Request:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/admin/questions/ethics-01-47
```

**Response:**
```json
{
    "success": true,
    "message": "Question deleted successfully"
}
```

**Status Codes:**
- `200`: Deleted successfully
- `401`: Unauthorized
- `404`: Question not found
- `500`: Server error

---

### Bulk Operations

#### POST /questions/bulk-import
Import multiple questions from CSV data.

**Request Body:**
```json
{
    "topic": "ethics",
    "testId": "01",
    "data": [
        {
            "question": "What is market conduct?",
            "option_a": "Buying insurance",
            "option_b": "Fair and honest practices",
            "option_c": "Selling products",
            "option_d": "Managing risk",
            "correct_answer": 1,
            "explanation": "Market conduct refers to...",
            "difficulty": "medium",
            "tags": "market,conduct"
        }
    ]
}
```

**Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}' \
  http://localhost:3000/api/admin/questions/bulk-import
```

**Response:**
```json
{
    "success": true,
    "imported": 25,
    "skipped": 2,
    "errors": [
        "Row 3: Missing correct_answer",
        "Row 7: Invalid option format"
    ],
    "message": "Successfully imported 25 questions"
}
```

**Limits:**
- Max batch size: 1000 questions
- Max file size: 50MB
- Max request timeout: 60 seconds

**Status Codes:**
- `201`: Import successful (partial or full)
- `400`: Validation error
- `401`: Unauthorized
- `413`: Payload too large
- `500`: Server error

---

### Validation

#### GET /validate
Run schema validation on questions.

**Query Parameters:**
- `topic` (optional): Topic ID
- `test` (optional): Test ID
- `level` (optional): "strict" or "basic" (default: "basic")

**Request:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/admin/validate?topic=ethics&test=01"
```

**Response:**
```json
{
    "valid": true,
    "errors": [],
    "warnings": [
        "Question ethics-01-15: Missing tags",
        "Question ethics-01-23: Long explanation (>500 chars)"
    ],
    "questionCount": 47,
    "timestamp": "2026-03-26T10:30:00Z"
}
```

**Validation Checks:**
- Schema compliance
- Required fields present
- Data type validation
- Referential integrity
- HTML injection prevention
- Duplicate detection

**Status Codes:**
- `200`: Validation complete
- `400`: Invalid parameters
- `401`: Unauthorized
- `404`: Topic/test not found
- `500`: Server error

---

### Analytics

#### GET /stats
Get dashboard statistics.

**Query Parameters:**
- `topic` (optional): Filter by topic
- `dateFrom` (optional): ISO 8601 date
- `dateTo` (optional): ISO 8601 date

**Request:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/admin/stats
```

**Response:**
```json
{
    "totalQuestions": 371,
    "activeTopics": 4,
    "topicsList": ["ethics", "life", "accident", "segregated"],
    "questionsByTopic": {
        "ethics": 95,
        "life": 98,
        "accident": 89,
        "segregated": 89
    },
    "difficultyDistribution": {
        "easy": 74,
        "medium": 186,
        "hard": 111
    },
    "recentChanges": {
        "created": 5,
        "updated": 12,
        "deleted": 0,
        "lastUpdated": "2026-03-26T10:00:00Z"
    },
    "validationStatus": "passing",
    "cacheSize": "2.3MB"
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `500`: Server error

---

### Export

#### GET /export
Export questions in various formats.

**Query Parameters:**
- `topic` (optional): Topic ID (default: all)
- `format` (optional): "json", "csv", or "pdf" (default: "json")
- `test` (optional): Test ID filter
- `difficulty` (optional): "easy", "medium", "hard"

**Request:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/admin/export?topic=ethics&format=csv" \
  -o ethics-export.csv
```

**Response:**
- `format=json`: JSON file
- `format=csv`: CSV file with headers
- `format=pdf`: PDF report with formatting

**CSV Format:**
```
topic,test_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,tags
ethics,01,"What is market conduct?","Buying","Fair practices","Selling","Managing",1,"Market conduct refers to...",medium,"market,conduct"
```

**Status Codes:**
- `200`: File ready for download
- `400`: Invalid parameters
- `401`: Unauthorized
- `404`: Topic not found
- `500`: Server error

---

## Rate Limiting

Default limits (configurable):
- 100 requests per minute per IP
- 1000 requests per hour per token
- 10 concurrent connections per token

Response headers on rate limit:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1648299600
```

---

## Error Codes

Common error codes returned:

| Code | Status | Meaning |
|------|--------|---------|
| `INVALID_TOKEN` | 401 | Authorization token missing or invalid |
| `EXPIRED_TOKEN` | 401 | Token has expired |
| `INSUFFICIENT_PERMS` | 403 | User lacks required permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `DUPLICATE_ENTRY` | 409 | Resource already exists |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeds limit |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Examples

### Example: Create Question and Verify
```javascript
// 1. Create question
const createResp = await fetch('/api/admin/questions', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer TOKEN',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        topic: 'ethics',
        testId: '01',
        question: 'What is market conduct?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 1,
        optionFeedback: ['Wrong', null, 'Wrong', 'Wrong'],
        explanation: 'Market conduct...',
        difficulty: 'medium',
        tags: ['market', 'conduct']
    })
});

const question = await createResp.json();
console.log('Created:', question.question.id);

// 2. Validate content
const validateResp = await fetch(
    '/api/admin/validate?topic=ethics&test=01',
    { headers: { 'Authorization': 'Bearer TOKEN' } }
);

const validation = await validateResp.json();
console.log('Valid:', validation.valid);
```

### Example: Bulk Import with Error Handling
```javascript
const importResp = await fetch('/api/admin/questions/bulk-import', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer TOKEN',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        topic: 'ethics',
        testId: '01',
        data: csvData
    })
});

const result = await importResp.json();
console.log(`Imported: ${result.imported}`);
if (result.errors.length > 0) {
    console.warn('Errors:', result.errors);
}
```

### Example: Export and Download
```javascript
const exportResp = await fetch(
    '/api/admin/export?topic=ethics&format=csv',
    { headers: { 'Authorization': 'Bearer TOKEN' } }
);

const blob = await exportResp.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'ethics-export.csv';
a.click();
```

---

## Webhooks (Optional)

Configure webhooks for events:
```
POST /api/admin/webhooks
{
    "events": ["question.created", "question.updated", "import.completed"],
    "url": "https://your-app.com/webhook"
}
```

Events fired:
- `question.created`: New question added
- `question.updated`: Question modified
- `question.deleted`: Question removed
- `import.started`: Bulk import started
- `import.completed`: Bulk import finished
- `validation.failed`: Validation errors found

---

## Changelog

### v1.0.0 (March 2026)
- Initial release
- Core CRUD operations
- Bulk import/export
- Validation framework
- Analytics dashboard
