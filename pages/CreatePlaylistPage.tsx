import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles, Palette, Loader2, Music, ListMusic } from 'lucide-react';
import { userPlaylistService, ArtStyle } from '../services/userPlaylistService';
import { authService } from '../services/authService';

const CreatePlaylistPage: React.FC = () => {
    const navigate = useNavigate();
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    
    // AI Cover state
    const [showAiCover, setShowAiCover] = useState(false);
    const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
    const [selectedStyle, setSelectedStyle] = useState('cartoon');
    const [coverPrompt, setCoverPrompt] = useState('');
    const [generatingCover, setGeneratingCover] = useState(false);
    
    useEffect(() => {
        const loadStyles = async () => {
            const styles = await userPlaylistService.getArtStyles();
            if (styles.length > 0) {
                setArtStyles(styles);
            }
        };
        loadStyles();
    }, []);
    
    const getUserId = () => {
        const user = authService.getUser();
        return user?.email || user?._id || null;
    };
    
    const handleGenerateCover = async () => {
        if (!coverPrompt.trim()) return;
        
        const userId = getUserId();
        if (!userId) return;
        
        setGeneratingCover(true);
        const result = await userPlaylistService.generateCover(
            coverPrompt,
            selectedStyle,
            name || 'My Playlist',
            userId
        );
        
        if (result) {
            setCoverImage(result.imageUrl);
        }
        setGeneratingCover(false);
    };
    
    const handleCreate = async () => {
        if (!name.trim()) {
            alert('Please enter a playlist name');
            return;
        }
        
        const userId = getUserId();
        if (!userId) {
            alert('Please sign in to create playlists');
            return;
        }
        
        setCreating(true);
        const playlist = await userPlaylistService.createPlaylist(
            userId,
            name.trim(),
            description.trim() || undefined,
            coverImage || undefined
        );
        
        if (playlist) {
            // If AI cover was generated, save the metadata
            if (coverImage && showAiCover && coverPrompt) {
                await userPlaylistService.updatePlaylist(playlist._id, {
                    aiGenerated: {
                        isAiGenerated: true,
                        prompt: coverPrompt,
                        style: selectedStyle,
                        generatedAt: new Date().toISOString(),
                    },
                });
            }
            
            navigate(`/my-playlist/${playlist._id}`);
        } else {
            alert('Failed to create playlist. Please try again.');
        }
        setCreating(false);
    };
    
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
                    <h1 className="text-white font-display font-bold text-lg">
                        Create Playlist
                    </h1>
                    <div className="w-10" />
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 px-4 py-6 space-y-6">
                {/* Cover Preview */}
                <div className="flex flex-col items-center">
                    <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl border-4 border-[#5D4037] mb-4">
                        {coverImage ? (
                            <img
                                src={coverImage}
                                alt="Playlist cover"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                                <ListMusic className="w-20 h-20 text-white/40" />
                            </div>
                        )}
                    </div>
                    
                    {/* AI Cover Button */}
                    <button
                        onClick={() => setShowAiCover(!showAiCover)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium text-sm hover:from-purple-500 hover:to-pink-500 transition-all"
                    >
                        <Sparkles className="w-4 h-4" />
                        {showAiCover ? 'Hide AI Cover' : '✨ Create AI Cover'}
                    </button>
                </div>
                
                {/* AI Cover Generator */}
                {showAiCover && (
                    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-4 border border-purple-500/30 space-y-4">
                        <p className="text-purple-200 text-sm font-medium">✨ Describe your playlist cover</p>
                        
                        <input
                            type="text"
                            value={coverPrompt}
                            onChange={(e) => setCoverPrompt(e.target.value)}
                            placeholder="e.g., happy animals playing music in a forest"
                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
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
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {generatingCover ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Generate Cover
                                </>
                            )}
                        </button>
                    </div>
                )}
                
                {/* Playlist Name */}
                <div>
                    <label className="text-white text-sm font-medium mb-2 block">
                        Playlist Name *
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Awesome Playlist"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                        maxLength={50}
                    />
                </div>
                
                {/* Description */}
                <div>
                    <label className="text-white text-sm font-medium mb-2 block">
                        Description (optional)
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's this playlist about?"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 resize-none"
                        rows={3}
                        maxLength={200}
                    />
                </div>
                
                {/* Create Button */}
                <button
                    onClick={handleCreate}
                    disabled={!name.trim() || creating}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                >
                    {creating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        'Create Playlist'
                    )}
                </button>
            </div>
        </div>
    );
};

export default CreatePlaylistPage;

