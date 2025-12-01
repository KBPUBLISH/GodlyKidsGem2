// Library Service - Manages user's saved books/library
const LIBRARY_KEY = 'godlykids_library';

export interface LibraryBook {
  bookId: string;
  addedAt: number; // timestamp
}

class LibraryService {
  // Get all library book IDs
  getLibrary(): string[] {
    try {
      const stored = localStorage.getItem(LIBRARY_KEY);
      if (!stored) return [];
      const library: LibraryBook[] = JSON.parse(stored);
      return library.map(book => book.bookId);
    } catch (error) {
      console.error('Error reading library:', error);
      return [];
    }
  }

  // Check if a book is in library
  isInLibrary(bookId: string): boolean {
    const library = this.getLibrary();
    return library.includes(bookId);
  }

  // Add book to library
  addToLibrary(bookId: string): void {
    try {
      const stored = localStorage.getItem(LIBRARY_KEY);
      const library: LibraryBook[] = stored ? JSON.parse(stored) : [];
      
      // Check if already in library
      if (library.some(book => book.bookId === bookId)) {
        return; // Already in library
      }
      
      library.push({ bookId, addedAt: Date.now() });
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch (error) {
      console.error('Error saving to library:', error);
    }
  }

  // Remove book from library
  removeFromLibrary(bookId: string): void {
    try {
      const stored = localStorage.getItem(LIBRARY_KEY);
      if (!stored) return;
      
      const library: LibraryBook[] = JSON.parse(stored);
      const updated = library.filter(book => book.bookId !== bookId);
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error removing from library:', error);
    }
  }

  // Toggle library status
  toggleLibrary(bookId: string): boolean {
    if (this.isInLibrary(bookId)) {
      this.removeFromLibrary(bookId);
      return false;
    } else {
      this.addToLibrary(bookId);
      return true;
    }
  }
}

export const libraryService = new LibraryService();

