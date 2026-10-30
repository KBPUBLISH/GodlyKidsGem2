# Living together — test mode on the original island

Branch: `codex/living-world-player-test`. The separate diorama prototype was removed. This implementation uses the existing `HomeWorld` engine, exported terrain/environment, library, paths, crops, houses, Bible character models, navigation, camera, and packaged illustrated buttons.

## Run

Use Node 22+ and the root locked dependencies:

```sh
npm ci
npx vite --config homeworld/dev-test.config.js
```

Open that server's root with `?livingTest=1`. The helper server uses port 5190 and serves original assets directly from `public/homeworld`; it does not overwrite the checked-in published bundles. Without the flag, the regular island runs normally. `npm run homeworld:build` produces the normal island bundle including the opt-in mode. No production deployment or merge is part of this change.

The integrated mode lives at `/homeworld/index.html?livingTest=1` when the rebuilt island is installed at its usual location. Localhost addresses are local validation endpoints, not phone-accessible hosted previews.

## Interaction

- The small teal character is the player's own avatar. Tap land to walk, drag to turn/tilt the original camera, pinch/scroll to zoom, or use WASD/arrows. There is no joystick.
- Adam, Eve, and Noah retain the original character models and autonomous routines. Character possession and external resident/task messages are blocked in this test mode. The player never switches into a Bible character.
- Nearby task supplies collect automatically and appear on the player's backpack. Standing on a glowing delivery circle deposits them one at a time. Partial deliveries persist.
- Three early requests: three logs for Noah, four carrots for Eve, then three flowers for Adam. Noah walks to the actual home site and builds independently while the child continues exploring.
- The reward is the original furnished Small Hut. Its footprint and route obey the real map's placement/navigation rules. The child's three logs represent a contribution; Noah supplies the remaining normal construction materials in this test economy. The flower task decorates the home with existing flower assets.
- The original cream panels, local illustrated icons, Friends pill, and To-do / My bag / Build / Sound button styles are retained. Only the early-game menu contents and layout are simplified. Resident energy/hunger/job dashboards are absent.

## Save isolation

`livingTest=1` forces a `living-test:<profile-or-local>` namespace for island saves, residents, onboarding, goals and request progress. Legacy adoption/migration is disabled in this namespace; ordinary profile behavior remains unchanged. Original world saves are neither copied nor reset. Player position and buildings use the existing GameStore in that private namespace; request receipts use `gk_living_island_requests_v1:<test-scope>`.

This mode is opt-in, not the default application behavior. Original island asset files and the normal published bundles are unchanged. Do not restore the removed diorama as the preview entry point.

## Validation

```sh
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
npm run homeworld:build
python homeworld/tests/living-test-browser.py
```

The optional browser check uses Python Playwright and Chromium, available in this cloud machine, with a disposable profile. It checks the original scene, fixed player identity, autonomous friends, walk/collect/deliver progression, completed hut, original button styles, save isolation, and reload. Physical-device frame rate, full story-friend collection integration, cooking/serving, and the later economy are still outside this slice.
