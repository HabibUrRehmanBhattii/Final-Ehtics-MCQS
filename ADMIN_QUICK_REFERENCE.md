# Admin Content Manager - Quick Reference

## 🚀 Getting Started

### Installation (Pick One)
```bash
# Linux/Mac
bash setup-admin.sh

# Windows
setup-admin.bat

# Manual
npm install express multer jsonschema dotenv cors helmet
```

### Configuration
```bash
# Create .env file
ADMIN_TOKEN=your-secure-token-here
NODE_ENV=production
API_PORT=3000
```

### Start Server
```bash
npm start
```

### Access Admin Panel
```
http://localhost:3000/admin-content-manager.html
```

---

## 📝 Quick API Commands

### Create Question
```bash
curl -X POST http://localhost:3000/api/admin/questions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "ethics",
    "testId": "01",
    "question": "What is market conduct?",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 1,
    "optionFeedback": ["Wrong", null, "Wrong", "Wrong"],
    "explanation": "Market conduct is..."
  }'
```

### List Questions
```bash
curl http://localhost:3000/api/admin/questions?topic=ethics&test=01 \
  -H "Authorization: Bearer TOKEN"
```

### Update Question
```bash
curl -X PUT http://localhost:3000/api/admin/questions/ethics-01-47 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "Updated text"}'
```

### Delete Question
```bash
curl -X DELETE http://localhost:3000/api/admin/questions/ethics-01-47 \
  -H "Authorization: Bearer TOKEN"
```

### Validate Content
```bash
curl http://localhost:3000/api/admin/validate?topic=ethics&test=01 \
  -H "Authorization: Bearer TOKEN"
```

### Get Statistics
```bash
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer TOKEN"
```

### Export Data
```bash
curl http://localhost:3000/api/admin/export?topic=ethics&format=csv \
  -H "Authorization: Bearer TOKEN" \
  -o ethics.csv
```

---

## 🎯 UI Workflows

### Add Single Question
1. Dashboard → "Add Question" button
2. Fill in form (topic, question, options, correct answer)
3. Add feedback and explanation
4. Click "Save Question"

### Bulk Import from CSV
1. Dashboard → "Bulk Import" button
2. Upload CSV file
3. Click "Preview" to verify
4. Click "Import" to save

### Edit Existing Question
1. Dashboard → "Edit Questions" tab
2. Search for question
3. Click to load into form
4. Make changes
5. Click "Save Question"

### Validate All Content
1. Dashboard → "Validation" tab
2. Select topic
3. Click "Run Full Validation"
4. Review results

### Export Data
1. Dashboard → "Export Data" tab
2. Select format (JSON/CSV/PDF)
3. Select topic
4. Click "Export"

---

## 📊 Question Schema

```json
{
  "id": "topic-test-number",
  "question": "Question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "optionFeedback": [null, "Why B is wrong", "Why C is wrong", "Why D is wrong"],
  "explanation": "Explanation of correct answer",
  "difficulty": "medium",
  "tags": ["tag1", "tag2"],
  "createdAt": "2026-03-26T10:00:00Z"
}
```

**Rules:**
- Exactly 4 options required
- Correct answer (0-3)
- Correct answer feedback must be `null`
- All other feedback required (or `null` if no feedback)

---

## ⚙️ Integration Steps

### 1. Add Routes to Express
```javascript
const adminRoutes = require('./src/admin-routes');
app.use('/api/admin', adminRoutes);
```

### 2. Add Middleware
```javascript
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || token !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};
```

### 3. Link in Main App
```html
<a href="/admin-content-manager.html" class="admin-link">Admin Panel</a>
```

---

## 🐛 Troubleshooting

### Panel Won't Load
1. Check token: `localStorage.getItem('admin_token')`
2. Verify API: `curl http://localhost:3000/api/admin/stats`
3. Clear cache: DevTools → Application → Clear storage
4. Hard refresh: Ctrl+Shift+R

### Questions Not Saving
1. Check network (DevTools → Network tab)
2. Verify file permissions: `ls -la data/`
3. Check JSON syntax with validator
4. Review server logs

### Export Not Working
1. Verify topic exists
2. Check disk space
3. Verify correct format selected
4. Check CORS headers in server

---

## 📁 Files Created

```
admin-content-manager.html              # Main admin UI
admin-login.html                        # Login page
js/admin-api.js                         # API client
src/admin-routes.js                     # Express routes
setup-admin.sh                          # Linux setup
setup-admin.bat                         # Windows setup
ADMIN_CONTENT_MANAGER_GUIDE.md          # Full guide
ADMIN_API_REFERENCE.md                  # API docs
ADMIN_INTEGRATION.md                    # Integration
ADMIN_IMPLEMENTATION_SUMMARY.md         # Summary
ADMIN_QUICK_REFERENCE.md               # This file
```

---

## 🔑 Environment Variables

```bash
# Required
ADMIN_TOKEN=your-secure-token-here

# Optional
NODE_ENV=production
API_PORT=3000
DATA_DIR=./data
LOG_LEVEL=info
```

---

## 📞 Common Tasks

### Generate Secure Token
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Test Authentication
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/admin/auth/verify
```

### Count Questions by Topic
```bash
curl -s http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer TOKEN" | jq '.questionsByTopic'
```

### Backup All Questions
```bash
curl -s http://localhost:3000/api/admin/export?topic=all&format=json \
  -H "Authorization: Bearer TOKEN" > backup.json
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `ADMIN_CONTENT_MANAGER_GUIDE.md` | Complete user guide with all features |
| `ADMIN_API_REFERENCE.md` | Detailed API endpoint documentation |
| `ADMIN_INTEGRATION.md` | Step-by-step integration instructions |
| `ADMIN_IMPLEMENTATION_SUMMARY.md` | Overview of what was created |
| `ADMIN_QUICK_REFERENCE.md` | This quick reference card |

---

## ✅ Pre-Deployment Checklist

- [ ] All dependencies installed
- [ ] .env configured with secure ADMIN_TOKEN
- [ ] Express routes integrated
- [ ] Authentication middleware added
- [ ] Admin panel accessible at /admin-content-manager.html
- [ ] API endpoints tested with curl
- [ ] UI tested in browser
- [ ] Questions saved correctly to files
- [ ] Validation working properly
- [ ] Export functionality verified
- [ ] Error handling tested
- [ ] HTTPS enabled (production)
- [ ] Rate limiting configured
- [ ] Backups scheduled
- [ ] Team trained on usage

---

## 🆘 Support

For detailed help, see:
- General questions → `ADMIN_CONTENT_MANAGER_GUIDE.md`
- API issues → `ADMIN_API_REFERENCE.md`
- Integration help → `ADMIN_INTEGRATION.md`
- Browser console errors → DevTools (F12)
- Server errors → Check logs in terminal

---

**Version:** 1.0.0 | **Updated:** March 26, 2026
