// User Playlist Service - Manages custom playlists for songs and audiobook episodes

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';

export interface PlaylistItem {
    _id: string;
    playlistId: string;
    itemId: string;
    title: string;
    author?: string;
    coverImage?: string;
    audioUrl: string;
    duration?: number;
    type: 'Song' | 'Audiobook';
    order: number;
    addedAt: string;
}

export interface UserPlaylist {
    _id: string;
    userId: string;
    name: string;
    description?: string;
    coverImage?: string;
    aiGenerated?: {
        isAiGenerated: boolean;
        prompt?: string;
        style?: string;
        generatedAt?: string;
    };
    items: PlaylistItem[];
    playCount: number;
    lastPlayedAt?: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ArtStyle {
    id: string;
    name: string;
    description: string;
    prompt: string;
}

class UserPlaylistService {
    private baseUrl = API_BASE_URL.replace(/\/api\/?$/, '') + '/api';
    
    // Get all playlists for a user
    async getPlaylists(userId: string): Promise<UserPlaylist[]> {
        try {
            const response = await fetch(`${this.baseUrl}/user-playlists?userId=${encodeURIComponent(userId)}`);
            if (response.ok) {
                return await response.json();
            }
            console.error('Failed to fetch playlists:', response.status);
            return [];
        } catch (error) {
            console.error('Error fetching playlists:', error);
            return [];
        }
    }
    
    // Get a specific playlist
    async getPlaylist(playlistId: string): Promise<UserPlaylist | null> {
        try {
            const response = await fetch(`${this.baseUrl}/user-playlists/${playlistId}`);
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Error fetching playlist:', error);
            return null;
        }
    }
    
    // Create a new playlist
    async createPlaylist(userId: string, name: string, description?: string, coverImage?: string): Promise<UserPlaylist | null> {
        try {
            const response = await fetch(`${this.baseUrl}/user-playlists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, name, description, coverImage }),
            });
            if (response.ok) {
                const playlist = await response.json();
                console.log('📋 Created playlist:', playlist.name);
                return playlist;
            }
            const error = await response.json();
            console.error('Failed to create playlist:', error.message);
            return null;
        } catch (error) {
            console.error('Error creating playlist:', error);
            return null;
        }
    }
    
    // Update playlist details
    async updatePlaylist(playlistId: string, updates: Partial<Pick<UserPlaylist, 'name' | 'description' | 'coverImage' | 'aiGenerated'>>): Promise<UserPlaylist | null> {
        try {
            const response = await fetch(`${this.baseUrl}/user-playlists/${playlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Error updating playlist:', error);
            return null;
        }
    }
    
    // Delete a playlist
    async deletePlaylist(playlistId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/user-playlists/${playlistId}`, {
                method: 'DELETE',
            });
            return response.ok;
        } catch (error) {
            console.error('Error deleting playlist:', error);
            return false;
        }
    }
    
    // Add item to playlist
    async addItem(userPlaylistId: string, sourcePlaylistId: string, itemId: string): Promise<UserPlaylist | null> {
        try {
            const response = await fetch(`${this.baseUrl}/user-playlists/${userPlaylistId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlistId: sourcePlaylistId, itemId }),
            });
            if (response.ok) {
                const playlist = await response.json();
                console.log('➕ Added item to playlist');
                return playlist;
            }
            const error = await response.json();
            console.error('Failed to add item:', error.message);
            return null;
        } catch (error) {
            console.error('Error adding item to playlist:', error);
            return null;
        }
    }
    
    // Remove item from playlist
    async removeItem(userPlaylistId: string, itemId: string): Promise<UserPlaylist | null> {
        try {
            const response = await fetch(`${this.baseUrl}/user-playlists/${userPlaylistId}/items/${itemId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Error removing item from playlist:', error);
            return null;
        }
    }
    
    // Reorder items in playlist
    async reorderItems(userPlaylistId: string, itemIds: string[]): Promise<UserPlaylist | null> {
        try {
            const response = await fetch(`${this.baseUrl}/user-playlists/${userPlaylistId}/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIds }),
            });
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Error reordering items:', error);
            return null;
        }
    }
    
    // Get available art styles for cover generation (hardcoded for now)
    async getArtStyles(): Promise<ArtStyle[]> {
        // Return static art styles - no need for API call
        return [
            { id: 'cartoon', name: 'Cartoon', description: 'Fun and colorful cartoon style', prompt: 'cartoon style, vibrant colors, fun' },
            { id: 'watercolor', name: 'Watercolor', description: 'Soft watercolor painting', prompt: 'watercolor painting, soft colors, artistic' },
            { id: 'pixel', name: 'Pixel Art', description: 'Retro pixel art style', prompt: 'pixel art, 8-bit, retro gaming' },
            { id: 'storybook', name: 'Storybook', description: 'Classic children\'s book illustration', prompt: 'children\'s book illustration, whimsical, classic' },
            { id: 'anime', name: 'Anime', description: 'Japanese anime style', prompt: 'anime style, manga, japanese art' },
            { id: 'papercraft', name: 'Paper Craft', description: 'Paper cut-out style', prompt: 'paper craft, cut-out, layered paper' },
            { id: 'crayon', name: 'Crayon', description: 'Crayon drawing style', prompt: 'crayon drawing, child-like, colorful' },
            { id: 'claymation', name: 'Claymation', description: 'Clay animation style', prompt: 'claymation, 3d clay, stop motion' },
        ];
    }
    
    // Generate a simple gradient placeholder as data URL
    private generatePlaceholderDataUrl(text: string): string {
        // Sanitize text - remove special characters that could break SVG/base64
        const safeText = text.replace(/[^\w\s]/gi, '').substring(0, 18);
        const displayText = safeText || 'My Playlist';
        
        // Create a canvas-like SVG with gradient and text (no emojis for btoa compatibility)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#9333ea"/><stop offset="100%" style="stop-color:#ec4899"/></linearGradient></defs><rect width="400" height="400" fill="url(#grad)"/><circle cx="200" cy="160" r="50" fill="rgba(255,255,255,0.2)"/><polygon points="185,140 185,180 220,160" fill="white"/><text x="200" y="250" font-family="Arial" font-size="22" font-weight="bold" fill="white" text-anchor="middle">${displayText}</text><text x="200" y="280" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.7)" text-anchor="middle">Playlist</text></svg>`;
        
        try {
            return `data:image/svg+xml;base64,${btoa(svg)}`;
        } catch {
            // Fallback to URL encoding if btoa fails
            return `data:image/svg+xml,${encodeURIComponent(svg)}`;
        }
    }

    // Generate playlist cover with AI
    async generateCover(prompt: string, style: string, playlistName: string, userId: string): Promise<{ imageUrl: string; generationMethod: string } | null> {
        try {
            console.log('🎨 Generating cover:', { prompt, style, playlistName });
            
            const response = await fetch(`${this.baseUrl}/ai/playlist-cover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, style, playlistName, userId }),
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('🎨 Cover generated:', data);
                return { 
                    imageUrl: data.imageUrl, 
                    generationMethod: data.message?.includes('placeholder') ? 'placeholder' : 'ai' 
                };
            }
            
            // If AI generation fails, return a local placeholder
            console.warn('⚠️ AI generation failed, using local placeholder');
            const placeholderUrl = this.generatePlaceholderDataUrl(playlistName || 'My Playlist');
            return { imageUrl: placeholderUrl, generationMethod: 'placeholder' };
        } catch (error) {
            console.error('Error generating cover:', error);
            // Return local placeholder on error
            const placeholderUrl = this.generatePlaceholderDataUrl(playlistName || 'My Playlist');
            return { imageUrl: placeholderUrl, generationMethod: 'placeholder' };
        }
    }
    
    // Enhance prompt with AI (simplified - just return original for now)
    async enhancePrompt(prompt: string, style: string): Promise<string> {
        // For now, just enhance the prompt locally
        const stylePrompts: Record<string, string> = {
            cartoon: 'cartoon style, vibrant colors, fun',
            watercolor: 'watercolor painting, soft colors',
            pixel: 'pixel art, 8-bit, retro',
            storybook: 'children\'s book illustration',
            anime: 'anime style, manga',
            papercraft: 'paper craft, layered',
            crayon: 'crayon drawing, colorful',
            claymation: 'claymation, 3d clay',
        };
        
        const styleText = stylePrompts[style] || style;
        return `${prompt}, ${styleText}, for kids, safe for children, playlist cover art`;
    }
}

export const userPlaylistService = new UserPlaylistService();

