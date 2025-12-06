import React from 'react';
import { Check, Circle, Moon } from 'lucide-react';

interface WeeklyLessonTrackerProps {
  selectedDay: number; // 0-4 for Mon-Fri
  onDaySelect: (dayIndex: number) => void;
  dayCompletions: boolean[]; // Array of 5 booleans for Mon-Fri completion status
  todayIndex: number; // 0-4 indicating which day is today (or -1 if weekend)
}

// Full week including weekend for display
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WeeklyLessonTracker: React.FC<WeeklyLessonTrackerProps> = ({
  selectedDay,
  onDaySelect,
  dayCompletions,
  todayIndex,
}) => {
  // Get current day of week (0 = Sunday, 6 = Saturday)
  const today = new Date().getDay();
  const isTodaySaturday = today === 6;
  const isTodaySunday = today === 0;

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
      <div className="flex justify-between items-center gap-0.5">
        {DAYS.map((day, index) => {
          const isWeekend = index >= 5; // Sat (5) or Sun (6)
          const weekdayIndex = isWeekend ? -1 : index; // Only 0-4 are valid weekday indices
          const isCompleted = !isWeekend && dayCompletions[weekdayIndex];
          const isToday = isWeekend 
            ? (index === 5 && isTodaySaturday) || (index === 6 && isTodaySunday)
            : index === todayIndex;
          const isSelected = !isWeekend && index === selectedDay;
          const isFuture = !isWeekend && index > todayIndex && todayIndex !== -1;

          // Weekend days - clickable but show as rest days
          if (isWeekend) {
            return (
              <button
                key={day}
                onClick={() => onDaySelect(index)}
                className="flex flex-col items-center gap-0.5 opacity-70 hover:opacity-100 transition-all duration-200 cursor-pointer hover:scale-105"
              >
                {/* Day Label */}
                <span className={`text-[9px] font-bold uppercase tracking-wide ${
                  isToday ? 'text-white' : 'text-white/50'
                }`}>
                  {day}
                </span>

                {/* Rest Day Circle */}
                <div className={`
                  w-7 h-7 rounded-full flex items-center justify-center
                  ${isToday 
                    ? 'bg-white/20 border border-white/50' 
                    : 'bg-white/5 border border-white/20'
                  }
                `}>
                  <Moon className={`w-3 h-3 ${isToday ? 'text-white' : 'text-white/40'}`} />
                </div>

                {/* Today indicator dot for weekend */}
                {isToday && (
                  <div className="w-1 h-1 rounded-full bg-white animate-pulse mt-0.5" />
                )}
              </button>
            );
          }

          // Weekday buttons
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
                w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200
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
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                ) : (
                  <Circle className={`w-2.5 h-2.5 ${
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
      {(isTodaySaturday || isTodaySunday) && (
        <div className="text-center mt-2 text-white/70 text-[10px]">
          🌙 Rest day! Enjoy reading stories with family!
        </div>
      )}
    </div>
  );
};

export default WeeklyLessonTracker;

