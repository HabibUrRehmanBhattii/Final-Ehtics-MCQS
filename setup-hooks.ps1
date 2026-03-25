$ErrorActionPreference = 'Stop'

Write-Host "[hooks] Installing git hooks..."

if (-not (Test-Path ".git")) {
  throw "[hooks] Error: run this from the repository root."
}

if (-not (Test-Path "githooks/pre-commit")) {
  throw "[hooks] Error: githooks/pre-commit not found."
}
if (-not (Test-Path "githooks/post-commit")) {
  throw "[hooks] Error: githooks/post-commit not found."
}

New-Item -ItemType Directory -Force -Path ".git/hooks" | Out-Null
Copy-Item -Force "githooks/pre-commit" ".git/hooks/pre-commit"
Copy-Item -Force "githooks/post-commit" ".git/hooks/post-commit"

Write-Host "[hooks] Installed .git/hooks/pre-commit and .git/hooks/post-commit"
Write-Host "[hooks] Optional shared-hook mode:"
Write-Host "  git config core.hooksPath githooks"
