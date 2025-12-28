import React, { useEffect, useState, useMemo } from 'react';
import { MessageCircle, Loader2, Send, Sparkles } from 'lucide-react';
import { commentService, CommentOption, BookComment } from '../../services/commentService';
import { authService } from '../../services/authService';

interface CommentSectionProps {
    bookId: string;
    bookTitle: string;
    bookDescription?: string;
}

// Color mapping for block outlines and backgrounds
const colorStyles: Record<string, { border: string; bg: string; text: string }> = {
    pink: { border: 'border-pink-400', bg: 'bg-pink-500/20', text: 'text-pink-300' },
    yellow: { border: 'border-yellow-400', bg: 'bg-yellow-500/20', text: 'text-yellow-300' },
    orange: { border: 'border-orange-400', bg: 'bg-orange-500/20', text: 'text-orange-300' },
    gold: { border: 'border-amber-400', bg: 'bg-amber-500/20', text: 'text-amber-300' },
    blue: { border: 'border-blue-400', bg: 'bg-blue-500/20', text: 'text-blue-300' },
    purple: { border: 'border-purple-400', bg: 'bg-purple-500/20', text: 'text-purple-300' },
    green: { border: 'border-green-400', bg: 'bg-green-500/20', text: 'text-green-300' },
    teal: { border: 'border-teal-400', bg: 'bg-teal-500/20', text: 'text-teal-300' },
    indigo: { border: 'border-indigo-400', bg: 'bg-indigo-500/20', text: 'text-indigo-300' },
    amber: { border: 'border-amber-400', bg: 'bg-amber-500/20', text: 'text-amber-300' },
    lime: { border: 'border-lime-400', bg: 'bg-lime-500/20', text: 'text-lime-300' },
    rose: { border: 'border-rose-400', bg: 'bg-rose-500/20', text: 'text-rose-300' },
    cyan: { border: 'border-cyan-400', bg: 'bg-cyan-500/20', text: 'text-cyan-300' },
    emerald: { border: 'border-emerald-400', bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
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

    const userId = authService.getCurrentUserId() || 'anonymous';
    const userName = authService.getCurrentUserName() || 'Anonymous';

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
            <div className="bg-white/5 rounded-3xl p-6 mt-6">
                <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                    <span className="text-white/60">Loading comments...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-b from-white/5 to-white/10 rounded-3xl p-5 mt-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-bold text-lg">Leave a Comment!</h3>
                {generating && (
                    <div className="flex items-center gap-1 ml-2 text-purple-300 text-xs">
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
                <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <Send className="w-4 h-4 text-white/60" />
                        <h4 className="text-white/80 font-semibold text-sm">
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
                                        ${style.bg} border ${style.border}
                                        animate-in fade-in slide-in-from-left-2
                                    `}
                                >
                                    <span className="text-2xl flex-shrink-0">{comment.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium text-sm">
                                            {comment.commentText}
                                        </p>
                                        <p className="text-white/50 text-xs mt-1">
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
                <div className="text-center py-4 text-white/40 text-sm">
                    Be the first to leave a comment! 👆
                </div>
            )}
        </div>
    );
};

export default CommentSection;

