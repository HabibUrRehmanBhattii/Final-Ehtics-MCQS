# Future Upgrade Plan (2026 Roadmap)

Status: In Progress  
Last updated: 2026-03-25

## 1) Current State (Baseline)

- Frontend is a vanilla SPA using [index.html](index.html), [js/app.js](js/app.js), [js/auth.js](js/auth.js), and [css/style.css](css/style.css).
- Backend/API runs via Cloudflare Worker in [src/worker.js](src/worker.js) with D1 migrations in [migrations](migrations).
- Offline cache behavior is controlled by [sw.js](sw.js).
- Runtime content is data-driven from [data/topics.json](data/topics.json) and question JSON files under [data](data).
- A mirrored topic metadata file exists at [data/topics-updated.json](data/topics-updated.json) and must remain aligned.
- Test coverage exists across JS and Python under [tests](tests).

---

## 2) Priority Upgrades

## High Priority (Release Safety)

### H1. Metadata Consistency Guardrails
Goal: prevent drift between [data/topics.json](data/topics.json) and [data/topics-updated.json](data/topics-updated.json).  
Why: avoids mismatched active/coming-soon states and data file/version mismatches.

Deliverables:
- Add parity test for topic/test metadata.
- Fail CI when topic/test IDs, order, `status`, `questionCount`, or `dataFile` diverge.

### H2. Version Consistency Guardrails
Goal: keep app version tags coherent across [index.html](index.html), [js/app.js](js/app.js), and [sw.js](sw.js).  
Why: reduces stale-cache and "fix not visible" incidents.

Deliverables:
- Validate that `appBuildVersion` matches local asset `?v=` tags in [index.html](index.html).
- Validate that `cacheVersion` in [js/app.js](js/app.js) matches `CACHE_VERSION` in [sw.js](sw.js).

### H3. Production Script Hygiene
Goal: remove debug/test script loading from production shell.  
Why: lower runtime risk and unnecessary payload.

Deliverables:
- Remove test/debug script tags from [index.html](index.html) production path.

---

## Medium Priority (Maintainability)

### M1. Frontend Modularization
Goal: split large `MCQApp` surface in [js/app.js](js/app.js) into domain modules.

Proposed extraction sequence:
1. `storage` + progress/session helpers
2. question rendering + option shuffle helpers
3. navigation/timer controller
4. AI explanation + wrong-answer review helpers

### M2. Worker Route Modularization
Goal: reduce monolithic route handling in [src/worker.js](src/worker.js).

Proposed extraction sequence:
1. auth/session handlers
2. progress/sync handlers
3. admin/heatmap handlers
4. AI explanation handlers

### M3. Content QA Expansion
Goal: scale JSON quality checks beyond selected subsets.

Deliverables:
- Add full-scan validation for MCQ schema consistency.
- Ensure `questionCount` in topic metadata matches source question file counts where applicable.

---

## Low Priority (Documentation & Operations)

### L1. Documentation Alignment
Goal: keep architecture/docs current.

Files to keep synchronized:
- [README.md](README.md)
- [CODEBASE_REFERENCE.md](CODEBASE_REFERENCE.md)
- [AI_GUIDELINES.md](AI_GUIDELINES.md)
- [AUTO_VERSION_GUIDE.md](AUTO_VERSION_GUIDE.md)

### L2. Cache/Release Runbook
Goal: single lightweight checklist for safe content deploys.

Checklist should include:
- bump relevant `?v=` tags
- bump `CACHE_VERSION`
- verify topic parity
- verify service worker update path

---

## 3) Execution Plan (Phased)

## Phase 1 (Now): Guardrails + Hygiene
- [ ] Add metadata parity test
- [ ] Add version parity test
- [ ] Remove test/debug scripts from production shell

Success criteria:
- tests fail on metadata/version drift
- production shell no longer loads test scripts

## Phase 2: Refactor Foundations
- [ ] Extract frontend storage/session module
- [ ] Extract worker auth/session handlers
- [ ] Add regression tests for extracted surfaces

## Phase 3: Quality & Scale
- [ ] Expand content validators
- [ ] Add automated release checklist enforcement
- [ ] Refresh docs and contributor guidance

---

## 4) Risks & Dependencies

- Service worker/version changes must preserve offline behavior in [sw.js](sw.js).
- Local storage key contracts (`progress_*`, `shuffle_*`, `wrong_questions`) must remain stable in [js/app.js](js/app.js).
- Worker API contract changes must remain backward compatible with [js/auth.js](js/auth.js) and frontend calls.
- Data updates must keep [data/topics.json](data/topics.json) and [data/topics-updated.json](data/topics-updated.json) aligned.

---

## 5) Immediate Next Slice (Smallest Valuable Increment)

Implement and merge:
1. Parity tests for metadata + versions
2. Production removal of test/debug scripts from [index.html](index.html)

This gives immediate risk reduction with minimal code churn.
