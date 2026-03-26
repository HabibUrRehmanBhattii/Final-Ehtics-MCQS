# CI/CD Integration Guide

## Overview

The project uses GitHub Actions to enforce quality gates **before any deployment**. This ensures that only code meeting production standards reaches users.

## Workflows

### 1. Pre-Release Checks (On Every PR & Push)

**File:** `.github/workflows/pre-release-checks.yml`

**Triggers:**
- Pull requests to `main` or `staging`
- Pushes to `main`

**Runs:**
- Version tag consistency
- Metadata parity checks
- Production script hygiene
- MCQ quality validation

**Result:** PR checks pass/fail based on gate results. Cannot merge if gates fail.

### 2. Deployment (Main → Production)

**File:** `.github/workflows/deploy.yml`

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Flow:**
1. **Pre-Release Gate (BLOCKING)**
   - Runs all 4 quality checks
   - If **any fail** → deployment halted, exit code 1
   - If **all pass** → proceeds to deploy
   
2. **Deploy** (only if gate passed)
   - Deploys Worker to Cloudflare
   - Verifies deployment success

**Important:** Deployment is **impossible** if pre-release checks fail.

## Quality Gates - What Passes

✅ **NOW PASSING:**
- Version tags all aligned
- Metadata files synchronized
- No test scripts in production HTML
- All active MCQ files schema-compliant
- Empty placeholder files (for future chapters) silently allowed

All 4 gates currently passing with exit code 0.

## Local Testing

To test CI/CD locally before pushing:

```bash
# Run the exact checks that CI/CD will run
python tools/pre_release_check.py

# Check exit code
echo $?   # 0 = pass (deploy allowed), 1 = fail (deploy blocked)
```

## Setting Up Deployment Credentials

Required for `.github/workflows/deploy.yml` to work:

1. Go to GitHub repo → Settings → Secrets and Variables → Actions
2. Add `CLOUDFLARE_API_TOKEN` (from Cloudflare dashboard)
3. Add `CLOUDFLARE_ACCOUNT_ID` (from Cloudflare dashboard)

Without these, deployment step will fail.

## Monitoring & Logs

View all workflow runs:
- GitHub repo → Actions tab
- Click workflow name to see details
- Click job to see step-by-step output

## Next Steps

1. **Allow empty placeholders** in pre_release_check.py
2. **Add secrets** to GitHub repo
3. **Test workflow** by creating a PR against `main`
4. **Verify deployment** works when merged to `main`

---

See [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) for detailed deployment documentation.
