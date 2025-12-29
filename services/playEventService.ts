import { getApiBaseUrl } from './apiService';

interface PlayEventResponse {
  success: boolean;
  eventId?: string;
}

class PlayEventService {
  private baseUrl: string;
  // Track active sessions for engagement updates
  private activeSessions: Map<string, { eventId: string; startTime: number }> = new Map();

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  // Record a book play/read event and start tracking engagement
  async recordBookPlay(bookId: string, userId?: string, totalPages?: number): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}play-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'book',
          contentId: bookId,
          userId: userId || 'anonymous',
          totalPages: totalPages || 0,
        }),
      });
      const data: PlayEventResponse = await response.json();
      
      if (data.eventId) {
        // Start tracking this session
        this.activeSessions.set(`book_${bookId}`, { 
          eventId: data.eventId, 
          startTime: Date.now() 
        });
        console.log(`📊 Book play recorded: ${bookId} (eventId: ${data.eventId})`);
        return data.eventId;
      }
      return null;
    } catch (error) {
      console.warn('Failed to record book play event:', error);
      return null;
    }
  }

  // Update book engagement (pages viewed)
  async updateBookEngagement(
    bookId: string, 
    pagesViewed: number, 
    totalPages: number
  ): Promise<void> {
    const session = this.activeSessions.get(`book_${bookId}`);
    if (!session) {
      console.warn('No active session for book:', bookId);
      return;
    }

    const completionPercent = totalPages > 0 ? Math.round((pagesViewed / totalPages) * 100) : 0;
    
    try {
      await fetch(`${this.baseUrl}play-events/${session.eventId}/engagement`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagesViewed,
          totalPages,
          completionPercent,
        }),
      });
      console.log(`📊 Book engagement updated: ${pagesViewed}/${totalPages} pages (${completionPercent}%)`);
    } catch (error) {
      console.warn('Failed to update book engagement:', error);
    }
  }

  // End book session (called when leaving book reader)
  endBookSession(bookId: string): void {
    this.activeSessions.delete(`book_${bookId}`);
    console.log(`📊 Book session ended: ${bookId}`);
  }

  // Record an episode play event and start tracking engagement
  async recordEpisodePlay(
    playlistId: string, 
    itemIndex: number, 
    episodeId?: string,
    userId?: string,
    totalDurationSeconds?: number
  ): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}play-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'episode',
          contentId: episodeId || `${playlistId}_${itemIndex}`,
          playlistId,
          itemIndex,
          userId: userId || 'anonymous',
          totalDurationSeconds: totalDurationSeconds || 0,
        }),
      });
      const data: PlayEventResponse = await response.json();
      
      if (data.eventId) {
        // Start tracking this session
        const sessionKey = `episode_${playlistId}_${itemIndex}`;
        this.activeSessions.set(sessionKey, { 
          eventId: data.eventId, 
          startTime: Date.now() 
        });
        console.log(`📊 Episode play recorded: playlist ${playlistId}, track ${itemIndex} (eventId: ${data.eventId})`);
        return data.eventId;
      }
      return null;
    } catch (error) {
      console.warn('Failed to record episode play event:', error);
      return null;
    }
  }

  // Update episode engagement (listen time)
  async updateEpisodeEngagement(
    playlistId: string,
    itemIndex: number,
    durationSeconds: number,
    totalDurationSeconds: number
  ): Promise<void> {
    const sessionKey = `episode_${playlistId}_${itemIndex}`;
    const session = this.activeSessions.get(sessionKey);
    if (!session) {
      console.warn('No active session for episode:', sessionKey);
      return;
    }

    const completionPercent = totalDurationSeconds > 0 
      ? Math.round((durationSeconds / totalDurationSeconds) * 100) 
      : 0;
    
    try {
      await fetch(`${this.baseUrl}play-events/${session.eventId}/engagement`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds,
          totalDurationSeconds,
          completionPercent,
        }),
      });
      console.log(`📊 Episode engagement updated: ${Math.round(durationSeconds)}s/${Math.round(totalDurationSeconds)}s (${completionPercent}%)`);
    } catch (error) {
      console.warn('Failed to update episode engagement:', error);
    }
  }

  // End episode session
  endEpisodeSession(playlistId: string, itemIndex: number): void {
    const sessionKey = `episode_${playlistId}_${itemIndex}`;
    this.activeSessions.delete(sessionKey);
    console.log(`📊 Episode session ended: ${sessionKey}`);
  }

  // Record a playlist play event
  async recordPlaylistPlay(playlistId: string, userId?: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}play-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'playlist',
          contentId: playlistId,
          userId: userId || 'anonymous',
        }),
      });
      console.log(`📊 Playlist play recorded: ${playlistId}`);
    } catch (error) {
      console.warn('Failed to record playlist play event:', error);
    }
  }

  // Get active session for a book (for checking if we need to record)
  hasActiveSession(type: 'book' | 'episode', id: string, itemIndex?: number): boolean {
    if (type === 'book') {
      return this.activeSessions.has(`book_${id}`);
    } else {
      return this.activeSessions.has(`episode_${id}_${itemIndex}`);
    }
  }
}

export const playEventService = new PlayEventService();

