# Living together on the original island

Testing branch: `codex/living-world-player-test`. This opt-in mode retains the original island, models, navigation, camera and illustrated button styles. Normal island behavior and published bundles remain unchanged.

Use Node 22+ and `npm ci`. Build with `npm run living-test:build`, then run `npm run dev`. Open `/#/my-home?livingTest=1` in the app. The separate `homeworld/dev-test.config.js` server on port 5190 supports island rendering only; the story handoff requires the full app. Localhost is not a phone-accessible hosted preview.

The child starts alone with their chosen avatar and a small fenced garden. The free opening task highlights three individual grid squares: tap any available square to dig, then plant three seeds. Completion earns 10 private farm coins. The next goal is three fallen logs for the first prayer tent. The starter tent has a three-log introductory cost; its completed building uses the normal catalogue receipt. Tap to walk and automatically collect nearby supplies. Building still requires confirmation. The separate Market button offers seeds and optional named animals; a chicken never blocks the opening.

The tent celebration offers “Add a friend?” with Yes and No. Yes returns to the crew ship. Tapping the first island opens the original IslandScenePage background and bottom activity board. Its Read Story button opens the original lesson hub, reader, quiz and Try It sequence. After all activities present in the pack are complete, the original buried-treasure game reveals the CMS rewards and Adam. Continue returns to the ship; My community returns to the world for explicit placement. No leaves the world open for exploring and a later invitation. Only the child is controllable.

The handoff is bound to the active profile, island and story. Unavailable story content shows a retry message without granting a character. Leaving before completion preserves the pending story. Story availability depends on the configured CMS/backend.

Island saves use the separate `living-test-solo:<profile-or-local>` namespace; legacy save adoption is disabled. Request progress uses version 2. The friend receipt records each voyage step so reloads cannot skip collection or placement. Older unlocked Adam receipts and previously built structures are retained. The first-friend handoff has its own profile-scoped receipt; claiming the completed story reward also adds Adam to the app’s ordinary collection. Earlier prototype saves and ordinary island saves are preserved.

Validation:

```sh
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
npm run living-test:build
python homeworld/tests/living-test-browser.py
# Or individually, in this order:
python homeworld/tests/living-garden-browser.py
python homeworld/tests/original-world-browser.py
python homeworld/tests/original-story-browser.py
```

The browser check uses disposable storage, Chromium and CMS fixtures to exercise the app bridge. Software rendering is reduced only inside that test; it does not measure phone performance. The live CMS is not validated by the fixture check.

The original world App renders its vertical icon controls, Build catalogue and construction previews, Actions/Farm/Decorate tabs, bag, map, and day/night clock. The separate Tools and Zoom buttons are hidden for this test iteration. The small tutorial remains a transparent overlay and yields to original menus. A lightweight child rig supports the original gathering, mining and construction animations. Tutorial buildings can be moved or removed using the original Build controls. Only unlocked friends can join construction crews. Market is separate from Build: buy seeds/animals, name animals, and sell collected produce or materials.

Perry guidance and Adam greetings use the existing ElevenLabs-backed `/api/tts/generate` service. Perry uses the existing onboarding voice ID; Adam prefers the CMS reward’s voice ID, with the existing Adam fallback. There is no browser-speech substitute. Backend availability and actual voice audio require live testing.

The repeatable animal loop, confirmation rules, prices, personal greetings and automatic watch camera are documented in [LIVING-FARM.md](LIVING-FARM.md).

`living-garden-browser.py` covers the opening garden, optional friend, original vertical controls on portrait and landscape phones, named purchases, failed-save recovery and reload. The restored story regression covers the original reader, quiz, Try It, actual treasure digging, return ship and Adam placement using CMS fixtures. Voice checks assert the requested configured IDs; they do not certify live ElevenLabs audio. Repository-wide `tsc --noEmit` has existing errors; the production preview build is the build gate.
