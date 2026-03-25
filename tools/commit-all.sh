#!/bin/sh

set -eu

if [ ! -d ".git" ]; then
  echo "[commit-all] Error: run this from the repository root."
  exit 1
fi

SKIP_PUSH=0
if [ "${1:-}" = "--skip-auto-push" ]; then
  SKIP_PUSH=1
  shift
fi

if [ "$#" -eq 0 ]; then
  echo "[commit-all] Error: commit message is required."
  echo "Usage: sh tools/commit-all.sh \"your message\""
  echo "       sh tools/commit-all.sh --skip-auto-push \"your message\""
  exit 1
fi

MESSAGE="$*"

if [ -z "$(git status --porcelain)" ]; then
  echo "[commit-all] Error: no changes detected."
  exit 1
fi

echo "[commit-all] Staging all changes..."
git add -A

if [ -z "$(git diff --cached --name-only)" ]; then
  echo "[commit-all] Error: nothing staged after git add -A."
  exit 1
fi

if [ "$SKIP_PUSH" -eq 1 ]; then
  export SKIP_AUTO_PUSH=1
  echo "[commit-all] SKIP_AUTO_PUSH enabled for this commit."
fi

echo "[commit-all] Creating commit..."
git commit -m "$MESSAGE"
