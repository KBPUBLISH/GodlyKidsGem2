// Play History Service - Tracks recently played playlists and songs
const PLAY_HISTORY_KEY = 'godlykids_play_history';

export interface PlayHistoryEntry {
  playlistId: string;
  lastPlayedAt: number; // timestamp
  itemId?: string; // Optional: specific song/episode that was played
}

class PlayHistoryService {
  // Get all play history
  getAllHistory(): Record<string, PlayHistoryEntry> {
    try {
      const stored = localStorage.getItem(PLAY_HISTORY_KEY);
      if (!stored) return {};
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading play history:', error);
      return {};
    }
  }

  // Get history for a specific playlist
  getHistory(playlistId: string): PlayHistoryEntry | null {
    const allHistory = this.getAllHistory();
    return allHistory[playlistId] || null;
  }

  // Record that a playlist was played
  recordPlay(playlistId: string, itemId?: string): void {
    try {
      const allHistory = this.getAllHistory();
      allHistory[playlistId] = {
        playlistId,
        lastPlayedAt: Date.now(),
        itemId
      };
      localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(allHistory));
    } catch (error) {
      console.error('Error saving play history:', error);
    }
  }

  // Clear history for a playlist
  clearHistory(playlistId: string): void {
    try {
      const allHistory = this.getAllHistory();
      delete allHistory[playlistId];
      localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(allHistory));
    } catch (error) {
      console.error('Error clearing play history:', error);
    }
  }

  // Clear all history
  clearAllHistory(): void {
    try {
      localStorage.removeItem(PLAY_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing all play history:', error);
    }
  }

  // Get recently played playlist IDs sorted by lastPlayedAt (most recent first)
  getRecentlyPlayedIds(limit: number = 10): string[] {
    try {
      const allHistory = this.getAllHistory();
      return Object.values(allHistory)
        .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
        .slice(0, limit)
        .map(h => h.playlistId);
    } catch (error) {
      console.error('Error getting recently played:', error);
      return [];
    }
  }

  // Check if a playlist was played recently (within last 7 days)
  wasPlayedRecently(playlistId: string, daysAgo: number = 7): boolean {
    const history = this.getHistory(playlistId);
    if (!history) return false;
    const cutoff = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
    return history.lastPlayedAt > cutoff;
  }
}

export const playHistoryService = new PlayHistoryService();

