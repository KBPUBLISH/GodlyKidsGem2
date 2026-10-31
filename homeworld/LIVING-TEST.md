# Living together on the original island

Testing branch: `codex/living-world-player-test`. This opt-in mode retains the original island, models, navigation, camera and illustrated button styles. Normal island behavior and published bundles remain unchanged.

Use Node 22+ and `npm ci`. Build with `npm run living-test:build`, then run `npm run dev`. Open `/#/my-home?livingTest=1` in the app. The separate `homeworld/dev-test.config.js` server on port 5190 supports island rendering only; the story handoff requires the full app. Localhost is not a phone-accessible hosted preview.

The child starts alone with their chosen avatar and a small fenced garden. A Tasks button sits in the original vertical button rail; its compact list opens on the first visit and can be reopened anytime. Three saved goals unlock in order: plant four free carrot seeds, pick one carrot plus one pumpkin plus one lettuce, then build the prayer tent. Four empty, tilled squares are highlighted for planting; the two other squares hold a pumpkin and lettuce. The last planting earns 10 private farm coins once; each picked vegetable earns 2, for 16 coins after the opening garden. Growth starts only after the child finishes watering: lettuce takes 2 real minutes, carrots 3, and pumpkins 6. Each harvested patch needs fresh water for its next crop. Blue drop buttons mark thirsty patches, growing crops show small countdowns, and crop size increases as time passes. The arrival pumpkin and lettuce are already ripe; all newly planted carrots need water. Each crop has its own picking checkmark. Children can gather the three tent logs while carrots grow; building the tent still follows the three vegetable picks. The starter tent has a three-log introductory cost; its completed building uses the normal catalogue receipt. Tap to walk and automatically collect nearby supplies. Building still requires confirmation. The separate Market button offers seeds and optional named animals; a chicken never blocks the opening.

The tent celebration offers “Add a friend?” with Yes and No. Yes returns to the crew ship. Tapping the first island opens the original IslandScenePage background and bottom activity board. Its Read Story button opens the original lesson hub, reader, quiz and Try It sequence. After all activities present in the pack are complete, the original buried-treasure game reveals the CMS rewards and Adam. Continue returns to the ship; My community returns to the world for explicit placement. No leaves the world open for exploring and a later invitation. Only the child is controllable.

The handoff is bound to the active profile, island and story. Unavailable story content shows a retry message without granting a character. Leaving before completion preserves the pending story. Story availability depends on the configured CMS/backend.

Island saves use the separate `living-test-solo:<profile-or-local>` namespace; legacy save adoption is disabled. Request progress uses version 2. Garden receipts use version 3, with separate watering and ready times. Reloading or time away advances only watered crops and never collects rewards automatically. Upgrades preserve ripe crops, earned coins and completed tasks; old automatic regrowth becomes thirsty. The friend receipt records each voyage step so reloads cannot skip collection or placement. Older unlocked Adam receipts and previously built structures are retained. The first-friend handoff has its own profile-scoped receipt; claiming the completed story reward also adds Adam to the app’s ordinary collection. Earlier prototype saves and ordinary island saves are preserved.

Validation:

```sh
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
npm run living-test:build
python homeworld/tests/living-test-browser.py
# Or individually, in this order:
python homeworld/tests/living-garden-browser.py
python homeworld/tests/player-actions-browser.py
python homeworld/tests/original-world-browser.py
python homeworld/tests/original-story-browser.py
```

The browser check uses disposable storage, Chromium and CMS fixtures to exercise the app bridge. Its garden helper moves only already-watered growth timestamps into the past to simulate elapsed offline time; dry patches are never watered or rewarded by the helper. Rule tests verify each full growth duration and harvest boundary. Software rendering is reduced only inside that test; it does not measure phone performance. The live CMS is not validated by the fixture check.

The original world App renders its vertical icon controls, Build catalogue and construction previews, Actions/Farm/Decorate tabs, bag, map, and day/night clock. The separate Tools and Zoom buttons are hidden for this test iteration. The small tutorial remains a transparent overlay and yields to original menus. A lightweight child rig supports the original gathering, mining and construction animations. Tutorial buildings can be moved or removed using the original Build controls. Only unlocked friends can join construction crews. Market is separate from Build: buy seeds/animals, name animals, and sell collected produce or materials.

Perry guidance and Adam greetings use the existing ElevenLabs-backed `/api/tts/generate` service. Perry uses the existing onboarding voice ID; Adam prefers the CMS reward’s voice ID, with the existing Adam fallback. There is no browser-speech substitute. Backend availability and actual voice audio require live testing.

The repeatable animal loop, confirmation rules, prices, personal greetings and automatic watch camera are documented in [LIVING-FARM.md](LIVING-FARM.md).

`living-garden-browser.py` covers the opening garden, optional friend, original vertical controls on portrait and landscape phones, named purchases, failed-save recovery and reload. The restored story regression covers the original reader, quiz, Try It, actual treasure digging, return ship and Adam placement using CMS fixtures. Voice checks assert the requested configured IDs; they do not certify live ElevenLabs audio. Repository-wide `tsc --noEmit` has existing errors; the production preview build is the build gate.


The six playable scouts share a sculpted cartoon model between the rotating avatar picker, profile portraits and island. The reference-style harbor picker, new wooden Godly Kids logo, WebP art pipeline, mobile/iPad layouts and rotation controls are documented in [HARBOR-AVATARS.md](HARBOR-AVATARS.md). Broad beveled hair, expressive brows, tapered faces, colorful irises, neckerchiefs and chunky boots keep the shapes readable on phones. Each design stays below 30,000 triangles and is generated locally; no extra model downloads are needed. Existing avatar IDs, profile choices, tool bones, walking and carry animations stay compatible. Portrait requests use an artwork revision while saved profile identifiers remain stable. Regenerate PNG/WebP portraits with `python scripts/render-living-avatar-portraits.py` against the local Vite authoring server.

The child crouches to scatter seeds and pat the soil, lifts and tips a watering can with visible droplets, and pulls vegetables up with both hands. Digging and chopping bend and turn the upper body independently of the legs, with planted feet and the original tool impacts. These lightweight motions use the existing tools and local geometry. Starter planting and picking finish after their visible action; leaving mid-action cancels without paying or granting progress. `player-actions-browser.py` checks actual starter planting, cancellation, ordinary digging/planting/watering, axe swings, tool cleanup and resource commits.
