import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Crown, Pause, Play, SkipBack, SkipForward, Music, Volume2, Heart, RotateCcw } from 'lucide-react';
import { favoritesService } from '../services/favoritesService';
import { getApiBaseUrl } from '../services/apiService';

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
    playCount?: number;
}

const PlaylistPlayerPage: React.FC = () => {
    const { playlistId, itemIndex } = useParams();
    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement>(null);

    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(itemIndex ? parseInt(itemIndex) : 0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [loading, setLoading] = useState(true);
    const [playCount, setPlayCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);

    useEffect(() => {
        fetchPlaylist();
    }, [playlistId]);

    useEffect(() => {
        if (playlist && playlist.items.length > 0 && audioRef.current) {
            const track = playlist.items[currentTrackIndex];
            audioRef.current.src = track.audioUrl;
            audioRef.current.load();
            
            // Load play count and like status for current track
            const trackId = track._id || `${playlistId}_${currentTrackIndex}`;
            const count = parseInt(localStorage.getItem(`playlist_track_play_count_${trackId}`) || '0', 10);
            setPlayCount(count);
            setIsLiked(favoritesService.getLikes().includes(trackId));
        }
    }, [currentTrackIndex, playlist, playlistId]);

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
        } catch (error) {
            console.error('Error fetching playlist:', error);
        } finally {
            setLoading(false);
        }
    };

    const togglePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(err => console.error('Play error:', err));
        }
        setIsPlaying(!isPlaying);
    };

    const handlePrevious = () => {
        if (currentTrackIndex > 0) {
            setCurrentTrackIndex(currentTrackIndex - 1);
            setIsPlaying(false);
        }
    };

    const handleNext = () => {
        if (playlist && currentTrackIndex < playlist.items.length - 1) {
            setCurrentTrackIndex(currentTrackIndex + 1);
            setIsPlaying(false);
        }
    };

    const handleSkipBackward = () => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 30);
    };

    const handleSkipForward = () => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 30);
    };

    const handleLike = () => {
        if (!playlist || !playlist.items[currentTrackIndex]) return;
        const trackId = playlist.items[currentTrackIndex]._id || `${playlistId}_${currentTrackIndex}`;
        favoritesService.toggleLike(trackId);
        setIsLiked(favoritesService.getLikes().includes(trackId));
    };

    const handleTrackEnd = () => {
        // Increment play count when track ends
        if (playlist && playlist.items[currentTrackIndex]) {
            const trackId = playlist.items[currentTrackIndex]._id || `${playlistId}_${currentTrackIndex}`;
            const currentCount = parseInt(localStorage.getItem(`playlist_track_play_count_${trackId}`) || '0', 10);
            localStorage.setItem(`playlist_track_play_count_${trackId}`, (currentCount + 1).toString());
            setPlayCount(currentCount + 1);
        }
        handleNext();
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        setCurrentTime(audioRef.current.currentTime);
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
    };

    const handleLoadedMetadata = () => {
        if (!audioRef.current) return;
        setDuration(audioRef.current.duration);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        audioRef.current.currentTime = percentage * audioRef.current.duration;
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#8B4513]"></div>
            </div>
        );
    }

    if (!playlist || playlist.items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6">
                <Music className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">Playlist not found or empty</p>
                <button
                    onClick={() => navigate('/audio')}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Back to Audio Library
                </button>
            </div>
        );
    }

    const currentTrack = playlist.items[currentTrackIndex];

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900">
            {/* Audio Element */}
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleTrackEnd}
            />

            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 z-30 flex justify-between items-center pt-8">
                <button
                    onClick={() => navigate(`/audio/playlist/${playlistId}`)}
                    className="w-12 h-12 bg-[#e67e22] rounded-2xl border-b-4 border-[#d35400] shadow-lg flex items-center justify-center active:translate-y-1 active:border-b-0 active:shadow-none transition-all"
                >
                    <ChevronLeft size={32} className="text-[#5c2e0b]" strokeWidth={3} />
                </button>

                <div className="flex items-center gap-3">
                    {/* Play Count */}
                    <div className="bg-black/30 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 flex items-center gap-2 shadow-lg">
                        <Play size={16} className="text-white/90" />
                        <span className="text-white/90 text-sm font-bold">{playCount}</span>
                    </div>

                    {/* Like Button */}
                    <button
                        onClick={handleLike}
                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg transition-all ${
                            isLiked 
                                ? 'bg-red-500/80 border-red-600' 
                                : 'bg-black/30 backdrop-blur-md border-white/20'
                        }`}
                    >
                        <Heart 
                            size={24} 
                            className={isLiked ? 'text-white fill-white' : 'text-white/90'} 
                            fill={isLiked ? 'white' : 'none'}
                        />
                    </button>

                    {/* Crown Icon */}
                    <div className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center shadow-lg">
                        <Crown className="text-white/90" size={24} />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-32 relative z-10 overflow-y-auto no-scrollbar">
                {/* Album Art */}
                <div className="w-[18.3rem] h-[18.3rem] mb-6 relative shrink-0">
                    <div className="absolute inset-0 bg-white/10 rounded-xl transform rotate-3 scale-105 blur-sm"></div>
                    <div className="relative w-full h-full rounded-lg overflow-hidden border-4 border-[#8B4513] shadow-2xl">
                        {currentTrack.coverImage || playlist.coverImage ? (
                            <img
                                src={currentTrack.coverImage || playlist.coverImage}
                                alt={currentTrack.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Music className="w-20 h-20 text-white opacity-50" />
                            </div>
                        )}

                        {/* Decorative corners */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#FFD700] rounded-tl-md opacity-80"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#FFD700] rounded-tr-md opacity-80"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#FFD700] rounded-bl-md opacity-80"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#FFD700] rounded-br-md opacity-80"></div>
                    </div>
                </div>

                {/* Track Info */}
                <div className="w-full max-w-sm bg-black/40 backdrop-blur-md rounded-3xl p-6 text-center border border-white/10 shadow-xl">
                    <h2 className="text-2xl font-display font-bold text-white mb-2 leading-tight">
                        {currentTrack.title}
                    </h2>
                    <p className="text-[#FFD700] font-sans text-sm font-bold mb-2 uppercase tracking-wider opacity-90">
                        {currentTrack.author}
                    </p>

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent mb-3"></div>

                    <p className="text-white/80 font-sans text-sm mb-2">
                        {playlist.title}
                    </p>
                    <p className="text-white/60 text-xs">
                        Track {currentTrackIndex + 1} of {playlist.items.length}
                    </p>
                </div>
            </div>

            {/* Bottom Player Control Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-44 bg-[#8B4513] z-30 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col px-8 pt-8 overflow-hidden">
                {/* Wood Texture Background */}
                <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-multiply"
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
                    className="relative w-full h-2 bg-[#3E1F07] rounded-full mb-3 mt-6 z-40 group cursor-pointer"
                >
                    <div
                        className="absolute top-0 left-0 h-full bg-white rounded-full"
                        style={{ width: `${progress}%` }}
                    ></div>
                    <div
                        className="absolute top-1/2 -translate-y-1/2 h-5 w-5 bg-black border-2 border-white rounded-full shadow-md"
                        style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                    ></div>
                </div>

                {/* Time Labels */}
                <div className="flex justify-between text-xs font-bold text-white/70 mb-2 relative z-40">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-center gap-6 relative z-40">
                    {/* Previous Track */}
                    <button
                        onClick={handlePrevious}
                        disabled={currentTrackIndex === 0}
                        className="text-[#d4a373] hover:text-[#e6b88a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors transform active:scale-90"
                    >
                        <SkipBack size={28} fill="currentColor" />
                    </button>

                    {/* Skip Backward 30s */}
                    <button
                        onClick={handleSkipBackward}
                        className="w-12 h-12 bg-[#5c2e0b]/50 rounded-full border-2 border-[#8B4513] flex items-center justify-center text-[#d4a373] hover:bg-[#5c2e0b]/70 transition-colors transform active:scale-90"
                        title="Skip backward 30 seconds"
                    >
                        <RotateCcw size={20} />
                        <span className="absolute text-xs font-bold">30</span>
                    </button>

                    {/* Play/Pause Button */}
                    <button
                        onClick={togglePlayPause}
                        className="w-16 h-16 bg-gradient-to-b from-[#deb887] to-[#b08d55] rounded-full border-[3px] border-[#5c2e0b] shadow-[0_4px_0_#3e1f07] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all"
                    >
                        {isPlaying ? (
                            <Pause size={32} fill="#3e1f07" className="text-[#3e1f07]" />
                        ) : (
                            <Play size={32} fill="#3e1f07" className="text-[#3e1f07] ml-1" />
                        )}
                    </button>

                    {/* Skip Forward 30s */}
                    <button
                        onClick={handleSkipForward}
                        className="w-12 h-12 bg-[#5c2e0b]/50 rounded-full border-2 border-[#8B4513] flex items-center justify-center text-[#d4a373] hover:bg-[#5c2e0b]/70 transition-colors transform active:scale-90"
                        title="Skip forward 30 seconds"
                    >
                        <RotateCcw size={20} className="rotate-180" />
                        <span className="absolute text-xs font-bold">30</span>
                    </button>

                    {/* Next Track */}
                    <button
                        onClick={handleNext}
                        disabled={currentTrackIndex === playlist.items.length - 1}
                        className="text-[#d4a373] hover:text-[#e6b88a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors transform active:scale-90"
                    >
                        <SkipForward size={28} fill="currentColor" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlaylistPlayerPage;
