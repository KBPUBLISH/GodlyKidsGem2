# Godly Kids cloud handoff — 2026-10-30

## Starting point
Repository: KBPUBLISH/GodlyKidsGem2. Branch: `codex/my-friends-cloud-preview-2026-10-30`. Base: `399ec69ff596322c1fe756bfe461ae28da50d9dc` from the active Cursor branch `ocean-map-voyage-layout-and-island-access`.

This branch captures the nine tracked uncommitted files at handoff, including Cursor gameplay changes and the local QA fixes below. The local Cursor checkout was not switched or modified. Untracked helper scripts, screenshots, credentials, environment files, user saves and local dependencies were not copied. Treat gameplay changes as work in progress, not release-ready.

## Current user direction
Deeply simplify My Friends for ages 7–10. Introduce one activity at a time, with crops, food and buildings unlocked through accomplishments. User requested a preview, then explicitly authorized GitHub/cloud setup and a phone-accessible preview. Do not deploy the actual Godly Kids app or merge this branch without a new explicit request.

Read `docs/qa/my-friends-simplification.md`. The interactive concept is `docs/qa/my-friends-preview/index.html`. Its sequence: harvest three carrots → place a home → plant, water and harvest wheat → build an oven and bake bread → share with two friends → discover pumpkins and a market. Future pumpkin/market activities are presented as discoveries, not fully simulated. Growth/baking are accelerated to 1.4 seconds. English-only, placeholder scenery with existing game icons, browser speech optional. It is separate from game saves and has no backend.

Private hosted preview: https://godly-kids-little-discoveries.kingdombuilders.chatgpt.site (check deployment status before claiming live).

## Verification completed locally
- `node --test homeworld/tests/*.test.mjs tests/*.test.mjs`: 96 passed, 0 failed on this source snapshot.
- Interactive concept desktop-browser flow passed harvest, milestone unlocks, home placement, wheat planting/watering/growing/harvest, oven/bread, sharing, and future discoveries. Closing the discovery dialog advances safely. No captured console errors or broken images; no horizontal overflow at a 390px viewport.
- Earlier real-game checks: resident arrival/welcome/select; garden selecting/deselecting plots; crop harvest adds food/seed; new overhead placement retains selection while panning. Full autonomous construction and integrated market transactions remain open.

## Local fixes included
1. `homeworld/src/stage-journey.css`: phone HUD layout keeps Sound clear of the journey badge. Previously checked at widths 320/430 and tablet 820×1180.
2. `utils/prepareSceneVideo.mjs`, `tests/scene-video.test.mjs`: retain gesture recovery after autoplay rejection when a frame is decoded but playback remains paused. Regression reproduced before fix; tests pass after.

## Outstanding QA — do not claim complete
- Installed iPhone 15 Plus / iOS 26.5 video-background and story-video playback. Desktop browser checks do not establish a physical-device fix. Prior native desktop Safari media harness passed 17 remote H.264 videos; later IAB harness also passed.
- Nine-language story packs: English, Filipino/Tagalog, Brazilian Portuguese, French, German, Italian, Korean, Latin American Spanish, Polish. Earlier full 10-page/5-quiz/narration-start checks completed only en/tl/pt/pl; fr partial. Remaining packs, narration language/quality, and translations need continuation.
- My Friends integrated market transaction, full autonomous building completion, new onboarding/rewards, save migration, mobile frame time/heat/memory, accessibility and child usability testing.

## Working safely
Preserve existing characters, resources, buildings, coins and earned progress. Avoid broad rewrites of active Cursor changes. Use isolated changes with a simple rollback strategy. Do not reset or overwrite real user saves. Use disposable test profiles for game interaction. Cloud browser-control support may be unavailable; report checks actually performed and retain physical-device QA. No secrets should be pasted into chat or committed.

## Setup and useful commands
Node 22+ or 24. Root `npm ci` installs frontend dependencies. Root `npm run build` builds the app; `npm run homeworld:build` builds My Friends. Unit checks above are dependency-light but require tracked `public/homeworld/assets/world.json` and the two `public/*cache*.js` service workers. The repository includes a separate backend and portal; avoid booting external-service write paths merely to validate frontend changes.

To view the concept locally: `python3 -m http.server 5187 --directory docs/qa/my-friends-preview`. On a phone use the hosted URL, not localhost.
