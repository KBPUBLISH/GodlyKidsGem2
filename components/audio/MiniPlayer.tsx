import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Pause, X, Music, SkipBack, SkipForward, Crown, Lock } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { useUser } from '../../context/UserContext';

const MiniPlayer: React.FC = () => {
    const {
        currentPlaylist,
        currentTrackIndex,
        isPlaying,
        progress,
        currentTime,
        duration,
        togglePlayPause,
        closePlayer,
        nextTrack,
        prevTrack,
        seek,
        isPreviewMode,
        previewLimitReached,
        previewTimeRemaining,
        dismissPreviewLimit
    } = useAudio();

    const navigate = useNavigate();
    const location = useLocation();
    const { isSubscribed } = useUser();
    const [isDragging, setIsDragging] = useState(false);

    // Don't show mini player if:
    // 1. No playlist is active
    // 2. We are already on the full player page (path includes /play/)
    // 3. We are in a book reader (distraction free)
    // Note: We DO want to show on playlist detail page (/audio/playlist/:id) but NOT on player page (/audio/playlist/:id/play/:index)
    if (!currentPlaylist ||
        location.pathname.includes('/play/') ||
        location.pathname.includes('/read/') ||
        location.pathname.includes('/book-reader')) {
        return null;
    }

    const currentTrack = currentPlaylist.items[currentTrackIndex];
    if (!currentTrack) return null;

    const handleOpenFullPlayer = () => {
        navigate(`/audio/playlist/${currentPlaylist._id}/play/${currentTrackIndex}`);
    };

    const seekToPosition = (clientX: number, element: HTMLDivElement) => {
        const rect = element.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        seek(percentage * duration);
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        seekToPosition(e.clientX, e.currentTarget);
    };

    const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        seekToPosition(e.clientX, e.currentTarget);
    };

    const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isDragging) {
            seekToPosition(e.clientX, e.currentTarget);
        }
    };

    const handleProgressMouseUp = () => {
        setIsDragging(false);
    };

    const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        setIsDragging(true);
        const touch = e.touches[0];
        seekToPosition(touch.clientX, e.currentTarget);
    };

    const handleProgressTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (isDragging && e.touches.length > 0) {
            const touch = e.touches[0];
            seekToPosition(touch.clientX, e.currentTarget);
        }
    };

    const handleProgressTouchEnd = () => {
        setIsDragging(false);
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div 
            className="fixed bottom-0 left-0 right-0 z-[60] animate-slide-up"
            style={{
                // Account for safe area bottom (home indicator on iPhone X+)
                // Despia native runtime provides var(--safe-area-bottom) automatically
                paddingBottom: 'var(--safe-area-bottom, 0px)'
            }}
        >
            <div
                className="bg-[#8B4513] rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.4)] border-t-2 border-[#d4a373] overflow-hidden relative"
                style={{
                    backgroundImage: `repeating-linear-gradient(
                        90deg, 
                        #5e2c04 0%, #5e2c04 2%, 
                        #8B4513 2%, #8B4513 5%, 
                        #A0522D 5%, #A0522D 10%
                    )`
                }}
            >
                {/* Wood Texture Overlay */}
                <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>

                {/* Progress Bar */}
                <div
                    onClick={handleProgressClick}
                    onMouseDown={handleProgressMouseDown}
                    onMouseMove={handleProgressMouseMove}
                    onMouseUp={handleProgressMouseUp}
                    onMouseLeave={handleProgressMouseUp}
                    onTouchStart={handleProgressTouchStart}
                    onTouchMove={handleProgressTouchMove}
                    onTouchEnd={handleProgressTouchEnd}
                    className={`absolute top-0 left-0 right-0 h-1 bg-[#3e1f07] z-10 group ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
                >
                    <div
                        className="h-full bg-[#FFD700] transition-all duration-100"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>

                {/* Main Content */}
                <div className="flex items-center p-3 pb-4 pt-4 relative z-10">
                    {/* Cover Art */}
                    <div
                        onClick={handleOpenFullPlayer}
                        className="w-12 h-12 rounded-lg border-2 border-[#d4a373] overflow-hidden shrink-0 cursor-pointer"
                    >
                        {currentTrack.coverImage || currentPlaylist.coverImage ? (
                            <img
                                src={currentTrack.coverImage || currentPlaylist.coverImage}
                                alt={currentTrack.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Music className="w-6 h-6 text-white opacity-50" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div
                        onClick={handleOpenFullPlayer}
                        className="flex-1 min-w-0 mx-3 cursor-pointer"
                    >
                        <h4 className="text-white font-bold text-sm truncate leading-tight">
                            {currentTrack.title}
                        </h4>
                        <p className="text-[#e2cba5] text-xs truncate">
                            {currentTrack.author || currentPlaylist.author}
                        </p>
                        <p className="text-[#d4a373] text-[10px] mt-0.5">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </p>
                    </div>
                    
                    {/* Preview Mode Badge - show for non-subscribed users */}
                    {!isSubscribed && (
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate('/paywall'); }}
                            className="flex items-center gap-1 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-bold py-1.5 px-2.5 rounded-lg text-[10px] shadow-md transform hover:scale-105 transition-all duration-200 active:scale-95 mr-2"
                        >
                            <Lock className="w-3 h-3" />
                            <span>{Math.floor(previewTimeRemaining / 60)}:{String(previewTimeRemaining % 60).padStart(2, '0')}</span>
                        </button>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        {/* Previous Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); prevTrack(); }}
                            disabled={currentTrackIndex === 0}
                            className="text-[#f3e5ab] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-90"
                        >
                            <SkipBack size={20} fill="currentColor" />
                        </button>

                        {/* Play/Pause Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                            className="w-10 h-10 bg-[#f3e5ab] rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform"
                        >
                            {isPlaying ? (
                                <Pause size={20} fill="#3e1f07" className="text-[#3e1f07]" />
                            ) : (
                                <Play size={20} fill="#3e1f07" className="text-[#3e1f07] ml-0.5" />
                            )}
                        </button>

                        {/* Next Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); nextTrack(); }}
                            disabled={!currentPlaylist || currentTrackIndex === currentPlaylist.items.length - 1}
                            className="text-[#f3e5ab] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-90"
                        >
                            <SkipForward size={20} fill="currentColor" />
                        </button>

                        {/* Close Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); closePlayer(); }}
                            className="text-[#e2cba5] hover:text-white p-1 ml-1"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Premium Preview Limit Modal */}
            {previewLimitReached && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-[90%] max-w-md bg-gradient-to-b from-[#1a237e] to-[#0d113a] rounded-3xl p-8 shadow-2xl animate-in zoom-in-75 duration-500 border-4 border-[#FFD700]">
                        {/* Crown decoration */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                            <Crown className="w-8 h-8 text-[#5c2e0b]" />
                        </div>
                        
                        {/* Content */}
                        <div className="text-center mt-6">
                            <h2 className="text-2xl font-bold text-white drop-shadow-lg mb-2">
                                Enjoying the Audio?
                            </h2>
                            <p className="text-[#eecaa0] text-base mb-2">
                                You've listened to your 2-minute free preview!
                            </p>
                            <p className="text-white/70 text-sm mb-6">
                                Unlock unlimited listening with a subscription.
                            </p>
                            
                            {/* Audio preview indicator */}
                            <div className="bg-[#3E1F07]/50 rounded-xl p-4 mb-6">
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-[#FFD700]/50">
                                        {currentPlaylist?.coverImage ? (
                                            <img src={currentPlaylist.coverImage} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                                <Music className="w-6 h-6 text-white/50" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-white font-bold text-sm truncate max-w-[180px]">{currentPlaylist?.title}</p>
                                        <div className="flex items-center gap-1 text-[#FFD700] text-xs">
                                            <Lock size={10} />
                                            <span>Premium Content</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Buttons */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        dismissPreviewLimit();
                                        closePlayer();
                                        navigate('/paywall', { state: { from: `/audio/playlist/${currentPlaylist?._id}` } });
                                    }}
                                    className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#5c2e0b] font-bold px-8 py-4 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-lg"
                                >
                                    🎵 Unlock Unlimited Audio
                                </button>
                                <button
                                    onClick={() => {
                                        dismissPreviewLimit();
                                        closePlayer();
                                    }}
                                    className="w-full bg-white/10 text-white/70 font-medium px-8 py-3 rounded-xl hover:bg-white/20 transition-colors"
                                >
                                    Maybe Later
                                </button>
                            </div>
                            
                            <p className="text-white/50 text-xs mt-4">
                                14-day free trial • Cancel anytime
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MiniPlayer;
