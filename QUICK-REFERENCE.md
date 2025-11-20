# 🚀 Quick Reference - Git Workflow

## ⚠️ Important: Tool Differences
- **Cursor**: Can run `npm run sync` and `npm run push` directly
- **Gemini 3**: Text files only (no terminal) - you must run Git commands on your local machine

## ⚡ Most Common Commands

### Before Starting Work (ALWAYS DO THIS FIRST!)

**In Cursor:**
```bash
npm run sync
# OR
./scripts/sync-from-github.sh
```

**⚠️ BEFORE Gemini 3 (CRITICAL - on your local machine):**
```bash
git pull origin main        # MUST do this first!
git log --oneline -5        # Verify you have latest
```
Then open the UPDATED file and copy entire contents into Gemini 3 prompt

**Why:** Gemini 3 can't access GitHub, so you must give it the latest code!

### After Making Changes

**In Cursor:**
```bash
npm run push
# OR
./scripts/push-to-github.sh
```

**After Gemini 3 (on your local machine):**
1. Save modified files to your project
2. In Terminal:
```bash
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
1. **Terminal:** `git pull origin main` - Get latest changes
2. **Copy file contents** into Gemini 3 prompt
3. **Gemini 3 makes changes** - Provides modified code
4. **Save files** to your project
5. **Terminal:**
   ```bash
   git add .
   git commit -m "Changes from Gemini 3"
   git pull origin main
   git push origin main
   ```

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

