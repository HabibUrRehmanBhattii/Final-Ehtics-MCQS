# Kid's Explanation - Testing & Debugging Guide

## Overview
This document explains how to verify that Kid's Explanations are working correctly in the MCQ application.

---

## Automatic Tests

### What Happens Automatically
When you load the page, two test suites run automatically:

1. **Unit Tests** (`kid_explanation.test.js`)
   - Tests JSON files for kidExplanation field
   - Validates HTML elements exist
   - Tests display logic
   - Checks CSS styling
   - Verifies cache versions

2. **Debug Helper** (`kid_explanation_debug.js`)
   - Makes debugging tools available
   - Provides diagnostic commands

### View Automatic Test Results

1. **Open Browser Console** (F12 or right-click → Inspect → Console)
2. **Look for test output** that starts with:
   ```
   ═════════════════════════════════════════════
   🧪 KID'S EXPLANATION UNIT TESTS
   ═════════════════════════════════════════════
   ```

3. **You should see:**
   - ✅ PASS results in green
   - ❌ FAIL results in red
   - 🔥 ERROR results in red
   - ⚠️ WARNING results in yellow

---

## Manual Debugging

### Run Diagnostic Report
The fastest way to diagnose issues:

```javascript
// In browser console (F12), type:
KidExplanationDebug.diagnosticReport()
```

**Output includes:**
- ✅/❌ HTML elements status
- ✅/❌ MCQApp initialization status
- Currently loaded question details
- Kid explanation content (if available)
- Display state
- Recommendations

---

## Available Debug Commands

### 1. Check Specific Question
```javascript
KidExplanationDebug.checkQuestion(1)
```
Shows all details for Question ID 1, including whether it has a kidExplanation field.

**Example output:**
```
Question ID    | 1
Main Explanation | ✅ (450 chars)
Kid Explanation  | ✅ (280 chars)
Has Options      | ✅ 4
```

### 2. Force Display Kid Explanation
Sometimes the display logic needs help. Force it manually:

```javascript
KidExplanationDebug.forceDisplay()
```

This will:
- Find the current question
- Display its kid explanation in the blue box
- Confirm success/failure in console

### 3. List All Questions
See the kidExplanation status of ALL questions in the current set:

```javascript
KidExplanationDebug.listAllQuestions()
```

**Output:**
- Table showing each question's ID
- ✅/❌ whether it has kid explanation
- Length of explanation
- Preview text

### 4. Verify JSON Files
Check if JSON files are properly loading kidExplanations:

```javascript
// Note: requires await
await KidExplanationDebug.verifyJsonFiles()
```

Checks:
- data/llqp-life/hllqp-life-06-part-1.json
- data/llqp-life/hllqp-life-07-part-1.json
- data/llqp-life/hllqp-life-08-part-1.json

### 5. Clear Cache & Reload
If you're seeing stale content:

```javascript
KidExplanationDebug.clearAndReload()
```

This will:
- Clear all browser cache
- Clear localStorage
- Reload the page fresh

### 6. Get Help
```javascript
KidExplanationDebug.help()
```

Prints all available commands with descriptions.

---

## Troubleshooting Steps

### Scenario 1: Kid Explanation Not Appearing

**Step 1:** Run diagnostic
```javascript
KidExplanationDebug.diagnosticReport()
```

**Step 2:** Check what it tells you:

- **❌ kid-explanation-box: Missing**
  - Issue: HTML element not in page
  - Fix: Check index.html around line 134
  - Solution: Hard refresh (Ctrl+Shift+R)

- **❌ Questions loaded: 0 questions**
  - Issue: Questions not loading from JSON
  - Fix: Check browser Network tab for 404 errors
  - Solution: Verify JSON files exist and are accessible

- **Q: Has kidExplanation: ❌ No**
  - Issue: Question in JSON doesn't have kidExplanation field
  - Fix: Check JSON file for proper structure
  - Solution: Verify all questions have kidExplanation field

- **Kid box visible: ❌ No**
  - Issue: Box exists but is hidden
  - Fix: Answer a question first
  - Solution: Try answering a different question

### Scenario 2: Empty Kid Explanation Box

**Step 1:** Check if question has content
```javascript
KidExplanationDebug.checkQuestion(1)
```

**Step 2:** Force display it
```javascript
KidExplanationDebug.forceDisplay()
```

**Step 3:** If it appears manually:
- Issue: Display logic may not be triggering
- Fix: Check js/app.js line 2876-2881 and 4363-4368

### Scenario 3: Only Some Chapters Have Kid Explanations

**Step 1:** List all questions
```javascript
KidExplanationDebug.listAllQuestions()
```

**Expected result:** All should show ✅

**If some show ❌:**
- Check which chapters are missing
- Verify those JSON files have kidExplanation fields
- Commit the missing explanations

---

## Quick Test Checklist

When testing kid explanations, verify:

- [ ] **JSON Files:** All questions have `kidExplanation` field
  ```javascript
  await KidExplanationDebug.verifyJsonFiles()
  ```

- [ ] **HTML Elements:** Blue box appears below main explanation
  ```javascript
  KidExplanationDebug.diagnosticReport()
  ```

- [ ] **Display Logic:** Works when answering questions
  - Answer a question
  - Check if blue "Kid's Explanation" box appears below main explanation

- [ ] **Content:** Kid explanation text is visible and readable
  ```javascript
  KidExplanationDebug.checkQuestion([questionId])
  ```

- [ ] **All Chapters:** LIFE 06, 07, 08 all have it
  ```javascript
  KidExplanationDebug.listAllQuestions()
  ```

---

## Common Error Messages

### "Question {id} not found"
- **Cause:** Question index doesn't exist
- **Fix:** Answer a question first, then try debugging
- **Example:** Don't check Question 100 if you only have 30 questions

### "HTML elements not found"
- **Cause:** Page didn't load properly
- **Fix:** Hard refresh (Ctrl+Shift+R)
- **Alt:** Close and reopen browser

### "No question loaded"
- **Cause:** Currently on home page or topic page
- **Fix:** Navigate to an MCQ and start answering

### "MCQApp not loaded"
- **Cause:** JavaScript didn't load
- **Fix:** Check browser console for errors
- **Solution:** Hard refresh or clear cache

---

## Browser Console Tips

### Clear Console
```javascript
console.clear()
```

### Copy Diagnostic Report
```javascript
// Run diagnostic
const report = KidExplanationDebug.diagnosticReport()
// Copy to clipboard for sharing
copy(report)
```

### Test Specific Question Loop
```javascript
// Check questions 1-30
for (let i = 1; i <= 30; i++) {
  const q = MCQApp.state.questions[i-1];
  console.log(`Q${i}: ${q.kidExplanation ? '✅' : '❌'}`);
}
```

---

## What to Report If Issues Persist

If kid explanations still aren't showing after troubleshooting:

1. **Run full diagnostic:**
   ```javascript
   KidExplanationDebug.diagnosticReport()
   ```

2. **Copy the output** (right-click → Copy object)

3. **Check what failed:**
   - ❌ HTML elements missing?
   - ❌ Questions not loaded?
   - ❌ Current question missing kidExplanation?

4. **Report with:**
   - Browser type and version
   - Diagnostic report output
   - Which chapter (LIFE 06, 07, or 08)
   - Console error messages (if any)

---

## Summary

| Command | Purpose |
|---------|---------|
| `KidExplanationDebug.diagnosticReport()` | Get full diagnostic report |
| `KidExplanationDebug.checkQuestion(1)` | Check specific question |
| `KidExplanationDebug.forceDisplay()` | Manually display explanation |
| `KidExplanationDebug.listAllQuestions()` | See all questions status |
| `await KidExplanationDebug.verifyJsonFiles()` | Verify JSON file integrity |
| `KidExplanationDebug.clearAndReload()` | Clear cache and reload |
| `KidExplanationDebug.help()` | Show all commands |

---

**Last Updated:** March 23, 2026
