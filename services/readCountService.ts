// Read Count Service - Tracks how many times each book has been read (completed)
const READ_COUNTS_KEY = 'godlykids_read_counts';

interface ReadCount {
  bookId: string;
  count: number;
  lastReadAt: number; // timestamp of last completion
}

class ReadCountService {
  // Get all read counts
  private getAllReadCounts(): ReadCount[] {
    try {
      const stored = localStorage.getItem(READ_COUNTS_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading read counts:', error);
      return [];
    }
  }

  // Save all read counts
  private saveAllReadCounts(counts: ReadCount[]): void {
    try {
      localStorage.setItem(READ_COUNTS_KEY, JSON.stringify(counts));
    } catch (error) {
      console.error('Error saving read counts:', error);
    }
  }

  // Get read count for a specific book
  getReadCount(bookId: string): number {
    const counts = this.getAllReadCounts();
    const bookCount = counts.find(c => c.bookId === bookId);
    return bookCount ? bookCount.count : 0;
  }

  // Increment read count when a book is completed
  incrementReadCount(bookId: string): void {
    try {
      const counts = this.getAllReadCounts();
      const existingIndex = counts.findIndex(c => c.bookId === bookId);
      
      if (existingIndex > -1) {
        // Update existing count
        counts[existingIndex].count += 1;
        counts[existingIndex].lastReadAt = Date.now();
      } else {
        // Add new count
        counts.push({
          bookId,
          count: 1,
          lastReadAt: Date.now()
        });
      }
      
      this.saveAllReadCounts(counts);
    } catch (error) {
      console.error('Error incrementing read count:', error);
    }
  }

  // Get total read count across all books (for statistics)
  getTotalReadCount(): number {
    const counts = this.getAllReadCounts();
    return counts.reduce((total, count) => total + count.count, 0);
  }

  // Get all books with their read counts (for leaderboards, etc.)
  getAllReadCountsData(): ReadCount[] {
    return this.getAllReadCounts();
  }
}

export const readCountService = new ReadCountService();

