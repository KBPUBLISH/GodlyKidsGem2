# Mobile preview startup

The `codex/living-world-player-test` branch uses `npm run living-test:build`.
That command sets `VITE_LIVING_TEST=1` for the parent app. The ordinary ship,
returning-user and `/my-home` links now open the rebuilt testing island without
requiring a query parameter. `/map` redirects to the ship on this preview only.
The ship's first island opens the first story pack hub directly.

The first launch opens the original splash image with its loading indicator and
an always-usable Continue / Continue anyway action. Continue opens language
selection directly, without the splash or family videos. Navigation never waits
for Perry downloading. Perry keeps the original rig
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

The preview HTML starts splash/logo and language artwork downloads before React
loads. Compressed copies preserve the same artwork; the language background and
globe total 158,414 bytes instead of 3,578,971 (96% smaller). Original sources stay
unchanged. Returning families keep their existing route into the island.

Splash warmup prioritizes language artwork, then hands/Perry, ship artwork and
the six playable island models. This bounded queue is under 8 MiB, sequential,
low priority, and survives early screen changes. It saves completed media in the
existing service-worker cache so entering the island reuses those downloads.
Each transfer has a 15-second timeout; errors never disable Continue. Entering
the island stops remaining speculative work so actual gameplay takes priority.
Save-data/2G/3G connections warm only the small language artwork. The whole
adventure, videos and uncollected friends are never part of this queue.
The preview models use a stable `mobile-1` cache revision; increment it in
`world.js` and `previewAssets.mjs` if regenerating these assets. Perry uses `v=1`.
Increment the `mobile-v1` image filenames when regenerating the splash/language art.

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
PREVIEW_ASSET_TOOLS=/tmp/gk-preview-tools node scripts/optimize-preview-images.mjs
npm run living-test:build
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
```

Browser QA uses disposable storage and CMS fixtures. Throttled Chromium checks
are useful comparisons, not measurements of a physical phone or the live CMS.

## Previous island startup validation

- Production preview build and all 20 Node test files passed.
- No intro movie, Tailwind CDN request or whole-adventure preload; name entry
  and navigation work with Perry blocked.
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

## Splash and early-download validation

- Production preview build and queue tests cover priority, bounded asset size,
  deduplication across navigation, timeout/failure recovery, cancellation and
  limited-connection behavior.
- The startup browser test verifies the original splash first, language art
  before world downloads, Continue while a world request is deliberately held,
  and onboarding with a failed Perry download. Screenshots confirm the original
  splash and language artwork.
- `python homeworld/tests/preview-warm-cache-browser.py` enables the real service
  worker, waits for the six models to warm on the splash, then blocks their
  network URLs before entering the world. The island must still become playable
  with its first chicken task, proving reuse instead of duplicate downloads.

## Crew destination artwork

The ship's ocean panorama is 154,646 bytes and its hull is 305,936 bytes. CMS
destination art followed a separate path: the ship waited for the island list,
requested every island including distant ones, and fetched extra copies for
alpha measurement. Earlier tests with missing-art fixtures did not exercise
that path.

On Netlify, `living-test:build` now snapshots the public island catalogue and
compresses its actual uploaded art to WebP (maximum 768 pixels and 250,000 bytes
per image). The deployment includes those images and `preview-islands.json`.
The CMS can refresh in the background without delaying the first paint. The
build fails if source artwork cannot be prepared, rather than publishing a
partly missing catalogue. It records exact source/output bytes in
`preview-island-sizes.json` and the build log. No family data is included.

Local builds skip the live snapshot unless `PREVIEW_BUILD_ISLANDS=1` is set;
the browser tests inject a snapshot generated by the same pipeline using local
art fixtures. This cloud workspace cannot verify the live CMS or Netlify image
service because their hosts are outside its network policy.

The first destination warms from the splash. The crew page requests its current
image before adjacent artwork, omits distant images, and measures alpha from
the displayed image without another fetch. The hull and bow have high image
priority; world-model warmup pauses until the current island and deck are ready.
Newly changed CMS uploads on the Netlify host use a 768-pixel WebP image-service
URL until the next build snapshots them. Original upload URLs remain in CMS.

Validation: all 22 Node test files passed. `crew-loading-browser.py` keeps the
CMS request pending, uses five real artwork files through the compression
pipeline, and checks that the first image appears independently, only one
neighbor follows, originals/alpha-copy requests are absent, and the story
still opens. In the initial 8 Mbps / 100 ms simulated run the first island
appeared in 1.83 seconds; this is local browser QA, not a live-phone measurement.
Splash, retry and cold-island startup regressions also passed without JS errors.
