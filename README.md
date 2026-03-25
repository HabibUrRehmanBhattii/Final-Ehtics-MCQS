# LLQP & WFG Exam Prep

Interactive LLQP and HLLQP study platform built as a vanilla JavaScript SPA with a Cloudflare Worker backend. The app now supports local-first quiz sessions, optional accounts, cloud progress sync, AI explanations, PDF manuals, offline caching, and a study-first mobile UI.

Live site: `https://hllqpmcqs.com`

## Current content snapshot

- `371` unique practice questions across LLQP Ethics, Life Insurance, Accident and Sickness, and Segregated Funds and Annuities
- `170` quick-review random MCQs
- `541` total unique study items
- `4` built-in CISRO PDF manuals
- Full chapter quizzes for `LIFE 01` to `LIFE 05`
- Shorter section splits for `LIFE 01` to `LIFE 05`
- Certification exams for Life Insurance and Segregated Funds
- Ethics mock exam plus multi-test wrong-answer review

Current topic totals:

- `LLQP Ethics (Common Law)`: 81 questions plus Ethics manual
- `LLQP Life Insurance`: 201 unique questions live today across LIFE 01 to LIFE 05 and the certification exam, plus sectioned study splits for shorter sessions
- `LLQP Accident & Sickness Insurance`: 35 questions plus manual
- `LLQP Segregated Funds & Annuities`: 54 questions plus manual
- `Random MCQs - Beneficiaries & Policy Basics`: 170 quick-review questions

Notes about the Life topic:

- `LIFE 01` to `LIFE 05` are fully loaded
- `LIFE 06` to `LIFE 13` are already wired into `data/topics.json` as placeholders for future content
- Section files reuse the same chapter question pools, so they are alternate study entry points, not additional unique questions

## What changed in the last few days

Recent work reflected in this repo includes:

- Added `HLLQP - LIFE 04 QZ - Universal Life Insurance` and `HLLQP - LIFE 05 QZ - Riders and Supplementary Benefits`
- Split Life chapter quizzes into shorter section files for easier study sessions
- Added CISRO PDF manuals for Ethics, Life, Accident and Sickness, and Segregated Funds
- Switched the deployed app to a Cloudflare Worker plus D1 architecture on the custom domain `hllqpmcqs.com`
- Added optional email/password authentication with Turnstile protection
- Added cloud progress sync so quiz state and wrong-answer review can move across devices
- Added password change, password reset request/confirm flows, Resend-based reset email delivery, and an admin reset-link generator endpoint
- Added allowlist-based admin accounts with an in-app admin dashboard for student overview, deep per-student analytics, and per-test progress reset actions
- Hardened same-origin session cookie handling and account isolation on the custom domain
- Improved AI explanations with better teaching prompts, structured JSON responses, and a specific follow-up question composer
- Improved wrong-answer feedback quality, option-label cleanup, review flow, reset behavior, and answered-question based progress tracking
- Reworked the home screen and quiz chrome toward a calmer, study-first mobile layout
- Updated speech support so "speak question" uses only the visible question text
- Updated the service worker to bypass API caching while still caching static assets and data files

## Architecture

- `index.html` provides the application shell, views, auth modal, and manual viewer
- `css/style.css` contains the active UI styling
- `js/app.js` contains the main SPA state and quiz flow
- `js/auth.js` layers optional account, session, and cloud-sync behavior onto the app
- `src/worker.js` serves static assets and powers auth, progress sync, password reset, and AI APIs
- `data/topics.json` is the main content map for topics, tests, section splits, and manuals
- `sw.js` handles offline caching and update behavior
- `wrangler.jsonc` defines Cloudflare bindings, custom domains, D1, and AI
- `migrations/` contains the D1 schema for users, sessions, progress, audit logs, password reset tokens, and native heatmap tables

The app is intentionally dependency-light. There is no `package.json` or frontend bundler in this repo. Most changes are plain HTML, CSS, JavaScript, JSON, or Wrangler configuration.

## Running locally

### Quick static preview

For content checks and core quiz UX, any static server is enough:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

You can also open `index.html` directly for simple browsing, but a local server is better for PDFs and service-worker behavior.

Static preview is good for:

- browsing topics and quizzes
- checking question data
- testing most quiz interactions
- reviewing manuals and styling

Static preview will not fully cover:

- auth and account flows
- cloud sync
- password reset
- Worker-backed AI explanations

### Full Cloudflare Worker stack

For the full app experience, run the Worker locally:

```bash
npx wrangler d1 migrations apply final-ehtics-mcqs --local
npx wrangler dev
```

Useful secrets for full local testing:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
```

Optional alternative email provider:

```bash
npx wrangler secret put POSTMARK_SERVER_TOKEN
```

Important non-secret vars already live in `wrangler.jsonc`, including:

- `TURNSTILE_SITE_KEY`
- `RESET_EMAIL_PROVIDER`
- `RESET_EMAIL_FROM`
- `RESET_EMAIL_REPLY_TO`
- `RESET_BASE_URL`
- `RESET_EMAIL_SUBJECT`
- `APP_NAME`
- `ADMIN_EMAIL_ALLOWLIST` (comma-separated admin emails, default includes `habibcanad@gmail.com`)
- `HEATMAP_ENABLED` (`true`/`false` kill switch for native in-app tracking + admin heatmap APIs)

### Deploying

Apply migrations and deploy with Wrangler:

```bash
npx wrangler d1 migrations apply final-ehtics-mcqs --remote
npx wrangler deploy
```

The app is currently configured for:

- `https://hllqpmcqs.com`
- `https://www.hllqpmcqs.com`

## Commit automation

This repo has a pre-commit hook that auto-bumps version tags and cache version when source files are committed.

Install hooks once:

- Windows PowerShell: `.\setup-hooks.ps1`
- macOS/Linux/Git Bash: `sh setup-hooks.sh`

Hook source is stored at `githooks/pre-commit` and installed to `.git/hooks/pre-commit`.
The hook calls `tools/pre-commit-version-bump.cjs`.

## Working with quiz data

When adding or updating content:

1. Edit or add the relevant JSON file under `data/`
2. Update `data/topics.json`
3. Mirror the same topic metadata changes into `data/topics-updated.json`
4. Bump the `?v=` cache-busting suffixes for changed `dataFile` entries
5. Bump `CACHE_VERSION` in `sw.js`
6. If you changed a sectioned Life chapter, keep the parent file and its section files aligned

For currently automated Life splits, use:

```bash
python tools/split_life_quizzes.py
```

That helper currently regenerates section files for:

- `LIFE 01`
- `LIFE 02`
- `LIFE 03`
- `LIFE 05`

## Important files

- `README.md` - high-level project overview and current status
- `CODEBASE_REFERENCE.md` - implementation-oriented repo map for maintainers and coding agents
- `AI_TECHNICAL_DETAILS.md` - current AI explanation request/response pipeline
- `AI_IMPROVEMENTS.md` - recent AI and feedback-related UX changes
- `data/topics.json` - source of truth for what the homepage renders
- `src/worker.js` - auth, progress sync, password reset, AI, and asset serving
- `js/app.js` - main quiz behavior, review mode, manuals, speech, resume flow
- `js/auth.js` - auth UI, session refresh, sync, password reset UI

## Operational notes

- `topics.json` and `topics-updated.json` should stay in sync
- Manual entries use `questionCount: 0` and point to PDF files
- The service worker caches static assets and data files, but API routes must always hit the network
- The auth UI intentionally degrades gracefully when the app is served without a configured Worker backend
- Cloud sync snapshots include quiz progress, shuffle state, wrong-answer review, daily stats, and the last session pointer

## Repo status after the recent work

As of `2026-03-22`, the repo reflects:

- custom-domain Worker deployment
- first-party auth cookies
- D1-backed accounts and cloud progress
- password reset email wiring
- updated manuals
- Life chapter content through `LIFE 05`
- the latest home, review, explanation, and resume-flow improvements

If you are picking work up from here, start with `CODEBASE_REFERENCE.md`, then inspect `data/topics.json`, `js/app.js`, `js/auth.js`, and `src/worker.js`.
