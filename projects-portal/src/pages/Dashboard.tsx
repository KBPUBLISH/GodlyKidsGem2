import React, { useState, useEffect } from 'react';
import { 
    Users, UserPlus, Coins, Baby, Calendar, TrendingUp, 
    Activity, Crown, Smartphone, Globe, Monitor, RefreshCw,
    ChevronDown, ChevronUp, Search, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

interface UserData {
    id: string;
    email: string;
    deviceId?: string;
    coins: number;
    kidCount: number;
    kids: { name: string; age?: number }[];
    sessions: number;
    booksRead: number;
    gamesPlayed: number;
    subscriptionStatus: string;
    platform: string;
    referralCode?: string;
    referralCount: number;
    createdAt: string;
    lastActiveAt?: string;
}

interface AnalyticsData {
    summary: {
        totalUsers: number;
        totalCoins: number;
        totalKids: number;
        totalSessions: number;
        totalBooksRead: number;
        totalGamesPlayed: number;
    };
    newAccounts: {
        today: number;
        thisWeek: number;
        thisMonth: number;
    };
    activeUsers: {
        today: number;
        thisWeek: number;
        thisMonth: number;
    };
    subscriptionStats: {
        free: number;
        trial: number;
        active: number;
        cancelled: number;
        expired: number;
    };
    platformStats: {
        ios: number;
        android: number;
        web: number;
        unknown: number;
    };
    dailySignups: { date: string; count: number }[];
    weeklySignups: { weekStart: string; count: number }[];
    users: UserData[];
}

// Ensure API_BASE always ends with /api
const getApiBase = () => {
    let base = import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
    // Remove trailing slash if present
    base = base.replace(/\/$/, '');
    // Add /api if not present
    if (!base.endsWith('/api')) {
        base = `${base}/api`;
    }
    return base;
};
const API_BASE = getApiBase();

const Dashboard: React.FC = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'createdAt' | 'coins' | 'sessions' | 'kidCount'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [timeView, setTimeView] = useState<'daily' | 'weekly'>('daily');

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/analytics/users`);
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
    }, []);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatShortDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const getSubscriptionBadgeColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700';
            case 'trial': return 'bg-blue-100 text-blue-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            case 'expired': return 'bg-gray-100 text-gray-700';
            default: return 'bg-yellow-100 text-yellow-700';
        }
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'ios': return <Smartphone className="w-4 h-4 text-gray-500" />;
            case 'android': return <Smartphone className="w-4 h-4 text-green-500" />;
            case 'web': return <Globe className="w-4 h-4 text-blue-500" />;
            default: return <Monitor className="w-4 h-4 text-gray-400" />;
        }
    };

    // Filter and sort users
    const filteredUsers = data?.users
        .filter(user => {
            const search = searchTerm.toLowerCase();
            return (
                user.email.toLowerCase().includes(search) ||
                user.deviceId?.toLowerCase().includes(search) ||
                user.kids.some(k => k.name.toLowerCase().includes(search))
            );
        })
        .sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'coins':
                    comparison = a.coins - b.coins;
                    break;
                case 'sessions':
                    comparison = a.sessions - b.sessions;
                    break;
                case 'kidCount':
                    comparison = a.kidCount - b.kidCount;
                    break;
                default:
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        }) || [];

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
    const maxDaily = Math.max(...data.dailySignups.map(d => d.count), 1);
    const maxWeekly = Math.max(...data.weeklySignups.map(d => d.count), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-600" />
                        User Dashboard
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Monitor user activity, accounts, and engagement
                    </p>
                </div>
                <button 
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Users className="w-4 h-4" />
                        Total Users
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{data.summary.totalUsers.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        Total Coins
                    </div>
                    <p className="text-2xl font-bold text-yellow-600">{data.summary.totalCoins.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Baby className="w-4 h-4 text-pink-500" />
                        Total Kids
                    </div>
                    <p className="text-2xl font-bold text-pink-600">{data.summary.totalKids.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Activity className="w-4 h-4 text-green-500" />
                        Total Sessions
                    </div>
                    <p className="text-2xl font-bold text-green-600">{data.summary.totalSessions.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Books Read
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{data.summary.totalBooksRead.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Crown className="w-4 h-4 text-purple-500" />
                        Games Played
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{data.summary.totalGamesPlayed.toLocaleString()}</p>
                </div>
            </div>

            {/* New Accounts & Active Users Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* New Accounts */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                        <UserPlus className="w-5 h-5 text-indigo-600" />
                        New Accounts
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-indigo-50 rounded-lg">
                            <p className="text-2xl font-bold text-indigo-600">{data.newAccounts.today}</p>
                            <p className="text-xs text-gray-500">Today</p>
                        </div>
                        <div className="text-center p-3 bg-indigo-50 rounded-lg">
                            <p className="text-2xl font-bold text-indigo-600">{data.newAccounts.thisWeek}</p>
                            <p className="text-xs text-gray-500">This Week</p>
                        </div>
                        <div className="text-center p-3 bg-indigo-50 rounded-lg">
                            <p className="text-2xl font-bold text-indigo-600">{data.newAccounts.thisMonth}</p>
                            <p className="text-xs text-gray-500">This Month</p>
                        </div>
                    </div>
                </div>

                {/* Active Users */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-green-600" />
                        Active Users
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{data.activeUsers.today}</p>
                            <p className="text-xs text-gray-500">Today</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{data.activeUsers.thisWeek}</p>
                            <p className="text-xs text-gray-500">This Week</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{data.activeUsers.thisMonth}</p>
                            <p className="text-xs text-gray-500">This Month</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subscription & Platform Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Subscription Breakdown */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Subscription Status</h3>
                    <div className="space-y-3">
                        {Object.entries(data.subscriptionStats).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                                <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getSubscriptionBadgeColor(status)}`}>
                                    {status}
                                </span>
                                <div className="flex-1 mx-4 bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${
                                            status === 'active' ? 'bg-green-500' :
                                            status === 'trial' ? 'bg-blue-500' :
                                            status === 'cancelled' ? 'bg-red-500' :
                                            status === 'expired' ? 'bg-gray-500' :
                                            'bg-yellow-500'
                                        }`}
                                        style={{ width: `${(count / data.summary.totalUsers) * 100}%` }}
                                    />
                                </div>
                                <span className="text-sm font-semibold text-gray-700 w-12 text-right">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Platform Breakdown */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Platform Distribution</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Smartphone className="w-6 h-6 text-gray-600" />
                            <div>
                                <p className="text-xl font-bold text-gray-900">{data.platformStats.ios}</p>
                                <p className="text-xs text-gray-500">iOS</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                            <Smartphone className="w-6 h-6 text-green-600" />
                            <div>
                                <p className="text-xl font-bold text-gray-900">{data.platformStats.android}</p>
                                <p className="text-xs text-gray-500">Android</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                            <Globe className="w-6 h-6 text-blue-600" />
                            <div>
                                <p className="text-xl font-bold text-gray-900">{data.platformStats.web}</p>
                                <p className="text-xs text-gray-500">Web</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Monitor className="w-6 h-6 text-gray-400" />
                            <div>
                                <p className="text-xl font-bold text-gray-900">{data.platformStats.unknown}</p>
                                <p className="text-xs text-gray-500">Unknown</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Signups Chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Signups Over Time
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTimeView('daily')}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                                timeView === 'daily' 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Daily (30d)
                        </button>
                        <button
                            onClick={() => setTimeView('weekly')}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                                timeView === 'weekly' 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Weekly (12w)
                        </button>
                    </div>
                </div>
                <div className="h-48 flex items-end gap-1">
                    {(timeView === 'daily' ? data.dailySignups : data.weeklySignups).map((item, idx) => {
                        const max = timeView === 'daily' ? maxDaily : maxWeekly;
                        const height = (item.count / max) * 100;
                        return (
                            <div 
                                key={idx} 
                                className="flex-1 flex flex-col items-center group"
                            >
                                <div 
                                    className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors cursor-pointer relative"
                                    style={{ height: `${Math.max(height, 2)}%` }}
                                >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        {item.count} signups
                                    </div>
                                </div>
                                {(timeView === 'daily' && idx % 5 === 0) || timeView === 'weekly' ? (
                                    <span className="text-[10px] text-gray-400 mt-1 -rotate-45 origin-left">
                                        {formatShortDate('date' in item ? item.date : item.weekStart)}
                                    </span>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-800">All Users</h3>
                        <div className="flex gap-3 w-full md:w-auto">
                            {/* Search */}
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            {/* Sort */}
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="createdAt">Sort by Date</option>
                                <option value="coins">Sort by Coins</option>
                                <option value="sessions">Sort by Sessions</option>
                                <option value="kidCount">Sort by Kids</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                {sortOrder === 'desc' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">User</th>
                                <th className="px-4 py-3 text-center font-medium">Kids</th>
                                <th className="px-4 py-3 text-center font-medium">Coins</th>
                                <th className="px-4 py-3 text-center font-medium">Sessions</th>
                                <th className="px-4 py-3 text-center font-medium">Status</th>
                                <th className="px-4 py-3 text-center font-medium">Platform</th>
                                <th className="px-4 py-3 text-left font-medium">Created</th>
                                <th className="px-4 py-3 text-left font-medium">Last Active</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map(user => (
                                <React.Fragment key={user.id}>
                                    <tr 
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {expandedUserId === user.id ? 
                                                    <ChevronUp className="w-4 h-4 text-gray-400" /> : 
                                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                                }
                                                <div>
                                                    <p className="font-medium text-gray-800">{user.email}</p>
                                                    {user.deviceId && (
                                                        <p className="text-xs text-gray-400 truncate max-w-[150px]">{user.deviceId}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 text-pink-600 text-xs font-bold">
                                                {user.kidCount}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-yellow-600 font-semibold">{user.coins.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-600">{user.sessions}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getSubscriptionBadgeColor(user.subscriptionStatus)}`}>
                                                {user.subscriptionStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getPlatformIcon(user.platform)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {formatDate(user.createdAt)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {user.lastActiveAt ? formatDate(user.lastActiveAt) : '-'}
                                        </td>
                                    </tr>
                                    {expandedUserId === user.id && (
                                        <tr className="bg-indigo-50">
                                            <td colSpan={8} className="px-6 py-4">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Kid Profiles</p>
                                                        {user.kids.length > 0 ? (
                                                            <ul className="space-y-1">
                                                                {user.kids.map((kid, idx) => (
                                                                    <li key={idx} className="text-sm text-gray-800">
                                                                        {kid.name} {kid.age ? `(Age ${kid.age})` : ''}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p className="text-sm text-gray-400">No kids</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Activity</p>
                                                        <p className="text-sm">📚 {user.booksRead} books read</p>
                                                        <p className="text-sm">🎮 {user.gamesPlayed} games played</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Referral</p>
                                                        <p className="text-sm font-mono">{user.referralCode || 'N/A'}</p>
                                                        <p className="text-xs text-gray-400">{user.referralCount} referrals</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">User ID</p>
                                                        <p className="text-xs font-mono text-gray-600 break-all">{user.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No users found
                    </div>
                )}

                <div className="p-4 border-t border-gray-100 text-sm text-gray-500">
                    Showing {filteredUsers.length} of {data.users.length} users
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
