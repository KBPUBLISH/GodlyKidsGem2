import React, { useMemo, useState, useEffect } from 'react';
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

    if (!isOpen) return null;

    const handleComplete = () => {
        // No coins awarded for coloring - just show completion
        setShowReward(true);
    };

    const handlePinToggle = () => {
        if (!pageId || !parsedPage?.bookId) return;
        if (isPinnedThisPage) {
            pinnedColoringService.unpin(parsedPage.bookId);
            setPinToast('Removed from fridge');
        } else {
            const pinned = pinnedColoringService.pinFromPageId(pageId);
            setPinToast(pinned ? 'Pinned to book!' : 'Could not pin (storage full?)');
        }
        window.setTimeout(() => setPinToast(null), 1500);
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
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
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

                {/* Full Screen Drawing Canvas */}
                <div className="flex-1 w-full h-full bg-white relative">
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
