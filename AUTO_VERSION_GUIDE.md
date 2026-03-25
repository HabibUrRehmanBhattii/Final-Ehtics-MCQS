# Auto Version + Commit Automation Guide

This repo uses a **pre-commit hook** to automatically bump version tags before each commit.

## What it updates
- `index.html` (`v=YYYYMMDDx` tags)
- `data/topics.json` (`v=...` query tags)
- `data/topics-updated.json` (if present)
- `js/app.js`
  - `appBuildVersion`
  - `cacheVersion` patch (for example `v1.8.2` -> `v1.8.3`)

## One-time setup

### Windows (PowerShell)
```powershell
.\setup-hooks.ps1
```

If your PowerShell blocks scripts, use:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup-hooks.ps1
```

### macOS/Linux/Git Bash
```bash
sh setup-hooks.sh
```

## Normal commit flow
```bash
git add .
git commit -m "your message"
```

If source files changed, the hook auto-bumps versions and stages those updates in the same commit.

## Quick pre-commit check
Run this before committing:
```bash
git status
git diff --cached --name-only
```

## If automation fails
1. Reinstall hook:
   - Windows: `.\setup-hooks.ps1`
   - macOS/Linux/Git Bash: `sh setup-hooks.sh`
2. Verify hook file exists:
   - `.git/hooks/pre-commit`
3. Verify Node is installed:
   - `node -v`
4. Retry commit.

## Emergency bypass (not recommended)
```bash
git commit --no-verify -m "your message"
```

Use bypass only if you accept manual version management for that commit.
