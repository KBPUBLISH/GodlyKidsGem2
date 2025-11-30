import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Crown, Pause, Play, SkipBack, SkipForward, Music, Heart, RotateCcw } from 'lucide-react';
import { favoritesService } from '../services/favoritesService';
import { getApiBaseUrl } from '../services/apiService';
import { useAudio, Playlist } from '../context/AudioContext';

const PlaylistPlayerPage: React.FC = () => {
    const { playlistId, itemIndex } = useParams();
    const navigate = useNavigate();
    const {
        currentPlaylist,
        currentTrackIndex,
        isPlaying,
        progress,
        currentTime,
        duration,
        playPlaylist,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seek
    } = useAudio();

    const [loading, setLoading] = useState(true);
    const [localPlaylist, setLocalPlaylist] = useState<Playlist | null>(null);
    const [playCount, setPlayCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);

    // Fetch playlist data on mount or when params change
    useEffect(() => {
        const fetchPlaylistData = async () => {
            try {
                const targetIndex = itemIndex ? parseInt(itemIndex) : 0;

                // Case 1: Playlist is already active globally
                if (currentPlaylist && currentPlaylist._id === playlistId) {
                    setLocalPlaylist(currentPlaylist);
                    setLoading(false);

                    // If URL specifies a different track than what's playing, switch to it
                    if (itemIndex && parseInt(itemIndex) !== currentTrackIndex) {
                        playPlaylist(currentPlaylist, targetIndex);
                    }
                    return;
                }

                // Case 2: New playlist, need to fetch
                const baseUrl = getApiBaseUrl();
                const response = await fetch(`${baseUrl}playlists/${playlistId}`);
                if (!response.ok) throw new Error('Failed to fetch playlist');

                const data = await response.json();
                if (data.items && Array.isArray(data.items)) {
                    data.items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
                }
                setLocalPlaylist(data);

                // Start playing the new playlist at the requested index
                playPlaylist(data, targetIndex);

            } catch (error) {
                console.error('Error fetching playlist:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlaylistData();
    }, [playlistId, itemIndex]); // Re-run if ID or Index changes

    // Update local state when track changes
    useEffect(() => {
        const playlistToUse = currentPlaylist || localPlaylist;
        if (playlistToUse && playlistToUse.items.length > 0) {
            const track = playlistToUse.items[currentTrackIndex];
            if (track) {
                const trackId = track._id || `${playlistToUse._id}_${currentTrackIndex}`;
                const count = parseInt(localStorage.getItem(`playlist_track_play_count_${trackId}`) || '0', 10);
                setPlayCount(count);
                setIsLiked(favoritesService.getLikes().includes(trackId));
            }
        }
    }, [currentTrackIndex, currentPlaylist, localPlaylist]);

    const handleSkipBackward = () => {
        seek(Math.max(0, currentTime - 30));
    };

    const handleSkipForward = () => {
        seek(Math.min(duration, currentTime + 30));
    };

    const handleLike = () => {
        const playlistToUse = currentPlaylist || localPlaylist;
        if (!playlistToUse || !playlistToUse.items[currentTrackIndex]) return;
        const trackId = playlistToUse.items[currentTrackIndex]._id || `${playlistToUse._id}_${currentTrackIndex}`;
        favoritesService.toggleLike(trackId);
        setIsLiked(favoritesService.getLikes().includes(trackId));
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        seek(percentage * duration);
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
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

    const activePlaylist = currentPlaylist || localPlaylist;

    if (!activePlaylist || activePlaylist.items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#fdf6e3]">
                <Music className="w-16 h-16 text-[#8B4513] mb-4 opacity-50" />
                <p className="text-[#5c2e0b] text-lg font-bold">Playlist not found or empty</p>
                <button
                    onClick={() => navigate('/audio')}
                    className="mt-4 px-6 py-2 bg-[#8B4513] text-white rounded-lg hover:bg-[#5e2c04]"
                >
                    Back to Audio Library
                </button>
            </div>
        );
    }

    const currentTrack = activePlaylist.items[currentTrackIndex];

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden bg-[#fdf6e3]">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")` }}>
            </div>

            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 z-30 flex justify-between items-center pt-8">
                <button
                    onClick={() => navigate(-1)}
                    className="w-12 h-12 bg-[#e67e22] rounded-2xl border-b-4 border-[#d35400] shadow-lg flex items-center justify-center active:translate-y-1 active:border-b-0 active:shadow-none transition-all"
                >
                    <ChevronLeft size={32} className="text-[#5c2e0b]" strokeWidth={3} />
                </button>

                <div className="flex items-center gap-3">
                    {/* Play Count */}
                    <div className="bg-[#f3e5ab] rounded-full px-3 py-1.5 border-2 border-[#d4c5a0] flex items-center gap-2 shadow-sm">
                        <Play size={16} className="text-[#8B4513]" fill="#8B4513" />
                        <span className="text-[#8B4513] text-sm font-bold">{playCount}</span>
                    </div>

                    {/* Like Button */}
                    <button
                        onClick={handleLike}
                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg transition-all ${isLiked
                            ? 'bg-red-500 border-red-600'
                            : 'bg-[#f3e5ab] border-[#d4c5a0]'
                            }`}
                    >
                        <Heart
                            size={24}
                            className={isLiked ? 'text-white fill-white' : 'text-[#8B4513]'}
                            fill={isLiked ? 'white' : 'none'}
                        />
                    </button>

                    {/* Crown Icon */}
                    <div className="w-12 h-12 bg-[#f3e5ab] rounded-full border-2 border-[#d4c5a0] flex items-center justify-center shadow-lg">
                        <Crown className="text-[#8B4513]" size={24} fill="#8B4513" />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-48 relative z-10 overflow-y-auto no-scrollbar">
                {/* Album Art - Increased Size */}
                <div className="w-[22rem] h-[22rem] mb-8 relative shrink-0 transition-transform duration-500 hover:scale-105">
                    <div className="absolute inset-0 bg-black/20 rounded-xl transform rotate-3 scale-105 blur-sm"></div>
                    <div className="relative w-full h-full rounded-2xl overflow-hidden border-[6px] border-[#8B4513] shadow-2xl">
                        {currentTrack.coverImage || activePlaylist.coverImage ? (
                            <img
                                src={currentTrack.coverImage || activePlaylist.coverImage}
                                alt={currentTrack.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#8B4513] to-[#5c2e0b] flex items-center justify-center">
                                <Music className="w-24 h-24 text-[#f3e5ab] opacity-50" />
                            </div>
                        )}

                        {/* Decorative corners */}
                        <div className="absolute top-0 left-0 w-10 h-10 border-t-[6px] border-l-[6px] border-[#FFD700] rounded-tl-lg opacity-90"></div>
                        <div className="absolute top-0 right-0 w-10 h-10 border-t-[6px] border-r-[6px] border-[#FFD700] rounded-tr-lg opacity-90"></div>
                        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[6px] border-l-[6px] border-[#FFD700] rounded-bl-lg opacity-90"></div>
                        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[6px] border-r-[6px] border-[#FFD700] rounded-br-lg opacity-90"></div>
                    </div>
                </div>

                {/* Track Info */}
                <div className="w-full max-w-md text-center">
                    <h2 className="text-3xl font-display font-black text-[#3E1F07] mb-2 leading-tight drop-shadow-sm">
                        {currentTrack.title}
                    </h2>
                    <p className="text-[#8B4513] font-sans text-lg font-bold mb-4 uppercase tracking-wider opacity-90">
                        {currentTrack.author || activePlaylist.author}
                    </p>

                    <div className="inline-block px-4 py-1 rounded-full bg-[#e6d5b8] border border-[#d4c5a0]">
                        <p className="text-[#5c2e0b] text-sm font-bold">
                            {activePlaylist.title} • Track {currentTrackIndex + 1}/{activePlaylist.items.length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom Player Control Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-48 bg-[#8B4513] z-30 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.4)] flex flex-col px-8 pt-8 overflow-hidden border-t-4 border-[#5c2e0b]">
                {/* Wood Texture Background */}
                <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply"
                    style={{
                        backgroundImage: `repeating-linear-gradient(
                            90deg, 
                            #5e2c04 0%, #5e2c04 2%, 
                            #8B4513 2%, #8B4513 5%, 
                            #A0522D 5%, #A0522D 10%
                        )`
                    }}
                ></div>

                {/* Progress Slider */}
                <div
                    onClick={handleSeek}
                    className="relative w-full h-3 bg-[#3E1F07] rounded-full mb-3 mt-4 z-40 group cursor-pointer shadow-inner"
                >
                    <div
                        className="absolute top-0 left-0 h-full bg-[#FFD700] rounded-full"
                        style={{ width: `${progress}%` }}
                    ></div>
                    <div
                        className="absolute top-1/2 -translate-y-1/2 h-6 w-6 bg-[#f3e5ab] border-4 border-[#8B4513] rounded-full shadow-lg transform transition-transform group-hover:scale-110"
                        style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                    ></div>
                </div>

                {/* Time Labels */}
                <div className="flex justify-between text-xs font-bold text-[#f3e5ab] mb-4 relative z-40">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-center gap-8 relative z-40">
                    {/* Previous Track */}
                    <button
                        onClick={prevTrack}
                        disabled={currentTrackIndex === 0}
                        className="text-[#f3e5ab] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors transform active:scale-90"
                    >
                        <SkipBack size={32} fill="currentColor" />
                    </button>

                    {/* Skip Backward 30s */}
                    <button
                        onClick={handleSkipBackward}
                        className="w-12 h-12 bg-[#5c2e0b] rounded-full border-2 border-[#8B4513] flex items-center justify-center text-[#f3e5ab] hover:bg-[#3e1f07] transition-colors transform active:scale-90 shadow-lg"
                        title="Skip backward 30 seconds"
                    >
                        <RotateCcw size={20} />
                        <span className="absolute text-[10px] font-bold mt-1">30</span>
                    </button>

                    {/* Play/Pause Button */}
                    <button
                        onClick={togglePlayPause}
                        className="w-20 h-20 bg-gradient-to-b from-[#FFD700] to-[#FFA000] rounded-full border-[4px] border-[#5c2e0b] shadow-[0_4px_0_#3e1f07] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all hover:brightness-110"
                    >
                        {isPlaying ? (
                            <Pause size={40} fill="#3e1f07" className="text-[#3e1f07]" />
                        ) : (
                            <Play size={40} fill="#3e1f07" className="text-[#3e1f07] ml-1" />
                        )}
                    </button>

                    {/* Skip Forward 30s */}
                    <button
                        onClick={handleSkipForward}
                        className="w-12 h-12 bg-[#5c2e0b] rounded-full border-2 border-[#8B4513] flex items-center justify-center text-[#f3e5ab] hover:bg-[#3e1f07] transition-colors transform active:scale-90 shadow-lg"
                        title="Skip forward 30 seconds"
                    >
                        <RotateCcw size={20} className="rotate-180" />
                        <span className="absolute text-[10px] font-bold mt-1">30</span>
                    </button>

                    {/* Next Track */}
                    <button
                        onClick={nextTrack}
                        disabled={!activePlaylist || currentTrackIndex === activePlaylist.items.length - 1}
                        className="text-[#f3e5ab] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors transform active:scale-90"
                    >
                        <SkipForward size={32} fill="currentColor" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlaylistPlayerPage;
