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
