# Copilot Instructions for LLQP & WFG Exam Prep

## Project shape (read first)
- This is a static vanilla JS SPA: no framework, no bundler, no package scripts.
- Main UI shell is `index.html`; behavior is centralized in `js/app.js`; styles live in `css/style.css`.
- Runtime content is data-driven from JSON files under `data/`.
- Offline behavior is controlled by `sw.js` (service worker caches app assets + JSON files).
- Optional AI explanations are served by Cloudflare Worker code in `src/worker.js`.

## Core data flow
- App boot: `MCQApp.init()` -> `loadTopics()` fetches `data/topics.json`.
- Topic card click -> `selectTopic()` -> test card click -> `selectPracticeTest()`.
- Test load path is from `practiceTests[].dataFile` in `data/topics.json` (not hardcoded in app).
- Questions are shuffled once and persisted in localStorage key `shuffle_{topicId}_{testId}`.
- Progress is persisted per test in `progress_{topicId}_{testId}`.
- Wrong-answer review is global via localStorage key `wrong_questions` and can span multiple tests/topics.

## Content schema conventions (critical)
- Question files follow `{ topic, topicId, description, examTips?, questions[] }`.
- Each question uses `id`, `question`, `options[4]`, `correctAnswer` (zero-based), `optionFeedback[4]`, `explanation`, `difficulty`, `tags`.
- `optionFeedback[correctAnswer]` is typically `null`; other entries explain why that option is wrong.
- Options are expected with `A./B./C./D.` prefixes in source JSON; app strips/rebuilds these during shuffle.
- `question` can contain HTML; app renders via `innerHTML`.

## High-impact maintenance rules
- If you add/remove questions, update `questionCount` in `data/topics.json` for that test.
- For data updates, bump `?v=...` on that test’s `dataFile` path (cache-busting).
- Keep `data/topics-updated.json` aligned when editing topic metadata (it is part of cached assets).
- If offline/PWA must reflect new assets immediately, bump `CACHE_VERSION` in `sw.js`.
- When adding new JSON files intended for offline use, add them to `CORE_ASSETS` in `sw.js`.
- Keep all `status: "active"` topics before `status: "coming-soon"` in `data/topics.json` (homepage order convention).

## Agent editing guidance for this repo
- Prefer data changes over JS changes when adding/changing question content.
- Preserve localStorage key formats (`progress_*`, `shuffle_*`, `wrong_questions`) to avoid breaking existing user progress.
- Do not introduce framework tooling unless explicitly requested.
- Keep UI behavior consistent with existing patterns in `js/app.js` (single global `MCQApp` object).

## Local workflows and debugging
- Local static run: `python -m http.server 8000` from repo root, then open `http://localhost:8000`.
- If content changes do not appear, suspect service worker cache first:
  - Unregister service worker in browser devtools.
  - Clear site storage/cache.
  - Hard refresh.
- JSON integrity is essential; existing Python scripts in `tools/` are used for JSON validation/fixes.

## AI endpoint integration notes
- Frontend calls `/api/explain` from `generateAIExplanation()` in `js/app.js`.
- Worker endpoint implementation is in `src/worker.js` and expects Cloudflare `AI` + `ASSETS` bindings (see `wrangler.jsonc`).