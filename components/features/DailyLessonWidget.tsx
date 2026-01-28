import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Check, Clock, Flame } from 'lucide-react';
import { isSessionCompletedToday, getSessionStreak } from '../../services/dailySessionService';

interface DailyLessonWidgetProps {
  onStartLesson?: (duration: number) => void;
}

const DailyLessonWidget: React.FC<DailyLessonWidgetProps> = ({ onStartLesson }) => {
  const navigate = useNavigate();
  const [selectedDuration, setSelectedDuration] = useState(10); // Default 10 minutes
  const [isCompleted, setIsCompleted] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setIsCompleted(isSessionCompletedToday());
    setStreak(getSessionStreak());
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

  // Completed state
  if (isCompleted) {
    return (
      <div className="mx-4 mb-6">
        <div className="bg-[#f5f0e1] rounded-2xl p-8 shadow-lg border-4 border-[#8B4513]/30 relative overflow-hidden">
          {/* Completed badge */}
          <div className="absolute top-4 right-4 bg-green-500 rounded-full p-1.5">
            <Check className="w-5 h-5 text-white" />
          </div>
          
          <div className="text-center py-4">
            <h2 className="text-[#5D4037] font-display font-bold text-2xl mb-4">
              Today's Lesson Complete!
            </h2>
            
            {/* Streak Display - Always show */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-400 to-red-500 text-white px-5 py-3 rounded-full mb-4">
              <Flame className="w-6 h-6" />
              <span className="font-bold text-xl">{streak} Day Streak</span>
            </div>
            
            <button
              onClick={() => navigate('/daily-session')}
              className="block mx-auto text-[#8B4513] text-base underline mt-2"
            >
              Review today's lesson →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-6">
      <div className="bg-[#f5f0e1] rounded-2xl p-8 shadow-lg border-4 border-[#8B4513]/30 relative overflow-hidden">
        
        {/* Streak Badge - Top Right - Always show */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-gradient-to-r from-orange-400 to-red-500 text-white px-4 py-2 rounded-full shadow-md">
          <Flame className="w-5 h-5" />
          <span className="font-bold text-base">{streak}</span>
        </div>
        
        {/* Header */}
        <div className="text-center mb-6 pt-2">
          <h2 className="text-[#5D4037] font-display font-bold text-2xl">
            Today's Godly Kids Lesson
          </h2>
        </div>

        {/* Duration Selector */}
        <div className="mb-8">
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
        <div className="mt-6 flex items-center justify-center gap-3 text-[#8B4513]/60 text-base">
          <span className="font-medium">Story</span>
          <span>→</span>
          <span className="font-medium">Discuss</span>
          <span>→</span>
          <span className="font-medium">Pray</span>
        </div>
      </div>
    </div>
  );
};

export default DailyLessonWidget;
