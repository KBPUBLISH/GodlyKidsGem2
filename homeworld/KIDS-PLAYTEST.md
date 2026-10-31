# Island playtest: ages 6–10

Reviewed October 30, 2026, on `codex/living-world-player-test`.

## Scope and evidence

Played the original island’s opt-in opening, menus, solo camp task, first-story handoff, Adam’s arrival, carrot request and house construction in Chromium at a 430 × 932 viewport. The original walkthrough completed with no JavaScript errors. The first run used the actual navigation actions to reach supplies; the revised walkthrough uses the visible goal buttons. The full revised loop passed without JavaScript errors, including the picnic, home interior and return. Layout checks also covered widths of 320 and 820 pixels. Story content is a two-page CMS fixture through the real app reader, not a live-content check. This is an adult usability review and functional playtest, not research with children. Software-rendered timings do not establish phone performance.

## Assessment

The strongest idea is living alongside Bible friends: the child acts, something changes on the island, and a friend responds. Tap-to-walk, proximity pickup and automatic delivery remove unnecessary precision and inventory management. Starting alone gives the child ownership before introducing social requests.

The opening previously taught too much through text and menus. To-do, Bag and Build were available immediately, although Build repeated the current task. The progress display stayed at “0 delivered” while collecting. Two logs were near the edge of the initial phone view. The main help action was hidden inside a drawer. After completing the camp, a full-screen story invitation covered the achievement. The story required invitation → READ STORY → Start → age selection before reaching a page. The carrot task produced little visible payoff. The house completed successfully, but the test-mode UI did not expose the existing interior, and the task sequence ended there.

## Changes in this pass

- One compact illustrated action, with a short label and progress dots. Tap it or the world marker to dig, plant, find supplies or deliver. The persistent text card is removed. No joystick.
- Found-item progress updates during collection, with simple progress dots and pickup feedback. Partial deliveries remain supported.
- Bag and farm use separate pocket buttons after the first garden task. Friends appears after Adam arrives; Visit becomes the main action when the home is ready. Empty initial controls and duplicate home controls are hidden.
- Short optional task narration uses the device’s speech feature. Availability and voice quality depend on the browser/device.
- A brief celebration leaves the camp visible before the invitation. Invitation and welcome use a compact bottom card. Completing the carrots adds a visible picnic with the existing food props.
- The first-friend handoff opens the reading hub directly and begins reading with the saved level or child profile’s age. If neither is available, it asks for an age. Leaving an unfinished reader returns to the island, preserving the pending friend.
- The furnished home is now explorable using the existing interior and an explicit return button.
- The player has rounded proportions, larger expressive eyes, a visible smile, ears, shaped hair, tunic trim, boots and backpack details. Motion includes pivoted limbs, gentle idle movement and blinking. It remains a lightweight procedural prototype; a custom textured, rigged child model is needed to fully match the authored Bible characters.

## Next priorities

1. **Make the loop repeat with variety.** Current content is still a short linear slice. Alternate gathering, planting/growing and making something useful. Keep one active request; let the child choose between two small next adventures after an achievement. Do not turn every neighbor into a simultaneous quest giver.
2. **Make friendship the reward.** Have Adam approach, wave, say a short thank-you and use the thing the child helped create. The picnic in this pass is a visible prop reward, not a synchronized meal animation. Prioritize that shared moment over adding coins or another progress meter.
3. **Add small ownership choices.** After the first home, offer two flower colors, a welcome sign or a seat placement. Unlock these after the child understands walking and collecting. Give choices a visible result on the same island.
4. **Give sessions a satisfying stop.** After one request, show the changed world, a short response from the friend and a clear “we made this” moment. Offer more play without streak pressure, countdowns, penalties for leaving or chores piling up offline.
5. **Finish the player art.** Match the existing models’ painted surfaces, face proportions, hands and soft silhouette with a custom low-poly rigged mesh. Reuse the walk/idle/wave animation conventions. Offer simple appearance choices later. Validate silhouette and expressions at the actual phone camera distance, not only in close-up.
6. **Test on phones and with children.** Check loading, tap-versus-drag mistakes, scenery hiding the player and target, spoken instructions and readable sizes. Observe ages 6–7 separately from 8–10: can they find the first log without adult help, explain what comes next, notice the reward, and choose to continue? Treat a first visible win within roughly a minute as a design target, not a measured result from this environment.

## Intended loop

Notice one need → choose where to walk → collect or grow → bring it back → see the island change → enjoy a response from a friend → choose another small adventure or stop.

Story reading is a special milestone that brings a new friend into that loop. The child should understand who they will meet before leaving the island, and see that friend arrive when they return.

## Garden and first-friend revision

The opening now leads from six total garden squares to a three-log prayer tent, then an optional friend voyage. Buttons are stacked at the side, task captions have transparent backgrounds, and each eligible garden square has its own highlight and action. A new profile-scoped journey saves the ship, pack, reader, reward, return ship and deliberate placement steps. Existing children keep their garden work, structures and unlocked Adam. The regression walkthrough follows the real navigation and reader with CMS fixtures; live CMS content and real-device download times need the hosted phone check.
