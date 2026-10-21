# Portal deploy (portal.godlykids.com) — Netlify

The **portal** deploys from **Netlify**. Code lives in `KBPUBLISH/portalgk2.0` on GitHub. If Netlify isn't deploying, it's always one of two things: **deploy key** (build fails) or **no trigger** (build never starts).

---

## If builds fail with "Failed to prepare repo"

Netlify **cannot clone** the repo. Fix it once:

1. **Netlify:** Site (portal.godlykids.com) → **Site settings** → **Build & deploy** → **Continuous deployment** → **Repository** → **Manage deploy keys** (or "Link repository").
2. **GitHub:** Repo **KBPUBLISH/portalgk2.0** → **Settings** → **Deploy keys**. Add the key Netlify shows, or re-add it with **Read** access.  
   Or in Netlify: **Link repository** again and re-authorize with GitHub so a new key is created.
3. Back in Netlify: **Deploys** → **Trigger deploy** → **Clear cache and deploy site**.

Until the deploy key has Read access to the repo, **no build will succeed**.

---

## Push portal code to GitHub

From repo root (use **Terminal.app** or **iTerm** so Keychain works):

```bash
cd ~/GodlyKidsGem2
./scripts/push-portal-subtree.sh main
```

If you get auth errors, use SSH:

```bash
git remote set-url portal git@github.com:KBPUBLISH/portalgk2.0.git
./scripts/push-portal-subtree.sh main
```

---

## Trigger Netlify deploy (so you don't have to click)

Netlify often auto-deploys on push. If it doesn't, trigger from the repo:

### One-time setup: build hook

1. **Netlify** → your portal site → **Site settings** → **Build & deploy** → **Build hooks**.
2. **Add build hook** (e.g. name: "Portal deploy") → copy the URL (`https://api.netlify.com/build_hooks/...`).
3. In **GodlyKidsGem2** root, add to `.env`:
   ```bash
   NETLIFY_PORTAL_BUILD_HOOK_URL=https://api.netlify.com/build_hooks/YOUR_ID
   ```

### Trigger deploy from terminal

```bash
./scripts/trigger-netlify-portal.sh
```

Or push and trigger in one go:

```bash
./scripts/push-portal-and-deploy.sh
```

(If you don't set the build hook URL, the push still runs; you'll be told to trigger deploy in the Netlify dashboard.)

---

## Quick reference

| What | How |
|------|-----|
| Push portal to GitHub | `./scripts/push-portal-subtree.sh main` (run in Terminal.app) |
| Trigger Netlify deploy | `./scripts/trigger-netlify-portal.sh` (after setting build hook URL in .env) |
| Push + trigger | `./scripts/push-portal-and-deploy.sh` |
| Build fails "Failed to prepare repo" | Fix deploy key: Netlify → Manage deploy keys; GitHub repo → Deploy keys → Read access |
| GitHub repo | https://github.com/KBPUBLISH/portalgk2.0 |
