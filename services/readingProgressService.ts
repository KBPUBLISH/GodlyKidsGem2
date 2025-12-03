// Reading Progress Service - Tracks reading progress for each book
const READING_PROGRESS_KEY = 'godlykids_reading_progress';

export interface ReadingProgress {
  bookId: string;
  currentPageIndex: number; // 0-based index
  lastReadAt: number; // timestamp
}

class ReadingProgressService {
  // Get all reading progress
  getAllProgress(): Record<string, ReadingProgress> {
    try {
      const stored = localStorage.getItem(READING_PROGRESS_KEY);
      if (!stored) return {};
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading progress:', error);
      return {};
    }
  }

  // Get progress for a specific book
  getProgress(bookId: string): ReadingProgress | null {
    const allProgress = this.getAllProgress();
    return allProgress[bookId] || null;
  }

  // Save progress for a book
  saveProgress(bookId: string, currentPageIndex: number): void {
    try {
      const allProgress = this.getAllProgress();
      allProgress[bookId] = {
        bookId,
        currentPageIndex,
        lastReadAt: Date.now()
      };
      localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }

  // Clear progress for a book
  clearProgress(bookId: string): void {
    try {
      const allProgress = this.getAllProgress();
      delete allProgress[bookId];
      localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Error clearing progress:', error);
    }
  }

  // Clear all progress
  clearAllProgress(): void {
    try {
      localStorage.removeItem(READING_PROGRESS_KEY);
    } catch (error) {
      console.error('Error clearing all progress:', error);
    }
  }

  // Get recently read book IDs sorted by lastReadAt (most recent first)
  getRecentlyReadBookIds(limit: number = 10): string[] {
    try {
      const allProgress = this.getAllProgress();
      return Object.values(allProgress)
        .sort((a, b) => b.lastReadAt - a.lastReadAt)
        .slice(0, limit)
        .map(p => p.bookId);
    } catch (error) {
      console.error('Error getting recently read books:', error);
      return [];
    }
  }
}

export const readingProgressService = new ReadingProgressService();



