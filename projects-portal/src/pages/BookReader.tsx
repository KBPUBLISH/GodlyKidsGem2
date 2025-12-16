import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface TextBox {
    text: string;
    x: number;
    y: number;
    width?: number;
    alignment: 'left' | 'center' | 'right';
    fontFamily?: string;
    fontSize?: number;
    color?: string;
}

interface Page {
    _id: string;
    pageNumber: number;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    scrollUrl?: string;
    scrollHeight?: number;
    textBoxes?: TextBox[];
}

const BookReader: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const [pages, setPages] = useState<Page[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showScroll, setShowScroll] = useState(true);
    const [viewMode, setViewMode] = useState<'fullscreen' | 'tablet-p' | 'tablet-l' | 'phone-p' | 'phone-l'>('fullscreen');

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
                const res = await axios.get(`http://localhost:5001/api/pages/book/${bookId}`);
                setPages(res.data);
            } catch (err) {
                console.error('Failed to fetch pages:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPages();
    }, [bookId]);

    const currentPage = pages[currentPageIndex];

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(prev => prev + 1);
            setShowScroll(true); // Reset scroll visibility on page turn
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPageIndex > 0) {
            setCurrentPageIndex(prev => prev - 1);
            setShowScroll(true);
        }
    };

    const toggleScroll = () => {
        setShowScroll(prev => !prev);
    };

    const resolveUrl = (url?: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `http://localhost:5001${url}`;
        return url;
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
                <div className="text-gray-400 text-sm">
                    Page {currentPageIndex + 1} / {pages.length}
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
                    onClick={toggleScroll}
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
                        {currentPage.backgroundType === 'video' ? (
                            <video
                                src={resolveUrl(currentPage.backgroundUrl)}
                                className="w-full h-full object-cover"
                                autoPlay
                                loop
                                muted
                                playsInline
                            />
                        ) : (
                            <img
                                src={resolveUrl(currentPage.backgroundUrl)}
                                alt={`Page ${currentPage.pageNumber}`}
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>

                    {/* Text Boxes Layer - positioned relative to full page, moves with scroll */}
                    <div
                        className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-in-out z-20"
                        style={{
                            transform: currentPage.scrollUrl && !showScroll
                                ? 'translateY(100%)'
                                : 'translateY(0)'
                        }}
                    >
                        {currentPage.textBoxes?.map((box, idx) => {
                            // Calculate scroll top position
                            const scrollHeightVal = currentPage.scrollHeight ? `${currentPage.scrollHeight}px` : '30%';
                            const scrollTopVal = `calc(100% - ${scrollHeightVal})`;

                            return (
                                <div
                                    key={idx}
                                    className="absolute pointer-events-auto overflow-y-auto p-2"
                                    style={{
                                        left: `${box.x}%`,
                                        // If scroll exists, ensure top is at least the scroll start position
                                        top: currentPage.scrollUrl ? `max(${box.y}%, ${scrollTopVal})` : `${box.y}%`,
                                        width: `${box.width || 30}%`,
                                        transform: 'translate(0, 0)',
                                        textAlign: box.alignment,
                                        color: box.color || '#4a3b2a',
                                        fontFamily: box.fontFamily || 'Comic Sans MS',
                                        fontSize: `${box.fontSize || 24}px`,
                                        // Calculate max height based on the effective top position
                                        maxHeight: currentPage.scrollUrl
                                            ? `calc(100% - max(${box.y}%, ${scrollTopVal}) - 40px)`
                                            : `calc(100% - ${box.y}% - 40px)`,
                                        overflowY: 'auto',
                                        WebkitOverflowScrolling: 'touch',
                                    }}
                                >
                                    {box.text}
                                </div>
                            );
                        })}
                    </div>

                    {/* Scroll Overlay Layer */}
                    {currentPage.scrollUrl && (
                        <div
                            className={`absolute bottom-0 left-0 right-0 transition-transform duration-500 ease-in-out z-10 ${showScroll ? 'translate-y-0' : 'translate-y-full'
                                }`}
                            style={{ height: currentPage.scrollHeight ? `${currentPage.scrollHeight}px` : '30%' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* The Scroll Image */}
                            <img
                                src={resolveUrl(currentPage.scrollUrl)}
                                alt="Scroll background"
                                className="w-full h-full object-fill"
                            />
                        </div>
                    )}

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
                </div>
            </div>
        </div>
    );
};

export default BookReader;
