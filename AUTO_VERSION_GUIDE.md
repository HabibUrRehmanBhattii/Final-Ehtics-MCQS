# Auto Version + Auto Push Guide

This repo uses two Git hooks:

- **pre-commit**: bumps version tags/cache values when source files change
- **post-commit**: auto-pushes each commit to `origin/<current-branch>`

## Pre-commit updates
- `index.html` (`v=YYYYMMDDx` tags)
- `data/topics.json` (`v=...` query tags)
- `data/topics-updated.json` (if present)
- `js/app.js`
  - `appBuildVersion`
  - `cacheVersion` patch (example: `v1.8.2` -> `v1.8.3`)

## One-time setup

### Windows (PowerShell)
```powershell
.\setup-hooks.ps1
```

If your PowerShell blocks scripts:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup-hooks.ps1
```

### macOS/Linux/Git Bash
```bash
sh setup-hooks.sh
```

## Default workflow (stage all + commit + auto-push)

### Windows (PowerShell)
```powershell
.\tools\commit-all.ps1 -Message "your message"
```

### macOS/Linux/Git Bash
```bash
sh tools/commit-all.sh "your message"
```

## If automation fails
1. Reinstall hooks:
   - Windows: `.\setup-hooks.ps1`
   - macOS/Linux/Git Bash: `sh setup-hooks.sh`
2. Verify hook files exist:
   - `.git/hooks/pre-commit`
   - `.git/hooks/post-commit`
3. Verify Node is available:
   - `node -v`
4. Retry commit.

If post-commit auto-push fails, your commit is still local and safe.
Retry with:
```bash
git push origin <current-branch>
```

## Skip auto-push for one commit
- PowerShell helper:
```powershell
.\tools\commit-all.ps1 -Message "your message" -SkipAutoPush
```
- Shell helper:
```bash
sh tools/commit-all.sh --skip-auto-push "your message"
```
- Manual commit:
```powershell
$env:SKIP_AUTO_PUSH='1'; git commit -m "your message"
```
```bash
SKIP_AUTO_PUSH=1 git commit -m "your message"
```
