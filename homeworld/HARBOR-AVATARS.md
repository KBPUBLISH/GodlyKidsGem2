# Harbor avatar picker

The testing onboarding now runs Unlock → Build & Grow → Discover → Try 14 Days Free → name/age → avatar → crew. The three illustrated scenes are a forest discovery trail, the approved garden scene, and a moonlit treehouse library. Each has a Continue button; the fourth page offers Yearly/Monthly plans and Maybe later. It uses the existing subscription purchase service and parent gate. Trial completion or skipping leads to profile setup, and avatar confirmation saves one child and switches profiles before navigating. The old post-name pitch is retained only outside testing mode.

Same-tab intro progress survives hosted checkout. Successful verification returns to setup; cancellation and failed checkout keep the free path available. An unverified onboarding payment never grants premium. The three generated WebP scenes total about 282 KiB, and unused handoff artwork is no longer warmed; the existing 8 MiB upcoming-download budget still passes. Original generated PNGs remain in the workspace's generated_images directory.

`python homeworld/tests/island-welcome-browser.py` checks the four pages, small-phone/iPad layouts, skip/back/reload behavior, age validation, the parent gate, and fixture-only checkout failure/cancellation/verified/unverified returns. It never makes a real purchase. Native store checkout and live Stripe completion still require platform testing.

The testing branch uses generated harbor scenery and transparent UI artwork to match the supplied avatar-screen reference: gold GODLY over blue KIDS on a wooden ship-wheel sign, parchment title/name panels, wooden arrows, and a yellow confirmation button. The same new logo appears on the splash screen. Text, controls, thumbnail selection, and the central character remain live UI.

Six shared procedural 3D scouts supply the picker, profile portraits, and island player. Stable IDs and saved PNG portrait identifiers are preserved; runtime portrait URLs resolve to WebP with the `harbor-4` artwork revision. The displayed order is Trail, Meadow, Sunset, Sunshine, Sky, Berry. Their outfits, smaller rounded-square eyes, hair, headbands and explorer hat follow the reference. A single low button nose leaves the space between the eyes smooth. Continuous sculpted cheeks, shallow sockets, curved smiles, and subtle vertex shading add depth without large face textures. Existing action bones, planting/watering animations and world scale remain compatible.

Automatic rotation is capped at 30 frames per second with a maximum pixel ratio of 1.5 and a small 512px shadow map. A locally generated 64px environment adds soft reflections without an HDR download or screen-space effects. Only the selected rig is alive. Hidden tabs and reduced-motion mode stop automatic rendering. Holding and dragging still turns through 360 degrees with reduced motion enabled. A quick horizontal swipe selects the next/previous avatar; arrows, keyboard, and the six thumbnails also select. Resize observers and GPU resources are released on exit. WebGL failure uses a matching full-body WebP and still permits selection.

The harbor artwork follows the projected ground position of the 3D soles rather than a fixed screen percentage, including the contained-image fallback. The picker removes idle vertical bobbing so boots stay planted while turning. The responsive layout fits portrait phones, small 320×568 phones, portrait iPads, and landscape phones/tablets. Interactive targets are at least 44px. Artwork remains separate from text and the 3D scene. The generated background has separate phone/tablet WebP files, and shared UI artwork plus six thumbnails stays below the 450 KB phone-art budget checked by `tests/living-avatars.test.mjs`. The 16 KB Fredoka display font is hosted locally; its OFL license is alongside the file.

Regenerate artwork exports from the generated source images (retain the originals outside the public runtime directory):

```sh
node scripts/build-avatar-harbor-assets.mjs harbor-background.png transparent-ui-atlas.png
VITE_LIVING_TEST=1 npm run dev -- --port 3001
python scripts/render-living-avatar-portraits.py
```

The UI atlas contains five separate alpha silhouettes, in order: logo, heading parchment, caption parchment, confirm button, circular navigation button. The exporter separates them before WebP compression so adjacent pieces do not leak into the crops. No full UI screenshot or character turntable video is downloaded.

Validation:

```sh
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
npm run living-test:build
# Serve the production build on port 3000 first:
python homeworld/tests/avatar-onboarding-browser.py
python homeworld/tests/player-actions-browser.py
```

Browser tests use Chromium and API fixtures. They check responsive layouts, real touch/drag/keyboard selection, reduced motion, continued world warmup, saved-profile compatibility, the selected island model, and the no-WebGL fallback. They do not measure frame rates on physical Apple hardware.
