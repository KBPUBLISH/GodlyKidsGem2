export type ReadingLevelKey = 'ages_3_5' | 'ages_6_7' | 'ages_8_plus';

export const READING_LEVELS: Array<{ key: ReadingLevelKey; label: string; short: string }> = [
    { key: 'ages_3_5', label: 'Ages 3–5', short: '3–5' },
    { key: 'ages_6_7', label: 'Ages 6–7', short: '6–7' },
    { key: 'ages_8_plus', label: 'Ages 8+', short: '8+' },
];

export interface ReadingLevelText {
    text: string;
    interactiveWordIndices: number[];
}

export interface ReadingLevels {
    ages_3_5: ReadingLevelText;
    ages_6_7: ReadingLevelText;
    ages_8_plus: ReadingLevelText;
}

export interface ReadingPageDraft {
    _id?: string;
    pageNumber: number;
    backgroundUrl: string;
    backgroundType: 'image' | 'video';
    /** Extracted video soundtrack for iOS/TTS layering in the kid reader */
    backgroundAudioUrl?: string;
    scrollUrl: string;
    scrollHeight?: number;
    scrollMidHeight?: number;
    scrollMaxHeight?: number;
    scrollOffsetY: number;
    scrollOffsetX: number;
    scrollWidth: number;
    scrollOpacity: number;
    readingLevels: ReadingLevels;
}

export function emptyLevel(): ReadingLevelText {
    return { text: '', interactiveWordIndices: [] };
}

export function emptyReadingLevels(): ReadingLevels {
    return {
        ages_3_5: emptyLevel(),
        ages_6_7: emptyLevel(),
        ages_8_plus: emptyLevel(),
    };
}

export function emptyReadingPage(pageNumber: number): ReadingPageDraft {
    return {
        pageNumber,
        backgroundUrl: '',
        backgroundType: 'image',
        scrollUrl: '',
        scrollOffsetY: 0,
        scrollOffsetX: 0,
        scrollWidth: 100,
        scrollOpacity: 100,
        readingLevels: emptyReadingLevels(),
    };
}

export function normalizeReadingLevels(raw: unknown): ReadingLevels {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReadingLevels>;
    const norm = (entry: unknown): ReadingLevelText => {
        if (!entry || typeof entry !== 'object') return emptyLevel();
        const e = entry as Partial<ReadingLevelText>;
        return {
            text: String(e.text || ''),
            interactiveWordIndices: Array.isArray(e.interactiveWordIndices)
                ? e.interactiveWordIndices.filter((i) => Number.isInteger(i) && i >= 0)
                : [],
        };
    };
    return {
        ages_3_5: norm(obj.ages_3_5),
        ages_6_7: norm(obj.ages_6_7),
        ages_8_plus: norm(obj.ages_8_plus),
    };
}

export function pageFromApi(raw: Record<string, unknown>): ReadingPageDraft {
    const bg =
        (raw.backgroundUrl as string) ||
        ((raw.files as { background?: { url?: string } })?.background?.url as string) ||
        '';
    const bgType =
        raw.backgroundType === 'video' ||
        (raw.files as { background?: { type?: string } })?.background?.type === 'video'
            ? 'video'
            : 'image';
    const scroll =
        (raw.scrollUrl as string) ||
        ((raw.files as { scroll?: { url?: string } })?.scroll?.url as string) ||
        '';
    return {
        _id: raw._id ? String(raw._id) : undefined,
        pageNumber: Number(raw.pageNumber) || 1,
        backgroundUrl: bg,
        backgroundType: bgType,
        backgroundAudioUrl: String(raw.backgroundAudioUrl || '').trim() || undefined,
        scrollUrl: scroll,
        scrollHeight: raw.scrollHeight != null ? Number(raw.scrollHeight) : undefined,
        scrollMidHeight: raw.scrollMidHeight != null ? Number(raw.scrollMidHeight) : undefined,
        scrollMaxHeight: raw.scrollMaxHeight != null ? Number(raw.scrollMaxHeight) : undefined,
        scrollOffsetY: Number(raw.scrollOffsetY) || 0,
        scrollOffsetX: Number(raw.scrollOffsetX) || 0,
        scrollWidth: raw.scrollWidth != null ? Number(raw.scrollWidth) : 100,
        scrollOpacity: raw.scrollOpacity != null ? Number(raw.scrollOpacity) : 100,
        readingLevels: normalizeReadingLevels(raw.readingLevels),
    };
}
