# Small animal loop in the living-island test

Branch: `codex/living-world-player-test`. Open `/#/my-home?livingTest=1` after `npm run living-test:build`. The island, character assets and illustrated UI stay in the existing world.

A fresh island starts alone, with zero private farm coins and a small fenced garden: one carrot, pumpkin, and cabbage. The child confirms a free expansion, taps to walk and dig three spots, then plants three free seeds. The last planting saves the completion and 10-coin reward together. A chicken is offered afterward; Keep exploring or Not now continues the camp task without buying an animal.

Ripe vegetables can be tapped, or reached with Pick vegetables in the farm panel. Picking sells one for 2 coins and replants it; it grows again after 45 seconds in this prototype. This gives a child with too few coins a reachable way to earn more. Purchases display and charge the same saved farm balance. Animal names are validated before buying, and failed saves leave both coins and ownership unchanged for retry.

Existing animal names, purchases, camp/story/home progress, and coins are preserved. Older adventures that have already collected supplies or bought animals skip the new introductory garden task. Only untouched demo planting is replaced by the small garden; gardens the child has worked on retain their cells.

The first chicken produces an egg after about 20 seconds. Later production repeats every three minutes in this prototype (wall-clock time, including time away). Up to three items wait per animal; there is no starvation or missed-day penalty. Timing is centralized in `living-farm-rules.mjs` so this can be tuned after playtesting. This is a short test cadence, not three real calendar days.

Walk near an animal's nest/collection spot to pick up its produce. The farm drawer offers a Collect button that walks there using the original navigation. Eggs and milk go into My bag, with separate Eat/Drink and Sell choices. Eating celebrates a snack; it does not introduce a hunger meter. Selling changes the private farm coin balance.

| Choice | Cost or reward |
| --- | --- |
| Complete the first garden | +10 coins once |
| Pick and sell one vegetable | +2 coins |
| Chicken | 10 coins |
| Sell one egg | +5 coins |
| First coop (room for four chickens) | 20 coins |
| Bigger coop (room for six chickens) | 40 coins |
| Cow, after first coop | 40 coins |
| Sell one milk | +10 coins |

The small test supports up to six chickens and two cows. Additional story friends still come from reading; farm purchases do not bypass that unlock. Coops are simple visual upgrades at a fixed island spot. Chickens and cows reuse the island's original animated GLB models.

All available major decisions are confirmed: free garden expansion, animal purchase and name, coop upgrades, and using logs to build the camp or home. Delivering build supplies waits for confirmation. Ordinary pickup and individual eat/sell actions stay direct.

Tapping Adam or choosing Say hello walks the child over. Approaching him produces a greeting using the profile's player name (for example, Sarah), with a wave pose and optional device speech when sound is on. Friendly proximity greetings do not interrupt walks to other tasks. Friends remain autonomous and cannot be possessed.

Watch island life rotates the camera among Adam and owned animals. It can be selected from Friends, and begins automatically after 30 seconds without activity once the camp is complete. Dialogs, walking, building confirmations and interiors prevent automatic entry. Back to me resumes the player's camera. Watching never changes the controlled character or moves the player.

Farm receipts use `gk_living_farm_v1:<private-test-profile>`; they never spend the main app's account coins. Purchases persist before animals are reconciled into the original island renderer. Existing test-world and normal-world progress is preserved.

Checks:

```sh
node --test homeworld/tests/*.test.mjs tests/*.test.mjs
npm run living-test:build
python homeworld/tests/living-test-browser.py
python homeworld/tests/living-garden-browser.py
python homeworld/tests/living-garden-migration-browser.py
python homeworld/tests/living-farm-browser.py
```

The first browser test creates `/tmp/kids-polished-completed.json`; the second uses that earned story/home state and tests a fresh farm. `FARM_TEST_SAVE` can select another Playwright storage-state fixture. Production timers are accelerated only inside the second disposable browser. CMS fixtures exercise the existing reader, not the live content service. Phone performance and device speech need device testing.

The garden mobile regression is `python3 homeworld/tests/living-garden-browser.py` against a built preview on port 3000. It exercises partial reloads, reward persistence, skipping the chicken, a saved low balance, harvesting to afford a chicken, rejected invalid names, failed-save recovery, and named-purchase reloads.
