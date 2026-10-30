# Mobile preview startup

The `codex/living-world-player-test` branch uses `npm run living-test:build`.
That command sets `VITE_LIVING_TEST=1` for the parent app. The ordinary ship,
returning-user and `/my-home` links now open the rebuilt testing island without
requiring a query parameter. `/map` redirects to the ship on this preview only.
The ship's first island opens the first story pack hub directly.

The preview starts at language selection, skips the splash and family videos,
and never gates navigation on Perry downloading. Perry keeps the original rig
and clips in a smaller Draco/WebP file (8.56 MiB → 1.20 MiB). The intro hands
and speech text remain usable when the model fails. Tailwind styles compile at
build time so the phone does not fetch and execute the CDN compiler.

World models required before playing fell from 64.41 MiB to 5.08 MiB. These are
compressed versions of the same island, props and buildings, with gameplay
metadata preserved. Adam loads after the playable scene. Eve/Noah are not
downloaded for this solo/Adam slice. A failed Adam download does not block the
farm; an earned friend offers a retry. Model downloads time out after 60 seconds
with a retry instead of spinning indefinitely. The parent and iframe show one
simple loading treatment, without downloading a second ocean/tips screen.

Next-screen warmup is delayed, sequential, low priority and canceled on navigation.
It skips save-data/2G/3G connections and never preloads the whole adventure.
The preview models use a stable `mobile-1` cache revision; increment it in
`world.js` and `previewWarmup.ts` if regenerating these assets. Perry uses `v=1`.

Hosted previews use the app's existing `https://backendgk2-0.onrender.com/api/`
default when no remote API URL is configured. Loopback configuration cannot
send hosted story requests to the child's phone. A supplied remote API remains
respected. CMS failures show a retry on the ship; valid CMS islands without art
use the existing island artwork instead of disappearing. Story data and unlocks
still come from the real CMS and reader.

## Reproduce optimized assets

Original source GLBs remain unchanged. The optimized copies are committed;
ordinary Netlify builds do not need the asset-authoring dependencies.

```sh
npm install --prefix /tmp/gk-preview-tools --no-audit --no-fund \
  @gltf-transform/core@4.2.1 @gltf-transform/functions@4.2.1 \
  @gltf-transform/extensions@4.2.1 sharp@0.34.2 draco3dgltf@1.5.7
PREVIEW_ASSET_TOOLS=/tmp/gk-preview-tools node scripts/optimize-preview-assets.mjs
npm run living-test:build
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
```

Browser QA uses disposable storage and CMS fixtures. Throttled Chromium checks
are useful comparisons, not measurements of a physical phone or the live CMS.

## Validation on this change

- Production preview build and all 20 Node test files passed.
- Fresh browser: language first, no intro movie, no Tailwind CDN request or
  whole-adventure preload; name entry and navigation work with Perry blocked.
- `/map` redirects to the ship. A real CMS fixture without artwork remains
  visible and tappable; it opens the first story pack hub. A failed CMS request
  shows a working retry, then recovers when the request succeeds.
- Cold entry at 8 Mbps / 100 ms latency: 12.54 seconds to the playable island in
  Chromium, using the local preview server. The Adam request was deliberately
  failed; naming and buying the first chicken still worked. Local unthrottled
  entry was 1.17 seconds, followed by a successful Adam background load.
- Full gameplay regression passed: buy/name chicken, solo camp, reader to Adam,
  carrots and picnic, confirmed home construction, enter/leave home, and
  320/820-pixel layouts. No captured JavaScript errors.
- These are software-browser measurements. The live Netlify site, a physical
  phone and live CMS response times were not measured from this environment.

Run `python homeworld/tests/preview-startup-browser.py` against a built preview
server; `LIVING_ISLAND_TEST_URL` can override the local default. Tests use
fixtures and disposable browser storage, never real family saves.
