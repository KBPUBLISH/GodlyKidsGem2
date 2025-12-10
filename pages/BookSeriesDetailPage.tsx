import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, BookOpen, Heart, Bookmark, Lock, Check, Crown } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import { favoritesService } from '../services/favoritesService';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';

// Predefined color palettes for fallback (warm, cool, vibrant variations)
const FALLBACK_PALETTES = [
    { primary: '#2d1b4e', secondary: '#4a2c7a', accent: '#9b59b6' }, // Purple
    { primary: '#1a3a52', secondary: '#2c5a7c', accent: '#3498db' }, // Blue
    { primary: '#2d4a3e', secondary: '#3d6b56', accent: '#27ae60' }, // Green
    { primary: '#5d2a2a', secondary: '#8b3d3d', accent: '#e74c3c' }, // Red
    { primary: '#4a3728', secondary: '#6b4f3a', accent: '#e67e22' }, // Orange
    { primary: '#3d3d29', secondary: '#5a5a3d', accent: '#f1c40f' }, // Gold
    { primary: '#2a2a4a', secondary: '#3d3d6b', accent: '#9b59b6' }, // Indigo
    { primary: '#4a2a3d', secondary: '#6b3d56', accent: '#e91e63' }, // Pink
];

// Get a consistent fallback palette based on the image URL
const getFallbackPalette = (imgSrc: string) => {
    let hash = 0;
    for (let i = 0; i < imgSrc.length; i++) {
        hash = ((hash << 5) - hash) + imgSrc.charCodeAt(i);
        hash = hash & hash;
    }
    const index = Math.abs(hash) % FALLBACK_PALETTES.length;
    return FALLBACK_PALETTES[index];
};

// Helper function to extract dominant colors from an image
const extractColors = (imgSrc: string): Promise<{ primary: string; secondary: string; accent: string }> => {
    return new Promise((resolve) => {
        const fallback = getFallbackPalette(imgSrc);
        
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        const timeout = setTimeout(() => {
            resolve(fallback);
        }, 2000);
        
        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(fallback);
                    return;
                }
                
                const size = 50;
                canvas.width = size;
                canvas.height = size;
                
                try {
                    ctx.drawImage(img, 0, 0, size, size);
                    const imageData = ctx.getImageData(0, 0, size, size).data;
                    const colorCounts: { [key: string]: number } = {};
                    
                    for (let i = 0; i < imageData.length; i += 16) {
                        const r = imageData[i];
                        const g = imageData[i + 1];
                        const b = imageData[i + 2];
                        
                        const qr = Math.round(r / 32) * 32;
                        const qg = Math.round(g / 32) * 32;
                        const qb = Math.round(b / 32) * 32;
                        
                        const brightness = (qr + qg + qb) / 3;
                        if (brightness < 30 || brightness > 225) continue;
                        
                        const key = `${qr},${qg},${qb}`;
                        colorCounts[key] = (colorCounts[key] || 0) + 1;
                    }
                    
                    const sortedColors = Object.entries(colorCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    
                    if (sortedColors.length >= 2) {
                        const [r1, g1, b1] = sortedColors[0][0].split(',').map(Number);
                        const [r2, g2, b2] = sortedColors[1][0].split(',').map(Number);
                        
                        const darken = (c: number) => Math.max(0, Math.floor(c * 0.6));
                        const primary = `rgb(${darken(r1)}, ${darken(g1)}, ${darken(b1)})`;
                        
                        const lighten = (c: number) => Math.min(255, Math.floor(c * 0.8));
                        const secondary = `rgb(${lighten(r1)}, ${lighten(g1)}, ${lighten(b1)})`;
                        
                        const accent = `rgb(${r2}, ${g2}, ${b2})`;
                        
                        resolve({ primary, secondary, accent });
                    } else {
                        resolve(fallback);
                    }
                } catch (e) {
                    resolve(fallback);
                }
            } catch (e) {
                resolve(fallback);
            }
        };
        
        img.onerror = () => {
            clearTimeout(timeout);
            resolve(fallback);
        };
        
        img.src = imgSrc;
    });
};

interface BookInSeries {
    book: {
        _id: string;
        title: string;
        coverImage?: string;
        coverUrl?: string;
        files?: {
            coverImage?: string;
        };
        author?: string;
        description?: string;
        minAge?: number;
        maxAge?: number;
        isMembersOnly?: boolean;
        pages?: any[];
    };
    order: number;
}

// Helper to get book cover URL from various possible fields
const getBookCoverUrl = (book: BookInSeries['book']): string | null => {
    return book.coverImage || book.coverUrl || book.files?.coverImage || null;
};

interface BookSeries {
    _id: string;
    title: string;
    description?: string;
    coverImage: string;
    books: BookInSeries[];
    minAge: number;
    maxAge: number;
    level: string;
    category?: {
        _id: string;
        name: string;
    };
    author?: string;
    isMembersOnly: boolean;
    viewCount?: number;
}

const BookSeriesDetailPage: React.FC = () => {
    const { seriesId } = useParams();
    const navigate = useNavigate();
    const { t, translateText, currentLanguage } = useLanguage();
    const { isSubscribed, completedBooks } = useUser();
    const [series, setSeries] = useState<BookSeries | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [translatedTitle, setTranslatedTitle] = useState<string>('');
    const [translatedDescription, setTranslatedDescription] = useState<string>('');
    const [colors, setColors] = useState({ primary: '#2d1b4e', secondary: '#4a2c7a', accent: '#9b59b6' });

    useEffect(() => {
        fetchSeries();
        // Check if favorited/liked from localStorage
        const likes = JSON.parse(localStorage.getItem('liked_book_series') || '[]');
        setIsLiked(likes.includes(seriesId));
        
        if (seriesId) {
            setIsFavorited(favoritesService.isBookSeriesFavorite?.(seriesId) || false);
        }
    }, [seriesId]);

    // Translate title and description when language changes
    useEffect(() => {
        if (series && currentLanguage !== 'en') {
            translateText(series.title).then(setTranslatedTitle);
            if (series.description) {
                translateText(series.description).then(setTranslatedDescription);
            }
        } else if (series) {
            setTranslatedTitle(series.title);
            setTranslatedDescription(series.description || '');
        }
    }, [series, currentLanguage, translateText]);

    // Extract colors from cover image
    useEffect(() => {
        if (series?.coverImage) {
            extractColors(series.coverImage).then(setColors);
        }
    }, [series?.coverImage]);

    const fetchSeries = async () => {
        try {
            setLoading(true);
            const baseUrl = getApiBaseUrl();
            const response = await fetch(`${baseUrl}book-series/${seriesId}`);
            if (!response.ok) throw new Error('Failed to fetch book series');
            const data = await response.json();
            setSeries(data);
        } catch (error) {
            console.error('Error fetching book series:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = () => {
        const likes = JSON.parse(localStorage.getItem('liked_book_series') || '[]');
        if (isLiked) {
            const newLikes = likes.filter((id: string) => id !== seriesId);
            localStorage.setItem('liked_book_series', JSON.stringify(newLikes));
        } else {
            likes.push(seriesId);
            localStorage.setItem('liked_book_series', JSON.stringify(likes));
        }
        setIsLiked(!isLiked);
    };

    const handleSave = () => {
        if (seriesId) {
            if (isFavorited) {
                favoritesService.removeBookSeriesFavorite?.(seriesId);
            } else {
                favoritesService.addBookSeriesFavorite?.(seriesId);
            }
            setIsFavorited(!isFavorited);
        }
    };

    const handleBookClick = (book: BookInSeries['book']) => {
        const bookIsLocked = book.isMembersOnly && !isSubscribed;
        if (bookIsLocked) {
            navigate('/paywall');
        } else {
            navigate(`/book/${book._id}`);
        }
    };

    const isBookCompleted = (bookId: string) => {
        return completedBooks?.includes(bookId) || false;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-b from-[#87CEEB] to-[#5DADE2]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
            </div>
        );
    }

    if (!series) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-[#87CEEB] to-[#5DADE2]">
                <BookOpen size={48} className="text-white/50 mb-4" />
                <p className="text-white text-lg">Book series not found</p>
                <button 
                    onClick={() => navigate(-1)}
                    className="mt-4 px-4 py-2 bg-white/20 rounded-lg text-white"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto no-scrollbar pb-32 bg-gradient-to-b from-[#87CEEB] to-[#5DADE2]">
            {/* Header Section with Cover - z-20 to overlap sky background */}
            <div 
                className="relative w-full overflow-hidden z-20"
                style={{
                    background: `linear-gradient(180deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.accent} 100%)`,
                    borderBottomLeftRadius: '40px',
                    borderBottomRightRadius: '40px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                }}
            >
                {/* Blurred cover background overlay for depth */}
                {series.coverImage && (
                    <div 
                        className="absolute inset-0 z-0 opacity-20"
                        style={{
                            backgroundImage: `url(${series.coverImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(30px)',
                        }}
                    />
                )}

                {/* Back Button */}
                <button 
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 z-30 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30"
                >
                    <ChevronLeft size={24} />
                </button>

                {/* Premium Badge */}
                {series.isMembersOnly && (
                    <div className="absolute top-4 right-4 z-30 flex items-center gap-1 px-3 py-1 bg-amber-500 rounded-full">
                        <Crown size={14} className="text-white" />
                        <span className="text-white text-xs font-bold">Premium</span>
                    </div>
                )}

                {/* Series Info */}
                <div className="relative z-20 px-6 pt-16 pb-8">
                    {/* Cover Image */}
                    {series.coverImage && (
                        <div 
                            className="w-56 h-56 mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl"
                            style={{
                                border: '4px solid rgba(255,255,255,0.3)',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            <img
                                src={series.coverImage}
                                alt={series.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}

                    {/* Title and Info */}
                    <div className="text-center">
                        <h1 className="text-3xl font-black text-white drop-shadow-lg font-display mb-2">
                            {translatedTitle || series.title}
                        </h1>
                        {series.author && (
                            <p className="text-white/80 font-medium text-lg mb-2">
                                {series.author}
                            </p>
                        )}
                        {(translatedDescription || series.description) && (
                            <p className="text-white/70 text-sm mb-3 max-w-md mx-auto">
                                {translatedDescription || series.description}
                            </p>
                        )}
                        <p className="text-white/60 text-sm mb-4">
                            {series.books.length} {series.books.length === 1 ? 'Book' : 'Books'} • Ages {series.minAge}-{series.maxAge}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-center gap-3 mt-4">
                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all active:scale-95 ${isFavorited
                                    ? 'bg-[#FFD700] border-[#B8860B] text-[#5c2e0b]'
                                    : 'bg-white/20 border-white/30 text-white'
                                }`}
                            >
                                <Bookmark size={18} fill={isFavorited ? '#5c2e0b' : 'none'} />
                                <span className="text-sm font-bold">{isFavorited ? t('saved') : t('save')}</span>
                            </button>

                            {/* Like Button */}
                            <button
                                onClick={handleLike}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all active:scale-95 ${isLiked
                                    ? 'bg-[#ff6b6b] border-[#c92a2a] text-white'
                                    : 'bg-white/20 border-white/30 text-white'
                                }`}
                            >
                                <Heart size={18} fill={isLiked ? 'white' : 'none'} />
                                <span className="text-sm font-bold">{t('favs')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT SECTION - Learning Path Style - z-10 so header overlaps */}
            <div 
                className="w-full pb-32 relative -mt-8 z-10"
                style={{
                    background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 30%, #87CEEB 60%, #5DADE2 100%)',
                    minHeight: `${Math.max(400, series.books.length * 180 + 200)}px`,
                    paddingTop: '40px',
                }}
            >
                {/* Sky/Cloud decorations */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Sun */}
                    <div className="absolute top-8 right-8 w-24 h-24 rounded-full bg-gradient-to-br from-[#FFE44D] to-[#FFA500] opacity-80 blur-sm" />
                    <div className="absolute top-10 right-10 w-20 h-20 rounded-full bg-gradient-to-br from-[#FFFACD] to-[#FFD700] opacity-90" />
                    
                    {/* Clouds */}
                    <div className="absolute top-20 left-4 w-32 h-12 bg-white/60 rounded-full blur-md" />
                    <div className="absolute top-16 left-12 w-24 h-10 bg-white/70 rounded-full blur-sm" />
                    <div className="absolute top-40 right-20 w-28 h-10 bg-white/50 rounded-full blur-md" />
                    
                    {/* Animated Ocean Waves */}
                    <div className="absolute bottom-0 left-0 right-0 h-40">
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0077B6] via-[#0096C7] to-transparent" />
                        
                        <svg 
                            className="absolute bottom-16 left-0 w-[200%] h-20 animate-[wave_8s_ease-in-out_infinite]"
                            viewBox="0 0 1440 120" 
                            preserveAspectRatio="none"
                        >
                            <path 
                                d="M0,60 C180,120 360,0 540,60 C720,120 900,0 1080,60 C1260,120 1440,0 1440,60 L1440,120 L0,120 Z"
                                fill="rgba(0, 150, 199, 0.3)"
                            />
                        </svg>
                        
                        <svg 
                            className="absolute bottom-10 left-0 w-[200%] h-16 animate-[wave_6s_ease-in-out_infinite_reverse]"
                            viewBox="0 0 1440 100" 
                            preserveAspectRatio="none"
                        >
                            <path 
                                d="M0,50 C120,100 240,0 360,50 C480,100 600,0 720,50 C840,100 960,0 1080,50 C1200,100 1320,0 1440,50 L1440,100 L0,100 Z"
                                fill="rgba(0, 119, 182, 0.4)"
                            />
                        </svg>
                        
                        <svg 
                            className="absolute bottom-4 left-0 w-[200%] h-14 animate-[wave_4s_ease-in-out_infinite]"
                            viewBox="0 0 1440 80" 
                            preserveAspectRatio="none"
                        >
                            <path 
                                d="M0,40 C90,80 180,0 270,40 C360,80 450,0 540,40 C630,80 720,0 810,40 C900,80 990,0 1080,40 C1170,80 1260,0 1350,40 C1440,80 1440,40 1440,40 L1440,80 L0,80 Z"
                                fill="rgba(72, 202, 228, 0.5)"
                            />
                        </svg>
                    </div>
                </div>

                {/* Path Items */}
                <div className="relative z-10 pt-12 pb-8 px-4 flex flex-col items-center">
                    {series.books.map((item, index) => {
                        const book = item.book;
                        const bookIsLocked = book.isMembersOnly && !isSubscribed;
                        const isCompleted = isBookCompleted(book._id);
                        const isEven = index % 2 === 0;
                        
                        return (
                            <div 
                                key={book._id} 
                                className="relative w-full max-w-xs animate-[lessonPop_0.5s_ease-out_forwards]"
                                style={{ 
                                    opacity: 0,
                                    animationDelay: `${index * 0.15}s`
                                }}
                            >
                                {/* Connecting path line */}
                                {index < series.books.length - 1 && (
                                    <div 
                                        className="absolute left-1/2 top-[90px] -translate-x-1/2 z-0 animate-[pathDraw_0.3s_ease-out_forwards]"
                                        style={{ 
                                            opacity: 0,
                                            animationDelay: `${(index * 0.15) + 0.3}s`
                                        }}
                                    >
                                        <svg width="60" height="50" viewBox="0 0 60 50" className="overflow-visible">
                                            <path 
                                                d={isEven ? "M30 0 Q30 25, 45 50" : "M30 0 Q30 25, 15 50"}
                                                stroke={isCompleted ? "#4CAF50" : "rgba(255,255,255,0.4)"}
                                                strokeWidth="4"
                                                strokeDasharray={isCompleted ? "0" : "8 4"}
                                                fill="none"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    </div>
                                )}
                                
                                {/* Item container - alternates left/right */}
                                <div 
                                    className={`flex items-center gap-4 mb-8 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}
                                    style={{ marginLeft: isEven ? '10%' : '0', marginRight: isEven ? '0' : '10%' }}
                                >
                                    {/* Circle with cover image */}
                                    <div 
                                        onClick={() => handleBookClick(book)}
                                        className={`relative cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95`}
                                    >
                                        {/* Glow effect for available */}
                                        {!bookIsLocked && !isCompleted && (
                                            <div className="absolute -inset-2 rounded-full bg-[#FFD700]/30 animate-pulse" />
                                        )}

                                        {/* Main circle */}
                                        <div className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 shadow-xl ${
                                            isCompleted 
                                                ? 'border-green-500 ring-4 ring-green-500/30' 
                                                : bookIsLocked
                                                    ? 'border-gray-500/50 grayscale opacity-60' 
                                                    : 'border-[#FFD700] ring-4 ring-[#FFD700]/30'
                                        }`}>
                                            {getBookCoverUrl(book) ? (
                                                <img
                                                    src={getBookCoverUrl(book)!}
                                                    alt={book.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
                                                    <BookOpen className="w-8 h-8 text-white/50" />
                                                </div>
                                            )}

                                            {/* Completed overlay */}
                                            {isCompleted && (
                                                <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                                                    <div className="bg-green-500 rounded-full p-2 shadow-lg">
                                                        <Check className="w-6 h-6 text-white" strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Locked overlay */}
                                            {bookIsLocked && !isCompleted && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <Lock className="w-6 h-6 text-white/70" />
                                                </div>
                                            )}

                                            {/* Read icon for available */}
                                            {!bookIsLocked && !isCompleted && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                    <div className="bg-white/90 rounded-full p-2 shadow-lg">
                                                        <BookOpen className="w-5 h-5 text-[#3E1F07]" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Book number badge */}
                                        <div className={`absolute -top-1 -left-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md border-2 border-white ${
                                            isCompleted 
                                                ? 'bg-green-500 text-white' 
                                                : bookIsLocked
                                                    ? 'bg-gray-500 text-white' 
                                                    : 'bg-[#FFD700] text-[#3E1F07]'
                                        }`}>
                                            {index + 1}
                                        </div>
                                    </div>

                                    {/* Book info card */}
                                    <div 
                                        className={`flex-1 max-w-[180px] md:max-w-[240px] ${isEven ? 'text-left' : 'text-right'}`}
                                        onClick={() => handleBookClick(book)}
                                    >
                                        <div className={`inline-block px-3 py-2 rounded-xl shadow-lg cursor-pointer transition-all hover:scale-105 ${
                                            isCompleted 
                                                ? 'bg-green-500/20 border border-green-500/30' 
                                                : bookIsLocked
                                                    ? 'bg-white/5 border border-white/10' 
                                                    : 'bg-[#FFD700]/20 border border-[#FFD700]/30'
                                        }`}>
                                            <h4 className={`text-sm md:text-base font-bold font-display leading-tight ${
                                                isCompleted ? 'text-green-600' : bookIsLocked ? 'text-white/50' : 'text-[#3E1F07]'
                                            }`}>
                                                {book.title}
                                            </h4>
                                            {book.author && (
                                                <p className={`text-xs mt-0.5 ${
                                                    isCompleted ? 'text-green-500' : bookIsLocked ? 'text-white/40' : 'text-[#5c2e0b]/70'
                                                }`}>
                                                    {book.author}
                                                </p>
                                            )}
                                            {isCompleted && (
                                                <p className="text-green-500 text-[10px] font-semibold mt-1">✓ Completed</p>
                                            )}
                                            {bookIsLocked && !isCompleted && (
                                                <p className="text-white/40 text-[10px] mt-1 flex items-center gap-1">
                                                    <Crown size={10} /> Premium
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes wave {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(-25%); }
                }
                @keyframes lessonPop {
                    0% { opacity: 0; transform: scale(0.8) translateY(20px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes pathDraw {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default BookSeriesDetailPage;

