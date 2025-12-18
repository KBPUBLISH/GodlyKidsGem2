import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Home, ShoppingBag, Star, Pin, PinOff } from 'lucide-react';
import DrawingCanvas from './DrawingCanvas';
import { pinnedColoringService, parseColoringPageId } from '../../services/pinnedColoringService';

interface ColoringModalProps {
    isOpen: boolean;
    onClose: () => void;
    backgroundImageUrl?: string;
    // Unique identifier for saving progress (e.g., "book-123-page-5")
    pageId?: string;
}

// Storage key prefix (must match DrawingCanvas)
const DRAWING_STORAGE_PREFIX = 'godlykids_coloring_';

/**
 * Composite the user's drawing with the line art into a single image.
 * Both images are scaled using "contain" mode to match the display.
 */
const createCompositeImage = (
    drawingDataUrl: string,
    lineArtUrl: string
): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Load both images
        const drawingImg = new Image();
        const lineArtImg = new Image();
        lineArtImg.crossOrigin = 'anonymous';
        
        let drawingLoaded = false;
        let lineArtLoaded = false;
        
        const tryComposite = () => {
            if (!drawingLoaded || !lineArtLoaded) return;
            
            try {
                // Use drawing canvas dimensions as the output size (what user sees)
                const outputWidth = drawingImg.width || 800;
                const outputHeight = drawingImg.height || 1000;
                
                // Create composite canvas matching the drawing dimensions
                const canvas = document.createElement('canvas');
                canvas.width = outputWidth;
                canvas.height = outputHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }
                
                // 1. Draw the user's coloring (full canvas - this IS the background + colors)
                ctx.drawImage(drawingImg, 0, 0, outputWidth, outputHeight);
                
                // 2. Calculate "contain" scaling for line art to match display
                const lineArtAspect = lineArtImg.width / lineArtImg.height;
                const canvasAspect = outputWidth / outputHeight;
                
                let lineWidth, lineHeight, lineX, lineY;
                if (lineArtAspect > canvasAspect) {
                    // Line art is wider - fit to width
                    lineWidth = outputWidth;
                    lineHeight = outputWidth / lineArtAspect;
                    lineX = 0;
                    lineY = (outputHeight - lineHeight) / 2;
                } else {
                    // Line art is taller - fit to height
                    lineHeight = outputHeight;
                    lineWidth = outputHeight * lineArtAspect;
                    lineX = (outputWidth - lineWidth) / 2;
                    lineY = 0;
                }
                
                // 3. Process line art to extract just the dark lines (make white transparent)
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = lineArtImg.width;
                tempCanvas.height = lineArtImg.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    tempCtx.drawImage(lineArtImg, 0, 0);
                    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const data = imageData.data;
                    
                    // Make light pixels transparent, keep dark pixels as lines
                    for (let i = 0; i < data.length; i += 4) {
                        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                        if (brightness > 200) {
                            // Light pixel - make transparent
                            data[i + 3] = 0;
                        } else {
                            // Dark pixel - make it black with appropriate alpha
                            data[i] = 0;
                            data[i + 1] = 0;
                            data[i + 2] = 0;
                            data[i + 3] = Math.min(255, (255 - brightness) * 2);
                        }
                    }
                    tempCtx.putImageData(imageData, 0, 0);
                    
                    // 4. Draw processed line art on top (positioned with contain scaling)
                    ctx.drawImage(tempCanvas, lineX, lineY, lineWidth, lineHeight);
                } else {
                    // Fallback: draw line art with multiply blend mode
                    ctx.globalCompositeOperation = 'multiply';
                    ctx.drawImage(lineArtImg, lineX, lineY, lineWidth, lineHeight);
                    ctx.globalCompositeOperation = 'source-over';
                }
                
                // Return as data URL
                console.log('📸 Composite created:', outputWidth, 'x', outputHeight);
                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                console.error('Error compositing image:', err);
                reject(err);
            }
        };
        
        drawingImg.onload = () => {
            drawingLoaded = true;
            tryComposite();
        };
        drawingImg.onerror = () => {
            reject(new Error('Failed to load drawing'));
        };
        
        lineArtImg.onload = () => {
            lineArtLoaded = true;
            tryComposite();
        };
        lineArtImg.onerror = (err) => {
            // If line art fails to load (CORS), just use the drawing alone
            console.warn('Line art failed to load (likely CORS), using drawing only:', err);
            resolve(drawingDataUrl);
        };
        
        drawingImg.src = drawingDataUrl;
        lineArtImg.src = lineArtUrl;
    });
};

// Helper to resolve media URLs (similar to apiService)
const resolveMediaUrl = (url?: string): string => {
    if (!url) return '';
    
    // If it's already an absolute URL, return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // If it starts with a slash, prepend the storage base URL
    if (url.startsWith('/')) {
        return `https://storage.googleapis.com/productiongk${url}`;
    }
    
    // Otherwise, assume it's a relative path and prepend the storage URL
    return `https://storage.googleapis.com/productiongk/${url}`;
};

const ColoringModal: React.FC<ColoringModalProps> = ({ isOpen, onClose, backgroundImageUrl, pageId }) => {
    const navigate = useNavigate();
    const [showReward, setShowReward] = useState(false);
    const [resolvedImageUrl, setResolvedImageUrl] = useState<string>('');
    const [pinToast, setPinToast] = useState<string | null>(null);
    const [isPinning, setIsPinning] = useState(false);

    const parsedPage = useMemo(() => parseColoringPageId(pageId), [pageId]);
    const pinnedForBook = useMemo(() => {
        if (!parsedPage?.bookId) return null;
        return pinnedColoringService.getPinned(parsedPage.bookId);
    }, [parsedPage?.bookId, showReward, isOpen]);
    const isPinnedThisPage = !!(pinnedForBook && pageId && pinnedForBook.pageId === pageId);

    // Resolve the background image URL when it changes
    useEffect(() => {
        console.log('🎨 ColoringModal received backgroundImageUrl:', backgroundImageUrl);
        if (backgroundImageUrl) {
            const resolved = resolveMediaUrl(backgroundImageUrl);
            console.log('🎨 Coloring page image resolved:', { original: backgroundImageUrl, resolved });
            setResolvedImageUrl(resolved);
        } else {
            console.log('🎨 No coloring page image provided to ColoringModal');
            setResolvedImageUrl('');
        }
    }, [backgroundImageUrl]);

    // ALL HOOKS MUST BE ABOVE THIS LINE - useCallback moved here
    const handlePinToggle = useCallback(async () => {
        if (!pageId || !parsedPage?.bookId || isPinning) return;
        
        if (isPinnedThisPage) {
            pinnedColoringService.unpinWithCleanup(parsedPage.bookId);
            setPinToast('Removed from fridge');
            window.setTimeout(() => setPinToast(null), 1500);
            return;
        }
        
        // Get the drawing from localStorage
        const drawingDataUrl = localStorage.getItem(`${DRAWING_STORAGE_PREFIX}${pageId}`);
        if (!drawingDataUrl) {
            setPinToast('No drawing found to pin');
            window.setTimeout(() => setPinToast(null), 1500);
            return;
        }
        
        setIsPinning(true);
        setPinToast('Creating your artwork...');
        
        try {
            let finalImageUrl = drawingDataUrl;
            
            // If we have line art, composite them together
            if (resolvedImageUrl) {
                console.log('📌 Compositing drawing with line art...');
                finalImageUrl = await createCompositeImage(drawingDataUrl, resolvedImageUrl);
                console.log('📌 Composite created successfully');
            }
            
            // Store the composite image
            const pinned = pinnedColoringService.pinWithComposite(pageId, finalImageUrl);
            console.log('📌 Pin result:', pinned);
            setPinToast(pinned ? 'Pinned to book! 🎨' : 'Could not pin (storage full?)');
        } catch (err) {
            console.error('📌 Error creating composite:', err);
            // Fallback: pin without composite
            const pinned = pinnedColoringService.pinFromPageId(pageId, resolvedImageUrl || undefined);
            setPinToast(pinned ? 'Pinned to book!' : 'Could not pin');
        } finally {
            setIsPinning(false);
            window.setTimeout(() => setPinToast(null), 2000);
        }
    }, [pageId, parsedPage?.bookId, isPinnedThisPage, resolvedImageUrl, isPinning]);

    // Early return AFTER all hooks
    if (!isOpen) return null;

    const handleComplete = () => {
        // No coins awarded for coloring - just show completion
        setShowReward(true);
    };

    const handleHome = () => {
        onClose();
        navigate('/home');
    };

    const handleShop = () => {
        onClose();
        navigate('/home', { state: { openShop: true } });
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 animate-in fade-in duration-300"
            />

            {/* Full Screen Container */}
            <div className="relative w-full h-full flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header - Fixed height */}
                <div className="flex-shrink-0 z-20 flex items-center justify-between px-4 py-3 bg-[#5D4037]">
                    <h2 className="font-display font-extrabold text-xl text-white drop-shadow-lg tracking-wide uppercase flex items-center gap-2">
                        <Sparkles size={20} className="text-[#FFD700]" /> Coloring Time!
                    </h2>
                    <button
                        onClick={onClose}
                        className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Drawing Canvas - Takes remaining space */}
                <div className="flex-1 w-full bg-white relative overflow-hidden">
                    <DrawingCanvas
                        prompt="Color the picture!"
                        backgroundImageUrl={resolvedImageUrl}
                        onComplete={handleComplete}
                        saveKey={pageId}
                    />

                    {/* Reward Overlay */}
                    {showReward && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
                            <div className="relative w-32 h-32 mb-6">
                                <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Star size={80} className="text-[#FFD700] fill-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]" />
                                </div>
                                <div className="absolute -top-2 -right-2 animate-bounce">
                                    <Sparkles size={32} className="text-[#FFD700]" />
                                </div>
                            </div>

                            <h3 className="font-display font-bold text-4xl text-white mb-2 animate-in zoom-in duration-300 delay-150">
                                GREAT JOB!
                            </h3>
                            <p className="text-white/80 font-bold text-xl mb-8 animate-in slide-in-from-bottom-4 duration-500 delay-300">
                                You finished coloring!
                            </p>

                            <div className="flex flex-col gap-4 w-full max-w-xs px-4 animate-in slide-in-from-bottom-8 duration-500 delay-500">
                                {/* Pin to book ("fridge") */}
                                {parsedPage?.bookId && pageId && (
                                    <button
                                        onClick={handlePinToggle}
                                        className={`py-4 rounded-xl font-bold shadow-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 ${
                                            isPinnedThisPage
                                                ? 'bg-green-600 hover:bg-green-700 border-green-800 text-white'
                                                : 'bg-[#FFD700] hover:bg-[#FFDE4D] border-[#B8860B] text-[#5c2e0b]'
                                        }`}
                                    >
                                        {isPinnedThisPage ? <PinOff size={24} /> : <Pin size={24} />}
                                        <span>{isPinnedThisPage ? 'Unpin from Book' : 'Hang on Book Fridge'}</span>
                                    </button>
                                )}

                                <button
                                    onClick={handleHome}
                                    className="bg-[#2196F3] hover:bg-[#1E88E5] text-white py-4 rounded-xl font-bold shadow-lg border-b-4 border-[#1565C0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                                >
                                    <Home size={24} />
                                    Go Home
                                </button>

                                <button
                                    onClick={handleShop}
                                    className="bg-[#8B4513] hover:bg-[#795548] text-white py-4 rounded-xl font-bold shadow-lg border-b-4 border-[#5D4037] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                                >
                                    <ShoppingBag size={24} />
                                    Go to Shop
                                </button>
                            </div>

                            {pinToast && (
                                <div className="mt-6 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-bold border border-white/20">
                                    {pinToast}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ColoringModal;
