import type { CSSProperties } from 'react';

/**
 * Default tap-to-fill / coloring palette (kid-friendly + metallics).
 * Fill engine uses solid hex; swatch UI can show metallic gradients via getColorSwatchStyle.
 */
export const DEFAULT_COLORING_PALETTE = [
  '#E74C3C', // red
  '#E67E22', // orange
  '#F1C40F', // yellow
  '#2ECC71', // green
  '#3498DB', // blue
  '#9B59B6', // purple
  '#E91E63', // magenta
  '#1ABC9C', // teal
  '#87CEEB', // light blue
  '#FFB6C1', // pink
  '#8BC34A', // lime
  '#1B4F72', // navy
  '#FFAB91', // peach
  '#95A5A6', // gray
  '#2C3E50', // black
  '#FFFFFF', // white
  '#8D6E63', // brown
  '#D4AF37', // gold
  '#C0C0C0', // silver
  '#CD7F32', // bronze
] as const;

/** Metallic fill hex → shiny gradient for palette swatches only */
const METALLIC_SWATCH_GRADIENTS: Record<string, string> = {
  '#D4AF37':
    'linear-gradient(145deg, #8B6914 0%, #D4AF37 28%, #FFF3B0 48%, #E8C547 62%, #A67C00 100%)',
  '#C0C0C0':
    'linear-gradient(145deg, #6E6E6E 0%, #C0C0C0 28%, #FFFFFF 48%, #D8D8D8 62%, #8A8A8A 100%)',
  '#CD7F32':
    'linear-gradient(145deg, #6B3E1A 0%, #CD7F32 28%, #F0C080 48%, #B87333 62%, #7A4A1E 100%)',
};

const normalizeHex = (hex: string): string => {
  const h = hex.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(h)) return h;
  if (/^#[0-9A-F]{3}$/.test(h)) {
    const [, a, b, c] = h;
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  return h;
};

export const isMetallicColor = (hex: string): boolean =>
  Boolean(METALLIC_SWATCH_GRADIENTS[normalizeHex(hex)]);

/** CSS style for a palette swatch button (metallic shine or flat fill). */
export const getColorSwatchStyle = (hex: string): CSSProperties => {
  const key = normalizeHex(hex);
  const gradient = METALLIC_SWATCH_GRADIENTS[key];
  if (gradient) {
    return {
      backgroundImage: gradient,
      backgroundColor: key,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 2px rgba(0,0,0,0.25)',
    };
  }
  return { backgroundColor: hex };
};
