# AI Explanations - Technical Details

Last updated: `2026-03-22`

This file describes the current AI explanation pipeline in the Worker-based version of the app.

## High-level flow

```text
Question rendered in js/app.js
    -> MCQApp.generateAIExplanation()
    -> POST /api/explain
    -> src/worker.js validates and rate-limits request
    -> Cloudflare AI generates structured JSON
    -> frontend normalizes response
    -> multi-section explanation cards render in the quiz UI
    -> optional follow-up question composer sends another /api/explain request
```

## Frontend entry points

Main frontend logic lives in `js/app.js`.

Important methods:

- `generateAIExplanation()`
- `generateFollowUpExplanation()`
- `normalizeAIResponse()`
- `formatAIText()`
- `getAIApiUrl()`

What the frontend sends for a standard request:

- `question`
- `userAnswer`
- `correctAnswer`
- `options`
- `isCorrect`
- `difficulty`
- `tags`
- `optionFeedback`
- `correctFeedback`
- `explanation`
- `examTips`

What it sends for a follow-up request:

- all of the above context
- `isFollowUp: true`
- `followUpQuestion`
- `requestType: "deeper_insight"`

## Worker behavior

AI requests are handled by `handleAIExplain()` in `src/worker.js`.

Current behavior:

- reads the request JSON body
- if D1 is configured, rate-limits by IP using the `ai_ip` scope
- builds a system prompt and a task-specific user prompt
- requests JSON output from Cloudflare AI
- falls back to a smaller model if the primary call fails
- returns normalized JSON back to the browser

Current model selection:

- primary: `@cf/meta/llama-3.1-8b-instruct-fast`
- fallback: `@cf/meta/llama-2-7b-chat-int8`

Current inference settings:

- `temperature: 0.2`
- `max_tokens: 700` for standard explanations
- `max_tokens: 300` for follow-ups

## Response schema

Standard explanation response shape:

```json
{
  "success": true,
  "mainExplanation": "2-4 sentences teaching the topic",
  "whyCorrect": "2-3 sentences",
  "whyIncorrect": "2-3 sentences if needed",
  "keyConcept": "1-2 sentences",
  "studyTip": "practical memory aid",
  "relatedConcept": "what to study next"
}
```

Follow-up response shape:

```json
{
  "success": true,
  "followUpInsight": "specific answer to the user's typed follow-up question"
}
```

## Frontend rendering

The quiz UI renders structured cards for:

- Explanation
- Why This Is Correct
- Why Your Answer Wasn't Correct
- Key Concept
- Study Tip
- Related Concept
- Follow-up Answer

The follow-up composer appears only when a `relatedConcept` is present.

Current follow-up UX:

- user types a specific question
- frontend sends another request with `isFollowUp: true`
- Worker returns `followUpInsight`
- frontend appends the answer below the original explanation

## Parsing and normalization

The frontend now expects proper JSON first, but still contains defensive parsing for older or malformed responses.

`normalizeAIResponse()` can recover from:

- valid JSON objects
- embedded JSON-like text
- older header-based text blocks such as `MAIN_EXPLANATION: ...`

This is deliberate defensive code so the UI does not break if the model returns a slightly messy payload.

## Rate limiting and failure handling

Current worker protections:

- AI requests can be rate-limited via D1 when the database is available
- failed requests are recorded in the auth-attempt tracking table
- Worker returns `{ success: false, error: ... }` on hard failures

Frontend fallback behavior:

- shows an error state in the explanation area
- disables AI availability after request failure in the current session
- does not crash the quiz flow
- follow-up failures restore the input/button state and show a toast

## Current implementation notes

- The Worker system prompt still says "LLQP/HLLQP ethics tutor" even though the feature now supports broader LLQP content
- The frontend asks AI only after the user answers a question
- Follow-ups are user-driven, not automatic
- The feature depends on the Worker `AI` binding and does not fully work in a static-only preview

## Files involved

- `js/app.js`
- `src/worker.js`
- `css/style.css`

## Good places to edit next

If you want to improve:

- prompts or schema: edit `src/worker.js`
- rendering or parsing: edit `js/app.js`
- spacing or visual hierarchy: edit `css/style.css`
