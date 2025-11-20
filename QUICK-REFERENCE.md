# 🚀 Quick Reference - Git Workflow

## ⚡ Most Common Commands

### Before Starting Work (ALWAYS DO THIS FIRST!)
```bash
npm run sync
# OR
./scripts/sync-from-github.sh
# OR
git pull origin main
```

### After Making Changes
```bash
npm run push
# OR
./scripts/push-to-github.sh
# OR manually:
git add .
git commit -m "Your message"
git pull origin main
git push origin main
```

## 📦 Using NPM Scripts (Easiest!)

```bash
npm run sync    # Pull latest from GitHub
npm run push    # Commit and push your changes
npm run branch  # Create a new work branch
```

## 🔧 Using Git Aliases (Quick!)

```bash
git sync        # Pull latest changes
git save "msg"  # Add, commit with message
git quickpush   # Pull then push (after committing)
```

## 🎯 Typical Workflow

### In Cursor:
1. `npm run sync` - Get latest changes
2. Make your changes
3. `npm run push` - Save and push

### In Gemini 3:
1. `npm run sync` - Get latest changes (including Cursor's)
2. Make your changes
3. `npm run push` - Save and push

## 🆘 Emergency Commands

### I have uncommitted changes and need to pull:
```bash
git stash              # Save your work
git pull origin main   # Get latest
git stash pop          # Restore your work
```

### I made a mistake:
```bash
git status             # See what changed
git restore <file>     # Undo changes to a file
git restore .          # Undo all changes (CAREFUL!)
```

### Check what's different:
```bash
git status             # See modified files
git diff               # See actual changes
git log --oneline -5   # See recent commits
```

## 📍 Current Status
```bash
git status             # What's changed?
git branch             # What branch am I on?
git log --oneline -5   # Recent commits
```

---

**Remember:** Pull before you push! 🔄

