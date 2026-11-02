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

The latest artwork uses isolated generated images for meals, pantry ingredients
and station signs. Source atlases are retained for verification only. A separate illustrated kitchen backs the recipe,
activity and reward screens. These views pause hidden 3D rendering. The room
resumes when the child returns to walking. All artwork is local to the app and
requires no image-generation service connection during play.
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
- Try Fish and Chips: cut the potato slab lengthwise along three guides. Each
  cut should produce a long fry on the small tray; the last cut produces the
  final two strips and continues to fish preparation after a short result pause.
- Swipe the fish in any direction. One clear swipe should be accepted during
  movement, even when released beyond the bowl. The fish turns automatically,
  both check marks fill, and the chef walks to the oven without another tap. Batter is provided by the station; saved ingredient costs stay
  fish and potatoes. A tap or a swipe over the counter must not coat the fish.
- At the oven, grab the loaded tray at its edge as well as its centre. It should
  follow the finger without jumping. A drop on the counter should return it;
  entering the opening should snap it onto the shelf. The tray remains visible
  briefly before the door automatically closes and starts cooking.
- Repeat each interaction using its large button. The same food transformations
  and completion screens must appear. Leaving during the door animation must
  clear its timer; reopening lets the child finish the saved recipe safely.
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
- Confirm no full icon sheets appear while the knife or tutorial hand moves,
  and no neighboring meal appears beside the finished fish-and-chips image. Check recipe selection with missing ingredients, and
  inspect the small ingredient icons and pantry counts on a narrow phone.
- Return from the illustrated recipe picker and every cooking close-up to
  confirm the chef's 3D room resumes, including a continued station journey.

## Automated validation

`node --test homeworld/tests/cooking.test.mjs homeworld/tests/egg-cooking.test.mjs homeworld/tests/kitchen-navigation.test.mjs homeworld/tests/fish-chips-gestures.test.mjs homeworld/tests/fish-chips-transitions.test.mjs homeworld/tests/kitchen-art-assets.test.mjs`

Tests cover every recipe journey, reloads, arrival gating, readiness, duplicate
collection, and routes avoiding every counter footprint. Existing cooking tests
cover escrow, cancellation, persistence failures, nutrition and gesture geometry.
Fish-and-chips tests reject crosswise cuts and taps, accept batter overshoots,
and check that grabbing a tray off-centre still targets the tray's centre.
Transition tests cover automatic flipping/advancing and cancellation; asset
tests compare every delivered tile to its source pixels and dimensions.
Browser rendering and touch layout still require manual review.
