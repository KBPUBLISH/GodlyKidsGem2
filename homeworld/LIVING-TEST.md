# Living together on the original island

Testing branch: `codex/living-world-player-test`. This opt-in mode retains the original island, models, navigation, camera and illustrated button styles. Normal island behavior and published bundles remain unchanged.

Use Node 22+ and `npm ci`. Build with `npm run living-test:build`, then run `npm run dev`. Open `/#/my-home?livingTest=1` in the app. The separate `homeworld/dev-test.config.js` server on port 5190 supports island rendering only; the story handoff requires the full app. Localhost is not a phone-accessible hosted preview.

The child starts without Bible friends, with a small teal avatar and 10 private farm coins. The first choice is to buy and name a chicken; the camp task follows. Tap to walk; nearby task supplies collect automatically, and standing on a delivery circle deposits them. There is no joystick and Bible characters cannot be possessed. The camp task is personal: gather three logs and confirm building a camp using the original building system.

Completing the camp offers “Let’s collect your first friend!” The child can keep exploring or open the app’s first published story pack and read. Accepting the invitation does not grant a friend. Finishing a nonempty story in the real reader collects Adam through the existing reward service and returns to the island. Only Adam appears, with a welcome and later requests for carrots and home-building supplies. Eve and Noah remain absent. Adam acts autonomously while the child controls their own avatar.

The handoff is bound to the active profile, island and story. Unavailable story content shows a retry message without granting a character. Leaving before completion preserves the pending story. Story availability depends on the configured CMS/backend.

Island saves use the separate `living-test-solo:<profile-or-local>` namespace; legacy save adoption is disabled. Request progress uses version 2. The first-friend handoff has its own profile-scoped receipt; successful reading also adds Adam to the app’s ordinary collection. Earlier prototype saves and ordinary island saves are preserved.

Validation:

```sh
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
npm run living-test:build
python homeworld/tests/living-test-browser.py
```

The browser check uses disposable storage, Chromium and CMS fixtures to exercise the app bridge. Software rendering is reduced only inside that test; it does not measure phone performance. The live CMS is not validated by the fixture check.

The usability pass adds a single guided action, progressive menus, immediate pickup progress, compact milestone cards, a visible picnic, and access to the existing home interior. First-friend reading skips the scene/start screens and uses the existing saved reading level or child age. The player model remains procedural but now has rounded features, expressive eyes, clothing detail and jointed motion. See [KIDS-PLAYTEST.md](KIDS-PLAYTEST.md) for findings and the next gameplay priorities.

The repeatable animal loop, confirmation rules, prices, personal greetings and automatic watch camera are documented in [LIVING-FARM.md](LIVING-FARM.md).
