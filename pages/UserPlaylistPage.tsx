import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Pause, Play, SkipBack, SkipForward, Music, Trash2, ListMusic, Edit2, X, Loader2, Camera } from 'lucide-react';
import { userPlaylistService, UserPlaylist, PlaylistItem } from '../services/userPlaylistService';
import { useAudio, Playlist as AudioPlaylist, AudioItem } from '../context/AudioContext';

const UserPlaylistPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    // Use global audio context
    const {
        currentPlaylist,
        currentTrackIndex,
        isPlaying,
        currentTime,
        duration,
        playPlaylist,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seek,
    } = useAudio();
    
    // Check if this playlist is currently playing
    const isThisPlaylistPlaying = currentPlaylist?._id === id;
    const activeTrackIndex = isThisPlaylistPlaying ? currentTrackIndex : 0;
    
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
    
    // Convert UserPlaylist to AudioPlaylist format for the global context
    const convertToAudioPlaylist = (userPlaylist: UserPlaylist): AudioPlaylist => {
        return {
            _id: userPlaylist._id,
            title: userPlaylist.name,
            author: 'My Playlist',
            description: userPlaylist.description,
            coverImage: userPlaylist.coverImage,
            type: 'Song',
            items: userPlaylist.items.map((item, index): AudioItem => ({
                _id: item._id,
                title: item.title,
                author: item.author,
                coverImage: item.coverImage,
                audioUrl: item.audioUrl,
                duration: item.duration,
                order: index,
            })),
        };
    };
    
    const handlePlayTrack = (index: number) => {
        if (!playlist) return;
        const audioPlaylist = convertToAudioPlaylist(playlist);
        playPlaylist(audioPlaylist, index);
    };
    
    const handlePlayPause = () => {
        if (!playlist?.items.length) return;
        
        if (isThisPlaylistPlaying) {
            togglePlayPause();
        } else {
            // Start playing this playlist from the beginning
            const audioPlaylist = convertToAudioPlaylist(playlist);
            playPlaylist(audioPlaylist, 0);
        }
    };
    
    const handlePrevTrack = () => {
        if (isThisPlaylistPlaying) {
            prevTrack();
        }
    };
    
    const handleNextTrack = () => {
        if (isThisPlaylistPlaying) {
            nextTrack();
        }
    };
    
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseFloat(e.target.value);
        seek(newTime);
    };
    
    const handleRemoveItem = async (itemId: string) => {
        if (!playlist || !id) return;
        if (!confirm('Remove this item from the playlist?')) return;
        
        const updated = await userPlaylistService.removeItem(id, itemId);
        if (updated) {
            setPlaylist(updated);
        }
    };
    
    // Open edit modal
    const openEditModal = () => {
        if (!playlist) return;
        setEditName(playlist.name);
        setEditDescription(playlist.description || '');
        setShowEditModal(true);
    };
    
    // Save playlist changes
    const handleSaveEdit = async () => {
        if (!playlist || !id || !editName.trim()) return;
        
        setSaving(true);
        try {
            const updated = await userPlaylistService.updatePlaylist(id, {
                name: editName.trim(),
                description: editDescription.trim() || undefined,
            });
            if (updated) {
                setPlaylist(updated);
                setShowEditModal(false);
            }
        } catch (error) {
            console.error('Error updating playlist:', error);
            alert('Failed to update playlist');
        } finally {
            setSaving(false);
        }
    };
    
    // Delete the playlist
    const handleDeletePlaylist = async () => {
        if (!id) return;
        if (!confirm('Are you sure you want to delete this playlist? This cannot be undone.')) return;
        
        setDeleting(true);
        try {
            const success = await userPlaylistService.deletePlaylist(id);
            if (success) {
                navigate('/library');
            } else {
                alert('Failed to delete playlist');
            }
        } catch (error) {
            console.error('Error deleting playlist:', error);
            alert('Failed to delete playlist');
        } finally {
            setDeleting(false);
        }
    };
    
    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    const currentTrack = playlist?.items[activeTrackIndex];
    const coverImage = isThisPlaylistPlaying 
        ? (currentPlaylist?.items[currentTrackIndex]?.coverImage || currentPlaylist?.coverImage)
        : (currentTrack?.coverImage || playlist?.coverImage);
    
    // Display time from global context if this playlist is playing
    const displayCurrentTime = isThisPlaylistPlaying ? currentTime : 0;
    const displayDuration = isThisPlaylistPlaying ? duration : (currentTrack?.duration || 0);
    const displayIsPlaying = isThisPlaylistPlaying && isPlaying;
    
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
                    <button
                        onClick={openEditModal}
                        className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                    >
                        <Edit2 className="w-5 h-5 text-white" />
                    </button>
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
                        <h2 className="text-white font-bold text-xl mb-1">
                            {isThisPlaylistPlaying 
                                ? currentPlaylist?.items[currentTrackIndex]?.title 
                                : currentTrack.title}
                        </h2>
                        {(isThisPlaylistPlaying 
                            ? currentPlaylist?.items[currentTrackIndex]?.author 
                            : currentTrack.author) && (
                            <p className="text-white/60 text-sm">
                                {isThisPlaylistPlaying 
                                    ? currentPlaylist?.items[currentTrackIndex]?.author 
                                    : currentTrack.author}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="text-center mb-6">
                        <p className="text-white/60">No tracks in playlist</p>
                    </div>
                )}
                
                {/* Progress Bar */}
                {playlist.items.length > 0 && (
                    <div className="w-full max-w-md mb-6">
                        <input
                            type="range"
                            min={0}
                            max={displayDuration || 100}
                            value={displayCurrentTime}
                            onChange={handleSeek}
                            disabled={!isThisPlaylistPlaying}
                            className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full disabled:opacity-50"
                        />
                        <div className="flex justify-between text-white/50 text-xs mt-1">
                            <span>{formatTime(displayCurrentTime)}</span>
                            <span>{formatTime(displayDuration)}</span>
                        </div>
                    </div>
                )}
                
                {/* Controls */}
                <div className="flex items-center gap-6 mb-8">
                    <button
                        onClick={handlePrevTrack}
                        disabled={!isThisPlaylistPlaying || activeTrackIndex === 0}
                        className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
                    >
                        <SkipBack className="w-6 h-6 text-white" fill="white" />
                    </button>
                    
                    <button
                        onClick={handlePlayPause}
                        disabled={!playlist.items.length}
                        className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 flex items-center justify-center shadow-lg hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                        {displayIsPlaying ? (
                            <Pause className="w-8 h-8 text-[#2d1809]" fill="#2d1809" />
                        ) : (
                            <Play className="w-8 h-8 text-[#2d1809] ml-1" fill="#2d1809" />
                        )}
                    </button>
                    
                    <button
                        onClick={handleNextTrack}
                        disabled={!isThisPlaylistPlaying || activeTrackIndex >= playlist.items.length - 1}
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
                        {playlist.items.map((item, index) => {
                            const isCurrentTrack = isThisPlaylistPlaying && index === currentTrackIndex;
                            
                            return (
                                <div
                                    key={item._id}
                                    onClick={() => handlePlayTrack(index)}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                                        isCurrentTrack
                                            ? 'bg-amber-600/30 border border-amber-500/50'
                                            : 'bg-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 relative">
                                        {item.coverImage ? (
                                            <img src={item.coverImage} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Music className="w-5 h-5 text-white/30" />
                                            </div>
                                        )}
                                        {isCurrentTrack && isPlaying && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="flex gap-0.5">
                                                    <div className="w-1 h-4 bg-amber-400 animate-pulse" style={{ animationDelay: '0ms' }} />
                                                    <div className="w-1 h-4 bg-amber-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                                                    <div className="w-1 h-4 bg-amber-400 animate-pulse" style={{ animationDelay: '300ms' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${
                                            isCurrentTrack ? 'text-amber-300' : 'text-white'
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
                            );
                        })}
                        
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
            
            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md mx-4 bg-gradient-to-b from-[#2d1809] to-[#1a0f05] rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h2 className="text-white font-bold text-lg">Edit Playlist</h2>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="p-4 space-y-4">
                            {/* Name Input */}
                            <div>
                                <label className="block text-white/70 text-sm font-medium mb-2">
                                    Playlist Name
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Enter playlist name"
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                                    maxLength={50}
                                />
                            </div>
                            
                            {/* Description Input */}
                            <div>
                                <label className="block text-white/70 text-sm font-medium mb-2">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Add a description..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 resize-none"
                                    maxLength={200}
                                />
                            </div>
                            
                            {/* Current Cover Preview */}
                            {playlist?.coverImage && (
                                <div>
                                    <label className="block text-white/70 text-sm font-medium mb-2">
                                        Current Cover
                                    </label>
                                    <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-white/20">
                                        <img 
                                            src={playlist.coverImage} 
                                            alt="Cover" 
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <p className="text-white/40 text-xs mt-2">
                                        To change cover, create a new playlist or regenerate via AI
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        {/* Modal Actions */}
                        <div className="p-4 space-y-3 border-t border-white/10">
                            {/* Save Button */}
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving || !editName.trim()}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                            
                            {/* Delete Button */}
                            <button
                                onClick={handleDeletePlaylist}
                                disabled={deleting}
                                className="w-full py-3 bg-red-500/20 border border-red-500/50 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-5 h-5" />
                                        Delete Playlist
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserPlaylistPage;
