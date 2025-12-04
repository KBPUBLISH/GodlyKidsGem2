import React, { useState, useEffect } from 'react';
import { 
    BarChart3, Users, Clock, TrendingUp, 
    BookOpen, Music, Video, Gamepad2,
    CreditCard, UserPlus, Activity, RefreshCw
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface OverviewData {
    dateRange: {
        startDate: string;
        endDate: string;
        range: string;
    };
    users: {
        total: number;
        totalTracked: number;
        newInRange: number;
        activeInRange: number;
    };
    sessions: {
        total: number;
        avgDurationSeconds: number;
    };
    subscriptions: {
        breakdown: {
            free: number;
            trial: number;
            active: number;
            cancelled: number;
            expired: number;
        };
        totalPaid: number;
        totalFree: number;
        conversionRate: number;
    };
    onboardingFunnel: {
        started: number;
        steps: Record<string, number>;
        completed: number;
        skipped: number;
        dropOffRate: string;
        completionRate: string;
    };
    dailyActiveUsers: Array<{ date: string; count: number }>;
    topContent: {
        topBooks: Array<{ _id: string; title: string; viewCount: number; readCount: number; likeCount: number }>;
        topPlaylists: Array<{ _id: string; title: string; viewCount: number; playCount: number; likeCount: number }>;
        topLessons: Array<{ _id: string; title: string; viewCount: number; completionCount: number }>;
    };
}

interface FeatureUsageData {
    dateRange: { startDate: string; endDate: string; range: string };
    features: Record<string, { totalEvents: number; uniqueUsers: number }>;
}

interface TopUser {
    rank: number;
    _id: string;
    email?: string;
    stats: {
        totalSessions: number;
        totalTimeSpent: number;
        booksRead: number;
        playlistsPlayed: number;
        lessonsCompleted: number;
        quizzesCompleted: number;
        coloringSessions: number;
        gamesPlayed: number;
    };
    kidProfileCount: number;
    subscriptionStatus: string;
    lastActiveAt: string;
}

const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
}> = ({ title, value, subtitle, icon, color }) => (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow`}>
        <div className="flex items-start justify-between">
            <div>
                <p className="text-gray-500 text-sm font-medium">{title}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-').replace('600', '100')}`}>
                {icon}
            </div>
        </div>
    </div>
);

const SimpleBarChart: React.FC<{
    data: Array<{ label: string; value: number }>;
    maxValue?: number;
    color?: string;
}> = ({ data, maxValue, color = 'bg-indigo-500' }) => {
    const max = maxValue || Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-2">
            {data.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 truncate" title={item.label}>
                        {item.label}
                    </span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${color} rounded-full transition-all duration-500`}
                            style={{ width: `${(item.value / max) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-12 text-right">
                        {item.value.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
};

const FunnelChart: React.FC<{
    steps: Array<{ label: string; value: number; percentage?: string }>;
}> = ({ steps }) => {
    const maxValue = Math.max(...steps.map(s => s.value), 1);
    return (
        <div className="space-y-3">
            {steps.map((step, index) => (
                <div key={index} className="relative">
                    <div 
                        className="h-10 bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-lg flex items-center justify-between px-4 transition-all duration-500"
                        style={{ 
                            width: `${Math.max((step.value / maxValue) * 100, 30)}%`,
                            marginLeft: `${((1 - step.value / maxValue) * 50) / 2}%`
                        }}
                    >
                        <span className="text-white text-sm font-medium truncate">{step.label}</span>
                        <span className="text-white text-sm font-bold">{step.value}</span>
                    </div>
                    {step.percentage && (
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                            {step.percentage}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

const AnalyticsDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d' | '90d' | 'all'>('30d');
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [featureUsage, setFeatureUsage] = useState<FeatureUsageData | null>(null);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [overviewRes, featuresRes, usersRes] = await Promise.all([
                apiClient.get(`/api/analytics/overview?range=${dateRange}`),
                apiClient.get(`/api/analytics/feature-usage?range=${dateRange}`),
                apiClient.get(`/api/analytics/top-users?range=${dateRange}&limit=10`),
            ]);
            setOverview(overviewRes.data);
            setFeatureUsage(featuresRes.data);
            setTopUsers(usersRes.data);
        } catch (err: any) {
            console.error('Error fetching analytics:', err);
            setError(err.response?.data?.error || 'Failed to fetch analytics data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const formatDuration = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${(seconds / 3600).toFixed(1)}h`;
    };

    const formatDate = (dateStr: string): string => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading && !overview) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
                    <p className="text-gray-500 mt-1">Monitor app usage and user engagement</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as any)}
                        className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="24h">Last 24 hours</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="all">All time</option>
                    </select>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {overview && (
                <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Users"
                            value={overview.users.total.toLocaleString()}
                            subtitle={`+${overview.users.newInRange} new`}
                            icon={<Users className="w-6 h-6 text-blue-600" />}
                            color="text-blue-600"
                        />
                        <StatCard
                            title="Active Users"
                            value={overview.users.activeInRange.toLocaleString()}
                            subtitle="in selected period"
                            icon={<Activity className="w-6 h-6 text-green-600" />}
                            color="text-green-600"
                        />
                        <StatCard
                            title="Total Sessions"
                            value={overview.sessions.total.toLocaleString()}
                            subtitle={`Avg: ${formatDuration(overview.sessions.avgDurationSeconds)}`}
                            icon={<Clock className="w-6 h-6 text-purple-600" />}
                            color="text-purple-600"
                        />
                        <StatCard
                            title="Conversion Rate"
                            value={`${overview.subscriptions.conversionRate}%`}
                            subtitle={`${overview.subscriptions.totalPaid} paid users`}
                            icon={<TrendingUp className="w-6 h-6 text-amber-600" />}
                            color="text-amber-600"
                        />
                    </div>

                    {/* Subscription Breakdown & Onboarding Funnel */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Subscription Breakdown */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <CreditCard className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Subscription Breakdown</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-green-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-green-600">{overview.subscriptions.totalPaid}</p>
                                    <p className="text-sm text-green-700">Paid Users</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-gray-600">{overview.subscriptions.totalFree}</p>
                                    <p className="text-sm text-gray-700">Free Users</p>
                                </div>
                            </div>
                            <SimpleBarChart
                                data={[
                                    { label: 'Active', value: overview.subscriptions.breakdown.active },
                                    { label: 'Trial', value: overview.subscriptions.breakdown.trial },
                                    { label: 'Free', value: overview.subscriptions.breakdown.free },
                                    { label: 'Cancelled', value: overview.subscriptions.breakdown.cancelled },
                                    { label: 'Expired', value: overview.subscriptions.breakdown.expired },
                                ]}
                                color="bg-indigo-500"
                            />
                        </div>

                        {/* Onboarding Funnel */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <UserPlus className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Onboarding Funnel</h2>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="text-center">
                                    <p className="text-xl font-bold text-indigo-600">{overview.onboardingFunnel.started}</p>
                                    <p className="text-xs text-gray-500">Started</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-bold text-green-600">{overview.onboardingFunnel.completed}</p>
                                    <p className="text-xs text-gray-500">Completed</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-bold text-amber-600">{overview.onboardingFunnel.completionRate}%</p>
                                    <p className="text-xs text-gray-500">Completion Rate</p>
                                </div>
                            </div>
                            <FunnelChart
                                steps={[
                                    { label: 'Started', value: overview.onboardingFunnel.started },
                                    ...Object.entries(overview.onboardingFunnel.steps)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([key, value]) => ({
                                            label: key.replace('step_', 'Step '),
                                            value,
                                        })),
                                    { label: 'Completed', value: overview.onboardingFunnel.completed },
                                ]}
                            />
                            <div className="mt-3 text-sm text-gray-500">
                                <span className="text-red-500">{overview.onboardingFunnel.dropOffRate}%</span> drop-off rate
                                {' • '}
                                <span>{overview.onboardingFunnel.skipped}</span> skipped
                            </div>
                        </div>
                    </div>

                    {/* Daily Active Users Chart */}
                    {overview.dailyActiveUsers.length > 0 && (
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Daily Active Users</h2>
                            </div>
                            <div className="h-48 flex items-end gap-1">
                                {overview.dailyActiveUsers.map((day, index) => {
                                    const maxCount = Math.max(...overview.dailyActiveUsers.map(d => d.count), 1);
                                    const height = (day.count / maxCount) * 100;
                                    return (
                                        <div 
                                            key={index}
                                            className="flex-1 flex flex-col items-center group"
                                        >
                                            <div className="relative w-full">
                                                <div 
                                                    className="bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors cursor-pointer w-full"
                                                    style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }}
                                                />
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {day.count} users
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-gray-400 mt-1 rotate-45 origin-left">
                                                {formatDate(day.date)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Top Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Top Books */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <BookOpen className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Top Books</h2>
                            </div>
                            {overview.topContent.topBooks.length > 0 ? (
                                <div className="space-y-3">
                                    {overview.topContent.topBooks.map((book, index) => (
                                        <div key={book._id} className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{book.title}</p>
                                                <p className="text-xs text-gray-500">
                                                    {book.viewCount || 0} views • {book.readCount || 0} reads • {book.likeCount || 0} likes
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm">No data yet</p>
                            )}
                        </div>

                        {/* Top Playlists */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <Music className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Top Playlists</h2>
                            </div>
                            {overview.topContent.topPlaylists.length > 0 ? (
                                <div className="space-y-3">
                                    {overview.topContent.topPlaylists.map((playlist, index) => (
                                        <div key={playlist._id} className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{playlist.title}</p>
                                                <p className="text-xs text-gray-500">
                                                    {playlist.viewCount || 0} views • {playlist.playCount || 0} plays • {playlist.likeCount || 0} likes
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm">No data yet</p>
                            )}
                        </div>

                        {/* Top Lessons */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <Video className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Top Lessons</h2>
                            </div>
                            {overview.topContent.topLessons.length > 0 ? (
                                <div className="space-y-3">
                                    {overview.topContent.topLessons.map((lesson, index) => (
                                        <div key={lesson._id} className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-bold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{lesson.title}</p>
                                                <p className="text-xs text-gray-500">
                                                    {lesson.viewCount || 0} views • {lesson.completionCount || 0} completions
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm">No data yet</p>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Feature Usage */}
            {featureUsage && Object.keys(featureUsage.features).length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Gamepad2 className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-800">Feature Usage</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Object.entries(featureUsage.features).map(([feature, data]) => (
                            <div key={feature} className="bg-gray-50 rounded-lg p-4 text-center">
                                <p className="text-lg font-bold text-gray-800">{data.totalEvents.toLocaleString()}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </p>
                                <p className="text-xs text-indigo-500 mt-1">{data.uniqueUsers} users</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Users Leaderboard */}
            {topUsers.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-800">Top Users</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase">Rank</th>
                                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase">User</th>
                                    <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Sessions</th>
                                    <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Time Spent</th>
                                    <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Books</th>
                                    <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Playlists</th>
                                    <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Kids</th>
                                    <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topUsers.map((user) => (
                                    <tr key={user._id} className="border-b border-gray-50 hover:bg-gray-50">
                                        <td className="py-3 px-2">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                user.rank === 1 ? 'bg-yellow-100 text-yellow-600' :
                                                user.rank === 2 ? 'bg-gray-200 text-gray-600' :
                                                user.rank === 3 ? 'bg-amber-100 text-amber-600' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                                {user.rank}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2">
                                            <p className="text-sm font-medium text-gray-800">
                                                {user.email || `User ${user._id.slice(-6)}`}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Last active: {new Date(user.lastActiveAt).toLocaleDateString()}
                                            </p>
                                        </td>
                                        <td className="py-3 px-2 text-center text-sm text-gray-700">
                                            {user.stats?.totalSessions || 0}
                                        </td>
                                        <td className="py-3 px-2 text-center text-sm text-gray-700">
                                            {formatDuration(user.stats?.totalTimeSpent || 0)}
                                        </td>
                                        <td className="py-3 px-2 text-center text-sm text-gray-700">
                                            {user.stats?.booksRead || 0}
                                        </td>
                                        <td className="py-3 px-2 text-center text-sm text-gray-700">
                                            {user.stats?.playlistsPlayed || 0}
                                        </td>
                                        <td className="py-3 px-2 text-center text-sm text-gray-700">
                                            {user.kidProfileCount || 0}
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                                                user.subscriptionStatus === 'trial' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {user.subscriptionStatus || 'free'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;

