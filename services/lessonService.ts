/**
 * Service for managing lesson completions, streaks, and weekly resets PER PROFILE
 */
import { profileService } from './profileService';

interface LessonCompletion {
    lessonId: string;
    completedAt: number; // timestamp
    weekStart: number; // timestamp of Monday midnight for the week
    correctAnswers?: number; // number of correct quiz answers
    coinsEarned?: number; // total coins earned from this lesson
}

const BASE_COMPLETIONS_KEY = 'godlykids_lesson_completions';
const BASE_STREAK_KEY = 'godlykids_lesson_streak';
const BASE_WEEK_START_KEY = 'godlykids_last_week_start';

// Get profile-specific keys
const getCompletionsKey = () => profileService.getProfileKey(BASE_COMPLETIONS_KEY);
const getStreakKey = () => profileService.getProfileKey(BASE_STREAK_KEY);
const getWeekStartKey = () => profileService.getProfileKey(BASE_WEEK_START_KEY);

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

/**
 * Get today's index (0 = Monday, 6 = Sunday)
 */
export const getTodayIndex = (): number => {
    const day = new Date().getDay();
    // Convert from Sunday=0 to Monday=0
    return day === 0 ? 6 : day - 1;
};

const SELECTED_DAY_KEY = 'godlykids_selected_day';

/**
 * Get the currently selected day index (defaults to today)
 */
export const getSelectedDay = (): number => {
    try {
        const saved = sessionStorage.getItem(SELECTED_DAY_KEY);
        if (saved !== null) {
            return parseInt(saved, 10);
        }
    } catch (e) {
        // Ignore
    }
    return getTodayIndex();
};

/**
 * Set the selected day index
 */
export const setSelectedDay = (dayIndex: number): void => {
    try {
        sessionStorage.setItem(SELECTED_DAY_KEY, dayIndex.toString());
    } catch (e) {
        // Ignore
    }
};

/**
 * Get lessons for a specific day of the week
 */
export const getLessonsForDay = (lessons: any[], dayIndex: number): any[] => {
    const weekDays = getWeekDays();
    const targetDate = weekDays[dayIndex];
    
    if (!targetDate) return [];
    
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    return lessons.filter(lesson => {
        if (!lesson.scheduledDate) return false;
        const lessonDateStr = new Date(lesson.scheduledDate).toISOString().split('T')[0];
        return lessonDateStr === targetDateStr;
    });
};

/**
 * Check if all lessons for a day are complete
 */
export const isDayComplete = (lessons: any[], dayIndex: number): boolean => {
    const dayLessons = getLessonsForDay(lessons, dayIndex);
    if (dayLessons.length === 0) return false;
    return dayLessons.every(lesson => isCompleted(lesson._id || lesson.id));
};

// All functions are exported as named exports above
// No default export to avoid circular dependency issues
