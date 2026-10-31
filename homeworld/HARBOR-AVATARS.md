# Harbor avatar picker

The testing onboarding now runs Unlock → Build & Grow → Discover → name/age → avatar → optional Try 14 Days Free → personal island. The three illustrated scenes are an island vista viewed from behind two children with Noah, David and Esther waving across a bridge, a girl planting seeds with Eve while a boy builds a hut with Noah, and a moonlit treehouse library. Each illustration has a Continue button. “This is me!” confirms the avatar, then the offer presents Yearly/Monthly plans and Maybe later. It uses the existing subscription purchase service and parent gate. The draft name, age, avatar and stable child ID survive back/reload and hosted checkout in session storage. Trial completion or skipping saves one child and switches profiles before opening the island. The old post-name pitch is retained only outside testing mode.

Same-tab intro progress survives hosted checkout. Successful verification resumes the draft and opens the island; cancellation and failed checkout keep the free path available. An unverified onboarding payment never grants premium. The three generated WebP scenes total about 286 KiB, and unused handoff artwork is no longer warmed; the existing 8 MiB upcoming-download budget still passes. Original generated PNGs remain in the workspace's generated_images directory.

`python homeworld/tests/island-welcome-browser.py` checks the three illustrated pages, avatar-before-offer ordering, small-phone/iPad layouts, skip/back/reload behavior, age validation, the parent gate, and fixture-only checkout failure/cancellation/verified/unverified returns. It never makes a real purchase. Native store checkout and live Stripe completion still require platform testing.

First arrival uses the actual island and selected 3D character: a 1.8-second fade from black, eyes opening and looking around, then a camera pullback over about six seconds. Perry loads independently, flies above the child, and uses the existing character voice bridge for a named welcome. “Let’s plant!” starts the real first garden action; Skip intro restores normal play. The welcome is saved per island/profile and does not replay on return. Reduced motion goes straight to the greeting. A failed model or voice request never blocks play. The dedicated `python homeworld/tests/living-arrival-browser.py` checks the real scene, first planting, skip, reload, and reduced-motion/model-failure paths.

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

The testing island HUD shows the chosen profile portrait beside the day/time, a separate bedtime crescent, and a compact parchment task card. Its red ! reads the task aloud through Perry; the separate Sound button still controls island audio. The bottom-left sailboat is generated transparent WebP artwork (160px, about 11 KB, warmed during onboarding). Garden prompt elements are positioned after each camera update without rerendering React each frame. They only appear within 3.2 world units of their plot and are hidden in map/interior views. `python homeworld/tests/living-hud-browser.py` checks mobile/iPad layouts, actual icon loading, task voice requests, marker alignment through camera turns, distance hiding, and first planting.
