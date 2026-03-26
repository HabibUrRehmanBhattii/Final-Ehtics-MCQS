# CI/CD Quick Reference

## Pre-Release Checklist (Before Committing)

```bash
# 1. Run pre-release checks locally
python tools/pre_release_check.py

# Expected output: All 4 checks PASS, exit code 0
```

## Common Workflows

### Fixing Version Tags
```bash
node tools/pre-commit-version-bump.cjs
```

### Fixing Metadata Drift
```bash
python tools/sync_topics_metadata.py
```

### Fixing MCQ Quality Issues
```bash
# Preview what will be fixed
python tools/fix_qa_issues.py --dry-run

# Apply fixes
python tools/fix_qa_issues.py
```

### Before Deployment

```bash
# 1. Ensure all local checks pass
python tools/pre_release_check.py

# 2. Commit your changes
git add .
git commit -m "feat: your feature"

# 3. Push to main (or create PR)
git push origin main

# 4. Monitor GitHub Actions
# → Go to repo → Actions tab
# → Watch "Pre-Release Checks" workflow
# → If gate passes → deployment begins
```

## Deployment Status

| Status | Meaning | Action |
|--------|---------|--------|
| 🟢 PASS | Ready to release | Deploy automatically |
| 🔴 FAIL | Issues found | Fix reported issues |
| ⏳ RUNNING | Checks in progress | Wait for completion |

## Emergency Rollback

If deployed version has critical issues:

```bash
# Find problematic commit
git log --oneline

# Revert to previous version
git revert <commit-hash>
git push origin main

# CI/CD will automatically re-run gates and redeploy
```

## Troubleshooting

### "Pre-release checks failed"
- Run `python tools/pre_release_check.py` locally
- Fix reported issues
- Commit and push

### "Deployment blocked"
- Check GitHub Actions logs
- Look for which gate failed
- Follow "Fixing..." instructions above

### "Worker not deploying"
- Verify GitHub secrets are configured
- Check `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist
- Verify tokens have correct Cloudflare permissions

## Contact

For CI/CD issues:
1. Check workflow logs in GitHub Actions
2. Review [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)
3. Run `pre_release_check.py` locally for details

---

**Remember:** Never push to `main` without passing `pre_release_check.py` locally first!
