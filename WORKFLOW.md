# Git Workflow Guide

This guide helps you sync changes between **Cursor** and **Gemini 3** without losing work.

## 🚀 Quick Start

### Before Starting Work (Always do this first!)

```bash
# Option 1: Use the sync script
./scripts/sync-from-github.sh

# Option 2: Manual sync
git pull origin main
```

### After Making Changes

```bash
# Option 1: Use the push script
./scripts/push-to-github.sh

# Option 2: Manual push
git add .
git commit -m "Your commit message"
git pull origin main
git push origin main
```

## 📋 Recommended Workflows

### Workflow 1: Simple Sync (For Small Changes)

**When to use:** Making quick changes in either Cursor or Gemini 3

1. **Before starting:**
   ```bash
   ./scripts/sync-from-github.sh
   ```

2. **Make your changes** in Cursor or Gemini 3

3. **After finishing:**
   ```bash
   ./scripts/push-to-github.sh
   ```

### Workflow 2: Branch-Based (For Larger Features)

**When to use:** Working on a feature or making significant changes

1. **Create a branch:**
   ```bash
   ./scripts/create-work-branch.sh
   # Or manually: git checkout -b feature-name
   ```

2. **Make changes** in your preferred tool

3. **Commit and push:**
   ```bash
   git add .
   git commit -m "Description"
   git push origin feature-name
   ```

4. **When ready, merge to main:**
   ```bash
   git checkout main
   git pull origin main
   git merge feature-name
   git push origin main
   ```

### Workflow 3: Working in Both Tools Simultaneously

**When to use:** Making changes in both Cursor and Gemini 3

1. **In Cursor:**
   ```bash
   git pull origin main
   # Make changes
   git add .
   git commit -m "Changes from Cursor"
   git push origin main
   ```

2. **In Gemini 3:**
   ```bash
   git pull origin main  # Gets Cursor's changes
   # Make changes
   git add .
   git commit -m "Changes from Gemini 3"
   git push origin main
   ```

## 🛠️ Common Scenarios

### Scenario 1: You Have Uncommitted Changes in Cursor

```bash
# Stash your changes
git stash

# Pull latest from GitHub
git pull origin main

# Restore your changes
git stash pop
```

### Scenario 2: Merge Conflicts

If you get conflicts:

1. Git will mark conflicted files
2. Open the files and look for conflict markers:
   ```
   <<<<<<< HEAD
   Your changes
   =======
   Their changes
   >>>>>>> branch-name
   ```
3. Edit to keep the code you want
4. Resolve:
   ```bash
   git add .
   git commit -m "Resolved conflicts"
   ```

### Scenario 3: Accidentally Started Without Pulling

```bash
# Check what changed
git status

# If you have uncommitted changes, stash them
git stash

# Pull latest
git pull origin main

# Restore your changes
git stash pop

# If conflicts, resolve them manually
```

## 📝 Best Practices

1. **Always pull before starting work**
   - Prevents conflicts
   - Ensures you have latest code

2. **Commit often**
   - Small, logical commits
   - Clear commit messages

3. **Push regularly**
   - Don't let changes accumulate
   - Makes syncing easier

4. **Use branches for features**
   - Keeps main branch stable
   - Easier to review changes

5. **Communicate**
   - If working with others, coordinate
   - Use clear commit messages

## 🔧 Scripts Reference

### `sync-from-github.sh`
- Pulls latest changes from GitHub
- Handles uncommitted changes safely
- Shows recent commits

### `push-to-github.sh`
- Stages, commits, and pushes changes
- Pulls first to avoid conflicts
- Interactive commit message

### `create-work-branch.sh`
- Creates a new branch for features
- Switches to the new branch
- Prevents duplicate branches

## 🆘 Troubleshooting

### "Your branch is ahead of origin/main"
```bash
git push origin main
```

### "Your branch is behind origin/main"
```bash
git pull origin main
```

### "Merge conflict"
1. Open conflicted files
2. Resolve conflicts manually
3. `git add .`
4. `git commit`

### "Permission denied"
- Check GitHub authentication
- Verify SSH keys or token

## 📚 Additional Resources

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)

---

**Remember:** When in doubt, pull before you push! 🔄

