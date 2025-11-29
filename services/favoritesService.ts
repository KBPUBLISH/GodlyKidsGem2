// Favorites Service - Manages user's favorite books
const FAVORITES_KEY = 'godlykids_favorites';
const LIKES_KEY = 'godlykids_likes';

export interface FavoriteBook {
  bookId: string;
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
      return false;
    } else {
      this.addFavorite(bookId);
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
        return false; // Unliked
      } else {
        likes.push(bookId);
        localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
        return true; // Liked
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      return false;
    }
  }
}

export const favoritesService = new FavoritesService();

