import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface WebViewPageRendererProps {
    url: string;
    title?: string;
    onContinue: () => void;
    showButton?: boolean;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
}

/**
 * WebViewPageRenderer - Renders an embedded web view as a book page
 * 
 * Features:
 * - Full-screen iframe for the web content
 * - Optional overlay title
 * - "Continue Reading" button for navigation
 * - Swipe gesture support for page navigation
 * - Loading state with spinner
 * - Error handling for failed loads
 */
const WebViewPageRenderer: React.FC<WebViewPageRendererProps> = ({
    url,
    title,
    onContinue,
    showButton = true,
    onSwipeLeft,
    onSwipeRight,
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    // Touch handling for swipe gestures
    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);
    const touchEndX = useRef<number>(0);
    const touchEndY = useRef<number>(0);
    
    // Handle iframe load events
    const handleLoad = () => {
        setIsLoading(false);
        setHasError(false);
    };
    
    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
        setErrorMessage('Failed to load content');
    };
    
    // Retry loading
    const handleRetry = () => {
        setIsLoading(true);
        setHasError(false);
        if (iframeRef.current) {
            iframeRef.current.src = url;
        }
    };
    
    // Touch handlers for swipe detection
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
        touchEndY.current = e.touches[0].clientY;
    };
    
    const handleTouchEnd = () => {
        const deltaX = touchEndX.current - touchStartX.current;
        const deltaY = touchEndY.current - touchStartY.current;
        
        // Only register as swipe if horizontal movement is greater than vertical
        // and the swipe distance is significant (> 50px)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX < 0 && onSwipeLeft) {
                // Swiped left - go to next page
                onSwipeLeft();
            } else if (deltaX > 0 && onSwipeRight) {
                // Swiped right - go to previous page
                onSwipeRight();
            }
        }
    };
    
    // Validate URL
    const isValidUrl = (urlString: string): boolean => {
        try {
            new URL(urlString);
            return true;
        } catch {
            return false;
        }
    };
    
    // Check URL validity on mount
    useEffect(() => {
        if (!url || !isValidUrl(url)) {
            setIsLoading(false);
            setHasError(true);
            setErrorMessage('Invalid URL provided');
        }
    }, [url]);
    
    if (!url) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-amber-50 to-amber-100">
                <div className="text-center p-6">
                    <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-amber-800 mb-2">No Content URL</h2>
                    <p className="text-amber-600">This web view page doesn't have a URL configured.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div 
            className="absolute inset-0 flex flex-col bg-gray-900"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Title Overlay (if provided) */}
            {title && (
                <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent p-4 pt-safe">
                    <h2 className="text-white text-lg font-bold text-center drop-shadow-lg">
                        {title}
                    </h2>
                </div>
            )}
            
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-indigo-900 to-purple-900">
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
                        <p className="text-white/80 text-lg">Loading interactive content...</p>
                    </div>
                </div>
            )}
            
            {/* Error State */}
            {hasError && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-red-900 to-red-800">
                    <div className="text-center p-6">
                        <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Couldn't Load Content</h2>
                        <p className="text-red-200 mb-6">{errorMessage}</p>
                        <button
                            onClick={handleRetry}
                            className="px-6 py-3 bg-white text-red-800 rounded-full font-semibold flex items-center gap-2 mx-auto hover:bg-red-50 transition-colors"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Try Again
                        </button>
                    </div>
                </div>
            )}
            
            {/* Web View (iframe) */}
            <iframe
                ref={iframeRef}
                src={url}
                className="flex-1 w-full h-full border-0"
                onLoad={handleLoad}
                onError={handleError}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                title="Interactive Content"
            />
            
            {/* Navigation Button - Top Right (to avoid blocking web content) */}
            {showButton && !isLoading && !hasError && (
                <div className="absolute top-3 right-3 z-20">
                    <button
                        onClick={onContinue}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-bold text-sm flex items-center gap-1.5 shadow-lg hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all"
                    >
                        Next
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
            
            {/* Swipe hint (shows briefly on mount) */}
            <SwipeHint />
        </div>
    );
};

/**
 * SwipeHint - Shows a brief animation indicating swipe is available
 */
const SwipeHint: React.FC = () => {
    const [show, setShow] = useState(true);
    
    useEffect(() => {
        const timer = setTimeout(() => setShow(false), 3000);
        return () => clearTimeout(timer);
    }, []);
    
    if (!show) return null;
    
    return (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex justify-between px-4">
            <div className="animate-pulse">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <ChevronRight className="w-5 h-5 text-white/60 rotate-180" />
                </div>
            </div>
            <div className="animate-pulse">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <ChevronRight className="w-5 h-5 text-white/60" />
                </div>
            </div>
        </div>
    );
};

export default WebViewPageRenderer;

