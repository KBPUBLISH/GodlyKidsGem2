import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Check, Clock, Flame } from 'lucide-react';
import { isSessionCompletedToday, getSessionStreak, getSessionHistory, hasSessionToday, getCurrentSession } from '../../services/dailySessionService';

interface DailyLessonWidgetProps {
  onStartLesson?: (duration: number) => void;
}

// Get the days of the current week (Sun-Sat)
const getWeekDays = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const weekDays = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOfWeek + i);
    date.setHours(0, 0, 0, 0);
    weekDays.push(date);
  }
  
  return weekDays;
};

// Check if a specific date has a completed session
const isDateCompleted = (date: Date, history: any[]): boolean => {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return history.some(session => session.date === dateKey && session.completed);
};

const DailyLessonWidget: React.FC<DailyLessonWidgetProps> = ({ onStartLesson }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDuration, setSelectedDuration] = useState(10); // Default 10 minutes
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasInProgress, setHasInProgress] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);
  const [streak, setStreak] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);

  // Refresh session data whenever component mounts or route changes
  const refreshSessionData = useCallback(() => {
    const completed = isSessionCompletedToday();
    setIsCompleted(completed);
    setStreak(getSessionStreak());
    setSessionHistory(getSessionHistory());
    
    // Check if there's an in-progress session
    if (!completed && hasSessionToday()) {
      const session = getCurrentSession();
      if (session) {
        setHasInProgress(true);
        setCurrentStep(session.currentStepIndex);
        setTotalSteps(session.steps.length);
      }
    } else {
      setHasInProgress(false);
    }
  }, []);

  // Run on mount and whenever location changes (user navigates back)
  useEffect(() => {
    refreshSessionData();
  }, [location.pathname, refreshSessionData]);

  const handleStartLesson = () => {
    // Save selected duration for the session
    localStorage.setItem('godlykids_session_duration', selectedDuration.toString());
    
    if (onStartLesson) {
      onStartLesson(selectedDuration);
    }
    
    // If there's an in-progress session, continue it (no freshStart flag)
    // Otherwise start a new one with freshStart flag to show goal selection
    if (hasInProgress) {
      navigate('/daily-session');
    } else {
      navigate('/daily-session', { state: { freshStart: true } });
    }
  };

  const durations = [
    { value: 5, label: '5 min' },
    { value: 10, label: '10 min' },
    { value: 15, label: '15 min' },
  ];

  const weekDays = getWeekDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Weekly Streak Component
  const WeeklyStreak = () => (
    <div className="mt-6 pt-4 border-t border-[#8B4513]/20">
      <div className="flex items-center justify-center gap-1 mb-3">
        <Flame className="w-4 h-4 text-orange-500" />
        <span className="text-[#8B4513]/70 text-sm font-medium">
          {streak > 0 ? `${streak} Day Streak` : 'Start Your Streak!'}
        </span>
      </div>
      <div className="flex justify-center gap-2">
        {weekDays.map((date, index) => {
          const isToday = date.getTime() === today.getTime();
          const isPast = date < today;
          const isFuture = date > today;
          const completed = isToday ? isCompleted : isDateCompleted(date, sessionHistory);
          
          return (
            <div key={index} className="flex flex-col items-center gap-1">
              <span className="text-[#8B4513]/50 text-xs font-medium">{dayLabels[index]}</span>
              <div 
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center transition-all
                  ${completed 
                    ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-md' 
                    : isToday
                      ? 'bg-[#6B8E6B]/20 border-2 border-[#6B8E6B] text-[#6B8E6B]'
                      : isFuture
                        ? 'bg-[#e8e0d0] text-[#8B4513]/30'
                        : 'bg-[#e8e0d0] text-[#8B4513]/50'
                  }
                `}
              >
                {completed ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold">{date.getDate()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Scroll background style - scale up to make scroll bigger
  const scrollBackground = {
    backgroundImage: 'url(/daily-session/scroll-bg.png)',
    backgroundSize: '115% auto',
    backgroundPosition: 'center top',
    backgroundRepeat: 'no-repeat',
  };

  // Completed state
  if (isCompleted) {
    return (
      <div className="-mx-4 -mt-20 mb-6">
        <div className="rounded-b-[2.5rem] pt-24 pb-10 px-8 shadow-xl bg-white relative overflow-hidden">
          {/* Decorative cloud wave at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30">
            <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,30 Q100,60 200,30 T400,30 L400,60 L0,60 Z" fill="#E8F4F8" />
            </svg>
          </div>
          
          {/* Completed badge */}
          <div className="flex items-center justify-center gap-2 mb-4 relative z-10">
            <div className="bg-green-500 rounded-full p-1.5">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-green-600 font-medium">Complete!</span>
          </div>
          
          <div className="text-center relative z-10">
            <h2 className="text-[#2D2D2D] font-display font-bold text-3xl leading-tight mb-8">
              Today's Godly Kids<br />Lesson
            </h2>
            
            <button
              onClick={() => navigate('/daily-session')}
              className="w-full bg-[#5A8A8A] hover:bg-[#4A7A7A] text-white font-display font-bold text-xl py-5 rounded-2xl shadow-md transition-all active:scale-[0.98]"
            >
              Review Lesson
            </button>
          </div>

          {/* Lesson Flow Indicator */}
          <div className="mt-8 flex items-center justify-center gap-3 text-[#5A5A5A] text-sm relative z-10">
            <span className="font-medium">Scripture</span>
            <span>→</span>
            <span className="font-medium">Story</span>
            <span>→</span>
            <span className="font-medium">Discuss</span>
            <span>→</span>
            <span className="font-medium">Pray</span>
          </div>
          
          {/* Weekly Streak */}
          <div className="relative z-10">
            <WeeklyStreak />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -mt-20 mb-6">
      <div className="rounded-b-[2.5rem] pt-24 pb-10 px-8 shadow-xl bg-white relative overflow-hidden">
        {/* Decorative cloud wave at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30">
          <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,30 Q100,60 200,30 T400,30 L400,60 L0,60 Z" fill="#E8F4F8" />
          </svg>
        </div>
        
        {/* Header */}
        <div className="text-center mb-8 relative z-10">
          <h2 className="text-[#2D2D2D] font-display font-bold text-3xl leading-tight">
            Today's Godly Kids<br />Lesson
          </h2>
          {hasInProgress && (
            <p className="text-[#5A8A8A] text-sm mt-2 font-medium">
              Step {currentStep + 1} of {totalSteps} in progress
            </p>
          )}
        </div>

        {/* Start/Continue Button */}
        <button
          onClick={handleStartLesson}
          className="w-full bg-[#1B8BB8] hover:bg-[#157A9E] text-white font-display font-bold text-lg py-4 rounded-full shadow-lg transition-all active:scale-[0.98] relative z-10"
        >
          {hasInProgress ? 'Continue Adventure' : 'Start Lesson Adventure'}
        </button>

        {/* Lesson Flow Indicator */}
        <div className="mt-8 flex items-center justify-center gap-3 text-[#5A5A5A] text-sm relative z-10">
          <span className="font-medium">Scripture</span>
          <span>→</span>
          <span className="font-medium">Story</span>
          <span>→</span>
          <span className="font-medium">Discuss</span>
          <span>→</span>
          <span className="font-medium">Pray</span>
        </div>
        
        {/* Weekly Streak */}
        <div className="relative z-10">
          <WeeklyStreak />
        </div>
      </div>
    </div>
  );
};

export default DailyLessonWidget;
