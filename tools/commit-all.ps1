param(
  [Parameter(Mandatory = $true)]
  [string]$Message,
  [switch]$SkipAutoPush
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path ".git")) {
  throw "[commit-all] Error: run this from the repository root."
}

$hasChanges = (git status --porcelain)
if (-not $hasChanges) {
  throw "[commit-all] Error: no changes detected."
}

Write-Host "[commit-all] Staging all changes..."
git add -A

$stagedFiles = (git diff --cached --name-only)
if (-not $stagedFiles) {
  throw "[commit-all] Error: nothing staged after git add -A."
}

if ($SkipAutoPush) {
  $env:SKIP_AUTO_PUSH = '1'
  Write-Host "[commit-all] SKIP_AUTO_PUSH enabled for this commit."
}

try {
  Write-Host "[commit-all] Creating commit..."
  git commit -m "$Message"
} finally {
  if ($SkipAutoPush -and (Test-Path Env:SKIP_AUTO_PUSH)) {
    Remove-Item Env:SKIP_AUTO_PUSH -ErrorAction SilentlyContinue
  }
}
