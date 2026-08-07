// Play History Service - Tracks recently played playlists and songs PER PROFILE
import { profileService } from './profileService';

const BASE_KEY = 'godlykids_play_history';

export interface PlayHistoryEntry {
  playlistId: string;
  lastPlayedAt: number; // timestamp
  itemId?: string; // Optional: specific song/episode that was played
  positionSeconds?: number; // Playback position within itemId, for resume
  durationSeconds?: number; // Duration of itemId when the position was saved
}

// A saved position within the final stretch of a track is treated as
// "finished" — resuming there is pointless, so those restart from 0.
const RESUME_END_GUARD_SECONDS = 15;
// Positions under a few seconds aren't worth seeking for.
const RESUME_MIN_SECONDS = 5;

class PlayHistoryService {
  // Get the current profile-specific key
  private getKey(): string {
    return profileService.getProfileKey(BASE_KEY);
  }

  // Get all play history for current profile
  getAllHistory(): Record<string, PlayHistoryEntry> {
    try {
      const stored = localStorage.getItem(this.getKey());
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

  // Record that a playlist was played. Keeps the saved position when the same
  // episode is (re)started, so a resume-in-progress isn't wiped before the
  // seek lands; switching to a different episode drops the old position.
  recordPlay(playlistId: string, itemId?: string): void {
    try {
      const allHistory = this.getAllHistory();
      const existing = allHistory[playlistId];
      const samePlace = existing && itemId && existing.itemId === itemId;
      allHistory[playlistId] = {
        playlistId,
        lastPlayedAt: Date.now(),
        itemId,
        ...(samePlace
          ? { positionSeconds: existing.positionSeconds, durationSeconds: existing.durationSeconds }
          : {}),
      };
      localStorage.setItem(this.getKey(), JSON.stringify(allHistory));
    } catch (error) {
      console.error('Error saving play history:', error);
    }
  }

  // Save the current playback position for resume (also refreshes lastPlayedAt
  // and itemId so history stays in sync with auto-advanced tracks)
  savePosition(playlistId: string, itemId: string | undefined, positionSeconds: number, durationSeconds: number): void {
    try {
      const allHistory = this.getAllHistory();
      allHistory[playlistId] = {
        playlistId,
        lastPlayedAt: Date.now(),
        itemId,
        positionSeconds: Math.floor(positionSeconds),
        durationSeconds: durationSeconds > 0 ? Math.floor(durationSeconds) : undefined,
      };
      localStorage.setItem(this.getKey(), JSON.stringify(allHistory));
    } catch (error) {
      console.error('Error saving playback position:', error);
    }
  }

  // Drop the saved position (track finished) but keep the history entry
  clearPosition(playlistId: string): void {
    try {
      const allHistory = this.getAllHistory();
      const entry = allHistory[playlistId];
      if (!entry) return;
      delete entry.positionSeconds;
      delete entry.durationSeconds;
      localStorage.setItem(this.getKey(), JSON.stringify(allHistory));
    } catch (error) {
      console.error('Error clearing playback position:', error);
    }
  }

  // Position to resume from, or null if there's nothing meaningful to resume
  // (no position saved, barely started, or effectively finished)
  getResumePosition(playlistId: string): { itemId?: string; positionSeconds: number } | null {
    const entry = this.getHistory(playlistId);
    if (!entry || typeof entry.positionSeconds !== 'number') return null;
    if (entry.positionSeconds < RESUME_MIN_SECONDS) return null;
    if (
      typeof entry.durationSeconds === 'number' &&
      entry.durationSeconds > 0 &&
      entry.positionSeconds >= entry.durationSeconds - RESUME_END_GUARD_SECONDS
    ) {
      return null;
    }
    return { itemId: entry.itemId, positionSeconds: entry.positionSeconds };
  }

  // Clear history for a playlist
  clearHistory(playlistId: string): void {
    try {
      const allHistory = this.getAllHistory();
      delete allHistory[playlistId];
      localStorage.setItem(this.getKey(), JSON.stringify(allHistory));
    } catch (error) {
      console.error('Error clearing play history:', error);
    }
  }

  // Clear all history for current profile
  clearAllHistory(): void {
    try {
      localStorage.removeItem(this.getKey());
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
