import React, { useEffect, useState, useMemo } from 'react';
import { MessageCircle, Loader2, Send, Sparkles } from 'lucide-react';
import { commentService, CommentOption, BookComment, PlaylistComment } from '../../services/commentService';
import { authService } from '../../services/authService';
import { useAudio } from '../../context/AudioContext';

type ContentType = 'book' | 'playlist';

interface CommentSectionProps {
    // Content identification
    contentId: string;
    contentType: ContentType;
    
    // Content details for AI generation
    title: string;
    description?: string;
    
    // Playlist-specific props
    songTitles?: string[];
    
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

    const [commentOptions, setCommentOptions] = useState<CommentOption[]>([]);
    const [postedComments, setPostedComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [posting, setPosting] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    
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
        return commentOptions.map((_, index) => ({
            rotation: rotations[index % rotations.length],
            delay: index * 50,
        }));
    }, [commentOptions.length]);

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
                const options = await commentService.generatePlaylistCommentOptions(title, description, songTitles);
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
            <div className="bg-gradient-to-b from-[#f5e6c8] to-[#ecd9b5] rounded-3xl p-6 mt-6 border-2 border-[#d4b483]">
                <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className="w-6 h-6 text-[#8B4513] animate-spin" />
                    <span className="text-[#5c2e0b]">Loading comments...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-b from-[#f5e6c8] to-[#ecd9b5] rounded-3xl p-5 mt-6 overflow-hidden border-2 border-[#d4b483] shadow-lg">
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
                        <Send className="w-4 h-4 text-[#8B4513]" />
                        <h3 className="text-[#3E1F07] font-bold text-lg font-display">
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
                                        <p className="text-[#8B4513]/60 text-xs mt-1">
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
                    <MessageCircle className="w-5 h-5 text-[#8B4513]" />
                    <h3 className="text-[#3E1F07] font-bold text-lg font-display">Leave a Comment!</h3>
                    {generating && (
                        <div className="flex items-center gap-1 ml-2 text-purple-600 text-xs">
                            <Sparkles className="w-3 h-3 animate-pulse" />
                            <span>AI generating...</span>
                        </div>
                    )}
                </div>

                {/* Comment Blocks - Scattered Layout */}
                <div className="relative flex flex-wrap gap-3 justify-center py-4">
                    {commentOptions.map((option, index) => {
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

                {/* Empty State - Only show if no comments exist yet */}
                {postedComments.length === 0 && (
                    <div className="text-center py-2 text-[#8B4513]/60 text-sm">
                        Be the first to leave a comment! 👆
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommentSection;

