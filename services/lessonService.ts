/**
 * Service for managing lesson completions, streaks, and weekly resets PER PROFILE
 * Supports multiple lessons per day (Mon-Sat, Sunday is rest day)
 */
import { profileService } from './profileService';

interface LessonCompletion {
    lessonId: string;
    completedAt: number; // timestamp
    weekStart: number; // timestamp of Monday midnight for the week
    dayIndex: number; // 0-5 for Mon-Sat
    correctAnswers?: number; // number of correct quiz answers
    coinsEarned?: number; // total coins earned from this lesson
}

interface DayProgress {
    dayIndex: number; // 0-5 for Mon-Sat
    totalLessons: number;
    completedLessons: number;
    isComplete: boolean;
}

const BASE_COMPLETIONS_KEY = 'godlykids_lesson_completions';
const BASE_STREAK_KEY = 'godlykids_lesson_streak';
const BASE_WEEK_START_KEY = 'godlykids_last_week_start';
const BASE_SELECTED_DAY_KEY = 'godlykids_selected_day';

// Get profile-specific keys
const getCompletionsKey = () => profileService.getProfileKey(BASE_COMPLETIONS_KEY);
const getStreakKey = () => profileService.getProfileKey(BASE_STREAK_KEY);
const getWeekStartKey = () => profileService.getProfileKey(BASE_WEEK_START_KEY);
const getSelectedDayKey = () => profileService.getProfileKey(BASE_SELECTED_DAY_KEY);

/**
 * Get the current day index (0-4 for Mon-Fri, -1 for weekend)
 */
export const getTodayIndex = (): number => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Weekend (Saturday = 6, Sunday = 0) = -1 (rest days)
    // Mon-Fri = 0-4
    if (dayOfWeek === 0 || dayOfWeek === 6) return -1;
    return dayOfWeek - 1; // Monday = 0, Tuesday = 1, ..., Friday = 4
};

/**
 * Get the selected day index (defaults to today or Friday if weekend)
 */
export const getSelectedDay = (): number => {
    const saved = localStorage.getItem(getSelectedDayKey());
    if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 0 && parsed <= 4) return parsed;
    }
    
    // Default to today's index, or Friday if weekend
    const todayIndex = getTodayIndex();
    return todayIndex === -1 ? 4 : todayIndex; // If weekend, default to Friday
};

/**
 * Set the selected day index
 */
export const setSelectedDay = (dayIndex: number): void => {
    if (dayIndex >= 0 && dayIndex <= 4) {
        localStorage.setItem(getSelectedDayKey(), dayIndex.toString());
    }
};

/**
 * Get lessons for a specific day of the week
 */
export const getLessonsForDay = (lessons: any[], dayIndex: number): any[] => {
    const monday = getMondayOfWeek();
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayIndex);
    targetDate.setHours(0, 0, 0, 0);
    
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    return lessons.filter(lesson => {
        if (!lesson.scheduledDate) return false;
        const scheduled = new Date(lesson.scheduledDate);
        scheduled.setHours(0, 0, 0, 0);
        const scheduledStr = scheduled.toISOString().split('T')[0];
        return scheduledStr === targetDateStr;
    });
};

/**
 * Get progress for all 5 days (Mon-Fri)
 */
export const getWeekProgress = (lessons: any[]): DayProgress[] => {
    const progress: DayProgress[] = [];
    
    for (let i = 0; i < 5; i++) {
        const dayLessons = getLessonsForDay(lessons, i);
        const completedCount = dayLessons.filter(l => isCompleted(l._id || l.id)).length;
        
        progress.push({
            dayIndex: i,
            totalLessons: dayLessons.length,
            completedLessons: completedCount,
            isComplete: dayLessons.length > 0 && completedCount === dayLessons.length,
        });
    }
    
    return progress;
};

/**
 * Check if a specific day is fully completed
 */
export const isDayComplete = (lessons: any[], dayIndex: number): boolean => {
    const dayLessons = getLessonsForDay(lessons, dayIndex);
    if (dayLessons.length === 0) return false;
    return dayLessons.every(l => isCompleted(l._id || l.id));
};

/**
 * Get completion percentage for a specific day
 */
export const getDayCompletionPercent = (lessons: any[], dayIndex: number): number => {
    const dayLessons = getLessonsForDay(lessons, dayIndex);
    if (dayLessons.length === 0) return 0;
    const completedCount = dayLessons.filter(l => isCompleted(l._id || l.id)).length;
    return Math.round((completedCount / dayLessons.length) * 100);
};

/**
 * Get the start of the current week (Monday midnight in user's local time)
 * Week runs Monday to Sunday, resets at midnight Sunday -> Monday
 */
export const getWeekStart = (date: Date = new Date()): number => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to subtract to get to Monday
    // If Sunday (0), go back 6 days. Otherwise go back (day - 1) days.
    const daysToMonday = day === 0 ? 6 : day - 1;
    
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0); // Midnight
    
    return monday.getTime();
};

/**
 * Get Monday of the current week as a Date object
 */
export const getMondayOfWeek = (date: Date = new Date()): Date => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to subtract to get to Monday
    const daysToMonday = day === 0 ? 6 : day - 1;
    
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    
    return monday;
};

/**
 * Get all 7 days of the current week (Monday through Sunday)
 */
export const getWeekDays = (): Date[] => {
    const monday = getMondayOfWeek();
    const weekDays: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        weekDays.push(day);
    }
    
    return weekDays;
};

/**
 * Check if we need to reset the streak (new week started)
 */
export const checkAndResetStreak = (): boolean => {
    const lastWeekStart = localStorage.getItem(getWeekStartKey());
    const currentWeekStart = getWeekStart();
    
    if (!lastWeekStart || parseInt(lastWeekStart) !== currentWeekStart) {
        // New week - reset streak
        localStorage.setItem(getWeekStartKey(), currentWeekStart.toString());
        localStorage.removeItem(getStreakKey());
        return true;
    }
    
    return false;
};

/**
 * Get all lesson completions for current profile
 */
export const getCompletions = (): LessonCompletion[] => {
    try {
        const saved = localStorage.getItem(getCompletionsKey());
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
    coinsEarned: number = 0,
    dayIndex?: number
): void => {
    const completions = getCompletions();
    const weekStart = getWeekStart();
    
    // Determine day index if not provided
    const actualDayIndex = dayIndex !== undefined ? dayIndex : getTodayIndex();
    const safeDayIndex = actualDayIndex === -1 ? 4 : actualDayIndex; // If weekend, use Friday
    
    // Remove existing completion for this lesson if any
    const filtered = completions.filter(c => c.lessonId !== lessonId);
    
    // Add new completion
    const newCompletion: LessonCompletion = {
        lessonId,
        completedAt: Date.now(),
        weekStart,
        dayIndex: safeDayIndex,
        correctAnswers,
        coinsEarned,
    };
    
    localStorage.setItem(getCompletionsKey(), JSON.stringify([...filtered, newCompletion]));
    
    // Update streak
    updateStreak(weekStart);
};

/**
 * Update streak count for current week
 */
const updateStreak = (weekStart: number): void => {
    const streakData = localStorage.getItem(getStreakKey());
    let streak = streakData ? JSON.parse(streakData) : { weekStart, count: 0 };
    
    // Reset if new week
    if (streak.weekStart !== weekStart) {
        streak = { weekStart, count: 0 };
    }
    
    // Increment streak
    streak.count += 1;
    localStorage.setItem(getStreakKey(), JSON.stringify(streak));
};

/**
 * Get current streak count for this week
 */
export const getStreak = (): number => {
    checkAndResetStreak(); // Check if new week
    
    const streakData = localStorage.getItem(getStreakKey());
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
