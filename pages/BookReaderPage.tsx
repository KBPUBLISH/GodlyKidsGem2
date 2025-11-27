import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ApiService } from '../services/apiService';

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

const BookReaderPage: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const [pages, setPages] = useState<Page[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showScroll, setShowScroll] = useState(true);

    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const data = await ApiService.getBookPages(bookId);
                setPages(data);
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
                    onClick={() => navigate(-1)}
                    className="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 transition"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen bg-gray-900 overflow-hidden flex flex-col">
            {/* Top Toolbar - Simplified for App */}
            <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 pointer-events-none">
                <button
                    onClick={() => navigate(-1)}
                    className="pointer-events-auto bg-black/30 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/50 transition flex items-center gap-2"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="bg-black/30 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm">
                    Page {currentPageIndex + 1} / {pages.length}
                </div>

                <div className="w-10" /> {/* Spacer for balance */}
            </div>

            {/* Main Reading Area */}
            <div className="flex-1 w-full h-full relative" onClick={toggleScroll}>
                {/* Background Layer */}
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                    {currentPage.backgroundType === 'video' ? (
                        <video
                            src={currentPage.backgroundUrl}
                            className="w-full h-full object-contain"
                            autoPlay
                            loop
                            muted
                            playsInline
                        />
                    ) : (
                        <img
                            src={currentPage.backgroundUrl}
                            alt={`Page ${currentPage.pageNumber}`}
                            className="w-full h-full object-contain"
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
                            src={currentPage.scrollUrl}
                            alt="Scroll background"
                            className="w-full h-full object-fill"
                        />
                    </div>
                )}

                {/* Navigation Controls (Side Taps) */}
                <div className="absolute inset-y-0 left-0 w-1/4 z-30" onClick={handlePrev} />
                <div className="absolute inset-y-0 right-0 w-1/4 z-30" onClick={handleNext} />
            </div>
        </div>
    );
};

export default BookReaderPage;
