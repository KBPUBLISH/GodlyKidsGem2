import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, Users, UserPlus, Crown, XCircle, RefreshCw,
    ChevronRight, Calendar, BarChart3, ArrowDownRight, ArrowUpRight
} from 'lucide-react';

interface FunnelStep {
    step: string;
    count: number;
    rate: number;
}

interface DailyTrend {
    date: string;
    started: number;
    completed: number;
    subscribed: number;
    skipped: number;
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/analytics/onboarding?days=${days}`);
            const result = await response.json();
            if (result.success) {
                setData(result);
            } else {
                setError(result.message || 'Failed to fetch data');
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

    if (!data) return null;

    // Calculate max for chart scaling
    const maxDaily = Math.max(...data.dailyTrends.map(d => d.started), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-indigo-600" />
                        Onboarding Analytics
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Track user journey through onboarding and conversion rates
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
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
        </div>
    );
};

export default OnboardingAnalytics;

