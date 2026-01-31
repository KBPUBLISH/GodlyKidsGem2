import React, { useEffect, useState } from 'react';
import { Gamepad2, Users, Clock, Coins, Star, Trophy, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import apiClient from '../services/apiClient';

interface GameStats {
    gameId: string;
    gameName: string;
    totalPlays: number;
    uniquePlayers: number;
    totalSessionSeconds: number;
    avgSessionSeconds: number;
    totalCoinsEarned: number;
    totalStarsEarned: number;
    completionRate: number;
}

interface RecentPlay {
    id: string;
    gameId: string;
    gameName: string;
    userId: string;
    kidName?: string;
    sessionDurationSeconds: number;
    starsEarned: number;
    coinsEarned: number;
    completed: boolean;
    playedAt: string;
}

interface GameAnalytics {
    summary: {
        totalPlays: number;
        uniquePlayerCount: number;
        totalSessionMinutes: number;
        avgSessionSeconds: number;
        totalCoinsEarned: number;
        totalStarsEarned: number;
        completionRate: number;
    };
    games: GameStats[];
    dailyPlays: { date: string; plays: number; uniquePlayers: number }[];
    recentPlays: RecentPlay[];
}

type SortField = 'totalPlays' | 'uniquePlayers' | 'avgSessionSeconds' | 'completionRate' | 'totalCoinsEarned';
type SortDirection = 'asc' | 'desc';

const GamesAnalytics: React.FC = () => {
    const [data, setData] = useState<GameAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('totalPlays');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [showAllGames, setShowAllGames] = useState(false);

    useEffect(() => {
        fetchGameAnalytics();
    }, []);

    const fetchGameAnalytics = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/api/analytics/games');
            setData(response.data);
        } catch (err: any) {
            console.error('Error fetching game analytics:', err);
            setError(err.response?.data?.message || 'Failed to load game analytics');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedGames = data?.games ? [...data.games].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }) : [];

    const displayedGames = showAllGames ? sortedGames : sortedGames.slice(0, 10);

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const SortButton: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
        <button
            onClick={() => handleSort(field)}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                sortField === field ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
            {label}
            {sortField === field && (
                sortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
            )}
        </button>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600">{error}</p>
                <button 
                    onClick={fetchGameAnalytics}
                    className="mt-2 text-sm text-indigo-600 hover:underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
                <Gamepad2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No game analytics data available</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                        <Gamepad2 className="w-4 h-4" />
                        Total Plays
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{data.summary.totalPlays.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                        <Users className="w-4 h-4" />
                        Unique Players
                    </div>
                    <p className="text-2xl font-bold text-indigo-600">{data.summary.uniquePlayerCount.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                        <Clock className="w-4 h-4" />
                        Total Time
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{data.summary.totalSessionMinutes}m</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                        <TrendingUp className="w-4 h-4" />
                        Avg Session
                    </div>
                    <p className="text-2xl font-bold text-teal-600">{data.summary.avgSessionSeconds}s</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                        <Coins className="w-4 h-4" />
                        Coins Earned
                    </div>
                    <p className="text-2xl font-bold text-yellow-600">{data.summary.totalCoinsEarned.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                        <Trophy className="w-4 h-4" />
                        Completion Rate
                    </div>
                    <p className="text-2xl font-bold text-green-600">{data.summary.completionRate}%</p>
                </div>
            </div>

            {/* Games Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Games Performance</h3>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <SortButton field="totalPlays" label="Most Played" />
                        <SortButton field="uniquePlayers" label="Most Players" />
                        <SortButton field="avgSessionSeconds" label="Longest Sessions" />
                        <SortButton field="completionRate" label="Completion Rate" />
                        <SortButton field="totalCoinsEarned" label="Coins Earned" />
                    </div>
                </div>

                {displayedGames.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">Game</th>
                                    <th className="px-4 py-3 text-center">Plays</th>
                                    <th className="px-4 py-3 text-center">Players</th>
                                    <th className="px-4 py-3 text-center">Avg Session</th>
                                    <th className="px-4 py-3 text-center">Completion</th>
                                    <th className="px-4 py-3 text-center">Coins</th>
                                    <th className="px-4 py-3 text-center">Stars</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayedGames.map((game, index) => (
                                    <tr key={game.gameId} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 text-sm">#{index + 1}</span>
                                                <Gamepad2 className="w-4 h-4 text-purple-500" />
                                                <span className="font-medium text-gray-900">{game.gameName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="font-semibold text-purple-600">{game.totalPlays.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-indigo-600">{game.uniquePlayers.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-blue-600">{formatDuration(game.avgSessionSeconds)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-green-500 rounded-full"
                                                        style={{ width: `${game.completionRate}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-600">{game.completionRate}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-yellow-600 flex items-center justify-center gap-1">
                                                <Coins className="w-3 h-3" />
                                                {game.totalCoinsEarned.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-amber-500 flex items-center justify-center gap-1">
                                                <Star className="w-3 h-3" />
                                                {game.totalStarsEarned.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        No game data available yet
                    </div>
                )}

                {sortedGames.length > 10 && (
                    <div className="p-3 border-t border-gray-100 text-center">
                        <button
                            onClick={() => setShowAllGames(!showAllGames)}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            {showAllGames ? 'Show Less' : `Show All ${sortedGames.length} Games`}
                        </button>
                    </div>
                )}
            </div>

            {/* Recent Plays */}
            {data.recentPlays.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Recent Game Sessions</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {data.recentPlays.slice(0, 15).map((play) => (
                            <div key={play.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                        play.completed ? 'bg-green-100' : 'bg-gray-100'
                                    }`}>
                                        {play.completed ? (
                                            <Trophy className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <Gamepad2 className="w-4 h-4 text-gray-500" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{play.gameName}</p>
                                        <p className="text-xs text-gray-500">
                                            {play.kidName || 'Anonymous'} • {formatDate(play.playedAt)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-blue-600 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(play.sessionDurationSeconds)}
                                    </span>
                                    {play.coinsEarned > 0 && (
                                        <span className="text-yellow-600 flex items-center gap-1">
                                            <Coins className="w-3 h-3" />
                                            +{play.coinsEarned}
                                        </span>
                                    )}
                                    {play.starsEarned > 0 && (
                                        <span className="text-amber-500 flex items-center gap-1">
                                            <Star className="w-3 h-3" />
                                            +{play.starsEarned}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GamesAnalytics;
