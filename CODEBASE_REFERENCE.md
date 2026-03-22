# Codebase Reference - LLQP & WFG Exam Prep

Last updated: `2026-03-22`

Purpose: a fast orientation file for maintainers and coding agents working in this repo.

## 1. Architecture at a glance

- Frontend: vanilla HTML, CSS, and JavaScript SPA
- Backend: Cloudflare Worker serving both static assets and same-origin API routes
- Database: Cloudflare D1 for users, sessions, progress, audit logs, and password reset tokens
- AI: Cloudflare AI binding for `/api/explain`
- Auth protection: Cloudflare Turnstile
- Email delivery: Resend by default, Postmark supported as an alternative
- Offline support: service worker caches static assets and quiz data, but bypasses API caching
- Local storage: still used for local-first quiz state and as the cloud-sync payload source

This is no longer a "static files only" app. The Worker is now part of the normal production architecture.

## 2. Current repo layout

```text
c:\Users\C6475\OneDrive\Desktop\New folder (7)\Final-Ehtics-MCQS\
|
|- index.html
|- manifest.webmanifest
|- sw.js
|- wrangler.jsonc
|- README.md
|- CODEBASE_REFERENCE.md
|- AI_TECHNICAL_DETAILS.md
|- AI_IMPROVEMENTS.md
|
|- assets/
|  `- icons/
|
|- css/
|  |- style.css
|  `- style_backup.css
|
|- js/
|  |- app.js
|  `- auth.js
|
|- src/
|  `- worker.js
|
|- migrations/
|  |- 0001_auth.sql
|  `- 0002_auth_security.sql
|
|- tools/
|  |- split_life_quizzes.py
|  |- split_flashcards.py
|  |- audit_feedback_quality.js
|  |- repair_feedback_quality.js
|  |- validate_exam_quality.py
|  |- debug_flash_json.py
|  |- fix_explanation_inner_quotes.py
|  |- fix_flashcards_quotes.py
|  `- fix_single_option_quotes.py
|
`- data/
   |- topics.json
   |- topics-updated.json
   |- user_data.json
   |- llqp-ethics/
   |- llqp-life/
   |- llqp-accident/
   |- llqp-segregated/
   |- flashcards/
   `- insurance-legislation-ethics/
```

## 3. Current content footprint

Unique question counts by topic:

- `llqp-ethics`: 81
- `llqp-life`: 201
- `llqp-accident`: 35
- `llqp-segregated`: 54
- `flashcards-basic`: 170

Key content notes:

- `llqp-life` currently has full chapter data for `LIFE 01` to `LIFE 05`
- `LIFE 01` to `LIFE 05` also have `subTests` for shorter section-based study sessions
- `LIFE 06` to `LIFE 13` already exist in topic metadata as placeholders with `questionCount: 0`
- Ethics, Life, Accident and Sickness, and Segregated Funds each have a PDF manual entry
- Manuals are rendered from the same topic system as quizzes, but use `questionCount: 0`

## 4. Most important runtime files

### `index.html`

What it does:

- Defines the app shell and main views
- Hosts the topic list, quiz view, results chrome, PDF manual viewer, and auth modal
- Contains the buttons and containers that `js/app.js` and `js/auth.js` attach to

Important recent UI additions visible here:

- auth modal fields for reset flows
- manual viewer title and iframe
- review buttons and reset actions

### `js/app.js`

This is the main application brain and is still a large single-file controller.

Major responsibilities:

- loads `data/topics.json`
- renders the home screen and grouped topic cards
- loads quizzes and PDF manuals
- handles sectioned tests via `subTests`
- tracks progress, wrong answers, bookmarks, question shuffle, and answered state
- handles review mode and reset behavior
- tracks daily study stats
- stores and resumes the last study session
- powers speech synthesis for the visible question text
- renders and normalizes AI explanation responses

Local storage keys that matter:

- `progress_*`
- `shuffle_*`
- `wrong_questions`
- `study_daily_stats`
- `last_session`
- `auto-advance`
- `home-insights-expanded`
- `theme`

Important nuance:

- review mode intentionally avoids giving elimination clues through the option UI
- question order is randomized once per test and persisted until reset
- answered-question counts now drive progress stats more accurately than earlier logic

### `js/auth.js`

This file extends `MCQApp` with optional account features.

Major responsibilities:

- fetches auth config from `/api/auth/config`
- refreshes the current session from `/api/auth/session`
- renders the auth panel on the home screen
- opens and manages auth modal states:
  - sign in
  - sign up
  - password change
  - password reset request
  - password reset confirm
- manages Turnstile widget lifecycle
- syncs local progress snapshots to the cloud
- restores cloud progress back into local storage
- keeps progress isolated per account

Sync payload scope:

- all `progress_*` keys
- all `shuffle_*` keys
- `wrong_questions`
- `study_daily_stats`
- `last_session`
- `auto-advance`
- `home-insights-expanded`
- `theme`

### `src/worker.js`

This is the backend for production and full local development.

Major responsibilities:

- serves same-origin API routes
- falls through to `env.ASSETS.fetch(request)` for static app assets
- signs and validates session cookies
- rate-limits auth, password reset, and AI requests
- performs D1 reads/writes for users, sessions, progress, audit logs, and reset tokens
- sends password reset emails
- returns AI explanation JSON

Primary routes:

- `GET /health`
- `GET /api/auth/config`
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/signout`
- `GET /api/auth/session`
- `POST /api/auth/sync-progress`
- `GET /api/auth/progress`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `POST /api/auth/password-change`
- `POST /api/admin/password-reset-link`
- `GET /api/debug/reset-email`
- `POST /api/explain`

Current auth dependencies:

- D1 binding: `DB`
- secret: `SESSION_SECRET`
- secret: `TURNSTILE_SECRET_KEY`
- var: `TURNSTILE_SITE_KEY`

Email reset support currently uses these config points:

- `RESET_EMAIL_PROVIDER`
- `RESET_EMAIL_FROM`
- `RESET_EMAIL_REPLY_TO`
- `RESET_BASE_URL`
- `RESET_EMAIL_SUBJECT`
- `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`

### `data/topics.json`

This is still the source of truth for what the homepage can render.

Important rules:

- topic order controls display order
- `status: "active"` topics render as playable
- manuals are modeled as tests with `questionCount: 0`
- sectioned quizzes use `subTests`
- `dataFile` values often include `?v=...` query strings for cache busting
- if you change topic metadata here, mirror it into `data/topics-updated.json`

Important nuance:

- top-level Life chapter files and their `subTests` are alternate entry points to the same question pools
- do not add the parent count and the subtest counts together when reporting unique content totals

### `sw.js`

Important current behavior:

- current cache version in repo: `v1.7.2`
- caches static assets and topic/data JSON files
- intentionally bypasses API caching so auth/session state stays fresh
- should be bumped whenever static assets or data references change materially

### `wrangler.jsonc`

Current deployment configuration includes:

- Worker entrypoint: `src/worker.js`
- D1 binding: `DB`
- AI binding: `AI`
- custom domains:
  - `hllqpmcqs.com`
  - `www.hllqpmcqs.com`
- reset-email vars preconfigured for Resend

### `migrations/0001_auth.sql` and `migrations/0002_auth_security.sql`

Current D1 schema:

- `users`
- `sessions`
- `user_progress`
- `auth_attempts`
- `audit_logs`
- `password_reset_tokens`

### `tools/split_life_quizzes.py`

Purpose:

- regenerates part files for sectioned Life chapters

Current automated coverage:

- `LIFE 01`
- `LIFE 02`
- `LIFE 03`
- `LIFE 05`

Important nuance:

- `LIFE 04` section files exist, but this helper does not currently regenerate them

## 5. AI explanation pipeline

The full AI details live in `AI_TECHNICAL_DETAILS.md`, but the short version is:

- frontend builds question context in `js/app.js`
- request is posted to `/api/explain`
- Worker uses Cloudflare AI with JSON-schema output when possible
- frontend normalizes the response and renders multi-section teaching cards
- related-concept output unlocks a specific follow-up question composer

Current model behavior:

- primary: `@cf/meta/llama-3.1-8b-instruct-fast`
- fallback: `@cf/meta/llama-2-7b-chat-int8`

## 6. Recent changes reflected in this repo

Work from the last couple of days includes:

- custom-domain Worker deployment
- same-origin auth cookie flow
- D1-backed account system
- password reset request, confirm, and admin reset-link endpoints
- Resend email wiring and debug endpoint for reset-email configuration
- cloud progress sync isolated per account
- service worker API-cache bypass
- home screen redesign toward a calmer mobile-first study layout
- improved header/menu sizing and focus CTA sizing
- review flow and reset-state fixes
- more compact mobile explanation UI
- improved wrong-answer feedback quality
- visible-text-only speech support
- updated CISRO manuals
- Life chapter content expanded through `LIFE 05`

## 7. Common content tasks

### Add or update a quiz file

1. Edit the target JSON under `data/...`
2. Keep `correctAnswer` zero-based
3. Keep IDs unique within the file
4. Update the matching entry in `data/topics.json`
5. Mirror the metadata change into `data/topics-updated.json`
6. Bump the `?v=` suffix on changed `dataFile` entries
7. Bump `CACHE_VERSION` in `sw.js`

### Add or update a sectioned Life chapter

1. Edit the parent chapter JSON
2. Keep the section files aligned with the parent
3. Use `python tools/split_life_quizzes.py` if the chapter is supported by that helper
4. Update both topic metadata files
5. Verify the parent and section counts match what the UI should show

### Add a manual

1. Put the PDF under the topic's `Manual/` folder
2. Add a practice-test style entry with `questionCount: 0`
3. Point `dataFile` at the PDF and give it a fresh `?v=...`
4. Bump the service worker cache version

## 8. Watch-outs

- There is no `package.json`; this repo is intentionally lightweight
- `js/app.js` and `src/worker.js` are both large and easy to over-edit
- Do not treat section files as additional unique content
- Do not forget `topics-updated.json`; it is still cached and should stay aligned
- API requests should not be cached by the service worker
- Auth features are optional in the UI and should fail gracefully when backend config is unavailable
- Password reset flows depend on both Turnstile and email provider config
- Voice playback should only read the visible question text

## 9. Best starting points for new work

If the task is about:

- content or quiz routing: start with `data/topics.json` and `js/app.js`
- auth or cloud sync: start with `js/auth.js` and `src/worker.js`
- deployment or secrets: start with `wrangler.jsonc` and `migrations/`
- AI explanation behavior: start with `AI_TECHNICAL_DETAILS.md`, `js/app.js`, and `src/worker.js`
- stale docs: update this file and `README.md` together
