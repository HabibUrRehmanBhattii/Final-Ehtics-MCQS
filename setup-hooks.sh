#!/bin/sh

set -eu

echo "[hooks] Installing git hooks..."

if [ ! -d ".git" ]; then
  echo "[hooks] Error: run this from the repository root."
  exit 1
fi

if [ ! -f "githooks/pre-commit" ]; then
  echo "[hooks] Error: githooks/pre-commit not found."
  exit 1
fi

mkdir -p .git/hooks
cp githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit || true

echo "[hooks] Installed .git/hooks/pre-commit"
echo "[hooks] Tip: if your team shares hooks, run: git config core.hooksPath githooks"
