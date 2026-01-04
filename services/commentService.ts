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

export interface PlaylistComment {
    _id: string;
    playlistId: string;
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
            const response = await fetch(`${this.baseUrl}book-comments/${bookId}`);
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
            const response = await fetch(`${this.baseUrl}book-comments`, {
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
            const response = await fetch(`${this.baseUrl}book-comments/${commentId}`, {
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
            const response = await fetch(`${this.baseUrl}book-comments/${bookId}/generated`);
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
            const response = await fetch(`${this.baseUrl}ai/generate-book-comments`, {
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
            const response = await fetch(`${this.baseUrl}book-comments/${bookId}/generated`, {
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
            { text: "Super funny!", emoji: "😂", color: "yellow" },
            { text: "This made me laugh!", emoji: "🤣", color: "orange" },
            { text: "My Favorite!", emoji: "💖", color: "rose" },
            { text: "10/10 Recommend!", emoji: "🏆", color: "gold" },
            { text: "9/10 Recommend!", emoji: "🥇", color: "amber" },
            { text: "8/10 Recommend!", emoji: "🥈", color: "slate" },
        ];
    }

    // ===============================
    // PLAYLIST COMMENT METHODS
    // ===============================

    // Fetch all comments for a playlist
    async getPlaylistComments(playlistId: string): Promise<PlaylistComment[]> {
        try {
            const response = await fetch(`${this.baseUrl}playlist-comments/${playlistId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch playlist comments');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching playlist comments:', error);
            return [];
        }
    }

    // Post a new playlist comment
    async postPlaylistComment(
        playlistId: string,
        userId: string,
        userName: string,
        commentText: string,
        emoji: string,
        colorTheme: string
    ): Promise<PlaylistComment | null> {
        try {
            const response = await fetch(`${this.baseUrl}playlist-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playlistId,
                    userId,
                    userName,
                    commentText,
                    emoji,
                    colorTheme,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to post playlist comment');
            }

            return await response.json();
        } catch (error) {
            console.error('Error posting playlist comment:', error);
            return null;
        }
    }

    // Delete own playlist comment
    async deletePlaylistComment(commentId: string, userId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}playlist-comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });

            return response.ok;
        } catch (error) {
            console.error('Error deleting playlist comment:', error);
            return false;
        }
    }

    // Generate AI comment options for a playlist
    async generatePlaylistCommentOptions(
        playlistName: string,
        playlistDescription?: string,
        songTitles?: string[],
        playlistType?: 'Song' | 'Audiobook'
    ): Promise<CommentOption[]> {
        try {
            const response = await fetch(`${this.baseUrl}ai/generate-playlist-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playlistName,
                    playlistDescription,
                    songTitles,
                    playlistType: playlistType || 'Song', // Default to Song if not specified
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate playlist comments');
            }

            const data = await response.json();
            const isAudiobook = playlistType === 'Audiobook';
            return data.comments || (isAudiobook ? this.getFallbackAudiobookComments() : this.getFallbackPlaylistComments());
        } catch (error) {
            console.error('Error generating playlist comment options:', error);
            const isAudiobook = playlistType === 'Audiobook';
            return isAudiobook ? this.getFallbackAudiobookComments() : this.getFallbackPlaylistComments();
        }
    }

    // Fallback comments for MUSIC playlists when AI generation fails
    getFallbackPlaylistComments(): CommentOption[] {
        return [
            { text: "I love these songs!", emoji: "🎵", color: "pink" },
            { text: "Makes me want to dance!", emoji: "💃", color: "yellow" },
            { text: "So fun to listen to!", emoji: "🎧", color: "orange" },
            { text: "Best playlist ever!", emoji: "⭐", color: "gold" },
            { text: "I listen to it daily!", emoji: "🔄", color: "blue" },
            { text: "The music is amazing!", emoji: "🎶", color: "purple" },
            { text: "Makes me feel happy!", emoji: "😊", color: "green" },
            { text: "Perfect for singing along!", emoji: "🎤", color: "teal" },
            { text: "I want more songs!", emoji: "📀", color: "indigo" },
            { text: "Some songs are tricky", emoji: "🤔", color: "amber" },
            { text: "Pretty good music!", emoji: "👍", color: "lime" },
            { text: "Can't stop listening!", emoji: "🎸", color: "cyan" },
            { text: "Super funny!", emoji: "😂", color: "yellow" },
            { text: "This made me laugh!", emoji: "🤣", color: "orange" },
            { text: "My Favorite!", emoji: "💖", color: "rose" },
            { text: "10/10 Recommend!", emoji: "🏆", color: "gold" },
            { text: "9/10 Recommend!", emoji: "🥇", color: "amber" },
            { text: "8/10 Recommend!", emoji: "🥈", color: "slate" },
        ];
    }

    // Fallback comments for AUDIOBOOK/SERMON playlists when AI generation fails
    getFallbackAudiobookComments(): CommentOption[] {
        return [
            { text: "I love this story!", emoji: "📚", color: "pink" },
            { text: "Such a great lesson!", emoji: "💡", color: "yellow" },
            { text: "I learned something new!", emoji: "✨", color: "orange" },
            { text: "Best stories ever!", emoji: "⭐", color: "gold" },
            { text: "I listen every night!", emoji: "🌙", color: "blue" },
            { text: "The characters are fun!", emoji: "😊", color: "purple" },
            { text: "Makes me think!", emoji: "🤔", color: "green" },
            { text: "I want more episodes!", emoji: "📖", color: "teal" },
            { text: "So inspiring!", emoji: "🙏", color: "indigo" },
            { text: "Some parts are long", emoji: "⏰", color: "amber" },
            { text: "Really good stories!", emoji: "👍", color: "lime" },
            { text: "Love listening to this!", emoji: "❤️", color: "cyan" },
            { text: "Super funny!", emoji: "😂", color: "yellow" },
            { text: "This made me laugh!", emoji: "🤣", color: "orange" },
            { text: "My Favorite!", emoji: "💖", color: "rose" },
            { text: "10/10 Recommend!", emoji: "🏆", color: "gold" },
            { text: "9/10 Recommend!", emoji: "🥇", color: "amber" },
            { text: "8/10 Recommend!", emoji: "🥈", color: "slate" },
        ];
    }
}

export const commentService = new CommentService();

