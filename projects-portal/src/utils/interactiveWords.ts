/** Split story text into tappable word tokens (whitespace-separated). */
export function splitInteractiveWords(text: string): string[] {
    if (!text?.trim()) return [];
    return text.trim().split(/\s+/).filter((w) => w.length > 0);
}

/** Keep only indices that still exist after text edits. */
export function sanitizeInteractiveWordIndices(
    text: string,
    indices: number[] | undefined | null,
): number[] {
    if (!indices?.length) return [];
    const wordCount = splitInteractiveWords(text).length;
    const unique = new Set<number>();
    for (const i of indices) {
        if (Number.isInteger(i) && i >= 0 && i < wordCount) unique.add(i);
    }
    return Array.from(unique).sort((a, b) => a - b);
}

export function toggleInteractiveWordIndex(
    indices: number[] | undefined | null,
    wordIndex: number,
): number[] {
    const current = indices ? [...indices] : [];
    const pos = current.indexOf(wordIndex);
    if (pos >= 0) {
        current.splice(pos, 1);
    } else {
        current.push(wordIndex);
    }
    return current.sort((a, b) => a - b);
}

export function collectPageInteractiveTargets(
    textBoxes: Array<{ text?: string; interactiveWordIndices?: number[] }> | undefined | null,
): Array<{ boxIndex: number; wordIndex: number }> {
    if (!textBoxes?.length) return [];
    const targets: Array<{ boxIndex: number; wordIndex: number }> = [];
    textBoxes.forEach((box, boxIndex) => {
        const indices = sanitizeInteractiveWordIndices(box.text || '', box.interactiveWordIndices);
        indices.forEach((wordIndex) => targets.push({ boxIndex, wordIndex }));
    });
    return targets;
}

/** Short pleasant “ding” via Web Audio (no asset required). */
export function playInteractiveWordDing(): void {
    try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        osc.onended = () => {
            void ctx.close();
        };
    } catch {
        // Ignore audio failures in preview
    }
}
