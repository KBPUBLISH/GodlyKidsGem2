import React, { useEffect, useRef, useState } from 'react';
import { removeEmotionalCues } from '../../utils/textProcessing';
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
    soundEffectUrl?: string;
}

// Scroll state types
export type ScrollState = 'hidden' | 'mid' | 'max';

interface BookPageRendererProps {
    page: PageData;
    activeTextBoxIndex: number | null;
    scrollState: ScrollState;
    onScrollStateChange?: (newState: ScrollState) => void;
    onPlayText?: (text: string, index: number, e: React.MouseEvent) => void;
    highlightedWordIndex?: number;
    wordAlignment?: { words: Array<{ word: string; start: number; end: number }> } | null;
}

export const BookPageRenderer: React.FC<BookPageRendererProps> = ({
    page,
    activeTextBoxIndex,
    scrollState,
    onScrollStateChange,
    onPlayText,
    highlightedWordIndex,
    wordAlignment
}) => {
    // DEBUG: Log highlighting props when they change
    useEffect(() => {
        if (activeTextBoxIndex !== null || highlightedWordIndex !== undefined) {
            console.log('🎯 HIGHLIGHT DEBUG:', {
                activeTextBoxIndex,
                highlightedWordIndex,
                hasWordAlignment: !!wordAlignment,
                wordCount: wordAlignment?.words?.length || 0
            });
        }
    }, [activeTextBoxIndex, highlightedWordIndex, wordAlignment]);
    
    // For backward compatibility
    const showScroll = scrollState !== 'hidden';
    // Refs for text box containers to enable scrolling
    const textBoxRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const soundEffectRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [bubblePopped, setBubblePopped] = useState(false);
    const [videoUnmuted, setVideoUnmuted] = useState(false);
    const [bubblePosition, setBubblePosition] = useState({ x: 75, y: 20 }); // Default position (top right area)
    
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
        // Tap on scroll to toggle visibility (mid <-> hidden)
        e.stopPropagation();
        if (onScrollStateChange) {
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
                        // Scroll the highlighted word into view with some padding
                        highlightedSpan.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'nearest'
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

    // Handle video audio - unmute on first user interaction (iOS requirement)
    useEffect(() => {
        const handleUserInteraction = () => {
            if (videoRef.current && !videoUnmuted) {
                videoRef.current.muted = false;
                videoRef.current.volume = 0.3; // Background audio at 30% volume
                setVideoUnmuted(true);
                console.log('🎬 Video unmuted after user interaction');
            }
        };

        // Listen for first user interaction to unmute video
        document.addEventListener('touchstart', handleUserInteraction, { once: true });
        document.addEventListener('click', handleUserInteraction, { once: true });

        return () => {
            document.removeEventListener('touchstart', handleUserInteraction);
            document.removeEventListener('click', handleUserInteraction);
        };
    }, [videoUnmuted]);

    // Set video volume when video ref is available
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = 0.3; // Background audio at 30% volume
        }
    }, [page.backgroundUrl]);

    // Reset bubble when page changes
    useEffect(() => {
        setBubblePopped(false);
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
    }, [page.id]);

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
            className="w-full h-full relative bg-gradient-to-b from-[#fdf6e3] to-[#e8d5b7] overflow-hidden shadow-2xl"
            style={{
                // Lock background in place - prevent iOS overscroll/bounce
                overscrollBehavior: 'none',
                touchAction: 'pan-x', // Allow horizontal swipes only at container level
                position: 'relative',
            }}
            onClick={handleScrollClick}
            onTouchStart={handleScrollTouchStart}
            onTouchEnd={handleScrollTouchEnd}
        >
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
                {page.backgroundType === 'video' ? (
                    <video
                        ref={videoRef}
                        src={page.backgroundUrl}
                        className="absolute inset-0 w-full h-full object-cover min-w-full min-h-full"
                        autoPlay
                        loop
                        muted={!videoUnmuted} // Start muted for iOS autoplay, unmute on user interaction
                        playsInline
                        preload="auto"
                        onLoadedData={() => {
                            // Set volume once video is loaded
                            if (videoRef.current) {
                                videoRef.current.volume = 0.3;
                            }
                        }}
                        style={{
                            objectFit: 'cover',
                            width: '100%',
                            height: '100%',
                            // Lock video in place
                            position: 'absolute',
                            top: 0,
                            left: 0,
                        }}
                    />
                ) : page.backgroundUrl ? (
                    <img
                        src={page.backgroundUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-full object-contain"
                        loading="eager"
                        style={{
                            // Lock image in place
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                        }}
                    />
                ) : null}
            </div>

            {/* Gradient Overlay for depth (spine shadow) */}
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/20 to-transparent pointer-events-none z-10" />

            {/* Scroll Image Layer - Three states: hidden, mid, max */}
            {page.scrollUrl && (
                <div
                    className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ease-in-out z-15 ${
                        scrollState === 'hidden' ? 'translate-y-full' : 'translate-y-0'
                    }`}
                    style={{ 
                        // Use scrollMidHeight/scrollMaxHeight if set, otherwise fallback to defaults
                        height: scrollState === 'max' 
                            ? `${page.scrollMaxHeight || 60}%` 
                            : `${page.scrollMidHeight || 30}%`
                    }}
                >
                    <img
                        src={page.scrollUrl}
                        alt="Scroll background"
                        className="w-full h-full object-fill pointer-events-none"
                    />
                </div>
            )}
            
            {/* Swipe Indicator - Inside the scroll, at the top */}
            {page.scrollUrl && scrollState !== 'hidden' && (
                <div 
                    className="absolute left-1/2 transform -translate-x-1/2 z-20 pointer-events-none transition-all duration-500 ease-in-out"
                    style={{
                        bottom: scrollState === 'max' 
                            ? `calc(${page.scrollMaxHeight || 60}% - 24px)` 
                            : `calc(${page.scrollMidHeight || 30}% - 24px)`
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
            <div
                className="absolute inset-0 pointer-events-none z-20"
            >
                {page.textBoxes?.map((box, idx) => {
                    // Calculate scroll height based on state - use configured heights or defaults
                    const scrollHeightVal = scrollState === 'max' 
                        ? `${page.scrollMaxHeight || 60}%` 
                        : `${page.scrollMidHeight || 30}%`;
                    const scrollTopVal = `calc(100% - ${scrollHeightVal})`;
                    const isActive = activeTextBoxIndex === idx;
                    // Text boxes should fade and slide with the scroll
                    const shouldHideTextBoxes = page.scrollUrl && scrollState === 'hidden';

                    return (
                        <div
                            key={idx}
                            ref={(el) => { textBoxRefs.current[idx] = el; }}
                            data-scroll-container="true"
                            className="absolute pointer-events-auto overflow-y-auto p-2 pt-8 group"
                            style={{
                                left: `${box.x}%`,
                                top: page.scrollUrl 
                                    ? `max(${box.y}%, calc(${scrollTopVal} + 12px))` 
                                    : `${box.y}%`,
                                width: `${box.width || 30}%`,
                                textAlign: box.alignment || 'left',
                                color: box.color || '#4a3b2a',
                                fontFamily: box.fontFamily || 'Comic Sans MS',
                                fontSize: `${box.fontSize || 24}px`,
                                maxHeight: page.scrollUrl
                                    ? `calc(100% - max(${box.y}%, ${scrollTopVal}) - 70px)`
                                    : `calc(100% - ${box.y}% - 60px)`,
                                overflowY: 'auto',
                                textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                                scrollBehavior: 'smooth',
                                // Only use opacity for smooth hide/show - no translateY to avoid layout jump
                                opacity: shouldHideTextBoxes ? 0 : 1,
                                transition: 'opacity 0.4s ease-in-out, top 0.5s ease-in-out',
                                pointerEvents: shouldHideTextBoxes ? 'none' : 'auto',
                            }}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent scroll toggle when tapping text
                                onPlayText && onPlayText(box.text, idx, e);
                            }}
                        >
                            <div className={`
                                relative p-3 rounded-xl transition-all duration-300
                                ${isActive
                                    ? 'shadow-[0_0_15px_rgba(255,215,0,0.4)] scale-105'
                                    : 'hover:scale-102 cursor-pointer'
                                }
                            `}>
                                <p className="leading-relaxed relative drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                                    {(() => {
                                        // Always use the cleaned text from the original
                                        const cleanedText = removeEmotionalCues(box.text);
                                        const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
                                        
                                        // If active with word alignment, show with highlighting
                                        if (isActive && wordAlignment && highlightedWordIndex >= 0) {
                                            return words.map((word, wIdx) => {
                                                const isHighlighted = wIdx === highlightedWordIndex;
                                                return (
                                                    <span
                                                        key={wIdx}
                                                        data-word-index={wIdx}
                                                        className={`
                                                            transition-all duration-150 rounded px-0.5
                                                            ${isHighlighted
                                                                ? 'bg-[#FFD700] text-black font-bold scale-110 inline-block shadow-sm'
                                                                : ''
                                                            }
                                                        `}
                                                    >
                                                        {word}{' '}
                                                    </span>
                                                );
                                            });
                                        }
                                        
                                        // Standard rendering - just show text
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
