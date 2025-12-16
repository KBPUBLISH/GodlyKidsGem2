// Analytics Service - Tracks user events and sends them to the backend

import { getApiBaseUrl } from './apiService';

// Throttle duplicate events within a short time window
const recentEvents: Map<string, number> = new Map();
const EVENT_THROTTLE_MS = 5000; // 5 seconds

const shouldThrottle = (eventKey: string): boolean => {
    const now = Date.now();
    const lastTime = recentEvents.get(eventKey);
    
    if (lastTime && now - lastTime < EVENT_THROTTLE_MS) {
        return true; // Throttle - too soon
    }
    
    recentEvents.set(eventKey, now);
    
    // Clean up old entries periodically
    if (recentEvents.size > 100) {
        const cutoff = now - EVENT_THROTTLE_MS * 2;
        for (const [key, time] of recentEvents) {
            if (time < cutoff) recentEvents.delete(key);
        }
    }
    
    return false;
};

// Generate or retrieve session ID
const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
};

// Get user ID (from localStorage or generate anonymous ID)
const getUserId = (): string => {
    let userId = localStorage.getItem('analytics_user_id');
    if (!userId) {
        userId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('analytics_user_id', userId);
    }
    return userId;
};

// Get current kid profile ID if any
const getKidProfileId = (): string | null => {
    const profileId = localStorage.getItem('currentProfileId');
    return profileId && profileId !== 'null' ? profileId : null;
};

// Detect platform
const getPlatform = (): 'web' | 'ios' | 'android' | 'unknown' => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check for DeSpia/native wrapper indicators
    if ((window as any).webkit?.messageHandlers?.despia || 
        (window as any).DeSpia || 
        userAgent.includes('despia')) {
        // Could be wrapped in iOS or Android
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            return 'ios';
        }
        if (userAgent.includes('android')) {
            return 'android';
        }
    }
    
    return 'web';
};

// Detect device type
const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' | 'unknown' => {
    const userAgent = navigator.userAgent.toLowerCase();
    const screenWidth = window.innerWidth;
    
    if (userAgent.includes('ipad') || (screenWidth >= 768 && screenWidth < 1024)) {
        return 'tablet';
    }
    if (userAgent.includes('mobile') || userAgent.includes('iphone') || userAgent.includes('android')) {
        return 'mobile';
    }
    if (screenWidth >= 1024) {
        return 'desktop';
    }
    return 'unknown';
};

// Session start time tracking
let sessionStartTime: number | null = null;

// Track an event
interface TrackEventParams {
    eventType: string;
    targetType?: 'book' | 'playlist' | 'audio' | 'lesson' | 'quiz' | 'game' | 'coloring' | 'devotional' | 'voice' | 'shop_item' | 'feature' | null;
    targetId?: string;
    targetTitle?: string;
    metadata?: Record<string, any>;
}

export const analyticsService = {
    /**
     * Track a generic event (throttled to prevent duplicates)
     */
    track: async ({
        eventType,
        targetType,
        targetId,
        targetTitle,
        metadata,
    }: TrackEventParams): Promise<void> => {
        try {
            // Create a key for throttling - same event type + target within 5s is ignored
            const eventKey = `${eventType}_${targetType || ''}_${targetId || ''}`;
            if (shouldThrottle(eventKey)) {
                return; // Skip duplicate event
            }

            const baseUrl = getApiBaseUrl();
            const payload = {
                userId: getUserId(),
                kidProfileId: getKidProfileId(),
                sessionId: getSessionId(),
                eventType,
                targetType,
                targetId,
                targetTitle,
                metadata: metadata || {},
                platform: getPlatform(),
                deviceType: getDeviceType(),
                appVersion: '1.0.0',
            };

            // Fire and forget - don't await or block on analytics
            fetch(`${baseUrl}analytics/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }).catch(err => {
                console.warn('Analytics track failed (non-blocking):', err.message);
            });
        } catch (error) {
            // Don't throw - analytics should never break the app
            console.warn('Analytics track error:', error);
        }
    },

    // ==========================================
    // SESSION EVENTS
    // ==========================================

    /**
     * Track session start - call when app loads
     */
    sessionStart: () => {
        sessionStartTime = Date.now();
        analyticsService.track({ eventType: 'session_start' });
    },

    /**
     * Track session end - call when app closes/backgrounded
     */
    sessionEnd: () => {
        const duration = sessionStartTime 
            ? Math.round((Date.now() - sessionStartTime) / 1000) 
            : 0;
        analyticsService.track({ 
            eventType: 'session_end',
            metadata: { duration }
        });
    },

    // ==========================================
    // CONTENT EVENTS
    // ==========================================

    /**
     * Track book view (when user opens a book)
     */
    bookView: (bookId: string, title?: string) => {
        analyticsService.track({
            eventType: 'book_view',
            targetType: 'book',
            targetId: bookId,
            targetTitle: title,
        });
    },

    /**
     * Track book read complete (when user finishes the book)
     */
    bookReadComplete: (bookId: string, title?: string) => {
        analyticsService.track({
            eventType: 'book_read_complete',
            targetType: 'book',
            targetId: bookId,
            targetTitle: title,
        });
    },

    /**
     * Track book reading progress (when user exits book or navigates away)
     * Used to calculate average completion rate
     */
    bookReadProgress: (bookId: string, pagesViewed: number, totalPages: number, currentPage: number, title?: string) => {
        analyticsService.track({
            eventType: 'book_read_progress',
            targetType: 'book',
            targetId: bookId,
            targetTitle: title,
            metadata: {
                pagesViewed,
                totalPages,
                currentPage,
                completionPercent: Math.round((currentPage / totalPages) * 100),
            },
        });
    },

    /**
     * Track book like
     */
    bookLike: (bookId: string, title?: string) => {
        analyticsService.track({
            eventType: 'book_like',
            targetType: 'book',
            targetId: bookId,
            targetTitle: title,
        });
    },

    /**
     * Track book unlike
     */
    bookUnlike: (bookId: string, title?: string) => {
        analyticsService.track({
            eventType: 'book_unlike',
            targetType: 'book',
            targetId: bookId,
            targetTitle: title,
        });
    },

    /**
     * Track book favorite
     */
    bookFavorite: (bookId: string, title?: string) => {
        analyticsService.track({
            eventType: 'book_favorite',
            targetType: 'book',
            targetId: bookId,
            targetTitle: title,
        });
    },

    /**
     * Track book unfavorite
     */
    bookUnfavorite: (bookId: string, title?: string) => {
        analyticsService.track({
            eventType: 'book_unfavorite',
            targetType: 'book',
            targetId: bookId,
            targetTitle: title,
        });
    },

    /**
     * Track playlist view
     */
    playlistView: (playlistId: string, title?: string) => {
        analyticsService.track({
            eventType: 'playlist_view',
            targetType: 'playlist',
            targetId: playlistId,
            targetTitle: title,
        });
    },

    /**
     * Track playlist play
     */
    playlistPlay: (playlistId: string, title?: string) => {
        analyticsService.track({
            eventType: 'playlist_play',
            targetType: 'playlist',
            targetId: playlistId,
            targetTitle: title,
        });
    },

    /**
     * Track audio item play
     */
    audioPlay: (audioId: string, title?: string, playlistId?: string) => {
        analyticsService.track({
            eventType: 'audio_play',
            targetType: 'audio',
            targetId: audioId,
            targetTitle: title,
            metadata: { playlistId },
        });
    },

    /**
     * Track playlist like
     */
    playlistLike: (playlistId: string, title?: string) => {
        analyticsService.track({
            eventType: 'playlist_like',
            targetType: 'playlist',
            targetId: playlistId,
            targetTitle: title,
        });
    },

    /**
     * Track playlist favorite
     */
    playlistFavorite: (playlistId: string, title?: string) => {
        analyticsService.track({
            eventType: 'playlist_favorite',
            targetType: 'playlist',
            targetId: playlistId,
            targetTitle: title,
        });
    },

    /**
     * Track lesson view
     */
    lessonView: (lessonId: string, title?: string) => {
        analyticsService.track({
            eventType: 'lesson_view',
            targetType: 'lesson',
            targetId: lessonId,
            targetTitle: title,
        });
    },

    /**
     * Track lesson complete
     */
    lessonComplete: (lessonId: string, title?: string) => {
        analyticsService.track({
            eventType: 'lesson_complete',
            targetType: 'lesson',
            targetId: lessonId,
            targetTitle: title,
        });
    },

    // ==========================================
    // FEATURE EVENTS
    // ==========================================

    /**
     * Track quiz start
     */
    quizStart: (bookId: string, bookTitle?: string) => {
        analyticsService.track({
            eventType: 'quiz_start',
            targetType: 'book',
            targetId: bookId,
            targetTitle: bookTitle,
        });
    },

    /**
     * Track quiz answer
     */
    quizAnswer: (bookId: string, questionIndex: number, correct: boolean) => {
        analyticsService.track({
            eventType: 'quiz_answer',
            targetType: 'quiz',
            targetId: bookId,
            metadata: { questionIndex, correct },
        });
    },

    /**
     * Track quiz complete
     */
    quizComplete: (bookId: string, score: number, totalQuestions: number, coinsEarned: number) => {
        analyticsService.track({
            eventType: 'quiz_complete',
            targetType: 'book',
            targetId: bookId,
            metadata: { score, totalQuestions, coinsEarned },
        });
    },

    /**
     * Track coloring start
     */
    coloringStart: (bookId: string, bookTitle?: string) => {
        analyticsService.track({
            eventType: 'coloring_start',
            targetType: 'book',
            targetId: bookId,
            targetTitle: bookTitle,
        });
    },

    /**
     * Track coloring complete
     */
    coloringComplete: (bookId: string, bookTitle?: string) => {
        analyticsService.track({
            eventType: 'coloring_complete',
            targetType: 'book',
            targetId: bookId,
            targetTitle: bookTitle,
        });
    },

    /**
     * Track game unlock
     */
    gameUnlock: (bookId: string, gameId: string) => {
        analyticsService.track({
            eventType: 'game_unlock',
            targetType: 'book',
            targetId: bookId,
            metadata: { gameId },
        });
    },

    /**
     * Track game open
     */
    gameOpen: (gameId: string, gameName?: string, bookId?: string) => {
        analyticsService.track({
            eventType: 'game_open',
            targetType: 'game',
            targetId: gameId,
            targetTitle: gameName,
            metadata: { bookId },
        });
    },

    /**
     * Track devotional view
     */
    devotionalView: (devotionalId?: string) => {
        analyticsService.track({
            eventType: 'devotional_view',
            targetType: 'devotional',
            targetId: devotionalId,
        });
    },

    /**
     * Track devotional complete
     */
    devotionalComplete: (devotionalId?: string) => {
        analyticsService.track({
            eventType: 'devotional_complete',
            targetType: 'devotional',
            targetId: devotionalId,
        });
    },

    // ==========================================
    // ONBOARDING & CONVERSION EVENTS
    // ==========================================

    /**
     * Track onboarding start
     */
    onboardingStart: () => {
        analyticsService.track({ eventType: 'onboarding_start' });
    },

    /**
     * Track onboarding step completion
     */
    onboardingStep: (step: number, stepName: string) => {
        analyticsService.track({
            eventType: 'onboarding_step',
            metadata: { step, stepName },
        });
    },

    /**
     * Track onboarding complete
     */
    onboardingComplete: () => {
        analyticsService.track({ eventType: 'onboarding_complete' });
    },

    /**
     * Track onboarding skip
     */
    onboardingSkip: (step: number) => {
        analyticsService.track({
            eventType: 'onboarding_skip',
            metadata: { step },
        });
    },

    /**
     * Track paywall view
     */
    paywallView: (source?: string) => {
        analyticsService.track({
            eventType: 'paywall_view',
            metadata: { source },
        });
    },

    /**
     * Track subscription start
     */
    subscriptionStart: (plan: 'monthly' | 'annual') => {
        analyticsService.track({
            eventType: 'subscription_start',
            metadata: { plan },
        });
    },

    /**
     * Track subscription cancel
     */
    subscriptionCancel: () => {
        analyticsService.track({ eventType: 'subscription_cancel' });
    },

    // ==========================================
    // ACCOUNT EVENTS
    // ==========================================

    /**
     * Track signup
     */
    signup: () => {
        analyticsService.track({ eventType: 'signup' });
    },

    /**
     * Track login
     */
    login: () => {
        analyticsService.track({ eventType: 'login' });
    },

    /**
     * Track kid profile creation
     */
    kidProfileCreate: (kidAge?: number) => {
        analyticsService.track({
            eventType: 'kid_profile_create',
            metadata: { age: kidAge },
        });
    },

    /**
     * Track voice unlock
     */
    voiceUnlock: (voiceId: string, voiceName?: string) => {
        analyticsService.track({
            eventType: 'voice_unlock',
            targetType: 'voice',
            targetId: voiceId,
            targetTitle: voiceName,
        });
    },

    /**
     * Track shop purchase
     */
    shopPurchase: (itemId: string, itemType: string, cost: number) => {
        analyticsService.track({
            eventType: 'shop_purchase',
            targetType: 'shop_item',
            targetId: itemId,
            metadata: { itemType, cost },
        });
    },
};

// Auto-initialize session on import
if (typeof window !== 'undefined') {
    // Track session start on page load
    analyticsService.sessionStart();

    // Track session end on page unload
    window.addEventListener('beforeunload', () => {
        analyticsService.sessionEnd();
    });

    // Also track on visibility change (for mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            analyticsService.sessionEnd();
        } else if (document.visibilityState === 'visible') {
            analyticsService.sessionStart();
        }
    });
}

export default analyticsService;

