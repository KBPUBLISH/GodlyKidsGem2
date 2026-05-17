import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronUp } from 'lucide-react';
import { apiClient, getMediaUrl } from '../services/apiClient';
import TrimmedPlaybackVideo from '../components/TrimmedPlaybackVideo';

/**
 * Portal-only preview of the Swipe Up (vertical TikTok-style) reader.
 *
 * Mirrors the main app's VerticalFeedReader so authors can verify how a
 * draft book will feel on device — full-bleed media cards, snap-scroll
 * paging, fade-in animation on text cards, video auto-advance — without
 * the TTS pipeline (preview is silent on text pages by design).
 */

interface TextBox {
    text?: string;
    x?: number;          // % from left (0–100)
    y?: number;          // % from top  (0–100)
    width?: number;      // % of parent width
    height?: number;     // % of parent height (optional → auto)
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    alignment?: 'left' | 'center' | 'right';
    showBackground?: boolean;
    backgroundColor?: string;
    shadowColor?: string;  // 'white' | 'black' | custom
}

interface SequenceItem {
    url: string;
    order: number;
    trimStartSec?: number;
    trimEndSec?: number;
}

interface PreviewPage {
    _id: string;
    pageNumber: number;
    pageKind?: 'text' | 'media';
    videoAutoAdvance?: boolean;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    backgroundTrimStartSec?: number;
    backgroundTrimEndSec?: number;
    files?: { background?: { url?: string; type?: string } };
    text?: string;
    textBoxes?: TextBox[];
    content?: { text?: string; textBoxes?: TextBox[] };
    // Image sequence (cycle of images)
    useImageSequence?: boolean;
    imageSequence?: SequenceItem[];
    imageSequenceDuration?: number;   // seconds per image (default 3)
    imageSequenceAnimation?: string;  // 'fade' | 'zoom' | 'kenBurns' | etc.
    // Video sequence (play in order)
    useVideoSequence?: boolean;
    videoSequence?: SequenceItem[];
}

const getCombinedText = (page: PreviewPage): string => {
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

const getBackground = (page: PreviewPage): { url?: string; type: 'image' | 'video' } => {
    const url = page.backgroundUrl || page.files?.background?.url;
    const type = (page.backgroundType || page.files?.background?.type || 'image') as 'image' | 'video';
    return { url: url ? getMediaUrl(url) : undefined, type };
};

// Pull the authored text-box list (content.textBoxes wins over root textBoxes,
// matching how getCombinedText resolves text content).
const getTextBoxes = (page: PreviewPage): TextBox[] => {
    if (page.content?.textBoxes && page.content.textBoxes.length) return page.content.textBoxes;
    return page.textBoxes || [];
};

const hasPositionedText = (page: PreviewPage): boolean => {
    return getTextBoxes(page).some((b) => (b.text || '').trim().length > 0);
};

// Resolve the text-shadow CSS the editor stored as 'white' | 'black' | custom.
const resolveShadow = (s?: string): string => {
    if (!s || s === 'none') return 'none';
    if (s === 'white') return '0 1px 2px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.6)';
    if (s === 'black') return '0 2px 6px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.6)';
    return `0 2px 6px ${s}`;
};

/** Fallback shadow when the page has no text box shadowColor (e.g. content.text only). */
const PREVIEW_CENTERED_STORY_SHADOW =
    '0 1px 2px rgba(0,0,0,0.42), 0 1px 6px rgba(0,0,0,0.22)';
const SWIPE_UP_STORY_FONT_BASE = 28;

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
            : PREVIEW_CENTERED_STORY_SHADOW;
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

/**
 * Render authored text boxes at their authored x/y/% positions, on top of media.
 * Used for Media-kind swipe-up pages so text overlays still appear (matches the
 * side-swipe reader's behavior). On the active card, the boxes fade in.
 */
const PositionedTextBoxes: React.FC<{
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
                            animation: isCurrent ? 'swpTextIn 700ms cubic-bezier(0.22, 1, 0.36, 1) both' : undefined,
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

/**
 * Renders the page background, handling all four media types:
 *   1. Image sequence (cycles with fade)
 *   2. Video sequence (plays in order)
 *   3. Single video background
 *   4. Single image background
 *   5. Gradient placeholder (no media)
 *
 * `isCurrent` controls playback (only active page autoplays / cycles).
 * `onSequenceEnd` fires when a video sequence's last clip ends.
 */
const MediaLayer: React.FC<{
    page: PreviewPage;
    isCurrent: boolean;
    onSequenceEnd?: () => void;
}> = ({ page, isCurrent, onSequenceEnd }) => {
    // --- Image sequence ---
    const imgSeq = useMemo(() => {
        if (!page.useImageSequence || !page.imageSequence?.length) return null;
        return [...page.imageSequence].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [page.useImageSequence, page.imageSequence]);

    const [imgIdx, setImgIdx] = useState(0);
    useEffect(() => {
        if (isCurrent) setImgIdx(0);
    }, [isCurrent, page._id]);

    useEffect(() => {
        if (!imgSeq || !isCurrent || imgSeq.length < 2) return;
        const ms = Math.max(1000, (page.imageSequenceDuration || 3) * 1000);
        const t = window.setInterval(() => {
            setImgIdx(i => (i + 1) % imgSeq.length);
        }, ms);
        return () => window.clearInterval(t);
    }, [imgSeq, isCurrent, page.imageSequenceDuration]);

    // --- Video sequence ---
    const vidSeq = useMemo(() => {
        if (!page.useVideoSequence || !page.videoSequence?.length) return null;
        return [...page.videoSequence].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [page.useVideoSequence, page.videoSequence]);

    const [vidIdx, setVidIdx] = useState(0);
    useEffect(() => {
        if (isCurrent) setVidIdx(0);
    }, [isCurrent]);

    if (imgSeq && imgSeq.length > 0) {
        const current = imgSeq[Math.min(imgIdx, imgSeq.length - 1)];
        return (
            <>
                {imgSeq.map((img, i) => (
                    <img
                        key={`${page._id}-img-${i}`}
                        src={getMediaUrl(img.url)}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                        style={{ opacity: i === Math.min(imgIdx, imgSeq.length - 1) ? 1 : 0 }}
                        draggable={false}
                        onError={() => console.warn('[SwipeUpPreview] img-seq failed:', img.url)}
                    />
                ))}
                <div className="absolute bottom-3 right-3 z-10 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px]">
                    {Math.min(imgIdx, imgSeq.length - 1) + 1} / {imgSeq.length} • {current?.url ? '' : 'no url'}
                </div>
            </>
        );
    }

    if (vidSeq && vidSeq.length > 0) {
        const current = vidSeq[Math.min(vidIdx, vidSeq.length - 1)];
        const isLast = vidIdx >= vidSeq.length - 1;
        return (
            <>
                <TrimmedPlaybackVideo
                    key={`${page._id}-vid-${vidIdx}`}
                    src={getMediaUrl(current.url)}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay={isCurrent}
                    muted
                    playsInline
                    loop={vidSeq.length === 1 && !page.videoAutoAdvance}
                    trimStartSec={current.trimStartSec}
                    trimEndSec={current.trimEndSec}
                    onEnded={() => {
                        if (!isLast) setVidIdx(i => i + 1);
                        else if (page.videoAutoAdvance) onSequenceEnd?.();
                    }}
                    onError={() => console.warn('[SwipeUpPreview] vid-seq failed:', current.url)}
                />
                {vidSeq.length > 1 && (
                    <div className="absolute bottom-3 right-3 z-10 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px]">
                        {vidIdx + 1} / {vidSeq.length}
                    </div>
                )}
            </>
        );
    }

    // Single image / video background
    const bg = getBackground(page);
    if (bg.url && bg.type === 'video') {
        return (
            <TrimmedPlaybackVideo
                src={bg.url}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay={isCurrent}
                muted
                playsInline
                loop={!page.videoAutoAdvance}
                trimStartSec={page.backgroundTrimStartSec}
                trimEndSec={page.backgroundTrimEndSec}
                onEnded={() => page.videoAutoAdvance && onSequenceEnd?.()}
                onError={() => console.warn('[SwipeUpPreview] video failed:', bg.url)}
            />
        );
    }
    if (bg.url) {
        return (
            <img
                src={bg.url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
                onError={(e) => {
                    console.warn('[SwipeUpPreview] image failed:', bg.url);
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
            />
        );
    }
    return <div className="absolute inset-0 bg-gradient-to-b from-slate-700 via-slate-900 to-black" />;
};

// Phone frame size: keep 9:19.5 portrait, fit inside viewport with chrome margin.
function computeFrameSize() {
    if (typeof window === 'undefined') return { width: 360, height: 780 };
    const verticalChrome = 130; // top bar + bottom padding + page-list pills
    const horizontalChrome = 32;
    const maxH = Math.max(420, window.innerHeight - verticalChrome);
    const maxW = Math.max(280, window.innerWidth - horizontalChrome);
    const ratio = 9 / 19.5;
    let width = Math.min(maxW, maxH * ratio, 420);
    let height = width / ratio;
    if (height > maxH) {
        height = maxH;
        width = height * ratio;
    }
    return { width: Math.round(width), height: Math.round(height) };
}

const SwipeUpPreview: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Array<HTMLElement | null>>([]);
    const advanceTimerRef = useRef<number | null>(null);

    const [book, setBook] = useState<any>(null);
    const [pages, setPages] = useState<PreviewPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showHint, setShowHint] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!bookId) {
                setLoading(false);
                return;
            }
            try {
                const [bookRes, pagesRes] = await Promise.all([
                    apiClient.get(`/api/books/${bookId}`),
                    apiClient.get(`/api/pages/book/${bookId}`),
                ]);
                if (cancelled) return;
                setBook(bookRes.data);
                const sorted = (pagesRes.data || []).slice().sort(
                    (a: PreviewPage, b: PreviewPage) => (a.pageNumber || 0) - (b.pageNumber || 0)
                );
                setPages(sorted);
                console.log('[SwipeUpPreview] loaded', sorted.length, 'pages. Media:',
                    sorted.map((p: PreviewPage) => ({
                        pageNumber: p.pageNumber,
                        kind: p.pageKind,
                        bgUrl: p.backgroundUrl || p.files?.background?.url,
                        bgType: p.backgroundType || p.files?.background?.type,
                        useImageSeq: !!p.useImageSequence,
                        imgSeqCount: p.imageSequence?.length || 0,
                        useVideoSeq: !!p.useVideoSequence,
                        vidSeqCount: p.videoSequence?.length || 0,
                    }))
                );
            } catch (err) {
                console.error('Failed to load swipe up preview:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [bookId]);

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
                rootMargin: '-6% 0px -6% 0px',
            }
        );
        sectionRefs.current.forEach(el => el && observer.observe(el));
        return () => observer.disconnect();
    }, [pages.length]);

    useEffect(() => {
        if (currentIndex > 0) setShowHint(false);
    }, [currentIndex]);

    const goToPage = (index: number) => {
        const target = sectionRefs.current[index];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleVideoEnded = (index: number) => {
        const page = pages[index];
        if (!page || !page.videoAutoAdvance) return;
        if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = window.setTimeout(() => goToPage(index + 1), 250);
    };

    const handleClose = () => {
        if (bookId) navigate(`/books/edit/${bookId}`);
        else navigate('/books');
    };

    const isSwipeUp = (book?.readerLayout || 'side_swipe') === 'swipe_up';
    const totalCount = pages.length + 1;

    // Phone frame size — derived from viewport, locked 9/19.5 portrait.
    // (No aspectRatio + explicit width/height combo, that fights itself.)
    const [frameSize, setFrameSize] = useState(() => computeFrameSize());

    useEffect(() => {
        const onResize = () => setFrameSize(computeFrameSize());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const phoneFrameStyle = useMemo(() => ({
        width: `${frameSize.width}px`,
        height: `${frameSize.height}px`,
    }), [frameSize.width, frameSize.height]);

    const sectionStyle = useMemo(() => ({
        height: `${frameSize.height}px`,
        flex: '0 0 auto' as const,
    }), [frameSize.height]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="text-white/70 text-sm">Loading preview…</div>
            </div>
        );
    }

    if (!isSwipeUp) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 px-6">
                <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-xl">
                    <h2 className="text-xl font-semibold mb-2">Not a Swipe Up book</h2>
                    <p className="text-gray-600 text-sm mb-4">
                        This preview only works for books whose Reader Layout is set to <strong>Swipe Up</strong>. Switch the layout in the book editor first.
                    </p>
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
                    >Back to editor</button>
                </div>
            </div>
        );
    }

    if (!pages.length) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 px-6">
                <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-xl">
                    <h2 className="text-xl font-semibold mb-2">No pages yet</h2>
                    <p className="text-gray-600 text-sm mb-4">Add at least one page to preview the Swipe Up flow.</p>
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
                    >Back to editor</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center pt-3 pb-6 px-3 overflow-hidden">
            {/* Top bar: back + label */}
            <div className="w-full max-w-[460px] flex items-center justify-between mb-3 px-1">
                <button
                    onClick={handleClose}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to editor
                </button>
                <div className="text-white/80 text-xs flex flex-col items-end">
                    <span className="font-medium">Swipe Up Preview</span>
                    <span className="text-white/50">TTS muted in preview</span>
                </div>
            </div>

            {/* Phone frame */}
            <div
                className="relative bg-black rounded-[40px] shadow-2xl ring-1 ring-white/10 overflow-hidden flex-shrink-0"
                style={phoneFrameStyle}
            >
                {/* Top counter chip */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-medium">
                    {Math.min(currentIndex + 1, totalCount)} / {totalCount}
                </div>

                {/* Swipe hint on first card */}
                {showHint && currentIndex === 0 && (
                    <div className="absolute z-30 left-1/2 -translate-x-1/2 bottom-6 flex flex-col items-center text-white/80 pointer-events-none animate-bounce">
                        <ChevronUp className="w-7 h-7" />
                        <span className="text-xs">Swipe up</span>
                    </div>
                )}

                <style>{`
                    .swp-feed::-webkit-scrollbar { display: none; }
                    @keyframes swpTextIn {
                        from { opacity: 0; transform: translateY(18px); filter: blur(6px); }
                        to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
                    }
                    @keyframes swpDimIn {
                        from { opacity: 0; }
                        to   { opacity: 1; }
                    }
                `}</style>

                <div
                    ref={containerRef}
                    className="swp-feed h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {pages.map((page, index) => {
                        const text = getCombinedText(page);
                        const boxes = getTextBoxes(page);
                        const styleBox =
                            boxes.find((b) => (b.text || '').trim()) || boxes[0] || null;
                        const isCurrent = index === currentIndex;
                        const showCenteredStory = !!text.trim();
                        const hasBgMedia = !!(
                            page.backgroundUrl ||
                            page.files?.background?.url ||
                            (page.useImageSequence && page.imageSequence?.length) ||
                            (page.useVideoSequence && page.videoSequence?.length)
                        );
                        return (
                            <section
                                key={page._id || index}
                                ref={(el) => { sectionRefs.current[index] = el; }}
                                data-page-index={index}
                                className="relative w-full snap-start overflow-hidden bg-black"
                                style={sectionStyle}
                            >
                                <MediaLayer
                                    page={page}
                                    isCurrent={isCurrent}
                                    onSequenceEnd={() => handleVideoEnded(index)}
                                />

                                {showCenteredStory ? (
                                    <>
                                        {hasBgMedia && (
                                            <div
                                                key={`dim-${page._id}-${isCurrent ? 'on' : 'off'}`}
                                                className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/[0.08] via-transparent to-black/[0.22]"
                                                style={{
                                                    animation: isCurrent ? 'swpDimIn 500ms ease-out both' : undefined,
                                                }}
                                            />
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center px-6 pt-16 pb-20">
                                            <div
                                                key={`text-${page._id}-${isCurrent ? 'on' : 'off'}`}
                                                className="max-w-md w-full text-center"
                                                style={{
                                                    ...centeredSwipeUpStoryStyle(styleBox),
                                                    animation: isCurrent
                                                        ? 'swpTextIn 750ms cubic-bezier(0.22, 1, 0.36, 1) both'
                                                        : undefined,
                                                    animationDelay: isCurrent ? '180ms' : undefined,
                                                }}
                                            >
                                                {text || ' '}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    hasPositionedText(page) && (
                                        <PositionedTextBoxes
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
                        className="relative w-full snap-start overflow-hidden"
                        style={sectionStyle}
                    >
                        <div className="relative w-full h-full">
                            <div className="absolute inset-0 bg-gradient-to-b from-purple-900 via-indigo-900 to-black" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6 gap-3">
                                <div className="text-5xl">🌟</div>
                                <div className="text-3xl font-bold" style={{ fontFamily: 'Patrick Hand, system-ui, sans-serif' }}>The End</div>
                                <p className="text-white/70 text-sm max-w-xs">
                                    {book?.title ? `Hope you enjoyed "${book.title}".` : 'Hope you enjoyed the story.'}
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Page list (helper for desktop preview only) */}
            <div className="mt-4 max-w-[460px] w-full hidden md:flex items-center justify-center gap-1 flex-wrap">
                {pages.map((p, i) => (
                    <button
                        key={p._id || i}
                        onClick={() => goToPage(i)}
                        className={`w-7 h-7 rounded-full text-[11px] font-medium transition ${
                            i === currentIndex
                                ? 'bg-white text-slate-900'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                        title={`Page ${p.pageNumber}${p.pageKind === 'text' ? ' (text)' : ''}`}
                    >
                        {p.pageNumber}
                    </button>
                ))}
                <button
                    onClick={() => goToPage(pages.length)}
                    className={`px-3 h-7 rounded-full text-[11px] font-medium transition ${
                        currentIndex === pages.length
                            ? 'bg-white text-slate-900'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                >
                    End
                </button>
            </div>
        </div>
    );
};

export default SwipeUpPreview;
