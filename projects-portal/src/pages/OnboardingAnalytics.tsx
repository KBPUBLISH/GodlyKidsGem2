import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, Users, UserPlus, Crown, XCircle, RefreshCw,
    ChevronRight, Calendar, BarChart3, ArrowDownRight, ArrowUpRight,
    BookOpen, AlertTriangle, CheckCircle, Target, Sparkles, MessageSquare,
    ThumbsUp, ThumbsDown, Star, Gamepad2, Headphones, Music, PlayCircle, PauseCircle
} from 'lucide-react';

interface FunnelStep {
    step: string;
    stepKey?: string;
    count: number;
    rate: number;
}

interface TutorialDropoff {
    from: string;
    to: string;
    dropped: number;
    dropRate: number;
}

interface DailyTrend {
    date: string;
    started: number;
    completed: number;
    subscribed: number;
    skipped: number;
}

interface FirstLessonData {
    summary: {
        totalStarted: number;
        totalCompleted: number;
        totalPaused: number;
        completionRate: number;
        pauseRate: number;
    };
    funnel: FunnelStep[];
    dropoffs: TutorialDropoff[];
    dailyTrends: { date: string; started: number; completed: number; paused: number }[];
}

interface OnboardingData {
    success: boolean;
    period: { days: number; startDate: string };
    summary: {
        totalUsers: number;
        totalSessions: number;
        totalEvents: number;
        conversionRate: number;
        skipRate: number;
    };
    funnel: FunnelStep[];
    eventCounts: Record<string, number>;
    dailyTrends: DailyTrend[];
    planPreference: { annual: number; monthly: number };
    firstLesson?: FirstLessonData;
}

interface GoalData {
    goal: string;
    count: number;
    percentage: number;
}

interface FeatureData {
    feature: string;
    count: number;
    percentage: number;
}

interface PreferencesData {
    success: boolean;
    period: { days: number; startDate: string };
    summary: {
        totalUsers: number;
        usersWithGoals: number;
        usersWithFeatures: number;
    };
    goals: GoalData[];
    features: FeatureData[];
}

interface RetentionCohort {
    date?: string;
    weekStart?: string;
    cohortSize: number;
    day1: number | null;
    day3: number | null;
    day7: number | null;
    day14: number | null;
    day21: number | null;
    day30: number | null;
}

interface RetentionData {
    success: boolean;
    period: { days: number; startDate: string };
    summary: {
        totalUsers: number;
        avgRetention: {
            day1: number | null;
            day3: number | null;
            day7: number | null;
            day14: number | null;
            day21: number | null;
            day30: number | null;
        };
    };
    retentionDays: number[];
    dailyCohorts: RetentionCohort[];
    weeklyCohorts: RetentionCohort[];
}

interface SurveyFeedback {
    id: string;
    userId: string;
    email?: string;
    feedback: string;
    npsScore?: number;
    createdAt: string;
    platform?: string;
    subscriptionStatus?: string;
}

interface SurveyData {
    success: boolean;
    analytics: {
        totalResponses: number;
        dateRange: { start: string; end: string; days: number };
        contentPreferences: {
            games: number;
            books: number;
            audioDramas: number;
            lessons: number;
            songs: number;
        };
        nps: {
            averageScore: number;
            npsScore: number; // -100 to 100
            totalResponses: number;
            breakdown: {
                promoters: number;
                passives: number;
                detractors: number;
            };
            distribution: Record<string, number>;
        };
        recentFeedback: SurveyFeedback[];
        dailyResponses: Record<string, number>;
    };
}

interface TutorialData {
    success: boolean;
    period: { days: number; startDate: string };
    summary: {
        totalUsers: number;
        totalSessions: number;
        totalEvents: number;
        completionRate: number;
        skipCount: number;
        avgStepsCompleted: number;
    };
    funnel: FunnelStep[];
    stepCounts: Record<string, number>;
    dropoffs: TutorialDropoff[];
    dailyTrends: DailyTrend[];
}

// API Base URL
const getApiBase = () => {
    let base = import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
    base = base.replace(/\/$/, '');
    if (!base.endsWith('/api')) {
        base = `${base}/api`;
    }
    return base;
};
const API_BASE = getApiBase();

const OnboardingAnalytics: React.FC = () => {
    const [data, setData] = useState<OnboardingData | null>(null);
    const [tutorialData, setTutorialData] = useState<TutorialData | null>(null);
    const [preferencesData, setPreferencesData] = useState<PreferencesData | null>(null);
    const [retentionData, setRetentionData] = useState<RetentionData | null>(null);
    const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(7);
    const [activeTab, setActiveTab] = useState<'onboarding' | 'tutorial' | 'firstLesson' | 'retention' | 'survey'>('onboarding');

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch onboarding, tutorial, preferences, retention, and survey data in parallel
            const [onboardingRes, tutorialRes, preferencesRes, retentionRes, surveyRes] = await Promise.all([
                fetch(`${API_BASE}/analytics/onboarding?days=${days}`),
                fetch(`${API_BASE}/analytics/tutorial?days=${days}`),
                fetch(`${API_BASE}/analytics/onboarding/preferences?days=${days}`),
                fetch(`${API_BASE}/analytics/retention?days=${Math.max(days, 30)}`), // At least 30 days for retention
                fetch(`${API_BASE}/survey/analytics?days=${days}`),
            ]);
            
            const onboardingResult = await onboardingRes.json();
            const tutorialResult = await tutorialRes.json();
            const preferencesResult = await preferencesRes.json();
            const retentionResult = await retentionRes.json();
            const surveyResult = await surveyRes.json();
            
            if (onboardingResult.success) {
                setData(onboardingResult);
            }
            if (tutorialResult.success) {
                setTutorialData(tutorialResult);
            }
            if (preferencesResult.success) {
                setPreferencesData(preferencesResult);
            }
            if (retentionResult.success) {
                setRetentionData(retentionResult);
            }
            if (surveyResult.success) {
                setSurveyData(surveyResult);
            }
            
            if (!onboardingResult.success && !tutorialResult.success) {
                setError('Failed to fetch analytics data');
            }
        } catch (err) {
            setError('Failed to connect to server');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [days]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <p className="text-red-600">{error}</p>
                <button 
                    onClick={fetchData}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Calculate max for chart scaling
    const maxDaily = data ? Math.max(...data.dailyTrends.map(d => d.started), 1) : 1;
    const maxTutorialDaily = tutorialData ? Math.max(...tutorialData.dailyTrends.map(d => d.started), 1) : 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-indigo-600" />
                        Onboarding & Tutorial Analytics
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Track user journey through tutorial-first onboarding flow
                    </p>
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                        <strong>Flow:</strong> Started → Account Created → Step 1 (Parent) → Step 2 (Family) → Step 3 (Goals) → Step 4 (Features) → Step 5 (Voice) → Step 6 (Paywall Shown) → Step 7 (Exit Paywall) / Step 8 (Start Trial) → Subscribed
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value={1}>Last 24 hours</option>
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <button 
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('onboarding')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'onboarding'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Onboarding Flow
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('tutorial')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'tutorial'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Tutorial (First Step)
                        {tutorialData && tutorialData.summary.totalUsers > 0 && (
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                                {tutorialData.summary.totalUsers}
                            </span>
                        )}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('firstLesson')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'firstLesson'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <PlayCircle className="w-4 h-4" />
                        First Lesson
                        {data?.firstLesson && data.firstLesson.summary.totalStarted > 0 && (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                {data.firstLesson.summary.completionRate}%
                            </span>
                        )}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('retention')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'retention'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Retention
                        {retentionData && retentionData.summary.avgRetention.day7 !== null && (
                            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                                D7: {retentionData.summary.avgRetention.day7}%
                            </span>
                        )}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('survey')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'survey'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        User Surveys
                        {surveyData && surveyData.analytics.totalResponses > 0 && (
                            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                                {surveyData.analytics.totalResponses}
                            </span>
                        )}
                    </span>
                </button>
            </div>

            {/* ============ ONBOARDING TAB ============ */}
            {activeTab === 'onboarding' && data && (
            <>
            {/* Splash Page Stats */}
            {(data.eventCounts['splash_page_viewed'] || data.eventCounts['splash_explore_clicked']) && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        Splash Page Performance
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Page Views</div>
                            <p className="text-2xl font-bold text-indigo-600">
                                {(data.eventCounts['splash_page_viewed'] || 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Clicked "Let's Explore"</div>
                            <p className="text-2xl font-bold text-green-600">
                                {(data.eventCounts['splash_explore_clicked'] || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {data.eventCounts['splash_page_viewed'] > 0 
                                    ? `${((data.eventCounts['splash_explore_clicked'] || 0) / data.eventCounts['splash_page_viewed'] * 100).toFixed(1)}% of views`
                                    : '—'}
                            </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Clicked "Sign In"</div>
                            <p className="text-2xl font-bold text-blue-600">
                                {(data.eventCounts['splash_signin_clicked'] || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {data.eventCounts['splash_page_viewed'] > 0 
                                    ? `${((data.eventCounts['splash_signin_clicked'] || 0) / data.eventCounts['splash_page_viewed'] * 100).toFixed(1)}% of views`
                                    : '—'}
                            </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Bounce Rate</div>
                            <p className="text-2xl font-bold text-red-600">
                                {data.eventCounts['splash_page_viewed'] > 0 
                                    ? `${(100 - (((data.eventCounts['splash_explore_clicked'] || 0) + (data.eventCounts['splash_signin_clicked'] || 0)) / data.eventCounts['splash_page_viewed'] * 100)).toFixed(1)}%`
                                    : '—'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Users who left without clicking
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Users className="w-4 h-4" />
                        Total Users
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{data.summary.totalUsers.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <UserPlus className="w-4 h-4 text-blue-500" />
                        Sessions
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{data.summary.totalSessions.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <BarChart3 className="w-4 h-4 text-purple-500" />
                        Events
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{data.summary.totalEvents.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Crown className="w-4 h-4 text-green-500" />
                        Conversion Rate
                    </div>
                    <p className="text-2xl font-bold text-green-600">{data.summary.conversionRate}%</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <XCircle className="w-4 h-4 text-red-500" />
                        Skip Rate
                    </div>
                    <p className="text-2xl font-bold text-red-600">{data.summary.skipRate}%</p>
                </div>
            </div>

            {/* Funnel Visualization */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-indigo-600" />
                    Onboarding Funnel
                </h3>
                <div className="space-y-3">
                    {data.funnel.map((step, idx) => (
                        <div key={step.step} className="flex items-center gap-4">
                            <div className="w-40 text-sm font-medium text-gray-700 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">
                                    {idx + 1}
                                </span>
                                {step.step}
                            </div>
                            <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden relative">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                                    style={{ width: `${step.rate}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-semibold text-gray-700">
                                        {step.count.toLocaleString()} ({step.rate}%)
                                    </span>
                                </div>
                            </div>
                            {idx > 0 && (
                                <div className={`text-xs font-medium ${
                                    step.rate >= data.funnel[idx - 1].rate * 0.8 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    {step.rate >= data.funnel[idx - 1].rate * 0.8 ? (
                                        <ArrowUpRight className="w-4 h-4" />
                                    ) : (
                                        <ArrowDownRight className="w-4 h-4" />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Trends & Plan Preference */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Daily Trends Chart */}
                <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Daily Trends (Last 14 Days)
                    </h3>
                    <div className="h-48 flex items-end gap-1">
                        {data.dailyTrends.map((day, idx) => (
                            <div 
                                key={idx}
                                className="flex-1 flex flex-col items-center justify-end group"
                                style={{ height: '100%' }}
                            >
                                <div className="w-full flex flex-col gap-0.5">
                                    {/* Subscribed */}
                                    <div 
                                        className="w-full bg-green-500 rounded-t"
                                        style={{ 
                                            height: day.subscribed > 0 ? `${Math.max((day.subscribed / maxDaily) * 100, 8)}px` : '0px'
                                        }}
                                        title={`${day.subscribed} subscribed`}
                                    />
                                    {/* Completed */}
                                    <div 
                                        className="w-full bg-blue-500"
                                        style={{ 
                                            height: day.completed > 0 ? `${Math.max(((day.completed - day.subscribed) / maxDaily) * 100, 4)}px` : '0px'
                                        }}
                                        title={`${day.completed} completed`}
                                    />
                                    {/* Started */}
                                    <div 
                                        className="w-full bg-indigo-300 rounded-b"
                                        style={{ 
                                            height: day.started > 0 ? `${Math.max(((day.started - day.completed) / maxDaily) * 100, 4)}px` : '0px'
                                        }}
                                        title={`${day.started} started`}
                                    />
                                </div>
                                {idx % 2 === 0 && (
                                    <span className="text-[9px] text-gray-400 mt-1 -rotate-45 origin-left whitespace-nowrap">
                                        {formatDate(day.date)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-4 mt-4 text-xs">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-indigo-300 rounded" />
                            <span className="text-gray-600">Started</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-blue-500 rounded" />
                            <span className="text-gray-600">Completed</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded" />
                            <span className="text-gray-600">Subscribed</span>
                        </div>
                    </div>
                </div>

                {/* Plan Preference */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Plan Preference</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Annual</span>
                                <span className="font-semibold text-gray-800">{data.planPreference.annual}</span>
                            </div>
                            <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div 
                                    className="h-full bg-green-500 rounded-full"
                                    style={{ 
                                        width: `${(data.planPreference.annual / (data.planPreference.annual + data.planPreference.monthly || 1)) * 100}%` 
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Monthly</span>
                                <span className="font-semibold text-gray-800">{data.planPreference.monthly}</span>
                            </div>
                            <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ 
                                        width: `${(data.planPreference.monthly / (data.planPreference.annual + data.planPreference.monthly || 1)) * 100}%` 
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Event Counts */}
                    <h4 className="text-sm font-semibold text-gray-700 mt-6 mb-3">Event Breakdown</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {Object.entries(data.eventCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([event, count]) => (
                                <div key={event} className="flex justify-between text-xs">
                                    <span className="text-gray-500 truncate">{event.replace(/_/g, ' ')}</span>
                                    <span className="font-medium text-gray-700">{count}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* User Preferences: Goals & Features */}
            {preferencesData && (preferencesData.goals.length > 0 || preferencesData.features.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Discipleship Goals */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        Discipleship Goals
                        <span className="text-xs font-normal text-gray-500 ml-auto">
                            {preferencesData.summary.usersWithGoals} users
                        </span>
                    </h3>
                    {preferencesData.goals.length > 0 ? (
                        <div className="space-y-3">
                            {preferencesData.goals.map((item, idx) => (
                                <div key={item.goal}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-700 flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                idx === 1 ? 'bg-gray-100 text-gray-600' :
                                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                                'bg-gray-50 text-gray-500'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <span className="truncate max-w-[180px]" title={item.goal}>
                                                {item.goal}
                                            </span>
                                        </span>
                                        <span className="text-sm font-semibold text-purple-600">
                                            {item.count} ({item.percentage}%)
                                        </span>
                                    </div>
                                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-500"
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No goal data collected yet</p>
                    )}
                </div>

                {/* Feature Interests */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Feature Interests
                        <span className="text-xs font-normal text-gray-500 ml-auto">
                            {preferencesData.summary.usersWithFeatures} users
                        </span>
                    </h3>
                    {preferencesData.features.length > 0 ? (
                        <div className="space-y-3">
                            {preferencesData.features.map((item, idx) => (
                                <div key={item.feature}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-700 flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                idx === 1 ? 'bg-gray-100 text-gray-600' :
                                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                                'bg-gray-50 text-gray-500'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <span className="truncate max-w-[180px]" title={item.feature}>
                                                {item.feature}
                                            </span>
                                        </span>
                                        <span className="text-sm font-semibold text-amber-600">
                                            {item.count} ({item.percentage}%)
                                        </span>
                                    </div>
                                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500"
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No feature data collected yet</p>
                    )}
                </div>
            </div>
            )}
            </>
            )}

            {/* ============ TUTORIAL TAB ============ */}
            {activeTab === 'tutorial' && tutorialData && (
            <>
            {/* Tutorial Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Users className="w-4 h-4" />
                        Users Started
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{tutorialData.summary.totalUsers.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <BarChart3 className="w-4 h-4 text-purple-500" />
                        Total Events
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{tutorialData.summary.totalEvents.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Completion Rate
                    </div>
                    <p className="text-2xl font-bold text-green-600">{tutorialData.summary.completionRate}%</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                        Avg Steps
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{tutorialData.summary.avgStepsCompleted}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <XCircle className="w-4 h-4 text-red-500" />
                        Skipped
                    </div>
                    <p className="text-2xl font-bold text-red-600">{tutorialData.summary.skipCount}</p>
                </div>
            </div>

            {/* Tutorial Funnel */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-indigo-600" />
                    Tutorial Funnel
                </h3>
                <div className="space-y-3">
                    {tutorialData.funnel.map((step, idx) => (
                        <div key={step.step} className="flex items-center gap-4">
                            <div className="w-40 text-sm font-medium text-gray-700 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">
                                    {idx + 1}
                                </span>
                                <span className="truncate" title={step.step}>{step.step}</span>
                            </div>
                            <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden relative">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        step.stepKey === 'complete' || step.stepKey === 'tutorial_complete' 
                                            ? 'bg-gradient-to-r from-green-500 to-green-600' 
                                            : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                                    }`}
                                    style={{ width: `${step.rate}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-semibold text-gray-700">
                                        {step.count.toLocaleString()} ({step.rate}%)
                                    </span>
                                </div>
                            </div>
                            {idx > 0 && (
                                <div className={`text-xs font-medium ${
                                    step.rate >= tutorialData.funnel[idx - 1].rate * 0.8 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    {step.rate >= tutorialData.funnel[idx - 1].rate * 0.8 ? (
                                        <ArrowUpRight className="w-4 h-4" />
                                    ) : (
                                        <ArrowDownRight className="w-4 h-4" />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Drop-off Points & Daily Trends */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Drop-off Points */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Top Drop-off Points
                    </h3>
                    {tutorialData.dropoffs.length > 0 ? (
                        <div className="space-y-3">
                            {tutorialData.dropoffs.map((dropoff, idx) => (
                                <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-500">
                                            {dropoff.from} → {dropoff.to}
                                        </span>
                                        <span className="text-red-600 font-bold text-sm">
                                            -{dropoff.dropRate}%
                                        </span>
                                    </div>
                                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-red-500 rounded-full"
                                            style={{ width: `${dropoff.dropRate}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {dropoff.dropped} users dropped
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No significant drop-offs detected</p>
                    )}
                </div>

                {/* Daily Trends Chart */}
                <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Daily Tutorial Starts
                    </h3>
                    <div className="h-48 flex items-end gap-1">
                        {tutorialData.dailyTrends.map((day, idx) => (
                            <div 
                                key={idx}
                                className="flex-1 flex flex-col items-center justify-end group"
                                style={{ height: '100%' }}
                            >
                                <div className="w-full flex flex-col gap-0.5">
                                    {/* Completed */}
                                    <div 
                                        className="w-full bg-green-500 rounded-t"
                                        style={{ 
                                            height: day.completed > 0 ? `${Math.max((day.completed / maxTutorialDaily) * 100, 8)}px` : '0px'
                                        }}
                                        title={`${day.completed} completed`}
                                    />
                                    {/* Started */}
                                    <div 
                                        className="w-full bg-indigo-400 rounded-b"
                                        style={{ 
                                            height: day.started > 0 ? `${Math.max(((day.started - day.completed) / maxTutorialDaily) * 100, 4)}px` : '0px'
                                        }}
                                        title={`${day.started} started`}
                                    />
                                </div>
                                {idx % 2 === 0 && (
                                    <span className="text-[9px] text-gray-400 mt-1 -rotate-45 origin-left whitespace-nowrap">
                                        {formatDate(day.date)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-4 mt-4 text-xs">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-indigo-400 rounded" />
                            <span className="text-gray-600">Started</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded" />
                            <span className="text-gray-600">Completed</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step Counts Detail */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">All Step Events</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Object.entries(tutorialData.stepCounts)
                        .filter(([_, count]) => count > 0)
                        .sort((a, b) => b[1] - a[1])
                        .map(([step, count]) => (
                            <div key={step} className="bg-gray-50 rounded-lg p-3 text-center">
                                <p className="text-xs text-gray-500 truncate" title={step.replace(/_/g, ' ')}>
                                    {step.replace(/_/g, ' ')}
                                </p>
                                <p className="text-lg font-bold text-gray-800">{count}</p>
                            </div>
                        ))
                    }
                </div>
            </div>
            </>
            )}

            {/* ============ FIRST LESSON TAB ============ */}
            {activeTab === 'firstLesson' && data?.firstLesson && (
            <>
            {/* First Lesson Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <PlayCircle className="w-4 h-4 text-blue-500" />
                        Lessons Started
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{data.firstLesson.summary.totalStarted.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Completed
                    </div>
                    <p className="text-2xl font-bold text-green-600">{data.firstLesson.summary.totalCompleted.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <PauseCircle className="w-4 h-4 text-orange-500" />
                        Paused/Exited
                    </div>
                    <p className="text-2xl font-bold text-orange-600">{data.firstLesson.summary.totalPaused.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        Completion Rate
                    </div>
                    <p className="text-2xl font-bold text-green-600">{data.firstLesson.summary.completionRate}%</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <XCircle className="w-4 h-4 text-red-500" />
                        Pause Rate
                    </div>
                    <p className="text-2xl font-bold text-red-600">{data.firstLesson.summary.pauseRate}%</p>
                </div>
            </div>

            {/* First Lesson Funnel */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-blue-600" />
                    First Lesson Funnel (Daily Session Progress)
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                    Track how users progress through their first daily session: Learn → Read → Pray
                </p>
                <div className="space-y-3">
                    {data.firstLesson.funnel.map((step, idx) => (
                        <div key={step.stepKey} className="flex items-center gap-4">
                            <div className="w-44 text-sm font-medium text-gray-700 flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                                    step.stepKey === 'completed' 
                                        ? 'bg-green-100 text-green-600' 
                                        : 'bg-blue-100 text-blue-600'
                                }`}>
                                    {idx + 1}
                                </span>
                                <span className="truncate" title={step.step}>{step.step}</span>
                            </div>
                            <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden relative">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        step.stepKey === 'completed'
                                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                                            : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                    }`}
                                    style={{ width: `${step.rate}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-semibold text-gray-700">
                                        {step.count.toLocaleString()} ({step.rate}%)
                                    </span>
                                </div>
                            </div>
                            {idx > 0 && (
                                <div className={`text-xs font-medium ${
                                    step.rate >= data.firstLesson.funnel[idx - 1].rate * 0.8 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    {step.rate >= data.firstLesson.funnel[idx - 1].rate * 0.8 ? (
                                        <ArrowUpRight className="w-4 h-4" />
                                    ) : (
                                        <ArrowDownRight className="w-4 h-4" />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Drop-off Points & Daily Trends */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Drop-off Points */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Biggest Drop-offs
                    </h3>
                    {data.firstLesson.dropoffs.length > 0 ? (
                        <div className="space-y-3">
                            {data.firstLesson.dropoffs.map((dropoff, idx) => (
                                <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-500">
                                            {dropoff.from} → {dropoff.to}
                                        </span>
                                        <span className="text-red-600 font-bold text-sm">
                                            -{dropoff.dropRate}%
                                        </span>
                                    </div>
                                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-red-500 rounded-full"
                                            style={{ width: `${dropoff.dropRate}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {dropoff.dropped} users dropped
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No significant drop-offs detected</p>
                    )}
                </div>

                {/* Daily Trends Chart */}
                <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Daily First Lesson Activity
                    </h3>
                    <div className="h-48 flex items-end gap-1">
                        {data.firstLesson.dailyTrends.map((day, idx) => {
                            const maxVal = Math.max(...data.firstLesson.dailyTrends.map(d => d.started), 1);
                            return (
                                <div 
                                    key={idx}
                                    className="flex-1 flex flex-col items-center justify-end group"
                                    style={{ height: '100%' }}
                                >
                                    <div className="w-full flex flex-col gap-0.5">
                                        {/* Completed */}
                                        <div 
                                            className="w-full bg-green-500 rounded-t"
                                            style={{ 
                                                height: day.completed > 0 ? `${Math.max((day.completed / maxVal) * 100, 8)}px` : '0px'
                                            }}
                                            title={`${day.completed} completed`}
                                        />
                                        {/* Paused */}
                                        <div 
                                            className="w-full bg-orange-400"
                                            style={{ 
                                                height: day.paused > 0 ? `${Math.max((day.paused / maxVal) * 100, 4)}px` : '0px'
                                            }}
                                            title={`${day.paused} paused`}
                                        />
                                        {/* Started (remainder) */}
                                        <div 
                                            className="w-full bg-blue-400 rounded-b"
                                            style={{ 
                                                height: day.started > 0 ? `${Math.max(((day.started - day.completed - day.paused) / maxVal) * 100, 4)}px` : '0px'
                                            }}
                                            title={`${day.started} started`}
                                        />
                                    </div>
                                    {idx % 2 === 0 && (
                                        <span className="text-[9px] text-gray-400 mt-1 -rotate-45 origin-left whitespace-nowrap">
                                            {formatDate(day.date)}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-4 mt-4 text-xs">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-blue-400 rounded" />
                            <span className="text-gray-600">Started</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-orange-400 rounded" />
                            <span className="text-gray-600">Paused</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded" />
                            <span className="text-gray-600">Completed</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lesson Flow Explanation */}
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Understanding the First Lesson Flow
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <p className="font-medium text-blue-800">1. Goal Selection</p>
                        <p className="text-gray-500 text-xs mt-1">User picks a character trait (courage, faith, love, etc.)</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <p className="font-medium text-blue-800">2. Reading</p>
                        <p className="text-gray-500 text-xs mt-1">User reads the recommended book</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <p className="font-medium text-blue-800">3. Discussion</p>
                        <p className="text-gray-500 text-xs mt-1">AI-generated discussion questions</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <p className="font-medium text-blue-800">4. Prayer</p>
                        <p className="text-gray-500 text-xs mt-1">Prayer time with selected intentions</p>
                    </div>
                </div>
            </div>
            </>
            )}

            {activeTab === 'firstLesson' && (!data?.firstLesson || data.firstLesson.summary.totalStarted === 0) && (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <PlayCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No first lesson data available yet</p>
                    <p className="text-gray-400 text-sm mt-2">First lesson analytics will appear once users start the daily session flow</p>
                </div>
            )}

            {/* No Data State */}
            {activeTab === 'onboarding' && !data && (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No onboarding data available for this period</p>
                </div>
            )}
            {activeTab === 'tutorial' && !tutorialData && (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No tutorial data available yet</p>
                    <p className="text-gray-400 text-sm mt-2">Tutorial is now the first step - users click "Let's Explore" and start the tutorial immediately</p>
                </div>
            )}

            {/* ============ RETENTION TAB ============ */}
            {activeTab === 'retention' && retentionData && (
            <>
            {/* Retention Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[1, 3, 7, 14, 21, 30].map(day => {
                    const key = `day${day}` as keyof typeof retentionData.summary.avgRetention;
                    const value = retentionData.summary.avgRetention[key];
                    const isGood = value !== null && value >= (day <= 7 ? 30 : day <= 14 ? 20 : 10);
                    return (
                        <div key={day} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <span className={`w-2 h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-orange-400'}`} />
                                Day {day}
                            </div>
                            <p className={`text-2xl font-bold ${value !== null ? (isGood ? 'text-green-600' : 'text-orange-600') : 'text-gray-400'}`}>
                                {value !== null ? `${value}%` : '—'}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Retention Curve */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Retention Curve (Average)
                </h3>
                <div className="h-48 flex items-end gap-4 px-4">
                    {[1, 3, 7, 14, 21, 30].map(day => {
                        const key = `day${day}` as keyof typeof retentionData.summary.avgRetention;
                        const value = retentionData.summary.avgRetention[key];
                        return (
                            <div key={day} className="flex-1 flex flex-col items-center">
                                <div 
                                    className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t transition-all duration-500"
                                    style={{ 
                                        height: value !== null ? `${Math.max(value * 1.5, 8)}px` : '4px',
                                        opacity: value !== null ? 1 : 0.3,
                                    }}
                                />
                                <div className="text-center mt-2">
                                    <p className="text-xs font-semibold text-gray-700">
                                        {value !== null ? `${value}%` : '—'}
                                    </p>
                                    <p className="text-[10px] text-gray-400">Day {day}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-xs text-gray-500 mt-4 text-center">
                    Based on {retentionData.summary.totalUsers} users over {retentionData.period.days} days
                </p>
            </div>

            {/* Weekly Cohorts Table */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm overflow-x-auto">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    Weekly Cohort Retention
                </h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th className="pb-3 pr-4">Week</th>
                            <th className="pb-3 px-3 text-center">Users</th>
                            <th className="pb-3 px-3 text-center">D1</th>
                            <th className="pb-3 px-3 text-center">D3</th>
                            <th className="pb-3 px-3 text-center">D7</th>
                            <th className="pb-3 px-3 text-center">D14</th>
                            <th className="pb-3 px-3 text-center">D21</th>
                            <th className="pb-3 px-3 text-center">D30</th>
                        </tr>
                    </thead>
                    <tbody>
                        {retentionData.weeklyCohorts.map((cohort, idx) => (
                            <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-3 pr-4 font-medium text-gray-700">
                                    {new Date(cohort.weekStart || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </td>
                                <td className="py-3 px-3 text-center text-gray-600">{cohort.cohortSize}</td>
                                {[1, 3, 7, 14, 21, 30].map(day => {
                                    const key = `day${day}` as keyof RetentionCohort;
                                    const value = cohort[key] as number | null;
                                    const bgColor = value === null ? 'bg-gray-100' : 
                                        value >= 50 ? 'bg-green-100 text-green-700' :
                                        value >= 30 ? 'bg-green-50 text-green-600' :
                                        value >= 20 ? 'bg-yellow-50 text-yellow-700' :
                                        value >= 10 ? 'bg-orange-50 text-orange-600' :
                                        'bg-red-50 text-red-600';
                                    return (
                                        <td key={day} className="py-3 px-3 text-center">
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${bgColor}`}>
                                                {value !== null ? `${value}%` : '—'}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {retentionData.weeklyCohorts.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No cohort data available yet</p>
                )}
            </div>

            {/* Retention Tips */}
            <div className="bg-purple-50 rounded-xl border border-purple-100 p-6">
                <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Retention Benchmarks
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <p className="font-medium text-purple-800">Day 1 Retention</p>
                        <p className="text-purple-600 text-xs mt-1">Good: 40%+ | Average: 25-40%</p>
                        <p className="text-gray-500 text-xs mt-2">Users who return the day after signup</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <p className="font-medium text-purple-800">Day 7 Retention</p>
                        <p className="text-purple-600 text-xs mt-1">Good: 20%+ | Average: 10-20%</p>
                        <p className="text-gray-500 text-xs mt-2">Users who return after one week</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <p className="font-medium text-purple-800">Day 30 Retention</p>
                        <p className="text-purple-600 text-xs mt-1">Good: 10%+ | Average: 5-10%</p>
                        <p className="text-gray-500 text-xs mt-2">Users who return after one month</p>
                    </div>
                </div>
            </div>
            </>
            )}

            {activeTab === 'retention' && !retentionData && (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No retention data available yet</p>
                    <p className="text-gray-400 text-sm mt-2">Retention metrics require user activity data over time</p>
                </div>
            )}

            {/* ============ SURVEY TAB ============ */}
            {activeTab === 'survey' && surveyData && (
            <>
            {/* Survey Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-amber-600" />
                        </div>
                        <span className="text-gray-600 text-sm">Total Responses</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                        {surveyData.analytics.totalResponses}
                    </p>
                </div>
                
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Star className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-gray-600 text-sm">Avg NPS Score</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                        {surveyData.analytics.nps.averageScore.toFixed(1)}
                        <span className="text-lg text-gray-400">/10</span>
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${
                            surveyData.analytics.nps.npsScore >= 50 ? 'bg-green-100' :
                            surveyData.analytics.nps.npsScore >= 0 ? 'bg-yellow-100' : 'bg-red-100'
                        }`}>
                            {surveyData.analytics.nps.npsScore >= 50 ? (
                                <ThumbsUp className="w-5 h-5 text-green-600" />
                            ) : surveyData.analytics.nps.npsScore >= 0 ? (
                                <Target className="w-5 h-5 text-yellow-600" />
                            ) : (
                                <ThumbsDown className="w-5 h-5 text-red-600" />
                            )}
                        </div>
                        <span className="text-gray-600 text-sm">NPS Score</span>
                    </div>
                    <p className={`text-3xl font-bold ${
                        surveyData.analytics.nps.npsScore >= 50 ? 'text-green-600' :
                        surveyData.analytics.nps.npsScore >= 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                        {surveyData.analytics.nps.npsScore > 0 ? '+' : ''}{surveyData.analytics.nps.npsScore}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Scale: -100 to +100</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-gray-600 text-sm">Promoters</span>
                    </div>
                    <p className="text-3xl font-bold text-green-600">
                        {surveyData.analytics.nps.breakdown.promoters}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Score 9-10 (would refer)</p>
                </div>
            </div>

            {/* Content Preferences */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    What Users Want More Of
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[
                        { key: 'games', label: 'Games', icon: Gamepad2, color: 'purple' },
                        { key: 'books', label: 'Books', icon: BookOpen, color: 'blue' },
                        { key: 'audioDramas', label: 'Audio Dramas', icon: Headphones, color: 'orange' },
                        { key: 'lessons', label: 'Lessons', icon: Target, color: 'green' },
                        { key: 'songs', label: 'Songs', icon: Music, color: 'pink' },
                    ].map(item => {
                        const count = surveyData.analytics.contentPreferences[item.key as keyof typeof surveyData.analytics.contentPreferences];
                        const percentage = surveyData.analytics.totalResponses > 0 
                            ? Math.round((count / surveyData.analytics.totalResponses) * 100) 
                            : 0;
                        const colorClasses = {
                            purple: 'bg-purple-100 text-purple-600 border-purple-200',
                            blue: 'bg-blue-100 text-blue-600 border-blue-200',
                            orange: 'bg-orange-100 text-orange-600 border-orange-200',
                            green: 'bg-green-100 text-green-600 border-green-200',
                            pink: 'bg-pink-100 text-pink-600 border-pink-200',
                        };
                        const Icon = item.icon;
                        return (
                            <div key={item.key} className={`rounded-xl border p-4 text-center ${colorClasses[item.color as keyof typeof colorClasses]}`}>
                                <Icon className="w-8 h-8 mx-auto mb-2" />
                                <p className="font-semibold text-lg">{count}</p>
                                <p className="text-sm opacity-80">{item.label}</p>
                                <p className="text-xs mt-1 opacity-60">{percentage}% of users</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* NPS Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Referral Likelihood Distribution (1-10)
                </h3>
                <div className="flex items-end gap-2 h-40">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                        const count = surveyData.analytics.nps.distribution[score] || 0;
                        const maxCount = Math.max(...Object.values(surveyData.analytics.nps.distribution), 1);
                        const height = (count / maxCount) * 100;
                        const colorClass = score >= 9 ? 'bg-green-500' : score >= 7 ? 'bg-yellow-400' : 'bg-red-400';
                        return (
                            <div key={score} className="flex-1 flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">{count}</span>
                                <div 
                                    className={`w-full rounded-t ${colorClass} transition-all`}
                                    style={{ height: `${Math.max(height, 4)}%` }}
                                />
                                <span className="text-xs font-medium mt-2 text-gray-600">{score}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-400 rounded" />
                        <span className="text-gray-500">Detractors (1-6): {surveyData.analytics.nps.breakdown.detractors}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-400 rounded" />
                        <span className="text-gray-500">Passives (7-8): {surveyData.analytics.nps.breakdown.passives}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded" />
                        <span className="text-gray-500">Promoters (9-10): {surveyData.analytics.nps.breakdown.promoters}</span>
                    </div>
                </div>
            </div>

            {/* Recent Feedback */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-500" />
                    Recent User Feedback
                </h3>
                {surveyData.analytics.recentFeedback.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {surveyData.analytics.recentFeedback.map((feedback) => (
                            <div key={feedback.id} className="border-l-4 border-amber-300 pl-4 py-2 bg-amber-50 rounded-r-lg">
                                <p className="text-gray-700">{feedback.feedback}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span>{feedback.email || feedback.userId}</span>
                                    {feedback.npsScore && (
                                        <span className={`px-2 py-0.5 rounded ${
                                            feedback.npsScore >= 9 ? 'bg-green-100 text-green-700' :
                                            feedback.npsScore >= 7 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            NPS: {feedback.npsScore}
                                        </span>
                                    )}
                                    {feedback.platform && (
                                        <span className="text-gray-400">{feedback.platform}</span>
                                    )}
                                    <span className="text-gray-400">
                                        {new Date(feedback.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No feedback comments yet</p>
                )}
            </div>

            {/* NPS Explanation */}
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-6">
                <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Understanding NPS Score
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white rounded-lg p-4 border border-amber-100">
                        <p className="font-medium text-green-700">Excellent: +50 to +100</p>
                        <p className="text-gray-500 text-xs mt-1">World-class user satisfaction</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-amber-100">
                        <p className="font-medium text-yellow-700">Good: 0 to +50</p>
                        <p className="text-gray-500 text-xs mt-1">More promoters than detractors</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-amber-100">
                        <p className="font-medium text-red-700">Needs Work: Below 0</p>
                        <p className="text-gray-500 text-xs mt-1">More detractors than promoters</p>
                    </div>
                </div>
            </div>
            </>
            )}

            {activeTab === 'survey' && !surveyData && (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No survey data available yet</p>
                    <p className="text-gray-400 text-sm mt-2">Survey responses will appear here after users complete the in-app survey (shown after 7 days of use)</p>
                </div>
            )}
        </div>
    );
};

export default OnboardingAnalytics;

