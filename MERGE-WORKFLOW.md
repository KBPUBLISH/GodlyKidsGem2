# Safe Merge Workflow for Gemini 3 + Cursor Changes

## Current Situation
- ✅ Cursor changes: Uncommitted (SignInPage, LandingPage updates, etc.)
- 🔄 Gemini 3 changes: Avatar shop updates + onboarding flow (not yet in repo)

## Recommended Workflow

### Option 1: Feature Branch (Safest - Recommended)

This keeps both sets of changes separate and allows careful merging:

```bash
# Step 1: Commit current Cursor changes
git add .
git commit -m "feat: Add SignInPage and Continue as Guest button"

# Step 2: Create a feature branch for Gemini 3 changes
git checkout -b feature/gemini3-avatar-onboarding

# Step 3: Add your Gemini 3 changes
# (Copy/paste your Gemini 3 code files here, or merge from another location)

# Step 4: Commit Gemini 3 changes
git add .
git commit -m "feat: Avatar shop updates and onboarding flow from Gemini 3"

# Step 5: Switch back to main and merge
git checkout main
git merge feature/gemini3-avatar-onboarding

# Step 6: Resolve any conflicts if they occur
# (Git will tell you which files have conflicts)

# Step 7: Push to GitHub
git push origin main
```

### Option 2: Stash Current Changes

If you want to test Gemini 3 changes first:

```bash
# Step 1: Stash Cursor changes
git stash push -m "Cursor changes: SignInPage and guest button"

# Step 2: Add Gemini 3 changes
# (Add your files here)

# Step 3: Commit Gemini 3 changes
git add .
git commit -m "feat: Avatar shop updates and onboarding flow from Gemini 3"

# Step 4: Restore Cursor changes
git stash pop

# Step 5: Resolve any conflicts, then commit
git add .
git commit -m "feat: Merge Cursor and Gemini 3 changes"

# Step 6: Push
git push origin main
```

### Option 3: Separate Commits (Simplest)

If you want both sets of changes in main, just commit separately:

```bash
# Step 1: Commit Cursor changes
git add .
git commit -m "feat: Add SignInPage and Continue as Guest button (from Cursor)"

# Step 2: Add Gemini 3 changes
# (Add your Gemini 3 files)

# Step 3: Commit Gemini 3 changes
git add .
git commit -m "feat: Avatar shop updates and onboarding flow (from Gemini 3)"

# Step 4: Push both commits
git push origin main
```

## If You Have Gemini 3 Code in a Different Location

If your Gemini 3 code is in a different folder or branch:

```bash
# Option A: Copy files manually
# Copy the changed files from Gemini 3 location to this project

# Option B: If it's in a different git repo/branch
# You can use git format-patch or cherry-pick

# Option C: If it's uncommitted in another clone
# Copy the files over, then follow Option 1 or 3 above
```

## Handling Merge Conflicts

If conflicts occur during merge:

1. Git will mark conflicted files
2. Open each file and look for conflict markers:
   ```
   <<<<<<< HEAD
   (Cursor's code)
   =======
   (Gemini 3's code)
   >>>>>>> feature/gemini3-avatar-onboarding
   ```
3. Edit to keep both changes or choose the best version
4. After resolving:
   ```bash
   git add .
   git commit -m "fix: Resolve merge conflicts"
   ```

## Quick Commands Reference

```bash
# See what files changed
git status

# See differences
git diff

# Create a backup branch (just in case)
git branch backup-before-merge

# View commit history
git log --oneline -10
```

