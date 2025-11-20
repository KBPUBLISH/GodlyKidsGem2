#!/bin/bash

# Script to safely pull changes from GitHub
# Use this before starting work in Cursor or Gemini 3

echo "🔄 Syncing from GitHub..."
echo ""

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes!"
    echo ""
    echo "Options:"
    echo "1. Stash changes (recommended if you want to keep them)"
    echo "2. Commit changes first"
    echo "3. Discard changes (WARNING: This will lose your work!)"
    echo ""
    read -p "Choose option (1/2/3): " choice
    
    case $choice in
        1)
            echo "📦 Stashing your changes..."
            git stash push -m "Stashed before sync - $(date +%Y-%m-%d_%H:%M:%S)"
            echo "✅ Changes stashed. You can restore them later with: git stash pop"
            ;;
        2)
            echo "💾 Please commit your changes first:"
            echo "   git add ."
            echo "   git commit -m 'Your message'"
            exit 1
            ;;
        3)
            echo "🗑️  Discarding changes..."
            git restore .
            ;;
        *)
            echo "❌ Invalid choice. Exiting."
            exit 1
            ;;
    esac
fi

# Pull latest changes
echo ""
echo "⬇️  Pulling latest changes from GitHub..."
git pull origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully synced with GitHub!"
    echo ""
    echo "📋 Recent commits:"
    git log --oneline -5
else
    echo ""
    echo "❌ Error pulling changes. Check for conflicts."
    exit 1
fi

