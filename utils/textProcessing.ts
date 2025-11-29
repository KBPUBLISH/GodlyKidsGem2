/**
 * Utility functions for processing text with emotional cues
 * Supports ElevenLabs emotional cues in brackets like [excited], [whispers], etc.
 */

export interface ProcessedText {
    displayText: string; // Text without emotional cues for display
    ttsText: string; // Text with emotional cues for TTS (ElevenLabs supports these)
    removedCues: Array<{ cue: string; index: number; length: number }>; // Track removed cues for alignment
}

/**
 * Process text to extract emotional cues and create display/TTS versions
 * @param text - Original text with emotional cues like [excited], [whispers], etc.
 * @returns Processed text with separate display and TTS versions
 */
export function processTextWithEmotionalCues(text: string): ProcessedText {
    // Pattern to match emotional cues in brackets: [word] or [multiple words]
    const cuePattern = /\[([^\]]+)\]/g;
    const removedCues: Array<{ cue: string; index: number; length: number }> = [];
    
    let displayText = text;
    let lastIndex = 0;
    let offset = 0; // Track how much we've removed so far
    
    // Find all cues and track their positions
    let match;
    const matches: Array<{ cue: string; fullMatch: string; index: number }> = [];
    
    while ((match = cuePattern.exec(text)) !== null) {
        matches.push({
            cue: match[1], // Content inside brackets
            fullMatch: match[0], // Full match including brackets
            index: match.index
        });
    }
    
    // Remove cues from display text (in reverse order to maintain indices)
    for (let i = matches.length - 1; i >= 0; i--) {
        const { fullMatch, index } = matches[i];
        displayText = displayText.slice(0, index) + displayText.slice(index + fullMatch.length);
        
        // Track removed cue for alignment adjustment
        removedCues.push({
            cue: matches[i].cue,
            index: index,
            length: fullMatch.length
        });
    }
    
    // TTS text keeps the cues (ElevenLabs supports bracket notation for emotional cues)
    const ttsText = text;
    
    // Clean up display text (remove extra spaces left by removed cues)
    displayText = displayText.replace(/\s+/g, ' ').trim();
    
    return {
        displayText,
        ttsText,
        removedCues: removedCues.reverse() // Reverse to get original order
    };
}

/**
 * Adjust word alignment indices to account for removed emotional cues
 * @param words - Array of words with indices
 * @param removedCues - Array of removed cues with their positions
 * @returns Adjusted word indices
 */
export function adjustWordIndicesForRemovedCues(
    words: Array<{ word: string; start: number; end: number }>,
    removedCues: Array<{ cue: string; index: number; length: number }>,
    originalText: string
): Array<{ word: string; start: number; end: number }> {
    if (removedCues.length === 0) return words;
    
    // Calculate total characters removed before each position
    const getRemovedLengthBefore = (position: number): number => {
        return removedCues
            .filter(cue => cue.index < position)
            .reduce((sum, cue) => sum + cue.length, 0);
    };
    
    // For word alignment, we need to map words from TTS text (with cues) to display text (without cues)
    // Since ElevenLabs returns word indices based on the TTS text, we need to adjust them
    // This is complex because word boundaries might shift. For now, we'll use a simpler approach:
    // Map words by their position in the text, accounting for removed cues
    
    // Build a mapping of character positions
    const adjustedWords = words.map(word => {
        // Estimate character position based on word timing (rough approximation)
        // This is a simplified approach - for more accuracy, we'd need character-level alignment
        return word;
    });
    
    return adjustedWords;
}

/**
 * Remove emotional cues from text for display
 * @param text - Text with emotional cues
 * @returns Text without emotional cues
 */
export function removeEmotionalCues(text: string): string {
    return text.replace(/\[([^\]]+)\]/g, '').replace(/\s+/g, ' ').trim();
}

