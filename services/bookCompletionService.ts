// Book Completion Service - Tracks which books have been completed (permanently)
// Once a book is completed, games remain unlocked forever regardless of re-reading progress

const COMPLETED_BOOKS_KEY = 'godlykids_completed_books';

interface CompletedBook {
  bookId: string;
  completedAt: number; // timestamp of first completion
}

class BookCompletionService {
  // Get all completed books
  private getAllCompletedBooks(): CompletedBook[] {
    try {
      const stored = localStorage.getItem(COMPLETED_BOOKS_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading completed books:', error);
      return [];
    }
  }

  // Save all completed books
  private saveAllCompletedBooks(books: CompletedBook[]): void {
    try {
      localStorage.setItem(COMPLETED_BOOKS_KEY, JSON.stringify(books));
    } catch (error) {
      console.error('Error saving completed books:', error);
    }
  }

  // Check if a book has ever been completed
  isBookCompleted(bookId: string): boolean {
    const completedBooks = this.getAllCompletedBooks();
    return completedBooks.some(b => b.bookId === bookId);
  }

  // Mark a book as completed (only if not already completed)
  markBookCompleted(bookId: string): void {
    if (this.isBookCompleted(bookId)) {
      console.log(`📚 Book ${bookId} already marked as completed`);
      return;
    }

    const completedBooks = this.getAllCompletedBooks();
    completedBooks.push({
      bookId,
      completedAt: Date.now()
    });
    
    this.saveAllCompletedBooks(completedBooks);
    console.log(`📚 Book ${bookId} marked as completed - games permanently unlocked!`);
  }

  // Get completion date for a book (null if not completed)
  getCompletionDate(bookId: string): number | null {
    const completedBooks = this.getAllCompletedBooks();
    const book = completedBooks.find(b => b.bookId === bookId);
    return book ? book.completedAt : null;
  }

  // Get all completed book IDs
  getAllCompletedBookIds(): string[] {
    return this.getAllCompletedBooks().map(b => b.bookId);
  }

  // Get count of completed books
  getCompletedCount(): number {
    return this.getAllCompletedBooks().length;
  }
}

export const bookCompletionService = new BookCompletionService();

