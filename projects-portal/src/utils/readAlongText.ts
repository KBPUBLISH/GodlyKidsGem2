/**
 * Keep portal read-along / display text aligned with kid app (`utils/textProcessing`).
 */
const EMOTIONAL_CUE_REGEX = /\[[^\]]+\]/g;

export function removeEmotionalCues(text: string): string {
    let cleanText = text.replace(/"@\w+\s+([^"]+)"/g, '"$1"');
    cleanText = cleanText.replace(/@\w+\s+"([^"]+)"/g, '"$1"');
    cleanText = cleanText.replace(/@\w+\s*/g, '');
    return cleanText
        .replace(EMOTIONAL_CUE_REGEX, '')
        .replace(/\s+/g, ' ')
        .trim();
}
