// Activity Tracking Service - Tracks user activities for Report Card
import { profileService } from './profileService';

export interface ActivityStats {
  booksRead: number;
  pagesRead: number;
  songsListened: number;
  gamesPlayed: number;
  lessonsCompleted: number;
  timeSpentMinutes: number;
}

interface ActivityEntry {
  type: 'book' | 'page' | 'song' | 'game' | 'lesson';
  id: string;
  title?: string;
  timestamp: number;
}

class ActivityTrackingService {
  private sessionStartTime: number | null = null;
  private lastActiveTime: number | null = null;
  private timeTrackingInterval: NodeJS.Timeout | null = null;

  // Get profile-specific storage key
  private getKey(key: string): string {
    return profileService.getProfileKey(key);
  }

  // Initialize time tracking when app starts
  startTimeTracking(): void {
    try {
      this.sessionStartTime = Date.now();
      this.lastActiveTime = Date.now();
      
      // Update time every minute while app is active
      if (this.timeTrackingInterval) {
        clearInterval(this.timeTrackingInterval);
      }
      
      this.timeTrackingInterval = setInterval(() => {
        try {
          this.updateTimeSpent();
        } catch (e) {
          console.error('Activity tracking update error:', e);
        }
      }, 60000); // Every minute
      
      // Also listen for visibility changes (but be defensive)
      if (typeof document !== 'undefined') {
        try {
          document.removeEventListener('visibilitychange', this.handleVisibilityChange);
          document.addEventListener('visibilitychange', this.handleVisibilityChange);
        } catch (e) {
          console.error('Visibility listener error:', e);
        }
      }
    } catch (e) {
      console.error('Activity tracking start error:', e);
    }
  }

  // Stop time tracking
  stopTimeTracking(): void {
    this.updateTimeSpent(); // Save final time
    
    if (this.timeTrackingInterval) {
      clearInterval(this.timeTrackingInterval);
      this.timeTrackingInterval = null;
    }
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      // App went to background - save current time
      this.updateTimeSpent();
      this.lastActiveTime = null;
    } else {
      // App came back to foreground - restart tracking
      this.lastActiveTime = Date.now();
    }
  };

  private updateTimeSpent(): void {
    if (!this.lastActiveTime) return;
    
    const now = Date.now();
    const minutesActive = Math.floor((now - this.lastActiveTime) / 60000);
    
    if (minutesActive > 0) {
      const key = this.getKey('total_time_spent_minutes');
      const currentTotal = parseInt(localStorage.getItem(key) || '0');
      localStorage.setItem(key, (currentTotal + minutesActive).toString());
      
      // Also track today's time
      const todayKey = this.getKey(`time_spent_${this.getTodayKey()}`);
      const todayTotal = parseInt(localStorage.getItem(todayKey) || '0');
      localStorage.setItem(todayKey, (todayTotal + minutesActive).toString());
      
      this.lastActiveTime = now;
    }
  }

  private getTodayKey(): string {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  }

  // Track book opened/read
  trackBookRead(bookId: string, bookTitle: string): void {
    const key = this.getKey('activity_books_read');
    const entries = this.getActivityEntries(key);
    
    // Check if already read today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyReadToday = entries.some(
      e => e.id === bookId && e.timestamp >= todayStart.getTime()
    );
    
    if (!alreadyReadToday) {
      entries.push({
        type: 'book',
        id: bookId,
        title: bookTitle,
        timestamp: Date.now(),
      });
      localStorage.setItem(key, JSON.stringify(entries));
      console.log('📖 Tracked book read:', bookTitle);
    }
  }

  // Track page read within a book
  trackPageRead(bookId: string, pageIndex: number): void {
    const key = this.getKey('activity_pages_read');
    const entries = this.getActivityEntries(key);
    
    const pageId = `${bookId}_page_${pageIndex}`;
    const alreadyTracked = entries.some(e => e.id === pageId);
    
    if (!alreadyTracked) {
      entries.push({
        type: 'page',
        id: pageId,
        timestamp: Date.now(),
      });
      localStorage.setItem(key, JSON.stringify(entries));
    }
  }

  // Track song/audio played
  trackSongPlayed(songId: string, songTitle: string): void {
    const key = this.getKey('activity_songs_played');
    const entries = this.getActivityEntries(key);
    
    entries.push({
      type: 'song',
      id: songId,
      title: songTitle,
      timestamp: Date.now(),
    });
    localStorage.setItem(key, JSON.stringify(entries));
    console.log('🎵 Tracked song played:', songTitle);
  }

  // Track game played/opened
  trackGamePlayed(gameId: string, gameName: string): void {
    const key = this.getKey('activity_games_played');
    const entries = this.getActivityEntries(key);
    
    entries.push({
      type: 'game',
      id: gameId,
      title: gameName,
      timestamp: Date.now(),
    });
    localStorage.setItem(key, JSON.stringify(entries));
    console.log('🎮 Tracked game played:', gameName);
  }

  // Track lesson completed
  trackLessonCompleted(lessonId: string, lessonTitle: string): void {
    const key = this.getKey('activity_lessons_completed');
    const entries = this.getActivityEntries(key);
    
    // Check if already completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyCompletedToday = entries.some(
      e => e.id === lessonId && e.timestamp >= todayStart.getTime()
    );
    
    if (!alreadyCompletedToday) {
      entries.push({
        type: 'lesson',
        id: lessonId,
        title: lessonTitle,
        timestamp: Date.now(),
      });
      localStorage.setItem(key, JSON.stringify(entries));
      console.log('📚 Tracked lesson completed:', lessonTitle);
    }
  }

  private getActivityEntries(key: string): ActivityEntry[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Get stats for a specific time period
  getStats(periodDays: number = 7): ActivityStats {
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    
    // Books read
    const booksKey = this.getKey('activity_books_read');
    const booksEntries = this.getActivityEntries(booksKey);
    const booksRead = booksEntries.filter(e => e.timestamp >= cutoff).length;
    
    // Pages read
    const pagesKey = this.getKey('activity_pages_read');
    const pagesEntries = this.getActivityEntries(pagesKey);
    const pagesRead = pagesEntries.filter(e => e.timestamp >= cutoff).length;
    
    // Songs listened
    const songsKey = this.getKey('activity_songs_played');
    const songsEntries = this.getActivityEntries(songsKey);
    const songsListened = songsEntries.filter(e => e.timestamp >= cutoff).length;
    
    // Games played
    const gamesKey = this.getKey('activity_games_played');
    const gamesEntries = this.getActivityEntries(gamesKey);
    const gamesPlayed = gamesEntries.filter(e => e.timestamp >= cutoff).length;
    
    // Lessons completed
    const lessonsKey = this.getKey('activity_lessons_completed');
    const lessonsEntries = this.getActivityEntries(lessonsKey);
    const lessonsCompleted = lessonsEntries.filter(e => e.timestamp >= cutoff).length;
    
    // Time spent - sum up daily time within period
    let timeSpentMinutes = 0;
    const now = new Date();
    for (let i = 0; i < periodDays; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      const timeKey = this.getKey(`time_spent_${dayKey}`);
      timeSpentMinutes += parseInt(localStorage.getItem(timeKey) || '0');
    }
    
    return {
      booksRead,
      pagesRead,
      songsListened,
      gamesPlayed,
      lessonsCompleted,
      timeSpentMinutes,
    };
  }

  // Get all recent activities for display
  getRecentActivities(limit: number = 20): ActivityEntry[] {
    const allEntries: ActivityEntry[] = [];
    
    const keys = [
      'activity_books_read',
      'activity_songs_played',
      'activity_games_played',
      'activity_lessons_completed',
    ];
    
    keys.forEach(keyBase => {
      const entries = this.getActivityEntries(this.getKey(keyBase));
      allEntries.push(...entries);
    });
    
    // Sort by timestamp descending
    allEntries.sort((a, b) => b.timestamp - a.timestamp);
    
    return allEntries.slice(0, limit);
  }
}

export const activityTrackingService = new ActivityTrackingService();


