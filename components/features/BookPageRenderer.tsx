import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { removeEmotionalCues } from '../../utils/textProcessing';
import { attachPlaybackTrim } from '../../utils/playbackTrim';
import TrimmedPlaybackVideo from '../media/TrimmedPlaybackVideo';
import { Music } from 'lucide-react';

interface TextBox {
    id: string;
    text: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    startTime?: number;
    endTime?: number;
}

/** First playback position inside authored trim (defaults to start of file). */
function playbackClipStart(trimStartSec?: number | null): number {
    const n = trimStartSec;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

interface VideoSequenceItem {
    url: string;
    filename?: string;
    order: number;
    audioUrl?: string; // Auto-extracted audio for this video (iOS audio layering)
    trimStartSec?: number;
    trimEndSec?: number;
}

interface ImageSequenceItem {
    url: string;
    filename?: string;
    order: number;
}

// Character overlay settings for a page
interface CharacterOverlay {
    showCharacter: boolean;
    pose: string; // e.g., 'standing_front', 'praying', etc.
    x: number; // 0-100 percentage
    y: number; // 0-100 percentage
    scale: number; // 0.5-2.0
    flipHorizontal: boolean;
}

// Character poses available (URLs from user's profile)
interface CharacterPoses {
    [poseId: string]: {
        url: string;
        name: string;
        description: string;
    };
}

interface PageData {
    id: string;
    pageNumber: number;
    backgroundUrl: string;
    backgroundType: 'image' | 'video';
    textBoxes: TextBox[];
    scrollUrl?: string;
    scrollHeight?: number;
    scrollMidHeight?: number; // Mid scroll height % (default 30)
    scrollMaxHeight?: number; // Max scroll height % (default 60)
    scrollOffsetY?: number; // Vertical offset from bottom in percentage (default 0)
    scrollOffsetX?: number; // Horizontal offset from center in percentage (default 0)
    scrollWidth?: number; // Width as percentage (default 100 = full width)
    scrollOpacity?: number; // 0–100: transparency of scroll overlay (100 = opaque)
    soundEffectUrl?: string;
    // Background audio - extracted video audio or ambient sound that loops with the page
    // Plays as separate <audio> element so it can layer with TTS (unlike video audio on iOS)
    backgroundAudioUrl?: string;
    /** Optional trim for single background video (paired with layered background audio URL). */
    backgroundTrimStartSec?: number;
    backgroundTrimEndSec?: number;
    // Video sequence - multiple videos that play in order
    useVideoSequence?: boolean;
    videoSequence?: VideoSequenceItem[];
    // Image sequence - multiple images that cycle with transitions
    useImageSequence?: boolean;
    imageSequence?: ImageSequenceItem[];
    imageSequenceDuration?: number; // seconds per image (default 3)
    imageSequenceAnimation?: 'none' | 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'zoomIn' | 'zoomOut' | 'kenBurns'; // animation effect
    // Single background image animation (e.g. Kids Monthly generated pages)
    backgroundImageAnimation?: 'none' | 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'zoomIn' | 'zoomOut' | 'kenBurns';
    backgroundImageAnimationDuration?: number; // seconds (default 10)
    // Character overlay settings (from AI or manual)
    characterOverlay?: CharacterOverlay;
}

// Scroll state types
export type ScrollState = 'hidden' | 'mid' | 'max';

/** Resolve scroll band heights; legacy pages may only have scrollHeight. */
function resolveScrollHeights(page: PageData): { max: number; mid: number } {
    const max = page.scrollMaxHeight ?? page.scrollHeight ?? 60;
    const mid = page.scrollMidHeight ?? Math.max(30, max - 30);
    return { max, mid };
}

interface BookPageRendererProps {
    page: PageData;
    activeTextBoxIndex: number | null;
    scrollState: ScrollState;
    onScrollStateChange?: (newState: ScrollState) => void;
    /** Tap scroll/text area to hide or restore scroll (parent remembers pre-hide state). */
    onToggleScrollVisibility?: () => void;
    onPlayText?: (text: string, index: number, e: React.MouseEvent) => void;
    highlightedWordIndex?: number;
    wordAlignment?: { words: Array<{ word: string; start: number; end: number }> } | null;
    onVideoTransition?: () => void; // Called when video loops/plays to resume TTS if suspended
    isTTSPlaying?: boolean; // When true, duck layered page video / ambient audio for TTS
    /** Separate from TTS mute: layered background-video audio (extracted URL). Defaults on. */
    ambientVideoSoundEnabled?: boolean;
    /** When true and page has 2+ text boxes: show only the box being read (sequential page / auto TTS). */
    sequentialMultiBoxTts?: boolean;
    // Character overlay props
    characterPoses?: CharacterPoses; // User's generated character poses
    showCharacterOverlay?: boolean; // Book-level setting to show character
}

export const BookPageRenderer: React.FC<BookPageRendererProps> = ({
    page,
    activeTextBoxIndex,
    scrollState,
    onScrollStateChange,
    onToggleScrollVisibility,
    onPlayText,
    highlightedWordIndex,
    wordAlignment,
    onVideoTransition,
    isTTSPlaying = false,
    ambientVideoSoundEnabled,
    sequentialMultiBoxTts = false,
    characterPoses,
    showCharacterOverlay = false
}) => {
    const { max: scrollMaxH, mid: scrollMidH } = resolveScrollHeights(page);
    const currentScrollHeightNum = scrollState === 'max' ? scrollMaxH : scrollMidH;
    const scrollOffset = page.scrollOffsetY || 0;
    const motionEnabled = scrollState !== 'hidden';

    // For backward compatibility
    const showScroll = scrollState !== 'hidden';
    const containerRef = useRef<HTMLDivElement>(null);
    const [layoutReady, setLayoutReady] = useState(false);
    // Refs for text box containers to enable scrolling
    const textBoxRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const soundEffectRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const backgroundAudioRef = useRef<HTMLAudioElement | null>(null); // For video audio extracted as separate file
    const [bubblePopped, setBubblePopped] = useState(false);
    const [bubblePosition, setBubblePosition] = useState({ x: 75, y: 20 }); // Default position (top right area)
    
    // Video sequence state - double buffer approach for seamless transitions
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [activeBuffer, setActiveBuffer] = useState<'A' | 'B'>('A'); // Which buffer is currently playing
    const videoRefA = useRef<HTMLVideoElement | null>(null);
    const videoRefB = useRef<HTMLVideoElement | null>(null);
    const [bufferAReady, setBufferAReady] = useState(false);
    const [bufferBReady, setBufferBReady] = useState(false);
    
    const sortedVideoSequence = React.useMemo(() => {
        if (!page.useVideoSequence || !page.videoSequence || page.videoSequence.length === 0) {
            return [];
        }
        return [...page.videoSequence].sort((a, b) => a.order - b.order);
    }, [page.useVideoSequence, page.videoSequence]);
    
    // Calculate next video index for preloading
    const nextVideoIndex = sortedVideoSequence.length > 0 
        ? (currentVideoIndex + 1) % sortedVideoSequence.length 
        : 0;
    
    // Image sequence state - for cycling through images with transitions
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageOpacity, setImageOpacity] = useState<number[]>([1, 0]); // Opacity for crossfade [current, next]
    const imageSequenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    const sortedImageSequence = React.useMemo(() => {
        if (!page.useImageSequence || !page.imageSequence || page.imageSequence.length === 0) {
            return [];
        }
        return [...page.imageSequence].sort((a, b) => a.order - b.order);
    }, [page.useImageSequence, page.imageSequence]);
    
    // Image sequence cycling effect
    useEffect(() => {
        if (!page.useImageSequence || sortedImageSequence.length <= 1) {
            return;
        }
        
        const duration = (page.imageSequenceDuration || 3) * 1000; // Convert to ms
        
        // Set up the cycling timer
        imageSequenceTimerRef.current = setInterval(() => {
            setCurrentImageIndex(prev => (prev + 1) % sortedImageSequence.length);
        }, duration);
        
        return () => {
            if (imageSequenceTimerRef.current) {
                clearInterval(imageSequenceTimerRef.current);
            }
        };
    }, [page.useImageSequence, sortedImageSequence.length, page.imageSequenceDuration]);
    
    // Reset image index when page changes
    useEffect(() => {
        setCurrentImageIndex(0);
    }, [page.id]);
    
    const clipForBufferA = React.useMemo(() => {
        if (!sortedVideoSequence.length) return undefined;
        const idx = activeBuffer === 'A' ? currentVideoIndex : nextVideoIndex;
        return sortedVideoSequence[idx];
    }, [sortedVideoSequence, activeBuffer, currentVideoIndex, nextVideoIndex]);

    const clipForBufferB = React.useMemo(() => {
        if (!sortedVideoSequence.length) return undefined;
        const idx = activeBuffer === 'B' ? currentVideoIndex : nextVideoIndex;
        return sortedVideoSequence[idx];
    }, [sortedVideoSequence, activeBuffer, currentVideoIndex, nextVideoIndex]);

    // Background audio - plays extracted video audio or ambient sound as separate <audio> element
    // This allows it to layer with TTS (unlike video audio which conflicts on iOS)
    // Handles both single background video audio AND video sequence audio
    useEffect(() => {
        const audio = backgroundAudioRef.current;
        if (!audio) return;

        let detachTrim: (() => void) | undefined;

        let audioUrl: string | undefined;
        let trimStartSec: number | undefined;
        let trimEndSec: number | undefined;
        let shouldSegmentLoopNative = false; // Matches video: loop single clip, advance when sequence has multiple

        if (page.useVideoSequence && sortedVideoSequence.length > 0) {
            const currentVideo = sortedVideoSequence[currentVideoIndex];
            audioUrl = currentVideo?.audioUrl;
            const ts = currentVideo?.trimStartSec;
            const te = currentVideo?.trimEndSec;
            trimStartSec = typeof ts === 'number' && ts > 0 ? ts : undefined;
            trimEndSec = typeof te === 'number' && te > 0 ? te : undefined;
            shouldSegmentLoopNative = sortedVideoSequence.length === 1;
            console.log(`🔊 Video sequence audio: playing audio for video ${currentVideoIndex + 1}`, audioUrl ? 'has audio' : 'no audio');
        } else if (page.backgroundAudioUrl) {
            audioUrl = page.backgroundAudioUrl;
            const ts = page.backgroundTrimStartSec;
            const te = page.backgroundTrimEndSec;
            trimStartSec = typeof ts === 'number' && ts > 0 ? ts : undefined;
            trimEndSec = typeof te === 'number' && te > 0 ? te : undefined;
            shouldSegmentLoopNative = true;
        }

        const trimMaybe =
            (typeof trimStartSec === 'number' && trimStartSec > 0) ||
            (typeof trimEndSec === 'number' && trimEndSec > 0);

        // Disable native loop when clamps may apply (handled by attachPlaybackTrim + segmentLoop)
        audio.loop = !trimMaybe && shouldSegmentLoopNative;

        if (audioUrl) {
            if (audio.src !== audioUrl) {
                audio.src = audioUrl;
                audio.volume = 0.7;
                audio.load();
            }

            detachTrim?.();
            detachTrim = attachPlaybackTrim(audio, {
                trimStartSec,
                trimEndSec,
                segmentLoop: () => !!shouldSegmentLoopNative,
            });

            const playAudio = () => {
                audio.play().catch(err => {
                    console.warn('🔊 Background audio autoplay prevented:', err);
                });
            };

            if (audio.readyState >= 3) {
                playAudio();
            } else {
                audio.addEventListener('canplaythrough', playAudio, { once: true });
            }
        } else {
            detachTrim?.();
            audio.pause();
            audio.src = '';
        }

        return () => {
            detachTrim?.();
            audio.pause();
            audio.currentTime = 0;
        };
    }, [
        page.id,
        page.backgroundAudioUrl,
        page.backgroundTrimStartSec,
        page.backgroundTrimEndSec,
        page.useVideoSequence,
        sortedVideoSequence,
        currentVideoIndex,
    ]);

    // Duck or silence layered page video audio when narration plays or viewer turns it off.
    useEffect(() => {
        const audio = backgroundAudioRef.current;
        if (!audio?.src?.trim()) return;
        const enabled = ambientVideoSoundEnabled !== false;
        const audible = enabled && !isTTSPlaying;
        audio.muted = !audible;
        audio.volume = audible ? 0.7 : 0;
    }, [ambientVideoSoundEnabled, isTTSPlaying, page.id, page.backgroundAudioUrl, page.useVideoSequence, sortedVideoSequence, currentVideoIndex]);

    // iOS/iPad: percentage clip-path and top can mis-measure until the container has a stable size.
    useLayoutEffect(() => {
        setLayoutReady(false);
        const el = containerRef.current;
        if (!el) {
            setLayoutReady(true);
            return;
        }
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            void el.offsetHeight;
            raf2 = requestAnimationFrame(() => setLayoutReady(true));
        });
        const ro = new ResizeObserver(() => {
            void el.offsetHeight;
            setLayoutReady(true);
        });
        ro.observe(el);
        return () => {
            cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
            ro.disconnect();
        };
    }, [page.id, scrollMaxH, scrollMidH]);

    // Swipe detection for scroll height changes
    const touchStartY = useRef<number>(0);
    const touchEndY = useRef<number>(0);
    
    const handleScrollTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
    };
    
    const handleScrollTouchEnd = (e: React.TouchEvent) => {
        touchEndY.current = e.changedTouches[0].clientY;
        const deltaY = touchStartY.current - touchEndY.current;
        const minSwipeDistance = 50; // Minimum distance for a swipe
        
        if (Math.abs(deltaY) > minSwipeDistance && onScrollStateChange) {
            if (deltaY > 0) {
                // Swipe up - increase scroll height
                const newState: ScrollState = scrollState === 'hidden' ? 'mid' : scrollState === 'mid' ? 'max' : 'max';
                onScrollStateChange(newState);
            } else {
                // Swipe down - decrease scroll height
                const newState: ScrollState = scrollState === 'max' ? 'mid' : scrollState === 'mid' ? 'hidden' : 'hidden';
                onScrollStateChange(newState);
            }
        }
    };
    
    const handleScrollClick = (e: React.MouseEvent) => {
        // Tap on scroll to toggle visibility (restore pre-hide state via parent when available)
        e.stopPropagation();
        if (onToggleScrollVisibility) {
            onToggleScrollVisibility();
        } else if (onScrollStateChange) {
            const newState: ScrollState = scrollState === 'hidden' ? 'mid' : 'hidden';
            onScrollStateChange(newState);
        }
    };

    // Auto-scroll to highlighted word - only when scroll is visible/open
    useEffect(() => {
        // Disable auto-scrolling when scroll is closed (user preference)
        if (!showScroll) {
            return;
        }
        
        if (highlightedWordIndex !== null && highlightedWordIndex !== undefined && highlightedWordIndex >= 0 && activeTextBoxIndex !== null) {
            const textBoxRef = textBoxRefs.current[activeTextBoxIndex];
            if (textBoxRef) {
                // Use a small delay to ensure the DOM has updated with the highlighted word
                const scrollTimeout = setTimeout(() => {
                    // Find the highlighted word span element using data attribute
                    const highlightedSpan = textBoxRef.querySelector(`[data-word-index="${highlightedWordIndex}"]`) as HTMLElement;
                    
                    if (highlightedSpan) {
                        // Calculate scroll position within the container (not the whole page)
                        const containerRect = textBoxRef.getBoundingClientRect();
                        const spanRect = highlightedSpan.getBoundingClientRect();
                        
                        // Calculate where the span is relative to the container's visible area
                        const spanTopRelative = spanRect.top - containerRect.top + textBoxRef.scrollTop;
                        const containerVisibleHeight = containerRect.height;
                        
                        // Calculate target scroll position to center the word
                        const targetScrollTop = spanTopRelative - (containerVisibleHeight / 2) + (spanRect.height / 2);
                        
                        // Smooth scroll within the text container only
                        textBoxRef.scrollTo({
                            top: Math.max(0, targetScrollTop),
                            behavior: 'smooth'
                        });
                    }
                }, 50); // Small delay to ensure DOM update
                
                return () => clearTimeout(scrollTimeout);
            }
        }
    }, [highlightedWordIndex, activeTextBoxIndex, showScroll]);

    // Initialize sound effect audio
    useEffect(() => {
        if (page.soundEffectUrl) {
            soundEffectRef.current = new Audio(page.soundEffectUrl);
            soundEffectRef.current.volume = 0.7; // Set volume for sound effect
            soundEffectRef.current.preload = 'auto';
        }
        
        return () => {
            if (soundEffectRef.current) {
                soundEffectRef.current.pause();
                soundEffectRef.current = null;
            }
        };
    }, [page.soundEffectUrl]);

    // Set video volume when video loads - handle both buffers for video sequence
    // NOTE: Do NOT set muted here - let React control it via the muted prop based on isTTSPlaying
    useEffect(() => {
        const activeRef = activeBuffer === 'A' ? videoRefA : videoRefB;
        if (activeRef.current) {
            activeRef.current.volume = 1.0; // Full volume for video's native audio (when not muted)
        }
        // Also set up the single video ref for non-sequence videos
        if (videoRef.current) {
            videoRef.current.volume = 1.0;
        }
    }, [currentVideoIndex, activeBuffer, page.backgroundUrl]);
    
    // Ensure video keeps playing when muted state changes (TTS starts/stops)
    // On some browsers, changing muted can pause the video
    useEffect(() => {
        // For single video background
        if (videoRef.current) {
            const video = videoRef.current;
            if (video.paused && video.readyState >= 2) {
                console.log('🎬 Video was paused, resuming playback');
                video.play().catch(err => {
                    console.warn('Could not resume video:', err);
                });
            }
        }
        // For video sequences
        const activeRef = activeBuffer === 'A' ? videoRefA : videoRefB;
        if (activeRef.current) {
            const video = activeRef.current;
            if (video.paused && video.readyState >= 2) {
                console.log('🎬 Video sequence was paused, resuming playback');
                video.play().catch(err => {
                    console.warn('Could not resume video sequence:', err);
                });
            }
        }
    }, [isTTSPlaying, activeBuffer]);

    // Reset bubble and video sequence when page changes
    useEffect(() => {
        setBubblePopped(false);
        setCurrentVideoIndex(0); // Reset video sequence to first video
        setActiveBuffer('A'); // Reset to buffer A
        setBufferAReady(false);
        setBufferBReady(false);
        // Randomize bubble position across different areas of the screen
        // Avoid the very center where text usually is, and edges where controls are
        const positions = [
            { x: 15 + Math.random() * 15, y: 15 + Math.random() * 15 },  // Top left area
            { x: 70 + Math.random() * 15, y: 15 + Math.random() * 15 },  // Top right area
            { x: 15 + Math.random() * 15, y: 45 + Math.random() * 15 },  // Middle left area
            { x: 70 + Math.random() * 15, y: 45 + Math.random() * 15 },  // Middle right area
            { x: 20 + Math.random() * 20, y: 20 + Math.random() * 20 },  // Upper left quadrant
            { x: 60 + Math.random() * 20, y: 20 + Math.random() * 20 },  // Upper right quadrant
        ];
        // Pick a random position from the array
        const randomPosition = positions[Math.floor(Math.random() * positions.length)];
        setBubblePosition(randomPosition);
        
        // Ensure video plays when page changes (autoPlay isn't always reliable on src change)
        // Use a small delay to let React update the video src first
        const playVideoTimeout = setTimeout(() => {
            // Single video background
            if (videoRef.current && page.backgroundType === 'video') {
                console.log('🎬 Page changed - ensuring video plays');
                videoRef.current.currentTime = playbackClipStart(page.backgroundTrimStartSec);
                videoRef.current.play().catch(err => {
                    console.warn('Could not play video on page change:', err);
                });
            }
            // Video sequence - play buffer A
            if (page.useVideoSequence && videoRefA.current) {
                console.log('🎬 Page changed - ensuring video sequence plays');
                const firstClip = sortedVideoSequence[0];
                videoRefA.current.currentTime = playbackClipStart(firstClip?.trimStartSec);
                videoRefA.current.play().catch(err => {
                    console.warn('Could not play video sequence on page change:', err);
                });
            }
        }, 100);
        
        return () => clearTimeout(playVideoTimeout);
    }, [page.id]);
    
    // Handle video sequence - seamlessly switch to preloaded buffer
    const handleVideoEnded = () => {
        if (sortedVideoSequence.length > 0) {
            const nextIndex = (currentVideoIndex + 1) % sortedVideoSequence.length;
            console.log(`🎬 Video ${currentVideoIndex + 1} ended, switching to video ${nextIndex + 1} of ${sortedVideoSequence.length}`);
            
            // Notify parent to keep AudioContext active during transition
            // This prevents TTS from pausing when videos switch
            onVideoTransition?.();
            
            // Switch to the other buffer (which should be preloaded)
            const newActiveBuffer = activeBuffer === 'A' ? 'B' : 'A';
            const nextClip = sortedVideoSequence[nextIndex];
            const segStart = playbackClipStart(nextClip?.trimStartSec);
            setActiveBuffer(newActiveBuffer);
            setCurrentVideoIndex(nextIndex);
            
            // Start playing the newly active buffer
            const newActiveRef = newActiveBuffer === 'A' ? videoRefA : videoRefB;
            if (newActiveRef.current) {
                newActiveRef.current.currentTime = segStart;
                newActiveRef.current.play().catch(err => {
                    console.warn('Could not autoplay next video:', err);
                });
            }
        }
    };
    
    // Get video URLs for both buffers
    const bufferAVideoUrl = sortedVideoSequence.length > 0 
        ? sortedVideoSequence[activeBuffer === 'A' ? currentVideoIndex : nextVideoIndex]?.url 
        : null;
    const bufferBVideoUrl = sortedVideoSequence.length > 0 
        ? sortedVideoSequence[activeBuffer === 'B' ? currentVideoIndex : nextVideoIndex]?.url 
        : null;

    const handleBubbleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (soundEffectRef.current && !bubblePopped) {
            setBubblePopped(true);
            soundEffectRef.current.currentTime = 0;
            soundEffectRef.current.play().catch(err => {
                console.warn('Could not play sound effect:', err);
            });
        }
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative bg-gradient-to-b from-[#fdf6e3] to-[#e8d5b7] overflow-hidden shadow-2xl"
            style={{
                // Lock background in place - prevent iOS overscroll/bounce
                overscrollBehavior: 'none',
                // pan-y only: vertical swipes change scroll state here; horizontal swipes bubble to parent for page turn (critical for Android / kids monthly books)
                touchAction: 'pan-y',
                position: 'relative',
            }}
            onClick={handleScrollClick}
            onTouchStart={handleScrollTouchStart}
            onTouchEnd={handleScrollTouchEnd}
        >
            {/* Hidden audio element for background audio (extracted video audio or ambient sound) */}
            {/* This plays as separate <audio> so it can layer with TTS - unlike video audio on iOS */}
            <audio ref={backgroundAudioRef} preload="auto" style={{ display: 'none' }} />
            
            {/* Background Layer - warm parchment gradient as fallback instead of black */}
            {/* Fixed position prevents movement during touch/swipe gestures */}
            <div 
                className="absolute inset-0 bg-gradient-to-b from-[#fdf6e3] to-[#e8d5b7] overflow-hidden"
                style={{
                    // Ensure background stays locked in place
                    touchAction: 'none',
                    pointerEvents: 'none',
                }}
            >
                {/* Video Sequence Mode - double buffered for seamless transitions */}
                {page.useVideoSequence && sortedVideoSequence.length > 0 ? (
                    <>
                        {/* Buffer A - current or preloading */}
                        <TrimmedPlaybackVideo
                            ref={videoRefA}
                            src={bufferAVideoUrl || ''}
                            className="absolute inset-0 w-full h-full object-cover min-w-full min-h-full transition-opacity duration-300"
                            autoPlay={activeBuffer === 'A'}
                            loop={sortedVideoSequence.length === 1} // Loop only if single video in sequence
                            muted // Always muted - use separate sound effects MP3 instead
                            playsInline
                            preload="auto"
                            trimStartSec={clipForBufferA?.trimStartSec}
                            trimEndSec={clipForBufferA?.trimEndSec}
                            onEnded={activeBuffer === 'A' ? handleVideoEnded : undefined}
                            onLoadedData={() => {
                                setBufferAReady(true);
                                if (videoRefA.current && activeBuffer === 'A') {
                                    videoRefA.current.volume = 1.0;
                                    // Ensure video is playing
                                    if (videoRefA.current.paused) {
                                        videoRefA.current.play().catch(err => {
                                            console.warn('Could not autoplay video A:', err);
                                        });
                                    }
                                }
                            }}
                            onCanPlayThrough={() => setBufferAReady(true)}
                            style={{
                                objectFit: 'cover',
                                width: '100%',
                                height: '100%',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                opacity: activeBuffer === 'A' ? 1 : 0,
                                zIndex: activeBuffer === 'A' ? 2 : 1,
                            }}
                        />
                        {/* Buffer B - current or preloading */}
                        <TrimmedPlaybackVideo
                            ref={videoRefB}
                            src={bufferBVideoUrl || ''}
                            className="absolute inset-0 w-full h-full object-cover min-w-full min-h-full transition-opacity duration-300"
                            autoPlay={activeBuffer === 'B'}
                            loop={sortedVideoSequence.length === 1} // Loop only if single video in sequence
                            muted // Always muted - use separate sound effects MP3 instead
                            playsInline
                            preload="auto"
                            trimStartSec={clipForBufferB?.trimStartSec}
                            trimEndSec={clipForBufferB?.trimEndSec}
                            onEnded={activeBuffer === 'B' ? handleVideoEnded : undefined}
                            onLoadedData={() => {
                                setBufferBReady(true);
                                if (videoRefB.current && activeBuffer === 'B') {
                                    videoRefB.current.volume = 1.0;
                                    // Ensure video is playing
                                    if (videoRefB.current.paused) {
                                        videoRefB.current.play().catch(err => {
                                            console.warn('Could not autoplay video B:', err);
                                        });
                                    }
                                }
                            }}
                            onCanPlayThrough={() => setBufferBReady(true)}
                            style={{
                                objectFit: 'cover',
                                width: '100%',
                                height: '100%',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                opacity: activeBuffer === 'B' ? 1 : 0,
                                zIndex: activeBuffer === 'B' ? 2 : 1,
                            }}
                        />
                    </>
                ) : /* Image Sequence Mode - crossfade transitions with camera animation */
                page.useImageSequence && sortedImageSequence.length > 0 ? (
                    <div className="absolute inset-0 w-full h-full overflow-hidden">
                        {/* Render current and next images for smooth crossfade */}
                        {sortedImageSequence.map((img, index) => {
                            const isCurrent = index === currentImageIndex;
                            const isNext = index === (currentImageIndex + 1) % sortedImageSequence.length;
                            // Only render current and next images for performance
                            if (!isCurrent && !isNext && sortedImageSequence.length > 2) return null;
                            
                            // Get animation duration
                            const animDuration = (page.imageSequenceDuration || 3);
                            const animType = page.imageSequenceAnimation || 'kenBurns';
                            
                            // Define animation keyframes based on type
                            // Each animation runs for the full duration of the image display
                            const getAnimationStyle = (): React.CSSProperties => {
                                if (!isCurrent || animType === 'none') {
                                    return { transform: 'scale(1) translate(0, 0)' };
                                }
                                
                                // For current image, apply the animation
                                // We use CSS animation with keyframes defined inline
                                const baseStyle: React.CSSProperties = {
                                    animationDuration: `${animDuration}s`,
                                    animationTimingFunction: 'ease-in-out',
                                    animationFillMode: 'forwards',
                                    animationIterationCount: 1,
                                };
                                
                                switch (animType) {
                                    case 'zoomIn':
                                        return { ...baseStyle, animationName: 'imageZoomIn' };
                                    case 'zoomOut':
                                        return { ...baseStyle, animationName: 'imageZoomOut' };
                                    case 'panLeft':
                                        return { ...baseStyle, animationName: 'imagePanLeft' };
                                    case 'panRight':
                                        return { ...baseStyle, animationName: 'imagePanRight' };
                                    case 'panUp':
                                        return { ...baseStyle, animationName: 'imagePanUp' };
                                    case 'panDown':
                                        return { ...baseStyle, animationName: 'imagePanDown' };
                                    case 'kenBurns':
                                        // Alternate between different Ken Burns effects based on index
                                        const kenBurnsVariants = ['imageKenBurns1', 'imageKenBurns2', 'imageKenBurns3', 'imageKenBurns4'];
                                        return { ...baseStyle, animationName: kenBurnsVariants[index % kenBurnsVariants.length] };
                                    default:
                                        return {};
                                }
                            };
                            
                            return (
                                <img
                                    key={`${img.url}-${currentImageIndex}`}
                                    src={img.url}
                                    alt={`Background ${index + 1}`}
                                    className="absolute w-full h-full object-cover"
                                    style={{
                                        // Scale up slightly to allow room for pan/zoom effects
                                        minWidth: '110%',
                                        minHeight: '110%',
                                        left: '-5%',
                                        top: '-5%',
                                        opacity: isCurrent ? 1 : 0,
                                        transition: 'opacity 1s ease-in-out',
                                        zIndex: isCurrent ? 2 : 1,
                                        ...getAnimationStyle(),
                                    }}
                                    loading={isCurrent ? 'eager' : 'lazy'}
                                />
                            );
                        })}
                        {/* CSS Keyframes for image animations */}
                        <style>{`
                            @keyframes imageZoomIn {
                                from { transform: scale(1) translate(0, 0); }
                                to { transform: scale(1.15) translate(0, 0); }
                            }
                            @keyframes imageZoomOut {
                                from { transform: scale(1.15) translate(0, 0); }
                                to { transform: scale(1) translate(0, 0); }
                            }
                            @keyframes imagePanLeft {
                                from { transform: scale(1.1) translateX(3%); }
                                to { transform: scale(1.1) translateX(-3%); }
                            }
                            @keyframes imagePanRight {
                                from { transform: scale(1.1) translateX(-3%); }
                                to { transform: scale(1.1) translateX(3%); }
                            }
                            @keyframes imagePanUp {
                                from { transform: scale(1.1) translateY(3%); }
                                to { transform: scale(1.1) translateY(-3%); }
                            }
                            @keyframes imagePanDown {
                                from { transform: scale(1.1) translateY(-3%); }
                                to { transform: scale(1.1) translateY(3%); }
                            }
                            @keyframes imageKenBurns1 {
                                from { transform: scale(1) translate(0, 0); }
                                to { transform: scale(1.12) translate(-2%, -1%); }
                            }
                            @keyframes imageKenBurns2 {
                                from { transform: scale(1.12) translate(2%, 1%); }
                                to { transform: scale(1) translate(-1%, 2%); }
                            }
                            @keyframes imageKenBurns3 {
                                from { transform: scale(1) translate(1%, -1%); }
                                to { transform: scale(1.1) translate(2%, 1%); }
                            }
                            @keyframes imageKenBurns4 {
                                from { transform: scale(1.1) translate(-1%, 2%); }
                                to { transform: scale(1) translate(0, -1%); }
                            }
                        `}</style>
                    </div>
                ) : /* Auto-detect video based on backgroundType OR file extension */
                (page.backgroundType === 'video' || 
                  (page.backgroundUrl && /\.(mp4|webm|mov|m4v)$/i.test(page.backgroundUrl))) ? (
                    <TrimmedPlaybackVideo
                        ref={videoRef}
                        src={page.backgroundUrl}
                        className="absolute inset-0 w-full h-full object-cover min-w-full min-h-full"
                        autoPlay
                        loop
                        muted // Always muted - use separate sound effects MP3 instead
                        playsInline
                        preload="auto"
                        trimStartSec={page.backgroundTrimStartSec}
                        trimEndSec={page.backgroundTrimEndSec}
                        onLoadedData={() => {
                            if (videoRef.current) {
                                // Ensure video is playing
                                if (videoRef.current.paused) {
                                    videoRef.current.play().catch(err => {
                                        console.warn('Could not autoplay video on load:', err);
                                    });
                                }
                            }
                        }}
                        style={{
                            objectFit: 'cover',
                            width: '100%',
                            height: '100%',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                        }}
                    />
                ) : page.backgroundUrl ? (
                    (() => {
                        const bgAnim = page.backgroundImageAnimation ?? 'kenBurns';
                        const bgDuration = page.backgroundImageAnimationDuration ?? 10;
                        const useAnimation = bgAnim && bgAnim !== 'none' && bgDuration > 0;
                        const getSingleImageAnimationStyle = (): React.CSSProperties => {
                            if (!useAnimation) return {};
                            const base: React.CSSProperties = {
                                animationDuration: `${bgDuration}s`,
                                animationTimingFunction: 'ease-in-out',
                                animationFillMode: 'forwards',
                                animationIterationCount: 'infinite',
                                animationDirection: 'alternate',
                            };
                            switch (bgAnim) {
                                case 'zoomIn': return { ...base, animationName: 'imageZoomIn' };
                                case 'zoomOut': return { ...base, animationName: 'imageZoomOut' };
                                case 'panLeft': return { ...base, animationName: 'imagePanLeft' };
                                case 'panRight': return { ...base, animationName: 'imagePanRight' };
                                case 'panUp': return { ...base, animationName: 'imagePanUp' };
                                case 'panDown': return { ...base, animationName: 'imagePanDown' };
                                case 'kenBurns': return { ...base, animationName: 'imageKenBurns1' };
                                default: return {};
                            }
                        };
                        return (
                            <div className="absolute inset-0 w-full h-full overflow-hidden">
                                <img
                                    src={page.backgroundUrl}
                                    alt={`Page ${page.pageNumber}`}
                                    className="w-full h-full object-cover"
                                    loading="eager"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        minWidth: useAnimation ? '110%' : '100%',
                                        minHeight: useAnimation ? '110%' : '100%',
                                        ...(useAnimation ? { left: '-5%', top: '-5%', ...getSingleImageAnimationStyle() } : { width: '100%', height: '100%' }),
                                    }}
                                />
                                {useAnimation && (
                                    <style>{`
                                        @keyframes imageZoomIn {
                                            from { transform: scale(1) translate(0, 0); }
                                            to { transform: scale(1.15) translate(0, 0); }
                                        }
                                        @keyframes imageZoomOut {
                                            from { transform: scale(1.15) translate(0, 0); }
                                            to { transform: scale(1) translate(0, 0); }
                                        }
                                        @keyframes imagePanLeft {
                                            from { transform: scale(1.1) translateX(3%); }
                                            to { transform: scale(1.1) translateX(-3%); }
                                        }
                                        @keyframes imagePanRight {
                                            from { transform: scale(1.1) translateX(-3%); }
                                            to { transform: scale(1.1) translateX(3%); }
                                        }
                                        @keyframes imagePanUp {
                                            from { transform: scale(1.1) translateY(3%); }
                                            to { transform: scale(1.1) translateY(-3%); }
                                        }
                                        @keyframes imagePanDown {
                                            from { transform: scale(1.1) translateY(-3%); }
                                            to { transform: scale(1.1) translateY(3%); }
                                        }
                                        @keyframes imageKenBurns1 {
                                            from { transform: scale(1) translate(0, 0); }
                                            to { transform: scale(1.12) translate(-2%, -1%); }
                                        }
                                    `}</style>
                                )}
                            </div>
                        );
                    })()
                ) : null}
            </div>

            {/* Gradient Overlay for depth (spine shadow) */}
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/20 to-transparent pointer-events-none z-10" />

            {/* Character Overlay Layer */}
            {showCharacterOverlay && 
             characterPoses && 
             page.characterOverlay?.showCharacter !== false && (
                (() => {
                    const overlay = page.characterOverlay || {
                        pose: 'standing_front',
                        x: 75,
                        y: 70,
                        scale: 1.0,
                        flipHorizontal: false,
                        showCharacter: true
                    };
                    
                    const poseData = characterPoses[overlay.pose] || characterPoses['standing_front'];
                    
                    if (!poseData?.url) return null;
                    
                    return (
                        <div
                            className="absolute pointer-events-none z-[12] transition-all duration-500"
                            style={{
                                left: `${overlay.x}%`,
                                top: `${overlay.y}%`,
                                transform: `translate(-50%, -50%) scaleX(${overlay.flipHorizontal ? -1 : 1})`,
                            }}
                        >
                            <img
                                src={poseData.url}
                                alt="Your character"
                                className="max-w-none drop-shadow-lg"
                                style={{
                                    width: `${overlay.scale * 150}px`, // Base size 150px, scaled
                                    height: 'auto',
                                    filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))',
                                }}
                                loading="eager"
                            />
                        </div>
                    );
                })()
            )}

            {/* Scroll Image Layer - Three states: hidden, mid, max */}
            {page.scrollUrl && (
                <div
                    className="absolute ease-in-out"
                    style={{ 
                        zIndex: 15, // Between z-10 (gradient) and z-20 (text boxes)
                        height: `${currentScrollHeightNum}%`,
                        width: `${page.scrollWidth || 100}%`,
                        // Position horizontally: center + offset
                        left: `calc(50% + ${page.scrollOffsetX || 0}%)`,
                        // Center horizontally with translateX, hide scroll with translateY when hidden
                        transform: scrollState === 'hidden' 
                            ? 'translateX(-50%) translateY(100%)' 
                            : 'translateX(-50%)',
                        bottom: `${scrollOffset}%`, // Apply vertical offset
                        transition: layoutReady && motionEnabled ? 'all 0.5s ease-in-out' : 'none',
                    }}
                >
                    <img
                        src={page.scrollUrl}
                        alt="Scroll background"
                        className="w-full h-full object-fill pointer-events-none"
                        style={{ opacity: (page.scrollOpacity != null ? page.scrollOpacity : 100) / 100 }}
                    />
                </div>
            )}
            
            {/* Swipe Indicator - Inside the scroll, at the top */}
            {page.scrollUrl && scrollState !== 'hidden' && (
                <div 
                    className="absolute left-1/2 transform -translate-x-1/2 z-20 pointer-events-none ease-in-out"
                    style={{
                        bottom: `calc(${currentScrollHeightNum}% + ${scrollOffset}% - 24px)`,
                        transition: layoutReady && motionEnabled ? 'all 0.5s ease-in-out' : 'none',
                    }}
                >
                    <div className="flex flex-col items-center gap-0.5 opacity-50">
                        <div className="w-10 h-1 bg-white rounded-full shadow"></div>
                        <span className="text-white/90 text-[9px] font-medium drop-shadow">
                            {scrollState === 'mid' ? '↑ Swipe for more' : '↓ Swipe to shrink'}
                        </span>
                    </div>
                </div>
            )}

            {/* Text Boxes Layer - Below swipe zone */}
            {/* Text boxes layer - z-50 to appear above play button (z-40) */}
            {/* When scroll exists, clip text to scroll bounds (top AND bottom) to prevent overflow */}
            <div
                className="absolute inset-0 pointer-events-none z-50"
                style={page.scrollUrl ? {
                    clipPath: scrollState === 'hidden' 
                        ? 'inset(100% 0 0 0)' // Hide all when scroll is hidden
                        : `inset(${100 - currentScrollHeightNum - scrollOffset}% 0 ${scrollOffset + 5}% 0)`,
                    transition: layoutReady && motionEnabled ? 'clip-path 0.5s ease-in-out' : 'none',
                } : {}}
            >
                {page.textBoxes?.map((box, idx) => {
                    const tbCount = page.textBoxes?.length ?? 0;
                    const hideThisBoxSequential =
                        sequentialMultiBoxTts &&
                        tbCount > 1 &&
                        (activeTextBoxIndex === null ? true : idx !== activeTextBoxIndex);

                    // Validate box has required position properties
                    const boxX = typeof box.x === 'number' ? box.x : 0;
                    const boxY = typeof box.y === 'number' ? box.y : 0;
                    
                    const isActive = activeTextBoxIndex === idx;
                    const shouldHideTextBoxes = page.scrollUrl && scrollState === 'hidden';
                    
                    // Calculate text position (match portal PageEditor: max(boxY, scroll top + buffer))
                    let textTopStyle: string;
                    let textMaxHeightStyle: string;
                    
                    if (page.scrollUrl) {
                        const scrollTopPosition = `calc(100% - ${currentScrollHeightNum}% - ${scrollOffset}% + 12px)`;
                        textTopStyle = `max(${boxY}%, ${scrollTopPosition})`;
                        const scrollStartPercent = 100 - currentScrollHeightNum - scrollOffset + 3;
                        const effectiveTopPercent = Math.max(boxY, scrollStartPercent);
                        const scrollBottomBuffer = scrollOffset + 8;
                        textMaxHeightStyle = `calc(${100 - scrollBottomBuffer}% - ${effectiveTopPercent}%)`;
                    } else {
                        textTopStyle = `${boxY}%`;
                        textMaxHeightStyle = `calc(100% - ${boxY}% - 40px)`;
                    }

                    const showBg = box.showBackground === true;
                    
                    return (
                        <div
                            key={idx}
                            ref={(el) => { textBoxRefs.current[idx] = el; }}
                            data-scroll-container="true"
                            className="absolute pointer-events-auto overflow-y-auto p-2 group"
                            aria-hidden={hideThisBoxSequential}
                            style={{
                                // Add safe area padding for landscape mode (notch/Dynamic Island)
                                // Use calc to ensure minimum 3% from edge + safe area
                                left: `calc(max(${boxX}%, 3%) + env(safe-area-inset-left, 0px))`,
                                top: textTopStyle,
                                width: `min(${box.width || 30}%, calc(100% - max(${boxX}%, 3%) - 3% - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))`,
                                textAlign: box.alignment || 'left',
                                color: box.color || '#4a3b2a',
                                // Use Google Font with fallbacks for iOS compatibility
                                // Comic Sans MS may not be available on iOS
                                // Patrick Hand renders ~20% smaller than Comic Sans, so scale up
                                fontFamily: box.fontFamily === 'Comic Sans MS' 
                                    ? "'Patrick Hand', 'Comic Sans MS', 'Bubblegum Sans', cursive" 
                                    : (box.fontFamily || "'Patrick Hand', 'Comic Sans MS', cursive"),
                                // Increase font size by 20% when using Patrick Hand fallback (it renders smaller)
                                fontSize: (box.fontFamily === 'Comic Sans MS' || !box.fontFamily)
                                    ? `${Math.round((box.fontSize || 24) * 1.2)}px`
                                    : `${box.fontSize || 24}px`,
                                maxHeight: textMaxHeightStyle,
                                overflowY: 'auto',
                                // pan-y: only vertical scroll in this box; horizontal swipes bubble to parent for page turn (fixes Android)
                                touchAction: 'pan-y',
                                // Text shadow/glow for readability - color controlled by shadowColor setting
                                textShadow: box.shadowColor === 'black'
                                    ? '0 0 8px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.7), 1px 1px 4px rgba(0,0,0,0.8)'
                                    : '0 0 8px rgba(255,255,255,0.9), 0 0 16px rgba(255,255,255,0.7), 1px 1px 4px rgba(255,255,255,0.8)',
                                scrollBehavior: 'smooth',
                                // Only use opacity for smooth hide/show - no translateY to avoid layout jump
                                opacity: hideThisBoxSequential ? 0 : shouldHideTextBoxes ? 0 : 1,
                                transition: layoutReady
                                    ? 'opacity 0.4s ease-in-out, top 0.5s ease-in-out, max-height 0.5s ease-in-out'
                                    : 'none',
                                pointerEvents:
                                    hideThisBoxSequential || shouldHideTextBoxes ? 'none' : 'auto',
                                ...(hideThisBoxSequential ? { display: 'none' as const } : {}),
                                // Show background box if user explicitly enabled it
                                backgroundColor: showBg ? (box.backgroundColor || 'rgba(255,255,255,0.85)') : 'transparent',
                                borderRadius: showBg ? '12px' : '0',
                                padding: showBg ? '12px 16px' : '8px',
                            }}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent scroll toggle when tapping text
                                onPlayText && onPlayText(box.text, idx, e);
                            }}
                        >
                            <div className={`
                                relative rounded-xl transition-all duration-300
                                ${isActive
                                    ? 'shadow-[0_0_15px_rgba(255,215,0,0.4)] scale-105'
                                    : 'hover:scale-102 cursor-pointer'
                                }
                            `}>
                                <p className="leading-relaxed relative drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]" style={{ whiteSpace: 'pre-wrap' }}>
                                    {(() => {
                                        // Always use the cleaned text from the original
                                        const cleanedText = removeEmotionalCues(box.text);
                                        const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
                                        
                                        // If active with word alignment, show with highlighting
                                        if (isActive && wordAlignment && highlightedWordIndex >= 0) {
                                            return words.map((word, wIdx) => {
                                                const isHighlighted = wIdx === highlightedWordIndex;
                                                const isUpcoming =
                                                    highlightedWordIndex >= 0 && wIdx > highlightedWordIndex;
                                                const isPast =
                                                    highlightedWordIndex >= 0 && wIdx < highlightedWordIndex;
                                                return (
                                                    <span
                                                        key={wIdx}
                                                        data-word-index={wIdx}
                                                        className={`
                                                            gk-readalong-word rounded px-0.5
                                                            ${isHighlighted
                                                                ? 'gk-readalong-word--current opacity-100 bg-[#FFD700] text-black font-bold shadow-[0_0_22px_rgba(255,215,0,0.55),0_3px_8px_rgba(0,0,0,0.15)] ring-2 ring-amber-200/80'
                                                                : isUpcoming
                                                                    ? 'opacity-42'
                                                                    : isPast
                                                                        ? 'opacity-78'
                                                                        : ''
                                                            }
                                                        `}
                                                    >
                                                        {word}{' '}
                                                    </span>
                                                );
                                            });
                                        }
                                        
                                        // Standard rendering - preserve line breaks
                                        return cleanedText;
                                    })()}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Floating Sound Effect Bubble */}
            {page.soundEffectUrl && !bubblePopped && (
                <div
                    className="absolute z-30 cursor-pointer"
                    style={{
                        left: `${bubblePosition.x}%`,
                        top: `${bubblePosition.y}%`,
                        transform: 'translate(-50%, -50%)',
                        animation: 'float 3s ease-in-out infinite'
                    }}
                    onClick={handleBubbleClick}
                >
                    <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200 border-2 border-white">
                            <Music className="w-8 h-8 text-white" />
                        </div>
                        {/* Ripple effect */}
                        <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75"></div>
                    </div>
                    <style>{`
                        @keyframes float {
                            0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
                            50% { transform: translate(-50%, -50%) translateY(-10px); }
                        }
                    `}</style>
                </div>
            )}

            {/* Popped bubble animation */}
            {bubblePopped && (
                <div
                    className="absolute z-30 pointer-events-none"
                    style={{
                        left: `${bubblePosition.x}%`,
                        top: `${bubblePosition.y}%`,
                        transform: 'translate(-50%, -50%)',
                        animation: 'pop 0.5s ease-out forwards'
                    }}
                >
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full opacity-0 flex items-center justify-center">
                        <Music className="w-10 h-10 text-white" />
                    </div>
                    <style>{`
                        @keyframes pop {
                            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                            100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};
