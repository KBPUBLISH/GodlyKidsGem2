import { getApiBaseUrl } from './apiService';

export interface CommentOption {
    text: string;
    emoji: string;
    color: string;
}

export interface BookComment {
    _id: string;
    bookId: string;
    userId: string;
    userName: string;
    commentText: string;
    emoji: string;
    colorTheme: string;
    createdAt: string;
}

class CommentService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = getApiBaseUrl();
    }

    // Fetch all comments for a book
    async getBookComments(bookId: string): Promise<BookComment[]> {
        try {
            const response = await fetch(`${this.baseUrl}/book-comments/${bookId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch comments');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching book comments:', error);
            return [];
        }
    }

    // Post a new comment
    async postComment(
        bookId: string,
        userId: string,
        userName: string,
        commentText: string,
        emoji: string,
        colorTheme: string
    ): Promise<BookComment | null> {
        try {
            const response = await fetch(`${this.baseUrl}/book-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId,
                    userId,
                    userName,
                    commentText,
                    emoji,
                    colorTheme,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to post comment');
            }

            return await response.json();
        } catch (error) {
            console.error('Error posting comment:', error);
            return null;
        }
    }

    // Delete own comment
    async deleteComment(commentId: string, userId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/book-comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });

            return response.ok;
        } catch (error) {
            console.error('Error deleting comment:', error);
            return false;
        }
    }

    // Get cached AI-generated comment options for a book
    async getCachedCommentOptions(bookId: string): Promise<CommentOption[] | null> {
        try {
            const response = await fetch(`${this.baseUrl}/book-comments/${bookId}/generated`);
            if (!response.ok) {
                throw new Error('Failed to fetch cached comments');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching cached comment options:', error);
            return null;
        }
    }

    // Generate AI comment options for a book
    async generateCommentOptions(
        bookTitle: string,
        bookDescription?: string,
        bookContent?: string
    ): Promise<CommentOption[]> {
        try {
            const response = await fetch(`${this.baseUrl}/ai/generate-book-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookTitle,
                    bookDescription,
                    bookContent,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate comments');
            }

            const data = await response.json();
            return data.comments || this.getFallbackComments();
        } catch (error) {
            console.error('Error generating comment options:', error);
            return this.getFallbackComments();
        }
    }

    // Cache generated comments for a book
    async cacheCommentOptions(bookId: string, comments: CommentOption[]): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/book-comments/${bookId}/generated`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comments }),
            });

            return response.ok;
        } catch (error) {
            console.error('Error caching comment options:', error);
            return false;
        }
    }

    // Fallback comments when AI generation fails
    getFallbackComments(): CommentOption[] {
        return [
            { text: "I loved this story!", emoji: "❤️", color: "pink" },
            { text: "So much fun to read!", emoji: "🎉", color: "yellow" },
            { text: "This made me smile!", emoji: "😊", color: "orange" },
            { text: "Best book ever!", emoji: "⭐", color: "gold" },
            { text: "I want to read it again!", emoji: "🔄", color: "blue" },
            { text: "The pictures are amazing!", emoji: "🎨", color: "purple" },
            { text: "I learned something new!", emoji: "💡", color: "green" },
            { text: "So cool and exciting!", emoji: "😎", color: "teal" },
            { text: "I wish it was longer!", emoji: "📚", color: "indigo" },
            { text: "Some parts were tricky", emoji: "🤔", color: "amber" },
            { text: "Pretty good story!", emoji: "👍", color: "lime" },
            { text: "Made me want more!", emoji: "🌟", color: "cyan" },
        ];
    }
}

export const commentService = new CommentService();

