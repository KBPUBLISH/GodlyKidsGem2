import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Check, Clock, Flame } from 'lucide-react';
import { isSessionCompletedToday, getSessionStreak, getSessionHistory } from '../../services/dailySessionService';

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
  const [selectedDuration, setSelectedDuration] = useState(10); // Default 10 minutes
  const [isCompleted, setIsCompleted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);

  useEffect(() => {
    setIsCompleted(isSessionCompletedToday());
    setStreak(getSessionStreak());
    setSessionHistory(getSessionHistory());
  }, []);

  const handleStartLesson = () => {
    // Save selected duration for the session
    localStorage.setItem('godlykids_session_duration', selectedDuration.toString());
    
    if (onStartLesson) {
      onStartLesson(selectedDuration);
    }
    
    navigate('/daily-session');
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

  // Completed state
  if (isCompleted) {
    return (
      <div className="mx-4 mb-6">
        <div className="bg-[#f5f0e1] rounded-2xl p-8 shadow-lg border-4 border-[#8B4513]/30 relative overflow-hidden">
          {/* Completed badge */}
          <div className="absolute top-4 right-4 bg-green-500 rounded-full p-1.5">
            <Check className="w-5 h-5 text-white" />
          </div>
          
          <div className="text-center py-2">
            <h2 className="text-[#5D4037] font-display font-bold text-2xl mb-2">
              Today's Lesson Complete!
            </h2>
            
            <button
              onClick={() => navigate('/daily-session')}
              className="text-[#8B4513] text-base underline"
            >
              Review today's lesson →
            </button>
          </div>

          {/* Weekly Streak */}
          <WeeklyStreak />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-6">
      <div className="bg-[#f5f0e1] rounded-2xl p-8 shadow-lg border-4 border-[#8B4513]/30 relative overflow-hidden">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-[#5D4037] font-display font-bold text-2xl">
            Today's Godly Kids Lesson
          </h2>
        </div>

        {/* Duration Selector */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-[#8B4513]/60" />
            <span className="text-[#8B4513]/60 text-sm font-medium">Select Duration</span>
          </div>
          
          <div className="flex justify-center gap-3">
            {durations.map((d) => (
              <button
                key={d.value}
                onClick={() => setSelectedDuration(d.value)}
                className={`
                  px-6 py-3 rounded-xl font-display font-bold text-base transition-all
                  ${selectedDuration === d.value
                    ? 'bg-[#6B8E6B] text-white shadow-md scale-105'
                    : 'bg-[#e8e0d0] text-[#5D4037] hover:bg-[#d8d0c0]'
                  }
                `}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartLesson}
          className="w-full bg-[#6B8E6B] hover:bg-[#5A7D5A] text-white font-display font-bold text-xl py-5 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Start Lesson
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Lesson Flow Indicator */}
        <div className="mt-4 flex items-center justify-center gap-3 text-[#8B4513]/60 text-base">
          <span className="font-medium">Story</span>
          <span>→</span>
          <span className="font-medium">Discuss</span>
          <span>→</span>
          <span className="font-medium">Pray</span>
        </div>

        {/* Weekly Streak */}
        <WeeklyStreak />
      </div>
    </div>
  );
};

export default DailyLessonWidget;
