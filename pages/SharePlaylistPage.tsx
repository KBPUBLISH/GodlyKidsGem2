import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, Music, Clock, Download, Sparkles, ChevronRight, Volume2 } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';

interface PlaylistItem {
    _id: string;
    title: string;
    description?: string;
    audioUrl?: string;
    imageUrl?: string;
    duration?: number;
    artist?: string;
}

interface Playlist {
    _id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    items?: PlaylistItem[];
    category?: string;
}

const SharePlaylistPage: React.FC = () => {
    const { playlistId: rawPlaylistId, trackIndex: rawTrackIndex } = useParams<{ playlistId: string; trackIndex?: string }>();
    const navigate = useNavigate();
    
    // Parse track index if provided (for sharing specific songs/episodes)
    const trackIndex = rawTrackIndex ? parseInt(rawTrackIndex, 10) : null;
    
    // Clean the playlist ID - remove any URL-encoded text that might be appended
    // Some platforms append share text to the URL (e.g., "id%20some%20text")
    const playlistId = useMemo(() => {
        if (!rawPlaylistId) return '';
        // Take only the first part before any space or special characters
        // MongoDB IDs are 24 hex characters
        const cleaned = decodeURIComponent(rawPlaylistId).split(/[\s%]/)[0];
        // Validate it looks like a MongoDB ObjectId (24 hex chars)
        if (/^[a-f0-9]{24}$/i.test(cleaned)) {
            return cleaned;
        }
        // If not valid, try to extract first 24 hex chars
        const match = rawPlaylistId.match(/^[a-f0-9]{24}/i);
        return match ? match[0] : rawPlaylistId.split('%')[0];
    }, [rawPlaylistId]);
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playingIndex, setPlayingIndex] = useState<number | null>(null);
    const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
    
    // Get the featured track if sharing a specific item
    const featuredTrack = playlist?.items && trackIndex !== null && trackIndex >= 0 && trackIndex < playlist.items.length
        ? playlist.items[trackIndex]
        : null;

    useEffect(() => {
        const fetchPlaylist = async () => {
            if (!playlistId) return;
            try {
                const baseUrl = getApiBaseUrl();
                const response = await fetch(`${baseUrl}playlists/${playlistId}`);
                if (!response.ok) throw new Error('Playlist not found');
                const data = await response.json();
                setPlaylist(data);
            } catch (err) {
                setError('This playlist could not be found');
            } finally {
                setLoading(false);
            }
        };
        fetchPlaylist();
    }, [playlistId]);

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayPreview = (index: number, audioUrl?: string) => {
        if (!audioUrl) return;
        
        if (playingIndex === index) {
            // Stop playing
            audioRef?.pause();
            setPlayingIndex(null);
            return;
        }

        // Stop previous audio
        audioRef?.pause();

        // Play new audio (30 second preview)
        const audio = new Audio(audioUrl);
        audio.volume = 0.7;
        audio.play();
        setAudioRef(audio);
        setPlayingIndex(index);

        // Stop after 30 seconds (preview limit)
        setTimeout(() => {
            audio.pause();
            if (playingIndex === index) setPlayingIndex(null);
        }, 30000);

        audio.onended = () => setPlayingIndex(null);
    };

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
        // Try to open in app via deep link (include track index if sharing specific track)
        const deepLink = trackIndex !== null 
            ? `godlykids://playlist/${playlistId}/${trackIndex}`
            : `godlykids://playlist/${playlistId}`;
        window.location.href = deepLink;
        
        // Fallback to app store after delay
        setTimeout(() => {
            handleGetApp();
        }, 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] to-[#2d1b4e] flex items-center justify-center">
                <div className="animate-spin w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !playlist) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] to-[#2d1b4e] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-[#3d2a5c] rounded-full flex items-center justify-center mb-6">
                    <Music className="w-10 h-10 text-[#FFD700]" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Playlist Not Found</h1>
                <p className="text-gray-400 mb-8">This playlist may have been removed or the link is invalid.</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-[#FFD700] text-[#1a0a2e] font-bold px-8 py-3 rounded-full"
                >
                    Explore Godly Kids
                </button>
            </div>
        );
    }

    // Use featured track's cover if sharing specific track, otherwise playlist cover
    const displayCover = featuredTrack?.imageUrl || playlist.imageUrl;
    const displayTitle = featuredTrack ? featuredTrack.title : playlist.title;
    const displaySubtitle = featuredTrack ? `from "${playlist.title}"` : playlist.description;

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e]">
            {/* Header with Cover */}
            <div className="relative">
                {/* Background blur */}
                <div 
                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30"
                    style={{ backgroundImage: `url(${displayCover})` }}
                />
                
                <div className="relative pt-12 pb-8 px-6">
                    {/* Cover Art */}
                    <div className="w-48 h-48 mx-auto rounded-2xl shadow-2xl overflow-hidden mb-6 border-4 border-white/10">
                        {displayCover ? (
                            <img 
                                src={displayCover} 
                                alt={displayTitle}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                                <Music className="w-20 h-20 text-white/80" />
                            </div>
                        )}
                    </div>

                    {/* Title & Info */}
                    <div className="text-center">
                        {featuredTrack && (
                            <span className="inline-block bg-[#FFD700] text-[#1a0a2e] text-xs font-bold px-3 py-1 rounded-full mb-3">
                                🎵 SHARED TRACK
                            </span>
                        )}
                        <h1 className="text-2xl font-bold text-white mb-2">{displayTitle}</h1>
                        {displaySubtitle && (
                            <p className="text-gray-300 text-sm mb-3 line-clamp-2">{displaySubtitle}</p>
                        )}
                        <div className="flex items-center justify-center gap-4 text-gray-400 text-sm">
                            <span className="flex items-center gap-1">
                                <Music className="w-4 h-4" />
                                {playlist.items?.length || 0} tracks
                            </span>
                            {playlist.category && (
                                <span className="bg-[#FFD700]/20 text-[#FFD700] px-2 py-0.5 rounded-full text-xs">
                                    {playlist.category}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Banner */}
            <div className="mx-4 mb-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-[#1a0a2e] text-sm">Listen to the full playlist!</h3>
                        <p className="text-[#1a0a2e]/70 text-xs">Get the Godly Kids app for unlimited access</p>
                    </div>
                    <button
                        onClick={handleGetApp}
                        className="bg-[#1a0a2e] text-white font-bold px-4 py-2 rounded-full text-sm flex items-center gap-1"
                    >
                        <Download className="w-4 h-4" />
                        Get App
                    </button>
                </div>
            </div>

            {/* Track List */}
            <div className="px-4 pb-32">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Volume2 className="w-5 h-5 text-[#FFD700]" />
                    Preview Tracks
                </h2>
                
                <div className="space-y-2">
                    {playlist.items?.map((item, index) => {
                        const isFeatured = trackIndex === index;
                        const isPlaying = playingIndex === index;
                        return (
                        <div 
                            key={item._id}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                isPlaying 
                                    ? 'bg-[#FFD700]/20 border border-[#FFD700]/30' 
                                    : isFeatured
                                    ? 'bg-[#FFD700]/10 border border-[#FFD700]/20 ring-2 ring-[#FFD700]/30'
                                    : 'bg-white/5 hover:bg-white/10'
                            }`}
                        >
                            {/* Play Button */}
                            <button
                                onClick={() => handlePlayPreview(index, item.audioUrl)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                    playingIndex === index
                                        ? 'bg-[#FFD700] text-[#1a0a2e]'
                                        : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                            >
                                {playingIndex === index ? (
                                    <Pause className="w-5 h-5" />
                                ) : (
                                    <Play className="w-5 h-5 ml-0.5" />
                                )}
                            </button>

                            {/* Track Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
                                {item.artist && (
                                    <p className="text-gray-400 text-xs truncate">{item.artist}</p>
                                )}
                            </div>

                            {/* Duration */}
                            <div className="flex items-center gap-1 text-gray-400 text-xs flex-shrink-0">
                                <Clock className="w-3 h-3" />
                                {formatDuration(item.duration)}
                            </div>
                            
                            {/* Featured badge */}
                            {isFeatured && (
                                <span className="bg-[#FFD700] text-[#1a0a2e] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    SHARED
                                </span>
                            )}
                        </div>
                    );
                    })}
                </div>

                {/* Preview Notice */}
                <p className="text-center text-gray-500 text-xs mt-6">
                    🎵 30-second previews • Get the app for full tracks
                </p>
            </div>

            {/* Fixed Bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a0a2e] via-[#1a0a2e] to-transparent pt-8 pb-6 px-4">
                <button
                    onClick={handleOpenInApp}
                    className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#1a0a2e] font-bold py-4 rounded-full text-lg flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/30"
                >
                    Open in Godly Kids App
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default SharePlaylistPage;

