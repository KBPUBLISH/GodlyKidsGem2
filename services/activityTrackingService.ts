// Activity Tracking Service - Tracks user activities for Report Card
import { profileService } from './profileService';
import { authService } from './authService';

export interface ActivityStats {
  booksRead: number;
  pagesRead: number;
  songsListened: number;
  gamesPlayed: number;
  lessonsCompleted: number;
  timeSpentMinutes: number;
  audioListeningTimeSeconds: number;
  onboardingStep: number;
  farthestPageReached: string;
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
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  private backendSyncStarted: boolean = false;

  // Get profile-specific storage key
  private getKey(key: string): string {
    return profileService.getProfileKey(key);
  }

  // Start backend sync only (for Despia mode)
  startBackendSync(): void {
    if (this.backendSyncStarted) return;
    this.backendSyncStarted = true;
    
    try {
      // Clear any existing sync interval
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }
      
      // Sync stats to backend every 5 minutes
      this.syncInterval = setInterval(() => {
        this.syncStatsToBackend();
      }, 300000); // Every 5 minutes
      
      // Also sync on startup (with delay to let app initialize)
      setTimeout(() => this.syncStatsToBackend(), 5000);
      
      console.log('📊 Backend sync started');
    } catch (e) {
      console.error('Backend sync start error:', e);
    }
  }

  // Stop backend sync
  stopBackendSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.backendSyncStarted = false;
  }

  // Initialize time tracking when app starts
  // skipVisibilityHandlers: true for Despia (native app handles visibility differently)
  startTimeTracking(skipVisibilityHandlers: boolean = false): void {
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
      
      // Listen for visibility changes (skip for Despia - native app handles this differently)
      if (!skipVisibilityHandlers && typeof document !== 'undefined') {
        try {
          document.removeEventListener('visibilitychange', this.handleVisibilityChange);
          document.addEventListener('visibilitychange', this.handleVisibilityChange);
        } catch (e) {
          console.error('Visibility listener error:', e);
        }
      }
      
      console.log(`⏱️ Time tracking started (visibility handlers: ${!skipVisibilityHandlers})`);
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

  // Track audio listening time (in seconds)
  trackAudioListeningTime(seconds: number): void {
    if (seconds <= 0) return;
    const key = this.getKey('audio_listening_time_seconds');
    const currentTotal = parseInt(localStorage.getItem(key) || '0');
    localStorage.setItem(key, (currentTotal + seconds).toString());
  }

  // Track page navigation (to see how far users get)
  trackPageVisit(pagePath: string): void {
    const key = this.getKey('farthest_page_reached');
    const currentFarthest = localStorage.getItem(key) || '/';
    
    // Simple depth scoring based on page path
    const getDepth = (path: string): number => {
      const depthMap: Record<string, number> = {
        '/': 0,
        '/onboarding': 1,
        '/profile': 2,
        '/home': 3,
        '/audio': 4,
        '/explore': 4,
        '/books': 5,
        '/playlist': 5,
        '/book': 6,
        '/paywall': 7,
        '/settings': 7,
      };
      // Match the start of the path
      for (const [prefix, depth] of Object.entries(depthMap).sort((a, b) => b[0].length - a[0].length)) {
        if (path.startsWith(prefix)) return depth;
      }
      return 0;
    };

    if (getDepth(pagePath) > getDepth(currentFarthest)) {
      localStorage.setItem(key, pagePath);
      console.log('📍 New farthest page:', pagePath);
    }
  }

  // Track onboarding step reached
  trackOnboardingStep(step: number): void {
    const key = this.getKey('onboarding_step_reached');
    const currentStep = parseInt(localStorage.getItem(key) || '0');
    if (step > currentStep) {
      localStorage.setItem(key, step.toString());
      console.log('📊 Onboarding step reached:', step);
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

    // Audio listening time (all-time, not filtered by period for now)
    const audioKey = this.getKey('audio_listening_time_seconds');
    const audioListeningTimeSeconds = parseInt(localStorage.getItem(audioKey) || '0');

    // Onboarding step (all-time)
    const onboardingKey = this.getKey('onboarding_step_reached');
    const onboardingStep = parseInt(localStorage.getItem(onboardingKey) || '0');

    // Farthest page (all-time)
    const farthestKey = this.getKey('farthest_page_reached');
    const farthestPageReached = localStorage.getItem(farthestKey) || '/';
    
    return {
      booksRead,
      pagesRead,
      songsListened,
      gamesPlayed,
      lessonsCompleted,
      timeSpentMinutes,
      audioListeningTimeSeconds,
      onboardingStep,
      farthestPageReached,
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

  // Sync stats to backend for analytics dashboard
  async syncStatsToBackend(): Promise<void> {
    try {
      // Get user ID - try multiple sources
      const user = authService.getUser();
      let userId = user?.email || user?._id || user?.id || 
        localStorage.getItem('godlykids_user_email') || 
        localStorage.getItem('device_id') ||
        localStorage.getItem('godlykids_device_id');
      
      // If no userId, generate a device ID for anonymous tracking
      if (!userId) {
        userId = 'device_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('godlykids_device_id', userId);
        console.log('📊 Generated new device ID for tracking:', userId);
      }

      // Don't sync too frequently (but allow force sync on session start)
      const now = Date.now();
      const timeSinceLastSync = now - this.lastSyncTime;
      if (timeSinceLastSync < 30000 && this.lastSyncTime > 0) { // 30 seconds min between syncs
        console.log('📊 Skipping sync (too recent):', timeSinceLastSync, 'ms ago');
        return;
      }
      this.lastSyncTime = now;

      // Get all-time stats (not limited to a period)
      const allTimeStats = this.getAllTimeStats();
      const sessionCount = this.getSessionCount();
      
      console.log('📊 Syncing stats for:', userId);
      console.log('  - Sessions:', sessionCount);
      console.log('  - Books read:', allTimeStats.booksRead);
      console.log('  - Songs listened:', allTimeStats.songsListened);
      
      const apiBase = window.location.hostname === 'localhost' 
        ? 'http://localhost:5001' 
        : 'https://backendgk2-0.onrender.com';

      const response = await fetch(`${apiBase}/api/analytics/sync-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          stats: {
            totalSessions: sessionCount,
            totalTimeSpent: allTimeStats.timeSpentMinutes * 60, // Convert to seconds
            booksRead: allTimeStats.booksRead,
            pagesRead: allTimeStats.pagesRead,
            playlistsPlayed: allTimeStats.songsListened,
            audioListeningTime: allTimeStats.audioListeningTimeSeconds,
            lessonsCompleted: allTimeStats.lessonsCompleted,
            gamesPlayed: allTimeStats.gamesPlayed,
            coloringSessions: 0,
            onboardingStep: allTimeStats.onboardingStep,
            farthestPageReached: allTimeStats.farthestPageReached,
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Stats synced successfully:', data);
      } else {
        console.warn('📊 Stats sync failed:', response.status, await response.text());
      }
    } catch (error) {
      console.warn('📊 Failed to sync stats to backend:', error);
    }
  }

  // Get all-time stats (no time cutoff)
  private getAllTimeStats(): ActivityStats {
    // Books read (all time)
    const booksKey = this.getKey('activity_books_read');
    const booksEntries = this.getActivityEntries(booksKey);
    const booksRead = new Set(booksEntries.map(e => e.id)).size; // Unique books
    
    // Pages read (all time)
    const pagesKey = this.getKey('activity_pages_read');
    const pagesEntries = this.getActivityEntries(pagesKey);
    const pagesRead = pagesEntries.length;
    
    // Songs listened (all time)
    const songsKey = this.getKey('activity_songs_played');
    const songsEntries = this.getActivityEntries(songsKey);
    const songsListened = songsEntries.length;
    
    // Games played (all time)
    const gamesKey = this.getKey('activity_games_played');
    const gamesEntries = this.getActivityEntries(gamesKey);
    const gamesPlayed = gamesEntries.length;
    
    // Lessons completed (all time)
    const lessonsKey = this.getKey('activity_lessons_completed');
    const lessonsEntries = this.getActivityEntries(lessonsKey);
    const lessonsCompleted = new Set(lessonsEntries.map(e => e.id)).size; // Unique lessons
    
    // Total time spent
    const totalTimeKey = this.getKey('total_time_spent_minutes');
    const timeSpentMinutes = parseInt(localStorage.getItem(totalTimeKey) || '0');

    // Audio listening time
    const audioKey = this.getKey('audio_listening_time_seconds');
    const audioListeningTimeSeconds = parseInt(localStorage.getItem(audioKey) || '0');

    // Onboarding step
    const onboardingKey = this.getKey('onboarding_step_reached');
    const onboardingStep = parseInt(localStorage.getItem(onboardingKey) || '0');

    // Farthest page
    const farthestKey = this.getKey('farthest_page_reached');
    const farthestPageReached = localStorage.getItem(farthestKey) || '/';
    
    return {
      booksRead,
      pagesRead,
      songsListened,
      gamesPlayed,
      lessonsCompleted,
      timeSpentMinutes,
      audioListeningTimeSeconds,
      onboardingStep,
      farthestPageReached,
    };
  }

  // Get session count
  private getSessionCount(): number {
    const key = this.getKey('session_count');
    return parseInt(localStorage.getItem(key) || '1');
  }

  // Increment session count (call on app start)
  incrementSessionCount(): void {
    const key = this.getKey('session_count');
    const current = parseInt(localStorage.getItem(key) || '0');
    const newCount = current + 1;
    localStorage.setItem(key, newCount.toString());
    console.log(`📊 Session count incremented: ${newCount}`);
    
    // Trigger an immediate sync after incrementing (with small delay)
    setTimeout(() => {
      this.syncStatsToBackend();
    }, 2000);
  }

  // ============================================
  // ONBOARDING ANALYTICS
  // ============================================
  
  private onboardingSessionId: string | null = null;
  
  // Get or create onboarding session ID
  private getOnboardingSessionId(): string {
    if (!this.onboardingSessionId) {
      this.onboardingSessionId = `onb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    return this.onboardingSessionId;
  }
  
  // Track onboarding event
  async trackOnboardingEvent(
    event: string, 
    metadata?: { 
      step?: number; 
      planType?: string; 
      kidsCount?: number; 
      voiceSelected?: string;
      email?: string;  // For account_created event
    }
  ): Promise<void> {
    try {
      const user = authService.getUser();
      const userId = user?.email || user?._id || localStorage.getItem('godlykids_device_id') || `anon_${Date.now()}`;
      
      // Normalize API URL - remove trailing slash and /api to avoid double /api//api
      let API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
      API_BASE = API_BASE.replace(/\/+$/, '').replace(/\/api$/, '');
      const apiUrl = `${API_BASE}/api`;
      
      const platform = (window as any).__GK_IS_DESPIA__ ? 'ios' : 'web';
      
      // Store onboarding step in localStorage for stats sync
      // Use the same key pattern as getAllTimeStats() expects
      const onboardingKey = this.getKey('onboarding_step_reached');
      if (metadata?.step !== undefined) {
        const currentStep = parseInt(localStorage.getItem(onboardingKey) || '0');
        if (metadata.step > currentStep) {
          localStorage.setItem(onboardingKey, metadata.step.toString());
          console.log(`📊 Onboarding step updated: ${metadata.step} (key: ${onboardingKey})`);
        }
      }
      
      // Mark onboarding complete if event indicates it
      if (event === 'onboarding_complete') {
        localStorage.setItem(onboardingKey, '5'); // Mark as completed (step 5 = done)
        console.log(`📊 Onboarding marked complete (step 5)`);
      }
      
      const payload = {
        userId,
        sessionId: this.getOnboardingSessionId(),
        event,
        metadata: {
          ...metadata,
          platform,
        },
      };
      
      // Log account_created events specifically for debugging
      if (event === 'account_created') {
        console.log(`📊 ACCOUNT CREATED event being sent:`, JSON.stringify(payload));
      }
      
      const response = await fetch(`${apiUrl}/analytics/onboarding/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`📊 Onboarding event FAILED: ${event}`, response.status, errorData);
      } else {
        console.log(`📊 Onboarding event tracked: ${event}`, metadata);
      }
      
      // Trigger a stats sync to update the user's onboarding step in the database
      setTimeout(() => this.syncStatsToBackend(), 1000);
    } catch (error) {
      console.error('Failed to track onboarding event:', error);
    }
  }
  
  // Reset onboarding session (call when onboarding completes or user leaves)
  resetOnboardingSession(): void {
    this.onboardingSessionId = null;
  }

  // ============================================
  // TUTORIAL ANALYTICS
  // ============================================
  
  private tutorialSessionId: string | null = null;
  
  // Get or create tutorial session ID
  private getTutorialSessionId(): string {
    if (!this.tutorialSessionId) {
      this.tutorialSessionId = `tut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    return this.tutorialSessionId;
  }
  
  // Track tutorial step
  async trackTutorialStep(
    step: string, 
    metadata?: { 
      bookId?: string;
      coinsEarned?: number;
      coinsDonated?: number;
    }
  ): Promise<void> {
    try {
      const user = authService.getUser();
      const userId = user?.email || user?._id || localStorage.getItem('godlykids_device_id') || `anon_${Date.now()}`;
      
      // Normalize API URL - remove trailing slash and /api to avoid double /api//api
      let API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
      API_BASE = API_BASE.replace(/\/+$/, '').replace(/\/api$/, '');
      const apiUrl = `${API_BASE}/api`;
      
      const platform = (window as any).__GK_IS_DESPIA__ ? 'ios' : 'web';
      
      await fetch(`${apiUrl}/analytics/tutorial/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId: this.getTutorialSessionId(),
          step,
          metadata: {
            ...metadata,
            platform,
          },
        }),
      });
      
      console.log(`📚 Tutorial step tracked: ${step}`, metadata);
    } catch (error) {
      console.error('Failed to track tutorial step:', error);
    }
  }
  
  // Reset tutorial session (call when tutorial completes or user skips)
  resetTutorialSession(): void {
    this.tutorialSessionId = null;
  }
}

export const activityTrackingService = new ActivityTrackingService();


