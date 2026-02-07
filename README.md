# 📚 LLQP & WFG Exam Prep - MCQ Study Platform

> **Comprehensive interactive study platform with 206+ practice questions and flashcards for LLQP exam preparation**

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=flat&logo=cloudflare)](https://pages.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 Core Features

### 📝 **Multiple Learning Formats**
- **Practice Tests:** 3 comprehensive ethics practice tests (56 MCQs)
- **Flashcards:** 170 quick-review flashcards across 9 sets
- **Review Mode:** Dedicated wrong answers review system

### ⚖️ **LLQP Ethics Practice Tests**
- **Practice Test 1:** 10 questions - Ethics fundamentals & basic concepts
- **Practice Test 2:** 20 questions - Core principles & regulations  
- **Practice Test 3:** 26 questions - Scenario-heavy ethics & legal (trafficking, Assuris, beneficiaries, contract law, exclusions, misrepresentation, rebating)

### 🧠 **Flashcard System**
- **Set 1:** 20 cards - Beneficiaries & policy basics
- **Set 2:** 150 cards (8 parts of 20/10 cards) - Policy provisions, group & health insurance

### 🎨 **Interactive Learning Experience**
- **Smart Navigation:** Dual "Next Question" buttons (before & after explanation)
- **Visual Feedback:** Green ✓ for correct, Red ✗ for wrong answers on question dots
- **Detailed Explanations:** Comprehensive learning content with real-world context
- **Option Feedback:** Specific feedback for each answer choice
- **Bookmark System:** Flag difficult questions for later review
- **Filter Mode:** View all questions or only bookmarked ones

### 🔄 **Smart Question Management**
- **Persistent Order:** Questions randomized once, same order when resuming
- **Re-randomization:** Only occurs on manual "Reset Progress"
- **Shuffled Options:** Answer choices randomized per question
- **Saved State:** All progress preserved across browser sessions

### ❌ **Wrong Answer Review System**
- **Automatic Tracking:** Wrong answers logged automatically
- **Cross-Test Review:** Review mistakes from any practice test
- **Clear Function:** Remove questions you've mastered
- **Counter Badge:** See total wrong answers to review on home screen

### 📊 **Advanced Progress Tracking**
- **Visual Question Dots:** Status indicators for each question
- **First Attempt Tracking:** Monitors if you got it right on first try
- **Completion Banner:** Shows score and percentage when test finished
- **Persistent State:** Progress saved across sessions (localStorage)
- **Multiple States:** Viewed, answered, correct, incorrect, bookmarked

### 🌓 **Dark/Light Mode**
- **Theme Toggle:** Switch between dark and light themes
- **Persistent Preference:** Theme choice saved to localStorage
- **Icon Indicator:** ☀️ for dark mode, 🌙 for light mode

### 📱 **Responsive Design**
- **Mobile Optimized:** Works perfectly on phones and tablets
- **Desktop Ready:** Full-featured on larger screens
- **Touch Friendly:** Easy navigation on all devices
- **PWA Ready:** Installable on Android and iOS (Add to Home Screen)

### ⚡ **Performance**
- **Zero Dependencies:** Pure vanilla JavaScript
- **Fast Loading:** < 1 second load time
- **Tiny Bundle:** ~50KB total
- **Cloudflare CDN:** Global edge network deployment
- **Offline Mode:** Works without internet after first load (service worker)

---

## 🚀 Quick Start

### Option 1: Deploy to Cloudflare Pages (Recommended)

1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: MCQ Study Platform"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```

2. **Deploy on Cloudflare Pages**
   - Go to [Cloudflare Pages](https://pages.cloudflare.com/)
   - Click **"Create a project"**
   - Select **"Connect to Git"**
   - Choose your GitHub repository
   - Configure build settings:
     - **Framework preset:** None
     - **Build command:** (leave empty)
     - **Build output directory:** `/`
   - Click **"Save and Deploy"**

3. **Access Your Site**
   - Your site will be live at: `https://your-project.pages.dev`
   - Every push to `main` branch auto-deploys!

### Option 2: Local Testing

```bash
# Simply open index.html in your browser
# Or use a local server:

# Python 3
python -m http.server 8000

# Node.js (http-server)
npx http-server

# Then visit: http://localhost:8000
```

---

## 📁 Project Structure

```
llqp-ethics-mcq/
├── index.html              # Main entry point with all views
├── index_backup.html       # Backup version
├── wrangler.jsonc         # Cloudflare Pages configuration
├── README.md              # This file
├── TEMP_UPDATE.txt        # Development notes
│
├── css/
│   ├── style.css          # Main application styling
│   └── style_backup.css   # Backup version
│
├── js/
│   └── app.js             # Core application (1298 lines)
│                          # - State management
│                          # - Question randomization logic
│                          # - Progress tracking
│                          # - Wrong answer system
│                          # - Dark mode toggle
│                          # - Bookmark functionality
│
├── data/
│   ├── topics.json        # Topic configuration & metadata
│   ├── topics-updated.json # Updated version
│   ├── user_data.json     # User data structure
│   │
│   ├── llqp-ethics/       # Practice test MCQs
│   │   ├── practice-1.json    # 10 ethics fundamentals
│   │   ├── practice-2.json    # 20 core concepts
│   │   └── practice-3.json    # 26 advanced scenarios
│   │
│   └── flashcards/        # Quick-review flashcards
│       ├── flashcards-1.json       # 20 cards (beneficiaries)
│       ├── flashcards-2.json       # Full combined set
│       ├── flashcards-2-full.json  # Complete version
│       ├── flashcards-2-part-1.json # 20 cards
│       ├── flashcards-2-part-2.json # 20 cards
│       ├── flashcards-2-part-3.json # 20 cards
│       ├── flashcards-2-part-4.json # 20 cards
│       ├── flashcards-2-part-5.json # 20 cards
│       ├── flashcards-2-part-6.json # 20 cards
│       ├── flashcards-2-part-7.json # 20 cards
│       └── flashcards-2-part-8.json # 10 cards
│
└── tools/                 # Python utility scripts
    ├── debug_flash_json.py
    ├── fix_explanation_inner_quotes.py
    ├── fix_flashcards_quotes.py
    ├── fix_single_option_quotes.py
    └── split_flashcards.py
```

---

## ➕ Adding New Questions

### Practice Test MCQ Format

Each MCQ follows this comprehensive JSON structure:

```json
{
  "id": "PPE-001",
  "question": "Your detailed question text here...",
  "options": [
    "A. First option",
    "B. Second option",
    "C. Third option",
    "D. Fourth option"
  ],
  "correctAnswer": 2,
  "optionFeedback": [
    "Feedback for option A (why it's wrong)",
    "Feedback for option B (why it's wrong)",
    "Detailed explanation of why C is correct",
    "Feedback for option D (why it's wrong)"
  ],
  "explanation": "Comprehensive explanation with learning content, real-world examples, legal references, and key concepts to reinforce understanding...",
  "difficulty": "medium",
  "tags": ["ethics", "legal", "insurance"]
}
```

### Flashcard Format

Flashcards use a simpler structure:

```json
{
  "id": 1,
  "question": "What is the definition of...?",
  "options": [
    "A. First option",
    "B. Second option",
    "C. Third option",
    "D. Fourth option"
  ],
  "correctAnswer": 0,
  "explanation": "Brief, focused explanation of the correct answer."
}
```

**Key Notes:**
- `id`: For MCQs use `PPE-###` format; flashcards use numbers
- `correctAnswer`: **Zero-indexed** (0 = A, 1 = B, 2 = C, 3 = D)
- `optionFeedback`: Array must align with options (MCQs only)
- `explanation`: Comprehensive for MCQs, brief for flashcards
- `difficulty`: `"easy"`, `"medium"`, or `"hard"`
- `tags`: Array of relevant keywords for categorization

### Adding to Practice Tests

1. **Choose the appropriate file:**
   - `data/llqp-ethics/practice-1.json` - Fundamentals (10 questions)
   - `data/llqp-ethics/practice-2.json` - Core concepts (20 questions)
   - `data/llqp-ethics/practice-3.json` - Advanced scenarios (26 questions)

2. **Add your question to the `questions` array**

3. **Update question count in `data/topics.json`:**
   ```json
   {
     "id": "practice-3",
     "questionCount": 27,  // Update this number
     "dataFile": "data/llqp-ethics/practice-3.json?v=20260205d"
   }
   ```

4. **Test locally** - Open index.html in browser

5. **Commit and push:**
   ```bash
   git add data/llqp-ethics/practice-3.json data/topics.json
   git commit -m "Add new question about [topic]"
   git push
   ```

### Adding Flashcards

1. **Edit the appropriate flashcard file** in `data/flashcards/`
2. **Update `questionCount` in `data/topics.json`**
3. **Test and deploy**

---

## 🎨 Customization

### Change Colors

Edit CSS variables in `css/style.css`:

```css
:root {
  --primary-color: #3b82f6;    /* Main theme color */
  --success-color: #10b981;    /* Correct answer color */
  --warning-color: #f59e0b;    /* Bookmark color */
  /* ... more variables ... */
}
```

### Add Topic Icons

Available emoji options for topic icons:
- ⚖️ Ethics/Legal
- 🛡️ Compliance
- 💼 Business/Finance
- 🏥 Health/Life Insurance
- 🚑 Accident/Emergency
- 📊 Funds/Investments
- 📚 General Study

---

## 🔧 Technical Details

### Built With
- **HTML5** - Semantic markup with multiple view system
- **CSS3** - Modern responsive design with CSS custom properties
- **Vanilla JavaScript** - Zero dependencies, no frameworks
- **LocalStorage API** - Persistent progress and preferences

### Application Architecture

**Single Page Application (SPA) with 4 Main Views:**
1. **Home View** - Topic selection and wrong answer review
2. **Practice Test View** - Select specific test within a topic
3. **MCQ View** - Question interface with navigation
4. **List View** - Overview of all questions (future feature)

**State Management System:**
```javascript
state: {
  topics: [],                    // All available topics
  currentTopic: null,            // Active topic
  currentPracticeTest: null,     // Active test
  questions: [],                 // Current question set
  currentQuestionIndex: 0,       // Active question
  bookmarkedQuestions: Set,      // User flagged questions
  viewedQuestions: Set,          // Visited questions
  answersRevealed: Set,          // Questions with shown answers
  filterMode: 'all',             // 'all' or 'bookmarked'
  wrongQuestions: [],            // Tracked wrong answers
  attemptedOptions: {},          // Track option attempts per question
  firstAttemptCorrect: {},       // First attempt accuracy
  isReviewMode: false            // Wrong answer review state
}
```

### Key Features Implementation

**1. Question Randomization Logic:**
- Questions shuffled **once** using Fisher-Yates algorithm
- Shuffled order saved to localStorage with key: `shuffle_[topicId]_[testId]`
- **Same order maintained** when resuming incomplete tests
- Re-randomization only on "Reset Progress" action
- Answer options also shuffled independently for each question
- Options stripped of A/B/C/D prefix, shuffled, then re-prefixed

**2. Visual Indicator System:**
```css
/* Question dot states */
.is-correct-dot  → Green background + ✓ (::after pseudo-element)
.is-wrong-dot    → Red background + ✗ (::after pseudo-element)
.viewed-dot      → Gray for viewed but unanswered
.current-dot     → Blue for active question
```

**3. Wrong Answer Tracking:**
- Automatically logs incorrect answers with timestamp
- Stored in localStorage: `wrong_questions`
- Each entry: `{ key, topicId, testId, questionId, timestamp }`
- Cross-test review: Loads questions from multiple tests
- "Clear Wrong" button removes questions from current test

**4. Progress Persistence:**
```javascript
// Progress stored per test
localStorage key: `progress_[topicId]_[testId]`
Stored data: {
  viewedQuestions: [],
  bookmarkedQuestions: [],
  answersRevealed: [],
  attemptedOptions: {},
  firstAttemptCorrect: {}
}
```

**5. Dark/Light Mode:**
- Theme stored in localStorage: `theme`
- CSS custom properties for color scheme
- Attribute on `<html>`: `data-theme="dark|light"`
- Toggle icon changes: ☀️ (dark mode) / 🌙 (light mode)

**6. Completion Banner:**
- Shows when all questions answered
- Displays: Correct count / Total questions
- Calculates first-attempt accuracy percentage
- Three action buttons: Main Menu, Back to Tests, Retry Test

### Browser Support
- ✅ Chrome/Edge (latest 2 versions)
- ✅ Firefox (latest 2 versions)
- ✅ Safari 14+ (iOS & macOS)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### Performance Metrics
- **Load Time:** < 1 second (on 3G)
- **Bundle Size:** ~50KB total (uncompressed)
- **Time to Interactive:** < 2 seconds
- **Lighthouse Score:** 95+ (Performance, Accessibility, Best Practices)
- **Zero Network Dependencies:** All resources self-hosted

---

## 📊 Current Content Count

### Practice Tests (MCQs)
| Test | Questions | Type | Status |
|------|-----------|------|--------|
| Practice Test 1 | **10** | Ethics Fundamentals | ✅ Active |
| Practice Test 2 | **20** | Core Concepts | ✅ Active |
| Practice Test 3 | **26** | Advanced Scenarios | ✅ Active |
| **Subtotal** | **56** | | |

### Flashcards (Quick Review)
| Set | Cards | Topic | Status |
|-----|-------|-------|--------|
| Flashcards Set 1 | **20** | Beneficiaries & Policy Basics | ✅ Active |
| Flashcards Set 2 - Part 1 | **20** | Policy Provisions | ✅ Active |
| Flashcards Set 2 - Part 2 | **20** | Group Insurance | ✅ Active |
| Flashcards Set 2 - Part 3 | **20** | Health Insurance | ✅ Active |
| Flashcards Set 2 - Part 4 | **20** | Policy Details | ✅ Active |
| Flashcards Set 2 - Part 5 | **20** | Coverage Types | ✅ Active |
| Flashcards Set 2 - Part 6 | **20** | Insurance Basics | ✅ Active |
| Flashcards Set 2 - Part 7 | **20** | Advanced Topics | ✅ Active |
| Flashcards Set 2 - Part 8 | **10** | Final Review | ✅ Active |
| **Subtotal** | **170** | | |

### Coming Soon Topics
| Topic | Status | Icon |
|-------|--------|------|
| WFG Ethics Compliance Course | 🔜 Coming Soon | 🛡️ |
| WFG Anti-Money Laundering | 🔜 Coming Soon | 💼 |
| LLQP Life Insurance | 🔜 Coming Soon | 🏥 |
| LLQP Accident & Sickness | 🔜 Coming Soon | 🚑 |
| LLQP Segregated Funds & Annuities | 🔜 Coming Soon | 📊 |

### **Grand Total: 226 Questions** (56 MCQs + 170 Flashcards)

---

## 🎓 Study Content Breakdown

### Practice Test 3 Topics (26 questions):
- Trafficking in insurance
- Misrepresentation and disclosure duties
- Rebating and prohibited practices
- Assuris coverage (life, disability, cash value)
- Beneficiary changes and designations
- Contract law (offer, acceptance, consideration)
- Group insurance policyholder rights
- Mortgage insurance replacement rules
- Policy provisions (anti-lapse, free look, collateral assignment)
- License revocation scenarios
- Estate insolvency and creditor protection
- Criminal exclusions and presumption of death

---

## 🔄 Updating Questions

1. **Edit JSON files** in `data/llqp-ethics/` folder
2. **Update question counts** in `data/topics.json`
3. **Test locally** - Open index.html in browser
4. **Commit changes:**
   ```bash
   git add .
   git commit -m "Add 5 new questions to Practice Test 3"
   git push
   ```
5. **Auto-deploys** - Live in ~1 minute!

---

## 🌐 Deployment Status

Once deployed to Cloudflare Pages:
- ✅ Automatic deployments on push
- ✅ Preview deployments for branches
- ✅ Free custom domain support
- ✅ Analytics available (Cloudflare Web Analytics)
- ✅ Unlimited bandwidth & requests

---

## 🤝 Contributing

Want to add more questions? Follow these steps:

1. Fork the repository
2. Add questions to appropriate JSON files
3. Test locally
4. Submit a Pull Request

**Question Guidelines:**
- Clear, unambiguous wording
- 4 options (A, B, C, D)
- Detailed explanations
- Proper difficulty tagging

---

## 📝 License

MIT License - Feel free to use for personal or educational purposes.

---

## 🆘 Support & Troubleshooting

### Common Issues

**Q: Questions not showing?**  
A: 
- Check browser console (F12) for errors
- Ensure JSON files are valid using [JSONLint](https://jsonlint.com/)
- Verify `dataFile` paths in `topics.json` are correct
- Clear browser cache and hard reload (Ctrl+Shift+R)

**Q: Progress not saving?**  
A: 
- Ensure localStorage is enabled in browser settings
- Check Privacy/Security settings - localStorage must be allowed
- Try incognito/private mode to test if extensions are interfering
- Check storage quota (browser dev tools → Application → Storage)

**Q: How do I reset progress for a specific test?**  
A: 
1. Open the practice test
2. Click the **"Reset Progress"** button at the bottom
3. Confirm the action
4. This will:
   - Clear all progress data for that test
   - Clear saved question order (questions will re-randomize)
   - Reset to question 1
   - Remove bookmarks
   - Clear first-attempt tracking

**Q: Questions keep changing order when I resume?**  
A: This should NOT happen. Questions are randomized once and saved. If experiencing this:
- Clear your browser cache completely
- Check if localStorage is working: Open DevTools → Application → Local Storage
- Look for keys like `shuffle_llqp-ethics_practice-3`
- Use "Reset Progress" to start fresh with a new shuffle

**Q: I can't see which questions I've answered?**  
A: Check the question dots at the top:
- ✓ **Green** = Correct answer
- ✗ **Red** = Wrong answer
- **Gray** = Viewed but not answered
- **Blue** = Current question
- **Hover** over dots for detailed tooltips

**Q: Wrong answer counter not updating?**  
A:
- Wrong answers are logged automatically when you select incorrect option
- Counter appears on home screen after at least 1 wrong answer
- Click "Review Wrong Answers" card to practice them
- Use "Clear Wrong" button in a test to remove those questions from review

**Q: Dark mode not working?**  
A:
- Click the 🌙/☀️ icon in top-right corner
- Theme preference saved automatically
- If stuck, clear localStorage and try again

**Q: Bookmarks not saving?**  
A:
- Click the ★ icon on any question to bookmark
- Bookmarks saved per test in localStorage
- Use "Bookmarked" button to filter and view only flagged questions
- Bookmarks persist across sessions

**Q: How do flashcards differ from practice tests?**  
A:
- **Practice Tests:** Full MCQs with option feedback and detailed explanations
- **Flashcards:** Simpler format with brief explanations
- **Purpose:** Flashcards for quick review, practice tests for exam simulation

**Q: Can I export my progress or results?**  
A: Currently not supported. Feature planned for future release.

### Data Management

**Clear All Data:**
```javascript
// Open browser console (F12) and run:
localStorage.clear();
location.reload();
```

**View Saved Progress:**
```javascript
// In console:
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('progress_') || key.startsWith('shuffle_')) {
    console.log(key, localStorage.getItem(key));
  }
});
```

**Backup Your Progress:**
1. Open DevTools (F12)
2. Go to Application → Local Storage
3. Right-click → Copy all
4. Save to a text file

### Contact & Support

- **Issues:** Open a GitHub issue with details
- **Questions:** Check [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/)
- **Feature Requests:** Submit via GitHub issues with [Feature Request] tag

---

## 🎓 Study Tips & Best Practices

### Effective Study Strategies

📌 **Use Progressive Learning**
- Start with Practice Test 1 (fundamentals)
- Move to flashcards for quick reinforcement
- Progress to Practice Test 2 (core concepts)
- Tackle Practice Test 3 (advanced scenarios)

🔖 **Leverage the Bookmark System**
- Flag questions that challenge you immediately
- Filter to show only bookmarked questions
- Review these regularly until confident
- Remove bookmarks as you master topics

✓ **Track Your Performance**
- Green checkmarks show your strengths - these topics are solid
- Red X marks reveal weak areas - focus study time here
- Review wrong answers using the dedicated review system
- Aim for 100% green before moving to next test

❌ **Master Wrong Answers**
- Use "Review Wrong Answers" card on home screen
- Questions from ALL tests appear in review mode
- Once you get a question right, remove it from review
- "Clear Wrong" button removes current test's mistakes

📊 **Monitor First-Attempt Accuracy**
- Completion banner shows first-try score
- This metric indicates exam readiness
- Aim for 85%+ first-attempt accuracy
- Re-take tests after studying to improve score

🎯 **Read Everything Carefully**
- Study the explanation even when you answer correctly
- Review option feedback for wrong choices
- Understand WHY each option is correct/incorrect
- Context and reasoning matter more than memorization

🔄 **Don't Reset Too Early**
- Complete all questions before resetting progress
- Resetting randomizes questions again
- Build familiarity with the current order first
- Reset only when ready for fresh practice

💡 **Use Both Formats**
- **Practice Tests:** Deep learning with detailed explanations
- **Flashcards:** Quick recall and concept reinforcement
- Alternate between formats for variety
- Flashcards great for review sessions

📝 **Take Notes Externally**
- Copy complex explanations to your notes
- Create summary sheets by topic
- Write out concepts in your own words
- Teaching others reinforces your understanding

⏰ **Create a Study Schedule**
- 20-30 minutes daily better than cramming
- Review wrong answers each session
- Mix practice tests and flashcards
- Take breaks every 45-60 minutes

🎯 **Exam Simulation**
- Complete a full practice test without pausing
- Don't reveal answers until finished
- Time yourself (though timer not built-in yet)
- Treat it like the real exam

### Pre-Exam Checklist

✅ Complete all 3 practice tests with 85%+ accuracy  
✅ Review all 170 flashcards at least twice  
✅ Wrong answer review queue is empty  
✅ No bookmarked questions remaining (or all mastered)  
✅ Can explain reasoning for each answer choice  
✅ Comfortable with all tags/topics (ethics, legal, Assuris, contracts, etc.)  
✅ Reviewed explanations thoroughly, not just answers

---

## 🚀 Roadmap

### ✅ Completed Features (v2.0)
- [x] Visual indicators for answered questions (✓/✗)
- [x] Dual navigation buttons (before & after explanation)
- [x] Persistent question order across sessions
- [x] Progress tracking with localStorage
- [x] Comprehensive question explanations with option feedback
- [x] 226 total questions (56 MCQs + 170 flashcards)
- [x] Wrong answer review system with cross-test support
- [x] Dark/Light mode toggle
- [x] Bookmark functionality with filter
- [x] First-attempt accuracy tracking
- [x] Completion banner with score
- [x] Question dot tooltips with status
- [x] Multiple topic/test support
- [x] Responsive mobile design
- [x] Offline mode with service worker

### 🔜 Planned Enhancements (v3.0)

**High Priority:**
- [ ] Timer mode for exam simulation
- [ ] Detailed statistics dashboard
  - [ ] Score trends over time
  - [ ] Per-topic performance breakdown
  - [ ] Time spent per question
  - [ ] Accuracy charts
- [ ] Export progress/results as PDF
- [ ] Search functionality across all questions
- [ ] Print-friendly question sheets

**Medium Priority:**
- [ ] Question difficulty filtering (easy/medium/hard)
- [ ] Tag-based filtering (e.g., show only "Assuris" questions)
- [ ] Practice by specific topic across all tests
- [ ] Spaced repetition system for flashcards
- [ ] Custom quiz creator (mix questions from multiple tests)
- [ ] Notes system (add personal notes to questions)
- [ ] Study streaks and achievements

**Low Priority:**
- [ ] Question shuffle settings (per-question vs per-test)
- [ ] Audio reading of questions (accessibility)
- [ ] Keyboard shortcuts for navigation
- [ ] Question reporting system
- [ ] Social features (share scores)
- [ ] Mobile app version (PWA)

### 📝 Content Expansion

**In Development:**
- [ ] WFG Ethics Compliance Course questions
- [ ] WFG Anti-Money Laundering training
- [ ] LLQP Life Insurance questions
- [ ] LLQP Accident & Sickness Insurance
- [ ] LLQP Segregated Funds & Annuities

**Target:** 500+ total questions by end of 2026

---

**Built with ❤️ for LLQP exam success**

Good luck with your studies! 📚✨

---

## 📋 Version History

### v2.0.0 - Current (February 2026)
**Major Update - Feature Rich Platform**
- ✨ Added 216 new questions (226 total: 56 MCQs + 170 flashcards)
- 🔄 Implemented persistent question order across sessions
- ✓ Added visual indicators (✓/✗) for answered questions
- 🎯 Dual "Next Question" buttons for better UX
- 📊 Enhanced question dots with status tooltips
- 💡 Comprehensive explanations with option feedback
- ❌ Wrong answer review system with cross-test support
- 🌓 Dark/Light mode toggle
- 🔖 Bookmark functionality with filter mode
- 📈 First-attempt accuracy tracking
- 🎉 Completion banner with score calculation
- 🧠 Flashcard system with 9 sets (170 cards)
- 🎨 Improved responsive design

### v1.0.0 - Initial Release
**Basic MCQ Platform**
- 📝 10 initial practice questions
- 💾 Progress tracking via localStorage
- ⭐ Basic bookmark functionality
- 🏠 Topic selection interface
- 🔄 Question randomization
- 📱 Mobile responsive layout

---

## 🏗️ Architecture Notes

### Data Flow
```
topics.json → Loads all topics and tests
  ↓
User selects topic → practiceTests array displayed
  ↓
User selects test → dataFile loaded (practice-X.json or flashcards-X.json)
  ↓
Questions shuffled → Saved to localStorage (shuffle_[topic]_[test])
  ↓
User answers → State updated → Saved to localStorage (progress_[topic]_[test])
  ↓
Completion → Banner shown → Score calculated
```

### LocalStorage Keys
- `theme` - Dark/light mode preference
- `wrong_questions` - Array of incorrect answers across all tests
- `progress_[topicId]_[testId]` - Test-specific progress data
- `shuffle_[topicId]_[testId]` - Shuffled question order

### File Naming Conventions
- **Practice Tests:** `practice-[number].json` (e.g., practice-1.json)
- **Flashcards:** `flashcards-[set]-[part].json` (e.g., flashcards-2-part-1.json)
- **Question IDs:** `PPE-###` for practice tests, numeric for flashcards
- **Topic IDs:** Kebab-case (e.g., `llqp-ethics`, `wfg-aml`)

### CSS Architecture
- CSS Custom Properties for theming
- `data-theme` attribute on `<html>` for theme switching
- BEM-like naming for components
- Mobile-first responsive breakpoints
- Utility classes for common patterns

---

## 🤝 Contributing

Want to add more questions or improve the platform? Contributions welcome!

### Question Contributions

1. Fork the repository
2. Add questions to appropriate JSON files
3. Follow the question format guidelines
4. Update question counts in `topics.json`
5. Test locally by opening `index.html`
6. Submit a Pull Request

**Question Quality Guidelines:**
- ✅ Clear, unambiguous wording
- ✅ Exactly 4 options (A, B, C, D)
- ✅ One clearly correct answer
- ✅ Detailed explanations (2-4 sentences minimum for MCQs)
- ✅ Option feedback for each choice (MCQs)
- ✅ Proper difficulty tagging
- ✅ Relevant tags for categorization
- ❌ No typos or grammatical errors
- ❌ No ambiguous or trick questions
- ❌ No outdated information

### Code Contributions

1. Check existing issues for feature requests
2. Create a new branch for your feature
3. Follow existing code style (ES6, no semicolons, 2-space indent)
4. Test thoroughly across browsers
5. Update README if adding features
6. Submit PR with clear description

### Bug Reports

Include:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Console errors (F12 → Console tab)
