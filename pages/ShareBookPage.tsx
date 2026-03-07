import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Star, Download, Sparkles, ChevronRight, User } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';

interface Book {
    _id: string;
    title: string;
    description?: string;
    coverUrl?: string;
    author?: string;
    ageRange?: string;
    category?: string;
    readTime?: number;
    pageCount?: number;
    rating?: number;
    createdAt?: string;
}

const ShareBookPage: React.FC = () => {
    const { bookId: rawBookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    
    // Clean the book ID - remove any URL-encoded text that might be appended
    // Some platforms append share text to the URL (e.g., "id%20some%20text")
    const bookId = useMemo(() => {
        if (!rawBookId) return '';
        // Take only the first part before any space or special characters
        // MongoDB IDs are 24 hex characters
        const cleaned = decodeURIComponent(rawBookId).split(/[\s%]/)[0];
        // Validate it looks like a MongoDB ObjectId (24 hex chars)
        if (/^[a-f0-9]{24}$/i.test(cleaned)) {
            return cleaned;
        }
        // If not valid, try to extract first 24 hex chars
        const match = rawBookId.match(/^[a-f0-9]{24}/i);
        return match ? match[0] : rawBookId.split('%')[0];
    }, [rawBookId]);
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBook = async () => {
            if (!bookId) return;
            try {
                const baseUrl = getApiBaseUrl();
                const response = await fetch(`${baseUrl}books/${bookId}`);
                if (!response.ok) throw new Error('Book not found');
                const data = await response.json();
                setBook(data);
            } catch (err) {
                setError('This book could not be found');
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
    }, [bookId]);

    const handleGetApp = () => {
        // Deep link to app store or open in app
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
            window.location.href = 'https://apps.apple.com/app/godly-kids/id6742073785';
        } else if (isAndroid) {
            window.location.href = 'https://play.google.com/store/apps/details?id=com.godlykids.app';
        } else {
            // Web - go to onboarding
            navigate('/onboarding');
        }
    };

    const handleOpenInApp = () => {
        // Try to open in app via deep link
        window.location.href = `godlykids://book/${bookId}`;
        
        // Fallback to app store after delay
        setTimeout(() => {
            handleGetApp();
        }, 2000);
    };

    const handleReadNow = () => {
        // For web, go to onboarding first, then redirect
        navigate(`/onboarding?redirect=/read/${bookId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#5c2e0b] to-[#3E1F07] flex items-center justify-center">
                <div className="animate-spin w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !book) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#5c2e0b] to-[#3E1F07] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-[#8B4513] rounded-full flex items-center justify-center mb-6">
                    <BookOpen className="w-10 h-10 text-[#FFD700]" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Book Not Found</h1>
                <p className="text-[#eecaa0] mb-8">This book may have been removed or the link is invalid.</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-[#FFD700] text-[#3E1F07] font-bold px-8 py-3 rounded-full"
                >
                    Explore Godly Kids
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#5c2e0b] via-[#3E1F07] to-[#2a1a05]" >
            {/* Header with Cover */}
            <div className="relative">
                {/* Background blur */}
                <div 
                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-20"
                    style={{ backgroundImage: `url(${book.coverUrl})` }}
                />
                
                <div className="relative pb-8 px-6" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 3rem)' }}>
                    {/* Cover Art */}
                    <div className="w-40 h-56 mx-auto rounded-lg shadow-2xl overflow-hidden mb-6 border-4 border-[#8B4513]">
                        {book.coverUrl ? (
                            <img 
                                src={book.coverUrl} 
                                alt={book.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                                <BookOpen className="w-16 h-16 text-white/80" />
                            </div>
                        )}
                    </div>

                    {/* Title & Info */}
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white mb-2 font-display">{book.title}</h1>
                        {book.author && (
                            <p className="text-[#eecaa0] text-sm mb-3 flex items-center justify-center gap-1">
                                <User className="w-4 h-4" />
                                {book.author}
                            </p>
                        )}
                        
                        {/* Meta Info */}
                        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                            {book.ageRange && (
                                <span className="bg-[#FFD700]/20 text-[#FFD700] px-3 py-1 rounded-full text-xs font-bold">
                                    Ages {book.ageRange}
                                </span>
                            )}
                            {book.category && (
                                <span className="bg-white/10 text-[#eecaa0] px-3 py-1 rounded-full text-xs">
                                    {book.category}
                                </span>
                            )}
                            {book.readTime && (
                                <span className="flex items-center gap-1 text-[#eecaa0]">
                                    <Clock className="w-4 h-4" />
                                    {book.readTime} min read
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Description */}
            {book.description && (
                <div className="mx-4 mb-6 bg-white/5 rounded-2xl p-4 backdrop-blur-sm">
                    <h2 className="text-[#FFD700] font-bold mb-2 text-sm">About This Book</h2>
                    <p className="text-[#eecaa0] text-sm leading-relaxed">{book.description}</p>
                </div>
            )}

            {/* CTA Banner */}
            <div className="mx-4 mb-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-[#3E1F07] text-sm">Read this interactive book!</h3>
                        <p className="text-[#3E1F07]/70 text-xs">Beautiful illustrations, audio narration & more</p>
                    </div>
                    <button
                        onClick={handleGetApp}
                        className="bg-[#3E1F07] text-white font-bold px-4 py-2 rounded-full text-sm flex items-center gap-1"
                    >
                        <Download className="w-4 h-4" />
                        Get App
                    </button>
                </div>
            </div>

            {/* Features */}
            <div className="mx-4 mb-6">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-[#FFD700]" />
                    What's Inside
                </h2>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="w-10 h-10 bg-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <BookOpen className="w-5 h-5 text-[#FFD700]" />
                        </div>
                        <p className="text-white text-sm font-medium">Interactive Pages</p>
                        <p className="text-gray-400 text-xs">Tap to explore</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="w-10 h-10 bg-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-[#FFD700]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                        </div>
                        <p className="text-white text-sm font-medium">Audio Narration</p>
                        <p className="text-gray-400 text-xs">Listen along</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="w-10 h-10 bg-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-[#FFD700]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                        </div>
                        <p className="text-white text-sm font-medium">Beautiful Art</p>
                        <p className="text-gray-400 text-xs">Full illustrations</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="w-10 h-10 bg-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-[#FFD700]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                            </svg>
                        </div>
                        <p className="text-white text-sm font-medium">Faith-Based</p>
                        <p className="text-gray-400 text-xs">Biblical values</p>
                    </div>
                </div>
            </div>

            {/* Spacer for fixed button */}
            <div className="h-32" />

            {/* Fixed Bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#2a1a05] via-[#2a1a05] to-transparent pt-8 pb-6 px-4">
                <button
                    onClick={handleOpenInApp}
                    className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-bold py-4 rounded-full text-lg flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30 font-display"
                >
                    Read in Godly Kids App
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default ShareBookPage;

