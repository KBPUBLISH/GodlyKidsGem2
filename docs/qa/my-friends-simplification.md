# My Friends: simplification review for ages 7–10

Recommendation: keep the expressive island and Bible friends, but make the child's job **choose, help, and create**. Let the residents manage routine logistics. The main problem is the number of concepts a child must understand to achieve something, not simply the number of buttons.

This is a design proposal grounded in source inspection and the browser QA recorded in this chat. It is not a completed redesign or a study with children. The accompanying clickable concept demonstrates the proposed interaction model; its timing, economy and content are illustrative.

## What is already worth keeping

- A living island with recognizable friends who move, work and speak.
- Direct actions that produce visible results: tap a ripe crop, watch a friend walk there, see food enter the bag. This worked in QA.
- Creative ownership of gardens and building locations, and the new overhead placement view.
- Character collection through Bible stories, welcoming a friend ashore, and cooperative activities.
- A forgiving world in which exploration and decoration can remain enjoyable after the guided task ends.

## Evidence and diagnosis

| Current behavior observed in UI or source | Why it creates friction | Proposed change |
|---|---|---|
| Persistent ship exit, sound, day/time, journey badge, Friends, to-do, bag, map, zoom, build and tools, plus selected-character controls | Several different places appear to offer the next thing to do | Three primary menus: Friends, Build, Bag; one current-goal card; ship exit and sound remain small utilities |
| Selected character exposes watch, chat, eat, pray, task and about controls around the character | Controls compete with the island and can cover objects | Tap a friend to open one short card: Talk, Help, Play as; other information is optional |
| Build catalog exposes Homes, Community, Storage, Gardens, Paths, Fences and Decorations and many unavailable items | The child has to discover a viable choice through a catalog of blockers | Initially show three useful choices with one recommended; later reveal themes and optional advanced pieces |
| Separate hunger and energy percentages; hunger changes work speed | Two invisible upkeep systems explain why a simple action stops or slows | Remove hunger as a mandatory progression constraint; residents eat/rest autonomously, while sharing meals stays an optional play activity |
| Construction includes builder counts, work/rest phases, material costs and island-day timing | Starting a house becomes a scheduling problem | Child chooses the house and location; available friends help automatically; show progress as visible construction stages |
| Current project model includes Small Hut ≈10 min and Church ≈70 min nominal durations | A meaningful early reward may fall outside a short play session; actual timing also depends on crew behavior | Prototype a first shelter finished in 30–60 seconds after preparation; reserve longer projects for optional later play. These are tuning hypotheses, not validated targets |
| First Camp milestone includes 10 people and 500 food produced | The displayed large goal is distant from a child's next action | First visible milestone: welcome one friend, grow one garden, finish one shelter; retain large community totals only as later achievements |
| Wood has storage capacity; advanced materials include mud, water, clay and concrete bricks | Storage and crafting prerequisites can interrupt an unrelated goal | Automatic basic-resource storage; wood/stone first, advanced recipes only inside relevant later activities |
| Tap/drag behavior and camera modes change with character selection and placement | The same gesture can mean something different without an obvious reason | Regular play: tap to walk/interact, drag to pan, pinch to zoom. Placement: explicit overhead mode with Preview, Place and Cancel |
| “Place” and “Add as goal” coexist on every building card | Child must understand two routes to the same desired outcome | One “Build this” action; if resources are missing, offer “Find wood” with a visible destination |
| More detailed resident decisions and a foreman choose or reject sites/jobs | Rules can feel arbitrary when the rejection arrives after a choice | Validate before commitment; mark valid spots visibly, show one plain-language reason and a useful next action |

The recent Sound/progress-badge overlap demonstrates how crowded the HUD already is. Its local CSS fix improves access but does not solve the larger interaction problem.

## Proposed core loop

**Meet a friend → choose a small project → help directly → see the island change → choose what comes next.**

One suggested task is visible at a time, but the child may dismiss it and explore. The task must name both the outcome and the immediate action. Prefer “Tap three carrots” to “Develop the settlement.” On completion, show the actual result and one warm acknowledgement. Do not immediately replace every success with another urgent request.

A first-session example, proposed for testing:

1. Adam arrives. One sentence introduces him; welcome does not require reading a profile sheet.
2. Adam asks for three carrots. The three crops visibly indicate they are ready. A tap walks to and harvests the crop automatically.
3. Food visibly enters the shared bag. Adam thanks the player. No energy or hunger lesson yet.
4. Child chooses a small shelter or garden decoration from two pictures. Supplies for this first project are guaranteed.
5. Overhead placement shows a short list of clear spaces; a large ghost preview follows the selection. Place confirms; Cancel returns unchanged.
6. Friends build together with visible stages. Child can help or explore while they work.
7. End with “Your island has a new home.” Offer free play or a choice of two next activities. Returning later resumes safely without a penalty for absence.

The timing goal is a meaningful result within the first few minutes, not a rigid timer that pressures the child.

## Screen and navigation

- **Island:** most of the screen remains the world. Top-left Ship, top-right Sound. One compact goal card with a replayable hint. Bottom menu: Friends, Build, Bag.
- **Friends:** portraits and names, current friendly activity, and a clear selection. A card offers Talk, Help, Play as. Strengths can appear under “About”; omit weakness ratings from the default card.
- **Build:** three large illustrated choices at first, two columns on phones when there are more choices. Each has a short name and only relevant costs. One next step per card. More complex upgrades unlock progressively instead of filling the first screen with locked items.
- **Bag:** Food, Materials, Decorations. Display quantity, and actions only where useful. Move recipes to the cooking place rather than making the bag a dashboard of every system.
- **Context action:** tap a tree → friend walks and chops; tap a ripe crop → harvest; tap a garden bed → choose a seed. Infer the tool. If there are multiple sensible actions, show at most three clearly labeled choices next to the object.
- **Placement:** overhead view only while placing; ghost footprint large enough to see; valid/invalid cues use shapes/text as well as color; no material charge until Place. Permit moving early structures without a resource penalty.
- **Map/zoom:** secondary controls, not equal-weight primary navigation. Keep a visible zoom/reset option for children who cannot or do not use pinch gestures.

## Mechanics: keep, automate, delay

**Keep in the child's hands:** choosing what to create, where it goes, which friend to play with, gathering/harvesting, decoration, optional cooking/fishing, story discovery, and gentle trade-offs between appealing choices.

**Automate:** tool selection, pathfinding, basic worker selection, routine meals/rest, simple storage, ordinary replanting when explicitly assigned, and safe recovery after interruption. Automation should be understandable: “Noah is bringing wood” rather than an opaque progress bar.

**Delay:** multi-step crafting, manual worker assignment, large population targets, advanced fencing, large building catalogs and long projects. Introduce a feature after a successful related action, with one optional demonstration.

**Remove from the default progression loop:** starvation slowdowns, overlapping hunger/energy gauges, repeated food/rest chores needed just to keep playing, and technical work schedules. Do not erase existing saved resources or buildings; simplify how they are presented and used.

**Market:** preserve a simple, reversible selling interaction. Tap a stall, choose one surplus item, preview quantity and reward, sell, then show the receipt/Undo where feasible. Do not silently sell supplies reserved for the current project. Keep real-money purchase flows separate from routine pretend trading. Browser-integrated market transactions remain an open QA item; this is a proposed interaction, not a verified existing behavior.

**Bible and prayer:** make faith part of the activity and the relationship, for example sharing harvest or hearing why a friend helps. Prayer should be available for reflection, not required to refill a stamina meter. The existing prayer-energy reward should be reviewed as part of that change; preserving a gentle optional prayer activity is preferable to making it a gate.

## Age range, language and accessibility

7–10 crosses different reading skills and levels of game experience. Use one shared interface with optional assistance, rather than assuming every seven-year-old needs the same help or every ten-year-old is experienced. Initial instructions should be short, visible and replayable as speech; speech must never be the only route. Hints may become more explicit after repeated unsuccessful actions, without labeling the child as failing.

Proposed design acceptance criteria: primary targets at least 48 CSS pixels, main instruction text around 18 CSS pixels on phones, no essential information conveyed solely by color, no hover-only controls, all dialogs with clear close/back, reduced-motion support, and text that wraps without clipping in all nine languages. These are project targets to verify, not claims that the current game meets them.

Keep characters, lighting and art appealing to older children. Simplify navigation and rules rather than making the whole game look preschool-oriented. More experienced players should be able to skip narration and enter creative play immediately.

## Mobile quality and performance

Use a stable camera to reduce gesture errors; put speech and options in one reusable panel rather than multiple continuously updating overlays. Reuse the current island renderer and assets. Avoid a new video background or added post-processing just to decorate menus. Pause expensive offscreen rendering where appropriate and pause/reconcile simulation when the app is backgrounded without inventing completed work.

Measure actual frame times, heat, memory and touch response on the iPhone 15 Plus and an iPad. Desktop resizing is useful for layout, but is not evidence of mobile frame-rate quality. Do not lower all render resolution as a substitute for profiling; retain adaptive quality and inspect sharpness at device pixel ratio.

## Implementation order and save safety

1. **One coherent navigation layer.** One task card, three menus, contextual actions. Retain the existing simulation underneath. Isolated feature flag; preserve old navigation for rollback while testing.
2. **First-session loop.** First friend, first harvest, first build. Guarantee a viable action and a short visible success. Make incomplete-session resumption explicit.
3. **Mechanics simplification.** Remove upkeep gates from the new mode, automate crews, rebalance early requirements. Test no-worker/no-resource, interrupted work, full storage and return-after-absence cases.
4. **Creative depth.** Unlock decoration and advanced building after the basic loop. Give a route back to free exploration at every step.
5. **Nine-language and device checks.** Test text, voice, loading, touch and layout before rollout.

Cursor currently has overlapping edits in onboarding and My Friends. Land this as an isolated change set, not a broad rewrite of active files. Existing worlds must retain inventory, characters, coins, placed structures and earned construction progress. Apply new timing rules prospectively or migrate earned progress proportionally; never simply reset a project. Distinguish UI feature flags from economy changes so rollback cannot duplicate rewards.

## Child usability test plan

Run short, consented sessions with a small initial group split between ages 7–8 and 9–10, including different reading and game experience. Suggested first round: 4–6 children in each band, used for finding problems, not statistical proof. Parent permission and child assent; avoid recording names or recordings unnecessarily.

Ask them to: help a friend, harvest food, find the bag, start a shelter, cancel/move a placement, return after closing, and choose their own next activity. Give goals, not instructions explaining which button to tap. Observe where adult help becomes necessary.

Proposed release gates: at least 80% in each band finish the first harvest and first placement without adult explanation; no unrecoverable dead ends or lost saves; all can stop or return to the island; children can explain what they built and why. Compare against the current version and revise based on observed behavior. Small-group results are directional; do not claim validated suitability for all children.

## Research basis

NN/g's original research recommends clear, specific goals and visible/audible demonstrations, and cautions that children of different ages have different needs. This supports the direction, not the exact three-menu count or proposed timings, which are design hypotheses for Godly Kids.

- [Designing for Kids: Cognitive Considerations](https://www.nngroup.com/articles/kids-cognition/)
- [Children’s UX: Usability Issues in Designing for Young People](https://www.nngroup.com/articles/childrens-websites-usability-issues/)

## Deliverables and limits

Clickable concept: my-friends-simple.html. It demonstrates harvest → success → optional building placement, three primary menus and replayable guidance. It does not alter the real game, charge real coins, save player progress, or implement the proposed simulation changes. No child usability testing has occurred yet.

## Concept verification — 2026-10-30

Tested in the desktop in-app browser, including 430 × 932 and 320 × 812 viewport sizes:

- Harvest all three crops; progress and completion message update; picked crops cannot be harvested twice.
- Friends/Help and Bag open and return to the island; Bag shows the collected quantity.
- Building choice opens placement; Place stays disabled until a site is selected.
- Selection shows an asset preview; Cancel returns without placing; confirming creates the chosen item.
- Occupied sites cannot be reused; the two-site practice island reports when it is full.
- Placement hint displays visible instructions; Escape closes the menu.
- No horizontal overflow at 320 CSS pixels; no captured browser console errors during the checks.

The screenshot is `my-friends-simple-preview.png`. The concept uses simplified placeholder scenery and existing building icons; it is an interaction proposal, not final island artwork. Speech uses an optional browser voice for demonstration; translated character narration, all nine languages, real-device performance, and child usability are not established by these checks.
