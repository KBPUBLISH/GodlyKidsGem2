import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Lock, Check, Calendar, Book, FlaskConical, Calculator, Hourglass, Languages, Palette, Cpu, Video, Sparkles, Coins } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { isCompleted, isLocked } from '../services/lessonService';
import { useUser } from '../context/UserContext';

interface Lesson {
    _id: string;
    title: string;
    description?: string;
    type?: string;
    ageGroup?: '4-6' | '6-8' | '8-10' | '10-12' | 'all';
    video: {
        url: string;
        thumbnail?: string;
        duration?: number;
        type?: 'Bible' | 'Science' | 'Math' | 'History' | 'English' | 'Art' | 'Technology';
    };
    scheduledDate?: string;
    coinReward?: number;
}

// Helper function to check if a kid's age matches a lesson's age group
const isAgeAppropriate = (kidAge: number | undefined, ageGroup: string | undefined): boolean => {
    if (!ageGroup || ageGroup === 'all') return true;
    if (!kidAge) return true; // If no age set, show all lessons
    
    const ageRanges: Record<string, [number, number]> = {
        '4-6': [4, 6],
        '6-8': [6, 8],
        '8-10': [8, 10],
        '10-12': [10, 12],
    };
    
    const range = ageRanges[ageGroup];
    if (!range) return true;
    
    return kidAge >= range[0] && kidAge <= range[1];
};

// Get age group label for display
const getAgeGroupLabel = (ageGroup: string | undefined): string => {
    if (!ageGroup || ageGroup === 'all') return '';
    return `Ages ${ageGroup}`;
};

const getLessonIcon = (type: string) => {
    switch (type) {
        case 'Bible': 
        case 'Bible Study': return <Book className="w-4 h-4 text-white" />;
        case 'Daily Verse': return <Sparkles className="w-4 h-4 text-white" />;
        case 'Science': return <FlaskConical className="w-4 h-4 text-white" />;
        case 'Math': return <Calculator className="w-4 h-4 text-white" />;
        case 'History': return <Hourglass className="w-4 h-4 text-white" />;
        case 'English': return <Languages className="w-4 h-4 text-white" />;
        case 'Art': 
        case 'Arts & Crafts': return <Palette className="w-4 h-4 text-white" />;
        case 'Technology': return <Cpu className="w-4 h-4 text-white" />;
        default: return <Video className="w-4 h-4 text-white" />;
    }
};

const LessonsPage: React.FC = () => {
    const navigate = useNavigate();
    const { kids, currentProfileId } = useUser();
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekLessons, setWeekLessons] = useState<Map<string, Lesson>>(new Map());

    // Get current kid's age for filtering
    const currentKidAge = useMemo(() => {
        if (!currentProfileId) return undefined; // Parent viewing - show all
        const currentKid = kids.find(k => k.id === currentProfileId);
        return currentKid?.age;
    }, [currentProfileId, kids]);

    useEffect(() => {
        fetchLessons();
    }, []);

    const fetchLessons = async () => {
        try {
            const data = await ApiService.getLessons();
            setLessons(data);

            // Organize lessons by day for the next 7 days
            const weekMap = new Map<string, Lesson>();
            const today = new Date();

            for (let i = 0; i < 7; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() + i);
                date.setHours(0, 0, 0, 0);

                const dateKey = date.toISOString().split('T')[0];

                // Find lesson scheduled for this date
                const lesson = data.find((l: Lesson) => {
                    if (!l.scheduledDate) return false;
                    const scheduled = new Date(l.scheduledDate);
                    scheduled.setHours(0, 0, 0, 0);
                    return scheduled.getTime() === date.getTime();
                });

                if (lesson) {
                    weekMap.set(dateKey, lesson);
                }
            }

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
        if (isLocked(lesson)) {
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

    // Generate next 7 days
    const today = new Date();
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0);
        weekDays.push(date);
    }

    // Filter Daily Verse lessons - Auto-rotate based on day of year
    const dailyVerseLessons = lessons.filter(l => l.type === 'Daily Verse' && !isLocked(l));
    
    // Auto-rotate logic: Pick today's verse based on day of year, prioritize unwatched
    const getTodaysDailyVerse = () => {
        if (dailyVerseLessons.length === 0) return null;
        
        // Sort by order or creation date for consistent ordering
        const sortedVerses = [...dailyVerseLessons].sort((a, b) => {
            // Sort by _id (which contains timestamp) for consistent ordering
            return a._id.localeCompare(b._id);
        });
        
        // Get day of year (1-365)
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now.getTime() - start.getTime();
        const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        // Calculate which verse index for today (cycles through all verses)
        const todayIndex = dayOfYear % sortedVerses.length;
        
        // First, try to show today's scheduled verse (unwatched)
        const scheduledVerse = sortedVerses[todayIndex];
        if (scheduledVerse && !isCompleted(scheduledVerse._id)) {
            return scheduledVerse;
        }
        
        // If today's verse is already watched, find the next unwatched one
        const unwatchedVerses = sortedVerses.filter(v => !isCompleted(v._id));
        if (unwatchedVerses.length > 0) {
            // Return the first unwatched verse (encourages catching up)
            return unwatchedVerses[0];
        }
        
        // All verses watched - show today's scheduled verse anyway (they can rewatch)
        return scheduledVerse || sortedVerses[0];
    };
    
    const todaysDailyVerse = getTodaysDailyVerse();

    // Filter out Daily Verse from regular lessons and sort by age appropriateness
    const regularLessons = useMemo(() => {
        const filtered = lessons.filter(l => l.type !== 'Daily Verse');
        
        // Sort lessons: age-appropriate first, then others
        return [...filtered].sort((a, b) => {
            const aAppropriate = isAgeAppropriate(currentKidAge, a.ageGroup);
            const bAppropriate = isAgeAppropriate(currentKidAge, b.ageGroup);
            
            // Age-appropriate lessons come first
            if (aAppropriate && !bAppropriate) return -1;
            if (!aAppropriate && bAppropriate) return 1;
            
            // Within same category, maintain original order (by schedule or creation)
            return 0;
        });
    }, [lessons, currentKidAge]);

    return (
        <div className="h-full overflow-y-auto pb-32">
            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">Daily Lessons</h1>
                    <p className="text-white/80">Watch, learn, and grow each day!</p>
                </div>

                {/* ✨ Verse of the Day - Featured Section */}
                {todaysDailyVerse && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-6 h-6 text-[#FFD700]" />
                            <h2 className="text-xl font-bold text-[#FFD700]">Verse of the Day</h2>
                            <div className="flex items-center gap-1 ml-auto bg-[#FFD700]/20 rounded-full px-3 py-1">
                                <Coins className="w-4 h-4 text-[#FFD700]" />
                                <span className="text-[#FFD700] text-sm font-bold">+50 Coins</span>
                            </div>
                        </div>
                        
                        {/* Large Featured Card - constrained for web */}
                        <div
                            className="relative w-full max-w-2xl mx-auto aspect-video rounded-2xl overflow-hidden cursor-pointer transform hover:scale-[1.02] transition-all duration-300 shadow-lg shadow-[#FFD700]/20"
                            onClick={() => handleLessonClick(todaysDailyVerse)}
                        >
                            {/* Background Image */}
                            {todaysDailyVerse.video?.thumbnail ? (
                                <img
                                    src={todaysDailyVerse.video.thumbnail}
                                    alt={todaysDailyVerse.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600 via-yellow-500 to-orange-500">
                                    <Sparkles className="w-24 h-24 text-white/30" />
                                </div>
                            )}
                            
                            {/* Golden Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-amber-500/20" />
                            
                            {/* Completed Overlay */}
                            {isCompleted(todaysDailyVerse._id) && (
                                <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                                    <div className="bg-green-500 rounded-full p-4">
                                        <Check className="w-12 h-12 text-white" />
                                    </div>
                                </div>
                            )}
                            
                            {/* Play Button */}
                            {!isCompleted(todaysDailyVerse._id) && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-[#FFD700] rounded-full p-5 shadow-lg shadow-black/30 transform hover:scale-110 transition-transform">
                                        <Play className="w-10 h-10 text-[#5c2e0b] fill-[#5c2e0b]" />
                                    </div>
                                </div>
                            )}
                            
                            {/* Title & Description */}
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-[#FFD700] rounded-full px-3 py-1">
                                        <span className="text-[#5c2e0b] text-xs font-bold">✨ TODAY'S VERSE</span>
                                    </div>
                                </div>
                                <h3 className="text-white text-xl font-bold mb-1 drop-shadow-lg">
                                    {todaysDailyVerse.title}
                                </h3>
                                {todaysDailyVerse.description && (
                                    <p className="text-white/80 text-sm line-clamp-2">
                                        {todaysDailyVerse.description}
                                    </p>
                                )}
                            </div>
                            
                            {/* Sparkle decorations */}
                            <div className="absolute top-4 right-4">
                                <Sparkles className="w-8 h-8 text-[#FFD700] animate-pulse" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Week View - Portrait Style Thumbnails */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                    {weekDays.map((date) => {
                        const dateKey = date.toISOString().split('T')[0];
                        const lesson = weekLessons.get(dateKey);
                        const locked = lesson ? isLocked(lesson) : false;
                        const completed = lesson ? isCompleted(lesson._id) : false;
                        const status = locked ? 'locked' : (completed ? 'completed' : (lesson ? 'available' : 'empty'));
                        const isToday = date.toDateString() === today.toDateString();
                        const isPast = date < today && !isToday;

                        return (
                            <div
                                key={dateKey}
                                className={`relative ${locked ? 'cursor-not-allowed' : status !== 'empty' ? 'cursor-pointer' : ''}`}
                                onClick={() => lesson && !locked && handleLessonClick(lesson)}
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
                                            <div className={`absolute inset-0 ${status === 'locked'
                                                ? 'bg-black/70'
                                                : status === 'completed'
                                                    ? 'bg-green-500/30'
                                                    : 'bg-black/20'
                                                }`} />

                                            {/* Type Icon */}
                                            <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm rounded-full p-1.5">
                                                {getLessonIcon(lesson.type || 'Bible')}
                                            </div>

                                            {/* Age Badge (if not 'all') */}
                                            {lesson.ageGroup && lesson.ageGroup !== 'all' && (
                                                <div className={`absolute top-10 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    isAgeAppropriate(currentKidAge, lesson.ageGroup)
                                                        ? 'bg-green-500/90 text-white'
                                                        : 'bg-gray-500/90 text-white/80'
                                                }`}>
                                                    {lesson.ageGroup}
                                                </div>
                                            )}

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

                {/* Available Lessons (Past and Today) - Excludes Daily Verse */}
                {regularLessons.filter(l => {
                    const locked = isLocked(l);
                    const completed = isCompleted(l._id);
                    return !locked || completed; // Show if not locked, or if completed
                }).length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white mb-4">Available Lessons</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {regularLessons
                                    .filter(l => {
                                        const locked = isLocked(l);
                                        const completed = isCompleted(l._id); // Fix: Pass lesson._id
                                        return !locked || completed;
                                    })
                                    .map((lesson) => {
                                        const completed = isCompleted(lesson._id); // Fix: Pass lesson._id
                                        const status = completed ? 'completed' : 'available';
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

                                                <div className={`absolute inset-0 ${status === 'completed' ? 'bg-green-500/30' : 'bg-black/20'
                                                    }`} />

                                                {/* Type Icon */}
                                                <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm rounded-full p-1.5">
                                                    {getLessonIcon(lesson.video?.type || 'Bible')}
                                                </div>

                                                {/* Age Badge (if not 'all') */}
                                                {lesson.ageGroup && lesson.ageGroup !== 'all' && (
                                                    <div className={`absolute top-10 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                        isAgeAppropriate(currentKidAge, lesson.ageGroup)
                                                            ? 'bg-green-500/90 text-white'
                                                            : 'bg-gray-500/90 text-white/80'
                                                    }`}>
                                                        {lesson.ageGroup}
                                                    </div>
                                                )}

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

