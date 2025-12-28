import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles, Palette, Loader2, Music, ListMusic, X, LogIn, UserPlus } from 'lucide-react';
import { userPlaylistService, ArtStyle } from '../services/userPlaylistService';
import { authService } from '../services/authService';

const CreatePlaylistPage: React.FC = () => {
    const navigate = useNavigate();
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
    
    // AI Cover state
    const [showAiCover, setShowAiCover] = useState(false);
    const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
    const [selectedStyle, setSelectedStyle] = useState('cartoon');
    const [coverPrompt, setCoverPrompt] = useState('');
    const [generatingCover, setGeneratingCover] = useState(false);
    
    // Check if user is logged in on mount
    useEffect(() => {
        const user = authService.getUser();
        const userId = user?.email || user?._id;
        if (!userId) {
            // Show sign up prompt immediately for anonymous users
            setShowSignUpPrompt(true);
        }
    }, []);
    
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
        console.log('🎨 Generate cover clicked', { coverPrompt, selectedStyle });
        
        if (!coverPrompt.trim()) {
            console.log('⚠️ No prompt provided');
            alert('Please enter a description for your cover');
            return;
        }
        
        const userId = getUserId();
        console.log('👤 User ID:', userId);
        
        if (!userId) {
            console.log('⚠️ No user ID found, showing sign up prompt');
            setShowSignUpPrompt(true);
            return;
        }
        
        setGeneratingCover(true);
        console.log('🎨 Calling generateCover...');
        
        try {
            const result = await userPlaylistService.generateCover(
                coverPrompt,
                selectedStyle,
                name || 'My Playlist',
                userId
            );
            
            console.log('🎨 Generation result:', result);
            
            if (result) {
                setCoverImage(result.imageUrl);
                console.log('✅ Cover image set:', result.imageUrl);
            } else {
                alert('Failed to generate cover. Please try again.');
            }
        } catch (error) {
            console.error('❌ Error generating cover:', error);
            alert('Error generating cover. Please try again.');
        } finally {
            setGeneratingCover(false);
        }
    };
    
    const handleCreate = async () => {
        if (!name.trim()) {
            alert('Please enter a playlist name');
            return;
        }
        
        const userId = getUserId();
        if (!userId) {
            setShowSignUpPrompt(true);
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
        <div className="h-full bg-gradient-to-b from-[#1a0f05] to-[#2d1809] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-b from-[#2d1809] to-transparent px-4 py-3 pt-8">
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
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">
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
            
            {/* Sign Up Prompt Modal */}
            {showSignUpPrompt && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-[90%] max-w-md bg-gradient-to-br from-[#3E1F07] to-[#5c2e0b] rounded-3xl p-6 shadow-2xl animate-in zoom-in-75 duration-500 border-2 border-[#8B4513]">
                        <button
                            onClick={() => {
                                setShowSignUpPrompt(false);
                                navigate('/library');
                            }}
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
                                onClick={() => navigate('/sign-in?redirect=/create-playlist')}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:from-amber-400 hover:to-orange-400 transition-all"
                            >
                                <UserPlus className="w-5 h-5" />
                                Sign Up Free
                            </button>
                            <button
                                onClick={() => navigate('/sign-in?redirect=/create-playlist')}
                                className="w-full py-3 rounded-xl bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                            >
                                <LogIn className="w-5 h-5" />
                                Already have an account? Sign In
                            </button>
                            <button
                                onClick={() => {
                                    setShowSignUpPrompt(false);
                                    navigate('/library');
                                }}
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

export default CreatePlaylistPage;

