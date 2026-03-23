# MCQ Update Guide - Complete Workflow

## Quick Overview
When adding a new set of MCQs, follow these 3 main steps:
1. **Create JSON Data Files** - Split questions into parts in `/data/llqp-life/`
2. **Update topics.json** - Register the new test in the topics list
3. **Commit & Push** - Update version tags and push to main branch

---

## Step 1: Create JSON Data Files

### File Naming Convention
```
hllqp-life-{CHAPTER}.json          # Main container file (minimal content)
hllqp-life-{CHAPTER}-part-1.json   # Part 1 (Questions 1-10)
hllqp-life-{CHAPTER}-part-2.json   # Part 2 (Questions 11-20)
hllqp-life-{CHAPTER}-part-3.json   # Part 3 (Questions 21-30, etc.)
```

**Example for LIFE 06 (Group Life Insurance):**
- `hllqp-life-06.json` - Container
- `hllqp-life-06-part-1.json` - 10 questions
- `hllqp-life-06-part-2.json` - 10 questions
- `hllqp-life-06-part-3.json` - 10 questions

### JSON Structure - Main Container File

```json
{
  "data": []
}
```
**Note:** The main container is empty. It acts as a placeholder.

### JSON Structure - Part Files

```json
{
  "data": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correctAnswer": "B",
      "explanation": "This explains why B is correct and covers the concept..."
    },
    {
      "id": 2,
      "question": "Next question?",
      ...
    }
  ]
}
```

### How to Split Questions
If you have 30 questions:
- **Part 1:** Questions 1-10
- **Part 2:** Questions 11-20
- **Part 3:** Questions 21-30

Adjust ranges as needed based on total quantity.

---

## Step 2: Update topics.json

### Location
`Final-Ehtics-MCQS/data/topics.json`

### Add New Test Entry

Find the `llqp-life` topic section and add your new quiz. Use this template:

```json
{
  "id": "llqp-life-06",
  "name": "HLLQP - LIFE 06 QZ - Group Life Insurance",
  "description": "Chapter quiz covering group life insurance plans, benefits, conversion rights, creditor insurance, and group AD&D",
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
    {
      "id": "llqp-life-06-part-2",
      "name": "Section 2",
      "description": "Questions 11-20",
      "questionCount": 10,
      "dataFile": "data/llqp-life/hllqp-life-06-part-2.json?v=20260323a"
    },
    {
      "id": "llqp-life-06-part-3",
      "name": "Section 3",
      "description": "Questions 21-30",
      "questionCount": 10,
      "dataFile": "data/llqp-life/hllqp-life-06-part-3.json?v=20260323a"
    }
  ]
}
```

### Important Details
- **id format:** `llqp-life-06` (lowercase, hyphenated)
- **status:** Leave as `"active"`
- **Version tag:** Format is `?v=20260323a` (YYYYMMDD + letter)
  - Same version across all parts for a release
  - Increment letter (a → b → c) if updating the same day
- **questionCount:** Total questions (all parts combined)
- **subTests:** Always split into parts, even if only 1 part exists

### Version Tagging Strategy
- **Date:** Use today's date in YYYYMMDD format (e.g., 20260323)
- **Letter suffix:** Start with 'a' for first release of the day
  - If updating again same day: use 'b', then 'c', etc.
- **Apply to:** All dataFile entries (main + all parts)

---

## Step 3: Commit & Push to Main Branch

### Before Committing

#### 1. Update version tags in index.html
```html
<link rel="manifest" href="manifest.webmanifest?v=20260323m">
<link rel="stylesheet" href="css/style.css?v=20260323m">
```
Change date to today's date, keep the 'm' suffix.

#### 2. Check Git Status
```bash
cd Final-Ehtics-MCQS
git status
```
Should show:
- New data files (`hllqp-life-06-*.json`)
- Modified `data/topics.json`
- Modified `index.html`

### Commit Process

```bash
# Stage specific files
git add data/llqp-life/hllqp-life-06*.json
git add data/topics.json
git add index.html

# Verify staged changes
git status

# Create commit with descriptive message
git commit -m "Add HLLQP - LIFE 06 QZ - Group Life Insurance (30 questions)"

# Verify commit
git log --oneline -2
```

### Push to Main Branch

```bash
# Check current branch
git branch

# If not on main, switch to it
git checkout main

# Merge feature branch (if working on a branch)
git merge feature-branch-name

# Push to remote
git push origin main

# Verify push
git log --oneline -3
```

### If Working on Feature Branch

```bash
# Create feature branch
git checkout -b feature/life-06-mcq

# Make changes and commit (as above)
git commit -m "Add HLLQP - LIFE 06 QZ - Group Life Insurance"

# Push feature branch
git push -u origin feature/life-06-mcq

# Create Pull Request on GitHub (if applicable)
# Once approved, merge to main:
git checkout main
git pull origin main
git merge feature/life-06-mcq
git push origin main
```

---

## Cache Busting & Version Control

### Why Version Tags Matter
Service Workers cache files. Without version updates, users see outdated content.

### Files That Need Version Updates
1. **All data files** - `?v=YYYYMMDD{letter}`
2. **index.html** - Update manifest and CSS links
3. **sw.js changes** - If modified, increment SW version in file

### Example Flow for LIFE 06 Release (March 23, 2026)
```
First release:  v=20260323a
Update later:   v=20260323b
Update again:   v=20260323c
Next day:       v=20260324a
```

---

## Complete Checklist for Adding New MCQ Set

- [ ] Create JSON part files in `data/llqp-life/`
  - [ ] `hllqp-life-XX.json` (empty container)
  - [ ] `hllqp-life-XX-part-1.json` (10 Q's)
  - [ ] `hllqp-life-XX-part-2.json` (10 Q's)
  - [ ] `hllqp-life-XX-part-3.json` (10 Q's) [if needed]

- [ ] Update `data/topics.json`
  - [ ] Add main test entry with correct metadata
  - [ ] Add all subTest entries with matching version tag
  - [ ] Verify questionCount is accurate
  - [ ] Set status to "active"

- [ ] Update `index.html` version tags
  - [ ] manifest.webmanifest link
  - [ ] css/style.css link

- [ ] Commit changes
  - [ ] Stage data files
  - [ ] Stage topics.json
  - [ ] Stage index.html
  - [ ] Write descriptive commit message
  - [ ] Verify commit

- [ ] Push to main branch
  - [ ] Switch to main branch `git checkout main`
  - [ ] Pull latest `git pull origin main`
  - [ ] Merge feature branch if applicable
  - [ ] Push to remote `git push origin main`
  - [ ] Verify on GitHub

---

## Troubleshooting

### Users Still See Old Version
**Problem:** Updated MCQs not appearing after push.
**Solution:**
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Check Service Worker is updated: DevTools → Application → Service Workers
3. Verify version tags were incremented in topics.json
4. Check index.html was updated
5. Confirm push succeeded: `git log origin/main -2`

### JSON Syntax Errors
**Problem:** MCQs won't load, console shows JSON parse error.
**Solution:**
1. Validate JSON: Use an online JSON validator or VS Code extension
2. Check for:
   - Missing commas between objects
   - Unmatched quotes
   - Trailing commas in arrays
3. Run: `git diff data/llqp-life/` to review changes

### Version Tag Inconsistency
**Problem:** Some parts load, others show "Coming Soon".
**Solution:**
1. All parts in a set must have matching version tags
2. Verify topics.json: All subTests should have `v=20260323a` (same letter)
3. Update any mismatched tags
4. Recommit and push

---

## File Location Reference

```
Final-Ehtics-MCQS/
├── data/
│   ├── topics.json                    ← Main topics configuration
│   └── llqp-life/
│       ├── hllqp-life-06.json         ← New test (empty)
│       ├── hllqp-life-06-part-1.json  ← Part 1 (10 Q's)
│       ├── hllqp-life-06-part-2.json  ← Part 2 (10 Q's)
│       ├── hllqp-life-06-part-3.json  ← Part 3 (10 Q's)
│       └── ... [other chapters]
├── index.html                        ← Update version tags
├── js/
│   └── app.js                        ← No changes needed
├── css/
│   └── style.css                     ← No changes needed
└── sw.js                             ← Update if modifying service worker
```

---

## Next Steps After Push

1. **Test on staging/live:** Verify new MCQs appear
2. **Clear cache:** Browser cache clear or incognito window test
3. **Update version tracking:** Document when LIFE 06, LIFE 07, etc. were released
4. **Begin next MCQ set:** Repeat this process for LIFE 07, 08, etc.

---

**Last Updated:** March 23, 2026
**Active Topics:** LIFE 01 through LIFE 07
