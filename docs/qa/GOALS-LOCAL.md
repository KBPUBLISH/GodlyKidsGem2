# Local adventure goals playtest

November 1, 2026. Based on testing branch 04ac4156. Onboarding work is owned by another agent and was not edited here.

Open http://127.0.0.1:5188/ while the local server is running. The test harness uses only the `goals-local` profile on this separate local origin. It starts after introductory tasks, with a small snack supply, so goal selection can be tested independently of onboarding. It never resets an existing test save on reload. No production account, saves or wallet are used.

Implemented: illustrated three-choice goal picker, confirmation, one pinned next task, real gameplay counters, Show me actions, task details, goal switching with retained progress, durable completion celebration, and next-goal selection. Initial goals: garden, wood/snack and fishing. Completed goals unlock building projects; cottage/church also require an existing home. Actual catalog quantities are used. Existing finished buildings satisfy construction goals. No additional coins are minted by this feature.

Goal source is isolated in adventure-goals.mjs/.jsx/.css. main.jsx adds the entry button and integration. Goal progress is stored as adventureGoals in the existing scoped island save. No tutorial receipts, starter-task rules, character assets or farm capacity were modified.

Run (with repository dependencies installed):

    node --test homeworld/tests/adventure-goals.test.mjs homeworld/tests/living-farm.test.mjs
    node node_modules/vite/bin/vite.js build --config homeworld/vite.config.js --configLoader runner
    node scripts/local-qa/make-goal-fixture.mjs
    python3 scripts/local-qa/serve-goals.py

The current development folder uses the existing project's node_modules via a symlink; no dependency changes are included. Browser server is loopback-only on port 5188.

Verified: 11 targeted tests pass (7 goals, 4 farm); game build passes. Desktop browser completed real tree chopping 0/3 → 1/3 → 2/3 → 3/3, reload restored 2/3, snack advanced to completion, and next choices excluded the completed goal and included the hut. 390×844 picker/completion and active card visually checked. Screenshot: outputs/my-goals-local.png in the parent QA workspace. This is desktop browser testing, not physical-device validation. Garden/fishing/building goals have unit coverage but their full browser playthroughs remain pending.

Broader baseline: the first full game test run passed 128/129; recipes.test.mjs already disagrees with the upstream garden_salad energy (72 versus 52). Recipe files were not edited. One MutationObserver Node-type error was captured during browser navigation/inspection, with no source attribution or visible gameplay failure; the same inspection-related symptom was recorded in earlier QA. Do not claim zero browser errors.

Startup compatibility: upstream world.js imported nonexistent deckHeight from building.mjs, preventing the game build. A separate local fix removes that unfinished built-harbour helper reference while retaining fishing-pier height handling. It does not implement harbour navigation; review/reconcile this compatibility patch with the other agent's dock work before integration. It is separate from the goal feature patch.

Remaining product work: friend-specific coop and Scripture goal adapters, real goal reward policy, preset-garden placement, upgraded-home cost handling, target-object highlights beyond equipping/opening the right existing controls, and independent nine-language/TTS QA. Existing localization build hooks wrap the new UI copy, but language correctness is not certified by this pass.


2026-11-01 goal expansion (local only): 11 goal choices in a catalog browsed three at a time, with More adventures and Back. New chicken → flock/eggs unlock chain, harvest basket and rocks activities. Grill a fish replaces catch-only with catch → campfire → grill → eat OR share. Old catch receipt is retained and offered as a cooking continuation; its prior catch is not reset. Prepared fish satisfies catch/fire/grill steps. Specific fish-eaten/shared receipts prevent unrelated snacks from completing the goal. Sharing consumes exactly one fish atomically and credits the recipient; repeated action IDs are rejected.

Farm: building a starter coop costs 20 local farm coins and is required before buying chickens (10 coins each). Capacity is 3, upgraded capacity 6 for 40 coins. Legacy chickens receive a starter coop on restoration; no animals or coins are deleted. Egg collection has a separate durable counter. Farm dialog title distinguishes first coop from an upgrade. No onboarding sequence was changed.

Browser verified on desktop: real coop purchase 100→80 coins, chicken purchase 80→70 and goal completion; following flock goal counted 1/3→2/3→3/3 and completed; egg follow-up guided walks collected 2/3 then 3/3 and completed; further goal choices reachable. Separate test-only cooking profiles seeded with one raw fish and a lit campfire verified actual grill animation, then eat and share branches independently; both displayed Adventure complete. These fixtures do not overwrite the goals-local island. Generator: scripts/local-qa/make-cooking-fixture.mjs (optional --eat); generated public/goal-cooking*-qa.html pages are ignored. Fishing catch was previously verified in the browser in be6e0063. This cooking pass starts with a seeded raw fish rather than repeating the full fishing minigame.

33 targeted goals/fishing/farm/garden/player-care checks pass; broad suite retains the pre-existing garden_salad 72 versus 52 failure. Physical iPhone/iPad, nine languages/TTS, full building goal playthroughs remain pending. No pushes or deployments.

2026-11-01 interactive coop: tapping the coop offers Go in / Move. The full-screen coop has illustrated animated hens, individual nest eggs, collection sparkles and a saved basket count. Each tap banks exactly one egg; duplicate/invalid slot taps do nothing. Chicken eggs no longer auto-collect near roaming birds or appear as pickups around the island. Cow collection stays unchanged. Egg goal guidance opens the coop. Legacy ready eggs survive; nest slots persist through restore and production fills only empty slots.

The outdoor coop now has a pen and shared floor/stair heights used by the player and hens. Hens return via the stairs before laying/while eggs await collection, and can wander after collection. Relocation zooms out, snaps to nearby dry open ground, rejects water, crops, trees, rocks and buildings, saves the location without changing hens/eggs, and restores the previous zoom. Completed homes retain Go in / Move; utility buildings now offer Open / Move with their existing panel behavior. The island's render/update loop yields while the opaque coop screen is open, apart from periodic farm/timer updates.

Desktop browser: real egg tap reduced ready eggs 8→7 and saved bag 9→10; another phone tap bag10→11. Reload retained bag count. Coop Go in / Move verified; relocation on isolated coop-qa-v1 displayed Coop moved, then market Collect opened the relocated coop with all nine eggs intact. Portrait 390×844 and landscape 844×390 fit without horizontal/vertical overflow for three hens. Separate generated coop QA profile avoids disturbing the user's ongoing play session; generator scripts/local-qa/make-coop-fixture.mjs, generated page ignored. Shared stair surface and hen routing have unit coverage; physical-device stair traversal is not certified. Broad homeworld tests: 150/151 pass, retaining only the unrelated pre-existing garden_salad 72-vs-52 failure. Seven coop regressions and 21 focused coop/farm/goals/care checks pass. Build succeeds. No pushes/deployments or edits to Cursor's original checkout.
