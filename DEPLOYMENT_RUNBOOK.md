# Deployment Runbook

## Pre-Release Quality Gates

All deployments are protected by automatic pre-release quality checks that **block deployment on failure**.

### Quality Gate Checklist

The following checks are **mandatory** and must pass before any deployment:

1. **Version Tag Consistency** ✓
   - `app.js` cacheVersion matches HTML `?v=` tags
   - HTML `?v=` tags match `sw.js` CACHE_VERSION
   - All versions aligned and consistent

2. **Metadata Parity** ✓
   - `data/topics.json` ≡ `data/topics-updated.json`
   - All test metadata, counts, and ids match
   - No manual drift or outdated mirrors

3. **Production Script Hygiene** ✓
   - No test scripts loaded in `index.html`
   - Only production assets shipped
   - Clean, minimal shell

4. **MCQ Quality** ✓
   - All questions have valid schema (4 options, 4 feedback entries)
   - `correctAnswer` values are integers [0..3]
   - Feedback at correct index is `null`; others are non-null
   - All questions have explanations

### Running Pre-Release Checks Locally

Before pushing to main or creating a PR:

```bash
python tools/pre_release_check.py
```

Expected output on pass:
```
[PASS] Version Tag Consistency
[PASS] Metadata Parity
[PASS] Production Script Hygiene
[PASS] MCQ Quality
[DONE] All 4 checks passed. OK to release.
```

Expected output on fail (example):
```
[PASS] Version Tag Consistency
[PASS] Metadata Parity
[PASS] Production Script Hygiene
[FAIL] MCQ Quality - 47 issues found
[ERROR] 1/4 checks failed. Deployment blocked.
Exit Code: 1
```

**Exit code 1 blocks deployment** in CI/CD.

### CI/CD Workflow

#### Pull Request Flow
1. PR created against `main` or `staging`
2. GitHub Actions runs `.github/workflows/pre-release-checks.yml`
3. All 4 quality gates execute
4. Results displayed in PR checks
5. PR cannot be merged if gates fail

#### Deployment Flow
1. Commit pushed to `main` branch
2. GitHub Actions runs `.github/workflows/deploy.yml`
3. **Pre-Release Gate job** executes (BLOCKING)
   - Runs `python tools/pre_release_check.py`
   - If any check fails → deployment halted, exit code 1
   - If all pass → proceeds to deploy job
4. **Deploy job** (only runs if gate passed)
   - Deploys Worker to Cloudflare
   - Verifies deployment
   - Updates GitHub deployment summary

#### Manual Deployment
To manually deploy without CI/CD:

```bash
# Run pre-release checks first
python tools/pre_release_check.py

# If checks pass, deploy
wrangler deploy
```

### Secrets Configuration

Required GitHub repository secrets for deployment:

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers deploy scope
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

Add these in GitHub repo Settings → Secrets and Variables → Actions.

### Fixing Failed Checks

**Version Tag Mismatch:**
```bash
# Auto-sync using sync script
node tools/pre-commit-version-bump.cjs
```

**Metadata Drift:**
```bash
# Auto-regenerate topics-updated.json
python tools/sync_topics_metadata.py
```

**MCQ Quality Issues:**
```bash
# Dry-run to preview fixes
python tools/fix_qa_issues.py --dry-run

# Apply fixes
python tools/fix_qa_issues.py
```

**Production Script Loading:**
- Manually review `index.html`
- Remove any `<script src="tests/...">` tags
- Ensure only production assets load

### Monitoring Deployments

After successful deployment:

1. Check [GitHub Actions](https://github.com/your-org/Final-Ehtics-MCQS/actions) for workflow status
2. Verify live at https://hllqpmcqs.com
3. Clear browser cache if assets don't update immediately

### Rollback Procedure

If deployed version has critical issues:

```bash
# Rollback to previous commit
git revert <commit-hash>
git push origin main

# CI/CD will re-run gates and redeploy previous version
```

### Adding New Quality Gates

To add a new pre-release check:

1. Create validation logic in `tools/validate_*.py`
2. Add check function to `tools/pre_release_check.py`
3. Test locally: `python tools/pre_release_check.py`
4. Commit and push - workflow will auto-run

### Troubleshooting

**"Exit Code 1" in CI/CD deployment:**
- Check workflow logs in GitHub Actions
- Run `python tools/pre_release_check.py` locally to identify issue
- Fix issue locally, test, commit, push

**"Deployment blocked by gate" but gate passed locally:**
- Ensure you're testing against latest `main` branch
- Check for uncommitted changes
- Verify Python version (3.11+)

**"No secrets configured" error:**
- Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to GitHub secrets
- Verify secret names exactly match workflow file

---

## Related Documentation

- [FUTURE_UPGRADE_PLAN.md](../FUTURE_UPGRADE_PLAN.md) - Complete upgrade roadmap
- [tools/pre_release_check.py](../tools/pre_release_check.py) - Quality gate implementation
- [tools/sync_topics_metadata.py](../tools/sync_topics_metadata.py) - Auto-sync metadata
- [tools/fix_qa_issues.py](../tools/fix_qa_issues.py) - Auto-fix MCQ schema issues
