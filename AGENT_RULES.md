# Agent Working Rules

These are the rules I will follow in this repository before making changes.

## Codebase understanding

- `js/app.js` is the main runtime and highest-risk file. Quiz flow, navigation dots, resume state, timers, shuffle order, browser history, toast rendering, and completion UI all live there.
- `js/auth.js` adds optional account, cloud-sync, and password-reset behavior on top of the local-first app state.
- `src/worker.js` is the production backend and must keep auth, sync, reset, and AI route contracts stable.
- `sw.js` controls offline behavior and cache freshness. Static/data changes can look "not fixed" if cache/version bumps are missed.
- `data/topics.json` and `data/topics-updated.json` must stay aligned because the UI and cache depend on both.
- `tests/` already has focused regression coverage for navigation, resume, timer, worker, service worker, UI safety, and content helpers. New bug fixes should extend that coverage instead of bypassing it.

## Working rules

1. Scope before edits
- I will identify the exact runtime surface first: shell HTML, CSS, main SPA logic, auth layer, worker API, service worker, or quiz data.
- I will avoid broad refactors unless the user explicitly asks for them.

2. Reproduce first, then fix
- For bug work, I will locate the failing state path before patching.
- When feasible, I will add or update a regression test that fails for the reported bug, then fix the code.

3. Treat quiz state as one system
- In `js/app.js`, I will treat question order, option order, current question index, attempted answers, first-attempt correctness, timers, filter mode, and browser history as coupled state.
- I will not "fix" one of those in isolation if the bug clearly spans resume, navigation, or restore flows.

4. Preserve content integrity
- JSON under `data/` is source-of-truth study content.
- I will not change question meaning, answer meaning, or schema shape unless explicitly requested.
- If topic metadata changes, I will keep `data/topics.json` and `data/topics-updated.json` in sync.

5. Cache/version discipline
- If a user-facing static asset or cached data reference changes materially, I will review whether `sw.js`, script/data `?v=` suffixes, and any visible cache/build label also need to change.
- I will call out cache-impact clearly so stale service worker behavior is not mistaken for an unfixed bug.

6. UI consistency over redesign
- I will preserve the current structure and study-first visual language in `index.html` and `css/style.css`.
- I will not introduce unrequested layout redesigns while fixing logic bugs.

7. Auth and API safety
- In `js/auth.js`, `src/worker.js`, and `migrations/`, I will prefer least-risk, non-breaking changes.
- I will not weaken validation, session handling, token flow, or route contracts.

8. Service worker caution
- I will keep `sw.js` changes minimal, explicit, and test-backed.
- I will not cache API responses or change offline behavior casually.

9. Small diffs, no collateral damage
- I will keep diffs narrow and avoid unrelated formatting churn.
- I will not edit `index_backup.html` or `css/style_backup.css` unless explicitly asked.
- I will not overwrite or revert unrelated user changes.

10. Verify and report honestly
- After changes, I will run the most relevant tests first, then broader suites when appropriate.
- If I cannot verify something, I will say that directly.
- My handoff will always include what changed, why, what I validated, and any remaining risk.

11. Parallel-work safety
- I will keep my work isolated on my branch while the user works separately.
- I will not assume their uncommitted local state matches mine when diagnosing cache or runtime issues.
