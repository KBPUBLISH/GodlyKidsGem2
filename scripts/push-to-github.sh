#!/bin/bash

# Script to safely push changes to GitHub
# Use this after making changes in Cursor or Gemini 3

echo "📤 Pushing changes to GitHub..."
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
    echo "ℹ️  No changes to commit."
    exit 0
fi

# Show status
echo "📋 Current status:"
git status --short
echo ""

# Ask for commit message
read -p "💬 Enter commit message: " commit_message

if [ -z "$commit_message" ]; then
    echo "❌ Commit message cannot be empty!"
    exit 1
fi

# Stage all changes
echo ""
echo "📦 Staging changes..."
git add .

# Commit
echo "💾 Committing changes..."
git commit -m "$commit_message"

if [ $? -ne 0 ]; then
    echo "❌ Failed to commit. Check for errors above."
    exit 1
fi

# Pull first to avoid conflicts
echo ""
echo "⬇️  Pulling latest changes (to avoid conflicts)..."
git pull origin $CURRENT_BRANCH --rebase

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  Merge conflict detected! Please resolve conflicts manually."
    echo "   After resolving, run: git add . && git rebase --continue"
    exit 1
fi

# Push
echo ""
echo "⬆️  Pushing to GitHub..."
git push origin $CURRENT_BRANCH

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🔗 View on GitHub:"
    echo "   https://github.com/KBPUBLISH/GodlyKidsGeminiProject"
else
    echo ""
    echo "❌ Failed to push. Check for errors above."
    exit 1
fi

