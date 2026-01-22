# Avatar SVG Files

This folder contains SVG files for the avatar customization system.

## Folder Structure

```
/avatars/
├── heads/        - Head SVGs
├── hats/         - Hat SVGs  
├── bodies/       - Body/Torso SVGs
├── feet/         - Legs/Feet SVGs
├── wings-left/   - Left Wing/Arm SVGs
├── wings-right/  - Right Wing/Arm SVGs
└── README.md     - This file
```

## Adding New Avatar Parts

### Step 1: Add Your SVG File

Place your SVG file in the appropriate folder:

- **Heads** → `/heads/your-head.svg`
- **Hats** → `/hats/your-hat.svg`
- **Bodies** → `/bodies/your-body.svg`
- **Feet** → `/feet/your-feet.svg`
- **Left Wings** → `/wings-left/your-wing.svg`
- **Right Wings** → `/wings-right/your-wing.svg`

### Step 2: Register in AvatarConfig.tsx

Open `/components/avatar/AvatarConfig.tsx` and add an entry to the appropriate array:

```typescript
// Example: Adding a new head
export const HEAD_PARTS: AvatarPartConfig[] = [
  // Add your new head here:
  { 
    id: 'head-angel',           // Unique ID (use this format: type-name)
    name: 'Angel',              // Display name in shop
    source: 'file',             // 'file' for SVG files
    filePath: 'heads/angel.svg', // Path relative to /public/avatars/
    price: 100,                 // Gold coin price (0 = free)
    category: 'biblical'        // Optional category
  },
  // ... existing parts
];
```

### Step 3: SVG Requirements

For best results, your SVG should:

1. **ViewBox**: Use `viewBox="0 0 100 100"` for consistent sizing
2. **No external resources**: All styles should be inline
3. **Transparent background**: Don't include a background rectangle
4. **Centered content**: Position your artwork centered in the viewBox

### Example SVG Template

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- Your artwork here -->
  <circle cx="50" cy="50" r="40" fill="#FFD700" stroke="#B8860B" stroke-width="2"/>
</svg>
```

## ViewBox Guidelines by Part Type

| Part Type | Recommended ViewBox |
|-----------|-------------------|
| Heads | `0 0 100 100` |
| Hats | `0 0 100 80` |
| Bodies | `0 0 100 80` |
| Feet/Legs | `0 0 100 60` |
| Wings (Left/Right) | `0 0 50 100` |

## Pricing Guidelines

| Price | Rarity |
|-------|--------|
| 0 | Free / Starter |
| 50 | Common |
| 100 | Uncommon |
| 150 | Rare |
| 200+ | Epic |

## Testing

After adding a new part:

1. Run the app locally: `npm run dev`
2. Go to the Avatar Shop
3. Find your new part and verify it displays correctly
4. Test it on the avatar compositor
