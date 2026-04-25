import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronUp } from 'lucide-react';
import { apiClient, getMediaUrl } from '../services/apiClient';

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
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    alignment?: 'left' | 'center' | 'right';
}

interface PreviewPage {
    _id: string;
    pageNumber: number;
    pageKind?: 'text' | 'media';
    videoAutoAdvance?: boolean;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    files?: { background?: { url?: string; type?: string } };
    textBoxes?: TextBox[];
    content?: { text?: string; textBoxes?: TextBox[] };
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
    return (page.content?.text || '').trim();
};

const getBackground = (page: PreviewPage): { url?: string; type: 'image' | 'video' } => {
    const url = page.backgroundUrl || page.files?.background?.url;
    const type = (page.backgroundType || page.files?.background?.type || 'image') as 'image' | 'video';
    return { url: url ? getMediaUrl(url) : undefined, type };
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
                console.log('[SwipeUpPreview] loaded', sorted.length, 'pages. Backgrounds:',
                    sorted.map((p: PreviewPage) => ({
                        pageNumber: p.pageNumber,
                        kind: p.pageKind,
                        bgUrl: p.backgroundUrl || p.files?.background?.url,
                        bgType: p.backgroundType || p.files?.background?.type,
                        resolved: getMediaUrl(p.backgroundUrl || p.files?.background?.url || ''),
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
                if (bestIdx >= 0 && bestRatio >= 0.6) {
                    setCurrentIndex(bestIdx);
                }
            },
            { root: containerRef.current, threshold: [0.6, 0.8, 0.95] }
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
                        const bg = getBackground(page);
                        const isText = page.pageKind === 'text';
                        const text = getCombinedText(page);
                        const firstBox = (page.content?.textBoxes && page.content.textBoxes[0]) || (page.textBoxes && page.textBoxes[0]);
                        const isCurrent = index === currentIndex;
                        const hasBgMedia = !!bg.url;
                        return (
                            <section
                                key={page._id || index}
                                ref={(el) => { sectionRefs.current[index] = el; }}
                                data-page-index={index}
                                className="relative w-full snap-start overflow-hidden bg-black"
                                style={sectionStyle}
                            >
                                {bg.url && bg.type === 'video' ? (
                                    <video
                                        src={bg.url}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        autoPlay={isCurrent}
                                        muted
                                        playsInline
                                        loop={!page.videoAutoAdvance}
                                        onEnded={() => handleVideoEnded(index)}
                                        onError={(e) => console.warn('[SwipeUpPreview] video failed:', bg.url, e)}
                                    />
                                ) : bg.url ? (
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
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-b from-slate-700 via-slate-900 to-black" />
                                )}

                                {isText && (
                                    <>
                                        {/* Subtle vignette for legibility — only when there's an actual
                                            bg image/video; on the gradient placeholder we don't need extra dim. */}
                                        {hasBgMedia && (
                                            <div
                                                key={`dim-${page._id}-${isCurrent ? 'on' : 'off'}`}
                                                className="absolute inset-0"
                                                style={{
                                                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 100%)',
                                                    animation: isCurrent ? 'swpDimIn 500ms ease-out both' : undefined,
                                                }}
                                            />
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center px-6 pt-16 pb-20">
                                            <div
                                                key={`text-${page._id}-${isCurrent ? 'on' : 'off'}`}
                                                className="max-w-md w-full text-center"
                                                style={{
                                                    fontFamily: firstBox?.fontFamily || 'Patrick Hand, system-ui, sans-serif',
                                                    color: firstBox?.color || '#ffffff',
                                                    fontSize: `clamp(18px, ${(firstBox?.fontSize || 28) * 0.85}px, 32px)`,
                                                    lineHeight: 1.35,
                                                    textShadow: '0 2px 14px rgba(0,0,0,0.75)',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
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
