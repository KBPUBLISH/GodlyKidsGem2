import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Crown, Play, Pause, Music, Headphones, Heart, Bookmark, Hammer, Wrench, Lock, Check, Share2 } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import { favoritesService } from '../services/favoritesService';
import { useAudio } from '../context/AudioContext';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import MiniPlayer from '../components/audio/MiniPlayer';
import CommentSection from '../components/features/CommentSection';

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

// Get a consistent fallback palette based on the image URL (so same image = same colors)
const getFallbackPalette = (imgSrc: string) => {
    // Simple hash function to get consistent index
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
        // Get fallback palette for this specific image
        const fallback = getFallbackPalette(imgSrc);
        
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        // Set a timeout for CORS issues - if image doesn't load in 2 seconds, use fallback
        const timeout = setTimeout(() => {
            console.log('Color extraction timeout, using fallback palette');
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
                
                // Sample at a smaller size for performance
                const size = 50;
                canvas.width = size;
                canvas.height = size;
                
                try {
                    ctx.drawImage(img, 0, 0, size, size);
                    const imageData = ctx.getImageData(0, 0, size, size).data;
                    const colorCounts: { [key: string]: number } = {};
                    
                    // Sample pixels and count colors
                    for (let i = 0; i < imageData.length; i += 16) {
                        const r = imageData[i];
                        const g = imageData[i + 1];
                        const b = imageData[i + 2];
                        
                        // Quantize colors to reduce variations
                        const qr = Math.round(r / 32) * 32;
                        const qg = Math.round(g / 32) * 32;
                        const qb = Math.round(b / 32) * 32;
                        
                        // Skip very light colors (near white) and very dark colors (near black)
                        const brightness = (qr + qg + qb) / 3;
                        if (brightness < 30 || brightness > 225) continue;
                        
                        const key = `${qr},${qg},${qb}`;
                        colorCounts[key] = (colorCounts[key] || 0) + 1;
                    }
                    
                    // Sort by frequency
                    const sortedColors = Object.entries(colorCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    
                    if (sortedColors.length >= 2) {
                        const [r1, g1, b1] = sortedColors[0][0].split(',').map(Number);
                        const [r2, g2, b2] = sortedColors[1][0].split(',').map(Number);
                        
                        // Create a darker version for primary (for better text contrast)
                        const darken = (c: number) => Math.max(0, Math.floor(c * 0.6));
                        const primary = `rgb(${darken(r1)}, ${darken(g1)}, ${darken(b1)})`;
                        
                        // Secondary is slightly lighter
                        const lighten = (c: number) => Math.min(255, Math.floor(c * 0.8));
                        const secondary = `rgb(${lighten(r1)}, ${lighten(g1)}, ${lighten(b1)})`;
                        
                        // Accent from second most common color
                        const accent = `rgb(${r2}, ${g2}, ${b2})`;
                        
                        resolve({ primary, secondary, accent });
                    } else {
                        resolve(fallback);
                    }
                } catch (e) {
                    // CORS error when trying to read canvas data - use fallback
                    console.log('Canvas CORS error, using fallback palette');
                    resolve(fallback);
                }
            } catch (e) {
                resolve(fallback);
            }
        };
        
        img.onerror = () => {
            clearTimeout(timeout);
            console.log('Image load error, using fallback palette');
            resolve(fallback);
        };
        
        img.src = imgSrc;
    });
};

interface AudioItem {
    _id?: string;
    title: string;
    author?: string;
    coverImage?: string;
    audioUrl: string;
    duration?: number;
    order: number;
}

interface Playlist {
    _id: string;
    title: string;
    author?: string;
    description?: string;
    coverImage?: string;
    category?: string;
    type?: 'Song' | 'Audiobook';
    items: AudioItem[];
    status: 'draft' | 'published';
    playCount?: number;
    likeCount?: number;
}

const PlaylistDetailPage: React.FC = () => {
    const { playlistId } = useParams();
    const navigate = useNavigate();
    const { currentPlaylist, currentTrackIndex, isPlaying, togglePlayPause, playPlaylist } = useAudio();
    const { t, translateText, currentLanguage } = useLanguage();
    const { isSubscribed } = useUser();
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [localLikeCount, setLocalLikeCount] = useState(0);
    const [isInLibrary, setIsInLibrary] = useState(false);
    const [playCount, setPlayCount] = useState(0);
    const [translatedTitle, setTranslatedTitle] = useState<string>('');
    const [translatedDescription, setTranslatedDescription] = useState<string>('');
    
    // Track mounted state to prevent state updates after unmount
    const isMountedRef = useRef(true);
    
    // Dynamic gradient colors extracted from cover image
    const [gradientColors, setGradientColors] = useState({
        primary: '#8B4513',
        secondary: '#5c2e0b', 
        accent: '#d4a373'
    });
    
    // Check if this playlist is currently playing
    const isThisPlaylistPlaying = currentPlaylist?._id === playlistId;

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        fetchPlaylist();
        // Check if favorited/liked from localStorage
        try {
            const likes = JSON.parse(localStorage.getItem('liked_playlists') || '[]');
            const isLocallyLiked = likes.includes(playlistId);
            setIsLiked(isLocallyLiked);
        } catch (e) {
            console.warn('Error parsing liked_playlists:', e);
        }
        
        // Check if saved to library (using favorites service)
        if (playlistId) {
            setIsFavorited(favoritesService.isPlaylistFavorite(playlistId));
            setIsInLibrary(favoritesService.isPlaylistFavorite(playlistId));
        }
    }, [playlistId]);
    
    // Get personal play count from local service
    useEffect(() => {
        if (playlist && playlistId) {
            // Import and use personal play count service
            import('../services/playCountService').then(({ playCountService }) => {
                // Get total plays across all episodes in this playlist
                const episodeIds = playlist.items
                    ?.map(item => item._id)
                    .filter((id): id is string => !!id) || [];
                
                // Sum up plays from all episodes + any direct playlist plays
                const episodePlays = playCountService.getPlaylistTotalPlays(episodeIds);
                const playlistPlays = playCountService.getPlayCount(playlistId);
                setPlayCount(episodePlays + playlistPlays);
            });
        }
    }, [playlist, playlistId]);
    
    // Extract colors from cover image when playlist loads
    useEffect(() => {
        if (playlist?.coverImage) {
            extractColors(playlist.coverImage).then(colors => {
                if (isMountedRef.current) {
                    setGradientColors(colors);
                }
            }).catch(e => {
                console.warn('Error extracting colors:', e);
            });
        }
    }, [playlist?.coverImage]);

    const fetchPlaylist = async () => {
        try {
            const baseUrl = getApiBaseUrl();
            const response = await fetch(`${baseUrl}playlists/${playlistId}`);
            
            // Check if still mounted
            if (!isMountedRef.current) return;
            
            if (!response.ok) {
                throw new Error('Failed to fetch playlist');
            }
            const data = await response.json();
            
            // Check if still mounted before state updates
            if (!isMountedRef.current) return;
            
            // NOTE: Individual items within the playlist can be marked as isMembersOnly
            // The check is done in handleItemClick() when user tries to play a locked item
            
            // Sort items by order
            if (data.items && Array.isArray(data.items)) {
                data.items.sort((a: AudioItem, b: AudioItem) => (a.order || 0) - (b.order || 0));
            }
            setPlaylist(data);
            
            // Translate title and description for non-English (with mount check)
            if (currentLanguage !== 'en') {
                if (data.title) {
                    translateText(data.title).then(text => {
                        if (isMountedRef.current) setTranslatedTitle(text);
                    });
                }
                if (data.description) {
                    translateText(data.description).then(text => {
                        if (isMountedRef.current) setTranslatedDescription(text);
                    });
                }
            } else {
                setTranslatedTitle(data.title || '');
                setTranslatedDescription(data.description || '');
            }
            
            // Initialize like count from backend, but ensure it's at least 1 if locally liked
            try {
                const likes = JSON.parse(localStorage.getItem('liked_playlists') || '[]');
                const isLocallyLiked = likes.includes(playlistId);
                const backendLikeCount = data.likeCount || 0;
                // If locally liked and backend count is 0, show at least 1
                // Otherwise use backend count (which should include local like)
                if (isMountedRef.current) {
                    setLocalLikeCount(isLocallyLiked && backendLikeCount === 0 ? 1 : backendLikeCount);
                }
            } catch (e) {
                console.warn('Error parsing liked_playlists:', e);
            }
        } catch (error) {
            console.error('Error fetching playlist:', error);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    };

    const handleSave = () => {
        if (!playlistId) return;
        
        // Toggle playlist favorite status using the favorites service
        const newFavoriteState = favoritesService.togglePlaylistFavorite(playlistId);
        setIsFavorited(newFavoriteState);
        setIsInLibrary(newFavoriteState);
    };

    const handleLike = () => {
        const likes = JSON.parse(localStorage.getItem('liked_playlists') || '[]');
        if (isLiked) {
            const updated = likes.filter((id: string) => id !== playlistId);
            localStorage.setItem('liked_playlists', JSON.stringify(updated));
            setIsLiked(false);
            // Decrement, but don't go below 0
            setLocalLikeCount(prev => Math.max(0, prev - 1));
        } else {
            likes.push(playlistId);
            localStorage.setItem('liked_playlists', JSON.stringify(likes));
            setIsLiked(true);
            // Increment like count
            setLocalLikeCount(prev => prev + 1);
        }
    };

    // Handle share playlist with cover image
    const handleShare = async () => {
        if (!playlist) return;
        
        // Use app.godlykids.com for consistent deep linking
        const shareUrl = `https://app.godlykids.com/#/playlist/${playlistId}`;
        const isAudiobook = playlist.type === 'Audiobook';
        const emoji = isAudiobook ? '📖' : '🎵';
        const typeLabel = isAudiobook ? 'audiobook' : 'playlist';
        const shareText = `${emoji} Check out "${playlist.title}" ${typeLabel} on GodlyKids!\n\n${playlist.description || ''}`;
        
        // Try to share with image (Web Share API Level 2)
        if (navigator.share) {
            try {
                // Try to fetch cover image and share as file
                let shareData: ShareData = {
                    title: `${emoji} ${playlist.title} - GodlyKids`,
                    text: shareText,
                    url: shareUrl,
                };
                
                // Try to include cover image if browser supports file sharing
                if (playlist.coverImage && navigator.canShare) {
                    try {
                        console.log('📷 Attempting to fetch cover image for sharing...');
                        const response = await fetch(playlist.coverImage);
                        const blob = await response.blob();
                        const fileName = `${playlist.title.replace(/[^a-z0-9]/gi, '_')}.jpg`;
                        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
                        
                        // Check if we can share with files
                        const testShare = { files: [file] };
                        if (navigator.canShare(testShare)) {
                            shareData = {
                                title: `${emoji} ${playlist.title} - GodlyKids`,
                                text: `${shareText}\n\n🔗 ${shareUrl}`,
                                files: [file],
                            };
                            console.log('✅ Sharing with cover image');
                        }
                    } catch (imgErr) {
                        console.log('📷 Could not include image in share:', imgErr);
                    }
                }
                
                await navigator.share(shareData);
                console.log('📤 Playlist shared successfully');
            } catch (err) {
                // User cancelled or share failed
                if ((err as Error).name !== 'AbortError') {
                    console.log('📤 Share cancelled or failed:', err);
                }
            }
        } else {
            // Fallback: Copy link to clipboard
            try {
                await navigator.clipboard.writeText(`${shareText}\n\n🔗 ${shareUrl}`);
                alert('📋 Link copied to clipboard! Share it with your friends.');
            } catch (err) {
                // Final fallback: prompt user
                prompt('Copy this link to share:', shareUrl);
            }
        }
    };

    const handleItemClick = (itemIndex: number) => {
        const item = playlist?.items[itemIndex];
        
        // Check if this item is locked (members only and user not subscribed)
        const itemIsLocked = item?.isMembersOnly && !isSubscribed;
        
        if (itemIsLocked) {
            // Redirect to paywall
            navigate('/paywall', { state: { from: `/playlist/${playlistId}` } });
            return;
        }
        
        // Check if this exact track is already playing
        if (isThisPlaylistPlaying && currentTrackIndex === itemIndex) {
            // Toggle play/pause
            togglePlayPause();
        } else {
            // Navigate to player with this track
            navigate(`/audio/playlist/${playlistId}/play/${itemIndex}`);
        }
    };
    
    // Check if a specific track is currently playing
    const isTrackPlaying = (itemIndex: number): boolean => {
        return isThisPlaylistPlaying && currentTrackIndex === itemIndex && isPlaying;
    };
    
    // Check if a specific track is the current track (playing or paused)
    const isCurrentTrack = (itemIndex: number): boolean => {
        return isThisPlaylistPlaying && currentTrackIndex === itemIndex;
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds || isNaN(seconds)) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#fdf6e3]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#8B4513]"></div>
            </div>
        );
    }

    if (!playlist || playlist.items.length === 0) {
        const isAudiobook = playlist?.type === 'Audiobook';
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#fdf6e3]">
                {isAudiobook ? (
                    <Headphones className="w-16 h-16 text-[#8B4513] mb-4 opacity-50" />
                ) : (
                    <Music className="w-16 h-16 text-[#8B4513] mb-4 opacity-50" />
                )}
                <p className="text-[#5c2e0b] text-lg font-display mb-4">
                    {isAudiobook ? 'Audiobook not found or empty' : 'Playlist not found or empty'}
                </p>
                <button
                    onClick={() => navigate('/listen')}
                    className="px-6 py-2 bg-[#8B4513] text-white rounded-lg hover:bg-[#6B3410] transition-colors"
                >
                    Back to Listen
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto no-scrollbar bg-[#5DADE2]">
            {/* TOP SECTION - DYNAMIC GRADIENT BACKGROUND */}
            <div className="relative pb-16 shadow-2xl z-10 overflow-hidden shrink-0 w-full rounded-b-[40px]">
                {/* Dynamic gradient based on cover image colors */}
                <div 
                    className="absolute inset-0 transition-all duration-700"
                    style={{
                        background: `linear-gradient(180deg, 
                            ${gradientColors.primary} 0%, 
                            ${gradientColors.secondary} 50%,
                            ${gradientColors.primary} 100%
                        )`
                    }}
                />
                
                {/* Blurred cover image overlay for extra depth */}
                {playlist?.coverImage && (
                    <div 
                        className="absolute inset-0 opacity-30"
                        style={{
                            backgroundImage: `url(${playlist.coverImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(60px) saturate(1.5)',
                            transform: 'scale(1.2)',
                        }}
                    />
                )}
                
                {/* Gradient overlay for better text contrast */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(180deg, 
                            rgba(0,0,0,0.2) 0%, 
                            rgba(0,0,0,0.1) 50%,
                            rgba(0,0,0,0.3) 100%
                        )`
                    }}
                />

                {/* Subtle noise texture for visual interest */}
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")` }}>
                </div>

                {/* Header Icons */}
                <div className="relative z-20 flex justify-between items-center px-4 pt-6 pb-2">
                    {/* Back Button */}
                    <button
                        onClick={() => navigate('/listen')}
                        className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full border-2 border-white/30 flex items-center justify-center transform transition-transform active:scale-95 hover:bg-black/60"
                    >
                        <ChevronLeft size={24} className="text-white" />
                    </button>
                </div>

                {/* Playlist Info */}
                <div className="relative z-20 px-6 pt-4 pb-6">
                    {/* Cover Image - With dynamic border color */}
                    {playlist.coverImage && (
                        <div 
                            className="w-72 h-72 mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl transition-all duration-500"
                            style={{
                                border: `4px solid ${gradientColors.accent}`,
                                boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${gradientColors.accent}40`
                            }}
                        >
                            <img
                                src={playlist.coverImage}
                                alt={playlist.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}

                    {/* Title and Info */}
                    <div className="text-center">
                        <h1 className="text-3xl font-black text-[#fdf6e3] drop-shadow-lg font-display mb-2">
                            {translatedTitle || playlist.title}
                        </h1>
                        {playlist.author && (
                            <p className="text-[#e2cba5] font-medium text-lg mb-2">
                                {playlist.author}
                            </p>
                        )}
                        {(translatedDescription || playlist.description) && (
                            <p className="text-[#e2cba5] text-sm mb-3">
                                {translatedDescription || playlist.description}
                            </p>
                        )}
                        <p className="text-[#e2cba5] text-sm mb-4">
                            {playlist.items.length} {playlist.type === 'Song' ? t('songs') : t('episodes')}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-center gap-3 mt-4">
                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all active:scale-95 ${isInLibrary
                                    ? 'bg-[#FFD700] border-[#B8860B] text-[#5c2e0b]'
                                    : 'bg-[#fdf6e3] border-[#d4c5a0] text-[#8B4513]'
                                    }`}
                            >
                                <Bookmark size={18} fill={isInLibrary ? '#5c2e0b' : 'none'} />
                                <span className="text-sm font-bold">{isInLibrary ? t('saved') : t('save')}</span>
                            </button>

                            {/* Like Button */}
                            <button
                                onClick={handleLike}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all active:scale-95 ${isLiked
                                    ? 'bg-[#ff6b6b] border-[#c92a2a] text-white'
                                    : 'bg-[#fdf6e3] border-[#d4c5a0] text-[#8B4513]'
                                    }`}
                            >
                                <Heart size={18} fill={isLiked ? 'white' : 'none'} />
                                <span className="text-sm font-bold">{localLikeCount}</span>
                            </button>

                            {/* Share Button */}
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-[#d4c5a0] bg-[#fdf6e3] text-[#8B4513] transition-all active:scale-95 hover:bg-[#e8d99f]"
                                title="Share"
                            >
                                <Share2 size={18} />
                                <span className="text-sm font-bold">{t('share') || 'Share'}</span>
                            </button>

                            {/* View Counter */}
                            <button 
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-[#d4c5a0] bg-[#fdf6e3] text-[#8B4513] cursor-default"
                            >
                                <Headphones size={18} />
                                <span className="text-sm font-bold">{t('myListens')}: {playCount}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT SECTION - Learning Path Style */}
            <div 
                className="w-full pb-32 relative"
                style={{
                    background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 30%, #87CEEB 60%, #5DADE2 100%)',
                    minHeight: `${Math.max(400, playlist.items.length * 180 + 200)}px`
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
                    <div className="absolute top-[30%] left-8 w-20 h-8 bg-white/40 rounded-full blur-sm" />
                    
                    {/* Animated Ocean Waves */}
                    <div className="absolute bottom-0 left-0 right-0 h-40">
                        {/* Deep ocean base */}
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0077B6] via-[#0096C7] to-transparent" />
                        
                        {/* Back wave layer - slowest */}
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
                        
                        {/* Middle wave layer */}
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
                        
                        {/* Front wave layer - fastest */}
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
                        
                        {/* Foam/spray at top of waves */}
                        <svg 
                            className="absolute bottom-12 left-0 w-[200%] h-8 animate-[wave_5s_ease-in-out_infinite]"
                            viewBox="0 0 1440 40" 
                            preserveAspectRatio="none"
                        >
                            <path 
                                d="M0,20 Q60,0 120,20 T240,20 T360,20 T480,20 T600,20 T720,20 T840,20 T960,20 T1080,20 T1200,20 T1320,20 T1440,20"
                                stroke="rgba(255,255,255,0.4)"
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                            />
                        </svg>
                        
                        {/* Sparkle/light reflections on water */}
                        <div className="absolute bottom-8 left-[20%] w-2 h-2 bg-white/60 rounded-full animate-pulse" />
                        <div className="absolute bottom-12 left-[40%] w-1.5 h-1.5 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                        <div className="absolute bottom-6 left-[60%] w-2 h-2 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                        <div className="absolute bottom-10 left-[80%] w-1.5 h-1.5 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                </div>

                {/* Path Items */}
                <div className="relative z-10 pt-12 pb-8 px-4 flex flex-col items-center">
                    {playlist.items.map((item, index) => {
                        const trackPlaying = isTrackPlaying(index);
                        const isCurrent = isCurrentTrack(index);
                        const itemIsLocked = (item as any).isMembersOnly && !isSubscribed;
                        const isCompleted = false; // TODO: Track completed episodes
                        const isEven = index % 2 === 0;
                        
                        return (
                            <div key={item._id || index} className="relative w-full max-w-xs">
                                {/* Connecting path line */}
                                {index < playlist.items.length - 1 && (
                                    <div 
                                        className="absolute left-1/2 top-[90px] w-1 h-24 -translate-x-1/2 z-0"
                                        style={{
                                            background: 'linear-gradient(180deg, #5DADE2 0%, #85C1E9 50%, #5DADE2 100%)',
                                            opacity: 0.6
                                        }}
                                    />
                                )}
                                
                                {/* Item container - alternates left/right */}
                                <div 
                                    className={`flex items-center gap-4 mb-8 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}
                                    style={{ marginLeft: isEven ? '0' : 'auto', marginRight: isEven ? 'auto' : '0' }}
                                >
                                    {/* Circle with cover image */}
                                    <div 
                                        onClick={() => handleItemClick(index)}
                                        className={`relative cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 ${
                                            isCurrent ? 'scale-110' : ''
                                        }`}
                                    >
                                        {/* Outer glow ring for current */}
                                        {isCurrent && (
                                            <div className="absolute -inset-3 rounded-full bg-[#FFD700]/40 animate-pulse" />
                                        )}
                                        
                                        {/* Main circle */}
                                        <div className={`relative w-24 h-24 rounded-full overflow-hidden border-4 shadow-xl ${
                                            itemIsLocked 
                                                ? 'border-gray-400' 
                                                : isCurrent 
                                                    ? 'border-[#FFD700] ring-4 ring-[#FFD700]/50' 
                                                    : isCompleted 
                                                        ? 'border-green-500' 
                                                        : 'border-white'
                                        }`}>
                                            {/* Cover image */}
                                            {item.coverImage ? (
                                                <img
                                                    src={item.coverImage}
                                                    alt={item.title}
                                                    className={`w-full h-full object-cover ${itemIsLocked ? 'filter brightness-50 grayscale-[30%]' : ''}`}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                                    {playlist.type === 'Song' ? (
                                                        <Music className="w-10 h-10 text-white opacity-70" />
                                                    ) : (
                                                        <Headphones className="w-10 h-10 text-white opacity-70" />
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Overlay for locked items */}
                                            {itemIsLocked && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg">
                                                        <Lock className="w-5 h-5 text-[#5c2e0b]" />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Play button overlay for unlocked items */}
                                            {!itemIsLocked && !trackPlaying && (
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                                        <Play className="w-5 h-5 text-[#3E1F07] ml-0.5" fill="#3E1F07" />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Playing indicator */}
                                            {trackPlaying && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <div className="flex items-end gap-1 h-6">
                                                        <div className="w-1.5 bg-[#FFD700] rounded-full animate-[soundBar1_0.5s_ease-in-out_infinite]" style={{ height: '100%' }} />
                                                        <div className="w-1.5 bg-[#FFD700] rounded-full animate-[soundBar2_0.5s_ease-in-out_infinite_0.1s]" style={{ height: '60%' }} />
                                                        <div className="w-1.5 bg-[#FFD700] rounded-full animate-[soundBar3_0.5s_ease-in-out_infinite_0.2s]" style={{ height: '80%' }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Completion checkmark badge */}
                                        {isCompleted && !itemIsLocked && (
                                            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 border-3 border-white flex items-center justify-center shadow-lg">
                                                <Check className="w-5 h-5 text-white" strokeWidth={3} />
                                            </div>
                                        )}
                                        
                                        {/* Premium crown badge for locked */}
                                        {itemIsLocked && (
                                            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] border-2 border-white flex items-center justify-center shadow-lg">
                                                <Crown className="w-4 h-4 text-[#5c2e0b]" />
                                            </div>
                                        )}
                                        
                                        {/* Episode number badge */}
                                        <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${
                                            itemIsLocked 
                                                ? 'bg-gray-500 text-white' 
                                                : isCurrent 
                                                    ? 'bg-[#FFD700] text-[#3E1F07]' 
                                                    : 'bg-[#5DADE2] text-white'
                                        }`}>
                                            {index + 1}
                                        </div>
                                    </div>
                                    
                                    {/* Title card */}
                                    <div 
                                        className={`flex-1 max-w-[160px] ${isEven ? 'text-left' : 'text-right'}`}
                                        onClick={() => handleItemClick(index)}
                                    >
                                        <div className={`inline-block px-3 py-2 rounded-xl shadow-lg cursor-pointer transition-all hover:scale-105 ${
                                            itemIsLocked 
                                                ? 'bg-gray-200/90 border border-gray-300' 
                                                : isCurrent 
                                                    ? 'bg-[#FFF8E1] border-2 border-[#FFD700]' 
                                                    : 'bg-white/90 border border-white/50'
                                        }`}>
                                            <h4 className={`text-sm font-bold font-display leading-tight ${
                                                itemIsLocked ? 'text-gray-600' : 'text-[#3E1F07]'
                                            }`}>
                                                {item.title}
                                            </h4>
                                            {item.duration && (
                                                <p className={`text-xs mt-0.5 ${itemIsLocked ? 'text-gray-500' : 'text-[#8B4513]'}`}>
                                                    {formatDuration(item.duration)}
                                                </p>
                                            )}
                                            {isCurrent && trackPlaying && (
                                                <p className="text-xs text-[#FFD700] font-bold mt-1">♪ Playing</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Underwater Section - Below the waves */}
            <div className="relative bg-gradient-to-b from-[#0077B6] via-[#005f8a] to-[#1a4a5e]">
                {/* Sandy beach floor texture */}
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4A574' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }} />
                
                {/* Light rays from above */}
                <div className="absolute top-0 left-1/4 w-32 h-48 bg-gradient-to-b from-white/10 to-transparent transform -skew-x-12" />
                <div className="absolute top-0 right-1/3 w-24 h-40 bg-gradient-to-b from-white/5 to-transparent transform skew-x-12" />
                
                {/* Bubbles */}
                <div className="absolute top-8 left-[15%] w-3 h-3 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }} />
                <div className="absolute top-16 left-[45%] w-2 h-2 bg-white/15 rounded-full animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }} />
                <div className="absolute top-12 right-[25%] w-4 h-4 bg-white/10 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '3.5s' }} />
                
                {/* Comment Section for Playlist - Underwater */}
                {playlist && playlist._id && (
                    <div className="relative z-10 px-4 py-8 pb-24">
                        <CommentSection
                            contentId={playlist._id}
                            contentType="playlist"
                            title={playlist.title}
                            description={playlist.description}
                            songTitles={playlist.items?.map((item: any) => item.title)}
                            playlistType={playlist.type as 'Song' | 'Audiobook'}
                            variant="underwater"
                        />
                    </div>
                )}
                
                {/* Sea floor decorations */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#C19A6B]/30 to-transparent" />
            </div>
            
            {/* Mini Player - shows when audio is playing */}
            <MiniPlayer />
        </div>
    );
};

// Add sound bar and wave animation keyframes
const styleSheet = document.createElement('style');
styleSheet.textContent = `
@keyframes soundBar1 {
    0%, 100% { height: 40%; }
    50% { height: 100%; }
}
@keyframes soundBar2 {
    0%, 100% { height: 100%; }
    50% { height: 40%; }
}
@keyframes soundBar3 {
    0%, 100% { height: 60%; }
    50% { height: 100%; }
}
@keyframes wave {
    0% { transform: translateX(0); }
    50% { transform: translateX(-25%); }
    100% { transform: translateX(0); }
}
`;
if (!document.getElementById('playlist-detail-animations')) {
    styleSheet.id = 'playlist-detail-animations';
    document.head.appendChild(styleSheet);
}

export default PlaylistDetailPage;


