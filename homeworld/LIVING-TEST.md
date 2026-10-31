# Living together on the original island

Testing branch: `codex/living-world-player-test`. This opt-in mode retains the original island, models, navigation, camera and illustrated button styles. Normal island behavior and published bundles remain unchanged.

Use Node 22+ and `npm ci`. Build with `npm run living-test:build`, then run `npm run dev`. Open `/#/my-home?livingTest=1` in the app. The separate `homeworld/dev-test.config.js` server on port 5190 supports island rendering only; the story handoff requires the full app. Localhost is not a phone-accessible hosted preview.

The child starts without Bible friends, using their chosen avatar, with a small fenced garden and zero private farm coins. The first task is a free garden expansion: dig three spots and plant three seeds to earn 10 coins. Buying and naming a chicken is an optional next step; the camp task remains available without a purchase. Tap to walk; nearby task supplies collect automatically, and standing on a delivery circle deposits them. There is no joystick and Bible characters cannot be possessed. The camp task is personal: gather three logs and confirm building a camp using the original building system.

Completing the camp opens a short “Meet Adam” invitation. The child can keep exploring or open the app’s first published story pack and read. Accepting the invitation does not grant a friend. Finishing a nonempty story in the real reader collects Adam through the existing reward service and returns to the island. Only Adam appears, with a welcome and later requests for carrots and home-building supplies. Eve and Noah remain absent. Adam acts autonomously while the child controls their own avatar.

The handoff is bound to the active profile, island and story. Unavailable story content shows a retry message without granting a character. Leaving before completion preserves the pending story. Story availability depends on the configured CMS/backend.

Island saves use the separate `living-test-solo:<profile-or-local>` namespace; legacy save adoption is disabled. Request progress uses version 2. The first-friend handoff has its own profile-scoped receipt; successful reading also adds Adam to the app’s ordinary collection. Earlier prototype saves and ordinary island saves are preserved.

Validation:

```sh
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
npm run living-test:build
python homeworld/tests/living-test-browser.py
```

The browser check uses disposable storage, Chromium and CMS fixtures to exercise the app bridge. Software rendering is reduced only inside that test; it does not measure phone performance. The live CMS is not validated by the fixture check.

The island uses compact illustrated action buttons and progress dots instead of a persistent task card. Dig, Plant, Pick, and Bring actions are reachable from the top button or a nearby icon marker. Empty bag and farm controls stay hidden during the first garden steps. The ear button reads the current task, including the solo garden, on devices with speech support. Short reward chips, visible changes to the garden, and pickup counts supply feedback. On-demand bottom sheets keep purchases, names, costs, free garden expansion, and building confirmations explicit while leaving the world visible above them. The picnic and existing home interior remain available. First-friend reading skips the scene/start screens and uses the existing saved reading level or child age. The player model remains procedural but now has rounded features, expressive eyes, clothing detail and jointed motion. See [KIDS-PLAYTEST.md](KIDS-PLAYTEST.md) for findings and the next gameplay priorities.

The repeatable animal loop, confirmation rules, prices, personal greetings and automatic watch camera are documented in [LIVING-FARM.md](LIVING-FARM.md).

`living-garden-browser.py` checks portrait phones at 390×844 and 320×740 plus 844×390 landscape. Opening controls must cover less than 15% of the viewport, with touch targets at least 44px. It exercises the map icon, spoken prompt dispatch, partial-save recovery, optional chicken, and purchase confirmation. `living-test-browser.py` checks the complete story/Adam/home loop using accessible action names even when the visible label is shorter.
