// Play Count Service - Tracks how many times each playlist/song has been played by the user
const PLAY_COUNTS_KEY = 'godlykids_play_counts';

interface PlayCount {
  itemId: string; // Can be playlist ID or song/episode ID
  type: 'playlist' | 'song' | 'episode';
  count: number;
  lastPlayedAt: number; // timestamp of last play
}

class PlayCountService {
  // Get all play counts
  private getAllPlayCounts(): PlayCount[] {
    try {
      const stored = localStorage.getItem(PLAY_COUNTS_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading play counts:', error);
      return [];
    }
  }

  // Save all play counts
  private saveAllPlayCounts(counts: PlayCount[]): void {
    try {
      localStorage.setItem(PLAY_COUNTS_KEY, JSON.stringify(counts));
    } catch (error) {
      console.error('Error saving play counts:', error);
    }
  }

  // Get play count for a specific item
  getPlayCount(itemId: string): number {
    const counts = this.getAllPlayCounts();
    const itemCount = counts.find(c => c.itemId === itemId);
    return itemCount ? itemCount.count : 0;
  }

  // Increment play count when a playlist/song is played
  incrementPlayCount(itemId: string, type: 'playlist' | 'song' | 'episode' = 'song'): void {
    try {
      const counts = this.getAllPlayCounts();
      const existingIndex = counts.findIndex(c => c.itemId === itemId);
      
      if (existingIndex > -1) {
        // Update existing count
        counts[existingIndex].count += 1;
        counts[existingIndex].lastPlayedAt = Date.now();
      } else {
        // Add new count
        counts.push({
          itemId,
          type,
          count: 1,
          lastPlayedAt: Date.now()
        });
      }
      
      this.saveAllPlayCounts(counts);
    } catch (error) {
      console.error('Error incrementing play count:', error);
    }
  }

  // Get total play count across all items (for statistics)
  getTotalPlayCount(): number {
    const counts = this.getAllPlayCounts();
    return counts.reduce((total, count) => total + count.count, 0);
  }

  // Get all items with their play counts
  getAllPlayCountsData(): PlayCount[] {
    return this.getAllPlayCounts();
  }

  // Get play count for all songs in a playlist (sum)
  getPlaylistTotalPlays(songIds: string[]): number {
    const counts = this.getAllPlayCounts();
    return songIds.reduce((total, songId) => {
      const songCount = counts.find(c => c.itemId === songId);
      return total + (songCount ? songCount.count : 0);
    }, 0);
  }
}

export const playCountService = new PlayCountService();

