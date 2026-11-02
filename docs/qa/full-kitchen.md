# Full kitchen playthrough

The kitchen fills the viewport. A persistent chef walks between pantry, prep,
simmering, oven, and serving counters. Tap a counter or focus its button and
press Enter to travel; the highlighted counter is the next recipe destination.
The reference-inspired layout uses timber, parchment, sunny windows, a floating
recipe checklist and golden floor arrows. The recipe picker has three large
selectable meal cards and one start button. Arriving at a preparation station
opens a large worktop close-up; Back to kitchen returns to the room without
discarding completed cuts or completed recipe steps. The persistent side panel
has been replaced by a small bottom task card while walking.
Walking uses an open central aisle to avoid the counters. Reduced-motion mode
places the chef directly at the chosen counter. Recipe transactions and saved
step indices are unchanged, including existing oven and cooking saves.

## Manual checks

- Open a completed Starter Kitchen. The pantry displays the actual bag; recipes
  with enough ingredients are highlighted and missing ones cannot start. Select
  each card, including an unavailable recipe, and check the missing ingredients
  and the single start button. Explore my kitchen should dismiss the picker;
  tapping the pantry should reopen it.
- Choose Pumpkin Stew, walk to prep, and make three downward cuts (or use the
  tap button). Walk to simmering, pour, then stir. The room stays visible.
- Try Garden Omelette: prep to crack eggs, simmering to mix and pour.
- Try Fish and Chips: prep potatoes and fish, then walk to the oven and bake.
- While walking, retarget a different station. The chef should use the aisle
  and only open the activity at the correct counter. No timer punishes walking.
  Golden arrows should point along the safe aisle to the next recipe station.
- During an activity, Back to kitchen should reveal the room. Reopen the same
  counter to continue. Recipe selection and close-up views should prevent focus
  or clicks reaching the room's station buttons behind them.
- Once cooking finishes, walk to serving. Serve once, eat or share, or keep the
  meal in the bag. Cook again points back to the pantry.
- Cancel during preparation or cooking; ingredients return exactly once.
- Close and reopen mid-recipe. Completed steps and ingredients remain saved;
  walk from the pantry to the indicated station to continue.
- Check desktop, phone portrait and landscape, keyboard Tab/Enter/Escape,
  reduced motion, and the station-button fallback when WebGL is unavailable.

## Automated validation

`node --test homeworld/tests/cooking.test.mjs homeworld/tests/egg-cooking.test.mjs homeworld/tests/kitchen-navigation.test.mjs`

Tests cover every recipe journey, reloads, arrival gating, readiness, duplicate
collection, and routes avoiding every counter footprint. Existing cooking tests
cover escrow, cancellation, persistence failures, nutrition and gesture geometry.
Browser rendering and touch layout still require manual review.
