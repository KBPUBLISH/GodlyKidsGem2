#!/bin/bash

# Script to create a new work branch
# Use this when starting work in Gemini 3 or for a new feature

echo "🌿 Creating new work branch..."
echo ""

# Get branch name
read -p "Enter branch name (e.g., gemini3-changes, feature-name): " branch_name

if [ -z "$branch_name" ]; then
    echo "❌ Branch name cannot be empty!"
    exit 1
fi

# Check if branch already exists
if git show-ref --verify --quiet refs/heads/$branch_name; then
    echo "⚠️  Branch '$branch_name' already exists!"
    read -p "Switch to existing branch? (y/n): " switch
    if [ "$switch" = "y" ]; then
        git checkout $branch_name
        echo "✅ Switched to branch: $branch_name"
    fi
    exit 0
fi

# Create and switch to new branch
git checkout -b $branch_name

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Created and switched to branch: $branch_name"
    echo ""
    echo "💡 Tips:"
    echo "   - Make your changes"
    echo "   - Commit: git add . && git commit -m 'message'"
    echo "   - Push: git push origin $branch_name"
    echo "   - Merge to main when ready"
else
    echo "❌ Failed to create branch."
    exit 1
fi

