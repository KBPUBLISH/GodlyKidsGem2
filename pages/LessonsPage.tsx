import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Lock, Check, Calendar, Book, FlaskConical, Calculator, Hourglass, Languages, Palette, Cpu, Video } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { isCompleted, isLocked } from '../services/lessonService';
import { useUser } from '../context/UserContext';

interface Lesson {
    _id: string;
    title: string;
    description?: string;
    video: {
        url: string;
        thumbnail?: string;
        duration?: number;
        type?: 'Bible' | 'Science' | 'Math' | 'History' | 'English' | 'Art' | 'Technology';
    };
    scheduledDate?: string;
}

type PlannerSlot = {
    slotIndex: number;
    isDailyVerse: boolean;
    lesson: any; // backend returns populated Lesson doc
};

type PlannerDayResponse = {
    profileId: string;
    dateKey: string;
    weekKey: string;
    slots: PlannerSlot[];
};

const getLessonIcon = (type: string) => {
    switch (type) {
        case 'Bible': return <Book className="w-4 h-4 text-white" />;
        case 'Science': return <FlaskConical className="w-4 h-4 text-white" />;
        case 'Math': return <Calculator className="w-4 h-4 text-white" />;
        case 'History': return <Hourglass className="w-4 h-4 text-white" />;
        case 'English': return <Languages className="w-4 h-4 text-white" />;
        case 'Art': return <Palette className="w-4 h-4 text-white" />;
        case 'Technology': return <Cpu className="w-4 h-4 text-white" />;
        default: return <Video className="w-4 h-4 text-white" />;
    }
};

const formatLocalDateKey = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const ageToLessonAgeGroup = (age?: number): string => {
    if (!age || !Number.isFinite(age)) return 'all';
    if (age <= 6) return '4-6';
    if (age <= 8) return '6-8';
    if (age <= 10) return '8-10';
    if (age <= 12) return '10-12';
    return 'all';
};

const LessonsPage: React.FC = () => {
    const navigate = useNavigate();
    const { kids, currentProfileId } = useUser();
    const [loading, setLoading] = useState(true);
    const [dayPlans, setDayPlans] = useState<Map<string, PlannerDayResponse>>(new Map());
    const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
    const [loadingDay, setLoadingDay] = useState<string | null>(null);
    
    // Track which days we've already requested (to avoid duplicate fetches)
    const loadedDaysRef = React.useRef<Set<string>>(new Set());
    
    // IMMEDIATE LOG - runs every render
    console.log('🚨 LessonsPage RENDER - currentProfileId:', currentProfileId, 'typeof:', typeof currentProfileId);
    
    // Debug: log profile info on mount
    useEffect(() => {
        console.log('📅 LessonsPage mounted. currentProfileId:', currentProfileId, 'kids:', kids?.length || 0);
        if (kids && kids.length > 0) {
            console.log('📅 Kids list:', kids.map((k: any) => ({ id: k.id, name: k.name, age: k.age })));
        }
    }, [currentProfileId, kids]);
    
    // Force trigger on mount if we have a profile
    useEffect(() => {
        console.log('📅 Mount effect running, currentProfileId=', currentProfileId);
        if (currentProfileId) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateKey = formatLocalDateKey(today);
            console.log('📅 Will try to load today:', dateKey);
        }
    }, []);

    const loadDayPlan = useCallback(async (dateKey: string, forceLoad = false) => {
        if (!currentProfileId) {
            console.log('📅 loadDayPlan: No currentProfileId');
            return;
        }
        
        // Skip if already loaded or currently loading
        if (!forceLoad && loadedDaysRef.current.has(dateKey)) {
            console.log('📅 loadDayPlan: Already loaded/loading', dateKey);
            return;
        }
        
        loadedDaysRef.current.add(dateKey);
        setLoadingDay(dateKey);

        console.log('📅 loadDayPlan: Fetching plan for', dateKey, 'profile:', currentProfileId);
        const kid = kids.find((k: any) => String(k.id) === String(currentProfileId));
        const ageGroup = ageToLessonAgeGroup(kid?.age);
        console.log('📅 loadDayPlan: Kid age group:', ageGroup, 'kid:', kid?.name);

        try {
            const plan = await ApiService.getLessonPlannerDay(currentProfileId, dateKey, ageGroup);
            console.log('📅 loadDayPlan: Got plan:', plan);
            if (plan && plan.slots && plan.slots.length > 0) {
                setDayPlans(prev => {
                    const next = new Map(prev);
                    next.set(dateKey, plan);
                    return next;
                });
            } else {
                console.warn('📅 loadDayPlan: Plan has no slots or is null. Response:', JSON.stringify(plan));
            }
        } catch (error) {
            console.error('📅 loadDayPlan: Error fetching plan:', error);
            // Remove from loaded set so user can retry
            loadedDaysRef.current.delete(dateKey);
        } finally {
            setLoadingDay(null);
        }
    }, [currentProfileId, kids]);

    // Auto-load today's plan when page opens
    useEffect(() => {
        if (!currentProfileId) {
            setLoading(false);
            return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateKey = formatLocalDateKey(today);
        setSelectedDateKey(dateKey);
        
        // Load today's plan immediately
        loadDayPlan(dateKey).finally(() => setLoading(false));
    }, [currentProfileId, loadDayPlan]);
    
    // Also load when selectedDateKey changes (user taps a different day)
    useEffect(() => {
        if (selectedDateKey && currentProfileId) {
            loadDayPlan(selectedDateKey);
        }
    }, [selectedDateKey, currentProfileId, loadDayPlan]);

    const getDayLabel = (date: Date): string => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
    };

    const getDayNumber = (date: Date): number => {
        return date.getDate();
    };

    const handleLessonClick = (lessonId: string, meta?: { dateKey?: string; slotIndex?: number; isDailyVerse?: boolean }) => {
        navigate(`/lesson/${lessonId}`, { state: meta || {} });
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

    return (
        <div className="h-full overflow-y-auto pb-32">
            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">Daily Lessons</h1>
                    <p className="text-white/80">Watch, learn, and grow each day!</p>
                </div>

                {!currentProfileId && (
                    <div className="mb-6 bg-black/30 border border-white/10 rounded-xl p-4 text-white/90">
                        Please select a kid profile to see daily lessons.
                        <br />
                        <span className="text-xs text-white/50">Debug: currentProfileId = {String(currentProfileId)}</span>
                    </div>
                )}
                
                {/* Debug button to manually trigger API call */}
                <button
                    onClick={async () => {
                        const today = formatLocalDateKey(new Date());
                        // Use currentProfileId or a test ID
                        const testProfileId = currentProfileId || 'test-profile-123';
                        console.log('🧪 Manual test! profileId:', testProfileId, '(current:', currentProfileId, ') dateKey:', today);
                        try {
                            const result = await ApiService.getLessonPlannerDay(testProfileId, today, 'all');
                            console.log('🧪 Manual test result:', result);
                            alert('Result: ' + JSON.stringify(result?.slots?.length || 0) + ' slots. Check console!');
                        } catch (err) {
                            console.error('🧪 Manual test error:', err);
                            alert('Error! Check console.');
                        }
                    }}
                    className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm"
                >
                    🧪 Test API Call (profileId: {currentProfileId || 'none - will use test ID'})
                </button>

                {/* Week View - Portrait Style Thumbnails */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                    {weekDays.map((date) => {
                        const dateKey = formatLocalDateKey(date);
                        const plan = dayPlans.get(dateKey);
                        const slot0 = plan?.slots?.find(s => s.slotIndex === 0) || plan?.slots?.[0];
                        const thumb = slot0?.lesson?.video?.thumbnail || slot0?.lesson?.video?.thumbnailUrl || slot0?.lesson?.thumbnail;
                        const status = plan ? 'available' : 'empty';
                        const isToday = date.toDateString() === today.toDateString();

                        return (
                            <div
                                key={dateKey}
                                className={`relative cursor-pointer`}
                                onClick={() => {
                                    if (!currentProfileId) return;
                                    setSelectedDateKey(dateKey);
                                    loadDayPlan(dateKey);
                                }}
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
                                    {loadingDay === dateKey ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="text-white/60 text-xs text-center px-2">
                                                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto mb-1"></div>
                                                Loading...
                                            </div>
                                        </div>
                                    ) : status === 'empty' ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="text-white/40 text-xs text-center px-2">
                                                Tap to load
                                            </div>
                                        </div>
                                    ) : plan ? (
                                        <>
                                            {/* Thumbnail */}
                                            {thumb ? (
                                                <img
                                                    src={thumb}
                                                    alt={slot0?.lesson?.title || 'Lesson'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
                                                    <Video className="w-12 h-12 text-white/50" />
                                                </div>
                                            )}

                                            {/* Overlay */}
                                            <div className="absolute inset-0 bg-black/20" />

                                            {/* Status Icons */}
                                            <div className="absolute top-2 right-2">
                                                <div className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-1 text-[10px] text-white font-bold">
                                                    {plan.slots?.length || 0}
                                                </div>
                                            </div>

                                            {/* Title Overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                <p className="text-white text-xs font-semibold line-clamp-2">
                                                    {slot0?.lesson?.title || 'Daily Lessons'}
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

                {/* Selected Day Lessons */}
                {selectedDateKey && (
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-white mb-4">
                            Lessons for {selectedDateKey}
                        </h2>
                        {loadingDay === selectedDateKey ? (
                            <div className="flex items-center gap-2 text-white/70 text-sm">
                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                                Loading lessons...
                            </div>
                        ) : !dayPlans.get(selectedDateKey) ? (
                            <div className="text-white/70 text-sm">
                                No lessons available for this day. Make sure you have lessons created and marked as "Daily Verse" or other types in the portal.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {dayPlans.get(selectedDateKey)!.slots.map((slot) => {
                                    const lesson = slot.lesson;
                                    const completed = lesson?._id ? isCompleted(String(lesson._id)) : false;
                                    return (
                                        <div
                                            key={`${selectedDateKey}-${slot.slotIndex}-${lesson?._id}`}
                                            className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-800/50 border-2 cursor-pointer hover:scale-[1.02] transition-transform"
                                            onClick={() => handleLessonClick(String(lesson._id), {
                                                dateKey: selectedDateKey,
                                                slotIndex: slot.slotIndex,
                                                isDailyVerse: slot.isDailyVerse,
                                            })}
                                        >
                                            {lesson?.video?.thumbnail ? (
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

                                            <div className="absolute inset-0 bg-black/20" />

                                            <div className="absolute top-2 left-2 bg-black/60 rounded-full px-2 py-1 text-[10px] text-white font-bold">
                                                {slot.isDailyVerse ? 'Daily Verse' : `Video ${slot.slotIndex + 1}`}
                                            </div>

                                            <div className="absolute top-2 right-2">
                                                {completed ? (
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
                                                    {lesson?.title || 'Lesson'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LessonsPage;

