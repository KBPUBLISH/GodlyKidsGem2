# Push Portal or Backend (subtree)

You must run these commands **from your repo root** — the folder that contains the `scripts` folder (e.g. `GodlyKidsGem2`).

If your prompt shows something like `admin %` or `projects-portal %`, you are **not** in the repo root. Change directory first.

---

## 1. Go to repo root

```bash
cd ~/GodlyKidsGem2
```

(If your repo is elsewhere, use that path, e.g. `cd ~/Documents/GodlyKidsGem2`.)

Check you're in the right place — you should see a `scripts` folder:

```bash
ls scripts/push-portal.sh
```

If you see "No such file or directory", you're still in the wrong folder.

---

## 2. Push portal (for Netlify)

**One command** — split + push; uses Keychain (HTTPS), falls back to SSH if push fails:

```bash
./scripts/push-portal.sh
```

Run in **Terminal** (not Cursor). If HTTPS auth fails, the script tries SSH automatically.

---

## 3. Push backend (for Render)

From repo root:

```bash
./scripts/push-backend-subtree.sh main
```

From anywhere in repo:

```bash
bash "$(git rev-parse --show-toplevel)/scripts/push-backend-subtree.sh" main
```

---

## If you still get "no such file or directory"

- You're not in the repo root. Run `pwd` — you should see a path that ends in `GodlyKidsGem2` (or your repo name).
- Run `cd` to the folder that contains `backend`, `projects-portal`, and `scripts`, then run the script again.
