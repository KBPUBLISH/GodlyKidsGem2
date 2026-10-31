# Living together on the original island

Testing branch: `codex/living-world-player-test`. This opt-in mode retains the original island, models, navigation, camera and illustrated button styles. Normal island behavior and published bundles remain unchanged.

Use Node 22+ and `npm ci`. Build with `npm run living-test:build`, then run `npm run dev`. Open `/#/my-home?livingTest=1` in the app. The separate `homeworld/dev-test.config.js` server on port 5190 supports island rendering only; the story handoff requires the full app. Localhost is not a phone-accessible hosted preview.

The child starts alone with their chosen avatar and a small fenced garden. The free opening task highlights three individual grid squares: tap any available square to dig, then plant three seeds. Completion earns 10 private farm coins. The next goal is three fallen logs for the first prayer tent. The starter tent has a three-log introductory cost; its completed building uses the normal catalogue receipt. Tap to walk and automatically collect nearby supplies. Building still requires confirmation. The farm menu becomes available after the tent, with optional named animals; a chicken never blocks the opening.

The tent celebration is followed by “Add a friend?” with Yes and No. No leaves the island open for exploring, farming and a later invitation. Yes returns to the crew ship. Perry points to the first island; tapping it sails to a short story-pack introduction. Reading the matching nonempty story enables an explicit “Collect Adam” reward. Claiming it returns to the ship, where Perry offers “My community”. Back in the world, Adam stays hidden until the child taps clear land or the highlighted drop spot. Only then does the welcome and Adam’s carrot/home sequence begin. All Bible friends remain autonomous; only the child can be controlled.

The handoff is bound to the active profile, island and story. Unavailable story content shows a retry message without granting a character. Leaving before completion preserves the pending story. Story availability depends on the configured CMS/backend.

Island saves use the separate `living-test-solo:<profile-or-local>` namespace; legacy save adoption is disabled. Request progress uses version 2. The friend receipt records each voyage step so reloads cannot skip collection or placement. Older unlocked Adam receipts and previously built structures are retained. The first-friend handoff has its own profile-scoped receipt; claiming the completed story reward also adds Adam to the app’s ordinary collection. Earlier prototype saves and ordinary island saves are preserved.

Validation:

```sh
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
npm run living-test:build
python homeworld/tests/living-test-browser.py
python homeworld/tests/living-first-friend-browser.py
python homeworld/tests/living-garden-browser.py
```

The browser check uses disposable storage, Chromium and CMS fixtures to exercise the app bridge. Software rendering is reduced only inside that test; it does not measure phone performance. The live CMS is not validated by the fixture check.

The island uses a vertical rail of illustrated buttons at the right edge, with short transparent task labels and progress dots over the world. Each available garden square has its own highlight and tappable tool icon. Dig, Plant, Pick, and Bring actions are reachable from the top button or a nearby icon marker. Empty bag and farm controls stay hidden during the first garden steps. The ear button reads the current task, including the solo garden, on devices with speech support. Short reward chips, visible changes to the garden, and pickup counts supply feedback. On-demand bottom sheets keep purchases, names, costs, free garden expansion, and building confirmations explicit while leaving the world visible above them. The picnic and existing home interior remain available. The short pack introduction opens the reader directly using the existing saved reading level or child age. The player model remains procedural but now has rounded features, expressive eyes, clothing detail and jointed motion. See [KIDS-PLAYTEST.md](KIDS-PLAYTEST.md) for findings and the next gameplay priorities.

The repeatable animal loop, confirmation rules, prices, personal greetings and automatic watch camera are documented in [LIVING-FARM.md](LIVING-FARM.md).

`living-garden-browser.py` checks portrait phones at 390×844 and 320×740 plus 844×390 landscape. Opening controls must cover less than 15% of the viewport, with touch targets at least 44px. It exercises the map icon, spoken prompt dispatch, partial-save recovery, optional chicken, and purchase confirmation. `living-test-browser.py` checks the complete story/Adam/home loop using accessible action names even when the visible label is shorter.

The final handoff regression resumes an earned tent and checks a failed CMS request, immediate Perry fallback, explicit reward collection, clear placement beside the child, and Adam staying ashore afterward. Repository-wide `tsc --noEmit` still reports existing errors outside this change; the production preview build is the build gate.
