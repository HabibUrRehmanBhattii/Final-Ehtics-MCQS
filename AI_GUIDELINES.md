# AI Assistant Guidelines - LLQP & WFG Exam Prep Database

**For: Other AI assistants working on this project**
**Last Updated:** March 23, 2026
**Project:** LLQP & WFG Exam Prep MCQ Platform

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technical Stack](#technical-stack)
3. [Project Structure](#project-structure)
4. [Database & Data Format](#database--data-format)
5. [Key Files & Purposes](#key-files--purposes)
6. [Workflow: Reading & Writing](#workflow-reading--writing)
7. [Common Tasks](#common-tasks)
8. [DO's and DON'Ts](#dos-and-donts)
9. [Error Prevention](#error-prevention)
10. [Deployment Checklist](#deployment-checklist)

---

## Project Overview

**What is this?**
- A Progressive Web App (PWA) for LLQP (Licensing Individuals Life & Health Insurance Salespersons) exam preparation
- Contains 80+ professional-level multiple-choice questions with explanations
- Organized by chapter (LIFE 01 through LIFE 13)
- Supports offline usage via Service Worker
- Features authentication, progress tracking, and wrong answer review

**Key Features:**
- ✅ Practice tests by chapter
- ✅ Mock exams and certification tests
- ✅ PDF manual integration
- ✅ Practice test tracking with localStorage
- ✅ Built-in explanations with "Kid's Explanation" format
- ✅ Offline support via Service Worker
- ✅ Mobile-responsive design

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Backend | Cloudflare Workers (Serverless) |
| Data Storage | JSON files (static) + Browser localStorage |
| Build Tool | Wrangler CLI |
| Version Control | Git/GitHub |
| Authentication | Custom auth module (js/auth.js) |
| Service Worker | Cache-first strategy with version tags |

**No Database:** This is a static + client-side app. All questions are in JSON files.

---

## Project Structure

```
Final-Ehtics-MCQS/
├── index.html                      # Main app entry point
├── manifest.webmanifest            # PWA manifest (app config)
├── sw.js                           # Service Worker (caching & offline)
├── MCQ_UPDATE_GUIDE.md             # Guide for adding new MCQs
├── AI_GUIDELINES.md                # This file
│
├── data/                           # All MCQ data files
│   ├── topics.json                 # Master topics configuration (SEE THIS FIRST)
│   ├── llqp-life/                  # Life Insurance chapter questions
│   │   ├── hllqp-life-01.json      # Chapter 1 (container)
│   │   ├── hllqp-life-01-part-1.json
│   │   ├── hllqp-life-01-part-2.json
│   │   ├── hllqp-life-02.json
│   │   ├── hllqp-life-02-part-1.json
│   │   ├── ... [more chapters]
│   │   └── llqp-life-certification-exam.json
│   ├── llqp-ethics/                # Ethics chapter questions
│   ├── flashcards/                 # Random MCQ sets
│   └── insurance-legislation-ethics/
│
├── js/                             # JavaScript application code
│   ├── app.js                      # Main app logic (READ FIRST)
│   └── auth.js                     # Authentication module
│
├── css/                            # Styling
│   └── style.css                   # All styles (dark theme)
│
├── assets/                         # Icons, images, fonts
│   └── icons/
│       ├── icon-192.svg
│       └── icon-180.svg
│
├── src/                            # Source for Cloudflare Workers
│   └── worker.js                   # Worker code (if used)
│
├── tests/                          # Unit tests
│   └── app_utilities.test.js
│
├── tools/                          # Helper scripts
│
├── .github/                        # GitHub config
│   └── copilot-instructions.md
│
├── .git/                           # Git repository
│
└── wrangler.jsonc                  # Cloudflare Workers config
```

---

## Database & Data Format

### Master Configuration: `data/topics.json`

**MOST IMPORTANT FILE** - Start here when modifying anything.

```json
{
  "topics": [
    {
      "id": "llqp-life",
      "name": "LLQP Life Insurance",
      "description": "Life insurance products...",
      "icon": "🏥",
      "color": "#f59e0b",
      "status": "active",
      "practiceTests": [
        {
          "id": "llqp-life-06",
          "name": "HLLQP - LIFE 06 QZ - Group Life Insurance",
          "description": "Chapter quiz covering...",
          "questionCount": 30,
          "status": "active",
          "dataFile": "data/llqp-life/hllqp-life-06.json?v=20260323a",
          "subTests": [
            {
              "id": "llqp-life-06-part-1",
              "name": "Section 1",
              "description": "Questions 1-10",
              "questionCount": 10,
              "dataFile": "data/llqp-life/hllqp-life-06-part-1.json?v=20260323a"
            },
            // ... more parts
          ]
        }
        // ... more tests
      ]
    }
    // ... more topics
  ]
}
```

### MCQ Data File Format: `data/llqp-life/hllqp-life-06-part-1.json`

```json
{
  "data": [
    {
      "id": 1,
      "question": "XYZ Corp implements a group life insurance plan for its employees. Sarah, an employee...",
      "options": {
        "A": "The insurer will approve the request...",
        "B": "The insurer will deny the request...",
        "C": "The insurer will approve the request...",
        "D": "The insurer will direct Sarah to apply..."
      },
      "correctAnswer": "B",
      "explanation": "Long, detailed explanation of the answer and concepts..."
    },
    {
      "id": 2,
      "question": "Next question?",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correctAnswer": "A",
      "explanation": "Explanation..."
    }
  ]
}
```

### Key Data Rules

1. **Container Files** (`hllqp-life-06.json`) = Empty: `{ "data": [] }`
2. **Part Files** (`hllqp-life-06-part-1.json`) = 10 questions each
3. **IDs in parts** = Sequential (1-10 in part-1, 11-20 in part-2, etc.)
4. **Options** = Always A, B, C, D (exact format)
5. **Correct answer** = Single letter (A, B, C, or D)
6. **No extra fields** = Only: id, question, options, correctAnswer, explanation

---

## Key Files & Purposes

### 1. `index.html` - Main App
- Entry point for the entire PWA
- Defines all HTML views (home, MCQ, PDF, practice-test)
- Loads CSS and JavaScript
- **Version tags matter:** `?v=20260323m` - Update when changing assets

### 2. `js/app.js` - Core Application Logic
**Size:** ~5,100 lines
**Main Functions:**
- `MCQApp.initialize()` - Startup
- `MCQApp.loadTopics()` - Fetch topics.json
- `MCQApp.loadQuestions()` - Load MCQ data
- `MCQApp.showQuestion()` - Render a question
- `MCQApp.checkAnswer()` - Validate answer
- `MCQApp.recordProgress()` - Save to localStorage
- `MCQApp.startWrongQuestionsReview()` - Show wrong answers

### 3. `js/auth.js` - Authentication
**Size:** ~700 lines
**Functions:**
- User login/logout
- Profile management
- Firebase integration (if configured)

### 4. `data/topics.json` - Configuration
- Defines all available topics and tests
- Controls what appears on the home page
- Status field controls visibility: "active" or "coming-soon"

### 5. `sw.js` - Service Worker
- Caches files for offline access
- Cache versioning for updates
- **CRITICAL:** Increment version tag to force browser cache refresh

### 6. `manifest.webmanifest` - PWA Config
- App name, icons, colors
- Installation settings
- Display mode (standalone/fullscreen)

### 7. `css/style.css` - Styling
- Dark theme by default (`data-theme="dark"`)
- Mobile-first responsive design
- All components styled here

---

## Workflow: Reading & Writing

### Reading Data (Safe Operations)

**To view MCQ questions:**
1. Read `data/topics.json` to understand structure
2. Find the test ID you want (e.g., "llqp-life-06-part-1")
3. Read the corresponding data file (e.g., `data/llqp-life/hllqp-life-06-part-1.json`)
4. Questions are in `data.data[]` array

**To understand how the app works:**
1. Read `js/app.js` for main logic
2. Search for function name (e.g., `loadQuestions`, `checkAnswer`)
3. Follow the function flow

### Writing Data (Requires Care)

**BEFORE making ANY changes:**
1. ✅ Read the file completely
2. ✅ Understand the entire structure
3. ✅ Make ONE change at a time
4. ✅ Commit immediately after each logical change
5. ✅ TEST (hard refresh browser: Ctrl+Shift+R)

**Adding new MCQ questions?**
1. Create 3 JSON files: container + 2 parts
2. Update `topics.json` with new entry
3. Use latest date for version tag: `?v=20260323a`
4. Commit with clear message
5. Push to main branch

**Updating existing questions?**
1. Read the entire JSON file
2. Make your edit
3. Increment version letter: `a` → `b` → `c` (same date)
4. Update `topics.json` with new version
5. Commit: "Update LIFE 06 Part 1 (v=20260323b)"
6. Push to main

---

## Common Tasks

### Task 1: Add a New Chapter Quiz

**Goal:** Add HLLQP - LIFE 08 QZ - Business Life Insurance (30 questions)

**Steps:**
1. Create 3 JSON files in `data/llqp-life/`:
   - `hllqp-life-08.json` (empty container)
   - `hllqp-life-08-part-1.json` (10 questions)
   - `hllqp-life-08-part-2.json` (10 questions)
   - `hllqp-life-08-part-3.json` (10 questions)

2. Add entry to `data/topics.json` (inside `llqp-life` topic, after LIFE 07)

3. Update version tags in `index.html`:
   ```html
   <link rel="manifest" href="manifest.webmanifest?v=20260323m">
   <link rel="stylesheet" href="css/style.css?v=20260323m">
   ```

4. Commit:
   ```bash
   git add data/llqp-life/hllqp-life-08*.json data/topics.json index.html
   git commit -m "Add HLLQP - LIFE 08 QZ - Business Life Insurance (30 questions)"
   git push origin main
   ```

5. Test: Hard refresh in browser, check if LIFE 08 appears

**Reference:** See `MCQ_UPDATE_GUIDE.md` for detailed steps

### Task 2: Fix a Question

**Goal:** Correct a typo in LIFE 06 Part 1, Question 5

**Steps:**
1. Open `data/llqp-life/hllqp-life-06-part-1.json`
2. Find question with `"id": 5`
3. Edit the question text or explanation
4. Update version tag in `topics.json`:
   ```
   OLD: "dataFile": "data/llqp-life/hllqp-life-06-part-1.json?v=20260323a"
   NEW: "dataFile": "data/llqp-life/hllqp-life-06-part-1.json?v=20260323b"
   ```
5. Commit: `git commit -m "Fix typo in LIFE 06 Part 1, Q5"`
6. Push: `git push origin main`

### Task 3: Add a New Topic Category

**Goal:** Add "LLQP Health Insurance" section (new topic)

**Steps:**
1. Create topic entry in `data/topics.json`:
   ```json
   {
     "id": "llqp-health",
     "name": "LLQP Health Insurance",
     "description": "Health insurance products and regulations",
     "icon": "🏥",
     "color": "#ec4899",
     "status": "coming-soon",
     "practiceTests": []
   }
   ```

2. Add data files in new folder: `data/llqp-health/`
3. Update version tags in `index.html`
4. Commit and push

### Task 4: Check Current Progress

**Goal:** View what tests/chapters exist

**Command:**
```bash
grep '"id": "llqp-life-' data/topics.json
```

**Output shows all LIFE chapters and their IDs.**

---

## DO's and DON'Ts

### ✅ DO's

- ✅ Read the entire file BEFORE editing
- ✅ Make ONE logical change per commit
- ✅ Use descriptive commit messages
- ✅ Update version tags when changing content
- ✅ Test after every change (hard refresh browser)
- ✅ Keep JSON valid (use validator if unsure)
- ✅ Follow existing naming conventions
- ✅ Document changes in commit message
- ✅ Push to main after testing
- ✅ Use `git status` before committing

### ❌ DON'Ts

- ❌ Don't modify multiple files without Git tracking
- ❌ Don't change version tags without changing content
- ❌ Don't leave JSON with syntax errors
- ❌ Don't commit broken code
- ❌ Don't force-push to main branch
- ❌ Don't delete files without understanding why
- ❌ Don't add extra fields to question objects
- ❌ Don't change question ID sequences
- ❌ Don't modify sw.js without understanding caching
- ❌ Don't skip version tag updates (users won't see changes)

---

## Error Prevention

### Common Mistakes & Solutions

#### 1. "Topics don't load"
**Cause:** Invalid JSON in `topics.json`
**Fix:**
- Validate JSON: `npx jsonlint data/topics.json`
- Check for missing commas, trailing commas, unmatched quotes
- Revert last change: `git diff data/topics.json`

#### 2. "User still sees old version"
**Cause:** Version tag not incremented
**Fix:**
- Check `topics.json` - all dataFile URLs should have `?v=20260323a` (or newer)
- Check `index.html` - manifest and CSS links should have `?v=20260323m`
- Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

#### 3. "Questions loaded but won't display"
**Cause:** MCQ data JSON is malformed
**Fix:**
- Validate the JSON file
- Check all questions have: id, question, options (A-D), correctAnswer, explanation
- Check correctAnswer value is A/B/C/D (not "A" vs "a")

#### 4. "Git won't let me commit"
**Cause:** Staging issues or undefined changes
**Fix:**
```bash
git status                    # See what's changed
git diff data/topics.json     # Review changes
git add <specific-file>       # Stage only what you want
git commit -m "message"       # Try again
```

#### 5. "Push rejected"
**Cause:** Local branch behind remote
**Fix:**
```bash
git pull origin main          # Fetch latest
git push origin main          # Try again
```

---

## Deployment Checklist

### Before Pushing to Main

- [ ] All JSON files are valid (no syntax errors)
- [ ] `topics.json` has all changes
- [ ] Version tags are updated to today's date
- [ ] `index.html` manifest/CSS versions match
- [ ] Commit message is clear and descriptive
- [ ] Tested in browser (hard refresh)
- [ ] All planned changes are staged
- [ ] `git status` shows only intended changes

### Commit Message Format

```
<Type>: <Subject>

<Optional details explaining the change>
```

**Types:**
- `Add:` New MCQ set or feature
- `Update:` Modified existing MCQs or content
- `Fix:` Bug fix or correction
- `Docs:` Documentation changes

**Examples:**
```
Add: HLLQP - LIFE 08 QZ - Business Life Insurance (30 questions)

Add: Fix typo in LIFE 06 Part 2, Question 12

Update: Clarify explanation in LIFE 05 Part 1, Question 7

Docs: Add AI Guidelines for future maintainers
```

---

## Quick Reference

### Essential Commands

```bash
# Check status
git status

# See changes
git diff data/topics.json

# Stage files
git add data/llqp-life/hllqp-life-08*.json

# Commit
git commit -m "Add LIFE 08 MCQs"

# Push
git push origin main

# View history
git log --oneline -5

# Create feature branch
git checkout -b feature/new-feature

# Switch to main
git checkout main
```

### File Validation

```bash
# Validate JSON
node -e "require('fs').readFileSync('data/topics.json'); console.log('✓ Valid JSON')"

# Or use online: https://jsonlint.com/
```

### Browser Testing

```
Hard Refresh:
- Windows: Ctrl + Shift + R
- Mac: Cmd + Shift + R

Empty Cache:
DevTools → Application → Clear Storage
```

---

## Questions & Escalation

**If you get stuck:**
1. Check `MCQ_UPDATE_GUIDE.md` for MCQ-specific help
2. Review `git log --oneline` to see past changes
3. Check this file for common mistakes
4. Validate JSON files
5. Test in browser with hard refresh
6. Ask the project owner if still unclear

---

## Contact & Updates

**Project Owner:** [Your Name]
**Last Updated:** March 23, 2026
**Version:** 1.0

**When to update this file:**
- New architectural changes
- New workflows discovered
- Common mistakes or edge cases
- Tool or dependency changes
- New task types added

---

**End of AI Guidelines**

*This document is maintained for all AI assistants working on this project. Keep it updated as the project evolves.*
