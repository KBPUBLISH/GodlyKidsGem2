// Favorites Service - Manages user's favorite books, playlists, and book series
import { API_BASE_URL } from '../constants';

const FAVORITES_KEY = 'godlykids_favorites';
const LIKES_KEY = 'godlykids_likes';
const PLAYLIST_FAVORITES_KEY = 'godlykids_playlist_favorites';
const BOOK_SERIES_FAVORITES_KEY = 'godlykids_book_series_favorites';

// Helper to sync favorite action to backend (non-blocking)
const syncFavoriteToBackend = async (type: 'book' | 'playlist', id: string, action: 'add' | 'remove') => {
  try {
    const endpoint = type === 'book' 
      ? `${API_BASE_URL}/api/books/${id}/favorite`
      : `${API_BASE_URL}/api/playlists/${id}/favorite`;
    
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  } catch (error) {
    // Non-blocking - don't fail if backend sync fails
    console.warn(`Failed to sync ${type} favorite to backend:`, error);
  }
};

// Helper to sync like action to backend (non-blocking)
const syncLikeToBackend = async (type: 'book' | 'playlist', id: string, action: 'add' | 'remove') => {
  try {
    const endpoint = type === 'book' 
      ? `${API_BASE_URL}/api/books/${id}/like`
      : `${API_BASE_URL}/api/playlists/${id}/like`;
    
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  } catch (error) {
    // Non-blocking - don't fail if backend sync fails
    console.warn(`Failed to sync ${type} like to backend:`, error);
  }
};

export interface FavoriteBook {
  bookId: string;
  addedAt: number; // timestamp
}

export interface FavoritePlaylist {
  playlistId: string;
  addedAt: number; // timestamp
}

export interface FavoriteBookSeries {
  seriesId: string;
  addedAt: number; // timestamp
}

class FavoritesService {
  // Get all favorite book IDs
  getFavorites(): string[] {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (!stored) return [];
      const favorites: FavoriteBook[] = JSON.parse(stored);
      return favorites.map(fav => fav.bookId);
    } catch (error) {
      console.error('Error reading favorites:', error);
      return [];
    }
  }

  // Check if a book is favorited
  isFavorite(bookId: string): boolean {
    const favorites = this.getFavorites();
    return favorites.includes(bookId);
  }

  // Add book to favorites
  addFavorite(bookId: string): void {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      const favorites: FavoriteBook[] = stored ? JSON.parse(stored) : [];
      
      // Check if already favorited
      if (favorites.some(fav => fav.bookId === bookId)) {
        return; // Already favorited
      }
      
      favorites.push({ bookId, addedAt: Date.now() });
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Error saving favorite:', error);
    }
  }

  // Remove book from favorites
  removeFavorite(bookId: string): void {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (!stored) return;
      
      const favorites: FavoriteBook[] = JSON.parse(stored);
      const updated = favorites.filter(fav => fav.bookId !== bookId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  }

  // Toggle favorite status
  toggleFavorite(bookId: string): boolean {
    if (this.isFavorite(bookId)) {
      this.removeFavorite(bookId);
      syncFavoriteToBackend('book', bookId, 'remove');
      return false;
    } else {
      this.addFavorite(bookId);
      syncFavoriteToBackend('book', bookId, 'add');
      return true;
    }
  }

  // Get all liked book IDs
  getLikes(): string[] {
    try {
      const stored = localStorage.getItem(LIKES_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading likes:', error);
      return [];
    }
  }

  // Check if a book is liked
  isLiked(bookId: string): boolean {
    const likes = this.getLikes();
    return likes.includes(bookId);
  }

  // Toggle like status
  toggleLike(bookId: string): boolean {
    try {
      const stored = localStorage.getItem(LIKES_KEY);
      const likes: string[] = stored ? JSON.parse(stored) : [];
      
      const index = likes.indexOf(bookId);
      if (index > -1) {
        likes.splice(index, 1);
        localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
        syncLikeToBackend('book', bookId, 'remove');
        return false; // Unliked
      } else {
        likes.push(bookId);
        localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
        syncLikeToBackend('book', bookId, 'add');
        return true; // Liked
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      return false;
    }
  }

  // ============ PLAYLIST FAVORITES ============

  // Get all favorite playlist IDs
  getPlaylistFavorites(): string[] {
    try {
      const stored = localStorage.getItem(PLAYLIST_FAVORITES_KEY);
      if (!stored) return [];
      const favorites: FavoritePlaylist[] = JSON.parse(stored);
      return favorites.map(fav => fav.playlistId);
    } catch (error) {
      console.error('Error reading playlist favorites:', error);
      return [];
    }
  }

  // Check if a playlist is favorited
  isPlaylistFavorite(playlistId: string): boolean {
    const favorites = this.getPlaylistFavorites();
    return favorites.includes(playlistId);
  }

  // Add playlist to favorites
  addPlaylistFavorite(playlistId: string): void {
    try {
      const stored = localStorage.getItem(PLAYLIST_FAVORITES_KEY);
      const favorites: FavoritePlaylist[] = stored ? JSON.parse(stored) : [];
      
      // Check if already favorited
      if (favorites.some(fav => fav.playlistId === playlistId)) {
        return; // Already favorited
      }
      
      favorites.push({ playlistId, addedAt: Date.now() });
      localStorage.setItem(PLAYLIST_FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Error saving playlist favorite:', error);
    }
  }

  // Remove playlist from favorites
  removePlaylistFavorite(playlistId: string): void {
    try {
      const stored = localStorage.getItem(PLAYLIST_FAVORITES_KEY);
      if (!stored) return;
      
      const favorites: FavoritePlaylist[] = JSON.parse(stored);
      const updated = favorites.filter(fav => fav.playlistId !== playlistId);
      localStorage.setItem(PLAYLIST_FAVORITES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error removing playlist favorite:', error);
    }
  }

  // Toggle playlist favorite status
  togglePlaylistFavorite(playlistId: string): boolean {
    if (this.isPlaylistFavorite(playlistId)) {
      this.removePlaylistFavorite(playlistId);
      syncFavoriteToBackend('playlist', playlistId, 'remove');
      return false;
    } else {
      this.addPlaylistFavorite(playlistId);
      syncFavoriteToBackend('playlist', playlistId, 'add');
      return true;
    }
  }

  // ============ BOOK SERIES FAVORITES ============

  // Get all favorite book series IDs
  getBookSeriesFavorites(): string[] {
    try {
      const stored = localStorage.getItem(BOOK_SERIES_FAVORITES_KEY);
      if (!stored) return [];
      const favorites: FavoriteBookSeries[] = JSON.parse(stored);
      return favorites.map(fav => fav.seriesId);
    } catch (error) {
      console.error('Error reading book series favorites:', error);
      return [];
    }
  }

  // Check if a book series is favorited
  isBookSeriesFavorite(seriesId: string): boolean {
    const favorites = this.getBookSeriesFavorites();
    return favorites.includes(seriesId);
  }

  // Add book series to favorites
  addBookSeriesFavorite(seriesId: string): void {
    try {
      const stored = localStorage.getItem(BOOK_SERIES_FAVORITES_KEY);
      const favorites: FavoriteBookSeries[] = stored ? JSON.parse(stored) : [];
      
      // Check if already favorited
      if (favorites.some(fav => fav.seriesId === seriesId)) {
        return; // Already favorited
      }
      
      favorites.push({ seriesId, addedAt: Date.now() });
      localStorage.setItem(BOOK_SERIES_FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Error saving book series favorite:', error);
    }
  }

  // Remove book series from favorites
  removeBookSeriesFavorite(seriesId: string): void {
    try {
      const stored = localStorage.getItem(BOOK_SERIES_FAVORITES_KEY);
      if (!stored) return;
      
      const favorites: FavoriteBookSeries[] = JSON.parse(stored);
      const updated = favorites.filter(fav => fav.seriesId !== seriesId);
      localStorage.setItem(BOOK_SERIES_FAVORITES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error removing book series favorite:', error);
    }
  }

  // Toggle book series favorite status
  toggleBookSeriesFavorite(seriesId: string): boolean {
    if (this.isBookSeriesFavorite(seriesId)) {
      this.removeBookSeriesFavorite(seriesId);
      return false;
    } else {
      this.addBookSeriesFavorite(seriesId);
      return true;
    }
  }
}

export const favoritesService = new FavoritesService();



