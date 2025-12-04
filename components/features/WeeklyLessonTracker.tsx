import React from 'react';
import { Check, Circle } from 'lucide-react';

interface WeeklyLessonTrackerProps {
  selectedDay: number; // 0-4 for Mon-Fri
  onDaySelect: (dayIndex: number) => void;
  dayCompletions: boolean[]; // Array of 5 booleans for Mon-Fri completion status
  todayIndex: number; // 0-4 indicating which day is today (or -1 if weekend)
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const WeeklyLessonTracker: React.FC<WeeklyLessonTrackerProps> = ({
  selectedDay,
  onDaySelect,
  dayCompletions,
  todayIndex,
}) => {
  return (
    <div className="bg-gradient-to-r from-[#1a237e]/80 to-[#283593]/80 backdrop-blur-sm rounded-xl px-3 py-2.5 mb-3 border border-white/10">
      {/* Week Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">This Week's Progress</span>
        <span className="text-[#FFD700] text-[10px] font-bold">
          {dayCompletions.filter(Boolean).length}/5 Days
        </span>
      </div>

      {/* Day Circles */}
      <div className="flex justify-between items-center gap-1">
        {DAYS.map((day, index) => {
          const isCompleted = dayCompletions[index];
          const isToday = index === todayIndex;
          const isSelected = index === selectedDay;
          const isPast = index < todayIndex;
          const isFuture = index > todayIndex;

          return (
            <button
              key={day}
              onClick={() => {
                // Can only select today or past days (not future)
                if (!isFuture || isCompleted) {
                  onDaySelect(index);
                }
              }}
              disabled={isFuture && !isCompleted}
              className={`
                flex flex-col items-center gap-0.5 transition-all duration-200
                ${isFuture && !isCompleted ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected ? 'scale-110' : 'hover:scale-105'}
              `}
            >
              {/* Day Label */}
              <span className={`text-[9px] font-bold uppercase tracking-wide ${
                isToday ? 'text-[#FFD700]' : 
                isSelected ? 'text-white' : 
                'text-white/50'
              }`}>
                {day}
              </span>

              {/* Circle/Checkmark */}
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
                ${isCompleted 
                  ? 'bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] shadow-lg shadow-green-500/30' 
                  : isSelected
                    ? 'bg-white/20 border-2 border-[#FFD700]'
                    : isToday
                      ? 'bg-[#FFD700]/20 border-2 border-[#FFD700]/50'
                      : 'bg-white/5 border border-white/20'
                }
              `}>
                {isCompleted ? (
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                ) : (
                  <Circle className={`w-3 h-3 ${
                    isSelected ? 'text-[#FFD700]' : 
                    isToday ? 'text-[#FFD700]/70' : 
                    'text-white/30'
                  }`} />
                )}
              </div>

              {/* Today indicator dot */}
              {isToday && !isCompleted && (
                <div className="w-1 h-1 rounded-full bg-[#FFD700] animate-pulse mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Weekend Rest Message (shown if today is Saturday or Sunday) */}
      {todayIndex === -1 && (
        <div className="text-center mt-2 text-white/50 text-[10px]">
          🌟 Weekend time! Enjoy reading stories with family!
        </div>
      )}
    </div>
  );
};

export default WeeklyLessonTracker;

