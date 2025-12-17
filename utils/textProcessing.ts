/**
 * Text Processing Utilities
 * Handles emotional cues and text formatting for TTS
 */

// Regex to match emotional cues like [happy], [sad], [excited], etc.
const EMOTIONAL_CUE_REGEX = /\[([a-zA-Z]+)\]/g;

/**
 * Process text with emotional cues for TTS
 * Keeps the text but can be used to adjust voice parameters
 */
export function processTextWithEmotionalCues(text: string): {
  processedText: string;
  emotions: Array<{ emotion: string; position: number }>;
} {
  const emotions: Array<{ emotion: string; position: number }> = [];
  let position = 0;
  
  // Find all emotional cues
  let match;
  while ((match = EMOTIONAL_CUE_REGEX.exec(text)) !== null) {
    emotions.push({
      emotion: match[1].toLowerCase(),
      position: match.index - position,
    });
    position += match[0].length;
  }
  
  // Remove emotional cues from text for clean TTS
  const processedText = text.replace(EMOTIONAL_CUE_REGEX, '').trim();
  
  return { processedText, emotions };
}

/**
 * Remove emotional cues from text
 * Returns clean text without any [emotion] markers
 */
export function removeEmotionalCues(text: string): string {
  return text.replace(EMOTIONAL_CUE_REGEX, '').trim();
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


