/**
 * Utility functions for voice-related operations
 */

/**
 * Clean voice description by removing unwanted terms
 * @param description - The voice description to clean
 * @returns Cleaned description or empty string
 */
export const cleanVoiceDescription = (description?: string): string => {
  if (!description) return '';
  
  // Remove "cloned", "professional", and "generated" (case-insensitive)
  let cleaned = description
    .replace(/\bcloned\b/gi, '')
    .replace(/\bprofessional\b/gi, '')
    .replace(/\bgenerated\b/gi, '')
    .trim();
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

/**
 * Clean voice category by removing unwanted terms
 * @param category - The voice category to clean
 * @returns Cleaned category or empty string
 */
export const cleanVoiceCategory = (category?: string): string => {
  if (!category) return '';
  
  // Remove "cloned", "professional", and "generated" (case-insensitive)
  let cleaned = category
    .replace(/\bcloned\b/gi, '')
    .replace(/\bprofessional\b/gi, '')
    .replace(/\bgenerated\b/gi, '')
    .trim();
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

