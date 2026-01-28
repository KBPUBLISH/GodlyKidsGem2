/**
 * Daily Session Service - "Godly Kids Time"
 * 
 * Manages the daily learning session flow:
 * 1. Daily Prayer
 * 2. Video Devotional
 * 3. Recommended Book (based on selected subjects)
 * 4. Celebration with coins
 */

import { getSavedPreferences, getPreferenceTags, SUBJECT_OPTIONS } from '../pages/InterestSelectionPage';

// Storage keys
const SESSION_STORAGE_KEY = 'godlykids_daily_session';
const SESSION_HISTORY_KEY = 'godlykids_session_history';

// Session step types
export type SessionStepType = 'scripture' | 'book' | 'discussion' | 'prayer';

export interface SessionStep {
  type: SessionStepType;
  label: string;
  icon: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  contentId?: string; // ID of the specific content (lesson/book)
  contentTitle?: string;
  coinsEarned: number;
}

export interface DailySession {
  date: string; // YYYY-MM-DD
  subjects: string[]; // Selected subject IDs for this session
  steps: SessionStep[];
  currentStepIndex: number;
  totalCoinsEarned: number;
  completed: boolean;
  startedAt?: number;
  completedAt?: number;
}

// Coin rewards for each step
const STEP_REWARDS = {
  scripture: 10, // Daily verse reflection
  book: 30, // Reading time
  discussion: 20, // Parent-child discussion
  prayer: 30, // Daily prayer
};

// Get today's date as YYYY-MM-DD
const getTodayDateKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Create a new daily session
export const createDailySession = (selectedSubjects?: string[]): DailySession => {
  // Archive any existing completed session before creating a new one
  const existingSession = getCurrentSession();
  if (existingSession?.completed) {
    archiveSession(existingSession);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  
  const subjects = selectedSubjects || getSavedPreferences();
  
  const session: DailySession = {
    date: getTodayDateKey(),
    subjects,
    steps: [
      {
        type: 'scripture',
        label: 'Scripture of the Day',
        icon: '📖',
        status: 'pending',
        coinsEarned: 0,
      },
      {
        type: 'book',
        label: 'Story Time',
        icon: '📚',
        status: 'pending',
        coinsEarned: 0,
      },
      {
        type: 'discussion',
        label: 'Discuss Together',
        icon: '💬',
        status: 'pending',
        coinsEarned: 0,
      },
      {
        type: 'prayer',
        label: 'Prayer Time',
        icon: '🙏',
        status: 'pending',
        coinsEarned: 0,
      },
    ],
    currentStepIndex: 0,
    totalCoinsEarned: 0,
    completed: false,
    startedAt: Date.now(),
  };
  
  // Save to localStorage
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  
  return session;
};

// Get current session (or null if none exists for today)
export const getCurrentSession = (): DailySession | null => {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return null;
    
    const session: DailySession = JSON.parse(saved);
    
    // Check if session is from today
    if (session.date !== getTodayDateKey()) {
      // Archive old session and return null
      archiveSession(session);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    
    return session;
  } catch (e) {
    console.error('Error reading session:', e);
    return null;
  }
};

// Check if today's session is completed
export const isSessionCompletedToday = (): boolean => {
  const session = getCurrentSession();
  return session?.completed ?? false;
};

// Check if a session exists for today (started but maybe not completed)
export const hasSessionToday = (): boolean => {
  const session = getCurrentSession();
  return session !== null;
};

// Get current step
export const getCurrentStep = (): SessionStep | null => {
  const session = getCurrentSession();
  if (!session) return null;
  return session.steps[session.currentStepIndex] || null;
};

// Mark current step as in-progress
export const startCurrentStep = (): void => {
  const session = getCurrentSession();
  if (!session) return;
  
  session.steps[session.currentStepIndex].status = 'in-progress';
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

// Complete current step and advance to next
export const completeCurrentStep = (coinsEarned?: number): DailySession | null => {
  const session = getCurrentSession();
  if (!session) return null;
  
  const step = session.steps[session.currentStepIndex];
  const reward = coinsEarned ?? STEP_REWARDS[step.type];
  
  // Update step
  step.status = 'completed';
  step.coinsEarned = reward;
  
  // Update session totals
  session.totalCoinsEarned += reward;
  
  // Check if this was the last step
  if (session.currentStepIndex >= session.steps.length - 1) {
    session.completed = true;
    session.completedAt = Date.now();
    archiveSession(session);
  } else {
    // Advance to next step
    session.currentStepIndex += 1;
  }
  
  // Save
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  
  return session;
};

// Skip current step and advance to next
export const skipCurrentStep = (): DailySession | null => {
  const session = getCurrentSession();
  if (!session) return null;
  
  const step = session.steps[session.currentStepIndex];
  step.status = 'skipped';
  step.coinsEarned = 0;
  
  // Check if this was the last step
  if (session.currentStepIndex >= session.steps.length - 1) {
    session.completed = true;
    session.completedAt = Date.now();
    archiveSession(session);
  } else {
    session.currentStepIndex += 1;
  }
  
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  
  return session;
};

// Set content for a step (e.g., which book was selected)
export const setStepContent = (stepIndex: number, contentId: string, contentTitle: string): void => {
  const session = getCurrentSession();
  if (!session || !session.steps[stepIndex]) return;
  
  session.steps[stepIndex].contentId = contentId;
  session.steps[stepIndex].contentTitle = contentTitle;
  
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

// Archive completed session to history
const archiveSession = (session: DailySession): void => {
  try {
    const historyJson = localStorage.getItem(SESSION_HISTORY_KEY);
    const history: DailySession[] = historyJson ? JSON.parse(historyJson) : [];
    
    // Add session to history (keep last 30 days)
    history.unshift(session);
    if (history.length > 30) {
      history.pop();
    }
    
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Error archiving session:', e);
  }
};

// Get session history
export const getSessionHistory = (): DailySession[] => {
  try {
    const historyJson = localStorage.getItem(SESSION_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (e) {
    console.error('Error reading session history:', e);
    return [];
  }
};

// Get current streak (consecutive days with completed sessions)
export const getSessionStreak = (): number => {
  const history = getSessionHistory();
  const todayKey = getTodayDateKey();
  
  let streak = 0;
  
  // Check if today's session is completed (either in current session or history)
  const currentSession = getCurrentSession();
  const todayInHistory = history.find(s => s.date === todayKey && s.completed);
  
  if (currentSession?.completed || todayInHistory) {
    streak = 1;
  } else {
    // If today isn't completed, no streak from today
    return 0;
  }
  
  // Count consecutive completed sessions going backwards from yesterday
  // Use Set to avoid counting same day twice
  const countedDates = new Set<string>([todayKey]);
  
  for (let daysBack = 1; daysBack <= 30; daysBack++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - daysBack);
    const checkDateKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    
    // Skip if already counted
    if (countedDates.has(checkDateKey)) continue;
    
    // Find completed session for this date
    const sessionForDay = history.find(s => s.date === checkDateKey && s.completed);
    
    if (sessionForDay) {
      streak++;
      countedDates.add(checkDateKey);
    } else {
      // Chain broken
      break;
    }
  }
  
  return streak;
};

// Get recommended book based on selected subjects
export const getRecommendedBookFilter = (): string[] => {
  const session = getCurrentSession();
  const subjects = session?.subjects || getSavedPreferences();
  
  // Get all tags from selected subjects
  const tags: string[] = [];
  subjects.forEach(subjectId => {
    const subject = SUBJECT_OPTIONS.find(s => s.id === subjectId);
    if (subject) {
      tags.push(...subject.tags);
    }
  });
  
  return [...new Set(tags)]; // Remove duplicates
};

// Exit/cancel the current session
export const exitSession = (): void => {
  const session = getCurrentSession();
  if (session) {
    // Mark session as incomplete but archive it
    session.completedAt = Date.now();
    archiveSession(session);
  }
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

// Reset session for today (for testing or retry)
export const resetTodaySession = (): void => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

// Check if user has ever completed at least one daily session
export const hasCompletedAnySession = (): boolean => {
  // Check session history for completed sessions
  const history = getSessionHistory();
  const hasCompletedHistory = history.some(session => session.completed);
  if (hasCompletedHistory) return true;
  
  // Also check if current session is completed
  const currentSession = getCurrentSession();
  return currentSession?.completed ?? false;
};
