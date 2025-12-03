import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, Play, Calendar, Video } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { getLessonStatus, getWeekDays } from '../services/lessonService';

interface Lesson {
    _id: string;
    title: string;
    description?: string;
    video: {
        url: string;
        thumbnail?: string;
        duration?: number;
    };
    scheduledDate?: string;
    status: string;
}

const LessonsPage: React.FC = () => {
    const navigate = useNavigate();
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekLessons, setWeekLessons] = useState<Map<string, Lesson>>(new Map());

    useEffect(() => {
        fetchLessons();
    }, []);

    const fetchLessons = async () => {
        try {
            const data = await ApiService.getLessons();
            setLessons(data);
            
            // Organize lessons by day for the fixed week (Monday to Sunday)
            const weekMap = new Map<string, Lesson>();
            const weekDays = getWeekDays(); // Get Monday through Sunday of current week
            
            // Also include published lessons without scheduled dates
            const publishedLessons = data.filter((l: Lesson) =>
                l.status === 'published' && !l.scheduledDate
            );
            
            weekDays.forEach((date, index) => {
                const dateKey = date.toISOString().split('T')[0];
                
                // Find lesson scheduled for this date
                let lesson = data.find((l: Lesson) => {
                    if (!l.scheduledDate) return false;
                    const scheduled = new Date(l.scheduledDate);
                    scheduled.setHours(0, 0, 0, 0);
                    return scheduled.getTime() === date.getTime();
                });
                
                // If no scheduled lesson, assign published lessons in order
                if (!lesson && publishedLessons[index]) {
                    lesson = publishedLessons[index];
                }
                
                if (lesson) {
                    weekMap.set(dateKey, lesson);
                }
            });
            
            setWeekLessons(weekMap);
        } catch (error) {
            console.error('Error fetching lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDayLabel = (date: Date): string => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
    };

    const getDayNumber = (date: Date): number => {
        return date.getDate();
    };

    const handleLessonClick = (lesson: Lesson) => {
        const status = getLessonStatus(lesson);
        if (status === 'locked') {
            return; // Don't navigate if locked
        }
        navigate(`/lesson/${lesson._id}`);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-white text-lg">Loading lessons...</div>
            </div>
        );
    }

    // Generate week days (Monday to Sunday of current week)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekDays = getWeekDays(); // Monday through Sunday

    return (
        <div className="h-full overflow-y-auto pb-32">
            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">Daily Lessons</h1>
                    <p className="text-white/80">Watch, learn, and grow each day!</p>
                </div>

                {/* Week View - Portrait Style Thumbnails */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                    {weekDays.map((date) => {
                        const dateKey = date.toISOString().split('T')[0];
                        const lesson = weekLessons.get(dateKey);
                        const status = lesson ? getLessonStatus(lesson) : 'empty';
                        const isToday = date.toDateString() === today.toDateString();
                        const isPast = date < today && !isToday;

                        return (
                            <div
                                key={dateKey}
                                className={`relative ${status === 'locked' ? 'cursor-not-allowed' : status !== 'empty' ? 'cursor-pointer' : ''}`}
                                onClick={() => lesson && status !== 'locked' && handleLessonClick(lesson)}
                            >
                                {/* Day Label */}
                                <div className="text-center mb-2">
                                    <div className={`text-xs font-semibold ${isToday ? 'text-[#FFD700]' : 'text-white/70'}`}>
                                        {getDayLabel(date)}
                                    </div>
                                    <div className={`text-lg font-bold ${isToday ? 'text-[#FFD700]' : 'text-white'}`}>
                                        {getDayNumber(date)}
                                    </div>
                                </div>

                                {/* Portrait Thumbnail Container */}
                                <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-800/50 border-2 transition-all">
                                    {status === 'empty' ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="text-white/40 text-xs text-center px-2">
                                                No lesson
                                            </div>
                                        </div>
                                    ) : lesson ? (
                                        <>
                                            {/* Thumbnail */}
                                            {lesson.video?.thumbnail ? (
                                                <img
                                                    src={lesson.video.thumbnail}
                                                    alt={lesson.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
                                                    <Video className="w-12 h-12 text-white/50" />
                                                </div>
                                            )}

                                            {/* Overlay */}
                                            <div className={`absolute inset-0 ${
                                                status === 'locked' 
                                                    ? 'bg-black/70' 
                                                    : status === 'completed' 
                                                        ? 'bg-green-500/30' 
                                                        : 'bg-black/20'
                                            }`} />

                                            {/* Status Icons */}
                                            <div className="absolute top-2 right-2">
                                                {status === 'locked' ? (
                                                    <div className="bg-black/60 rounded-full p-1.5">
                                                        <Lock className="w-4 h-4 text-white" />
                                                    </div>
                                                ) : status === 'completed' ? (
                                                    <div className="bg-green-500 rounded-full p-1.5">
                                                        <Check className="w-4 h-4 text-white" />
                                                    </div>
                                                ) : (
                                                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-1.5">
                                                        <Play className="w-4 h-4 text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Title Overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                <p className="text-white text-xs font-semibold line-clamp-2">
                                                    {lesson.title}
                                                </p>
                                            </div>
                                        </>
                                    ) : null}

                                    {/* Border for today */}
                                    {isToday && (
                                        <div className="absolute inset-0 border-2 border-[#FFD700] rounded-lg pointer-events-none" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Available Lessons (Past and Today) */}
                {lessons.filter(l => {
                    const status = getLessonStatus(l);
                    return status === 'available' || status === 'completed';
                }).length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-white mb-4">Available Lessons</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {lessons
                                .filter(l => {
                                    const status = getLessonStatus(l);
                                    return status === 'available' || status === 'completed';
                                })
                                .map((lesson) => {
                                    const status = getLessonStatus(lesson);
                                    return (
                                        <div
                                            key={lesson._id}
                                            className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-800/50 border-2 cursor-pointer hover:scale-105 transition-transform"
                                            onClick={() => handleLessonClick(lesson)}
                                        >
                                            {lesson.video?.thumbnail ? (
                                                <img
                                                    src={lesson.video.thumbnail}
                                                    alt={lesson.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
                                                    <Video className="w-12 h-12 text-white/50" />
                                                </div>
                                            )}

                                            <div className={`absolute inset-0 ${
                                                status === 'completed' ? 'bg-green-500/30' : 'bg-black/20'
                                            }`} />

                                            <div className="absolute top-2 right-2">
                                                {status === 'completed' ? (
                                                    <div className="bg-green-500 rounded-full p-1.5">
                                                        <Check className="w-4 h-4 text-white" />
                                                    </div>
                                                ) : (
                                                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-1.5">
                                                        <Play className="w-4 h-4 text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                <p className="text-white text-xs font-semibold line-clamp-2">
                                                    {lesson.title}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LessonsPage;

