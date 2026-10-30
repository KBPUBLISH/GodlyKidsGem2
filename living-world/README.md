# Our Little World — isolated play test

Testing branch: `codex/living-world-player-test`, based on preview commit `385e1d9`.

This is a new playable 3D experiment. The existing app, Players World, character collection, and their saves are unchanged. This scene does not switch control into any Bible friend and does not connect to production services.

## Run

From the repository root, using Node 22+:

```sh
npm ci
npm run dev -- --strictPort
```

Open `/living-world/index.html` on that development server. The default application still opens at `/`.

```sh
# Standalone production bundle; does not replace the app build.
npx vite build --config living-world/vite.config.js
# Task progression and save validation.
node --test living-world/tests/*.test.mjs
```

The optional browser playthrough uses Python Playwright and Chromium (already present in the onboarding machine):

```sh
python living-world/tests/browser-smoke.py
# To test the standalone production bundle served on port 5188 instead:
LIVING_WORLD_TEST_URL=http://127.0.0.1:5188/ python living-world/tests/browser-smoke.py
```

It uses a disposable browser profile, plays all three requests, checks independent NPC movement/construction and save restoration, and writes screenshots under `/tmp`. A localhost server is for local validation; it is not a phone-accessible hosted preview.

The standalone bundle is written to `dist/living-world`. Its output directory is separate from the root app's entry. A later root build clears `dist`, so build the root app first if both outputs are needed.

## Play

- The teal character with the little backpack is always the player. Tap the ground to walk, or use WASD/arrow keys. Escape cancels a walk.
- There is no joystick. Tap the ground to walk, or use WASD/arrow keys. Nearby supplies are picked up automatically as the player walks past; the stack is visible on the backpack. Tapping a supply is an optional destination shortcut, not a required collection action.
- Walk onto the glowing delivery circle to deposit supplies one at a time. Partial deliveries are saved, so collecting and delivering a single log works. The floating counter shows the delivered amount; the backpack shows what is still being carried. No confirmation or conversation is required.
- Noah asks for three logs at the home circle and then builds autonomously. Eve asks for four carrots at the kitchen circle. Ruth arrives after the food task and asks for three flowers at the home circle, adding a porch and flowers. There is one current request and a small task drawer; later requests are revealed gradually.
- Friends cannot be controlled or assigned jobs. Tap them for a short conversation; conversations do not consume supplies or complete requests.
- Noah, Eve, and Ruth follow local movement/work routines without management panels. These are deterministic prototype behaviors, not a connected LLM or the existing game's resident AI.

Progress lives only in `godlykids_living_world_playtest_v1` in this browser's local storage. It contains this scene's player position, completed requests, validated pickups, partial delivery receipts, and Noah's construction progress. Older prototype saves without receipts remain compatible. A fresh browser profile starts a fresh test. No original game save data is read, migrated, or reset. Storage failure permits session-only play.

## Current limits

The simple procedural characters and scenery are placeholders. This pass adopts the reference's walk/collect/carry/deliver loop, marked construction area, home improvement, and autonomous neighbors. It remains a three-request slice. Growing, cooking and serving are future gameplay steps; the kitchen is presently scenery and a delivery destination. Story-based friend collection, character customization, production economy, collision/pathfinding around scenery, indoor play, and physical-device performance testing are not implemented here. Noah's build takes about 18 seconds of simulation time after delivery and pauses while the page is inactive. There are no hunger/energy requirements or absence penalties.

The scene uses Three.js already present in this branch. Google Fonts are optional: system fonts are used if networking blocks them. WebGL is required and has a readable fallback message.
