import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Video, Clock, X, Trash2, Plus } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Lesson {
    _id: string;
    title: string;
    description?: string;
    status: 'draft' | 'scheduled' | 'published' | 'archived';
    video?: {
        url?: string;
        thumbnail?: string;
        duration?: number;
    };
    type?: string;
    scheduledDate?: string;
    coinReward?: number;
}

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    lessons: Lesson[]; // Changed to array to support multiple lessons per day
}

const LessonCalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
    const [scheduledLessons, setScheduledLessons] = useState<{ [key: string]: Lesson[] }>({}); // Array of lessons per date
    const [unscheduledLessons, setUnscheduledLessons] = useState<Lesson[]>([]);
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAddVideoSection, setShowAddVideoSection] = useState(false); // For modal add video

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Generate calendar days for the current month view
    const generateCalendarDays = (date: Date): CalendarDay[] => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days: CalendarDay[] = [];

        // Add days from previous month
        const prevMonth = new Date(year, month, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthDays - i);
            days.push({
                date: d,
                isCurrentMonth: false,
                isToday: d.getTime() === today.getTime(),
                lessons: [], // Will be populated after fetch
            });
        }

        // Add days from current month
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            days.push({
                date: d,
                isCurrentMonth: true,
                isToday: d.getTime() === today.getTime(),
                lessons: [], // Will be populated after fetch
            });
        }

        // Add days from next month to fill the grid (6 rows)
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            const d = new Date(year, month + 1, i);
            days.push({
                date: d,
                isCurrentMonth: false,
                isToday: d.getTime() === today.getTime(),
                lessons: [], // Will be populated after fetch
            });
        }

        return days;
    };

    // Fetch lessons for calendar
    const fetchLessons = async () => {
        try {
            setLoading(true);
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            // Get start and end of visible calendar range (including prev/next month days)
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month + 2, 0).toISOString();

            // Fetch scheduled lessons for calendar (status=all to see drafts in portal)
            const calendarResponse = await apiClient.get(`/api/lessons/calendar?startDate=${startDate}&endDate=${endDate}&status=all`);
            
            // Convert to lookup by date - support multiple lessons per day
            const scheduled: { [key: string]: Lesson[] } = {};
            if (calendarResponse.data.lessons) {
                calendarResponse.data.lessons.forEach((lesson: Lesson) => {
                    if (lesson.scheduledDate) {
                        const dateKey = lesson.scheduledDate.split('T')[0];
                        if (!scheduled[dateKey]) {
                            scheduled[dateKey] = [];
                        }
                        scheduled[dateKey].push(lesson);
                    }
                });
            }
            setScheduledLessons(scheduled);

            // Fetch all lessons to find unscheduled ones (status=all to see drafts in portal)
            const allResponse = await apiClient.get('/api/lessons?status=all');
            // Handle paginated response or direct array
            const allLessons = Array.isArray(allResponse.data) 
                ? allResponse.data 
                : (allResponse.data.data || allResponse.data.lessons || []);
            const unscheduled = allLessons.filter((lesson: Lesson) => 
                !lesson.scheduledDate && lesson.status !== 'archived'
            );
            setUnscheduledLessons(unscheduled);

        } catch (error) {
            console.error('Error fetching lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    // Schedule a lesson to a specific date
    const scheduleLesson = async (lessonId: string, date: Date | null) => {
        try {
            setSaving(true);
            await apiClient.put('/api/lessons/schedule', {
                lessonId,
                date: date ? date.toISOString() : null
            });
            await fetchLessons();
            setSelectedDay(null);
        } catch (error) {
            console.error('Error scheduling lesson:', error);
            alert('Failed to schedule lesson');
        } finally {
            setSaving(false);
        }
    };

    // Remove lesson from a date
    const unscheduleLesson = async (lessonId: string) => {
        await scheduleLesson(lessonId, null);
    };

    useEffect(() => {
        const days = generateCalendarDays(currentDate);
        setCalendarDays(days);
    }, [currentDate]);

    useEffect(() => {
        fetchLessons();
    }, [currentDate]);

    // Attach lessons to calendar days
    const calendarDaysWithLessons = calendarDays.map(day => {
        const dateKey = day.date.toISOString().split('T')[0];
        return {
            ...day,
            lessons: scheduledLessons[dateKey] || []
        };
    });

    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex h-[calc(100vh-64px)]">
            {/* Video Library Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Video className="w-5 h-5 text-indigo-600" />
                        Video Library
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Click a day to schedule a video
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <p className="text-gray-500 text-center py-4">Loading...</p>
                    ) : unscheduledLessons.length === 0 ? (
                        <div className="text-center py-8">
                            <Video className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">All videos are scheduled!</p>
                            <a href="/lessons/new" className="text-indigo-600 text-sm hover:underline mt-2 inline-block">
                                Create new video lesson
                            </a>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {unscheduledLessons.map((lesson) => (
                                <div
                                    key={lesson._id}
                                    className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    onClick={() => {
                                        if (selectedDay) {
                                            scheduleLesson(lesson._id, selectedDay.date);
                                        } else {
                                            alert('Please select a day on the calendar first');
                                        }
                                    }}
                                >
                                    {lesson.video?.thumbnail ? (
                                        <img
                                            src={lesson.video.thumbnail}
                                            alt={lesson.title}
                                            className="w-full h-24 object-cover rounded mb-2"
                                        />
                                    ) : (
                                        <div className="w-full h-24 bg-gray-200 rounded mb-2 flex items-center justify-center">
                                            <Video className="w-8 h-8 text-gray-400" />
                                        </div>
                                    )}
                                    <h4 className="font-medium text-gray-800 text-sm truncate">{lesson.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            lesson.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                                            lesson.status === 'published' ? 'bg-green-100 text-green-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {lesson.status}
                                        </span>
                                        {lesson.video?.duration && (
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDuration(lesson.video.duration)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Calendar Area */}
            <div className="flex-1 flex flex-col bg-gray-50">
                {/* Calendar Header */}
                <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-indigo-600" />
                            Lesson Calendar
                        </h1>
                        <button
                            onClick={goToToday}
                            className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                        >
                            Today
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={goToPreviousMonth}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <h2 className="text-xl font-semibold text-gray-800 min-w-[200px] text-center">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </h2>
                        <button
                            onClick={goToNextMonth}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>

                    <div className="text-sm text-gray-500">
                        {Object.keys(scheduledLessons).length} lessons scheduled
                    </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 bg-white border-b border-gray-200">
                    {dayNames.map((day) => (
                        <div key={day} className="p-3 text-center text-sm font-semibold text-gray-600 border-r border-gray-100 last:border-r-0">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                    {calendarDaysWithLessons.map((day, index) => {
                        const isSelected = selectedDay?.date.toISOString() === day.date.toISOString();
                        
                        return (
                            <div
                                key={index}
                                onClick={() => setSelectedDay(day)}
                                className={`
                                    border-r border-b border-gray-200 p-2 cursor-pointer transition-colors min-h-[100px]
                                    ${!day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                                    ${day.isToday ? 'ring-2 ring-inset ring-indigo-500' : ''}
                                    ${isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400' : 'hover:bg-gray-50'}
                                `}
                            >
                                <div className={`
                                    text-sm font-medium mb-1
                                    ${day.isToday ? 'bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : ''}
                                `}>
                                    {day.date.getDate()}
                                </div>

                                {/* Show all lessons for this day */}
                                <div className="space-y-1 max-h-[80px] overflow-y-auto">
                                    {day.lessons.map((lesson) => (
                                        <div 
                                            key={lesson._id}
                                            className="bg-indigo-100 rounded p-1 text-xs group relative"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {lesson.video?.thumbnail && (
                                                <img
                                                    src={lesson.video.thumbnail}
                                                    alt=""
                                                    className="w-full h-10 object-cover rounded mb-0.5"
                                                />
                                            )}
                                            <p className="font-medium text-indigo-800 truncate text-[10px]">{lesson.title}</p>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Unschedule "${lesson.title}" from this day?`)) {
                                                        unscheduleLesson(lesson._id);
                                                    }
                                                }}
                                                className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {day.lessons.length === 0 && isSelected && (
                                    <div className="text-xs text-indigo-600 mt-2">
                                        Click a video from the library
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selected Day Modal - shows all lessons for the day + add new video */}
            {selectedDay && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setSelectedDay(null); setShowAddVideoSection(false); }}>
                    <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">
                                {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                {selectedDay.lessons.length > 0 && (
                                    <span className="text-sm font-normal text-gray-500 ml-2">
                                        ({selectedDay.lessons.length} lesson{selectedDay.lessons.length > 1 ? 's' : ''})
                                    </span>
                                )}
                            </h3>
                            <button onClick={() => { setSelectedDay(null); setShowAddVideoSection(false); }} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Existing Lessons */}
                        {selectedDay.lessons.length > 0 && (
                            <div className="space-y-4 mb-4">
                                {selectedDay.lessons.map((lesson) => (
                                    <div key={lesson._id} className="bg-gray-50 rounded-lg p-4">
                                        {lesson.video?.thumbnail && (
                                            <img
                                                src={lesson.video.thumbnail}
                                                alt={lesson.title}
                                                className="w-full h-32 object-cover rounded-lg mb-3"
                                            />
                                        )}
                                        <h4 className="font-semibold text-gray-800">{lesson.title}</h4>
                                        {lesson.type && (
                                            <span className="inline-block mt-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                                {lesson.type}
                                            </span>
                                        )}
                                        {lesson.description && (
                                            <p className="text-sm text-gray-600 mt-1">{lesson.description}</p>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (confirm(`Unschedule "${lesson.title}" from this day?`)) {
                                                    unscheduleLesson(lesson._id);
                                                }
                                            }}
                                            disabled={saving}
                                            className="mt-3 bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2 text-sm"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Unschedule
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* No lessons message */}
                        {selectedDay.lessons.length === 0 && !showAddVideoSection && (
                            <div className="text-center py-6 bg-gray-50 rounded-lg mb-4">
                                <Video className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No videos scheduled for this day</p>
                            </div>
                        )}

                        {/* Add Video Section */}
                        {showAddVideoSection ? (
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-gray-700">Select a video to add:</h4>
                                    <button 
                                        onClick={() => setShowAddVideoSection(false)}
                                        className="text-sm text-gray-500 hover:text-gray-700"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                {unscheduledLessons.length === 0 ? (
                                    <div className="text-center py-4 bg-gray-50 rounded-lg">
                                        <p className="text-gray-500 text-sm mb-2">No unscheduled videos available</p>
                                        <a 
                                            href="/lessons/new" 
                                            className="text-indigo-600 text-sm hover:underline"
                                        >
                                            Create a new video lesson →
                                        </a>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {unscheduledLessons.map((lesson) => (
                                            <button
                                                key={lesson._id}
                                                onClick={() => {
                                                    scheduleLesson(lesson._id, selectedDay.date);
                                                    setShowAddVideoSection(false);
                                                }}
                                                disabled={saving}
                                                className="w-full text-left bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 border border-gray-200 rounded-lg p-3 transition-colors flex gap-3 items-center"
                                            >
                                                {lesson.video?.thumbnail ? (
                                                    <img
                                                        src={lesson.video.thumbnail}
                                                        alt={lesson.title}
                                                        className="w-16 h-12 object-cover rounded"
                                                    />
                                                ) : (
                                                    <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                                                        <Video className="w-5 h-5 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-800 text-sm truncate">{lesson.title}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {lesson.type && (
                                                            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                                                {lesson.type}
                                                            </span>
                                                        )}
                                                        {lesson.video?.duration && (
                                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {formatDuration(lesson.video.duration)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <Plus className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Add New Video Button */
                            <button
                                onClick={() => setShowAddVideoSection(true)}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                            >
                                <Plus className="w-5 h-5" />
                                Add New Video
                            </button>
                        )}

                        <button
                            onClick={() => { setSelectedDay(null); setShowAddVideoSection(false); }}
                            className="w-full mt-4 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {saving && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-700">Saving...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LessonCalendarPage;

