import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Pause, X, Music } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

const MiniPlayer: React.FC = () => {
    const {
        currentPlaylist,
        currentTrackIndex,
        isPlaying,
        togglePlayPause,
        closePlayer
    } = useAudio();

    const navigate = useNavigate();
    const location = useLocation();

    // Don't show mini player if:
    // 1. No playlist is active
    // 2. We are already on the full player page
    // 3. We are in a book reader (distraction free)
    if (!currentPlaylist ||
        location.pathname.includes('/audio/playlist/') ||
        location.pathname.includes('/read/') ||
        location.pathname.includes('/book-reader')) {
        return null;
    }

    const currentTrack = currentPlaylist.items[currentTrackIndex];
    if (!currentTrack) return null;

    const handleOpenFullPlayer = () => {
        navigate(`/audio/playlist/${currentPlaylist._id}/play/${currentTrackIndex}`);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[60] animate-slide-up">
            <div
                className="bg-[#8B4513] rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.4)] border-t-2 border-[#d4a373] overflow-hidden flex items-center p-3 pb-4 relative"
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

                {/* Cover Art */}
                <div
                    onClick={handleOpenFullPlayer}
                    className="w-12 h-12 rounded-lg border-2 border-[#d4a373] overflow-hidden shrink-0 relative z-10 cursor-pointer"
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
                    className="flex-1 min-w-0 mx-3 relative z-10 cursor-pointer"
                >
                    <h4 className="text-white font-bold text-sm truncate leading-tight">
                        {currentTrack.title}
                    </h4>
                    <p className="text-[#e2cba5] text-xs truncate">
                        {currentTrack.author || currentPlaylist.author}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3 relative z-10 pr-1">
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

                    <button
                        onClick={(e) => { e.stopPropagation(); closePlayer(); }}
                        className="text-[#e2cba5] hover:text-white p-1"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MiniPlayer;
