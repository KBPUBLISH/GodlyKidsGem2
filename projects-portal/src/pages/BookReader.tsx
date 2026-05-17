import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient, getMediaUrl } from '../services/apiClient';
import {
    appSideSwipeAuthoredFontSizePx,
    appSideSwipeFontFamily,
    appSideSwipeTextShadow,
    appStoryParagraphExtras,
} from '../utils/appBookTypography';
import { ChevronLeft, ChevronRight, X, Play, Square, Volume2, ChevronDown } from 'lucide-react';
import TrimmedPlaybackVideo from '../components/TrimmedPlaybackVideo';

interface Voice {
    voice_id: string;
    name: string;
}

interface TextBox {
    text: string;
    x: number;
    y: number;
    width?: number;
    alignment: 'left' | 'center' | 'right';
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    showBackground?: boolean;
    backgroundColor?: string;
    shadowColor?: string;
}

interface VideoSequenceItem {
    url: string;
    filename?: string;
    order: number;
    trimStartSec?: number;
    trimEndSec?: number;
}

interface ImageSequenceItem {
    url: string;
    filename?: string;
    order: number;
}

interface Page {
    _id: string;
    pageNumber: number;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    backgroundTrimStartSec?: number;
    backgroundTrimEndSec?: number;
    scrollUrl?: string;
    scrollHeight?: number;
    scrollMidHeight?: number;
    scrollMaxHeight?: number;
    scrollOffsetY?: number;
    scrollOffsetX?: number;
    scrollWidth?: number;
    textBoxes?: TextBox[]; // Legacy field
    content?: {
        textBoxes?: TextBox[]; // Primary location from DB
    };
    files?: {
        background?: {
            url?: string;
            type?: 'image' | 'video';
        };
        scroll?: {
            url?: string;
        };
    };
    // Video sequence support
    useVideoSequence?: boolean;
    videoSequence?: VideoSequenceItem[];
    // Image sequence support
    useImageSequence?: boolean;
    imageSequence?: ImageSequenceItem[];
    imageSequenceDuration?: number; // seconds per image (default 3)
    imageSequenceAnimation?: string; // animation effect type
}

const BookReader: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const [pages, setPages] = useState<Page[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    // Scroll state: 'hidden' | 'mid' | 'max' - matches app behavior
    const [scrollState, setScrollState] = useState<'hidden' | 'mid' | 'max'>('mid');
    const [viewMode, setViewMode] = useState<'fullscreen' | 'tablet-p' | 'tablet-l' | 'phone-p' | 'phone-l'>('fullscreen');
    
    // Image sequence state
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageTransition, setImageTransition] = useState<'fade-in' | 'fade-out' | 'none'>('none');
    const imageSequenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    // Video sequence state
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // TTS State
    const [voices, setVoices] = useState<Voice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [showVoiceSelector, setShowVoiceSelector] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);
    const [currentTextBoxIndex, setCurrentTextBoxIndex] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const allTextBoxesRef = useRef<TextBox[]>([]);

    // Device dimensions
    const deviceStyles = {
        'fullscreen': { width: '100%', height: '100%', borderRadius: 0 },
        'tablet-p': { width: '768px', height: '1024px', borderRadius: '24px' }, // iPad Miniish
        'tablet-l': { width: '1024px', height: '768px', borderRadius: '24px' },
        'phone-p': { width: '390px', height: '844px', borderRadius: '40px' },   // iPhone 13ish
        'phone-l': { width: '844px', height: '390px', borderRadius: '40px' },
    };

    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                setPages(res.data);
            } catch (err) {
                console.error('Failed to fetch pages:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPages();
    }, [bookId]);
    
    // Fetch available TTS voices
    useEffect(() => {
        const fetchVoices = async () => {
            try {
                const res = await apiClient.get('/api/tts/voices');
                if (res.data?.voices) {
                    setVoices(res.data.voices);
                    // Set default voice if none selected
                    if (!selectedVoice && res.data.voices.length > 0) {
                        // Try to find a good default narrator voice
                        const defaultVoice = res.data.voices.find((v: Voice) => 
                            v.name?.toLowerCase().includes('aria') || 
                            v.name?.toLowerCase().includes('jessica')
                        ) || res.data.voices[0];
                        setSelectedVoice(defaultVoice.voice_id);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch voices:', err);
            }
        };
        fetchVoices();
    }, []);

    const currentPage = pages[currentPageIndex];
    
    // Reset image/video index when page changes (but preserve scroll state!)
    useEffect(() => {
        setCurrentImageIndex(0);
        setCurrentVideoIndex(0);
        setImageTransition('none');
        setCurrentTextBoxIndex(0);
        
        // Stop any playing audio when changing pages
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setIsPlaying(false);
        
        // Clear any existing image sequence timer
        if (imageSequenceTimerRef.current) {
            clearInterval(imageSequenceTimerRef.current);
            imageSequenceTimerRef.current = null;
        }
        
        // NOTE: We intentionally do NOT reset scrollState here
        // This allows scroll position to persist across pages like in the app
    }, [currentPageIndex]);
    
    // Generate TTS for text and play it
    const generateAndPlayTTS = useCallback(async (text: string, textBoxIdx: number) => {
        if (!text || !selectedVoice) return;
        
        setTtsLoading(true);
        setCurrentTextBoxIndex(textBoxIdx);
        
        try {
            const res = await apiClient.post('/api/tts/generate', {
                text: text.trim(),
                voiceId: selectedVoice,
                bookId: bookId
            });
            
            if (res.data?.audioUrl) {
                // Stop any existing audio
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                
                const audio = new Audio(getMediaUrl(res.data.audioUrl));
                audioRef.current = audio;
                
                audio.onended = () => {
                    setIsPlaying(false);
                    // Try to play next text box if there is one
                    const allBoxes = allTextBoxesRef.current;
                    const nextIdx = textBoxIdx + 1;
                    if (nextIdx < allBoxes.length) {
                        generateAndPlayTTS(allBoxes[nextIdx].text, nextIdx);
                    }
                };
                
                audio.onerror = () => {
                    console.error('Audio playback error');
                    setIsPlaying(false);
                    setTtsLoading(false);
                };
                
                await audio.play();
                setIsPlaying(true);
            }
        } catch (err) {
            console.error('TTS generation failed:', err);
        } finally {
            setTtsLoading(false);
        }
    }, [selectedVoice, bookId]);
    
    // Play all text boxes on current page
    const handlePlay = useCallback(() => {
        if (isPlaying) {
            // Stop playback
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setIsPlaying(false);
            return;
        }
        
        // Get text boxes for current page
        const currentPage = pages[currentPageIndex];
        const contentBoxes = currentPage?.content?.textBoxes;
        const textBoxes = (contentBoxes && contentBoxes.length > 0) ? contentBoxes : currentPage?.textBoxes;
        
        if (!textBoxes || textBoxes.length === 0) {
            console.log('No text boxes to read');
            return;
        }
        
        // Store all text boxes and start playing from first
        allTextBoxesRef.current = textBoxes;
        generateAndPlayTTS(textBoxes[0].text, 0);
    }, [isPlaying, pages, currentPageIndex, generateAndPlayTTS]);
    
    // Toggle scroll state: hidden -> mid -> max -> hidden
    const cycleScrollState = useCallback(() => {
        setScrollState(prev => {
            if (prev === 'hidden') return 'mid';
            if (prev === 'mid') return 'max';
            return 'hidden';
        });
    }, []);
    
    // Image sequence cycling effect
    useEffect(() => {
        if (!currentPage?.useImageSequence || !currentPage?.imageSequence?.length) {
            return;
        }
        
        const sortedImages = [...currentPage.imageSequence].sort((a, b) => a.order - b.order);
        if (sortedImages.length <= 1) return;
        
        const duration = (currentPage.imageSequenceDuration || 3) * 1000; // Convert to ms
        
        imageSequenceTimerRef.current = setInterval(() => {
            // Fade out current image
            setImageTransition('fade-out');
            
            setTimeout(() => {
                // Change to next image
                setCurrentImageIndex(prev => (prev + 1) % sortedImages.length);
                setImageTransition('fade-in');
                
                // Reset transition state
                setTimeout(() => {
                    setImageTransition('none');
                }, 500);
            }, 500);
        }, duration);
        
        return () => {
            if (imageSequenceTimerRef.current) {
                clearInterval(imageSequenceTimerRef.current);
            }
        };
    }, [currentPage?.useImageSequence, currentPage?.imageSequence, currentPage?.imageSequenceDuration]);
    
    // Video sequence: handle video ended to play next
    const handleVideoEnded = () => {
        if (!currentPage?.useVideoSequence || !currentPage?.videoSequence?.length) return;
        
        const sortedVideos = [...currentPage.videoSequence].sort((a, b) => a.order - b.order);
        if (sortedVideos.length <= 1) return;
        
        setCurrentVideoIndex(prev => (prev + 1) % sortedVideos.length);
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(prev => prev + 1);
            // NOTE: Scroll state is preserved across pages
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPageIndex > 0) {
            setCurrentPageIndex(prev => prev - 1);
            // NOTE: Scroll state is preserved across pages
        }
    };

    const resolveUrl = (url?: string) => {
        if (!url) return '';
        return getMediaUrl(url);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                Loading book...
            </div>
        );
    }

    if (pages.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
                <h2 className="text-2xl font-bold mb-4">No pages found</h2>
                <button
                    onClick={() => navigate('/books')}
                    className="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 transition"
                >
                    Back to Books
                </button>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen bg-gray-900 overflow-hidden flex flex-col">
            {/* Top Toolbar */}
            <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 z-50 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/books')}
                        className="text-gray-300 hover:text-white transition flex items-center gap-2"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Back
                    </button>
                    <div className="h-6 w-px bg-gray-700 mx-2" />
                    <span className="text-sm font-medium text-gray-400">Preview Mode:</span>
                    <div className="flex bg-gray-900 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('fullscreen')}
                            className={`px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'fullscreen' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Full
                        </button>
                        <button
                            onClick={() => setViewMode('tablet-p')}
                            className={`px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'tablet-p' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Tablet (P)
                        </button>
                        <button
                            onClick={() => setViewMode('tablet-l')}
                            className={`px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'tablet-l' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Tablet (L)
                        </button>
                        <button
                            onClick={() => setViewMode('phone-p')}
                            className={`px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'phone-p' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Phone (P)
                        </button>
                        <button
                            onClick={() => setViewMode('phone-l')}
                            className={`px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'phone-l' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Phone (L)
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Background type indicator */}
                    {currentPage && (
                        <div className="flex items-center gap-2">
                            {currentPage.useImageSequence && currentPage.imageSequence?.length ? (
                                <span className="bg-purple-600/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                    Image Sequence ({currentPage.imageSequence.length})
                                </span>
                            ) : currentPage.useVideoSequence && currentPage.videoSequence?.length ? (
                                <span className="bg-red-600/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                    Video Sequence ({currentPage.videoSequence.length})
                                </span>
                            ) : (currentPage.backgroundType === 'video' || currentPage.files?.background?.type === 'video') ? (
                                <span className="bg-orange-600/80 text-white text-xs px-2 py-1 rounded-full">
                                    Video
                                </span>
                            ) : (currentPage.backgroundUrl || currentPage.files?.background?.url) ? (
                                <span className="bg-blue-600/80 text-white text-xs px-2 py-1 rounded-full">
                                    Image
                                </span>
                            ) : (
                                <span className="bg-gray-600/80 text-white text-xs px-2 py-1 rounded-full">
                                    No Background
                                </span>
                            )}
                        </div>
                    )}
                    <div className="text-gray-400 text-sm">
                        Page {currentPageIndex + 1} / {pages.length}
                    </div>
                </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-gray-900 relative">
                {/* Device Frame */}
                <div
                    className={`relative overflow-hidden shadow-2xl transition-all duration-300 bg-black ${viewMode !== 'fullscreen' ? 'border-8 border-gray-800' : ''}`}
                    style={{
                        ...deviceStyles[viewMode],
                        transform: viewMode !== 'fullscreen' ? 'scale(0.9)' : 'none', // Slight scale down to fit nicely
                        transformOrigin: 'center center'
                    }}
                    onClick={cycleScrollState}
                >
                    {/* Close Button (Hidden in preview mode, use toolbar back instead) */}
                    {viewMode === 'fullscreen' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate('/books');
                            }}
                            className="absolute top-4 right-4 z-50 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    )}

                    {/* Background Layer */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        {(() => {
                            // Check for image sequence first
                            if (currentPage.useImageSequence && currentPage.imageSequence && currentPage.imageSequence.length > 0) {
                                const sortedImages = [...currentPage.imageSequence].sort((a, b) => a.order - b.order);
                                const currentImage = sortedImages[currentImageIndex] || sortedImages[0];
                                const animation = currentPage.imageSequenceAnimation || 'fade';
                                
                                // Get transition class based on animation type
                                const getTransitionClass = () => {
                                    if (imageTransition === 'none') return 'opacity-100';
                                    if (animation === 'fade') {
                                        return imageTransition === 'fade-out' ? 'opacity-0' : 'opacity-100';
                                    }
                                    if (animation === 'zoom') {
                                        return imageTransition === 'fade-out' 
                                            ? 'opacity-0 scale-110' 
                                            : 'opacity-100 scale-100';
                                    }
                                    if (animation === 'slide') {
                                        return imageTransition === 'fade-out'
                                            ? 'opacity-0 -translate-x-full'
                                            : 'opacity-100 translate-x-0';
                                    }
                                    return 'opacity-100';
                                };
                                
                                return (
                                    <div className="relative w-full h-full">
                                        <img
                                            key={currentImage.url}
                                            src={resolveUrl(currentImage.url)}
                                            alt={`Page ${currentPage.pageNumber} - Image ${currentImageIndex + 1}`}
                                            className={`w-full h-full object-cover transition-all duration-500 ${getTransitionClass()}`}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        {/* Image sequence indicator */}
                                        <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                                            {currentImageIndex + 1} / {sortedImages.length}
                                        </div>
                                    </div>
                                );
                            }
                            
                            // Check for video sequence
                            if (currentPage.useVideoSequence && currentPage.videoSequence && currentPage.videoSequence.length > 0) {
                                const sortedVideos = [...currentPage.videoSequence].sort((a, b) => a.order - b.order);
                                const currentVideo = sortedVideos[currentVideoIndex] || sortedVideos[0];
                                const shouldLoop = sortedVideos.length === 1;
                                
                                return (
                                    <div className="relative w-full h-full">
                                        <TrimmedPlaybackVideo
                                            ref={videoRef}
                                            key={currentVideo.url}
                                            src={resolveUrl(currentVideo.url)}
                                            className="w-full h-full object-cover"
                                            autoPlay
                                            loop={shouldLoop}
                                            muted
                                            playsInline
                                            trimStartSec={currentVideo.trimStartSec}
                                            trimEndSec={currentVideo.trimEndSec}
                                            onEnded={handleVideoEnded}
                                        />
                                        {/* Video sequence indicator */}
                                        {sortedVideos.length > 1 && (
                                            <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
                                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                {currentVideoIndex + 1} / {sortedVideos.length}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            
                            // Get background URL from various possible locations
                            const bgUrl = currentPage.backgroundUrl || currentPage.files?.background?.url;
                            const bgType = currentPage.backgroundType || currentPage.files?.background?.type;
                            
                            // No background - show placeholder
                            if (!bgUrl) {
                                return (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                        <span className="text-gray-500 text-lg">No background set</span>
                                    </div>
                                );
                            }
                            
                            // Video background (single video, loops)
                            if (bgType === 'video') {
                                return (
                                    <TrimmedPlaybackVideo
                                        src={resolveUrl(bgUrl)}
                                        className="w-full h-full object-cover"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        trimStartSec={currentPage.backgroundTrimStartSec}
                                        trimEndSec={currentPage.backgroundTrimEndSec}
                                    />
                                );
                            }
                            
                            // Image background (default)
                            return (
                                <img
                                    src={resolveUrl(bgUrl)}
                                    alt={`Page ${currentPage.pageNumber}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        // Hide broken image and show placeholder
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            );
                        })()}
                    </div>

                    {/* Text Boxes Layer - positioned relative to scroll state */}
                    {(() => {
                        const scrollUrl = currentPage.scrollUrl || currentPage.files?.scroll?.url;
                        const scrollOffset = currentPage.scrollOffsetY || 0;
                        // Calculate scroll height based on state (like app)
                        const currentScrollHeight = scrollState === 'max' 
                            ? (currentPage.scrollMaxHeight || 60)
                            : (currentPage.scrollMidHeight || 30);
                        
                        // Calculate clip-path to hide text outside scroll area (top AND bottom)
                        const clipInsetTop = scrollUrl 
                            ? (scrollState === 'hidden' ? 100 : 100 - currentScrollHeight - scrollOffset)
                            : 0;
                        const clipInsetBottom = scrollUrl ? scrollOffset + 5 : 0; // 5% buffer from bottom
                        
                        return (
                            <div
                                className={`absolute inset-0 pointer-events-none transition-all duration-500 ease-in-out z-20`}
                                style={scrollUrl ? {
                                    // Clip text to scroll bounds - prevents text appearing above OR below scroll
                                    // inset(top right bottom left)
                                    clipPath: `inset(${clipInsetTop}% 0 ${clipInsetBottom}% 0)`,
                                    transition: 'clip-path 0.5s ease-in-out',
                                } : {}}
                            >
                                {/* Use content.textBoxes first (if has items), fall back to root textBoxes (legacy) */}
                                {(() => {
                                    const contentBoxes = currentPage.content?.textBoxes;
                                    const textBoxes = (contentBoxes && contentBoxes.length > 0) ? contentBoxes : currentPage.textBoxes;
                                    return textBoxes;
                                })()?.map((box, idx) => {
                                    // Calculate where scroll starts (from top)
                                    const scrollStartPercent = 100 - currentScrollHeight - scrollOffset + 3;
                                    const boxY = typeof box.y === 'number' ? box.y : 0;
                                    const boxX = typeof box.x === 'number' ? box.x : 0;
                                    // Ensure text stays inside scroll area
                                    const effectiveTop = scrollUrl ? Math.max(boxY, scrollStartPercent) : boxY;
                                    // Calculate max height to stay within scroll bounds
                                    const scrollBottomBuffer = scrollUrl ? scrollOffset + 8 : 0;
                                    const effectiveMaxHeight = scrollUrl 
                                        ? `calc(${100 - scrollBottomBuffer}% - ${effectiveTop}%)`
                                        : `calc(100% - ${effectiveTop}% - 40px)`;

                                    return (
                                        <div
                                            key={idx}
                                            className={`absolute pointer-events-auto overflow-y-auto ${currentTextBoxIndex === idx && isPlaying ? 'ring-2 ring-orange-400 ring-opacity-75' : ''}`}
                                            style={{
                                                left: `calc(max(${boxX}%, 3%) + env(safe-area-inset-left, 0px))`,
                                                top: `${effectiveTop}%`,
                                                width: `min(${box.width || 30}%, calc(100% - max(${boxX}%, 3%) - 3% - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))`,
                                                transform: 'translate(0, 0)',
                                                textAlign: box.alignment,
                                                color: box.color || '#4a3b2a',
                                                fontFamily: appSideSwipeFontFamily(box.fontFamily),
                                                fontSize: `${appSideSwipeAuthoredFontSizePx(box)}px`,
                                                // Calculate max height based on the effective top position
                                                maxHeight: effectiveMaxHeight,
                                                overflowY: 'auto',
                                                WebkitOverflowScrolling: 'touch',
                                                touchAction: 'pan-y',
                                                // Background box styling
                                                backgroundColor: box.showBackground ? (box.backgroundColor || 'rgba(255,255,255,0.85)') : 'transparent',
                                                borderRadius: box.showBackground ? '12px' : '0',
                                                padding: box.showBackground === true ? '12px 16px' : '8px',
                                                textShadow: appSideSwipeTextShadow(box),
                                                scrollBehavior: 'smooth',
                                            }}
                                        >
                                            <p style={{ whiteSpace: 'pre-wrap', margin: 0, ...appStoryParagraphExtras() }}>{box.text}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* Scroll Overlay Layer */}
                    {(() => {
                        const scrollUrl = currentPage.scrollUrl || currentPage.files?.scroll?.url;
                        const scrollOffset = currentPage.scrollOffsetY || 0;
                        const scrollOffsetX = currentPage.scrollOffsetX || 0;
                        const scrollWidth = currentPage.scrollWidth || 100;
                        if (!scrollUrl) return null;
                        
                        // Calculate height based on scroll state
                        const currentScrollHeight = scrollState === 'max'
                            ? (currentPage.scrollMaxHeight || 60)
                            : (currentPage.scrollMidHeight || 30);
                        
                        return (
                            <div
                                className={`absolute left-1/2 transition-all duration-500 ease-in-out z-10`}
                                style={{ 
                                    height: `${currentScrollHeight}%`,
                                    width: `${scrollWidth}%`,
                                    bottom: `${scrollOffset}%`,
                                    transform: scrollState === 'hidden'
                                        ? `translateX(calc(-50% + ${scrollOffsetX}%)) translateY(100%)`
                                        : `translateX(calc(-50% + ${scrollOffsetX}%))`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* The Scroll Image */}
                                <img
                                    src={resolveUrl(scrollUrl)}
                                    alt="Scroll background"
                                    className="w-full h-full object-fill"
                                />
                            </div>
                        );
                    })()}

                    {/* Navigation Controls */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 pointer-events-none">
                        <button
                            onClick={handlePrev}
                            disabled={currentPageIndex === 0}
                            className={`pointer-events-auto p-3 rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition ${currentPageIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-100'
                                }`}
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={currentPageIndex === pages.length - 1}
                            className={`pointer-events-auto p-3 rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition ${currentPageIndex === pages.length - 1 ? 'opacity-0 cursor-default' : 'opacity-100'
                                }`}
                        >
                            <ChevronRight className="w-8 h-8" />
                        </button>
                    </div>

                    {/* Page Indicator */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm pointer-events-none">
                        Page {currentPageIndex + 1} of {pages.length}
                    </div>
                    
                    {/* Play Button - positioned like in app */}
                    <div 
                        className="absolute left-4 pointer-events-auto z-30"
                        style={{
                            bottom: (!currentPage?.scrollUrl || scrollState === 'hidden') ? '1rem' : '2rem'
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePlay();
                            }}
                            disabled={ttsLoading}
                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                                isPlaying 
                                    ? 'bg-red-500 hover:bg-red-600' 
                                    : 'bg-orange-500 hover:bg-orange-600'
                            } ${ttsLoading ? 'opacity-75 cursor-wait' : ''}`}
                        >
                            {ttsLoading ? (
                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : isPlaying ? (
                                <Square className="w-6 h-6 text-white" fill="white" />
                            ) : (
                                <Play className="w-6 h-6 text-white ml-1" fill="white" />
                            )}
                        </button>
                    </div>
                    
                    {/* Voice Selector - top right */}
                    <div className="absolute top-4 right-4 pointer-events-auto z-30">
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowVoiceSelector(!showVoiceSelector);
                                }}
                                className="flex items-center gap-2 bg-black/60 text-white px-3 py-2 rounded-lg backdrop-blur-sm hover:bg-black/80 transition"
                            >
                                <Volume2 className="w-4 h-4" />
                                <span className="text-sm max-w-[120px] truncate">
                                    {voices.find(v => v.voice_id === selectedVoice)?.name || 'Select Voice'}
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${showVoiceSelector ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {showVoiceSelector && (
                                <div 
                                    className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-h-60 overflow-y-auto w-48 z-50"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {voices.map(voice => (
                                        <button
                                            key={voice.voice_id}
                                            onClick={() => {
                                                setSelectedVoice(voice.voice_id);
                                                setShowVoiceSelector(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition ${
                                                selectedVoice === voice.voice_id ? 'bg-indigo-600 text-white' : 'text-gray-300'
                                            }`}
                                        >
                                            {voice.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Scroll State Indicator */}
                    {currentPage?.scrollUrl && (
                        <div className="absolute bottom-4 right-4 bg-black/40 text-white px-2 py-1 rounded text-xs backdrop-blur-sm pointer-events-none">
                            Scroll: {scrollState}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BookReader;
