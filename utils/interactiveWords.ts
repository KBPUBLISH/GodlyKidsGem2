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

/** Page-local key for a tap target (progress is stored per page id/index in the reader). */
export function pageInteractiveTapKey(boxIndex: number, wordIndex: number): string {
    return `${boxIndex}:${wordIndex}`;
}

/** Visible blank slot length roughly matching the hidden word. */
export function blankSlotUnits(word: string): number {
    const letters = word.replace(/[^\p{L}\p{N}]/gu, '');
    return Math.min(Math.max(letters.length || word.length || 3, 3), 14);
}

/** Speakable form of a tap word (strip edge punctuation). */
export function wordForSpeech(word: string): string {
    const cleaned = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    return cleaned || word;
}

/** Lowercase letters/digits only — for stopword checks and duplicate-label detection. */
function normalizeHuntWord(word: string): string {
    return word.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
}

/** Function words that make poor hunt blanks (content nouns/verbs are better). */
const HUNT_AUGMENT_STOPWORDS = new Set([
    'the', 'and', 'was', 'were', 'his', 'her', 'him', 'she', 'had', 'has', 'have',
    'with', 'that', 'this', 'they', 'them', 'then', 'than', 'when', 'from', 'into',
    'onto', 'said', 'very', 'some', 'are', 'for', 'but', 'not', 'all', 'out', 'who',
    'what', 'its', 'their', 'there', 'here', 'will', 'would', 'could', 'should',
    'because', 'about', 'after', 'before', 'while', 'where', 'been', 'being', 'did',
    'does', 'each', 'every', 'also', 'just', 'more', 'most', 'much', 'many', 'other',
]);

/**
 * Densify hunt blanks on pages whose CMS data marks too few interactive words
 * (used for the ages 6–7 reading level, where long pages deserve a fuller hunt).
 *
 * - Only augments pages that already have at least one CMS-marked blank, so
 *   non-hunt pages stay non-hunt.
 * - Target density: ~1 blank per `wordsPerBlank` words (min 2, at least
 *   `fullPageMin` on pages of 30+ words, capped at `maxBlanks` and at 1/4 of
 *   the page's words).
 * - Extra blanks are picked deterministically from the page text itself: the
 *   text is split into even segments and the best candidate in each segment is
 *   promoted (content words of 3+ letters, no stopwords, no duplicate visible
 *   labels, never adjacent to another blank) — so the same page always yields
 *   the same blanks across re-renders and session restores, and the hunt
 *   totals feeding star scoring stay consistent.
 */
export function augmentInteractiveWordIndices(
    text: string,
    baseIndices: number[],
    options?: { wordsPerBlank?: number; fullPageMin?: number; maxBlanks?: number },
): number[] {
    if (!baseIndices.length) return baseIndices;
    const words = splitInteractiveWords(text);
    if (!words.length) return baseIndices;

    const wordsPerBlank = options?.wordsPerBlank ?? 11;
    const fullPageMin = options?.fullPageMin ?? 4;
    const maxBlanks = options?.maxBlanks ?? 6;

    let desired = Math.max(2, Math.round(words.length / wordsPerBlank));
    if (words.length >= 30) desired = Math.max(desired, fullPageMin);
    desired = Math.min(desired, maxBlanks, Math.floor(words.length / 4));

    const chosen = new Set(baseIndices);
    if (chosen.size >= desired) return baseIndices;

    const usedLabels = new Set(baseIndices.map((i) => normalizeHuntWord(words[i] || '')));
    const isCandidate = (i: number): boolean => {
        if (chosen.has(i) || chosen.has(i - 1) || chosen.has(i + 1)) return false;
        const w = normalizeHuntWord(words[i]);
        if (w.length < 3) return false;
        if (HUNT_AUGMENT_STOPWORDS.has(w)) return false;
        if (usedLabels.has(w)) return false;
        return true;
    };

    const needed = desired - chosen.size;
    const pageHash = hashInteractiveSeed(`hunt-augment::${text}`);
    // One pick per even segment of the text → blanks spread through the page
    for (let s = 0; s < needed; s++) {
        const start = Math.floor((s * words.length) / needed);
        const end = Math.floor(((s + 1) * words.length) / needed);
        let best = -1;
        let bestScore = -1;
        for (let i = start; i < end; i++) {
            if (!isCandidate(i)) continue;
            const w = normalizeHuntWord(words[i]);
            // Prefer meatier words; seeded tie-break keeps picks stable but varied
            const score =
                Math.min(w.length, 8) * 16 +
                ((pageHash ^ hashInteractiveSeed(`${i}::${w}`)) % 16);
            if (score > bestScore) {
                bestScore = score;
                best = i;
            }
        }
        if (best >= 0) {
            chosen.add(best);
            usedLabels.add(normalizeHuntWord(words[best]));
        }
    }
    return Array.from(chosen).sort((a, b) => a - b);
}

/** FNV-1a style hash for stable puzzle layout seeds. */
export function hashInteractiveSeed(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * Precomputed slot lattice in unit space [0,1]×[0,1].
 * Corners/edges first so small chip counts can spread wide; mid slots fill denser hunts.
 */
const PUZZLE_SLOT_UNITS: Array<{ u: number; v: number }> = [
    { u: 0.1, v: 0.12 },
    { u: 0.9, v: 0.12 },
    { u: 0.5, v: 0.18 },
    { u: 0.18, v: 0.42 },
    { u: 0.82, v: 0.4 },
    { u: 0.5, v: 0.55 },
    { u: 0.12, v: 0.72 },
    { u: 0.88, v: 0.72 },
    { u: 0.35, v: 0.3 },
    { u: 0.65, v: 0.32 },
    { u: 0.28, v: 0.62 },
    { u: 0.72, v: 0.6 },
];

function slotDistSq(
    a: { u: number; v: number },
    b: { u: number; v: number },
): number {
    const du = a.u - b.u;
    const dv = a.v - b.v;
    return du * du + dv * dv;
}

function pickSpreadSlotIndices(pageSeed: string | number, count: number): number[] {
    const n = Math.min(Math.max(count, 1), PUZZLE_SLOT_UNITS.length);
    const available = PUZZLE_SLOT_UNITS.map((_, i) => i);
    const first = hashInteractiveSeed(`${pageSeed}:spread:0`) % available.length;
    const selected: number[] = [available[first]];
    available.splice(first, 1);

    while (selected.length < n && available.length > 0) {
        let bestIdx = 0;
        let bestScore = -1;
        for (let i = 0; i < available.length; i++) {
            const candidate = PUZZLE_SLOT_UNITS[available[i]];
            let minD = Infinity;
            for (const s of selected) {
                minD = Math.min(minD, slotDistSq(candidate, PUZZLE_SLOT_UNITS[s]));
            }
            const tie =
                (hashInteractiveSeed(`${pageSeed}:spread:${available[i]}`) % 1000) * 1e-9;
            if (minD + tie > bestScore) {
                bestScore = minD + tie;
                bestIdx = i;
            }
        }
        selected.push(available[bestIdx]);
        available.splice(bestIdx, 1);
    }
    return selected;
}

/**
 * Deterministic % position for a hunt chip over the page art.
 * Pass `chipCount` (remaining chips) so nearby chips prefer maximally distant lattice points.
 */
export function puzzleChipPosition(
    pageSeed: string | number,
    chipKey: string | number,
    options?: {
        topMin?: number;
        topMax?: number;
        leftMin?: number;
        leftMax?: number;
        chipIndex?: number;
        chipCount?: number;
    },
): { leftPct: number; topPct: number } {
    const topMin = options?.topMin ?? 10;
    const topMax = options?.topMax ?? 52;
    const leftMin = options?.leftMin ?? 6;
    const leftMax = options?.leftMax ?? 88;
    const chipIndex = options?.chipIndex ?? 0;
    const chipCount = Math.max(options?.chipCount ?? 1, 1);
    const slotCount = Math.min(Math.max(chipCount, 1), PUZZLE_SLOT_UNITS.length);

    const spread = pickSpreadSlotIndices(pageSeed, slotCount);
    const slotIdx = spread[chipIndex % spread.length];
    const unit = PUZZLE_SLOT_UNITS[slotIdx];
    const jitterScale = chipCount <= 4 ? 0.15 : 0.35;
    const jitter = hashInteractiveSeed(`${pageSeed}::${chipKey}`);
    const jx = ((jitter % 17) - 8) * jitterScale;
    const jy = (((jitter >> 8) % 17) - 8) * jitterScale;
    const leftPct = leftMin + unit.u * (leftMax - leftMin) + jx;
    const topPct = topMin + unit.v * (topMax - topMin) + jy;
    return {
        leftPct: Math.min(Math.max(leftPct, leftMin), leftMax),
        topPct: Math.min(Math.max(topPct, topMin), topMax),
    };
}

/**
 * Adaptive Bible Map parchment band (% of viewport height).
 * Short pages keep the scroll low so more of the illustration shows.
 */
export function bibleMapScrollBandPct(wordCount: number): { mid: number; max: number } {
    const n = Math.max(0, Math.floor(Number(wordCount) || 0));
    if (n <= 12) return { mid: 24, max: 28 };
    if (n <= 24) return { mid: 30, max: 34 };
    return { mid: 36, max: 40 };
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
        // Ignore audio failures
    }
}
