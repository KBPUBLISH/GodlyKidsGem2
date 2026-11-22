import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronUp, Pause, Play, Speaker, Volume2, VolumeX, X } from 'lucide-react';
import { ApiService, getApiBaseUrl } from '../../services/apiService';
import { authService } from '../../services/authService';
import { removeEmotionalCues } from '../../utils/textProcessing';
import { analyticsService } from '../../services/analyticsService';
import TrimmedPlaybackVideo from '../media/TrimmedPlaybackVideo';
import {
    buildIslandSceneNavState,
    buildIslandScenePath,
    resolveIslandSceneReturn,
    type IslandSceneReaderState,
} from '../../utils/islandSceneReturn';

interface TextBox {
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    alignment?: 'left' | 'center' | 'right';
    showBackground?: boolean;
    backgroundColor?: string;
    shadowColor?: string;
}

interface SequenceItem {
    url: string;
    order: number;
    trimStartSec?: number;
    trimEndSec?: number;
    audioUrl?: string;
}

interface VerticalPage {
    _id: string;
    pageNumber: number;
    pageKind?: 'text' | 'media';
    videoAutoAdvance?: boolean;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    backgroundTrimStartSec?: number;
    backgroundTrimEndSec?: number;
    files?: { background?: { url?: string; type?: string } };
    /** Legacy / API: body copy sometimes at root */
    text?: string;
    textBoxes?: TextBox[];
    content?: { text?: string; textBoxes?: TextBox[] };
    useImageSequence?: boolean;
    imageSequence?: SequenceItem[];
    imageSequenceDuration?: number;
    imageSequenceAnimation?: string;
    useVideoSequence?: boolean;
    videoSequence?: SequenceItem[];
}

interface Props {
    bookId: string;
    book?: any;
    shareToken?: string | null;
}

// Match portal BookReader default (Aria)
const FALLBACK_VOICE_ID = '9BWtsMINqrJLrRacOk9x';

/** Match BookReader / apiService: relative /uploads paths need API origin on mobile WebView. */
const resolveMediaUrl = (url: string | undefined | null): string => {
    if (!url || !String(url).trim()) return '';
    const u = String(url).trim();
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('blob:')) return u;
    const base = getApiBaseUrl().replace(/\/$/, '');
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${base}${path}`;
};

const normalizePageForFeed = (raw: any): VerticalPage => {
    const p = { ...raw } as VerticalPage;
    const resolveSeq = (items: SequenceItem[] | undefined): SequenceItem[] =>
        (items || []).map((item) => ({ ...item, url: resolveMediaUrl(item.url) }));

    const rootImg = raw.imageSequence?.length ? resolveSeq(raw.imageSequence) : null;
    const filesImg = raw.files?.imageSequence?.length ? resolveSeq(raw.files.imageSequence) : null;
    if (rootImg?.length) {
        p.imageSequence = rootImg;
        p.useImageSequence = true;
    } else if (filesImg?.length) {
        p.imageSequence = filesImg;
        p.useImageSequence = true;
    }

    if (raw.videoSequence?.length) {
        p.videoSequence = resolveSeq(raw.videoSequence);
        p.useVideoSequence = true;
    } else if (raw.files?.videoSequence?.length && raw.useVideoSequence) {
        p.videoSequence = resolveSeq(raw.files.videoSequence);
        p.useVideoSequence = true;
    }

    if (p.backgroundUrl) p.backgroundUrl = resolveMediaUrl(p.backgroundUrl);
    if (p.files?.background?.url) {
        p.files = {
            ...p.files,
            background: {
                ...p.files.background,
                url: resolveMediaUrl(p.files.background.url),
            },
        };
    }
    return p;
};

function findWordIndexAtTime(
    currentTime: number,
    words: Array<{ start: number; end: number }>
): number {
    if (!words?.length) return -1;
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (currentTime >= w.start && currentTime < w.end) return i;
    }
    if (currentTime < words[0].start) return 0;
    if (currentTime >= words[words.length - 1].end) return words.length - 1;
    for (let i = 0; i < words.length - 1; i++) {
        if (currentTime >= words[i].end && currentTime < words[i + 1].start) {
            const mid = (words[i].end + words[i + 1].start) / 2;
            return currentTime >= mid ? i + 1 : i;
        }
    }
    return words.length - 1;
}

const getCombinedText = (page: VerticalPage): string => {
    const boxes = page.content?.textBoxes && page.content.textBoxes.length
        ? page.content.textBoxes
        : (page.textBoxes || []);
    const fromBoxes = boxes
        .map(b => (b.text || '').trim())
        .filter(Boolean)
        .join('\n\n');
    if (fromBoxes) return fromBoxes;
    const fromContent = (page.content?.text || '').trim();
    if (fromContent) return fromContent;
    return (page.text || '').trim();
};

const getBackground = (page: VerticalPage): { url?: string; type: 'image' | 'video' } => {
    const url = page.backgroundUrl || page.files?.background?.url;
    const type = (page.backgroundType || page.files?.background?.type || 'image') as 'image' | 'video';
    return { url, type };
};

/** True when swipe-up playback uses `<video>` (muxed soundtrack), so a mute/unmute toggle is meaningful. */
const verticalFeedShowsVideoSoundControl = (page: VerticalPage | undefined): boolean => {
    if (!page) return false;
    if (page.useImageSequence && page.imageSequence && page.imageSequence.length > 0) return false;
    if (page.useVideoSequence && page.videoSequence && page.videoSequence.length > 0) return true;
    const bg = getBackground(page);
    return !!(bg.url && bg.type === 'video');
};

const getTextBoxes = (page: VerticalPage): TextBox[] => {
    if (page.content?.textBoxes && page.content.textBoxes.length) return page.content.textBoxes;
    return page.textBoxes || [];
};

const hasPositionedText = (page: VerticalPage): boolean =>
    getTextBoxes(page).some((b) => (b.text || '').trim().length > 0);

/** True when this page has script we can feed to TTS (text card or any combined body copy). */
const isNarratableCard = (page: VerticalPage | undefined): boolean => {
    if (!page) return false;
    return !!removeEmotionalCues(getCombinedText(page) || '').trim();
};

const resolveShadow = (s?: string): string => {
    if (!s || s === 'none') return 'none';
    if (s === 'white') return '0 1px 2px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.6)';
    if (s === 'black') return '0 2px 6px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.6)';
    return `0 2px 6px ${s}`;
};

/** Softer shadow for text-kind swipe-up pages (readable without heavy glow). */
const TEXT_KIND_PAGE_SHADOW =
    '0 1px 2px rgba(0,0,0,0.42), 0 1px 6px rgba(0,0,0,0.22)';

/** Default size when the portal has body copy but no text boxes (content.text only). */
const SWIPE_UP_STORY_FONT_BASE = 28;

/** Centered swipe-up copy: honor portal text box color / size / shadow when authored; else readable defaults. */
const centeredSwipeUpStoryStyle = (firstBox?: TextBox | null): React.CSSProperties => {
    const basePx =
        firstBox?.fontSize != null && Number(firstBox.fontSize) > 0
            ? Number(firstBox.fontSize)
            : SWIPE_UP_STORY_FONT_BASE;
    const color =
        firstBox?.color && String(firstBox.color).trim()
            ? String(firstBox.color).trim()
            : '#ffffff';
    const textShadow =
        firstBox &&
        firstBox.shadowColor !== undefined &&
        firstBox.shadowColor !== null &&
        String(firstBox.shadowColor).trim() !== ''
            ? resolveShadow(firstBox.shadowColor)
            : TEXT_KIND_PAGE_SHADOW;
    return {
        fontFamily: firstBox?.fontFamily || 'Patrick Hand, system-ui, sans-serif',
        color,
        fontSize: `clamp(20px, ${basePx * 0.9}px, 36px)`,
        lineHeight: 1.35,
        fontWeight: 400,
        textShadow,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    };
};

/** Positioned text boxes overlay for media-kind pages in the swipe-up reader. */
const FeedPositionedTextBoxes: React.FC<{
    boxes: TextBox[];
    isCurrent: boolean;
    pageId: string;
}> = ({ boxes, isCurrent, pageId }) => {
    if (!boxes || boxes.length === 0) return null;
    return (
        <div className="absolute inset-0 pointer-events-none">
            {boxes.map((b, i) => {
                const text = (b.text || '').trim();
                if (!text) return null;
                const left = typeof b.x === 'number' ? `${b.x}%` : '5%';
                const top = typeof b.y === 'number' ? `${b.y}%` : '50%';
                const width = typeof b.width === 'number' ? `${b.width}%` : '90%';
                const height = typeof b.height === 'number' ? `${b.height}%` : 'auto';
                const align = b.alignment || 'left';
                return (
                    <div
                        key={`${pageId}-tb-${i}-${isCurrent ? 'on' : 'off'}`}
                        style={{
                            position: 'absolute',
                            left,
                            top,
                            width,
                            height,
                            textAlign: align,
                            fontFamily: b.fontFamily || 'Patrick Hand, system-ui, sans-serif',
                            color: b.color || '#4a3b2a',
                            fontSize: `clamp(14px, ${(b.fontSize || 24) * 0.7}px, ${(b.fontSize || 24)}px)`,
                            lineHeight: 1.3,
                            textShadow: resolveShadow(b.shadowColor),
                            background: b.showBackground ? (b.backgroundColor || 'rgba(255,255,255,0.85)') : 'transparent',
                            padding: b.showBackground ? '6px 10px' : 0,
                            borderRadius: b.showBackground ? 8 : 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            animation: isCurrent ? 'vfrTextIn 700ms cubic-bezier(0.22, 1, 0.36, 1) both' : undefined,
                            animationDelay: isCurrent ? `${120 + i * 90}ms` : undefined,
                        }}
                    >
                        {text}
                    </div>
                );
            })}
        </div>
    );
};

/** Keyframes for image sequence camera motion (portal / BookPageRenderer parity). */
const VFR_IMAGE_SEQ_KEYFRAMES = `
@keyframes vfrImgZoomIn {
  from { transform: scale(1) translate(0, 0); }
  to { transform: scale(1.15) translate(0, 0); }
}
@keyframes vfrImgZoomOut {
  from { transform: scale(1.15) translate(0, 0); }
  to { transform: scale(1) translate(0, 0); }
}
@keyframes vfrImgPanLeft {
  from { transform: scale(1.1) translateX(3%); }
  to { transform: scale(1.1) translateX(-3%); }
}
@keyframes vfrImgPanRight {
  from { transform: scale(1.1) translateX(-3%); }
  to { transform: scale(1.1) translateX(3%); }
}
@keyframes vfrImgPanUp {
  from { transform: scale(1.1) translateY(3%); }
  to { transform: scale(1.1) translateY(-3%); }
}
@keyframes vfrImgPanDown {
  from { transform: scale(1.1) translateY(-3%); }
  to { transform: scale(1.1) translateY(3%); }
}
@keyframes vfrImgKen1 {
  from { transform: scale(1) translate(0, 0); }
  to { transform: scale(1.12) translate(-2%, -1%); }
}
@keyframes vfrImgKen2 {
  from { transform: scale(1.12) translate(2%, 1%); }
  to { transform: scale(1) translate(-1%, 2%); }
}
@keyframes vfrImgKen3 {
  from { transform: scale(1) translate(1%, -1%); }
  to { transform: scale(1.1) translate(2%, 1%); }
}
@keyframes vfrImgKen4 {
  from { transform: scale(1.1) translate(-1%, 2%); }
  to { transform: scale(1) translate(0, -1%); }
}
`;

/** Returns motion styles for the active slide, or null for static / fade-only crossfade. */
function vfrImageSequenceMotionStyle(
    animRaw: string | undefined,
    durationSec: number,
    slideIndex: number
): React.CSSProperties | null {
    const anim = String(animRaw || 'kenBurns').trim().toLowerCase();
    if (anim === 'none' || anim === 'fade' || anim === '') return null;

    const base: React.CSSProperties = {
        position: 'absolute',
        objectFit: 'cover',
        animationDuration: `${durationSec}s`,
        animationTimingFunction: 'ease-in-out',
        animationFillMode: 'forwards',
        animationIterationCount: 1,
        minWidth: '110%',
        minHeight: '110%',
        left: '-5%',
        top: '-5%',
        width: 'auto',
        height: 'auto',
    };

    switch (anim) {
        case 'zoomin':
            return { ...base, animationName: 'vfrImgZoomIn' };
        case 'zoomout':
            return { ...base, animationName: 'vfrImgZoomOut' };
        case 'panleft':
            return { ...base, animationName: 'vfrImgPanLeft' };
        case 'panright':
            return { ...base, animationName: 'vfrImgPanRight' };
        case 'panup':
            return { ...base, animationName: 'vfrImgPanUp' };
        case 'pandown':
            return { ...base, animationName: 'vfrImgPanDown' };
        case 'zoom':
            return { ...base, animationName: 'vfrImgZoomIn' };
        case 'slide':
            return { ...base, animationName: 'vfrImgPanLeft' };
        case 'kenburns':
        default: {
            const variants = ['vfrImgKen1', 'vfrImgKen2', 'vfrImgKen3', 'vfrImgKen4'] as const;
            return { ...base, animationName: variants[slideIndex % 4] };
        }
    }
}

/**
 * Renders the page background, handling all media variants:
 *   1. Image sequence (cycles)   2. Video sequence (in order)
 *   3. Single video              4. Single image
 *   5. Gradient placeholder
 */
const FeedMediaLayer: React.FC<{
    page: VerticalPage;
    isCurrent: boolean;
    videoMuted: boolean;
    onSequenceEnd?: () => void;
}> = ({ page, isCurrent, videoMuted, onSequenceEnd }) => {
    const imgSeq = useMemo(() => {
        if (!page.useImageSequence || !page.imageSequence?.length) return null;
        return [...page.imageSequence].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [page.useImageSequence, page.imageSequence]);

    const [imgIdx, setImgIdx] = useState(0);
    const [motionEpoch, setMotionEpoch] = useState(0);
    useEffect(() => {
        if (isCurrent) {
            setImgIdx(0);
            setMotionEpoch((e) => e + 1);
        }
    }, [isCurrent, page._id]);

    useEffect(() => {
        if (!imgSeq || !isCurrent) return;
        const ms = Math.max(1000, (page.imageSequenceDuration || 3) * 1000);
        const t = window.setInterval(() => {
            setMotionEpoch((e) => e + 1);
            if (imgSeq.length >= 2) {
                setImgIdx((i) => (i + 1) % imgSeq.length);
            }
        }, ms);
        return () => window.clearInterval(t);
    }, [imgSeq, isCurrent, page.imageSequenceDuration]);

    const vidSeq = useMemo(() => {
        if (!page.useVideoSequence || !page.videoSequence?.length) return null;
        return [...page.videoSequence].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [page.useVideoSequence, page.videoSequence]);

    const [vidIdx, setVidIdx] = useState(0);
    useEffect(() => { if (isCurrent) setVidIdx(0); }, [isCurrent]);

    if (imgSeq && imgSeq.length > 0) {
        const activeIdx = Math.min(imgIdx, imgSeq.length - 1);
        const dur = Math.max(1, page.imageSequenceDuration || 3);
        const motion = vfrImageSequenceMotionStyle(page.imageSequenceAnimation, dur, activeIdx);

        return (
            <div className="absolute inset-0 w-full h-full overflow-hidden">
                <style>{VFR_IMAGE_SEQ_KEYFRAMES}</style>
                {imgSeq.map((img, i) => {
                    const active = i === activeIdx;
                    const motionForLayer = active ? motion : null;
                    const style: React.CSSProperties = active
                        ? motionForLayer
                            ? {
                                  ...motionForLayer,
                                  opacity: 1,
                                  zIndex: 2,
                                  transition: 'opacity 700ms ease-in-out',
                              }
                            : {
                                  position: 'absolute',
                                  inset: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  opacity: 1,
                                  zIndex: 2,
                                  transition: 'opacity 700ms ease-in-out',
                              }
                        : {
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              opacity: 0,
                              zIndex: 1,
                              transition: 'opacity 700ms ease-in-out',
                              pointerEvents: 'none',
                          };

                    return (
                        <img
                            key={
                                active
                                    ? `vfr-${page._id}-seq-${i}-e${motionEpoch}`
                                    : `vfr-${page._id}-seq-${i}`
                            }
                            src={resolveMediaUrl(img.url)}
                            alt=""
                            style={style}
                            draggable={false}
                        />
                    );
                })}
            </div>
        );
    }

    if (vidSeq && vidSeq.length > 0) {
        const current = vidSeq[Math.min(vidIdx, vidSeq.length - 1)];
        const isLast = vidIdx >= vidSeq.length - 1;
        return (
            <TrimmedPlaybackVideo
                key={`${page._id}-vid-${vidIdx}`}
                src={resolveMediaUrl(current.url)}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay={isCurrent}
                muted={videoMuted}
                playsInline
                loop={vidSeq.length === 1 && !page.videoAutoAdvance}
                trimStartSec={current.trimStartSec}
                trimEndSec={current.trimEndSec}
                onEnded={() => {
                    if (!isLast) setVidIdx(i => i + 1);
                    else if (page.videoAutoAdvance) onSequenceEnd?.();
                }}
            />
        );
    }

    const bg = getBackground(page);
    if (bg.url && bg.type === 'video') {
        return (
            <TrimmedPlaybackVideo
                src={resolveMediaUrl(bg.url)}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay={isCurrent}
                muted={videoMuted}
                playsInline
                loop={!page.videoAutoAdvance}
                trimStartSec={page.backgroundTrimStartSec}
                trimEndSec={page.backgroundTrimEndSec}
                onEnded={() => page.videoAutoAdvance && onSequenceEnd?.()}
            />
        );
    }
    if (bg.url) {
        return (
            <img
                src={resolveMediaUrl(bg.url)}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
            />
        );
    }
    return <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-black" />;
};

const VerticalFeedReader: React.FC<Props> = ({ bookId, book: preLoadedBook, shareToken }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const islandSceneReturn = resolveIslandSceneReturn(
        location.state as IslandSceneReaderState | null,
        searchParams,
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ttsCacheRef = useRef<Map<string, { audioUrl: string; alignment?: { words: Array<{ word: string; start: number; end: number }> } }>>(
        new Map()
    );
    const advanceTimerRef = useRef<number | null>(null);
    /** Set when TTS finished and we auto-scrolled to the next page (for image dwell + advance). */
    const fromTtsAutoAdvanceRef = useRef(false);
    const currentIndexRef = useRef(0);
    const autoNarrateRef = useRef(false);
    const mutedRef = useRef(false);
    const pagesLenRef = useRef(0);
    const goToPageRef = useRef<(index: number) => void>(() => {});

    const [book, setBook] = useState<any>(preLoadedBook || null);
    const [pages, setPages] = useState<VerticalPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [autoNarrate, setAutoNarrate] = useState(false);
    const [muted, setMuted] = useState(false);
    /** Independent of narration mute: muxed soundtrack on background `<video>` (swipe-up reader). */
    const [videoSoundOn, setVideoSoundOn] = useState(true);
    const [ttsLoading, setTtsLoading] = useState(false);
    const [ttsPlaying, setTtsPlaying] = useState(false);
    const [ttsAlignment, setTtsAlignment] = useState<{
        words: Array<{ word: string; start: number; end: number }>;
    } | null>(null);
    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [showHint, setShowHint] = useState(true);

    const selectedVoiceId = useMemo(() => {
        return localStorage.getItem('godlykids_default_voice') || FALLBACK_VOICE_ID;
    }, []);

    const voiceId = useMemo(() => {
        const raw = (book as any)?.rawData || book || {};
        return raw.defaultNarratorVoiceId || raw.defaultVoiceId || selectedVoiceId;
    }, [book, selectedVoiceId]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const userId = authService.getUserIdForBackend();
                const [bookResult, pagesResult] = await Promise.all([
                    preLoadedBook
                        ? Promise.resolve(preLoadedBook)
                        : ApiService.getBookById(bookId, userId, shareToken || null),
                    ApiService.getBookPages(bookId),
                ]);
                if (cancelled) return;
                if (bookResult) setBook(bookResult);
                const sorted = (pagesResult || [])
                    .slice()
                    .sort((a: VerticalPage, b: VerticalPage) => (a.pageNumber || 0) - (b.pageNumber || 0))
                    .map((pg: any) => normalizePageForFeed(pg));
                setPages(sorted);
                if (bookResult?.title) {
                    analyticsService.bookView(bookId, bookResult.title);
                }
                ApiService.incrementBookView?.(bookId).catch(() => {});
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [bookId, preLoadedBook, shareToken]);

    // Track which section is currently centered
    useEffect(() => {
        if (!containerRef.current || pages.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                let bestIdx = -1;
                let bestRatio = 0;
                entries.forEach(entry => {
                    if (entry.intersectionRatio > bestRatio) {
                        bestRatio = entry.intersectionRatio;
                        const attr = (entry.target as HTMLElement).getAttribute('data-page-index');
                        if (attr) bestIdx = parseInt(attr, 10);
                    }
                });
                if (bestIdx >= 0 && bestRatio >= 0.35) {
                    setCurrentIndex(bestIdx);
                }
            },
            {
                root: containerRef.current,
                threshold: [0, 0.15, 0.35, 0.55, 0.75, 0.95],
                rootMargin: '-8% 0px -8% 0px',
            }
        );
        sectionRefs.current.forEach(el => el && observer.observe(el));
        return () => observer.disconnect();
    }, [pages.length]);

    const stopTts = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.onended = null;
            audioRef.current.ontimeupdate = null;
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setTtsPlaying(false);
        setTtsAlignment(null);
        setActiveWordIndex(-1);
    }, []);

    const playTtsForPage = useCallback(async (page: VerticalPage, options?: { fromAuto?: boolean }) => {
        if (muted) return;
        const text = removeEmotionalCues(getCombinedText(page) || '').trim();
        if (!text) return;
        try {
            stopTts();
            setTtsLoading(true);
            const cacheKey = `${page._id}:${voiceId}`;
            let cached = ttsCacheRef.current.get(cacheKey) || null;
            let audioUrl: string | null = null;
            let alignment: { words: Array<{ word: string; start: number; end: number }> } | null = null;

            if (cached?.audioUrl) {
                audioUrl = resolveMediaUrl(cached.audioUrl);
                alignment = cached.alignment?.words?.length ? cached.alignment : null;
            } else {
                const result = await ApiService.generateTTS(
                    text,
                    voiceId,
                    bookId,
                    undefined,
                    page.pageNumber,
                    0
                );
                audioUrl = result?.audioUrl ? resolveMediaUrl(result.audioUrl) : null;
                alignment =
                    result?.alignment?.words?.length ? result.alignment : null;
                if (audioUrl) {
                    ttsCacheRef.current.set(cacheKey, {
                        audioUrl: result!.audioUrl,
                        alignment: alignment || undefined,
                    });
                }
            }

            if (!audioUrl) {
                setTtsLoading(false);
                return;
            }

            const alignmentForPlayback =
                alignment?.words?.length ? { words: alignment.words } : null;
            setTtsAlignment(alignmentForPlayback);

            if (!audioRef.current) audioRef.current = new Audio();
            const audio = audioRef.current;
            audio.src = audioUrl;
            audio.onerror = () => {
                setTtsLoading(false);
                setTtsPlaying(false);
                setTtsAlignment(null);
                setActiveWordIndex(-1);
            };

            audio.ontimeupdate = () => {
                const words = alignmentForPlayback?.words;
                if (words?.length) {
                    const idx = findWordIndexAtTime(audio.currentTime, words);
                    if (idx >= 0) setActiveWordIndex(idx);
                }
            };

            audio.onended = () => {
                setTtsPlaying(false);
                setActiveWordIndex(-1);
                setTtsAlignment(null);
                if (autoNarrateRef.current && !mutedRef.current) {
                    const idx = currentIndexRef.current;
                    if (idx < pagesLenRef.current) {
                        fromTtsAutoAdvanceRef.current = true;
                        goToPageRef.current(idx + 1);
                    }
                }
            };

            await audio.play();
            setTtsPlaying(true);
            setTtsLoading(false);
            if (!options?.fromAuto) setAutoNarrate(true);
        } catch (err) {
            console.warn('VerticalFeedReader TTS error:', err);
            setTtsLoading(false);
            setTtsPlaying(false);
            setTtsAlignment(null);
            setActiveWordIndex(-1);
        }
    }, [bookId, muted, stopTts, voiceId]);

    // Hide swipe hint after first scroll
    useEffect(() => {
        if (currentIndex > 0) setShowHint(false);
    }, [currentIndex]);

    const goToPage = useCallback((index: number) => {
        const target = sectionRefs.current[index];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);
    useEffect(() => {
        autoNarrateRef.current = autoNarrate;
    }, [autoNarrate]);
    useEffect(() => {
        mutedRef.current = muted;
    }, [muted]);
    useEffect(() => {
        pagesLenRef.current = pages.length;
    }, [pages.length]);
    useEffect(() => {
        goToPageRef.current = goToPage;
    }, [goToPage]);

    // When current page changes: stop TTS, optionally auto-play if text card and autoNarrate is on;
    // after TTS auto-advanced to a silent image page, advance again after 3s.
    useEffect(() => {
        stopTts();
        if (pages.length === 0) return;
        const fromTtsEnd = fromTtsAutoAdvanceRef.current;
        fromTtsAutoAdvanceRef.current = false;
        const page = pages[currentIndex];
        if (!page) return;

        if (isNarratableCard(page) && autoNarrate && !muted) {
            const t = window.setTimeout(() => {
                playTtsForPage(page, { fromAuto: true });
            }, 350);
            return () => window.clearTimeout(t);
        }

        if (
            fromTtsEnd &&
            !isNarratableCard(page) &&
            autoNarrate &&
            !muted &&
            currentIndex + 1 <= pages.length
        ) {
            const nextIdx = currentIndex + 1;
            if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
            advanceTimerRef.current = window.setTimeout(() => {
                advanceTimerRef.current = null;
                goToPageRef.current(nextIdx);
            }, 3000);
            return () => {
                if (advanceTimerRef.current) {
                    window.clearTimeout(advanceTimerRef.current);
                    advanceTimerRef.current = null;
                }
            };
        }

        return undefined;
    }, [currentIndex, pages, autoNarrate, muted, playTtsForPage, stopTts]);

    const handleVideoEnded = useCallback((index: number) => {
        const page = pages[index];
        if (!page || !page.videoAutoAdvance) return;
        if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = window.setTimeout(() => {
            if (index + 1 < pages.length + 1) goToPage(index + 1);
        }, 250);
    }, [pages, goToPage]);

    const toggleMute = () => {
        setMuted(prev => {
            const next = !prev;
            if (next) {
                stopTts();
                setAutoNarrate(false);
            }
            return next;
        });
    };

    const handleClose = () => {
        stopTts();
        if (islandSceneReturn) {
            const path = buildIslandScenePath(islandSceneReturn);
            if (path) {
                navigate(path, { state: buildIslandSceneNavState(islandSceneReturn) });
                return;
            }
        }
        const dest = bookId ? `/book/${bookId}${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ''}` : '/';
        navigate(dest);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                <div className="text-white/70 text-sm">Loading…</div>
            </div>
        );
    }

    if (!pages.length) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                <div className="text-white/80 text-center px-6">
                    <p className="mb-4">This story has no pages yet.</p>
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm hover:bg-white/20"
                    >Close</button>
                </div>
            </div>
        );
    }

    const totalCount = pages.length + 1; // +1 for The End card
    const currentPage = pages[currentIndex];
    const showNarrationButton = isNarratableCard(currentPage);
    const showVideoSoundControl = verticalFeedShowsVideoSoundControl(currentPage);

    return (
        <div className="fixed inset-0 bg-black z-50 select-none">
            {/* Top chrome: close button + page counter + mute toggle */}
            <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 pt-[max(env(safe-area-inset-top),12px)]">
                <button
                    onClick={handleClose}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center active:scale-95 transition"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-medium">
                    {Math.min(currentIndex + 1, totalCount)} / {totalCount}
                </div>
                <div className="flex items-center gap-2">
                    {showVideoSoundControl && (
                        <button
                            type="button"
                            onClick={() => setVideoSoundOn((v) => !v)}
                            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center active:scale-95 transition"
                            aria-label={videoSoundOn ? 'Mute video sound' : 'Unmute video sound'}
                            title={videoSoundOn ? 'Mute video sound' : 'Unmute video sound'}
                        >
                            <Speaker className={`w-5 h-5 ${videoSoundOn ? 'text-white' : 'text-white/40'}`} />
                        </button>
                    )}
                    <button
                        onClick={toggleMute}
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center active:scale-95 transition"
                        aria-label={muted ? 'Unmute narration' : 'Mute narration'}
                        title={muted ? 'Unmute narration' : 'Mute narration'}
                    >
                        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Bottom-right TTS play/pause for text cards */}
            {showNarrationButton && !muted && (
                <button
                    onClick={() => {
                        if (ttsPlaying) {
                            stopTts();
                            setAutoNarrate(false);
                        } else {
                            playTtsForPage(currentPage);
                        }
                    }}
                    className="absolute z-30 right-4 bottom-[max(env(safe-area-inset-bottom),16px)] w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition"
                    aria-label={ttsPlaying ? 'Pause narration' : 'Play narration'}
                >
                    {ttsLoading ? (
                        <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : ttsPlaying ? (
                        <Pause className="w-6 h-6" />
                    ) : (
                        <Play className="w-6 h-6 ml-0.5" />
                    )}
                </button>
            )}

            {/* Swipe hint on first page */}
            {showHint && currentIndex === 0 && (
                <div className="absolute z-30 left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),24px)] flex flex-col items-center text-white/80 pointer-events-none animate-bounce">
                    <ChevronUp className="w-7 h-7" />
                    <span className="text-xs">Swipe up</span>
                </div>
            )}

            {/* Scroll-snap container */}
            <div
                ref={containerRef}
                className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain"
                style={{ scrollbarWidth: 'none' }}
            >
                <style>{`
                    .vfr-scroll::-webkit-scrollbar{display:none}
                    @keyframes vfrTextIn {
                        from { opacity: 0; transform: translateY(18px); filter: blur(6px); }
                        to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
                    }
                    @keyframes vfrDimIn {
                        from { opacity: 0; }
                        to   { opacity: 1; }
                    }
                `}</style>

                {pages.map((page, index) => {
                    const text = getCombinedText(page);
                    const boxes = getTextBoxes(page);
                    const styleBox =
                        boxes.find((b) => (b.text || '').trim()) || boxes[0] || null;
                    const isCurrent = index === currentIndex;
                    /** Media pages often keep default pageKind; use same centered story UI as text cards so TTS highlights + typography match. */
                    const showCenteredStory = isNarratableCard(page);
                    return (
                        <section
                            key={page._id || index}
                            ref={(el) => { sectionRefs.current[index] = el; }}
                            data-page-index={index}
                            className="relative w-full h-full snap-start"
                            style={{ height: '100dvh' }}
                        >
                            <FeedMediaLayer
                                page={page}
                                isCurrent={isCurrent}
                                videoMuted={showCenteredStory || !videoSoundOn}
                                onSequenceEnd={() => handleVideoEnded(index)}
                            />

                            {showCenteredStory ? (
                                <>
                                    <div
                                        key={`dim-${page._id}-${isCurrent ? 'on' : 'off'}`}
                                        className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/[0.08] via-transparent to-black/[0.22]"
                                        style={{
                                            animation: isCurrent ? 'vfrDimIn 600ms ease-out both' : undefined,
                                        }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center px-6 pt-20 pb-28">
                                        <div
                                            key={`text-${page._id}-${isCurrent ? 'on' : 'off'}`}
                                            className="max-w-md w-full text-center"
                                            style={{
                                                ...centeredSwipeUpStoryStyle(styleBox),
                                                animation: isCurrent
                                                    ? 'vfrTextIn 750ms cubic-bezier(0.22, 1, 0.36, 1) both'
                                                    : undefined,
                                                animationDelay: isCurrent ? '180ms' : undefined,
                                            }}
                                        >
                                            {isCurrent &&
                                            ttsPlaying &&
                                            ttsAlignment?.words?.length ? (
                                                <>
                                                    {ttsAlignment.words.map((w, wi) => {
                                                        const isCurrent = wi === activeWordIndex;
                                                        const synced = activeWordIndex >= 0;
                                                        const isUpcoming = synced && wi > activeWordIndex;
                                                        const isPast = synced && wi < activeWordIndex;
                                                        let readAlongCls =
                                                            'gk-readalong-word font-normal text-inherit';
                                                        if (isCurrent) {
                                                            readAlongCls +=
                                                                ' gk-readalong-word--current rounded px-1 bg-amber-300/95 text-gray-950 opacity-100 shadow-[0_0_20px_rgba(251,191,36,0.55),0_3px_10px_rgba(0,0,0,0.12)] ring-2 ring-amber-200/70';
                                                        } else if (isUpcoming) {
                                                            readAlongCls += ' opacity-38';
                                                        } else if (isPast) {
                                                            readAlongCls += ' opacity-76';
                                                        } else {
                                                            readAlongCls += ' opacity-95';
                                                        }
                                                        return (
                                                            <span key={`${page._id}-w-${wi}`} className={readAlongCls}>
                                                                {w.word}
                                                                {wi < ttsAlignment.words.length - 1 ? ' ' : ''}
                                                            </span>
                                                        );
                                                    })}
                                                </>
                                            ) : (
                                                text || ' '
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                hasPositionedText(page) && (
                                    <FeedPositionedTextBoxes
                                        boxes={boxes}
                                        isCurrent={isCurrent}
                                        pageId={page._id || `p${index}`}
                                    />
                                )
                            )}
                        </section>
                    );
                })}

                {/* The End card */}
                <section
                    ref={(el) => { sectionRefs.current[pages.length] = el; }}
                    data-page-index={pages.length}
                    className="relative w-full snap-start"
                    style={{ height: '100dvh' }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-purple-900 via-indigo-900 to-black" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6 gap-4">
                        <div className="text-5xl">🌟</div>
                        <div className="text-3xl font-bold" style={{ fontFamily: 'Patrick Hand, system-ui, sans-serif' }}>The End</div>
                        <p className="text-white/70 text-sm max-w-xs">{book?.title ? `Hope you enjoyed "${book.title}".` : 'Hope you enjoyed the story.'}</p>
                        <button
                            onClick={handleClose}
                            className="mt-4 px-6 py-2.5 bg-white text-purple-900 rounded-full text-sm font-semibold active:scale-95 transition"
                        >
                            Close
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default VerticalFeedReader;
