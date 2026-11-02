# Kitchen artwork

Created with ChatGPT image generation for Godly Kids. These are game assets,
not screenshots. Higgsfield was discovered but was not connected when this set
was made; no Higgsfield attribution or generation claim applies to these files.

- `kitchen-icons.webp`: transparent 4 × 4 atlas, 1254 × 1254. Row-major order:
  fish and chips, pumpkin stew, garden omelette, pantry basket; chopping board,
  red pot, brick oven, serving cloche; pumpkin, carrots, eggs, fish; potatoes,
  chef hat, wooden spoon, achievement star.
- `kitchen-interior.webp`: 1536 × 1024 illustrated kitchen backdrop for the
  recipe picker, cooking close-ups and reward view. The walkable room remains
  the live Three.js scene.

Art direction: softly sculpted storybook forms, honey-colored timber,
terracotta, sage green, ivory ceramics, natural food textures and warm light
from the upper left. No baked-in text or user-interface labels.

Original generated PNGs are retained in the session's `generated_images`
folder. The source atlases are retained for provenance and asset verification.
Delivery files in `icons/` and `actions/` are losslessly extracted, isolated
tiles. `KitchenArt` renders a native image with `object-fit: contain`, and
`CookingActionArt` renders one SVG image per asset. Neither component loads a
whole atlas or depends on nested SVG viewport cropping. This avoids mobile
WebView leaks during transforms and mismatched reward-card aspect ratios.
Vite fingerprints the assets; the standalone preview embeds them as data URLs.

## Cooking action textures

`cooking-actions.webp` is a separate 1254 × 1254 transparent 3 × 3 atlas created
with ChatGPT image generation from the six-screen cooking reference direction.
It contains an uncut potato half, one long fry, a glass batter bowl; a raw
fillet, a battered fillet, a loaded baking tray; an open oven, a kitchen knife,
and a tutorial hand. These are individual sprites, not flattened screenshots.
`CookingActionArt` places them inside the live activity SVG; cutting masks,
food movement, coating, tray hit areas and progress remain interactive.
