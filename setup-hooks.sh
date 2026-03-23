#!/bin/bash

# ============================================
# Setup Script for Auto Version Bumping
# ============================================
# This script installs git hooks for automatic
# version tag management
#
# Usage: bash setup-hooks.sh

echo "🔧 Setting up Git Hooks..."
echo "=================================="

# Check if .git directory exists
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository. Please run this from project root."
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy the pre-commit hook from githooks directory
if [ -f "githooks/pre-commit" ]; then
  cp githooks/pre-commit .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✅ Pre-commit hook installed from githooks/ and made executable"
elif [ -f ".git/hooks/pre-commit" ]; then
  chmod +x .git/hooks/pre-commit
  echo "✅ Pre-commit hook already exists and made executable"
else
  echo "❌ Error: pre-commit hook not found in githooks/ or .git/hooks/"
  exit 1
fi

echo ""
echo "🎉 Git Hooks Setup Complete!"
echo "=================================="
echo ""
echo "📝 How it works:"
echo "  • When you run: git commit"
echo "  • The hook checks if source files changed"
echo "  • If yes, version tags are auto-bumped"
echo "  • Version tags are staged automatically"
echo "  • Your commit proceeds with updated versions"
echo ""
echo "🔄 Version bumping:"
echo "  • Format: v=YYYYMMDD{letter}"
echo "  • Example: v=20260323a → v=20260323b → ... → v=20260323z"
echo "  • Updates in: index.html + data/topics.json"
echo ""
echo "⚠️  Manual override:"
echo "  • Use: git commit --no-verify"
echo "  • Skips the hook (not recommended)"
echo ""
