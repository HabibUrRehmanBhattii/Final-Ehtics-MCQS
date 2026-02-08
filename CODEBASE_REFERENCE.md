# 🎯 CODEBASE REFERENCE - LLQP & WFG Exam Prep App

**Last Updated:** February 7, 2026  
**Purpose:** Complete reference for AI assistants to understand the entire codebase instantly

---

## 📋 PROJECT OVERVIEW

**Type:** Progressive Web App (PWA)  
**Purpose:** Insurance licensing exam preparation platform (LLQP & WFG)  
**Tech Stack:** Vanilla JavaScript, CSS, HTML5, Service Worker  
**Hosting:** Static files (no backend server)

---

## 🗂️ FILE SYSTEM STRUCTURE

```
c:\Users\C6475\Desktop\Ehtics MCQS\
│
├── index.html                    # Main HTML entry point
├── manifest.webmanifest          # PWA manifest for installability
├── sw.js                         # Service Worker (handles caching, offline mode)
├── README.md                     # Project documentation
├── wrangler.jsonc                # Cloudflare Workers config (if deployed)
│
├── assets/
│   └── icons/                    # PWA icons (192x192, 512x512)
│
├── css/
│   ├── style.css                 # Main stylesheet (active)
│   └── style_backup.css          # Backup version
│
├── js/
│   └── app.js                    # Main application logic (1420 lines)
│
├── data/                         # ⚠️ CRITICAL - All question data lives here
│   ├── topics.json               # 🔥 MAIN topics configuration (app loads this)
│   ├── topics-updated.json       # Secondary topics file (both are cached)
│   ├── user_data.json            # User progress tracking
│   │
│   ├── llqp-ethics/              # LLQP Ethics question sets
│   │   ├── practice-1.json       # 10 questions
│   │   ├── practice-2.json       # 20 questions
│   │   └── practice-3.json       # 26 questions
│   │
│   ├── llqp-segregated/          # LLQP Segregated Funds & Annuities
│   │   └── practice-1.json       # 13 questions
│   │
│   └── flashcards/               # Flashcard question sets
│       ├── flashcards-1.json     # 20 flashcards
│       └── flashcards-2-part-[1-8].json  # 8 parts (20+20+20+20+20+20+20+10)
│
└── tools/                        # Python utility scripts
    ├── debug_flash_json.py
    ├── fix_explanation_inner_quotes.py
    ├── fix_flashcards_quotes.py
    ├── fix_single_option_quotes.py
    └── split_flashcards.py
```

---

## 🔑 CRITICAL FILES EXPLAINED

### 1. **data/topics.json** (MOST IMPORTANT)

This is the **master configuration file** that controls what appears on the website.

**Structure:**
```json
{
  "topics": [
    {
      "id": "unique-id",
      "name": "Display Name",
      "slug": "url-slug",
      "description": "Brief description",
      "color": "#hex-color",
      "icon": "emoji",
      "status": "active" | "coming-soon",
      "practiceTests": [
        {
          "id": "test-id",
          "name": "Test Name",
          "description": "Test description",
          "questionCount": 10,
          "dataFile": "path/to/file.json?v=cache-version"
        }
      ]
    }
  ]
}
```

**⚠️ CRITICAL RULES:**
- `status: "active"` → Shows on homepage with "Start Practice" button
- `status: "coming-soon"` → Shows grayed out with "Coming Soon" badge
- **Active topics MUST come BEFORE coming-soon topics** in the array (display order)
- `questionCount` MUST match actual question count in the JSON file
- Cache-busting: Change `?v=...` when updating data files
- Topics load from this file via `app.js` line 209

---

### 2. **Question JSON Files** (data/llqp-ethics/*.json, data/flashcards/*.json)

**Structure:**
```json
{
  "topic": "Topic Name",
  "topicId": "topic-id",
  "description": "Description",
  "examTips": "Study tips",
  "questions": [
    {
      "id": 1,
      "question": "Question text\nSupports multiline with \\n",
      "options": [
        "A. Option 1",
        "B. Option 2",
        "C. Option 3",
        "D. Option 4"
      ],
      "correctAnswer": 0,  // Index (0 = A, 1 = B, 2 = C, 3 = D)
      "optionFeedback": [
        null,  // Correct answer gets null (explanation is in main explanation)
        "Why B is wrong",
        "Why C is wrong",
        "Why D is wrong"
      ],
      "explanation": "Detailed explanation for correct answer",
      "difficulty": "easy" | "medium" | "hard",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ]
}
```

**⚠️ CRITICAL RULES:**
- `correctAnswer` is **zero-indexed** (0-3 for A-D)
- `optionFeedback[correctAnswer]` should be `null`
- All other `optionFeedback` entries explain why that option is WRONG
- Questions MUST have unique `id` within the file (sequential: 1, 2, 3...)
- Options should include "A. ", "B. ", "C. ", "D. " prefixes

---

### 3. **sw.js** (Service Worker)

**Purpose:** Enables offline mode, caches assets, makes app installable

**Cache Version Control:**
```javascript
const CACHE_VERSION = 'v1.0.3';  // ⚠️ INCREMENT THIS when updating data files
```

**When to bump version:**
- After editing any JSON data files
- After changing topics.json
- After updating questions
- This forces browser to fetch fresh data

**Cached Files:**
- All HTML, CSS, JS
- `topics.json` and `topics-updated.json`
- All question JSON files listed in CORE_ASSETS

---

### 4. **js/app.js** (Main Application Logic)

**Key Functions:**

**Line 209:** Loads topics configuration
```javascript
async loadTopics() {
  const response = await fetch('data/topics.json');  // ⚠️ Loads from topics.json
  this.state.topics = data.topics;
}
```

**Question Loading:** Fetches data file specified in topics.json
```javascript
async loadQuestions(topicId) {
  const topic = this.state.topics.find(t => t.id === topicId);
  const response = await fetch(topic.dataFile);
  this.state.questions = data.questions;
}
```

**State Management:**
```javascript
state: {
  topics: [],           // Loaded from topics.json
  questions: [],        // Loaded from individual test files
  currentTopic: null,
  currentQuestionIndex: 0,
  userAnswers: [],
  showResults: false,
  darkMode: true
}
```

---

## 🎯 COMMON TASKS & HOW TO DO THEM

### ✅ **Task: Add New Questions to Existing Topic**

1. **Edit the question JSON file** (e.g., `data/llqp-ethics/practice-1.json`)
   - Add new question objects to `questions` array
   - Ensure `id` is sequential
   - Follow JSON structure (see section 2 above)

2. **Update topics.json**
   - Find the topic entry
   - Update `questionCount` to match new total
   - Change cache version: `?v=20260207e` → `?v=20260207f`

3. **Update topics-updated.json** (same changes as step 2)

4. **Bump service worker cache**
   - Edit `sw.js`
   - Change `CACHE_VERSION = 'v1.0.3'` → `'v1.0.4'`

5. **User must clear browser cache** (Ctrl+Shift+R) to see changes

---

### ✅ **Task: Add Completely New Topic/Section**

1. **Create question JSON file**
   ```
   data/llqp-ethics/new-topic-practice-1.json
   ```

2. **Add to topics.json** in the `topics` array:
   ```json
   {
     "id": "new-topic-id",
     "name": "New Topic Name",
     "slug": "new-topic-slug",
     "description": "Description",
     "color": "#3b82f6",
     "icon": "📚",
     "status": "active",
     "practiceTests": [
       {
         "id": "new-topic-1",
         "name": "Practice Test 1",
         "description": "Description",
         "questionCount": 10,
         "dataFile": "data/llqp-ethics/new-topic-practice-1.json?v=20260207a"
       }
     ]
   }
   ```

3. **IMPORTANT:** Place BEFORE any "coming-soon" topics (active topics go first)

4. **Update both topics.json AND topics-updated.json**

5. **Bump sw.js cache version**

6. **(Optional)** Add to `sw.js` CORE_ASSETS array if you want it cached for offline

---

### ✅ **Task: Reorder Topics on Homepage**

Topics appear in the **exact order** they're listed in `topics.json`.

**Rule:** Active topics MUST come before coming-soon topics.

**Example:**
```json
{
  "topics": [
    { /* Active Topic 1 */ },
    { /* Active Topic 2 */ },
    { /* Active Topic 3 */ },
    { /* Coming Soon Topic 1 */ },
    { /* Coming Soon Topic 2 */ }
  ]
}
```

Just reorder the objects in the array, update cache versions, done!

---

### ✅ **Task: Fix Question Count Mismatch**

**Problem:** Website shows wrong question count

**Diagnosis:**
```powershell
cd 'C:\Users\C6475\Desktop\Ehtics MCQS\data\llqp-ethics'
Get-Content 'practice-1.json' | ConvertFrom-Json | Select-Object -ExpandProperty questions | Measure-Object | Select-Object -ExpandProperty Count
```

**Fix:**
1. Get actual count from command above
2. Update `questionCount` in topics.json
3. Update `questionCount` in topics-updated.json
4. Change cache version `?v=...`
5. Bump sw.js cache version

---

### ✅ **Task: Test Changes Locally**

**After making any changes:**

1. **Unregister Service Worker:**
   - Open browser DevTools (F12)
   - Application tab → Service Workers
   - Click "Unregister"

2. **Clear all cache:**
   - Application tab → Storage → Clear storage
   - Check all boxes → Clear site data

3. **Hard refresh:**
   - Ctrl+Shift+R (Windows)
   - Cmd+Shift+R (Mac)

4. **Close and reopen browser** (most reliable method)

---

## 🐛 COMMON BUGS & SOLUTIONS

### Bug: "Questions not showing up after adding them"

**Causes:**
1. Service worker cached old version
2. Forgot to update `questionCount` in topics.json
3. Forgot to bump cache version `?v=...`
4. JSON syntax error in question file

**Solution:**
```powershell
# 1. Validate JSON
Get-Content 'data/llqp-ethics/file.json' | ConvertFrom-Json

# 2. Check actual question count
(Get-Content 'data/llqp-ethics/file.json' | ConvertFrom-Json).questions.Count

# 3. Update topics.json with correct count
# 4. Change ?v= version
# 5. Bump sw.js cache version
# 6. User clears browser cache
```

---

### Bug: "Active topic showing at bottom after 'Coming Soon' sections"

**Cause:** Topic order wrong in topics.json

**Solution:** Move the topic object in the array to appear BEFORE all coming-soon topics

---

### Bug: "Practice test exists but not appearing in topic"

**Cause:** Missing from `practiceTests` array in topics.json

**Solution:** Add test entry to the topic's `practiceTests` array

---

## 🔍 DEBUGGING COMMANDS

**Audit all topics:**
```powershell
cd 'C:\Users\C6475\Desktop\Ehtics MCQS'
Get-Content 'data\topics.json' | ConvertFrom-Json | Select-Object -ExpandProperty topics | ForEach-Object {
  [PSCustomObject]@{
    Name = $_.name
    Status = $_.status
    QuestionCount = ($_.practiceTests | Measure-Object -Property questionCount -Sum).Sum
  }
} | Format-Table -AutoSize
```

**Check actual question counts in files:**
```powershell
cd 'C:\Users\C6475\Desktop\Ehtics MCQS\data\llqp-ethics'
Get-ChildItem *.json | ForEach-Object {
  $count = (Get-Content $_.Name | ConvertFrom-Json).questions.Count
  [PSCustomObject]@{
    File = $_.Name
    ActualQuestions = $count
  }
} | Format-Table -AutoSize
```

**Validate JSON syntax:**
```powershell
Get-Content 'data\topics.json' | ConvertFrom-Json
# If no error = valid JSON
```

---

## 📊 CURRENT STATE (as of Feb 7, 2026)

**Active Topics (in order):**
1. **LLQP Ethics (Common Law)** - 56 questions
   - Practice Test 1: 10 questions
   - Practice Test 2: 20 questions  
   - Practice Test 3: 26 questions

2. **Flashcards - Beneficiaries & Policy Basics** - 170 questions
   - 9 flashcard sets (parts 1-8 of Set 2)

3. **LLQP Segregated Funds & Annuities** - 14 questions
   - Practice Test 1: 14 questions

**Coming Soon Topics:**
- WFG Ethics Compliance Course
- WFG Anti-Money Laundering
- LLQP Life Insurance
- LLQP Accident & Sickness Insurance

**Service Worker Cache:** v1.0.6

---

## 🚨 CRITICAL CONVENTIONS

1. **Always update BOTH topics.json AND topics-updated.json** (app may load either)

2. **Cache versions matter:**
   - Change `?v=...` in dataFile paths when updating data
   - Bump `CACHE_VERSION` in sw.js
   - Force users to hard refresh

3. **Question IDs are sequential integers** starting from 1 within each file

4. **correctAnswer is zero-indexed:** 0=A, 1=B, 2=C, 3=D

5. **Status values:**
   - `"active"` = fully functional, clickable
   - `"coming-soon"` = grayed out, not clickable

6. **Active topics MUST be ordered before coming-soon topics**

7. **optionFeedback[correctAnswer] = null** (explanation goes in main explanation field)

---

## 💡 TIPS FOR AI ASSISTANTS

1. **When user says "add questions":**
   - Edit the JSON file
   - Update questionCount in topics.json
   - Update topics-updated.json
   - Bump cache versions
   - Tell user to clear browser cache

2. **When user says "not showing up":**
   - Check service worker cache version
   - Verify topics.json has correct questionCount
   - Check JSON file actually contains questions
   - Verify cache version was updated

3. **Use multi_replace_string_in_file for multiple edits** (faster, more efficient)

4. **Don't create markdown summaries unless requested** (reminder instruction)

5. **Include 3-5 lines context** when using replace_string_in_file

---

## 🎓 QUESTION STRUCTURE DEEP DIVE

**Example Perfect Question:**

```json
{
  "id": 1,
  "question": "(PPE-048) SFA\nIt is April 30th, and Summer still has not filed her income taxes. She is wondering which of the following transactions that occurred last year would result in a tax liability. What should you tell her?",
  "options": [
    "A. The withdrawal from her RRSP.",
    "B. An allocation of interest income from an investment held within her LIRA.",
    "C. The withdrawal from her savings account.",
    "D. Dividend income received from a segregated fund held within her RRSP."
  ],
  "correctAnswer": 0,
  "optionFeedback": [
    null,
    "A Locked-In Retirement Account (LIRA) provides tax-deferred growth; interest, dividends, and capital gains earned within the plan are not taxed until they are withdrawn, usually during retirement.",
    "Withdrawing your own money from a non-registered savings account is not a taxable event. While the interest earned on that account is taxable, the act of withdrawal itself is not.",
    "Any income earned, including dividends from a segregated fund, is exempt from tax as long as it remains within the RRSP."
  ],
  "explanation": "Funds withdrawn from an RRSP are considered taxable income in the year of the withdrawal and must be included in the individual's total income for tax purposes. This is the key distinguishing factor—RRSP withdrawals trigger immediate tax liability, unlike growth within registered plans or transfers of personal funds.",
  "difficulty": "medium",
  "tags": ["tax-liability", "rrsp", "lira", "registered-plans", "withdrawal", "tax-deferred", "ppe-048"]
}
```

**Key Points:**
- Question IDs include context codes like `(PPE-048) SFA`
- Options are lettered A-D with periods
- Correct answer feedback is `null`
- Wrong answer feedback explains WHY it's wrong
- Main explanation covers the correct answer reasoning
- Tags include question code for tracking

---

## 🔐 FINAL CHECKLIST FOR ANY CHANGE

- [ ] Edit question JSON file(s)
- [ ] Update questionCount in topics.json
- [ ] Update questionCount in topics-updated.json  
- [ ] Change ?v= cache version in both files
- [ ] Bump CACHE_VERSION in sw.js
- [ ] Validate JSON syntax (ConvertFrom-Json)
- [ ] Verify actual question count matches topics.json
- [ ] Tell user to clear browser cache (Ctrl+Shift+R)

---

## 📞 QUICK REFERENCE PATHS

**Main files:**
- Topics config: `data/topics.json`
- Service worker: `sw.js`
- Main app: `js/app.js`

**Question files:**
- LLQP Ethics: `data/llqp-ethics/practice-[1-3].json`
- Segregated Funds: `data/llqp-segregated/practice-1.json`
- Flashcards: `data/flashcards/flashcards-*.json`

**Current cache version:** v1.0.6 (as of Feb 7, 2026)

---

**END OF REFERENCE** ✅

This file should be read FIRST by any AI assistant before making changes to the codebase.
