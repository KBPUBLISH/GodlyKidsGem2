import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Crown, Play, Pause, Music, Headphones, Heart, Bookmark, Eye, Hammer, Wrench } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import { libraryService } from '../services/libraryService';
import { useAudio } from '../context/AudioContext';
import MiniPlayer from '../components/audio/MiniPlayer';

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
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [localLikeCount, setLocalLikeCount] = useState(0);
    const [isInLibrary, setIsInLibrary] = useState(false);
    const [viewCount, setViewCount] = useState(0);
    
    // Dynamic gradient colors extracted from cover image
    const [gradientColors, setGradientColors] = useState({
        primary: '#8B4513',
        secondary: '#5c2e0b', 
        accent: '#d4a373'
    });
    
    // Check if this playlist is currently playing
    const isThisPlaylistPlaying = currentPlaylist?._id === playlistId;

    useEffect(() => {
        fetchPlaylist();
        // Check if favorited/liked from localStorage
        const favorites = JSON.parse(localStorage.getItem('favorited_playlists') || '[]');
        const likes = JSON.parse(localStorage.getItem('liked_playlists') || '[]');
        const isLocallyLiked = likes.includes(playlistId);
        setIsFavorited(favorites.includes(playlistId));
        setIsLiked(isLocallyLiked);
        
        // Check if in library
        if (playlistId) {
            setIsInLibrary(libraryService.isInLibrary(playlistId));
        }
    }, [playlistId]);
    
    // Calculate total play count from all tracks in the playlist
    useEffect(() => {
        if (playlistId && playlist && playlist.items) {
            let totalPlays = 0;
            playlist.items.forEach((item) => {
                const trackId = item._id || `${playlistId}_${item.order || 0}`;
                const trackPlayCount = parseInt(
                    localStorage.getItem(`playlist_track_play_count_${trackId}`) || '0',
                    10
                );
                totalPlays += trackPlayCount;
            });
            setViewCount(totalPlays);
        }
    }, [playlistId, playlist]);
    
    // Extract colors from cover image when playlist loads
    useEffect(() => {
        if (playlist?.coverImage) {
            extractColors(playlist.coverImage).then(colors => {
                setGradientColors(colors);
            });
        }
    }, [playlist?.coverImage]);

    const fetchPlaylist = async () => {
        try {
            const baseUrl = getApiBaseUrl();
            const response = await fetch(`${baseUrl}playlists/${playlistId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch playlist');
            }
            const data = await response.json();
            // Sort items by order
            if (data.items && Array.isArray(data.items)) {
                data.items.sort((a: AudioItem, b: AudioItem) => (a.order || 0) - (b.order || 0));
            }
            setPlaylist(data);
            // Initialize like count from backend, but ensure it's at least 1 if locally liked
            const likes = JSON.parse(localStorage.getItem('liked_playlists') || '[]');
            const isLocallyLiked = likes.includes(playlistId);
            const backendLikeCount = data.likeCount || 0;
            // If locally liked and backend count is 0, show at least 1
            // Otherwise use backend count (which should include local like)
            setLocalLikeCount(isLocallyLiked && backendLikeCount === 0 ? 1 : backendLikeCount);
        } catch (error) {
            console.error('Error fetching playlist:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        if (!playlistId) return;
        
        // Toggle library status
        const newLibraryState = libraryService.toggleLibrary(playlistId);
        setIsInLibrary(newLibraryState);
        
        // Also update favorite status to match
        const favorites = JSON.parse(localStorage.getItem('favorited_playlists') || '[]');
        if (newLibraryState) {
            // Add to favorites if not already
            if (!favorites.includes(playlistId)) {
                favorites.push(playlistId);
                localStorage.setItem('favorited_playlists', JSON.stringify(favorites));
                setIsFavorited(true);
            }
        } else {
            // Remove from favorites
            const updated = favorites.filter((id: string) => id !== playlistId);
            localStorage.setItem('favorited_playlists', JSON.stringify(updated));
            setIsFavorited(false);
        }
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

    const handleItemClick = (itemIndex: number) => {
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
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#fdf6e3]">
                <Music className="w-16 h-16 text-[#8B4513] mb-4 opacity-50" />
                <p className="text-[#5c2e0b] text-lg font-display mb-4">Playlist not found or empty</p>
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
        <div className="flex flex-col h-full overflow-y-auto no-scrollbar bg-[#fdf6e3]">
            {/* TOP SECTION - DYNAMIC GRADIENT BACKGROUND */}
            <div className="relative pb-8 shadow-2xl z-10 overflow-hidden shrink-0 w-full">
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
                        className="w-12 h-12 bg-[#90be6d] rounded-full border-4 border-[#f3e5ab] overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.3)] relative flex items-center justify-center transform transition-transform active:scale-95 group"
                    >
                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-r-[12px] border-r-white border-b-[8px] border-b-transparent mr-1"></div>
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
                            {playlist.title}
                        </h1>
                        {playlist.author && (
                            <p className="text-[#e2cba5] font-medium text-lg mb-2">
                                {playlist.author}
                            </p>
                        )}
                        {playlist.description && (
                            <p className="text-[#e2cba5] text-sm mb-3">
                                {playlist.description}
                            </p>
                        )}
                        <p className="text-[#e2cba5] text-sm mb-4">
                            {playlist.items.length} {playlist.type === 'Song' ? 'songs' : 'episodes'}
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
                                <span className="text-sm font-bold">{isInLibrary ? 'Saved' : 'Save'}</span>
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

                            {/* View Counter */}
                            <button
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-[#d4c5a0] bg-[#fdf6e3] text-[#8B4513] cursor-default"
                            >
                                <Eye size={18} />
                                <span className="text-sm font-bold">{viewCount}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT SECTION - Audio Items List */}
            <div className="flex-1 w-full px-6 pt-8 pb-32">
                <div className="max-w-2xl mx-auto space-y-3">
                    {playlist.items.map((item, index) => {
                        const trackPlaying = isTrackPlaying(index);
                        const isCurrent = isCurrentTrack(index);
                        
                        return (
                            <div
                                key={item._id || index}
                                onClick={() => handleItemClick(index)}
                                className={`rounded-xl overflow-hidden shadow-md border-2 hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group ${
                                    isCurrent 
                                        ? 'bg-[#FFF8E1] border-[#FFD700] ring-2 ring-[#FFD700]/50' 
                                        : 'bg-white border-[#d4c5a0]'
                                }`}
                            >
                                <div className="flex items-center gap-4 p-4">
                                    {/* Cover Image or Icon */}
                                    <div className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 relative ${
                                        isCurrent ? 'border-[#FFD700]' : 'border-[#d4c5a0]'
                                    }`}>
                                        {item.coverImage ? (
                                            <img
                                                src={item.coverImage}
                                                alt={item.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                                {playlist.type === 'Song' ? (
                                                    <Music className="w-8 h-8 text-white opacity-50" />
                                                ) : (
                                                    <Headphones className="w-8 h-8 text-white opacity-50" />
                                                )}
                                            </div>
                                        )}
                                        {/* Playing indicator on cover */}
                                        {trackPlaying && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <div className="flex items-end gap-0.5 h-4">
                                                    <div className="w-1 bg-[#FFD700] rounded-full animate-[soundBar1_0.5s_ease-in-out_infinite]" style={{ height: '100%' }} />
                                                    <div className="w-1 bg-[#FFD700] rounded-full animate-[soundBar2_0.5s_ease-in-out_infinite_0.1s]" style={{ height: '60%' }} />
                                                    <div className="w-1 bg-[#FFD700] rounded-full animate-[soundBar3_0.5s_ease-in-out_infinite_0.2s]" style={{ height: '80%' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Item Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`text-lg font-bold truncate font-display ${
                                            isCurrent ? 'text-[#8B4513]' : 'text-[#3E1F07]'
                                        }`}>
                                            {item.title}
                                        </h3>
                                        {item.author && (
                                            <p className="text-sm text-[#8B4513] truncate">{item.author}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            {item.duration && (
                                                <p className="text-xs text-[#5c2e0b] opacity-75">
                                                    {formatDuration(item.duration)}
                                                </p>
                                            )}
                                            {isCurrent && (
                                                <span className="text-xs font-bold text-[#8B4513] bg-[#FFD700]/30 px-2 py-0.5 rounded-full">
                                                    {trackPlaying ? 'Now Playing' : 'Paused'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Play/Pause Button */}
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors shrink-0 ${
                                        trackPlaying 
                                            ? 'bg-[#FFD700] group-hover:bg-[#FFC107]' 
                                            : 'bg-[#8B4513] group-hover:bg-[#6B3410]'
                                    }`}>
                                        {trackPlaying ? (
                                            <Pause className="w-6 h-6 text-[#3E1F07]" fill="#3E1F07" />
                                        ) : (
                                            <Play className="w-6 h-6 text-white ml-1" fill="white" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Mini Player - shows when audio is playing */}
            <MiniPlayer />
        </div>
    );
};

// Add sound bar animation keyframes
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
`;
if (!document.getElementById('playlist-detail-animations')) {
    styleSheet.id = 'playlist-detail-animations';
    document.head.appendChild(styleSheet);
}

export default PlaylistDetailPage;


