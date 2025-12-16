/**
 * Voice Utilities
 * Helper functions for cleaning and formatting voice metadata
 */

/**
 * Clean voice description by removing unwanted text and formatting
 * @param description - The raw voice description
 * @returns Cleaned description or empty string if invalid
 */
export function cleanVoiceDescription(description: string | undefined | null): string {
  if (!description) return '';
  
  let cleaned = description.trim();
  
  // Remove common unwanted prefixes/suffixes
  cleaned = cleaned.replace(/^voice\s*-\s*/i, '');
  cleaned = cleaned.replace(/\s*-\s*voice$/i, '');
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Clean voice category by removing unwanted text and formatting
 * @param category - The raw voice category
 * @returns Cleaned category or empty string if invalid
 */
export function cleanVoiceCategory(category: string | undefined | null): string {
  if (!category) return '';
  
  let cleaned = category.trim();
  
  // Remove underscores and convert to title case
  cleaned = cleaned.replace(/_/g, ' ');
  cleaned = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

