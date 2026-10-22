/** Bible Map reader helpers: word splitting for speech + adaptive parchment sizing. */

/** Split story text into whitespace-separated word tokens. */
export function splitStoryWords(text: string): string[] {
    if (!text?.trim()) return [];
    return text.trim().split(/\s+/).filter((w) => w.length > 0);
}

/** Speakable form of a tapped story word (strip edge punctuation). */
export function wordForSpeech(word: string): string {
    const cleaned = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    return cleaned || word;
}

/**
 * Adaptive Bible Map parchment band (% of viewport height).
 * Short pages keep the scroll low so more of the illustration shows.
 * Phones need a taller band — a short scroll clips the last lines.
 */
export function bibleMapScrollBandPct(
    wordCount: number,
    options?: { mobile?: boolean },
): { mid: number; max: number } {
    const n = Math.max(0, Math.floor(Number(wordCount) || 0));
    if (options?.mobile) {
        // Phone opens on mid. Keep short pages snug so the paper doesn't
        // sit half-empty under one or two lines.
        if (n <= 16) return { mid: 24, max: 30 };
        if (n <= 28) return { mid: 32, max: 38 };
        if (n <= 45) return { mid: 40, max: 48 };
        return { mid: 48, max: 58 };
    }
    if (n <= 12) return { mid: 24, max: 28 };
    if (n <= 24) return { mid: 30, max: 34 };
    return { mid: 36, max: 40 };
}
