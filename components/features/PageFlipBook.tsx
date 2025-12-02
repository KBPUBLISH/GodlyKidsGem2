import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PageFlip } from 'page-flip';

interface Page {
    _id: string;
    pageNumber: number;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    scrollUrl?: string;
    scrollHeight?: number;
    textBoxes?: Array<{
        text: string;
        x: number;
        y: number;
        width?: number;
        alignment?: 'left' | 'center' | 'right';
        fontFamily?: string;
        fontSize?: number;
        color?: string;
    }>;
}

interface PageFlipBookProps {
    pages: Page[];
    currentPageIndex: number;
    onPageChange: (pageIndex: number) => void;
    showScroll: boolean;
    onToggleScroll: () => void;
    width: number;
    height: number;
}

// Single page component that renders inside the flip book
const BookPage: React.FC<{ 
    page: Page; 
    showScroll: boolean;
    pageIndex: number;
}> = ({ page, showScroll, pageIndex }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // Auto-play video when page becomes visible
        if (videoRef.current && page.backgroundType === 'video') {
            videoRef.current.play().catch(() => {});
        }
    }, [page]);

    return (
        <div 
            className="page-content"
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#1a1a2e',
            }}
        >
            {/* Background - Video or Image */}
            {page.backgroundType === 'video' && page.backgroundUrl ? (
                <video
                    ref={videoRef}
                    src={page.backgroundUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            ) : page.backgroundUrl ? (
                <img
                    src={page.backgroundUrl}
                    alt={`Page ${pageIndex + 1}`}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            ) : (
                <div 
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    }}
                />
            )}

            {/* Scroll Overlay */}
            {showScroll && page.scrollUrl && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: page.scrollHeight || '30%',
                        backgroundImage: `url(${page.scrollUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transition: 'transform 0.3s ease',
                    }}
                />
            )}

            {/* Text Boxes */}
            {page.textBoxes?.map((textBox, idx) => (
                <div
                    key={idx}
                    style={{
                        position: 'absolute',
                        left: `${textBox.x}%`,
                        top: `${textBox.y}%`,
                        width: textBox.width ? `${textBox.width}%` : 'auto',
                        maxWidth: '90%',
                        fontFamily: textBox.fontFamily || 'Comic Sans MS',
                        fontSize: `${(textBox.fontSize || 24) * 0.8}px`, // Scale down for flip book
                        color: textBox.color || '#4a3b2a',
                        textAlign: textBox.alignment || 'left',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255, 248, 220, 0.9)',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        lineHeight: 1.4,
                        transform: 'translateX(-50%)',
                    }}
                >
                    {textBox.text}
                </div>
            ))}

            {/* Page Number */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '12px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.6)',
                    fontFamily: 'serif',
                }}
            >
                {pageIndex + 1}
            </div>
        </div>
    );
};

const PageFlipBook: React.FC<PageFlipBookProps> = ({
    pages,
    currentPageIndex,
    onPageChange,
    showScroll,
    onToggleScroll,
    width,
    height,
}) => {
    const bookRef = useRef<HTMLDivElement>(null);
    const pageFlipRef = useRef<PageFlip | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Initialize PageFlip
    useEffect(() => {
        if (!bookRef.current || pages.length === 0) return;

        // Clean up existing instance
        if (pageFlipRef.current) {
            pageFlipRef.current.destroy();
        }

        // Create new PageFlip instance
        const pageFlip = new PageFlip(bookRef.current, {
            width: width,
            height: height,
            size: 'stretch',
            minWidth: 300,
            maxWidth: 1200,
            minHeight: 400,
            maxHeight: 1600,
            maxShadowOpacity: 0.5,
            showCover: false,
            mobileScrollSupport: false,
            clickEventForward: true,
            useMouseEvents: true,
            swipeDistance: 30,
            showPageCorners: true,
            disableFlipByClick: false,
            flippingTime: 800,
            usePortrait: true,
            startZIndex: 0,
            autoSize: true,
            drawShadow: true,
        });

        // Load pages from HTML elements
        const pageElements = bookRef.current.querySelectorAll('.flip-page');
        if (pageElements.length > 0) {
            pageFlip.loadFromHTML(pageElements as NodeListOf<HTMLElement>);
        }

        // Event listeners
        pageFlip.on('flip', (e: any) => {
            onPageChange(e.data);
        });

        pageFlip.on('changeState', (e: any) => {
            // Can use this for loading states
        });

        pageFlipRef.current = pageFlip;
        setIsReady(true);

        // Go to current page
        if (currentPageIndex > 0) {
            setTimeout(() => {
                pageFlip.turnToPage(currentPageIndex);
            }, 100);
        }

        return () => {
            if (pageFlipRef.current) {
                pageFlipRef.current.destroy();
                pageFlipRef.current = null;
            }
        };
    }, [pages.length, width, height]);

    // Sync external page changes
    useEffect(() => {
        if (pageFlipRef.current && isReady) {
            const currentFlipPage = pageFlipRef.current.getCurrentPageIndex();
            if (currentFlipPage !== currentPageIndex) {
                pageFlipRef.current.turnToPage(currentPageIndex);
            }
        }
    }, [currentPageIndex, isReady]);

    // Navigation methods
    const flipNext = useCallback(() => {
        if (pageFlipRef.current) {
            pageFlipRef.current.flipNext();
        }
    }, []);

    const flipPrev = useCallback(() => {
        if (pageFlipRef.current) {
            pageFlipRef.current.flipPrev();
        }
    }, []);

    return (
        <div 
            className="page-flip-container"
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#111',
                position: 'relative',
            }}
        >
            {/* The flip book container */}
            <div 
                ref={bookRef}
                className="flip-book"
                style={{
                    width: `${width}px`,
                    height: `${height}px`,
                }}
            >
                {/* Render all pages */}
                {pages.map((page, index) => (
                    <div 
                        key={page._id || index}
                        className="flip-page"
                        data-density="soft"
                    >
                        <BookPage 
                            page={page}
                            showScroll={showScroll}
                            pageIndex={index}
                        />
                    </div>
                ))}
            </div>

            {/* Navigation hints */}
            <div 
                className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm pointer-events-none"
                style={{ zIndex: 100 }}
            >
                Drag corner to turn page
            </div>

            {/* Manual navigation buttons (optional) */}
            <button
                onClick={flipPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors"
                style={{ zIndex: 100 }}
                disabled={currentPageIndex === 0}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <button
                onClick={flipNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors"
                style={{ zIndex: 100 }}
                disabled={currentPageIndex >= pages.length - 1}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
};

export default PageFlipBook;


