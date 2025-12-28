import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Check, Music, Loader2, Sparkles, Palette, LogIn, UserPlus } from 'lucide-react';
import { userPlaylistService, UserPlaylist, ArtStyle } from '../../services/userPlaylistService';
import { authService } from '../../services/authService';

interface AddToPlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Source item info
    sourcePlaylistId: string;
    itemId: string;
    itemTitle: string;
    itemCover?: string;
    itemType: 'Song' | 'Audiobook';
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
    isOpen,
    onClose,
    sourcePlaylistId,
    itemId,
    itemTitle,
    itemCover,
    itemType,
}) => {
    const navigate = useNavigate();
    const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState<string | null>(null);
    const [showCreateNew, setShowCreateNew] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [creating, setCreating] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [showSignInPrompt, setShowSignInPrompt] = useState(false);
    
    // AI Cover generation state
    const [showAiCover, setShowAiCover] = useState(false);
    const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
    const [selectedStyle, setSelectedStyle] = useState<string>('cartoon');
    const [coverPrompt, setCoverPrompt] = useState('');
    const [generatingCover, setGeneratingCover] = useState(false);
    const [generatedCover, setGeneratedCover] = useState<string | null>(null);
    
    const getUserId = () => {
        const user = authService.getUser();
        return user?.email || user?._id || null;
    };
    
    useEffect(() => {
        if (isOpen) {
            loadPlaylists();
            loadArtStyles();
        }
    }, [isOpen]);
    
    const loadPlaylists = async () => {
        setLoading(true);
        const userId = getUserId();
        if (userId) {
            const data = await userPlaylistService.getPlaylists(userId);
            setPlaylists(data);
        }
        setLoading(false);
    };
    
    const loadArtStyles = async () => {
        const styles = await userPlaylistService.getArtStyles();
        if (styles.length > 0) {
            setArtStyles(styles);
        }
    };
    
    const handleAddToPlaylist = async (playlistId: string) => {
        setAdding(playlistId);
        const result = await userPlaylistService.addItem(playlistId, sourcePlaylistId, itemId);
        if (result) {
            setSuccess(playlistId);
            // Update local state
            setPlaylists(prev => prev.map(p => 
                p._id === playlistId ? result : p
            ));
            setTimeout(() => {
                onClose();
            }, 1000);
        } else {
            alert('Failed to add to playlist. It may already be in this playlist.');
        }
        setAdding(null);
    };
    
    const handleCreatePlaylist = async () => {
        console.log('🎵 Create playlist clicked', { newPlaylistName, sourcePlaylistId, itemId });
        
        if (!newPlaylistName.trim()) {
            console.log('⚠️ No playlist name provided');
            alert('Please enter a playlist name');
            return;
        }
        
        const userId = getUserId();
        console.log('👤 User ID:', userId);
        
        if (!userId) {
            console.log('⚠️ No user ID - showing sign in prompt');
            setShowSignInPrompt(true);
            return;
        }
        
        setCreating(true);
        console.log('📝 Creating playlist...');
        
        try {
            const playlist = await userPlaylistService.createPlaylist(
                userId,
                newPlaylistName.trim(),
                undefined,
                generatedCover || itemCover // Use AI cover or item cover as default
            );
            
            console.log('📋 Playlist created:', playlist);
            
            if (playlist) {
                // If AI cover was generated, update the playlist with AI metadata
                if (generatedCover && showAiCover) {
                    await userPlaylistService.updatePlaylist(playlist._id, {
                        aiGenerated: {
                            isAiGenerated: true,
                            prompt: coverPrompt,
                            style: selectedStyle,
                            generatedAt: new Date().toISOString(),
                        },
                    });
                }
                
                // Auto-add the current item to the new playlist
                console.log('➕ Adding item to playlist...');
                const result = await userPlaylistService.addItem(playlist._id, sourcePlaylistId, itemId);
                console.log('✅ Item add result:', result);
                
                setSuccess(playlist._id);
                setTimeout(() => {
                    onClose();
                }, 1000);
            } else {
                console.log('❌ Failed to create playlist');
                alert('Failed to create playlist. Please try again.');
            }
        } catch (error) {
            console.error('❌ Error creating playlist:', error);
            alert('Error creating playlist. Please try again.');
        }
        
        setCreating(false);
    };
    
    const handleGenerateCover = async () => {
        if (!coverPrompt.trim()) return;
        
        const userId = getUserId();
        if (!userId) return;
        
        setGeneratingCover(true);
        const result = await userPlaylistService.generateCover(
            coverPrompt,
            selectedStyle,
            newPlaylistName || 'My Playlist',
            userId
        );
        
        if (result) {
            setGeneratedCover(result.imageUrl);
        }
        setGeneratingCover(false);
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-gradient-to-b from-[#2d1809] to-[#1a0f05] rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="sticky top-0 bg-[#3E1F07] px-4 py-3 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-3">
                        {itemCover ? (
                            <img src={itemCover} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center">
                                <Music className="w-5 h-5 text-white" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm truncate">{itemTitle}</p>
                            <p className="text-amber-200/60 text-xs">Add to playlist</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>
                
                {/* Content */}
                <div className="overflow-y-auto max-h-[60vh] p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                        </div>
                    ) : showCreateNew ? (
                        /* Create New Playlist Form */
                        <div className="space-y-4">
                            <button
                                onClick={() => {
                                    setShowCreateNew(false);
                                    setShowAiCover(false);
                                    setGeneratedCover(null);
                                }}
                                className="text-amber-300 text-sm hover:underline"
                            >
                                ← Back to playlists
                            </button>
                            
                            <div>
                                <label className="text-white text-sm font-medium mb-2 block">Playlist Name</label>
                                <input
                                    type="text"
                                    value={newPlaylistName}
                                    onChange={(e) => setNewPlaylistName(e.target.value)}
                                    placeholder="My Awesome Playlist"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                                    maxLength={50}
                                />
                            </div>
                            
                            {/* Cover Preview */}
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                                    {generatedCover ? (
                                        <img src={generatedCover} alt="Cover" className="w-full h-full object-cover" />
                                    ) : itemCover ? (
                                        <img src={itemCover} alt="Cover" className="w-full h-full object-cover opacity-50" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Music className="w-8 h-8 text-white/30" />
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowAiCover(!showAiCover)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    {showAiCover ? 'Hide AI Cover' : 'Create AI Cover'}
                                </button>
                            </div>
                            
                            {/* AI Cover Generator */}
                            {showAiCover && (
                                <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30">
                                    <p className="text-purple-200 text-xs font-medium">✨ Describe your playlist cover</p>
                                    
                                    <input
                                        type="text"
                                        value={coverPrompt}
                                        onChange={(e) => setCoverPrompt(e.target.value)}
                                        placeholder="e.g., happy animals playing music in a forest"
                                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-purple-400"
                                    />
                                    
                                    {/* Style Selector */}
                                    <div>
                                        <p className="text-purple-200 text-xs font-medium mb-2 flex items-center gap-1">
                                            <Palette className="w-3 h-3" /> Art Style
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {artStyles.map(style => (
                                                <button
                                                    key={style.id}
                                                    onClick={() => setSelectedStyle(style.id)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                        selectedStyle === style.id
                                                            ? 'bg-purple-500 text-white'
                                                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                                                    }`}
                                                >
                                                    {style.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={handleGenerateCover}
                                        disabled={!coverPrompt.trim() || generatingCover}
                                        className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {generatingCover ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                Generate Cover
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                            
                            {/* Create Button */}
                            <button
                                onClick={handleCreatePlaylist}
                                disabled={!newPlaylistName.trim() || creating}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        Create & Add {itemType}
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        /* Existing Playlists List */
                        <div className="space-y-3">
                            {/* Create New Button */}
                            <button
                                onClick={() => setShowCreateNew(true)}
                                className="w-full p-4 rounded-xl bg-gradient-to-r from-amber-600/30 to-orange-600/30 border-2 border-dashed border-amber-500/50 hover:border-amber-400 transition-all flex items-center gap-3"
                            >
                                <div className="w-12 h-12 rounded-xl bg-amber-500/30 flex items-center justify-center">
                                    <Plus className="w-6 h-6 text-amber-300" />
                                </div>
                                <div className="text-left">
                                    <p className="text-white font-bold">Create New Playlist</p>
                                    <p className="text-amber-200/60 text-xs">Start a new collection</p>
                                </div>
                            </button>
                            
                            {/* Existing Playlists */}
                            {playlists.length > 0 ? (
                                <>
                                    <p className="text-white/50 text-xs uppercase tracking-wider pt-2">Your Playlists</p>
                                    {playlists.map(playlist => {
                                        const alreadyIn = playlist.items.some(item => item.itemId === itemId);
                                        const isAdding = adding === playlist._id;
                                        const isSuccess = success === playlist._id;
                                        
                                        return (
                                            <button
                                                key={playlist._id}
                                                onClick={() => !alreadyIn && handleAddToPlaylist(playlist._id)}
                                                disabled={alreadyIn || isAdding}
                                                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                                                    alreadyIn
                                                        ? 'bg-green-900/30 border border-green-500/30'
                                                        : isSuccess
                                                            ? 'bg-green-600/50 border border-green-400'
                                                            : 'bg-white/5 hover:bg-white/10 border border-white/10'
                                                }`}
                                            >
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                                                    {playlist.coverImage ? (
                                                        <img src={playlist.coverImage} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Music className="w-5 h-5 text-white/30" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="text-white font-medium truncate">{playlist.name}</p>
                                                    <p className="text-white/50 text-xs">{playlist.items.length} items</p>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    {isSuccess ? (
                                                        <Check className="w-5 h-5 text-green-400" />
                                                    ) : alreadyIn ? (
                                                        <span className="text-green-400 text-xs">Added</span>
                                                    ) : isAdding ? (
                                                        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                                                    ) : (
                                                        <Plus className="w-5 h-5 text-white/50" />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            ) : (
                                <p className="text-center text-white/50 py-4">
                                    No playlists yet. Create your first one!
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Sign In Prompt Modal */}
            {showSignInPrompt && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-[90%] max-w-md bg-gradient-to-br from-[#3E1F07] to-[#5c2e0b] rounded-3xl p-6 shadow-2xl animate-in zoom-in-75 duration-500 border-2 border-[#8B4513]">
                        <button
                            onClick={() => setShowSignInPrompt(false)}
                            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                        
                        {/* Fun illustration */}
                        <div className="text-center mb-6">
                            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                                <Music className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white font-display drop-shadow-md">
                                🎵 Create Your Playlist!
                            </h2>
                            <p className="text-white/70 mt-2 text-sm">
                                Sign up to save your playlists and access them anywhere!
                            </p>
                        </div>
                        
                        {/* Benefits */}
                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
                                <span className="text-2xl">💾</span>
                                <p className="text-white text-sm">Save unlimited playlists</p>
                            </div>
                            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
                                <span className="text-2xl">🎨</span>
                                <p className="text-white text-sm">Create AI-generated covers</p>
                            </div>
                            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
                                <span className="text-2xl">📱</span>
                                <p className="text-white text-sm">Access on all your devices</p>
                            </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    onClose();
                                    navigate('/sign-in?redirect=/library');
                                }}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:from-amber-400 hover:to-orange-400 transition-all"
                            >
                                <UserPlus className="w-5 h-5" />
                                Sign Up Free
                            </button>
                            <button
                                onClick={() => {
                                    onClose();
                                    navigate('/sign-in?redirect=/library');
                                }}
                                className="w-full py-3 rounded-xl bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                            >
                                <LogIn className="w-5 h-5" />
                                Already have an account? Sign In
                            </button>
                            <button
                                onClick={() => setShowSignInPrompt(false)}
                                className="w-full py-2 text-white/50 hover:text-white/70 text-sm transition-colors"
                            >
                                Maybe later
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddToPlaylistModal;

