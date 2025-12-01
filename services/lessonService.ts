/**
 * Service for managing lesson completions, streaks, and weekly resets
 */

interface LessonCompletion {
    lessonId: string;
    completedAt: number; // timestamp
    weekStart: number; // timestamp of Sunday midnight for the week
    correctAnswers?: number; // number of correct quiz answers
    coinsEarned?: number; // total coins earned from this lesson
}

const STORAGE_KEY = 'godlykids_lesson_completions';
const STREAK_STORAGE_KEY = 'godlykids_lesson_streak';

/**
 * Get the start of the current week (Sunday midnight in user's local time)
 */
export const getWeekStart = (date: Date = new Date()): number => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = d.getDate() - day; // Days to subtract to get to Sunday
    
    const sunday = new Date(d);
    sunday.setDate(diff);
    sunday.setHours(0, 0, 0, 0); // Midnight
    
    return sunday.getTime();
};

/**
 * Check if we need to reset the streak (new week started)
 */
export const checkAndResetStreak = (): boolean => {
    const lastWeekStart = localStorage.getItem('godlykids_last_week_start');
    const currentWeekStart = getWeekStart();
    
    if (!lastWeekStart || parseInt(lastWeekStart) !== currentWeekStart) {
        // New week - reset streak
        localStorage.setItem('godlykids_last_week_start', currentWeekStart.toString());
        localStorage.removeItem(STREAK_STORAGE_KEY);
        return true;
    }
    
    return false;
};

/**
 * Get all lesson completions
 */
export const getCompletions = (): LessonCompletion[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Failed to load lesson completions', e);
        return [];
    }
};

/**
 * Get completion for a specific lesson
 */
export const getCompletion = (lessonId: string): LessonCompletion | null => {
    const completions = getCompletions();
    return completions.find(c => c.lessonId === lessonId) || null;
};

/**
 * Check if a lesson is completed
 */
export const isCompleted = (lessonId: string): boolean => {
    return getCompletion(lessonId) !== null;
};

/**
 * Mark a lesson as completed
 */
export const markCompleted = (
    lessonId: string,
    correctAnswers: number = 0,
    coinsEarned: number = 0
): void => {
    const completions = getCompletions();
    const weekStart = getWeekStart();
    
    // Remove existing completion for this lesson if any
    const filtered = completions.filter(c => c.lessonId !== lessonId);
    
    // Add new completion
    const newCompletion: LessonCompletion = {
        lessonId,
        completedAt: Date.now(),
        weekStart,
        correctAnswers,
        coinsEarned,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...filtered, newCompletion]));
    
    // Update streak
    updateStreak(weekStart);
};

/**
 * Update streak count for current week
 */
const updateStreak = (weekStart: number): void => {
    const streakData = localStorage.getItem(STREAK_STORAGE_KEY);
    let streak = streakData ? JSON.parse(streakData) : { weekStart, count: 0 };
    
    // Reset if new week
    if (streak.weekStart !== weekStart) {
        streak = { weekStart, count: 0 };
    }
    
    // Increment streak
    streak.count += 1;
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streak));
};

/**
 * Get current streak count for this week
 */
export const getStreak = (): number => {
    checkAndResetStreak(); // Check if new week
    
    const streakData = localStorage.getItem(STREAK_STORAGE_KEY);
    if (!streakData) return 0;
    
    const streak = JSON.parse(streakData);
    const currentWeekStart = getWeekStart();
    
    // Reset if different week
    if (streak.weekStart !== currentWeekStart) {
        return 0;
    }
    
    return streak.count || 0;
};

/**
 * Get completions for current week
 */
export const getWeekCompletions = (): LessonCompletion[] => {
    const currentWeekStart = getWeekStart();
    const completions = getCompletions();
    return completions.filter(c => c.weekStart === currentWeekStart);
};

/**
 * Get lessons scheduled for the next 7 days
 */
export const getScheduledLessonsForWeek = (lessons: any[]): any[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    
    return lessons.filter(lesson => {
        if (!lesson.scheduledDate) return false;
        const scheduled = new Date(lesson.scheduledDate);
        scheduled.setHours(0, 0, 0, 0);
        return scheduled >= today && scheduled <= sevenDaysLater;
    });
};

/**
 * Check if a lesson is locked (scheduled for future)
 */
export const isLocked = (lesson: any): boolean => {
    if (!lesson.scheduledDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const scheduled = new Date(lesson.scheduledDate);
    scheduled.setHours(0, 0, 0, 0);
    
    return scheduled > today;
};

/**
 * Get lesson status: 'available', 'locked', 'completed'
 */
export const getLessonStatus = (lesson: any): 'available' | 'locked' | 'completed' => {
    if (isCompleted(lesson._id || lesson.id)) {
        return 'completed';
    }
    if (isLocked(lesson)) {
        return 'locked';
    }
    return 'available';
};

// All functions are exported as named exports above
// No default export to avoid circular dependency issues

