/**
 * Text Processing Utilities
 * Handles emotional cues and text formatting for TTS
 */

// Regex to match emotional cues - supports:
// - Single word: [happy], [sad], [laughs]
// - Multi-word: [long pause], [clears throat], [gentle wind breeze]
// - With special chars: [excitedly], [whispers softly]
const EMOTIONAL_CUE_REGEX = /\[[^\]]+\]/g;

// Regex to match @CharacterName tags ANYWHERE in text (global)
// Format: @CharacterName followed by space (the name is alphanumeric only)
const CHARACTER_TAG_REGEX = /@\w+\s+/g;

// Regex to match @CharacterName "quoted text" pattern ANYWHERE - extracts just the quoted text
// This is used globally to replace all instances
const CHARACTER_QUOTED_REGEX = /@\w+\s+"([^"]+)"/g;

/**
 * Process text with emotional cues for TTS
 * Keeps the text but can be used to adjust voice parameters
 * Also removes @CharacterName tags (voice selection is handled separately)
 * 
 * Handles TWO formats:
 * 1. "@Moses Let my people go!" (tag INSIDE quotes) -> Let my people go!
 * 2. @Moses "Let my people go!" (tag OUTSIDE quotes) -> Let my people go!
 */
export function processTextWithEmotionalCues(text: string): {
  processedText: string;
  emotions: Array<{ emotion: string; position: number }>;
} {
  const emotions: Array<{ emotion: string; position: number }> = [];
  let position = 0;
  
  // First handle @CharacterName tags (can appear anywhere in text)
  // Step 1: Replace "@CharacterName text" with just "text" (tag inside quotes)
  let textWithoutCharTag = text.replace(/"@\w+\s+([^"]+)"/g, '"$1"');
  // Step 2: Replace @CharacterName "quoted text" with just the quoted text (tag outside quotes)
  textWithoutCharTag = textWithoutCharTag.replace(/@\w+\s+"([^"]+)"/g, '"$1"');
  // Step 3: Remove any remaining @CharacterName tags (malformed - without quotes)
  textWithoutCharTag = textWithoutCharTag.replace(/@\w+\s*/g, '');
  
  // Find all emotional cues
  let match;
  const regex = /\[[^\]]+\]/g; // Use fresh regex instance
  while ((match = regex.exec(textWithoutCharTag)) !== null) {
    emotions.push({
      emotion: match[0].replace(/[\[\]]/g, '').toLowerCase(),
      position: match.index - position,
    });
    position += match[0].length;
  }
  
  // Remove emotional cues from text for clean TTS
  const processedText = textWithoutCharTag.replace(EMOTIONAL_CUE_REGEX, '').replace(/\s+/g, ' ').trim();
  
  return { processedText, emotions };
}

/**
 * Remove emotional cues and @CharacterName tags from text
 * Returns clean text without any [bracketed content] markers or @CharacterName prefixes
 * 
 * Handles TWO formats:
 * 1. "@Moses Let my people go!" (tag INSIDE quotes) -> "Let my people go!"
 * 2. @Moses "Let my people go!" (tag OUTSIDE quotes) -> "Let my people go!"
 * 
 * Handles @CharacterName appearing ANYWHERE in text (not just at start)
 */
export function removeEmotionalCues(text: string): string {
  // Step 1: Replace "@CharacterName text" with just "text" (tag inside quotes - PREFERRED format)
  // This handles patterns like: '"@Moses Let my people go!" he shouted.'
  let cleanText = text.replace(/"@\w+\s+([^"]+)"/g, '"$1"');
  
  // Step 2: Replace @CharacterName "quoted text" with just "quoted text" (tag outside quotes)
  // This handles patterns like: '@Moses "Let my people go!" he shouted.'
  cleanText = cleanText.replace(/@\w+\s+"([^"]+)"/g, '"$1"');
  
  // Step 3: Remove any remaining @CharacterName tags (malformed - without quotes)
  // This handles patterns like: '@Moses said hello' -> 'said hello'
  cleanText = cleanText.replace(/@\w+\s*/g, '');
  
  return cleanText
    .replace(EMOTIONAL_CUE_REGEX, '') // Remove [bracketed content]
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single
    .trim();
}

/**
 * Extract emotional cues from text
 * Returns array of emotions found
 */
export function extractEmotionalCues(text: string): string[] {
  const matches = text.match(EMOTIONAL_CUE_REGEX);
  if (!matches) return [];
  return matches.map(m => m.replace(/[\[\]]/g, '').toLowerCase());
}


