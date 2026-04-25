import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { ApiService } from '../../services/apiService';
import { authService } from '../../services/authService';
import { removeEmotionalCues } from '../../utils/textProcessing';
import { analyticsService } from '../../services/analyticsService';

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

interface SequenceItem { url: string; order: number }

interface VerticalPage {
    _id: string;
    pageNumber: number;
    pageKind?: 'text' | 'media';
    videoAutoAdvance?: boolean;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    files?: { background?: { url?: string; type?: string } };
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

const FALLBACK_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

const getCombinedText = (page: VerticalPage): string => {
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

const getBackground = (page: VerticalPage): { url?: string; type: 'image' | 'video' } => {
    const url = page.backgroundUrl || page.files?.background?.url;
    const type = (page.backgroundType || page.files?.background?.type || 'image') as 'image' | 'video';
    return { url, type };
};

const getTextBoxes = (page: VerticalPage): TextBox[] => {
    if (page.content?.textBoxes && page.content.textBoxes.length) return page.content.textBoxes;
    return page.textBoxes || [];
};

const resolveShadow = (s?: string): string => {
    if (!s || s === 'none') return 'none';
    if (s === 'white') return '0 1px 2px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.6)';
    if (s === 'black') return '0 2px 6px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.6)';
    return `0 2px 6px ${s}`;
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
    useEffect(() => {
        if (!imgSeq || !isCurrent || imgSeq.length < 2) return;
        const ms = Math.max(1000, (page.imageSequenceDuration || 3) * 1000);
        const t = window.setInterval(() => {
            setImgIdx(i => (i + 1) % imgSeq.length);
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
        return (
            <>
                {imgSeq.map((img, i) => (
                    <img
                        key={`${page._id}-img-${i}`}
                        src={img.url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                        style={{ opacity: i === activeIdx ? 1 : 0 }}
                        draggable={false}
                    />
                ))}
            </>
        );
    }

    if (vidSeq && vidSeq.length > 0) {
        const current = vidSeq[Math.min(vidIdx, vidSeq.length - 1)];
        const isLast = vidIdx >= vidSeq.length - 1;
        return (
            <video
                key={`${page._id}-vid-${vidIdx}`}
                src={current.url}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay={isCurrent}
                muted={videoMuted}
                playsInline
                loop={vidSeq.length === 1 && !page.videoAutoAdvance}
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
            <video
                src={bg.url}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay={isCurrent}
                muted={videoMuted}
                playsInline
                loop={!page.videoAutoAdvance}
                onEnded={() => page.videoAutoAdvance && onSequenceEnd?.()}
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
            />
        );
    }
    return <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-black" />;
};

const VerticalFeedReader: React.FC<Props> = ({ bookId, book: preLoadedBook, shareToken }) => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ttsCacheRef = useRef<Map<string, string>>(new Map());
    const advanceTimerRef = useRef<number | null>(null);

    const [book, setBook] = useState<any>(preLoadedBook || null);
    const [pages, setPages] = useState<VerticalPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [autoNarrate, setAutoNarrate] = useState(false);
    const [muted, setMuted] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);
    const [ttsPlaying, setTtsPlaying] = useState(false);
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
                const sorted = (pagesResult || []).slice().sort(
                    (a: VerticalPage, b: VerticalPage) => (a.pageNumber || 0) - (b.pageNumber || 0)
                );
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
                if (bestIdx >= 0 && bestRatio >= 0.6) {
                    setCurrentIndex(bestIdx);
                }
            },
            { root: containerRef.current, threshold: [0.6, 0.8, 0.95] }
        );
        sectionRefs.current.forEach(el => el && observer.observe(el));
        return () => observer.disconnect();
    }, [pages.length]);

    const stopTts = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setTtsPlaying(false);
    }, []);

    const playTtsForPage = useCallback(async (page: VerticalPage, options?: { fromAuto?: boolean }) => {
        if (muted) return;
        const text = removeEmotionalCues(getCombinedText(page) || '').trim();
        if (!text) return;
        try {
            stopTts();
            setTtsLoading(true);
            const cacheKey = `${page._id}:${voiceId}`;
            let audioUrl = ttsCacheRef.current.get(cacheKey) || null;
            if (!audioUrl) {
                const result = await ApiService.generateTTS(
                    text,
                    voiceId,
                    bookId,
                    undefined,
                    page.pageNumber,
                    0
                );
                audioUrl = result?.audioUrl || null;
                if (audioUrl) ttsCacheRef.current.set(cacheKey, audioUrl);
            }
            if (!audioUrl) {
                setTtsLoading(false);
                return;
            }
            if (!audioRef.current) audioRef.current = new Audio();
            const audio = audioRef.current;
            audio.src = audioUrl;
            audio.onended = () => setTtsPlaying(false);
            audio.onerror = () => { setTtsLoading(false); setTtsPlaying(false); };
            await audio.play();
            setTtsPlaying(true);
            setTtsLoading(false);
            if (!options?.fromAuto) setAutoNarrate(true);
        } catch (err) {
            console.warn('VerticalFeedReader TTS error:', err);
            setTtsLoading(false);
            setTtsPlaying(false);
        }
    }, [bookId, muted, stopTts, voiceId]);

    // When current page changes: stop TTS, optionally auto-play if text card and autoNarrate is on
    useEffect(() => {
        stopTts();
        if (pages.length === 0) return;
        const page = pages[currentIndex];
        if (!page) return;
        if (page.pageKind === 'text' && autoNarrate && !muted) {
            const t = window.setTimeout(() => {
                playTtsForPage(page, { fromAuto: true });
            }, 350);
            return () => window.clearTimeout(t);
        }
    }, [currentIndex, pages, autoNarrate, muted, playTtsForPage, stopTts]);

    // Hide swipe hint after first scroll
    useEffect(() => {
        if (currentIndex > 0) setShowHint(false);
    }, [currentIndex]);

    const goToPage = useCallback((index: number) => {
        const target = sectionRefs.current[index];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

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
    const currentIsText = currentPage?.pageKind === 'text';

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
                <button
                    onClick={toggleMute}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center active:scale-95 transition"
                    aria-label={muted ? 'Unmute narration' : 'Mute narration'}
                >
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
            </div>

            {/* Bottom-right TTS play/pause for text cards */}
            {currentIsText && !muted && (
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
                    const isText = page.pageKind === 'text';
                    const text = getCombinedText(page);
                    const boxes = getTextBoxes(page);
                    const firstBox = boxes[0];
                    const isCurrent = index === currentIndex;
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
                                videoMuted={isText || muted}
                                onSequenceEnd={() => handleVideoEnded(index)}
                            />

                            {isText ? (
                                /* Text-kind page: centered combined text */
                                <>
                                    <div
                                        key={`dim-${page._id}-${isCurrent ? 'on' : 'off'}`}
                                        className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70"
                                        style={{
                                            animation: isCurrent ? 'vfrDimIn 600ms ease-out both' : undefined,
                                        }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center px-6 pt-20 pb-28">
                                        <div
                                            key={`text-${page._id}-${isCurrent ? 'on' : 'off'}`}
                                            className="max-w-md w-full text-center"
                                            style={{
                                                fontFamily: firstBox?.fontFamily || 'Patrick Hand, system-ui, sans-serif',
                                                color: firstBox?.color || '#ffffff',
                                                fontSize: `clamp(20px, ${(firstBox?.fontSize || 28) * 0.9}px, 36px)`,
                                                lineHeight: 1.35,
                                                textShadow: '0 2px 14px rgba(0,0,0,0.7)',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                animation: isCurrent
                                                    ? 'vfrTextIn 750ms cubic-bezier(0.22, 1, 0.36, 1) both'
                                                    : undefined,
                                                animationDelay: isCurrent ? '180ms' : undefined,
                                            }}
                                        >
                                            {text || ' '}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Media-kind page: render authored text boxes at their authored positions */
                                <FeedPositionedTextBoxes
                                    boxes={boxes}
                                    isCurrent={isCurrent}
                                    pageId={page._id || `p${index}`}
                                />
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
