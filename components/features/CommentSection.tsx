import React, { useEffect, useState, useMemo } from 'react';
import { MessageCircle, Loader2, Send, Sparkles } from 'lucide-react';
import { commentService, CommentOption, BookComment } from '../../services/commentService';
import { authService } from '../../services/authService';
import { useAudio } from '../../context/AudioContext';

interface CommentSectionProps {
    bookId: string;
    bookTitle: string;
    bookDescription?: string;
}

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

const CommentSection: React.FC<CommentSectionProps> = ({ bookId, bookTitle, bookDescription }) => {
    const [commentOptions, setCommentOptions] = useState<CommentOption[]>([]);
    const [postedComments, setPostedComments] = useState<BookComment[]>([]);
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

    // Generate random positions and rotations for blocks
    const blockStyles = useMemo(() => {
        return commentOptions.map((_, index) => ({
            rotation: rotations[index % rotations.length],
            delay: index * 50,
        }));
    }, [commentOptions.length]);

    // Load comments and options on mount
    useEffect(() => {
        loadData();
    }, [bookId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch posted comments
            const comments = await commentService.getBookComments(bookId);
            setPostedComments(comments);

            // Try to get cached comment options first
            const cached = await commentService.getCachedCommentOptions(bookId);
            
            if (cached && cached.length > 0) {
                setCommentOptions(cached);
            } else {
                // Generate new options with AI
                setGenerating(true);
                const options = await commentService.generateCommentOptions(bookTitle, bookDescription);
                setCommentOptions(options);
                
                // Cache for future use
                if (options.length > 0) {
                    await commentService.cacheCommentOptions(bookId, options);
                }
                setGenerating(false);
            }
        } catch (error) {
            console.error('Error loading comment data:', error);
            setCommentOptions(commentService.getFallbackComments());
        } finally {
            setLoading(false);
        }
    };

    const handleSelectComment = async (option: CommentOption) => {
        if (posting) return;
        
        // Play click sound when selecting
        playClick();
        
        setPosting(option.text);
        
        const newComment = await commentService.postComment(
            bookId,
            userId,
            userName,
            option.text,
            option.emoji,
            option.color
        );
        
        if (newComment) {
            // Play success sound when posted
            playSfxSuccess();
            setPostedComments(prev => [newComment, ...prev]);
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
            {/* Header */}
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

            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg animate-bounce">
                    ✨ Comment posted!
                </div>
            )}

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

            {/* Posted Comments Section */}
            {postedComments.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[#d4b483]">
                    <div className="flex items-center gap-2 mb-4">
                        <Send className="w-4 h-4 text-[#8B4513]" />
                        <h4 className="text-[#5c2e0b] font-semibold text-sm">
                            What others are saying ({postedComments.length})
                        </h4>
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
                                            {comment.userName} • {formatTimeAgo(comment.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {postedComments.length === 0 && (
                <div className="text-center py-4 text-[#8B4513]/60 text-sm">
                    Be the first to leave a comment! 👆
                </div>
            )}
        </div>
    );
};

export default CommentSection;

