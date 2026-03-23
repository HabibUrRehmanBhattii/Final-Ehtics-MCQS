# Automatic Version Management System

## Overview

This system **automatically bumps version tags** whenever you commit changes to source files. This prevents the cache issue that was causing kid explanations not to show on phones.

---

## How It Works

### 1. **Pre-Commit Hook Activation**
When you run `git commit`, a hook script runs BEFORE the commit is created:

```bash
git commit -m "Your message"
         ↓
    [Pre-commit hook runs]
    ├─ Check if source files changed
    ├─ If yes, bump version tag
    ├─ Update index.html
    ├─ Update data/topics.json
    ├─ Stage the updates
         ↓
    [Commit created with updated versions]
```

### 2. **Version Tag Format**
```
v=YYYYMMDD{letter}
```

Examples:
- `v=20260323a` (a = first version of the day)
- `v=20260323b` (b = second version of the day)
- `v=20260323g` (g = seventh version of the day)

### 3. **Auto-Increment Logic**
- **Same day:** a → b → c → d → e → f → g → h → i → j → k → l
- **Next day:** Reset to `a` with new date

### 4. **Files Updated**
When version bumps, these files are updated automatically:
- `index.html` (manifest, CSS, JS script links)
- `data/topics.json` (all dataFile URLs)

---

## Installation

### Method 1: Automatic Setup
```bash
cd Final-Ehtics-MCQS
bash setup-hooks.sh
```

### Method 2: Manual Setup
```bash
cd Final-Ehtics-MCQS
chmod +x .git/hooks/pre-commit
```

### Verify Installation
```bash
# Check if hook is executable
ls -la .git/hooks/pre-commit

# Should output:
# -rwxr-xr-x ... pre-commit
#  ↑
#  executable permission
```

---

## Usage

### Normal Workflow (Hook Enabled)

```bash
# Make your changes
echo "new code" >> js/app.js

# Stage changes
git add js/app.js

# Commit - hook runs automatically!
git commit -m "Add new feature"
```

**What happens:**
1. ✅ Hook detects `js/app.js` changed
2. ✅ Bumps version: `v=20260323g` → `v=20260323h`
3. ✅ Updates `index.html` with new version
4. ✅ Updates `data/topics.json` with new version
5. ✅ Stages the updated files
6. ✅ Your commit includes version updates

### Example Output

```
📦 Auto Version Bumping System
==================================
✅ Source files changed, bumping version...
Version: 20260323g → 20260323h
✓ Updated index.html
✓ Updated data/topics.json
✓ Staged version updates
==================================
✅ Version bumped: 20260323g → 20260323h
```

---

## What Gets Updated

### index.html
```html
<!-- Before -->
<link rel="manifest" href="manifest.webmanifest?v=20260323g">
<link rel="stylesheet" href="css/style.css?v=20260323g">
<script src="js/app.js?v=20260323g"></script>

<!-- After -->
<link rel="manifest" href="manifest.webmanifest?v=20260323h">
<link rel="stylesheet" href="css/style.css?v=20260323h">
<script src="js/app.js?v=20260323h"></script>
```

### data/topics.json
```json
// Before
{
  "dataFile": "data/llqp-life/hllqp-life-06-part-1.json?v=20260323g"
}

// After
{
  "dataFile": "data/llqp-life/hllqp-life-06-part-1.json?v=20260323h"
}
```

---

## Smart Detection

The hook is smart about what triggers version bumping:

### ✅ WILL Trigger Bump
- Changes to `js/app.js`
- Changes to `js/auth.js`
- Changes to `css/style.css`
- Changes to `data/llqp-life/*.json`
- Changes to `tests/*.js`
- Changes to `tests/` directory

### ❌ WON'T Trigger Bump
- Only editing `README.md` or docs
- Only editing `.gitignore`
- Only editing comments (if no code changes)
- Version-only commits (prevents infinite loops)

---

## Troubleshooting

### Problem: Hook doesn't run on commit

**Check 1:** Is the hook executable?
```bash
ls -la .git/hooks/pre-commit
# Should show: -rwxr-xr-x (with x permissions)
```

**Fix:**
```bash
chmod +x .git/hooks/pre-commit
```

**Check 2:** Are you in the project root?
```bash
pwd
# Should end with: /Final-Ehtics-MCQS
```

### Problem: Version not bumping

**Check:**
```bash
# Did you stage changes?
git status

# Should show staged changes in "Changes to be committed"
```

**Fix:**
```bash
git add js/app.js
git commit -m "message"
```

### Problem: Hook fails with error

**Debug:**
```bash
# Run hook manually
bash .git/hooks/pre-commit

# Check for errors
```

**Common fixes:**
```bash
# Make sure you're in project root
cd Final-Ehtics-MCQS

# Reinstall hook
bash setup-hooks.sh
```

---

## Disable Hook (If Needed)

### Temporary Disable (Single Commit)
```bash
git commit --no-verify -m "message"
```

### Permanent Disable
```bash
chmod -x .git/hooks/pre-commit
```

### Re-Enable
```bash
chmod +x .git/hooks/pre-commit
```

---

## How to Verify It's Working

### Test 1: Make a change and commit
```bash
# Edit a file
echo "test" >> js/app.js

# Stage it
git add js/app.js

# Commit
git commit -m "Test auto-versioning"

# Check the result
git log --oneline -1
# Should show your commit with auto-updated versions
```

### Test 2: Check version in HTML
```bash
# Before commit
grep "v=20260323g" index.html

# After commit
grep "v=20260323h" index.html
# Should find the new version
```

### Test 3: Check topics.json
```bash
# Check that data file URLs were updated
grep "v=20260323h" data/topics.json
# Should find new versions
```

---

## When to Use Git Commit --no-verify

### ✅ Acceptable Uses
- Committing only documentation (README, docs/)
- Committing only test files that won't affect users
- Emergency commits needed immediately
- Reverting a commit

### ❌ Avoid For
- Committing MCQ data changes
- Committing JavaScript changes
- Committing CSS changes
- Anything users will see

**If you use `--no-verify` for code, versions won't bump and users will see cached old code!**

---

## Hook Script Logic

The script (`pre-commit`) does this:

```bash
1. Get current date (YYYYMMDD)
2. Check what files are staged
3. Are they source files? (js, css, json, etc.)
   - YES → Continue
   - NO → Skip and exit
4. Extract current version letter from index.html
5. Calculate next letter (a→b, b→c, etc.)
6. Replace all v=OLDTAG with v=NEWTAG in:
   - index.html
   - data/topics.json
7. Stage the updated files
8. Exit successfully
9. Git creates commit (now includes version updates)
```

---

## For New Team Members

If new people work on this project:

```bash
# Clone repo
git clone <repo-url>
cd Final-Ehtics-MCQS

# Install hooks
bash setup-hooks.sh

# Now commits auto-bump versions!
```

---

## Files Involved

```
Final-Ehtics-MCQS/
├── .git/hooks/pre-commit      ← The hook script
├── setup-hooks.sh             ← Setup installer
├── AUTO_VERSION_GUIDE.md      ← This file
├── index.html                 ← Updated by hook
└── data/topics.json           ← Updated by hook
```

---

## Summary

| Feature | Benefit |
|---------|---------|
| Automatic versioning | No more forgetting to bump versions |
| Consistent tagging | All tags updated in sync |
| Phone cache solved | Users see fresh content |
| Smart detection | Only bumps when needed |
| Pre-commit hook | Runs before commit created |
| Easy setup | Single command installation |

---

## Example Workflow

```bash
# Day 1, Version a
$ git commit -m "Add LIFE 06"
v=20260323a → v=20260323b (auto)

# Day 1, Version b
$ git commit -m "Fix LIFE 06"
v=20260323b → v=20260323c (auto)

# Day 2, Version a (new date)
$ git commit -m "Add LIFE 07"
v=20260323c → v=20260324a (auto)
```

---

## Questions?

If something doesn't work:
1. Run `bash setup-hooks.sh` again
2. Check `.git/hooks/pre-commit` is executable
3. Check `git status` shows staged files
4. Try committing a source file change
5. Check output for version bump message

---

**Last Updated:** March 23, 2026
**System:** Automatic Version Management with Git Hooks
