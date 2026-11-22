# Friends World cooking — testing branch

Worktree: `/Volumes/EpoxyDev/GodlyKids-cooking`
Branch: `codex/living-world-player-test`
Base: `ecf5e1f3` (contains the existing island fixes).
Deployment: **not pushed or deployed**. Main was not changed.

## Feature

Build → Farm → Stone Oven uses the existing placement, collision, materials and crew construction rules (20 stone, 6 clay, one builder, one island day; starter tent required). Tap the completed building → Open. Existing manna/fire controls remain reachable from the recipe chooser.

- Pumpkin Stew: pumpkin 1 + carrot 1; slice, add, stir; 5 seconds; 55 energy.
- Garden Omelette: eggs 2 + carrot 1; crack, mix, pour; 5 seconds; 45 energy.
- Fish and Chips: fish 1 + potato 2; slice, prepare, bake; 6 seconds; 60 energy.
- Meals use the existing food, energy, hunger, bag and dining systems. Share lists welcomed island friends. No additional construction stations are required.
- Potato seeds cost 2 coins per packet of 3. Potatoes use the existing planted/watered/growing/harvested plot rules, with procedural crop models and local icons; they sell for 3 coins each. Parent-app sell prices agree.
- Cooking definitions include ingredients, reusable station/action steps, duration, meal, energy and minimum oven level. `cookingLevel` provides a future duration/unlock hook; upgrade purchasing and future recipes are not part of this release.

## Persistence rules

Cooking is part of the existing child-scoped GameStore save. Starting atomically reserves ingredients and records their original inventory/farm bag. A monotonic session sequence rejects stale starts; each preparation step requires the expected session and step index. Collection atomically credits one meal and marks the receipt collected. Eating/sharing from the reward screen marks that receipt used. Cancelling refunds escrow once; closing the screen or reloading keeps the job. Taking down the oven also refunds unfinished escrow. Failed writes never expose new inventory balances. Existing GameStore revision checks handle competing tabs.

The 3D close-up caps its canvas at 1.5 DPR / 30fps, releases resources on close and stops rendering while the document is hidden. The island continues simulating, with its background render capped at 20fps while the kitchen is open. Reduced motion and tap/keyboard alternatives are included. Images and models are local; no artwork service is required at runtime.

## Validation evidence

- App production build passed (`VITE_LIVING_TEST=1 npm run build`).
- Final island production build passed (`npm run homeworld:build`); packaged with `node scripts/build-living-test.mjs`.
- 32 focused tests passed: cooking, egg cooking, market, garden templates and goal expansion.
- Full island suite: 226 tests, 222 passed, 4 baseline failures. All four reproduced separately in the unchanged original checkout: two coop-move tests require a browser `window`; recipes test expects old garden-salad energy; sell-prices test expects the obsolete separate 500-coin wallet. No cooking regression in that suite.
- Browser: desktop in-app browser at 430×932 and 820×1180. These are responsive checks, **not physical iPhone/iPad tests**.
- Built an oven from the actual Build menu in an isolated QA profile: observed stone 60→40, clay 18→12, energy 100→95, building→complete. Construction time was advanced using an explicit QA-only control invoking the existing community construction simulation. Tapped its 3D model, selected Open, and saw all three recipes.
- Stew: three pointer swipes, drag into pot, circular pointer-event replay, reload at step 3, collect and eat. Observed one stew, then zero; energy 20→75.
- Omelette: two taps on eggs, circular pointer-event replay, drag to pan, collect, share with Adam. Meal removed once and Eat/Share disabled afterward.
- Fish and Chips: tablet-sized swipes, slide tray, reload during cooking, collect once. Switching to a second QA child showed no meal/session there; returning to the first retained its saved meal.
- Cancel after partial preparation restored fish 3→4 and potatoes 6→8. Unit tests also cover every cancellation stage, repeat inputs, stale tabs, failed saves, original egg-bag refunds, and dismantling the oven.
- Empty-inventory profile showed all ingredient shortages and disabled all starts. Existing market displayed Potato seeds with correct price/stock. Potato purchase/grow/harvest/sale verified through the real reducers in tests.
- One browser-captured MutationObserver error had no source URL and no matching code in the cooking source; no interaction failure accompanied it. Physical-device verification and an audible sound check remain outstanding.

## Local preview

Generate the explicitly labelled, disposable QA profiles:

```sh
node scripts/local-qa/make-oven-cooking-fixture.mjs
cp .qa-preview/oven-cooking-qa.html dist/oven-cooking-qa.html
python3 -m http.server 5203 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:5203/oven-cooking-qa.html`. The page seeds only its own `living-test-solo:oven-mini-qa-v1-*` namespaces when absent. Buttons for time advance and circular input are QA controls, not shipped UI. Generated fixture HTML stays ignored/local. Production does not auto-fill inventories or shorten construction time.

Local logs and evidence: `.qa-preview/cooking-tests.log`, `cooking-regression.log`, `cooking-baseline-failures.log`, `cooking-app-build.log`, `cooking-island-build.log`.

Unrelated ongoing nine-language story-pack/narration and physical iOS media QA remain outside this cooking change; this work does not mark those tasks complete.
