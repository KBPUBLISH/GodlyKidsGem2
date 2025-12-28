import React, { useEffect, useState, useMemo } from 'react';
import { MessageCircle, Loader2, Send, Sparkles } from 'lucide-react';
import { commentService, CommentOption, BookComment, PlaylistComment } from '../../services/commentService';
import { authService } from '../../services/authService';
import { useAudio } from '../../context/AudioContext';

type ContentType = 'book' | 'playlist' | 'book-series';

interface CommentSectionProps {
    // Content identification
    contentId: string;
    contentType: ContentType;
    
    // Content details for AI generation
    title: string;
    description?: string;
    
    // Playlist-specific props
    songTitles?: string[];
    playlistType?: 'Song' | 'Audiobook'; // Differentiates music vs audiobook/sermon content
    
    // Visual variant
    variant?: 'default' | 'underwater'; // 'underwater' for glass-like appearance
    
    // Deprecated props (kept for backwards compatibility)
    bookId?: string;
    bookTitle?: string;
    bookDescription?: string;
}

// Type guard for comment types
type Comment = BookComment | PlaylistComment;

// Color mapping for block outlines and backgrounds (light theme friendly)
const colorStyles: Record<string, { border: string; bg: string; text: string }> = {
    pink: { border: 'border-pink-500', bg: 'bg-pink-100', text: 'text-pink-700' },
    yellow: { border: 'border-yellow-500', bg: 'bg-yellow-100', text: 'text-yellow-700' },
    orange: { border: 'border-orange-500', bg: 'bg-orange-100', text: 'text-orange-700' },
    gold: { border: 'border-amber-500', bg: 'bg-amber-100', text: 'text-amber-700' },
    blue: { border: 'border-blue-500', bg: 'bg-blue-100', text: 'text-blue-700' },
    purple: { border: 'border-purple-500', bg: 'bg-purple-100', text: 'text-purple-700' },
    green: { border: 'border-green-500', bg: 'bg-green-100', text: 'text-green-700' },
    teal: { border: 'border-teal-500', bg: 'bg-teal-100', text: 'text-teal-700' },
    indigo: { border: 'border-indigo-500', bg: 'bg-indigo-100', text: 'text-indigo-700' },
    amber: { border: 'border-amber-500', bg: 'bg-amber-100', text: 'text-amber-700' },
    lime: { border: 'border-lime-500', bg: 'bg-lime-100', text: 'text-lime-700' },
    rose: { border: 'border-rose-500', bg: 'bg-rose-100', text: 'text-rose-700' },
    cyan: { border: 'border-cyan-500', bg: 'bg-cyan-100', text: 'text-cyan-700' },
    emerald: { border: 'border-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

// Random rotation values for scattered effect
const rotations = [-6, -4, -2, 0, 2, 4, 6];

// Faith-based bonus comment options (always available)
const FAITH_COMMENTS: CommentOption[] = [
    { text: "I love Jesus!", emoji: "❤️", color: "pink" },
    { text: "The Bible is awesome!", emoji: "📖", color: "purple" },
    { text: "God is so good!", emoji: "✨", color: "gold" },
    { text: "Jesus loves me!", emoji: "💕", color: "rose" },
    { text: "Thank you God!", emoji: "🙏", color: "blue" },
    { text: "Faith is amazing!", emoji: "⭐", color: "amber" },
    { text: "God bless everyone!", emoji: "🌟", color: "yellow" },
    { text: "I trust in God!", emoji: "💪", color: "green" },
    { text: "Heaven is real!", emoji: "☁️", color: "cyan" },
    { text: "Praise the Lord!", emoji: "🎉", color: "orange" },
    { text: "Jesus is my friend!", emoji: "🤗", color: "teal" },
    { text: "God's love is forever!", emoji: "💖", color: "indigo" },
];

// Fun kid-friendly display names (randomly assigned based on comment ID)
const funAdjectives = [
    'Little', 'Happy', 'Brave', 'Sunny', 'Bright', 'Joyful', 'Kind', 'Sweet',
    'Gentle', 'Wise', 'Faithful', 'Blessed', 'Cheerful', 'Hopeful', 'Loving'
];
const funNouns = [
    'Rabbit', 'Helper', 'Star', 'Angel', 'Lamb', 'Dove', 'Light', 'Heart',
    'Blessing', 'Dreamer', 'Reader', 'Friend', 'Explorer', 'Believer', 'Wonder'
];

// Generate a consistent fun name based on a seed string (e.g., comment ID)
const getFunDisplayName = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    const adjIndex = Math.abs(hash) % funAdjectives.length;
    const nounIndex = Math.abs(hash >> 8) % funNouns.length;
    return `${funAdjectives[adjIndex]}${funNouns[nounIndex]}`;
};

const CommentSection: React.FC<CommentSectionProps> = (props) => {
    // Support both new and old prop patterns for backwards compatibility
    const contentId = props.contentId || props.bookId || '';
    const contentType = props.contentType || 'book';
    const title = props.title || props.bookTitle || '';
    const description = props.description || props.bookDescription;
    const songTitles = props.songTitles;
    const playlistType = props.playlistType;
    const variant = props.variant || 'default';
    
    // Theme-based styling
    const isUnderwater = variant === 'underwater';
    const containerClass = isUnderwater 
        ? 'bg-white/10 backdrop-blur-md rounded-3xl p-5 mt-6 overflow-hidden border-2 border-white/20 shadow-lg'
        : 'bg-gradient-to-b from-[#f5e6c8] to-[#ecd9b5] rounded-3xl p-5 mt-6 overflow-hidden border-2 border-[#d4b483] shadow-lg';
    const loadingContainerClass = isUnderwater
        ? 'bg-white/10 backdrop-blur-md rounded-3xl p-6 mt-6 border-2 border-white/20'
        : 'bg-gradient-to-b from-[#f5e6c8] to-[#ecd9b5] rounded-3xl p-6 mt-6 border-2 border-[#d4b483]';
    const textPrimaryClass = isUnderwater ? 'text-white' : 'text-[#3E1F07]';
    const textSecondaryClass = isUnderwater ? 'text-white/80' : 'text-[#5c2e0b]';
    const textMutedClass = isUnderwater ? 'text-white/60' : 'text-[#8B4513]/70';

    const [commentOptions, setCommentOptions] = useState<CommentOption[]>([]);
    const [postedComments, setPostedComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [posting, setPosting] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showMoreComments, setShowMoreComments] = useState(false);
    
    // Combine AI-generated comments with faith-based bonus comments
    const allCommentOptions = useMemo(() => {
        // Combine and deduplicate (in case AI generates similar ones)
        const combined = [...commentOptions];
        FAITH_COMMENTS.forEach(fc => {
            if (!combined.some(c => c.text.toLowerCase() === fc.text.toLowerCase())) {
                combined.push(fc);
            }
        });
        return combined;
    }, [commentOptions]);
    
    // Show first 6 comments initially, all when expanded
    const INITIAL_COMMENT_COUNT = 6;
    const visibleCommentOptions = showMoreComments 
        ? allCommentOptions 
        : allCommentOptions.slice(0, INITIAL_COMMENT_COUNT);
    const hasMoreComments = allCommentOptions.length > INITIAL_COMMENT_COUNT;
    
    // Audio for sound effects
    const { playClick, playSuccess: playSfxSuccess } = useAudio();

    // Get user info from authService
    const user = authService.getUser();
    const userId = user?.email || user?.id || user?._id || 'anonymous';
    const userName = user?.name || user?.firstName || user?.username || 'Anonymous';

    // Config based on content type
    const isPlaylist = contentType === 'playlist';
    const headerText = isPlaylist ? 'Leave a Comment!' : 'Leave a Comment!';
    const othersText = isPlaylist ? 'What listeners are saying' : 'What others are saying';

    // Generate random positions and rotations for blocks
    const blockStyles = useMemo(() => {
        return allCommentOptions.map((_, index) => ({
            rotation: rotations[index % rotations.length],
            delay: index * 50,
        }));
    }, [allCommentOptions.length]);

    // Load comments and options on mount
    useEffect(() => {
        if (contentId) {
            loadData();
        }
    }, [contentId, contentType]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch posted comments based on content type
            let comments: Comment[];
            if (isPlaylist) {
                comments = await commentService.getPlaylistComments(contentId);
            } else {
                comments = await commentService.getBookComments(contentId);
            }
            setPostedComments(comments);

            // For books, try to get cached comment options first
            // For playlists, we always generate fresh options (no caching currently)
            if (!isPlaylist) {
                const cached = await commentService.getCachedCommentOptions(contentId);
                
                if (cached && cached.length > 0) {
                    setCommentOptions(cached);
                } else {
                    // Generate new options with AI
                    setGenerating(true);
                    const options = await commentService.generateCommentOptions(title, description);
                    setCommentOptions(options);
                    
                    // Cache for future use
                    if (options.length > 0) {
                        await commentService.cacheCommentOptions(contentId, options);
                    }
                    setGenerating(false);
                }
            } else {
                // Generate playlist comment options
                setGenerating(true);
                const options = await commentService.generatePlaylistCommentOptions(title, description, songTitles, playlistType);
                setCommentOptions(options);
                setGenerating(false);
            }
        } catch (error) {
            console.error('Error loading comment data:', error);
            setCommentOptions(isPlaylist ? commentService.getFallbackPlaylistComments() : commentService.getFallbackComments());
        } finally {
            setLoading(false);
        }
    };

    const handleSelectComment = async (option: CommentOption) => {
        if (posting) return;
        
        // Play click sound when selecting
        playClick();
        
        setPosting(option.text);
        
        // Post comment based on content type
        let newComment: Comment | null;
        if (isPlaylist) {
            newComment = await commentService.postPlaylistComment(
                contentId,
                userId,
                userName,
                option.text,
                option.emoji,
                option.color
            );
        } else {
            newComment = await commentService.postComment(
                contentId,
                userId,
                userName,
                option.text,
                option.emoji,
                option.color
            );
        }
        
        if (newComment) {
            // Play success sound when posted
            playSfxSuccess();
            setPostedComments(prev => [newComment!, ...prev]);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        }
        
        setPosting(null);
    };

    const getColorStyle = (color: string) => {
        return colorStyles[color] || colorStyles.blue;
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className={loadingContainerClass}>
                <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className={`w-6 h-6 animate-spin ${isUnderwater ? 'text-white' : 'text-[#8B4513]'}`} />
                    <span className={textSecondaryClass}>Loading comments...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={containerClass}>
            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg animate-bounce">
                    ✨ Comment posted!
                </div>
            )}

            {/* Posted Comments Section - FIRST */}
            {postedComments.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Send className={`w-4 h-4 ${isUnderwater ? 'text-white/80' : 'text-[#8B4513]'}`} />
                        <h3 className={`font-bold text-lg font-display ${textPrimaryClass}`}>
                            {othersText} ({postedComments.length})
                        </h3>
                    </div>
                    
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {postedComments.slice(0, 20).map((comment) => {
                            const style = getColorStyle(comment.colorTheme);
                            
                            return (
                                <div
                                    key={comment._id}
                                    className={`
                                        flex items-start gap-3 p-3 rounded-xl
                                        ${style.bg} border-2 ${style.border}
                                        animate-in fade-in slide-in-from-left-2
                                    `}
                                >
                                    <span className="text-2xl flex-shrink-0">{comment.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium text-sm ${style.text}`}>
                                            {comment.commentText}
                                        </p>
                                        <p className={`text-xs mt-1 ${isUnderwater ? 'text-white/50' : 'text-[#8B4513]/60'}`}>
                                            {getFunDisplayName(comment._id)} • {formatTimeAgo(comment.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Leave a Comment Header - SECOND */}
            <div className={`${postedComments.length > 0 ? 'pt-6 border-t border-[#d4b483]' : ''}`}>
                <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className={`w-5 h-5 ${isUnderwater ? 'text-white/80' : 'text-[#8B4513]'}`} />
                    <h3 className={`font-bold text-lg font-display ${textPrimaryClass}`}>Leave a Comment!</h3>
                    {generating && (
                        <div className="flex items-center gap-1 ml-2 text-purple-600 text-xs">
                            <Sparkles className="w-3 h-3 animate-pulse" />
                            <span>AI generating...</span>
                        </div>
                    )}
                </div>

                {/* Comment Blocks - Scattered Layout */}
                <div className="relative flex flex-wrap gap-3 justify-center py-4">
                    {visibleCommentOptions.map((option, index) => {
                        const style = getColorStyle(option.color);
                        const blockStyle = blockStyles[index];
                        const isPosting = posting === option.text;
                        
                        return (
                            <button
                                key={`${option.text}-${index}`}
                                onClick={() => handleSelectComment(option)}
                                disabled={!!posting}
                                className={`
                                    relative px-4 py-3 rounded-2xl border-2 
                                    ${style.border} ${style.bg}
                                    transform transition-all duration-300
                                    hover:scale-110 hover:shadow-lg hover:shadow-${option.color}-500/30
                                    active:scale-95
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    animate-in fade-in slide-in-from-bottom-2
                                `}
                                style={{
                                    transform: `rotate(${blockStyle.rotation}deg)`,
                                    animationDelay: `${blockStyle.delay}ms`,
                                }}
                            >
                                {isPosting ? (
                                    <Loader2 className="w-5 h-5 text-white animate-spin mx-auto" />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{option.emoji}</span>
                                        <span className={`text-sm font-medium ${style.text}`}>
                                            {option.text}
                                        </span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                
                {/* Show More / Show Less Button */}
                {hasMoreComments && (
                    <div className="flex justify-center pt-2 pb-4">
                        <button
                            onClick={() => setShowMoreComments(!showMoreComments)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-full 
                                font-bold text-sm transition-all duration-300
                                hover:scale-105 active:scale-95
                                ${isUnderwater 
                                    ? 'bg-white/20 text-white border-2 border-white/30 hover:bg-white/30' 
                                    : 'bg-[#8B4513]/10 text-[#8B4513] border-2 border-[#8B4513]/30 hover:bg-[#8B4513]/20'
                                }
                            `}
                        >
                            {showMoreComments ? (
                                <>
                                    <span>Show Less</span>
                                    <span className="text-lg">👆</span>
                                </>
                            ) : (
                                <>
                                    <span>Show More</span>
                                    <span className="text-lg">✨</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                        isUnderwater ? 'bg-white/20' : 'bg-[#8B4513]/20'
                                    }`}>
                                        +{allCommentOptions.length - INITIAL_COMMENT_COUNT}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Empty State - Only show if no comments exist yet */}
                {postedComments.length === 0 && (
                    <div className={`text-center py-2 text-sm ${isUnderwater ? 'text-white/60' : 'text-[#8B4513]/60'}`}>
                        Be the first to leave a comment! 👆
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommentSection;

