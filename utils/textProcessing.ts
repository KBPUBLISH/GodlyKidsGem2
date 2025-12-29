/**
 * Text Processing Utilities
 * Handles emotional cues and text formatting for TTS
 */

// Regex to match emotional cues - supports:
// - Single word: [happy], [sad], [laughs]
// - Multi-word: [long pause], [clears throat], [gentle wind breeze]
// - With special chars: [excitedly], [whispers softly]
const EMOTIONAL_CUE_REGEX = /\[[^\]]+\]/g;

// Regex to match @CharacterName tags at the start of text
// Format: @CharacterName followed by space (the name is alphanumeric only)
const CHARACTER_TAG_REGEX = /^@\w+\s+/;

// Regex to match @CharacterName "quoted text" pattern - extracts just the quoted text
const CHARACTER_QUOTED_REGEX = /^@\w+\s+"([^"]+)"(.*)$/s;

/**
 * Process text with emotional cues for TTS
 * Keeps the text but can be used to adjust voice parameters
 * Also removes @CharacterName tags (voice selection is handled separately)
 * For @CharacterName "quoted text" format, extracts just the quoted text
 */
export function processTextWithEmotionalCues(text: string): {
  processedText: string;
  emotions: Array<{ emotion: string; position: number }>;
} {
  const emotions: Array<{ emotion: string; position: number }> = [];
  let position = 0;
  
  // First handle @CharacterName tag
  let textWithoutCharTag = text;
  const quotedMatch = text.match(CHARACTER_QUOTED_REGEX);
  if (quotedMatch) {
    // Extract just the quoted text (without quotes)
    textWithoutCharTag = quotedMatch[1] + (quotedMatch[2] || '');
  } else {
    // Fallback: just remove @CharacterName prefix
    textWithoutCharTag = text.replace(CHARACTER_TAG_REGEX, '');
  }
  
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
 * For @CharacterName "quoted text" format, extracts just the quoted text (without quotes)
 */
export function removeEmotionalCues(text: string): string {
  let cleanText = text;
  
  // Check for @CharacterName "quoted text" pattern first
  const quotedMatch = text.match(CHARACTER_QUOTED_REGEX);
  if (quotedMatch) {
    // Extract just the quoted text (group 1) plus any text after (group 2)
    const quotedText = quotedMatch[1];
    const afterText = quotedMatch[2] || '';
    cleanText = quotedText + afterText;
  } else {
    // Fallback: just remove @CharacterName prefix
    cleanText = text.replace(CHARACTER_TAG_REGEX, '');
  }
  
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


