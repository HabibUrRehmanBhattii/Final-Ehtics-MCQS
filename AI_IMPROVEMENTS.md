# AI and Feedback Improvements

Last updated: `2026-03-22`

This file tracks the recent explanation, answer-feedback, and study-support improvements that landed over the last few days.

## Recently shipped

- Structured AI responses returned as JSON instead of relying on loose text parsing
- Better teaching-oriented explanations with short, exam-focused copy
- Specific follow-up question composer so users can ask exactly what confused them
- Stronger wrong-answer coaching and cleaner option-label handling
- More compact explanation layout on mobile
- Better explanation teaching flow tied into resume and review behavior
- Visible-question-only speech output
- Review/reset fixes that prevent stale state from leaking between study sessions
- Progress stats that use answered questions more accurately

## User-visible result

The current quiz flow is much more study-oriented than before:

- users get more useful feedback after wrong answers
- AI explanations are broken into clear sections
- follow-up learning is now interactive instead of one-shot
- mobile screens waste less space
- review mode is more predictable
- resume flow is less likely to feel broken or stale

## Current explanation sections

The UI now renders:

- Explanation
- Why This Is Correct
- Why Your Answer Wasn't Correct
- Key Concept
- Study Tip
- Related Concept
- Follow-up Answer

## Related repo areas touched by this work

- `js/app.js`
- `src/worker.js`
- `css/style.css`
- `sw.js`

## Still worth improving later

- broaden the Worker system prompt so it is not framed only as an ethics tutor
- continue shrinking the size of `js/app.js`
- add deeper validation around AI response quality if false positives show up again
