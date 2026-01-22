/**
 * Avatar Configuration
 * 
 * This file defines the available avatar parts and their sources.
 * Parts can be either:
 * - 'file': SVG loaded from /public/avatars/ folder
 * - 'inline': SVG defined in AvatarAssets.tsx (legacy)
 * 
 * To add new avatar parts:
 * 1. Add your SVG file to the appropriate folder in /public/avatars/
 * 2. Add an entry to the corresponding array below
 * 
 * Folder structure:
 * /public/avatars/
 *   ├── heads/        (Head SVGs)
 *   ├── hats/         (Hat SVGs)
 *   ├── bodies/       (Body SVGs)
 *   ├── feet/         (Legs/Feet SVGs)
 *   ├── wings-left/   (Left Wing/Arm SVGs)
 *   └── wings-right/  (Right Wing/Arm SVGs)
 */

export type AvatarPartType = 'head' | 'hat' | 'body' | 'leftArm' | 'rightArm' | 'legs';

export interface AvatarPartConfig {
  id: string;           // Unique identifier (e.g., 'head-angel')
  name: string;         // Display name
  source: 'file' | 'inline';
  filePath?: string;    // Path relative to /public/avatars/ (for file source)
  price?: number;       // Gold coin price (0 = free)
  category?: string;    // Sub-category for organization
  isLocked?: boolean;   // Requires unlock
}

// Base path for avatar SVG files
export const AVATAR_BASE_PATH = '/avatars';

// ============================================
// HEADS
// ============================================
export const HEAD_PARTS: AvatarPartConfig[] = [
  // === FILE-BASED HEADS (Add your new heads here) ===
  // Example:
  // { id: 'head-angel', name: 'Angel', source: 'file', filePath: 'heads/angel.svg', price: 0 },
  // { id: 'head-star', name: 'Star', source: 'file', filePath: 'heads/star.svg', price: 50 },
  
  // === LEGACY INLINE HEADS (from AvatarAssets.tsx) ===
  { id: 'head-toast', name: 'Toast', source: 'inline', price: 0, category: 'funny' },
  { id: 'head-burger', name: 'Burger', source: 'inline', price: 0, category: 'funny' },
  { id: 'head-tv', name: 'TV', source: 'inline', price: 50, category: 'funny' },
  { id: 'head-cookie', name: 'Cookie', source: 'inline', price: 50, category: 'funny' },
  { id: 'head-slime', name: 'Slime', source: 'inline', price: 100, category: 'funny' },
  { id: 'head-pumpkin', name: 'Pumpkin', source: 'inline', price: 100, category: 'funny' },
  { id: 'head-earth', name: 'Earth', source: 'inline', price: 150, category: 'space' },
  { id: 'head-moon', name: 'Moon', source: 'inline', price: 150, category: 'space' },
  { id: 'head-bomb', name: 'Bomb', source: 'inline', price: 200, category: 'funny' },
  { id: 'head-eye', name: 'Eye', source: 'inline', price: 200, category: 'funny' },
  { id: 'head-bear-brown', name: 'Brown Bear', source: 'inline', price: 0, category: 'animals' },
  { id: 'head-bear-polar', name: 'Polar Bear', source: 'inline', price: 100, category: 'animals' },
  { id: 'head-bear-aviator', name: 'Aviator Bear', source: 'inline', price: 200, category: 'animals' },
  { id: 'head-dog-pug', name: 'Pug', source: 'inline', price: 50, category: 'animals' },
  { id: 'head-dog-dalmatian', name: 'Dalmatian', source: 'inline', price: 100, category: 'animals' },
  { id: 'head-cat-orange', name: 'Orange Cat', source: 'inline', price: 50, category: 'animals' },
  { id: 'head-cat-black', name: 'Black Cat', source: 'inline', price: 100, category: 'animals' },
  { id: 'head-lizard', name: 'Lizard', source: 'inline', price: 150, category: 'animals' },
];

// ============================================
// HATS
// ============================================
export const HAT_PARTS: AvatarPartConfig[] = [
  // === FILE-BASED HATS (Add your new hats here) ===
  // Example:
  // { id: 'hat-halo', name: 'Halo', source: 'file', filePath: 'hats/halo.svg', price: 0 },
  
  // === LEGACY INLINE HATS ===
  { id: 'hat-crown', name: 'Crown', source: 'inline', price: 0 },
  { id: 'hat-pirate', name: 'Pirate', source: 'inline', price: 50 },
  { id: 'hat-viking', name: 'Viking', source: 'inline', price: 100 },
  { id: 'hat-propeller', name: 'Propeller', source: 'inline', price: 50 },
  { id: 'hat-cowboy', name: 'Cowboy', source: 'inline', price: 100 },
  { id: 'hat-cone', name: 'Party Cone', source: 'inline', price: 50 },
  { id: 'hat-sombrero', name: 'Sombrero', source: 'inline', price: 150 },
  { id: 'hat-brain', name: 'Brain', source: 'inline', price: 200 },
  { id: 'hat-poo', name: 'Poo', source: 'inline', price: 100 },
  { id: 'hat-astronaut', name: 'Astronaut', source: 'inline', price: 200 },
  { id: 'hat-chef', name: 'Chef', source: 'inline', price: 100 },
  { id: 'hat-party', name: 'Party', source: 'inline', price: 50 },
  { id: 'hat-tophat', name: 'Top Hat', source: 'inline', price: 150 },
  { id: 'hat-flowers', name: 'Flowers', source: 'inline', price: 100 },
  { id: 'hat-ninja', name: 'Ninja', source: 'inline', price: 150 },
  { id: 'hat-cap-backwards', name: 'Cap Backwards', source: 'inline', price: 50 },
  { id: 'hat-beanie', name: 'Beanie', source: 'inline', price: 50 },
  { id: 'hat-jester', name: 'Jester', source: 'inline', price: 150 },
  { id: 'hat-afro', name: 'Afro', source: 'inline', price: 100 },
  { id: 'hat-grad', name: 'Graduation', source: 'inline', price: 150 },
  { id: 'hat-headphones', name: 'Headphones', source: 'inline', price: 100 },
];

// ============================================
// BODIES
// ============================================
export const BODY_PARTS: AvatarPartConfig[] = [
  // === FILE-BASED BODIES (Add your new bodies here) ===
  // Example:
  // { id: 'body-robe', name: 'Robe', source: 'file', filePath: 'bodies/robe.svg', price: 0 },
  
  // === LEGACY INLINE BODIES ===
  { id: 'body-robot', name: 'Robot', source: 'inline', price: 0 },
  { id: 'body-suit', name: 'Super Suit', source: 'inline', price: 100 },
  { id: 'body-tux', name: 'Tuxedo', source: 'inline', price: 150 },
  { id: 'body-hotdog', name: 'Hot Dog', source: 'inline', price: 100 },
  { id: 'body-skeleton', name: 'Skeleton', source: 'inline', price: 150 },
  { id: 'body-armor', name: 'Armor', source: 'inline', price: 200 },
  { id: 'body-donut', name: 'Donut', source: 'inline', price: 100 },
  { id: 'body-dress', name: 'Dress', source: 'inline', price: 100 },
  { id: 'body-overalls', name: 'Overalls', source: 'inline', price: 50 },
  { id: 'body-muscle', name: 'Muscle', source: 'inline', price: 100 },
  { id: 'body-ghost', name: 'Ghost', source: 'inline', price: 150 },
  { id: 'body-hawaiian', name: 'Hawaiian', source: 'inline', price: 100 },
  { id: 'body-puffer', name: 'Puffer', source: 'inline', price: 100 },
  { id: 'body-hoodie', name: 'Hoodie', source: 'inline', price: 50 },
  { id: 'body-tshirt-logo', name: 'T-Shirt Logo', source: 'inline', price: 50 },
  { id: 'body-king-robe', name: 'King Robe', source: 'inline', price: 200 },
  { id: 'body-jester', name: 'Jester', source: 'inline', price: 150 },
  { id: 'body-karate', name: 'Karate', source: 'inline', price: 100 },
  { id: 'body-space-suit', name: 'Space Suit', source: 'inline', price: 200 },
];

// ============================================
// LEFT ARMS / WINGS
// ============================================
export const LEFT_ARM_PARTS: AvatarPartConfig[] = [
  // === FILE-BASED LEFT WINGS (Add your new wings here) ===
  // Example:
  // { id: 'arm-l-feather', name: 'Feather Wing', source: 'file', filePath: 'wings-left/feather.svg', price: 0 },
  
  // === LEGACY INLINE LEFT ARMS ===
  { id: 'arm-l-robot', name: 'Robot', source: 'inline', price: 0 },
  { id: 'arm-l-muscle', name: 'Muscle', source: 'inline', price: 100 },
  { id: 'arm-l-tentacle', name: 'Tentacle', source: 'inline', price: 150 },
  { id: 'arm-l-hook', name: 'Hook', source: 'inline', price: 100 },
  { id: 'arm-l-crab', name: 'Crab Claw', source: 'inline', price: 150 },
  { id: 'arm-l-zombie', name: 'Zombie', source: 'inline', price: 100 },
  { id: 'arm-l-wing', name: 'Wing', source: 'inline', price: 100 },
  { id: 'arm-l-wing-dragon', name: 'Dragon Wing', source: 'inline', price: 200 },
  { id: 'arm-l-cactus', name: 'Cactus', source: 'inline', price: 100 },
  { id: 'arm-l-box', name: 'Box', source: 'inline', price: 50 },
  { id: 'arm-l-slime', name: 'Slime', source: 'inline', price: 100 },
  { id: 'arm-l-skeleton-fancy', name: 'Skeleton Fancy', source: 'inline', price: 150 },
  { id: 'arm-l-drill', name: 'Drill', source: 'inline', price: 150 },
  { id: 'arm-l-baguette', name: 'Baguette', source: 'inline', price: 100 },
  { id: 'arm-l-wing-angel', name: 'Angel Wing', source: 'inline', price: 150 },
  { id: 'arm-l-glove-boxing', name: 'Boxing Glove', source: 'inline', price: 100 },
  { id: 'arm-l-claw-monster', name: 'Monster Claw', source: 'inline', price: 150 },
  { id: 'arm-l-leaf', name: 'Leaf', source: 'inline', price: 100 },
  { id: 'arm-l-wand', name: 'Wand', source: 'inline', price: 150 },
  { id: 'arm-l-shield', name: 'Shield', source: 'inline', price: 150 },
];

// ============================================
// RIGHT ARMS / WINGS
// ============================================
export const RIGHT_ARM_PARTS: AvatarPartConfig[] = [
  // === FILE-BASED RIGHT WINGS (Add your new wings here) ===
  // Example:
  // { id: 'arm-r-feather', name: 'Feather Wing', source: 'file', filePath: 'wings-right/feather.svg', price: 0 },
  
  // === LEGACY INLINE RIGHT ARMS ===
  { id: 'arm-r-robot', name: 'Robot', source: 'inline', price: 0 },
  { id: 'arm-r-muscle', name: 'Muscle', source: 'inline', price: 100 },
  { id: 'arm-r-tentacle', name: 'Tentacle', source: 'inline', price: 150 },
  { id: 'arm-r-hook', name: 'Hook', source: 'inline', price: 100 },
  { id: 'arm-r-crab', name: 'Crab Claw', source: 'inline', price: 150 },
  { id: 'arm-r-zombie', name: 'Zombie', source: 'inline', price: 100 },
  { id: 'arm-r-wing', name: 'Wing', source: 'inline', price: 100 },
  { id: 'arm-r-wing-dragon', name: 'Dragon Wing', source: 'inline', price: 200 },
  { id: 'arm-r-cactus', name: 'Cactus', source: 'inline', price: 100 },
  { id: 'arm-r-box', name: 'Box', source: 'inline', price: 50 },
  { id: 'arm-r-slime', name: 'Slime', source: 'inline', price: 100 },
  { id: 'arm-r-skeleton-fancy', name: 'Skeleton Fancy', source: 'inline', price: 150 },
  { id: 'arm-r-drill', name: 'Drill', source: 'inline', price: 150 },
  { id: 'arm-r-baguette', name: 'Baguette', source: 'inline', price: 100 },
  { id: 'arm-r-wing-angel', name: 'Angel Wing', source: 'inline', price: 150 },
  { id: 'arm-r-glove-boxing', name: 'Boxing Glove', source: 'inline', price: 100 },
  { id: 'arm-r-claw-monster', name: 'Monster Claw', source: 'inline', price: 150 },
  { id: 'arm-r-leaf', name: 'Leaf', source: 'inline', price: 100 },
  { id: 'arm-r-wand', name: 'Wand', source: 'inline', price: 150 },
  { id: 'arm-r-shield', name: 'Shield', source: 'inline', price: 150 },
];

// ============================================
// LEGS / FEET
// ============================================
export const LEGS_PARTS: AvatarPartConfig[] = [
  // === FILE-BASED FEET (Add your new feet here) ===
  // Example:
  // { id: 'legs-sandals', name: 'Sandals', source: 'file', filePath: 'feet/sandals.svg', price: 0 },
  
  // === LEGACY INLINE LEGS ===
  { id: 'legs-wheels', name: 'Wheels', source: 'inline', price: 0 },
  { id: 'legs-chicken', name: 'Chicken', source: 'inline', price: 50 },
  { id: 'legs-rocket', name: 'Rocket', source: 'inline', price: 150 },
  { id: 'legs-mermaid', name: 'Mermaid', source: 'inline', price: 150 },
  { id: 'legs-spider', name: 'Spider', source: 'inline', price: 100 },
  { id: 'legs-peg', name: 'Peg Leg', source: 'inline', price: 100 },
  { id: 'legs-ufo', name: 'UFO', source: 'inline', price: 200 },
  { id: 'legs-skates', name: 'Roller Skates', source: 'inline', price: 100 },
  { id: 'legs-ghost', name: 'Ghost', source: 'inline', price: 100 },
  { id: 'legs-ballerina', name: 'Ballerina', source: 'inline', price: 100 },
  { id: 'legs-jeans', name: 'Jeans', source: 'inline', price: 50 },
  { id: 'legs-shorts', name: 'Shorts', source: 'inline', price: 50 },
  { id: 'legs-springs', name: 'Springs', source: 'inline', price: 100 },
  { id: 'legs-boots-rain', name: 'Rain Boots', source: 'inline', price: 50 },
  { id: 'legs-tail-mermaid-pink', name: 'Pink Mermaid', source: 'inline', price: 150 },
  { id: 'legs-hoverboard', name: 'Hoverboard', source: 'inline', price: 200 },
  { id: 'legs-cloud', name: 'Cloud', source: 'inline', price: 150 },
  { id: 'legs-elf', name: 'Elf', source: 'inline', price: 100 },
  { id: 'legs-karate', name: 'Karate', source: 'inline', price: 100 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all parts for a specific type
 */
export function getPartsForType(type: AvatarPartType): AvatarPartConfig[] {
  switch (type) {
    case 'head': return HEAD_PARTS;
    case 'hat': return HAT_PARTS;
    case 'body': return BODY_PARTS;
    case 'leftArm': return LEFT_ARM_PARTS;
    case 'rightArm': return RIGHT_ARM_PARTS;
    case 'legs': return LEGS_PARTS;
    default: return [];
  }
}

/**
 * Get the full file path for a file-based avatar part
 */
export function getAvatarFilePath(part: AvatarPartConfig): string | null {
  if (part.source !== 'file' || !part.filePath) return null;
  return `${AVATAR_BASE_PATH}/${part.filePath}`;
}

/**
 * Check if a part is file-based
 */
export function isFileBased(partId: string): boolean {
  const allParts = [
    ...HEAD_PARTS,
    ...HAT_PARTS,
    ...BODY_PARTS,
    ...LEFT_ARM_PARTS,
    ...RIGHT_ARM_PARTS,
    ...LEGS_PARTS,
  ];
  const part = allParts.find(p => p.id === partId);
  return part?.source === 'file';
}

/**
 * Get part config by ID
 */
export function getPartById(partId: string): AvatarPartConfig | undefined {
  const allParts = [
    ...HEAD_PARTS,
    ...HAT_PARTS,
    ...BODY_PARTS,
    ...LEFT_ARM_PARTS,
    ...RIGHT_ARM_PARTS,
    ...LEGS_PARTS,
  ];
  return allParts.find(p => p.id === partId);
}

/**
 * Get file-based parts only (for new avatar system)
 */
export function getFileBasedParts(type: AvatarPartType): AvatarPartConfig[] {
  return getPartsForType(type).filter(p => p.source === 'file');
}

/**
 * Get all part IDs for a type
 */
export function getPartIds(type: AvatarPartType): string[] {
  return getPartsForType(type).map(p => p.id);
}
