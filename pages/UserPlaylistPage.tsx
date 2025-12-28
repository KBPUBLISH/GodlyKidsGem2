import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Pause, Play, SkipBack, SkipForward, Music, Trash2, Edit2, ListMusic, RotateCcw } from 'lucide-react';
import { userPlaylistService, UserPlaylist, PlaylistItem } from '../services/userPlaylistService';

const UserPlaylistPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    useEffect(() => {
        const fetchPlaylist = async () => {
            if (!id) return;
            setLoading(true);
            const data = await userPlaylistService.getPlaylist(id);
            setPlaylist(data);
            setLoading(false);
        };
        fetchPlaylist();
    }, [id]);
    
    useEffect(() => {
        // Setup audio element
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }
        
        const audio = audioRef.current;
        
        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration);
        const handleEnded = () => {
            // Auto-play next track
            if (playlist && currentTrackIndex < playlist.items.length - 1) {
                setCurrentTrackIndex(prev => prev + 1);
            } else {
                setIsPlaying(false);
            }
        };
        
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);
        
        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [playlist, currentTrackIndex]);
    
    // Load and play track when index changes
    useEffect(() => {
        if (!playlist || !audioRef.current) return;
        
        const track = playlist.items[currentTrackIndex];
        if (!track) return;
        
        audioRef.current.src = track.audioUrl;
        if (isPlaying) {
            audioRef.current.play().catch(console.error);
        }
    }, [currentTrackIndex, playlist]);
    
    const handlePlayPause = () => {
        if (!audioRef.current || !playlist?.items.length) return;
        
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }
        setIsPlaying(!isPlaying);
    };
    
    const handlePrevTrack = () => {
        if (currentTrackIndex > 0) {
            setCurrentTrackIndex(prev => prev - 1);
        }
    };
    
    const handleNextTrack = () => {
        if (playlist && currentTrackIndex < playlist.items.length - 1) {
            setCurrentTrackIndex(prev => prev + 1);
        }
    };
    
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const newTime = parseFloat(e.target.value);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };
    
    const handleRemoveItem = async (itemId: string) => {
        if (!playlist || !id) return;
        if (!confirm('Remove this item from the playlist?')) return;
        
        const updated = await userPlaylistService.removeItem(id, itemId);
        if (updated) {
            setPlaylist(updated);
            // Adjust current track index if needed
            if (currentTrackIndex >= updated.items.length) {
                setCurrentTrackIndex(Math.max(0, updated.items.length - 1));
            }
        }
    };
    
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    const currentTrack = playlist?.items[currentTrackIndex];
    const coverImage = currentTrack?.coverImage || playlist?.coverImage;
    
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#1a0f05] to-[#2d1809] flex items-center justify-center">
                <div className="text-white font-display">Loading playlist...</div>
            </div>
        );
    }
    
    if (!playlist) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#1a0f05] to-[#2d1809] flex flex-col items-center justify-center p-4">
                <ListMusic className="w-16 h-16 text-white/30 mb-4" />
                <p className="text-white font-display text-lg mb-4">Playlist not found</p>
                <button
                    onClick={() => navigate('/library')}
                    className="px-6 py-2 bg-amber-600 text-white rounded-full font-bold"
                >
                    Back to Library
                </button>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#1a0f05] to-[#2d1809] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-[#2d1809] to-transparent px-4 py-3">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate('/library')}
                        className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-white font-display font-bold text-lg truncate mx-4 flex-1 text-center">
                        {playlist.name}
                    </h1>
                    <div className="w-10" /> {/* Spacer */}
                </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center px-4 pt-4 pb-40">
                {/* Cover Art */}
                <div className="w-64 h-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-[#5D4037] mb-6">
                    {coverImage ? (
                        <img
                            src={coverImage}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                            <ListMusic className="w-24 h-24 text-white/50" />
                        </div>
                    )}
                </div>
                
                {/* Current Track Info */}
                {currentTrack ? (
                    <div className="text-center mb-6">
                        <h2 className="text-white font-bold text-xl mb-1">{currentTrack.title}</h2>
                        {currentTrack.author && (
                            <p className="text-white/60 text-sm">{currentTrack.author}</p>
                        )}
                    </div>
                ) : (
                    <div className="text-center mb-6">
                        <p className="text-white/60">No tracks in playlist</p>
                    </div>
                )}
                
                {/* Progress Bar */}
                {currentTrack && (
                    <div className="w-full max-w-md mb-6">
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full"
                        />
                        <div className="flex justify-between text-white/50 text-xs mt-1">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>
                )}
                
                {/* Controls */}
                <div className="flex items-center gap-6 mb-8">
                    <button
                        onClick={handlePrevTrack}
                        disabled={currentTrackIndex === 0}
                        className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
                    >
                        <SkipBack className="w-6 h-6 text-white" fill="white" />
                    </button>
                    
                    <button
                        onClick={handlePlayPause}
                        disabled={!playlist.items.length}
                        className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 flex items-center justify-center shadow-lg hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                        {isPlaying ? (
                            <Pause className="w-8 h-8 text-[#2d1809]" fill="#2d1809" />
                        ) : (
                            <Play className="w-8 h-8 text-[#2d1809] ml-1" fill="#2d1809" />
                        )}
                    </button>
                    
                    <button
                        onClick={handleNextTrack}
                        disabled={!playlist || currentTrackIndex >= playlist.items.length - 1}
                        className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
                    >
                        <SkipForward className="w-6 h-6 text-white" fill="white" />
                    </button>
                </div>
                
                {/* Track List */}
                <div className="w-full max-w-md">
                    <h3 className="text-white/70 text-sm font-bold mb-3 uppercase tracking-wider">
                        Playlist ({playlist.items.length} items)
                    </h3>
                    <div className="space-y-2">
                        {playlist.items.map((item, index) => (
                            <div
                                key={item._id}
                                onClick={() => {
                                    setCurrentTrackIndex(index);
                                    setIsPlaying(true);
                                }}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                                    index === currentTrackIndex
                                        ? 'bg-amber-600/30 border border-amber-500/50'
                                        : 'bg-white/5 hover:bg-white/10'
                                }`}
                            >
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                                    {item.coverImage ? (
                                        <img src={item.coverImage} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Music className="w-5 h-5 text-white/30" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-medium truncate ${
                                        index === currentTrackIndex ? 'text-amber-300' : 'text-white'
                                    }`}>
                                        {item.title}
                                    </p>
                                    <p className="text-white/50 text-xs truncate">
                                        {item.type === 'Audiobook' ? '📖' : '🎵'} {item.author || 'Unknown'}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveItem(item._id);
                                    }}
                                    className="p-2 rounded-full hover:bg-red-500/30 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        ))}
                        
                        {playlist.items.length === 0 && (
                            <div className="text-center py-8 bg-white/5 rounded-xl">
                                <Music className="w-12 h-12 text-white/20 mx-auto mb-2" />
                                <p className="text-white/50 text-sm">No items yet</p>
                                <p className="text-white/30 text-xs mt-1">
                                    Add songs or audiobooks from the explore page
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserPlaylistPage;

