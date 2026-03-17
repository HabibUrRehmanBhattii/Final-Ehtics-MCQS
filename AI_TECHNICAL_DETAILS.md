# AI Explanations - Technical Implementation

## Context Data Flow

```
Question Object
    ├── question (text)
    ├── options (array)
    ├── correctAnswer (index)
    ├── optionFeedback (array of reasons)
    ├── explanation (official explanation)
    ├── difficulty (Easy/Medium/Hard)
    ├── tags (array of topics)
    └── [not used] other metadata

                ↓

MCQApp.generateAIExplanation()
    ├── Collects user interaction data
    ├── Builds comprehensive context object
    └── Sends to /api/explain endpoint

                ↓

Worker.js Processing
    ├── Receives context + question data
    ├── Creates system prompt (instructor persona)
    ├── Creates structured user prompt
    ├── Calls Claude AI model
    ├── Parses structured response
    └── Returns object with sections

                ↓

Frontend Rendering
    ├── Receives parsed sections
    ├── Renders color-coded layout
    ├── Attaches follow-up button
    └── Displays to student
```

## API Request Format

```javascript
{
  question: string,
  userAnswer: string,
  correctAnswer: string,
  options: string[],
  isCorrect: boolean,
  difficulty: string,           // NEW
  tags: string,                 // NEW
  optionFeedback: string,       // NEW
  correctFeedback: string,      // NEW
  explanation: string,          // NEW
  examTips: string,            // NEW
  isFollowUp: boolean,         // NEW for follow-up requests
  requestType: string,         // NEW 'deeper_insight'
}
```

## API Response Format

### Standard Explanation Response
```javascript
{
  success: true,
  mainExplanation: "...",      // Core concept
  whyCorrect: "...",           // Why answer is right
  whyIncorrect: "...",         // Why student's answer was wrong (if applicable)
  keyConcept: "...",           // Fundamental principle
  studyTip: "...",             // Mnemonic or memory aid
  relatedConcept: "..."        // Suggestion for further learning
}
```

### Follow-Up Response
```javascript
{
  success: true,
  followUpInsight: "..."       // Deeper insight or connection
}
```

## Section Styling

| Section | Class | Color | Icon | Use Case |
|---------|-------|-------|------|----------|
| Main | ai-main | Indigo | 💡 | Core explanation |
| Correct | ai-correct | Green | ✅ | Why answer is right |
| Incorrect | ai-incorrect | Orange | ❌ | Why student was wrong |
| Concept | ai-concept | Purple | 🎯 | Key principle |
| Tip | ai-tip | Cyan | 📚 | Memory aid |
| Related | ai-related | Pink | 🔗 | Further learning |
| Follow-up | ai-followup | Orange | 🌟 | Deeper insight |

## Key Functions

### generateAIExplanation()
- Main entry point for AI explanation requests
- Collects rich context from question and user interaction
- Handles UI state (loading, disabled button)
- Renders multi-section response
- Attaches follow-up button if applicable

**Called by:** Button click handler in HTML
**Returns:** Renders HTML, no return value
**Error handling:** Graceful fallback messages

### generateFollowUpExplanation()
- Triggered by "Ask Another Question" button
- Uses same context as original explanation
- Requests `isFollowUp: true` to API
- Appends new insight section to existing explanation
- Removes follow-up button after generation

**Called by:** Button click on follow-up button
**Returns:** Renders additional HTML, no return value
**Error handling:** Silently fails without disrupting existing explanation

## Prompt Engineering

### System Prompt
Sets instructor persona and guidelines:
- Expert in ethics for financial insurance exams
- Clear, supportive tone
- Explains concepts holistically
- Provides mnemonics and real-world connections
- Suggests related learning paths

### User Prompt (Standard)
Structures information for parsing:
- Clear section headers (MAIN_EXPLANATION, WHY_CORRECT, etc.)
- All available context integrated
- Request for specific format
- Conditional sections (WHY_INCORRECT only if incorrect)

### User Prompt (Follow-Up)
Encourages deeper thinking:
- Requests connections to related principles
- Asks about common misconceptions
- Explores real-world applications
- Makes it thought-provoking

## Response Parsing

```javascript
const regex = new RegExp(`${headerText}:\\s*(.+?)(?=\\n(?:[A-Z_]+:|$))`, 's');
const match = responseText.match(regex);
```

- Uses regex to extract content between headers
- Handles multi-line responses
- Graceful fallback if parsing fails
- Trims whitespace from extracted text

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Network error | Shows "Could not connect to AI service" |
| API error | Shows "AI service temporarily unavailable" |
| Response parse fails | Uses first 500 chars as explanation |
| No structured sections | Falls back to single explanation |
| Follow-up request fails | Silently removes loading state |

## Performance Considerations

1. **One request per explanation** - Not streaming, full response then parse
2. **Regex parsing** - O(n) where n = response length, typically < 2KB
3. **DOM manipulation** - Single innerHTML assignment + optional appendChild
4. **No additional requests** - Follows up in same request cycle if enabled

## Browser Compatibility

- Uses `fetch()` - All modern browsers
- Uses `querySelectorAll()` and `classList` - IE11+
- CSS custom properties - All modern browsers
- No polyfills needed for target audience

## Testing Checklist

- [ ] Correct answer → shows mainExplanation, whyCorrect, keyConcept
- [ ] Incorrect answer → shows whyCorrect, whyIncorrect, keyConcept
- [ ] Button disabled during request → re-enables on response
- [ ] Follow-up button appears → follow-up request works
- [ ] Response parsing handles missing sections gracefully
- [ ] Offline → shows error but doesn't crash app
- [ ] Mobile → sections stack properly, readable font sizes
- [ ] Dark mode → colors remain visible and accessible
