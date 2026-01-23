/**
 * Avatar Configuration
 * 
 * This file defines the available avatar parts and their sources.
 * Parts can be either:
 * - 'file': SVG loaded from /public/avatars/ folder
 * - 'inline': SVG defined in AvatarAssets.tsx (legacy)
 * 
 * Pricing structure:
 * - isPremium: true = Subscriber only (locked for free users)
 * - isPremium: false/undefined = Available to all (purchasable with coins)
 * - price: 0 = Free for everyone
 * - ~30% of items are available for non-subscribers (coins)
 * - ~70% of items are premium (subscribers only)
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
  isPremium?: boolean;  // true = Subscribers only, false/undefined = Available to all
}

// Base path for avatar SVG files
export const AVATAR_BASE_PATH = '/avatars';

// ============================================
// HEADS (18 items: 6 non-premium, 12 premium)
// ============================================
export const HEAD_PARTS: AvatarPartConfig[] = [
  // === NON-PREMIUM (Available to all - 30%) ===
  { id: 'head-bear-brown', name: 'Brown Bear', source: 'inline', price: 0, category: 'animals' }, // FREE
  { id: 'head-toast', name: 'Toast', source: 'inline', price: 0, category: 'funny' }, // FREE
  { id: 'head-burger', name: 'Burger', source: 'inline', price: 50, category: 'funny' },
  { id: 'head-cookie', name: 'Cookie', source: 'inline', price: 50, category: 'funny' },
  { id: 'head-dog-pug', name: 'Pug', source: 'inline', price: 75, category: 'animals' },
  { id: 'head-cat-orange', name: 'Orange Cat', source: 'inline', price: 75, category: 'animals' },
  
  // === PREMIUM (Subscribers only - 70%) ===
  { id: 'head-tv', name: 'TV', source: 'inline', price: 50, category: 'funny', isPremium: true },
  { id: 'head-slime', name: 'Slime', source: 'inline', price: 100, category: 'funny', isPremium: true },
  { id: 'head-pumpkin', name: 'Pumpkin', source: 'inline', price: 100, category: 'funny', isPremium: true },
  { id: 'head-earth', name: 'Earth', source: 'inline', price: 150, category: 'space', isPremium: true },
  { id: 'head-moon', name: 'Moon', source: 'inline', price: 150, category: 'space', isPremium: true },
  { id: 'head-bomb', name: 'Bomb', source: 'inline', price: 200, category: 'funny', isPremium: true },
  { id: 'head-eye', name: 'Eye', source: 'inline', price: 200, category: 'funny', isPremium: true },
  { id: 'head-bear-polar', name: 'Polar Bear', source: 'inline', price: 100, category: 'animals', isPremium: true },
  { id: 'head-bear-aviator', name: 'Aviator Bear', source: 'inline', price: 200, category: 'animals', isPremium: true },
  { id: 'head-dog-dalmatian', name: 'Dalmatian', source: 'inline', price: 100, category: 'animals', isPremium: true },
  { id: 'head-cat-black', name: 'Black Cat', source: 'inline', price: 100, category: 'animals', isPremium: true },
  { id: 'head-lizard', name: 'Lizard', source: 'inline', price: 150, category: 'animals', isPremium: true },
];

// ============================================
// HATS (21 items: 7 non-premium, 14 premium)
// ============================================
export const HAT_PARTS: AvatarPartConfig[] = [
  // === NON-PREMIUM (Available to all - 30%) ===
  { id: 'hat-crown', name: 'Crown', source: 'inline', price: 0 }, // FREE
  { id: 'hat-propeller', name: 'Propeller', source: 'inline', price: 50 },
  { id: 'hat-cone', name: 'Party Cone', source: 'inline', price: 50 },
  { id: 'hat-party', name: 'Party', source: 'inline', price: 50 },
  { id: 'hat-cap-backwards', name: 'Cap Backwards', source: 'inline', price: 50 },
  { id: 'hat-beanie', name: 'Beanie', source: 'inline', price: 75 },
  { id: 'hat-pirate', name: 'Pirate', source: 'inline', price: 100 },
  
  // === PREMIUM (Subscribers only - 70%) ===
  { id: 'hat-viking', name: 'Viking', source: 'inline', price: 100, isPremium: true },
  { id: 'hat-cowboy', name: 'Cowboy', source: 'inline', price: 100, isPremium: true },
  { id: 'hat-sombrero', name: 'Sombrero', source: 'inline', price: 150, isPremium: true },
  { id: 'hat-brain', name: 'Brain', source: 'inline', price: 200, isPremium: true },
  { id: 'hat-poo', name: 'Poo', source: 'inline', price: 100, isPremium: true },
  { id: 'hat-astronaut', name: 'Astronaut', source: 'inline', price: 200, isPremium: true },
  { id: 'hat-chef', name: 'Chef', source: 'inline', price: 100, isPremium: true },
  { id: 'hat-tophat', name: 'Top Hat', source: 'inline', price: 150, isPremium: true },
  { id: 'hat-flowers', name: 'Flowers', source: 'inline', price: 100, isPremium: true },
  { id: 'hat-ninja', name: 'Ninja', source: 'inline', price: 150, isPremium: true },
  { id: 'hat-jester', name: 'Jester', source: 'inline', price: 150, isPremium: true },
  { id: 'hat-afro', name: 'Afro', source: 'inline', price: 100, isPremium: true },
  { id: 'hat-grad', name: 'Graduation', source: 'inline', price: 150, isPremium: true },
  { id: 'hat-headphones', name: 'Headphones', source: 'inline', price: 100, isPremium: true },
];

// ============================================
// BODIES (19 items: 6 non-premium, 13 premium)
// ============================================
export const BODY_PARTS: AvatarPartConfig[] = [
  // === NON-PREMIUM (Available to all - 30%) ===
  { id: 'body-robot', name: 'Robot', source: 'inline', price: 0 }, // FREE
  { id: 'body-overalls', name: 'Overalls', source: 'inline', price: 50 },
  { id: 'body-hoodie', name: 'Hoodie', source: 'inline', price: 50 },
  { id: 'body-tshirt-logo', name: 'T-Shirt Logo', source: 'inline', price: 50 },
  { id: 'body-dress', name: 'Dress', source: 'inline', price: 75 },
  { id: 'body-hawaiian', name: 'Hawaiian', source: 'inline', price: 100 },
  
  // === PREMIUM (Subscribers only - 70%) ===
  { id: 'body-suit', name: 'Super Suit', source: 'inline', price: 100, isPremium: true },
  { id: 'body-tux', name: 'Tuxedo', source: 'inline', price: 150, isPremium: true },
  { id: 'body-hotdog', name: 'Hot Dog', source: 'inline', price: 100, isPremium: true },
  { id: 'body-skeleton', name: 'Skeleton', source: 'inline', price: 150, isPremium: true },
  { id: 'body-armor', name: 'Armor', source: 'inline', price: 200, isPremium: true },
  { id: 'body-donut', name: 'Donut', source: 'inline', price: 100, isPremium: true },
  { id: 'body-muscle', name: 'Muscle', source: 'inline', price: 100, isPremium: true },
  { id: 'body-ghost', name: 'Ghost', source: 'inline', price: 150, isPremium: true },
  { id: 'body-puffer', name: 'Puffer', source: 'inline', price: 100, isPremium: true },
  { id: 'body-king-robe', name: 'King Robe', source: 'inline', price: 200, isPremium: true },
  { id: 'body-jester', name: 'Jester', source: 'inline', price: 150, isPremium: true },
  { id: 'body-karate', name: 'Karate', source: 'inline', price: 100, isPremium: true },
  { id: 'body-space-suit', name: 'Space Suit', source: 'inline', price: 200, isPremium: true },
];

// ============================================
// LEFT ARMS / WINGS (20 items: 6 non-premium, 14 premium)
// ============================================
export const LEFT_ARM_PARTS: AvatarPartConfig[] = [
  // === NON-PREMIUM (Available to all - 30%) ===
  { id: 'arm-l-robot', name: 'Robot', source: 'inline', price: 0 }, // FREE
  { id: 'arm-l-box', name: 'Box', source: 'inline', price: 50 },
  { id: 'arm-l-wing', name: 'Wing', source: 'inline', price: 75 },
  { id: 'arm-l-muscle', name: 'Muscle', source: 'inline', price: 100 },
  { id: 'arm-l-hook', name: 'Hook', source: 'inline', price: 100 },
  { id: 'arm-l-leaf', name: 'Leaf', source: 'inline', price: 100 },
  
  // === PREMIUM (Subscribers only - 70%) ===
  { id: 'arm-l-tentacle', name: 'Tentacle', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-l-crab', name: 'Crab Claw', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-l-zombie', name: 'Zombie', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-l-wing-dragon', name: 'Dragon Wing', source: 'inline', price: 200, isPremium: true },
  { id: 'arm-l-cactus', name: 'Cactus', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-l-slime', name: 'Slime', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-l-skeleton-fancy', name: 'Skeleton Fancy', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-l-drill', name: 'Drill', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-l-baguette', name: 'Baguette', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-l-wing-angel', name: 'Angel Wing', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-l-glove-boxing', name: 'Boxing Glove', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-l-claw-monster', name: 'Monster Claw', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-l-wand', name: 'Wand', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-l-shield', name: 'Shield', source: 'inline', price: 150, isPremium: true },
];

// ============================================
// RIGHT ARMS / WINGS (20 items: 6 non-premium, 14 premium)
// ============================================
export const RIGHT_ARM_PARTS: AvatarPartConfig[] = [
  // === NON-PREMIUM (Available to all - 30%) ===
  { id: 'arm-r-robot', name: 'Robot', source: 'inline', price: 0 }, // FREE
  { id: 'arm-r-box', name: 'Box', source: 'inline', price: 50 },
  { id: 'arm-r-wing', name: 'Wing', source: 'inline', price: 75 },
  { id: 'arm-r-muscle', name: 'Muscle', source: 'inline', price: 100 },
  { id: 'arm-r-hook', name: 'Hook', source: 'inline', price: 100 },
  { id: 'arm-r-leaf', name: 'Leaf', source: 'inline', price: 100 },
  
  // === PREMIUM (Subscribers only - 70%) ===
  { id: 'arm-r-tentacle', name: 'Tentacle', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-r-crab', name: 'Crab Claw', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-r-zombie', name: 'Zombie', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-r-wing-dragon', name: 'Dragon Wing', source: 'inline', price: 200, isPremium: true },
  { id: 'arm-r-cactus', name: 'Cactus', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-r-slime', name: 'Slime', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-r-skeleton-fancy', name: 'Skeleton Fancy', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-r-drill', name: 'Drill', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-r-baguette', name: 'Baguette', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-r-wing-angel', name: 'Angel Wing', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-r-glove-boxing', name: 'Boxing Glove', source: 'inline', price: 100, isPremium: true },
  { id: 'arm-r-claw-monster', name: 'Monster Claw', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-r-wand', name: 'Wand', source: 'inline', price: 150, isPremium: true },
  { id: 'arm-r-shield', name: 'Shield', source: 'inline', price: 150, isPremium: true },
];

// ============================================
// LEGS / FEET (20 items: 6 non-premium, 14 premium)
// ============================================
export const LEGS_PARTS: AvatarPartConfig[] = [
  // === NON-PREMIUM (Available to all - 30%) ===
  { id: 'legs-wheels', name: 'Wheels', source: 'inline', price: 0 }, // FREE
  { id: 'legs-chicken', name: 'Chicken', source: 'inline', price: 50 },
  { id: 'legs-jeans', name: 'Jeans', source: 'inline', price: 50 },
  { id: 'legs-shorts', name: 'Shorts', source: 'inline', price: 50 },
  { id: 'legs-boots-rain', name: 'Rain Boots', source: 'inline', price: 50 },
  { id: 'legs-skates', name: 'Roller Skates', source: 'inline', price: 100 },
  
  // === PREMIUM (Subscribers only - 70%) ===
  { id: 'legs-rocket', name: 'Rocket', source: 'inline', price: 150, isPremium: true },
  { id: 'legs-mermaid', name: 'Mermaid', source: 'inline', price: 150, isPremium: true },
  { id: 'legs-spider', name: 'Spider', source: 'inline', price: 100, isPremium: true },
  { id: 'legs-peg', name: 'Peg Leg', source: 'inline', price: 100, isPremium: true },
  { id: 'legs-ufo', name: 'UFO', source: 'inline', price: 200, isPremium: true },
  { id: 'legs-ghost', name: 'Ghost', source: 'inline', price: 100, isPremium: true },
  { id: 'legs-ballerina', name: 'Ballerina', source: 'inline', price: 100, isPremium: true },
  { id: 'legs-springs', name: 'Springs', source: 'inline', price: 100, isPremium: true },
  { id: 'legs-tail-mermaid-pink', name: 'Pink Mermaid', source: 'inline', price: 150, isPremium: true },
  { id: 'legs-hoverboard', name: 'Hoverboard', source: 'inline', price: 200, isPremium: true },
  { id: 'legs-cloud', name: 'Cloud', source: 'inline', price: 150, isPremium: true },
  { id: 'legs-elf', name: 'Elf', source: 'inline', price: 100, isPremium: true },
  { id: 'legs-karate', name: 'Karate', source: 'inline', price: 100, isPremium: true },
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

/**
 * Get non-premium parts (available to all users)
 */
export function getNonPremiumParts(type: AvatarPartType): AvatarPartConfig[] {
  return getPartsForType(type).filter(p => !p.isPremium);
}

/**
 * Get premium parts (subscribers only)
 */
export function getPremiumParts(type: AvatarPartType): AvatarPartConfig[] {
  return getPartsForType(type).filter(p => p.isPremium);
}

/**
 * Get free parts (price = 0)
 */
export function getFreeParts(type: AvatarPartType): AvatarPartConfig[] {
  return getPartsForType(type).filter(p => p.price === 0);
}
